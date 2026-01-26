/**
 * @file linkDialog.js
 * @brief リンクの追加・編集ダイアログを管理するクラス。
 * @module LinkDialog
 */

import { IconPickerDialog } from './iconPickerDialog.js';

/**
 * @class LinkDialog
 * @brief リンクの追加または編集を行うためのモーダルダイアログを制御します。
 *        IconPickerDialog と連携してアイコン選択機能を提供します。
 */
export class LinkDialog {
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
   * @property {HTMLDialogElement} dialog - リンクダイアログのDOM要素。
   */
  dialog;
  /**
   * @property {HTMLFormElement} form - ダイアログ内のフォーム要素。
   */
  form;
  /**
   * @property {HTMLInputElement} linkIconInput - アイコン入力フィールドのDOM要素。
   */
  linkIconInput;
  /**
   * @property {HTMLButtonElement} openIconPickerBtn - アイコンピッカーを開くボタンのDOM要素。
   */
  openIconPickerBtn;
  /**
   * @property {string|null} editingCategoryId - 現在編集中のリンクが属するカテゴリのID。
   */
  editingCategoryId = null;
  /**
   * @property {string|null} editingLinkId - 現在編集中のリンクのID。新規作成の場合は `null`。
   */
  editingLinkId = null;

  /**
   * LinkDialogの新しいインスタンスを作成します。
   * @param {DataManager} dataManager - データ管理オブジェクト。
   * @param {function(): void} renderCallback - リンク保存後にUIの再描画を行うコールバック関数。
   * @param {IconPickerDialog} iconPickerDialog - アイコン選択ダイアログのインスタンス。
   */
  constructor(dataManager, renderCallback, iconPickerDialog) {
    this.dataManager = dataManager;
    this.renderCallback = renderCallback;
    this.iconPickerDialog = iconPickerDialog;
    this.dialog = document.getElementById('linkDialog');
    this.form = this.dialog.querySelector('form');
    this.linkIconInput = document.getElementById('linkIconInput');
    this.openIconPickerBtn = document.getElementById('openLinkIconPickerBtn');
    this.editingCategoryId = null;
    this.editingLinkId = null;

    this.initEventListeners();
  }

  /**
   * ダイアログのイベントリスナーを初期化します。
   */
  initEventListeners() {
    this.dialog.addEventListener('close', () => {
      // ダイアログが 'save' の値で閉じられた場合のみ保存処理を実行
      if (this.dialog.returnValue === 'save') {
        const linkData = {
          title: this.form.linkTitleInput.value,
          url: this.form.linkUrlInput.value,
          icon: this.linkIconInput.value || '🔗',
          badge: this.form.linkBadgeInput.value,
          memo: this.form.linkMemoInput.value
        };

        if (this.editingCategoryId && this.editingLinkId) {
          this.dataManager.updateLink(this.editingCategoryId, this.editingLinkId, linkData);
        } else if (this.editingCategoryId) {
          this.dataManager.addLink(this.editingCategoryId, linkData);
        }
        this.renderCallback(); // UIの再描画をトリガー
      }
      this.editingCategoryId = null; // 編集中のIDをリセット
      this.editingLinkId = null;
    });

    // アイコンピッカーを開くボタンのイベントリスナー
    this.openIconPickerBtn.addEventListener('click', () => {
      this.iconPickerDialog.open((selectedIcon) => {
        this.linkIconInput.value = selectedIcon; // 選択されたアイコンをinputフィールドに設定
      });
    });
  }

  /**
   * リンク編集ダイアログを開きます。
   * @param {string} categoryId - リンクが属するカテゴリのID。
   * @param {string|null} [linkId=null] - 編集するリンクのID。新規作成の場合は `null`。
   */
  open(categoryId, linkId = null) {
    this.editingCategoryId = categoryId;
    this.editingLinkId = linkId;
    
    if (linkId) {
      // 既存リンクの編集の場合、現在のデータをフォームにセット
      const link = this.dataManager.getLink(categoryId, linkId);
      this.form.linkTitleInput.value = link.title;
      this.form.linkUrlInput.value = link.url;
      this.form.linkIconInput.value = link.icon; // this.linkIconInput を使用
      this.form.linkBadgeInput.value = link.badge;
      this.form.linkMemoInput.value = link.memo;
    } else {
      // 新規リンク作成の場合、フォームをリセットしデフォルト値を設定
      this.form.reset();
      this.form.linkIconInput.value = '🔗';
      this.form.linkBadgeInput.value = 'doc';
    }
    this.dialog.showModal(); // ダイアログを表示
  }
}