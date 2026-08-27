/**
 * @file workflowDialog.js
 * @brief ワークフローの閲覧・作成・編集・削除を行うダイアログクラス。
 * @module WorkflowDialog
 */

import { initTagsSuggest } from '../tagSuggest.js';
import { escapeHtml } from '../util/html.js';
import { freqLabel } from '../workflowConstants.js';

/**
 * @class WorkflowDialog
 * @brief ワークフロー管理ダイアログを制御します。
 *        リスト表示と編集フォームを切り替えて表示します。
 */
export class WorkflowDialog {
  /** @property {WorkflowManager} workflowManager */
  workflowManager;
  /** @property {DataManager} dataManager */
  dataManager;
  /** @property {ConfigManager} configManager */
  configManager;
  /** @property {function} renderCallback */
  renderCallback;
  /** @property {SearchManager} searchManager - タグ候補の収集に使う。 */
  searchManager;
  /** @property {TagManager} tagManager - タグ候補の収集に使う。 */
  tagManager;
  /** @property {HTMLDialogElement} dialog */
  dialog;
  /** @property {string|null} editingWorkflowId - 編集中のワークフローID */
  editingWorkflowId = null;
  /**
   * @property {string[]} _knownTagsCache - _renderEdit() のたびに計算し直すタグ候補一覧。
   * キー入力のたびに全リンクを再スキャンしないよう、フォームを開いている間は使い回す。
   */
  _knownTagsCache = [];

  /**
   * @param {WorkflowManager} workflowManager
   * @param {DataManager} dataManager
   * @param {ConfigManager} configManager
   * @param {function} renderCallback
   * @param {SearchManager} [searchManager]
   * @param {TagManager} [tagManager]
   */
  constructor(workflowManager, dataManager, configManager, renderCallback, searchManager = null, tagManager = null) {
    this.workflowManager = workflowManager;
    this.dataManager = dataManager;
    this.configManager = configManager;
    this.renderCallback = renderCallback;
    this.searchManager = searchManager;
    this.tagManager = tagManager;
  }

  /**
   * ダイアログを初期化します。
   */
  init() {
    this.dialog = document.getElementById('workflowDialog');
  }

  /**
   * ワークフロー一覧を表示してダイアログを開きます。
   */
  open() {
    this.editingWorkflowId = null;
    this._renderList();
    this.dialog.showModal();
  }

