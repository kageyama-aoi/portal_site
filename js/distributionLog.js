/**
 * @file distributionLog.js
 * @brief 作業フロー HTML/PDF の発行履歴（配布台帳）を localStorage で管理する。
 *        「どの版を・いつ・誰に配ったか」をメモレベルで残すためのもの。厳密な宛先管理は目的にしない。
 *        配布物（出力HTML）には配布先メモを一切含めない。台帳は配布側の手元だけに残る。
 * @module distributionLog
 */

const LOG_KEY = 'portalWorkflowDistributionLog';
const PREFS_KEY = 'portalWorkflowExportPrefs';

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
    }
  }

  /**
   * 指定行を削除します。
   * @param {string} id
   */
  deleteEntry(id) {
    const list = this._read(LOG_KEY, []);
    if (!Array.isArray(list)) return;
    this._write(LOG_KEY, list.filter(e => e.id !== id));
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
