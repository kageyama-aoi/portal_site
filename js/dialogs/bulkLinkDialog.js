/**
 * @file bulkLinkDialog.js
 * @brief 複数リンクの一括追加ダイアログを管理するクラス。
 * @module BulkLinkDialog
 */

import { IconPickerDialog } from './iconPickerDialog.js';
import { detectBadge } from '../badgeDetector.js';

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
        const tagsRaw = document.getElementById('bulkLinkTagsInput').value;
        const tags = Array.from(new Set(tagsRaw.split(',').map(t => t.trim()).filter(Boolean)));

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
              memo: row.querySelector('.input-memo').value.trim(),
              tags: [...tags]
            });
          }
        });

        if (links.length > 0) {
          this.dataManager.addBulkLinks(links);
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
        <option value="doc"     ${link.badge === 'doc'     ? 'selected' : ''}>Docs（ドキュメント）</option>
        <option value="spreadsheet" ${link.badge === 'spreadsheet' ? 'selected' : ''}>Sheet（表計算）</option>
        <option value="website" ${link.badge === 'website' ? 'selected' : ''}>Web（ウェブサイト）</option>
        <option value="drive"   ${link.badge === 'drive'   ? 'selected' : ''}>Drive（Googleドライブ）</option>
        <option value="video"   ${link.badge === 'video'   ? 'selected' : ''}>Video（動画）</option>
        <option value="article" ${link.badge === 'article' ? 'selected' : ''}>Article（記事）</option>
        <option value="portal"  ${link.badge === 'portal'  ? 'selected' : ''}>Portal（ポータル）</option>
        <option value="code"    ${link.badge === 'code'    ? 'selected' : ''}>Code（コード）</option>
        <option value="tool"    ${link.badge === 'tool'    ? 'selected' : ''}>Tool（ツール）</option>
        <option value="sns"     ${link.badge === 'sns'     ? 'selected' : ''}>SNS</option>
        <option value="cloud"   ${link.badge === 'cloud'   ? 'selected' : ''}>Cloud（クラウド）</option>
        <option value="local"   ${link.badge === 'local'   ? 'selected' : ''}>Local（ローカル）</option>
        <option value="money"   ${link.badge === 'money'   ? 'selected' : ''}>Money（お金）</option>
        <option value="news"    ${link.badge === 'news'    ? 'selected' : ''}>News（ニュース）</option>
        <option value="idea"    ${link.badge === 'idea'    ? 'selected' : ''}>Idea（アイデア）</option>
        <option value="company" ${link.badge === 'company' ? 'selected' : ''}>Company（会社）</option>
      </select>
      <input type="text" class="input-memo" placeholder="メモ" value="${link.memo || ''}">
    `;

    const iconInput = row.querySelector('.input-icon');
    const previewSpan = row.querySelector('.bulk-icon-preview');
    const selectBtn = row.querySelector('.bulk-icon-picker-btn');
    const urlInput = row.querySelector('.input-url');
    const badgeSelect = row.querySelector('.input-badge');

    // 初期値を正しくレンダリング
    this._updatePreview(previewSpan, initialIcon);

    selectBtn.addEventListener('click', () => {
      this.iconPickerDialog.open((selectedIcon) => {
        iconInput.value = selectedIcon;
        this._updatePreview(previewSpan, selectedIcon);
      });
    });

    // URLからバッジ種別を自動判定（ユーザーが手動でバッジを選び直したら以降は上書きしない）
    let badgeManuallySet = false;
    badgeSelect.addEventListener('change', () => {
      badgeManuallySet = true;
    });
    urlInput.addEventListener('input', () => {
      if (badgeManuallySet) return;
      const detected = detectBadge(urlInput.value);
      if (detected) badgeSelect.value = detected;
    });

    return row;
  }

  open() {
    document.getElementById('bulkLinkTagsInput').value = '';

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
