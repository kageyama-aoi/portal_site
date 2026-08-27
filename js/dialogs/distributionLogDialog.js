/**
 * @file distributionLogDialog.js
 * @brief 作業フロー出力の発行履歴（配布台帳）を表示・編集するダイアログ。
 *        「どの版を・いつ・誰に配ったか」をメモレベルで確認/追記できる。
 * @module DistributionLogDialog
 */

import { LEDGER_FILE_NAME, LEDGER_FILE_PATH } from '../distributionLog.js';

/**
 * @class DistributionLogDialog
 * @brief 発行履歴ダイアログを制御します。DistributionLogManager の内容を一覧・編集し、CSV/JSON を書き出します。
 */
export class DistributionLogDialog {
  /**
   * @param {import('../distributionLog.js').DistributionLogManager} logManager
   * @param {import('../configManager.js').ConfigManager} configManager
   */
  constructor(logManager, configManager) {
    this.logManager = logManager;
    this.configManager = configManager;
    this.dialog = null;
    /** @type {string} 絞り込み中のワークフローID（''=全件） */
    this.filterWorkflowId = '';
  }

  /** ダイアログ要素を取得します。 */
  init() {
    this.dialog = document.getElementById('distributionLogDialog');
  }

  /** ダイアログを開いて一覧を描画します。 */
  open() {
    if (!this.dialog) return;
    this._render();
    this.dialog.showModal();
  }

