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
  /**
   * @property {DataManager} dataManager - データ操作を管理するDataManagerのインスタンス。
   */
  dataManager;
  /**
   * @property {function(): void} renderCallback - リンク保存後にUIの再描画をトリガーするためのコールバック関数。
   */
  renderCallback;
  /**
   * @property {IconPickerDialog} iconPickerDialog - アイコン選択ダイアログのインスタンス。
   */
  iconPickerDialog;
  /**
   * @property {HTMLDialogElement} dialog - 一括リンク追加ダイアログのDOM要素。
   */
  dialog;

  /**
   * BulkLinkDialogの新しいインスタンスを作成します。
   * @param {DataManager} dataManager - データ管理オブジェクト。
   * @param {function(): void} renderCallback - リンク保存後にUIの再描画を行うコールバック関数。
   * @param {IconPickerDialog} iconPickerDialog - アイコン選択ダイアログのインスタンス。
   */
  constructor(dataManager, renderCallback, iconPickerDialog) {
    this.dataManager = dataManager;
    this.renderCallback = renderCallback;
    this.iconPickerDialog = iconPickerDialog;
    this.dialog = document.getElementById('bulkLinkDialog');
    this.initEventListeners();
  }

  /**
   * ダイアログのイベントリスナーを初期化します。
   */
  initEventListeners() {
    this.dialog.addEventListener('close', () => {
      // ダイアログが 'save' の値で閉じられた場合のみ保存処理を実行
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
              icon: row.querySelector('.input-icon').value.trim() || '🔗',
              badge: row.querySelector('.input-badge').value,
              memo: row.querySelector('.input-memo').value.trim()
            });
          }
        });

        if (links.length > 0) {
          this.dataManager.addBulkLinks(categoryId, links);
          this.renderCallback(); // UIの再描画をトリガー
          alert(`${links.length}件のリンクを追加しました。`);
        } else {
          alert('有効なリンクデータが見つかりませんでした。タイトルとURLは必須です。');
        }
      }
    });
  }

  /**
   * リンク一括追加ダイアログの行要素を作成します。
   * @private
   * @param {object} [link={}] - リンクデータオブジェクト。初期値の設定に使用されます。
   * @returns {HTMLDivElement} 作成された行のDOM要素。
   */
  _createRow(link = {}) {
    const row = document.createElement('div');
    row.className = 'bulk-link-row';
    row.innerHTML = `
      <input type="text" class="input-title" placeholder="タイトル" value="${link.title || ''}">
      <input type="url" class="input-url" placeholder="URL" value="${link.url || ''}">
      <div style="display:flex; gap: 4px; align-items: center;">
        <input type="text" class="input-icon" placeholder="Icon" value="${link.icon || ''}" readonly style="flex-shrink: 0; width: 50px; text-align: center;">
        <button type="button" class="bulk-icon-picker-btn secondary-btn" style="flex-grow: 1;">選択</button>
      </div>
      <select class="input-badge">
        <option value="doc" ${link.badge === 'doc' ? 'selected' : ''}>Docs</option>
        <option value="video" ${link.badge === 'video' ? 'selected' : ''}>Video</option>
        <option value="article" ${link.badge === 'article' ? 'selected' : ''}>Article</option>
        <option value="portal" ${link.badge === 'portal' ? 'selected' : ''}>Portal</option>
        <option value="code" ${link.badge === 'code' ? 'selected' : ''}>Code</option>
        <option value="tool" ${link.badge === 'tool' ? 'selected' : ''}>Tool</option>
        <option value="sns" ${link.badge === 'sns' ? 'selected' : ''}>SNS</option>
        <option value="cloud" ${link.badge === 'cloud' ? 'selected' : ''}>Cloud</option>
        <option value="local" ${link.badge === 'local' ? 'selected' : ''}>Local</option>
        <option value="money" ${link.badge === 'money' ? 'selected' : ''}>Money</option>
        <option value="news" ${link.badge === 'news' ? 'selected' : ''}>News</option>
        <option value="idea" ${link.badge === 'idea' ? 'selected' : ''}>Idea</option>
        <option value="company" ${link.badge === 'company' ? 'selected' : ''}>Company</option>
      </select>
      <input type="text" class="input-memo" placeholder="メモ" value="${link.memo || ''}">
    `;
    // Add event listener to the new button
    const iconInput = row.querySelector('.input-icon');
    const selectBtn = row.querySelector('.bulk-icon-picker-btn');
    selectBtn.addEventListener('click', () => {
      this.iconPickerDialog.open((selectedIcon) => {
        iconInput.value = selectedIcon;
      });
    });
    return row;
  }

  /**
   * 一括リンク追加ダイアログを開きます。
   */
  open() {
    const select = document.getElementById('bulkLinkCategorySelect');
    select.innerHTML = ''; // プルダウンをクリア
    const categories = this.dataManager.getData(); // カテゴリデータを取得

    if (categories.length === 0) {
      alert('先に追加先のカテゴリを作成してください。'); // カテゴリがない場合は警告
      return;
    }

    // カテゴリ選択プルダウンを生成
    categories.forEach(cat => {
      const option = document.createElement('option');
      option.value = cat.id;
      option.textContent = cat.title;
      select.appendChild(option);
    });

    const inputArea = document.getElementById('bulk-link-input-area');
    inputArea.innerHTML = ''; // 入力エリアをクリア
    
    // 1行目はサンプルデータ入りで生成
    inputArea.appendChild(this._createRow({
      title: 'Example Link',
      url: 'https://example.com/',
      icon: '💡',
      badge: 'doc',
      memo: 'これはサンプルです'
    }));

    // 残りの5行は空で生成
    for (let i = 0; i < 5; i++) {
      inputArea.appendChild(this._createRow());
    }

    this.dialog.showModal(); // ダイアログを表示
  }
}