/**
 * @file distributionLog.js
 * @brief 作業フロー HTML/PDF の発行履歴（配布台帳）を管理する。
 *        「どの版を・いつ・誰に配ったか」をメモレベルで残すためのもの。厳密な宛先管理は目的にしない。
 *        配布物（出力HTML）には配布先メモを一切含めない。台帳は配布側の手元だけに残る。
 *
 *        保存モデル（data.json と同じ考え方）:
 *        - localStorage を「作業コピー」として常時保持（リロードで消えない）
 *        - `data/distribution-log.json` を「共有・バックアップ用ファイル」とする。
 *          起動時に fetch してマージ（同一PC内なら複数ブラウザ/オリジンで同じ履歴を見られる）。
 *          追記が発生したら「台帳を保存」でこのファイルを書き出し、data/ に置き直す。
 *        - 配布先メモに個人名が入りうるため、このファイルは .gitignore 対象。
 * @module distributionLog
 */

const LOG_KEY = 'portalWorkflowDistributionLog';
const PREFS_KEY = 'portalWorkflowExportPrefs';

/** 共有・バックアップ用ファイルの相対パス（起動時 fetch / 保存時ファイル名）。 */
export const LEDGER_FILE_PATH = 'data/distribution-log.json';
export const LEDGER_FILE_NAME = 'distribution-log.json';

/**
 * @typedef {object} DistributionEntry
 * @property {string} id
 * @property {string} portalId
 * @property {string} workflowId
 * @property {string} title
 * @property {number} rev
 * @property {string} code - 照合コード（verificationCode）
 * @property {'html'|'pdf'} format
 * @property {string} exportedAt - ISO 文字列
 * @property {string} recipientNote - 配布先メモ（自由記述・任意）
 * @property {boolean} [manual] - アプリ外の配布を手入力した行かどうか
 */

/**
 * @class DistributionLogManager
 * @brief 発行履歴の CRUD と CSV/JSON 書き出し、出力ダイアログの前回値の記憶を担う。
 */
export class DistributionLogManager {
  /**
   * @param {Storage|null} [storage] - 省略時は localStorage。テストではモックを渡す。
   */
  constructor(storage) {
    this.storage = storage !== undefined
      ? storage
      : (typeof localStorage !== 'undefined' ? localStorage : null);
    /**
     * 共有ファイル（distribution-log.json）へ未書き出しの変更があるか。
     * add/update/deleteEntry で true、保存・ファイル取り込みで false になる。
     * @type {boolean}
     */
    this.hasUnsavedChanges = false;
    /** @type {(() => void)|null} 未保存状態が変わったときに呼ぶ（UIのバッジ更新用）。 */
    this.onDirtyChange = null;
  }

  /** @private 未保存フラグを更新し、変化があれば通知する。 */
  _setDirty(v) {
    if (this.hasUnsavedChanges === v) return;
    this.hasUnsavedChanges = v;
    if (typeof this.onDirtyChange === 'function') this.onDirtyChange();
  }