  /** @private HTML特殊文字をエスケープします。 */
  _esc(str) {
    return String(str == null ? '' : str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  /** @private 日時を「MM/DD HH:mm」で表示します。 */
  _fmtDate(iso) {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return this._esc(iso);
    const p = n => String(n).padStart(2, '0');
    return `${p(d.getMonth() + 1)}/${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
  }

  /** @private ブラウザにテキストファイルをダウンロードさせます。 */
  _download(filename, text, mime) {
    const blob = new Blob([text], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  /** @private ダイアログ本体を描画します。 */
  _render() {
    const content = document.getElementById('distributionLogDialogContent');
    if (!content) return;

    const all = this.logManager.getEntries();
    const titlesById = {};
    all.forEach(e => { titlesById[e.workflowId] = e.title || e.workflowId; });
    const workflowIds = Object.keys(titlesById);

    const entries = this.filterWorkflowId
      ? all.filter(e => e.workflowId === this.filterWorkflowId)
      : all;

    const filterOptions = ['<option value="">すべての作業フロー</option>']
      .concat(workflowIds.map(id =>
        `<option value="${this._esc(id)}" ${id === this.filterWorkflowId ? 'selected' : ''}>${this._esc(titlesById[id])}</option>`
      )).join('');

    let summaryHtml = '';
    if (this.filterWorkflowId) {
      const s = this.logManager.summaryFor(this.filterWorkflowId);
      if (s) {
        summaryHtml = `<div class="dist-summary">
          配布 ${s.count} 件 ／ いちばん古い配布は v${s.oldestRev}
          ${s.oldestNote ? `（${this._esc(s.oldestNote)}` : '（'}${s.oldestAt ? ' ・ ' + this._fmtDate(s.oldestAt) : ''}）
        </div>`;
      }
    }

    const rowsHtml = entries.length === 0
      ? `<div class="dist-empty">まだ発行履歴がありません。作業フローを PDF / HTML 出力すると自動で記録されます。</div>`
      : entries.map(e => `
        <div class="dist-row" data-id="${this._esc(e.id)}">
          <div class="dist-row-main">
            <span class="dist-when">${this._fmtDate(e.exportedAt)}</span>
            <span class="dist-title">${this._esc(e.title)}</span>
            <span class="dist-rev">v${e.rev || 1}</span>
            <span class="dist-fmt dist-fmt-${this._esc(e.format)}">${this._esc((e.format || '').toUpperCase())}</span>
            ${e.manual ? '<span class="dist-manual">手入力</span>' : ''}
            <span class="dist-code">${this._esc(e.code || '')}</span>
          </div>
          <div class="dist-row-note">
            <input type="text" class="dist-note-input" value="${this._esc(e.recipientNote || '')}"
                   placeholder="配布先メモ（例: 営業部 田中さん）" data-id="${this._esc(e.id)}">
            <button type="button" class="dist-del-btn" data-id="${this._esc(e.id)}" title="この行を削除">
              <span class="icon icon-sm">delete</span>
            </button>
          </div>
        </div>
      `).join('');

    const dirty = !!this.logManager.hasUnsavedChanges;

    content.innerHTML = `
      <div class="dist-header">
        <h3 style="margin:0;">発行履歴</h3>
        <p class="dist-note-help">
          どの版をいつ誰に配ったかの記録です。配布物には含まれません。<br>
          この端末内で共有するには「台帳を保存」で <code>${this._esc(LEDGER_FILE_NAME)}</code> を書き出し、
          <code>${this._esc(LEDGER_FILE_PATH)}</code> に置いてください（起動時に自動で取り込まれます）。
        </p>
      </div>
      ${dirty ? `<div class="dist-dirty">未保存の追記があります。「台帳を保存」で <code>${this._esc(LEDGER_FILE_NAME)}</code> を更新してください。</div>` : ''}
      <div class="dist-toolbar">
        <select id="distFilterSelect" class="dist-filter">${filterOptions}</select>
        <div class="dist-toolbar-right">
          <button type="button" id="distAddManualBtn" class="secondary-btn">
            <span class="icon icon-sm">add</span> 手入力で追加
          </button>
          <button type="button" id="distLoadBtn" class="secondary-btn" title="別の台帳ファイルを選んでマージ">読み込み</button>
          <button type="button" id="distExportCsvBtn" class="secondary-btn">CSV</button>
          <button type="button" id="distSaveBtn" class="primary-btn${dirty ? '' : ' '}">
            <span class="icon icon-sm">save</span> 台帳を保存
          </button>
        </div>
      </div>
      <input type="file" id="distLoadInput" accept="application/json,.json" style="display:none;">
      ${summaryHtml}
      <div class="dist-list">${rowsHtml}</div>
      <div style="display:flex; justify-content:flex-end; margin-top:14px;">
        <button type="button" id="distCloseBtn" class="secondary-btn">閉じる</button>
      </div>
    `;

    content.querySelector('#distFilterSelect').addEventListener('change', e => {
      this.filterWorkflowId = e.target.value;
      this._render();
    });
    content.querySelector('#distCloseBtn').addEventListener('click', () => this.dialog.close());
    content.querySelector('#distExportCsvBtn').addEventListener('click', () => {
      const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      // Excel 互換のため BOM 付き
      this._download(`発行履歴_${stamp}.csv`, '﻿' + this.logManager.toCsv(), 'text/csv');
    });
    content.querySelector('#distSaveBtn').addEventListener('click', () => {
      this._download(LEDGER_FILE_NAME, this.logManager.toFileJson(), 'application/json');
      this.logManager.markSaved();
      this._render();
    });
    const loadInput = content.querySelector('#distLoadInput');
    content.querySelector('#distLoadBtn').addEventListener('click', () => loadInput.click());
    loadInput.addEventListener('change', () => {
      const file = loadInput.files && loadInput.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const data = JSON.parse(reader.result);
          const { added, updated } = this.logManager.mergeEntries(
            Array.isArray(data) ? data : (data && data.entries) || []
          );
          alert(`取り込み完了: 新規 ${added} 件 / 更新 ${updated} 件`);
          this._render();
        } catch (e) {
          alert('読み込みに失敗しました。台帳の JSON ファイルを選んでください。');
        }
      };
      reader.readAsText(file);
    });
    content.querySelector('#distAddManualBtn').addEventListener('click', () => this._addManual());

    content.querySelectorAll('.dist-note-input').forEach(input => {
      const commit = () => this.logManager.updateEntry(input.dataset.id, { recipientNote: input.value.trim() });
      input.addEventListener('change', commit);
      input.addEventListener('blur', commit);
    });
    content.querySelectorAll('.dist-del-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        if (confirm('この発行履歴を削除しますか？')) {
          this.logManager.deleteEntry(btn.dataset.id);
          this._render();
        }
      });
    });
  }

  /** @private アプリ外で配布したぶんを手入力で1件足します。 */
  _addManual() {
    const workflows = this._activeWorkflows();
    if (workflows.length === 0) {
      alert('先に作業フローを登録してください。');
      return;
    }
    const list = workflows.map((w, i) => `${i + 1}. ${w.title}（v${w.rev || 1}）`).join('\n');
    const pick = prompt(`どの作業フローの配布ですか？ 番号を入力してください。\n\n${list}`);
    const idx = Number(pick) - 1;
    if (!Number.isInteger(idx) || idx < 0 || idx >= workflows.length) return;
    const wf = workflows[idx];
    const note = (prompt('配布先メモ（例: 営業部 田中さん）') || '').trim();

    this.logManager.addEntry({
      portalId: this.configManager.getActivePortalId(),
      workflowId: wf.id,
      title: wf.title,
      rev: wf.rev || 1,
      code: wf.code || '',
      format: 'other',
      recipientNote: note,
      manual: true
    });
    this._render();
  }

  /**
   * @private アクティブポータルの作業フロー一覧（手入力の対象選択に使う）。
   *   UI 側から `workflowsProvider` が注入されていればそれを使う。
   * @returns {Array<{id:string,title:string,rev:number,code?:string}>}
   */
  _activeWorkflows() {
    if (typeof this.workflowsProvider === 'function') {
      try { return this.workflowsProvider() || []; } catch (e) { return []; }
    }
    return [];
  }
}
