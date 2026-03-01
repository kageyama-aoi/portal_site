/**
 * @file categoryDialog.js
 * @brief カテゴリの追加・編集ダイアログを管理するクラス。
 * @module CategoryDialog
 */

/**
 * @class CategoryDialog
 * @brief カテゴリの追加または編集を行うためのモーダルダイアログを制御します。
 */
export class CategoryDialog {
  /**
   * @property {DataManager} dataManager - データ操作を管理するDataManagerのインスタンス。
   */
  dataManager;
  /**
   * @property {HTMLDialogElement} dialog - カテゴリダイアログのDOM要素。
   */
  dialog;
  /**
   * @property {HTMLFormElement} form - ダイアログ内のフォーム要素。
   */
  form;
  /**
   * @property {HTMLInputElement} titleInput - カテゴリタイトル入力フィールドのDOM要素。
   */
  titleInput;
  /**
   * @property {string|null} editingCategoryId - 現在編集中のカテゴリのID。新規作成の場合は `null`。
   */
  editingCategoryId = null;
  /**
   * @property {function(): void} onCloseCallback - ダイアログが閉じた後に実行されるコールバック関数。通常、UIの再描画に使用されます。
   */
  onCloseCallback = () => {};

  /**
   * CategoryDialogの新しいインスタンスを作成します。
   * @param {DataManager} dataManager - データ管理オブジェクト。
   */
  constructor(dataManager) {
    this.dataManager = dataManager;
  }

  /**
   * ダイアログの初期化とイベントリスナーの設定を行います。
   * @param {function(): void} onCloseCallback - ダイアログが閉じた後に呼び出されるコールバック。
   */
  init(onCloseCallback) {
    this.onCloseCallback = onCloseCallback;
    this.dialog = document.getElementById('categoryDialog');
    this.form = this.dialog.querySelector('form');
    this.titleInput = document.getElementById('catTitleInput');
    this.form.addEventListener('submit', (e) => {
      e.preventDefault(); // フォームのデフォルト送信を防ぐ
      this._handleSave();
      this.dialog.close(); // 保存後にダイアログを閉じる
    });
    this.dialog.addEventListener('close', () => this._handleClose());
  }

  /**
   * カテゴリ編集ダイアログを開きます。
   * @param {string|null} [categoryId=null] - 編集するカテゴリのID。新規作成の場合は `null`。
   */
  open(categoryId = null) {
    this.editingCategoryId = categoryId;
    if (categoryId) {
      const cat = this.dataManager.getCategory(categoryId);
      this.titleInput.value = cat.title;
    } else {
      this.titleInput.value = ''; // 新規作成時は入力欄をクリア
    }
    this.dialog.showModal(); // ダイアログを表示
  }

  /**
   * フォームの入力内容を保存します（カテゴリの追加または更新）。
   * @private
   */
  _handleSave() {
    const title = this.titleInput.value.trim();
    if (!title) return; // タイトルが空の場合は何もしない

    if (this.editingCategoryId) {
      this.dataManager.updateCategory(this.editingCategoryId, title); // 既存カテゴリの更新
    } else {
      this.dataManager.addCategory(title); // 新規カテゴリの追加
    }
  }
  
  /**
   * ダイアログが閉じられたときの処理を行います。
   * フォームのリセットとコールバックの実行が含まれます。
   * @private
   */
  _handleClose() {
    this.form.reset(); // フォームをリセット
    this.editingCategoryId = null; // 編集中のカテゴリIDをクリア
    this.onCloseCallback(); // 登録されたコールバックを実行（UIの再描画など）
  }
}