  /**
   * @private - ワークフロー一覧パネルを描画します。
   */
  _renderList() {
    const portalId = this.configManager.getActivePortalId();
    const workflows = this.workflowManager.getWorkflows(portalId);
    const content = document.getElementById('workflowDialogContent');

    content.innerHTML = `
      <div class="wf-list-header">
        <h3 style="margin:0;">作業フロー一覧</h3>
        <button type="button" id="wfNewBtn" class="primary-btn wf-new-btn">
          <span class="icon icon-sm">add</span> 新規作成
        </button>
      </div>
    `;

    if (workflows.length === 0) {
      content.innerHTML += `
        <div class="wf-empty">
          <span class="icon" style="font-size:2rem;color:var(--text-sub)">account_tree</span>
          <p>ワークフローがまだありません。<br>「新規作成」で作業フローを登録しましょう。</p>
        </div>
      `;
    } else {
      const list = document.createElement('div');
      list.className = 'wf-list';
      workflows.forEach(wf => {
        const item = document.createElement('div');
        item.className = 'wf-list-item';
        const freqLabel = this._freqLabel(wf.freq);
        const tags = (wf.tags || []).map(t => `<span class="tag-chip">${t}</span>`).join('');
        item.innerHTML = `
          <div class="wf-list-item-info">
            <div class="wf-list-item-title">
              <span class="icon icon-sm" style="color:var(--primary)">account_tree</span>
              ${this._escape(wf.title)}
              <span class="wf-freq-badge">${freqLabel}</span>
            </div>
            ${wf.description ? `<div class="wf-list-item-desc">${this._escape(wf.description)}</div>` : ''}
            ${tags ? `<div class="wf-tags-row">${tags}</div>` : ''}
            <div class="wf-step-count">${wf.steps.length} ステップ</div>
          </div>
          <div class="wf-list-item-actions">
            <button type="button" class="action-btn wf-edit-btn" data-id="${wf.id}">
              <span class="icon icon-sm">edit</span> 編集
            </button>
            <button type="button" class="action-btn btn-delete wf-delete-btn" data-id="${wf.id}">
              <span class="icon icon-sm">delete</span>
            </button>
          </div>
        `;
        list.appendChild(item);
      });
      content.appendChild(list);
    }

    const closeBtn = document.createElement('div');
    closeBtn.style.cssText = 'display:flex;justify-content:flex-end;margin-top:16px;';
    closeBtn.innerHTML = '<button type="button" id="wfCloseBtn" class="secondary-btn">閉じる</button>';
    content.appendChild(closeBtn);

    // Events
    document.getElementById('wfNewBtn').addEventListener('click', () => this._renderEdit(null));
    document.getElementById('wfCloseBtn').addEventListener('click', () => this.dialog.close());
    content.querySelectorAll('.wf-edit-btn').forEach(btn => {
      btn.addEventListener('click', () => this._renderEdit(btn.dataset.id));
    });
    content.querySelectorAll('.wf-delete-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const wf = this.workflowManager.getWorkflow(portalId, btn.dataset.id);
        if (wf && confirm(`ワークフロー「${wf.title}」を削除しますか？`)) {
          this.workflowManager.deleteWorkflow(portalId, btn.dataset.id);
          this.renderCallback();
          this._renderList();
        }
      });
    });
  }

  /**
   * @private - ワークフロー編集パネルを描画します。
   * @param {string|null} workflowId - nullなら新規作成
   */
  _renderEdit(workflowId) {
    const portalId = this.configManager.getActivePortalId();
    let wf = workflowId ? this.workflowManager.getWorkflow(portalId, workflowId) : null;
    this.editingWorkflowId = workflowId;

    // 全リンクをセレクト用に収集
    const allLinks = this.dataManager.getData();
    const linkOptions = allLinks.map(l =>
      `<option value="${l.id}">${this._escape((l.tags && l.tags[0]) || 'タグなし')} / ${this._escape(l.title)}</option>`
    ).join('');

    const content = document.getElementById('workflowDialogContent');
    const title = wf ? wf.title : '';
    const description = wf ? wf.description : '';
    const tags = wf ? (wf.tags || []).join(', ') : '';
    const freq = wf ? wf.freq : 'rare';
    // 説明・タグは「既に何か入っている時だけ」開いておく。空なら畳んでおき、
    // タイトル・頻度の1行だけでステップ欄がすぐ始まるようにする。
    const metaExpanded = !!(description || tags);

    content.innerHTML = `
      <div class="wf-edit-header">
        <button type="button" id="wfBackBtn" class="secondary-btn" style="font-size:0.8rem; padding:4px 10px;">
          <span class="icon icon-sm">arrow_back</span> 一覧へ
        </button>
        <h3 style="margin:0;">${wf ? 'フロー編集' : '新規フロー作成'}</h3>
      </div>
      <div class="wf-edit-form">
        <label>タイトル <span style="color:var(--danger)">*</span>
          <input type="text" id="wfTitleInput" value="${this._escape(title)}" placeholder="例: 確定申告フロー" required>
        </label>
        <label>頻度
          <select id="wfFreqInput">
            <option value="daily" ${freq === 'daily' ? 'selected' : ''}>毎日</option>
            <option value="weekly" ${freq === 'weekly' ? 'selected' : ''}>週次</option>
            <option value="monthly" ${freq === 'monthly' ? 'selected' : ''}>月次</option>
            <option value="rare" ${freq === 'rare' ? 'selected' : ''}>たまに（思い出し対象）</option>
          </select>
        </label>
        <button type="button" id="wfMetaToggleBtn" class="wf-meta-toggle-btn">
          <span class="icon icon-xs">${metaExpanded ? 'expand_less' : 'expand_more'}</span> 説明・タグ（省略可）
        </button>
        <div id="wfMetaDetails" class="wf-meta-details${metaExpanded ? ' wf-meta-expanded' : ''}">
          <label class="full-row">説明
            <input type="text" id="wfDescInput" value="${this._escape(description)}" placeholder="例: 年1回の確定申告手順">
          </label>
          <label class="full-row">タグ <span style="font-size:0.75rem;color:var(--text-sub)">（カンマ区切り、新規は自由入力・既存タグは候補から選択可）</span>
            <div class="tag-input-wrap">
              <input type="text" id="wfTagsInput" value="${this._escape(tags)}" placeholder="例: 確定申告, 年次, 税務" autocomplete="off">
              <div id="wfTagsSuggest" class="tag-suggest-dropdown" style="display:none;"></div>
            </div>
          </label>
        </div>
      </div>

      <div class="wf-steps-section">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
          <h4 style="margin:0;">ステップ</h4>
          <button type="button" id="wfAddStepBtn" class="secondary-btn" style="font-size:0.8rem; padding:4px 10px;">
            <span class="icon icon-sm">add</span> ステップ追加
          </button>
        </div>
        <div id="wfStepsContainer"></div>
      </div>

      <div style="display:flex; justify-content:flex-end; gap:8px; margin-top:16px;">
        <button type="button" id="wfCancelEditBtn" class="secondary-btn">キャンセル</button>
        <button type="button" id="wfSaveBtn" class="primary-btn">
          <span class="icon icon-sm">save</span> 保存
        </button>
      </div>
    `;

    // ステップを描画
    const steps = wf ? JSON.parse(JSON.stringify(wf.steps)) : [];
    this._renderSteps(steps, linkOptions);
    // タグ候補はフォームを開いている間キー入力のたびに再計算しないよう、ここで1回だけ計算する。
    this._knownTagsCache = this._getKnownTags(portalId);
    this._initTagsSuggest();

    // Events
    document.getElementById('wfBackBtn').addEventListener('click', () => this._renderList());
    document.getElementById('wfCancelEditBtn').addEventListener('click', () => this._renderList());
    const metaToggleBtn = document.getElementById('wfMetaToggleBtn');
    metaToggleBtn.addEventListener('click', () => {
      const details = document.getElementById('wfMetaDetails');
      const expanded = details.classList.toggle('wf-meta-expanded');
      metaToggleBtn.querySelector('.icon').textContent = expanded ? 'expand_less' : 'expand_more';
    });
    document.getElementById('wfAddStepBtn').addEventListener('click', () => {
      steps.push({ step: steps.length + 1, title: '', memo: '', prompt: '', promptType: 'none', linkId: null });
      this._renderSteps(steps, linkOptions);
      this._focusStepTitle(steps.length - 1);
    });
    document.getElementById('wfSaveBtn').addEventListener('click', () => {
      this._saveWorkflow(portalId, wf, steps, linkOptions);
    });
  }

  /**
   * @private - 指定インデックスのステップのタイトル欄にスクロール＆フォーカスします。
   * ステップを次々追加していく作業を、クリックなしで続けられるようにするため。
   * @param {number} index
   */
  _focusStepTitle(index) {
    const rows = document.querySelectorAll('.wf-step-row');
    const row = rows[index];
    if (!row) return;
    const titleInput = row.querySelector('.wf-step-title');
    if (!titleInput) return;
    if (typeof row.scrollIntoView === 'function') {
      row.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
    titleInput.focus();
  }

  /**
   * 現在のポータルで「既に使われているタグ」＋「まだリンク0件の事前登録タグ」を
   * 合わせた候補一覧を返します（重複除去・ソート済み）。
   * @private
   * @param {string} portalId
   * @returns {string[]}
   */
  _getKnownTags(portalId) {
    if (!this.searchManager || !this.tagManager) return [];
    const used = this.searchManager.getAllTags();
    const registered = this.tagManager.getRegisteredTags(portalId);
    return Array.from(new Set([...used, ...registered])).sort((a, b) => a.localeCompare(b, 'ja'));
  }

  /**
   * ワークフローのタグ欄（カンマ区切り）に、リンク編集ダイアログと同じ
   * サジェストドロップダウンを設定します（js/tagSuggest.js の共通実装を使用）。
   * 候補一覧は _renderEdit() 時に this._knownTagsCache へキャッシュしたものを参照する。
   * @private
   */
  _initTagsSuggest() {
    initTagsSuggest({
      inputEl: document.getElementById('wfTagsInput'),
      boxEl: document.getElementById('wfTagsSuggest'),
      getKnownTags: () => this._knownTagsCache
    });
  }

  /**
   * ステップ配列の要素を from から to へ移動し、step番号（1始まり）を振り直します。
   * DOMに依存しない純粋関数なので、D&D・▲▼ボタンの双方から呼べてテストもしやすい。
   * @param {WorkflowStep[]} steps
   * @param {number} from
   * @param {number} to
   * @returns {boolean} 実際に移動したら true（範囲外・同一位置なら false）
   */
  static moveStep(steps, from, to) {
    if (
      !Array.isArray(steps) ||
      from === to ||
      from < 0 || from >= steps.length ||
      to < 0 || to >= steps.length
    ) {
      return false;
    }
    const [moved] = steps.splice(from, 1);
    steps.splice(to, 0, moved);
    steps.forEach((s, i) => { s.step = i + 1; });
    return true;
  }

  /**
   * @private - ステップリストを描画します。
   * 並べ替えはドラッグハンドル（D&D）と各行の▲▼ボタンの2系統で行えます。
   * 実際の並べ替えは WorkflowDialog.moveStep() に集約し、ここでは再描画するだけ。
   */
  _renderSteps(steps, linkOptions) {
    const container = document.getElementById('wfStepsContainer');
    container.innerHTML = '';

    if (steps.length === 0) {
      container.innerHTML = '<div style="color:var(--text-sub);font-size:0.85rem;padding:8px 0;">ステップがありません。</div>';
      return;
    }

    // D&D中の掴んでいる行インデックス。この描画呼び出しの間だけ有効。
    let dragSrcIdx = null;

    const reorder = (from, to, focusTitle = true) => {
      if (!WorkflowDialog.moveStep(steps, from, to)) return;
      this._renderSteps(steps, linkOptions);
      if (focusTitle) this._focusStepTitle(to);
    };

    steps.forEach((step, i) => {
      // プロンプトが既に入っているステップだけ詳細欄を自動展開する。
      // タイトル・メモ・リンクは常に1行に出しているので、展開対象はプロンプトだけ。
      const hasDetails = !!step.prompt;

      const row = document.createElement('div');
      row.className = 'wf-step-row' + (hasDetails ? ' wf-expanded' : '');
      row.innerHTML = `
        <div class="wf-step-header-row">
          <span class="icon icon-xs wf-step-drag-handle" title="ドラッグで並べ替え">drag_indicator</span>
          <div class="wf-step-num">Step ${i + 1}</div>
          <input type="text" class="wf-step-title" placeholder="ステップタイトル" value="${this._escape(step.title || '')}">
          <input type="text" class="wf-step-memo" placeholder="補足メモ（省略可）" value="${this._escape(step.memo || '')}">
          <select class="wf-step-link" title="関連リンク">
            <option value="">-- リンクなし --</option>
            ${linkOptions}
          </select>
          <span class="wf-step-move-btns">
            <button type="button" class="wf-step-move-btn wf-step-move-up" title="上へ移動" ${i === 0 ? 'disabled' : ''}>
              <span class="icon icon-xs">keyboard_arrow_up</span>
            </button>
            <button type="button" class="wf-step-move-btn wf-step-move-down" title="下へ移動" ${i === steps.length - 1 ? 'disabled' : ''}>
              <span class="icon icon-xs">keyboard_arrow_down</span>
            </button>
          </span>
          <button type="button" class="wf-step-expand-btn" title="プロンプト本文を表示/編集">
            <span class="icon icon-xs">${hasDetails ? 'expand_less' : 'expand_more'}</span>
          </button>
          <button type="button" class="action-btn btn-delete wf-step-del-btn" data-index="${i}" title="削除">
            <span class="icon icon-sm">delete</span>
          </button>
        </div>
        <div class="wf-step-details">
          <div class="wf-step-prompt-row">
            <select class="wf-step-prompt-type" title="本文の種類">
              <option value="none">－ なし</option>
              <option value="prompt">🤖 プロンプト</option>
              <option value="code">💻 コード</option>
              <option value="text">📝 テキスト</option>
            </select>
            <textarea class="wf-step-prompt" rows="2" placeholder="本文（省略可・出力時にコピーボタンが付きます）">${this._escape(step.prompt || '')}</textarea>
          </div>
        </div>
      `;
      // 選択済みリンクを復元
      const sel = row.querySelector('.wf-step-link');
      if (step.linkId) sel.value = step.linkId;
      const typeSel = row.querySelector('.wf-step-prompt-type');
      typeSel.value = step.promptType || 'prompt';

      const expandBtn = row.querySelector('.wf-step-expand-btn');
      expandBtn.addEventListener('click', () => {
        const expanded = row.classList.toggle('wf-expanded');
        expandBtn.querySelector('.icon').textContent = expanded ? 'expand_less' : 'expand_more';
      });

      // ── 並べ替え: ▲▼ボタン ──
      row.querySelector('.wf-step-move-up').addEventListener('click', () => reorder(i, i - 1));
      row.querySelector('.wf-step-move-down').addEventListener('click', () => reorder(i, i + 1));

      // ── 並べ替え: ドラッグハンドル ──
      // 行全体を draggable にすると入力欄のテキスト選択ができなくなるため、
      // ハンドルを mousedown した時だけ一時的に draggable を立てる。
      const handle = row.querySelector('.wf-step-drag-handle');
      handle.addEventListener('mousedown', () => { row.draggable = true; });
      row.addEventListener('dragstart', e => {
        dragSrcIdx = i;
        row.classList.add('wf-step-dragging');
        e.dataTransfer.effectAllowed = 'move';
      });
      row.addEventListener('dragend', () => {
        row.draggable = false;
        row.classList.remove('wf-step-dragging');
        container.querySelectorAll('.wf-step-drag-over').forEach(el => el.classList.remove('wf-step-drag-over'));
      });
      row.addEventListener('dragover', e => {
        if (dragSrcIdx === null) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        container.querySelectorAll('.wf-step-drag-over').forEach(el => el.classList.remove('wf-step-drag-over'));
        if (dragSrcIdx !== i) row.classList.add('wf-step-drag-over');
      });
      row.addEventListener('drop', e => {
        e.preventDefault();
        if (dragSrcIdx === null || dragSrcIdx === i) return;
        reorder(dragSrcIdx, i, false);
        dragSrcIdx = null;
      });

      // 入力変更を steps 配列に反映
      const titleInput = row.querySelector('.wf-step-title');
      titleInput.addEventListener('input', e => { steps[i].title = e.target.value; });
      // 一番下のステップでEnterを押すと、クリックなしで次のステップを追加して続けて入力できる
      // （ステップをたくさん追加したいときに、毎回「ステップ追加」ボタンを押しに行かなくて済むように）
      titleInput.addEventListener('keydown', e => {
        if (e.key !== 'Enter') return;
        e.preventDefault();
        if (i === steps.length - 1) {
          steps.push({ step: steps.length + 1, title: '', memo: '', prompt: '', promptType: 'none', linkId: null });
          this._renderSteps(steps, linkOptions);
          this._focusStepTitle(steps.length - 1);
        } else {
          this._focusStepTitle(i + 1);
        }
      });
      row.querySelector('.wf-step-memo').addEventListener('input', e => { steps[i].memo = e.target.value; });
      row.querySelector('.wf-step-prompt').addEventListener('input', e => { steps[i].prompt = e.target.value; });
      typeSel.addEventListener('change', e => { steps[i].promptType = e.target.value; });
      sel.addEventListener('change', e => { steps[i].linkId = e.target.value || null; });

      row.querySelector('.wf-step-del-btn').addEventListener('click', () => {
        steps.splice(i, 1);
        steps.forEach((s, idx) => { s.step = idx + 1; });
        this._renderSteps(steps, linkOptions);
      });

      container.appendChild(row);
    });
  }

  /**
   * @private - ワークフローを保存します。
   */
  _saveWorkflow(portalId, existingWf, steps, linkOptions) {
    const title = document.getElementById('wfTitleInput').value.trim();
    if (!title) {
      alert('タイトルを入力してください。');
      return;
    }
    const description = document.getElementById('wfDescInput').value.trim();
    const tagsRaw = document.getElementById('wfTagsInput').value;
    const tags = Array.from(new Set(tagsRaw.split(',').map(t => t.trim()).filter(Boolean)));
    const freq = document.getElementById('wfFreqInput').value;

    const workflowData = { title, description, tags, freq, steps: JSON.parse(JSON.stringify(steps)) };

    if (existingWf) {
      this.workflowManager.updateWorkflow(portalId, existingWf.id, workflowData);
    } else {
      this.workflowManager.addWorkflow(portalId, workflowData);
    }
    this.renderCallback();
    this._renderList();
  }

  /**
   * @private - HTML特殊文字をエスケープします（共通実装 util/html.js へ委譲）。
   */
  _escape(str) {
    return escapeHtml(str);
  }

  /**
   * @private - 頻度ラベルを返します。未知の値はそのまま返す（旧データ保険）。
   */
  _freqLabel(freq) {
    return freqLabel(freq) || freq || '';
  }
}
