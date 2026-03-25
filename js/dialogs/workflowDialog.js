/**
 * @file workflowDialog.js
 * @brief ワークフローの閲覧・作成・編集・削除を行うダイアログクラス。
 * @module WorkflowDialog
 */

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
  /** @property {HTMLDialogElement} dialog */
  dialog;
  /** @property {string|null} editingWorkflowId - 編集中のワークフローID */
  editingWorkflowId = null;

  /**
   * @param {WorkflowManager} workflowManager
   * @param {DataManager} dataManager
   * @param {ConfigManager} configManager
   * @param {function} renderCallback
   */
  constructor(workflowManager, dataManager, configManager, renderCallback) {
    this.workflowManager = workflowManager;
    this.dataManager = dataManager;
    this.configManager = configManager;
    this.renderCallback = renderCallback;
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
    const allLinks = [];
    this.dataManager.getData().forEach(cat => {
      cat.links.forEach(link => {
        allLinks.push({ id: link.id, title: link.title, catTitle: cat.title });
      });
    });
    const linkOptions = allLinks.map(l =>
      `<option value="${l.id}">${this._escape(l.catTitle)} / ${this._escape(l.title)}</option>`
    ).join('');

    const content = document.getElementById('workflowDialogContent');
    const title = wf ? wf.title : '';
    const description = wf ? wf.description : '';
    const tags = wf ? (wf.tags || []).join(', ') : '';
    const freq = wf ? wf.freq : 'rare';

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
        <label>説明
          <input type="text" id="wfDescInput" value="${this._escape(description)}" placeholder="例: 年1回の確定申告手順">
        </label>
        <label>タグ <span style="font-size:0.75rem;color:var(--text-sub)">（カンマ区切り）</span>
          <input type="text" id="wfTagsInput" value="${this._escape(tags)}" placeholder="例: 確定申告, 年次, 税務">
        </label>
        <label>頻度
          <select id="wfFreqInput">
            <option value="daily" ${freq === 'daily' ? 'selected' : ''}>毎日</option>
            <option value="weekly" ${freq === 'weekly' ? 'selected' : ''}>週次</option>
            <option value="monthly" ${freq === 'monthly' ? 'selected' : ''}>月次</option>
            <option value="rare" ${freq === 'rare' ? 'selected' : ''}>たまに（思い出し対象）</option>
          </select>
        </label>
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

    // Events
    document.getElementById('wfBackBtn').addEventListener('click', () => this._renderList());
    document.getElementById('wfCancelEditBtn').addEventListener('click', () => this._renderList());
    document.getElementById('wfAddStepBtn').addEventListener('click', () => {
      steps.push({ step: steps.length + 1, title: '', memo: '', linkId: null });
      this._renderSteps(steps, linkOptions);
    });
    document.getElementById('wfSaveBtn').addEventListener('click', () => {
      this._saveWorkflow(portalId, wf, steps, linkOptions);
    });
  }

  /**
   * @private - ステップリストを描画します。
   */
  _renderSteps(steps, linkOptions) {
    const container = document.getElementById('wfStepsContainer');
    container.innerHTML = '';

    if (steps.length === 0) {
      container.innerHTML = '<div style="color:var(--text-sub);font-size:0.85rem;padding:8px 0;">ステップがありません。</div>';
      return;
    }

    steps.forEach((step, i) => {
      const row = document.createElement('div');
      row.className = 'wf-step-row';
      row.innerHTML = `
        <div class="wf-step-num">Step ${i + 1}</div>
        <div class="wf-step-fields">
          <input type="text" class="wf-step-title" placeholder="ステップタイトル" value="${this._escape(step.title || '')}">
          <input type="text" class="wf-step-memo" placeholder="補足メモ（省略可）" value="${this._escape(step.memo || '')}">
          <select class="wf-step-link">
            <option value="">-- リンクなし --</option>
            ${linkOptions}
          </select>
        </div>
        <button type="button" class="action-btn btn-delete wf-step-del-btn" data-index="${i}" title="削除">
          <span class="icon icon-sm">delete</span>
        </button>
      `;
      // 選択済みリンクを復元
      const sel = row.querySelector('.wf-step-link');
      if (step.linkId) sel.value = step.linkId;

      // 入力変更を steps 配列に反映
      row.querySelector('.wf-step-title').addEventListener('input', e => { steps[i].title = e.target.value; });
      row.querySelector('.wf-step-memo').addEventListener('input', e => { steps[i].memo = e.target.value; });
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
    const tags = tagsRaw.split(',').map(t => t.trim()).filter(Boolean);
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
   * @private - HTML特殊文字をエスケープします。
   */
  _escape(str) {
    return String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  /**
   * @private - 頻度ラベルを返します。
   */
  _freqLabel(freq) {
    const map = { daily: '毎日', weekly: '週次', monthly: '月次', rare: 'たまに' };
    return map[freq] || freq || '';
  }
}
