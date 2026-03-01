/**
 * @file bulkLinkDialog.js
 * @brief 複数リンクの一括追加ダイアログを管理するクラス。
 * @module BulkLinkDialog
 */

import { IconPickerDialog } from './iconPickerDialog.js';

/**
 * @class BulkLinkDialog
 * @brief 複数のリンクを一括で追加するためのモーダルダイアログを制御します。
 *        IconPickerDialog と連携してアイコン選択機能を提供します。
 */
export class BulkLinkDialog {
  dataManager;
  renderCallback;
  iconPickerDialog;
  dialog;

  constructor(dataManager, renderCallback, iconPickerDialog) {
    this.dataManager = dataManager;
    this.renderCallback = renderCallback;
    this.iconPickerDialog = iconPickerDialog;
  }

  init() {
    this.dialog = document.getElementById('bulkLinkDialog');
    this.initEventListeners();
  }

  initEventListeners() {
    this.dialog.addEventListener('close', () => {
      if (this.dialog.returnValue === 'save') {
        const categoryId = document.getElementById('bulkLinkCategorySelect').value;
        if (!categoryId) {
          alert('カテゴリを選択してください。');
          return;
        }

        const links = [];
        const rows = document.querySelectorAll('#bulk-link-input-area .bulk-link-row');

        rows.forEach(row => {
          const title = row.querySelector('.input-title').value.trim();
          const url = row.querySelector('.input-url').value.trim();

          if (title && url) {
            links.push({
              title,
              url,
              icon: row.querySelector('.input-icon').value.trim() || 'link',
              badge: row.querySelector('.input-badge').value,
              memo: row.querySelector('.input-memo').value.trim()
            });
          }
        });

        if (links.length > 0) {
          this.dataManager.addBulkLinks(categoryId, links);
          this.renderCallback();
          alert(`${links.length}件のリンクを追加しました。`);
        } else {
          alert('有効なリンクデータが見つかりませんでした。タイトルとURLは必須です。');
        }
      }
    });
  }

  /**
   * アイコン値が Material Symbol 名かどうかを判定します。
   * @private
   */
  _isMaterialSymbol(value) {
    return value && /^[a-z][a-z_0-9]*$/.test(value);
  }

  /**
   * アイコンプレビュー span を更新します。
   * @private
   * @param {HTMLElement} previewSpan
   * @param {string} iconValue
   */
  _updatePreview(previewSpan, iconValue) {
    if (this._isMaterialSymbol(iconValue)) {
      previewSpan.className = 'icon icon-md';
      previewSpan.style.fontSize = '';
      previewSpan.textContent = iconValue;
    } else {
      previewSpan.className = '';
      previewSpan.style.fontSize = '1.2rem';
      previewSpan.textContent = iconValue || '?';
    }
  }

  /**
   * 一括リンク追加ダイアログの行要素を作成します。
   * @private
   * @param {object} [link={}] - リンクデータオブジェクト。
   * @returns {HTMLDivElement} 作成された行のDOM要素。
   */
  _createRow(link = {}) {
    const initialIcon = link.icon || 'link';

    const row = document.createElement('div');
    row.className = 'bulk-link-row';
    row.innerHTML = `
      <input type="text" class="input-title" placeholder="タイトル" value="${link.title || ''}">
      <input type="url" class="input-url" placeholder="URL" value="${link.url || ''}">
      <div class="bulk-icon-cell">
        <div class="bulk-icon-preview-wrap">
          <span class="icon icon-md bulk-icon-preview">${initialIcon}</span>
        </div>
        <input type="hidden" class="input-icon" value="${initialIcon}">
        <button type="button" class="bulk-icon-picker-btn secondary-btn" title="アイコンを選択">選択</button>
      </div>
      <select class="input-badge">
        <option value="doc"     ${link.badge === 'doc'     ? 'selected' : ''}>Docs</option>
        <option value="video"   ${link.badge === 'video'   ? 'selected' : ''}>Video</option>
        <option value="article" ${link.badge === 'article' ? 'selected' : ''}>Article</option>
        <option value="portal"  ${link.badge === 'portal'  ? 'selected' : ''}>Portal</option>
        <option value="code"    ${link.badge === 'code'    ? 'selected' : ''}>Code</option>
        <option value="tool"    ${link.badge === 'tool'    ? 'selected' : ''}>Tool</option>
        <option value="sns"     ${link.badge === 'sns'     ? 'selected' : ''}>SNS</option>
        <option value="cloud"   ${link.badge === 'cloud'   ? 'selected' : ''}>Cloud</option>
        <option value="local"   ${link.badge === 'local'   ? 'selected' : ''}>Local</option>
        <option value="money"   ${link.badge === 'money'   ? 'selected' : ''}>Money</option>
        <option value="news"    ${link.badge === 'news'    ? 'selected' : ''}>News</option>
        <option value="idea"    ${link.badge === 'idea'    ? 'selected' : ''}>Idea</option>
        <option value="company" ${link.badge === 'company' ? 'selected' : ''}>Company</option>
      </select>
      <input type="text" class="input-memo" placeholder="メモ" value="${link.memo || ''}">
    `;

    const iconInput = row.querySelector('.input-icon');
    const previewSpan = row.querySelector('.bulk-icon-preview');
    const selectBtn = row.querySelector('.bulk-icon-picker-btn');

    // 初期値を正しくレンダリング
    this._updatePreview(previewSpan, initialIcon);

    selectBtn.addEventListener('click', () => {
      this.iconPickerDialog.open((selectedIcon) => {
        iconInput.value = selectedIcon;
        this._updatePreview(previewSpan, selectedIcon);
      });
    });

    return row;
  }

  open() {
    const select = document.getElementById('bulkLinkCategorySelect');
    select.innerHTML = '';
    const categories = this.dataManager.getData();

    if (categories.length === 0) {
      alert('先に追加先のカテゴリを作成してください。');
      return;
    }

    categories.forEach(cat => {
      const option = document.createElement('option');
      option.value = cat.id;
      option.textContent = cat.title;
      select.appendChild(option);
    });

    const inputArea = document.getElementById('bulk-link-input-area');
    inputArea.innerHTML = '';

    inputArea.appendChild(this._createRow({
      title: 'Example Link',
      url: 'https://example.com/',
      icon: 'lightbulb',
      badge: 'doc',
      memo: 'これはサンプルです'
    }));

    for (let i = 0; i < 5; i++) {
      inputArea.appendChild(this._createRow());
    }

    this.dialog.showModal();
  }
}