  /** @private */
  _read(key, fallback) {
    if (!this.storage) return fallback;
    try {
      const raw = this.storage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (e) {
      return fallback;
    }
  }

  /** @private */
  _write(key, value) {
    if (!this.storage) return;
    try {
      this.storage.setItem(key, JSON.stringify(value));
    } catch (e) {
      /* 保存できなくても致命的ではない */
    }
  }

  /**
   * 発行履歴を新しい順で返します。
   * @returns {DistributionEntry[]}
   */
  getEntries() {
    const list = this._read(LOG_KEY, []);
    if (!Array.isArray(list)) return [];
    return [...list].sort((a, b) => String(b.exportedAt || '').localeCompare(String(a.exportedAt || '')));
  }

  /**
   * 発行履歴を1件追加します。
   * @param {Omit<DistributionEntry, 'id'>} entry
   * @returns {DistributionEntry} 追加された行（id 付き）
   */
  addEntry(entry) {
    const list = this._read(LOG_KEY, []);
    const full = {
      id: `dist_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
      exportedAt: new Date().toISOString(),
      recipientNote: '',
      ...entry
    };
    (Array.isArray(list) ? list : []).push(full);
    this._write(LOG_KEY, Array.isArray(list) ? list : [full]);
    this._setDirty(true);
    return full;
  }

  /**
   * 指定行を部分更新します（主に配布先メモの後追記）。
   * @param {string} id
   * @param {Partial<DistributionEntry>} patch
   */
  updateEntry(id, patch) {
    const list = this._read(LOG_KEY, []);
    if (!Array.isArray(list)) return;
    const idx = list.findIndex(e => e.id === id);
    if (idx !== -1) {
      list[idx] = { ...list[idx], ...patch };
      this._write(LOG_KEY, list);
      this._setDirty(true);
    }
  }

  /**
   * 指定行を削除します。
   * @param {string} id
   */
  deleteEntry(id) {
    const list = this._read(LOG_KEY, []);
    if (!Array.isArray(list)) return;
    const next = list.filter(e => e.id !== id);
    if (next.length !== list.length) {
      this._write(LOG_KEY, next);
      this._setDirty(true);
    }
  }

  /**
   * 別の履歴リストを id で突き合わせてマージします（同一 id は引数側で上書き、新規行は追加）。
   * 起動時のファイル取り込み・手動の台帳読み込みの両方で使います。
   * @param {DistributionEntry[]} incoming
   * @returns {{added: number, updated: number}}
   */
  mergeEntries(incoming) {
    if (!Array.isArray(incoming)) return { added: 0, updated: 0 };
    const list = this._read(LOG_KEY, []);
    const byId = new Map((Array.isArray(list) ? list : []).map(e => [e.id, e]));
    let added = 0;
    let updated = 0;
    for (const e of incoming) {
      if (!e || !e.id) continue;
      if (byId.has(e.id)) {
        byId.set(e.id, { ...byId.get(e.id), ...e });
        updated++;
      } else {
        byId.set(e.id, e);
        added++;
      }
    }
    this._write(LOG_KEY, Array.from(byId.values()));
    return { added, updated };
  }

  /**
   * 共有ファイル（distribution-log.json）の中身を取り込みます。マージ方式。
   * 起動時の fetch 結果や、手動で選んだファイルの JSON を渡します。
   * 取り込み後は「保存済み」扱いにします（＝この時点でファイルと localStorage が一致）。
   * @param {object|DistributionEntry[]} fileData - `{entries:[...]}` または素の配列
   * @returns {{added: number, updated: number}}
   */
  applyFileData(fileData) {
    const entries = Array.isArray(fileData)
      ? fileData
      : (fileData && Array.isArray(fileData.entries) ? fileData.entries : []);
    const result = this.mergeEntries(entries);
    // 取り込み直後は「保存する必要がない」状態にそろえる
    this._setDirty(false);
    return result;
  }

  /** 共有ファイルへ書き出したことを記録します（未保存フラグを下ろす）。 */
  markSaved() {
    this._setDirty(false);
  }

  /**
   * 共有ファイル（distribution-log.json）に書き出す JSON 文字列を返します。
   * @returns {string}
   */
  toFileJson() {
    return JSON.stringify({
      schema: 1,
      savedAt: new Date().toISOString(),
      entries: this.getEntries()
    }, null, 2);
  }

  /**
   * 直近に入力された配布先メモの一覧（重複除去・最大10件）。入力候補に使う。
   * @returns {string[]}
   */
  getRecentRecipients() {
    const seen = [];
    for (const e of this.getEntries()) {
      const n = String(e.recipientNote || '').trim();
      if (n && !seen.includes(n)) seen.push(n);
      if (seen.length >= 10) break;
    }
    return seen;
  }

  /**
   * 出力ダイアログの前回値（見直し予定日・入手先）を返します。
   * @returns {{reviewDue: string, sourceHint: string}}
   */
  getExportPrefs() {
    const p = this._read(PREFS_KEY, {});
    return {
      reviewDue: (p && typeof p.reviewDue === 'string') ? p.reviewDue : '',
      sourceHint: (p && typeof p.sourceHint === 'string') ? p.sourceHint : ''
    };
  }

  /**
   * 出力ダイアログの前回値を保存します。
   * @param {{reviewDue?: string, sourceHint?: string}} prefs
   */
  setExportPrefs(prefs) {
    this._write(PREFS_KEY, { ...this.getExportPrefs(), ...prefs });
  }

  /**
   * 指定フローの配布状況サマリを返します。
   * @param {string} workflowId
   * @returns {{count: number, latestRev: number, oldestRev: number, oldestNote: string, oldestAt: string}|null}
   */
  summaryFor(workflowId) {
    const entries = this.getEntries().filter(e => e.workflowId === workflowId);
    if (entries.length === 0) return null;
    const oldest = entries.reduce((a, b) => ((a.rev || 0) <= (b.rev || 0) ? a : b));
    const latest = entries.reduce((a, b) => ((a.rev || 0) >= (b.rev || 0) ? a : b));
    return {
      count: entries.length,
      latestRev: latest.rev || 0,
      oldestRev: oldest.rev || 0,
      oldestNote: oldest.recipientNote || '',
      oldestAt: oldest.exportedAt || ''
    };
  }

  /**
   * 発行履歴を CSV 文字列（Excel 想定・CRLF 区切り）で返します。
   * @returns {string}
   */
  toCsv() {
    const rows = [['出力日時', 'フロー', '版', '照合コード', '形式', '配布先メモ']];
    for (const e of this.getEntries()) {
      rows.push([
        e.exportedAt || '',
        e.title || '',
        'v' + (e.rev || ''),
        e.code || '',
        e.format || '',
        e.recipientNote || ''
      ]);
    }
    return rows
      .map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(','))
      .join('\r\n');
  }

  /**
   * 発行履歴を JSON 文字列で返します。
   * @returns {string}
   */
  toJson() {
    return JSON.stringify(this.getEntries(), null, 2);
  }
}
