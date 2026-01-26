/**
 * @file iconPickerDialog.js
 * @brief アイコン選択ダイアログを管理するクラス。
 * @module IconPickerDialog
 */

import { iconList } from '../iconList.js';

/**
 * @class IconPickerDialog
 * @brief ユーザーが絵文字アイコンを検索・選択するためのモーダルダイアログを制御します。
 */
export class IconPickerDialog {
  /**
   * @property {HTMLDialogElement} dialog - アイコンピッカーダイアログのDOM要素。
   */
  dialog;
  /**
   * @property {HTMLElement} iconGrid - アイコンが表示されるグリッドコンテナのDOM要素。
   */
  iconGrid;
  /**
   * @property {HTMLInputElement} searchInput - アイコン検索入力フィールドのDOM要素。
   */
  searchInput;
  /**
   * @property {Array<string>} icons - 表示するすべてのアイコンのリスト。
   */
  icons = iconList;
  /**
   * @property {function(string): void|null} currentSelectCallback - 現在開いているセッションでアイコンが選択されたときに呼び出されるコールバック関数。
   */
  currentSelectCallback = null;

  /**
   * IconPickerDialogの新しいインスタンスを作成します。
   */
  constructor() {
    this.dialog = document.getElementById('iconPickerDialog');
    this.iconGrid = document.getElementById('iconGrid');
    this.searchInput = document.getElementById('iconSearchInput');

    this.initEventListeners();
  }

  /**
   * ダイアログのイベントリスナーを初期化します。
   */
  initEventListeners() {
    // 閉じるボタンのイベントリスナー
    document.getElementById('closeIconPickerDialogBtn').addEventListener('click', () => {
      this.dialog.close();
      this.currentSelectCallback = null; // コールバックをクリア
    });

    // 検索入力フィールドのイベントリスナー
    this.searchInput.addEventListener('input', () => this.filterIcons());

    // アイコングリッド内のアイコン選択イベントリスナー（イベント委譲）
    this.iconGrid.addEventListener('click', (e) => {
      const targetButton = e.target.closest('button');
      if (targetButton && targetButton.dataset.icon && this.currentSelectCallback) {
        this.currentSelectCallback(targetButton.dataset.icon); // 選択されたアイコンをコールバックで返す
        this.dialog.close(); // ダイアログを閉じる
        this.currentSelectCallback = null; // コールバックをクリア
      }
    });
  }

  /**
   * 検索クエリに基づいてアイコンをフィルタリングし、グリッドを再描画します。
   * @private
   */
  filterIcons() {
    const searchTerm = this.searchInput.value.toLowerCase();
    const filteredIcons = this.icons.filter(icon => {
      // 絵文字自体または（将来的に）Unicode名/メタデータで検索
      return icon.toLowerCase().includes(searchTerm) || this.getIconName(icon).toLowerCase().includes(searchTerm);
    });
    this.renderIcons(filteredIcons);
  }

  /**
   * アイコンのUnicode名または関連するメタデータを返します。
   * 現時点では絵文字自体を返しますが、将来的にiconListにメタデータを追加することで改善可能です。
   * @param {string} icon - 絵文字アイコン文字列。
   * @returns {string} アイコンの検索可能な名前。
   */
  getIconName(icon) {
    // TODO: iconListにUnicode名や意味を追加して検索性を高める
    // 現状では絵文字自体での検索か、絵文字のUnicode名での検索のみ
    // 例: "🌍" -> "globe showing Europe-Africa"
    return icon;
  }

  /**
   * 指定されたアイコンのリストをグリッドに描画します。
   * @private
   * @param {Array<string>} iconsToRender - 描画するアイコンの文字列配列。
   */
  renderIcons(iconsToRender) {
    this.iconGrid.innerHTML = ''; // グリッドをクリア
    iconsToRender.forEach(icon => {
      const button = document.createElement('button');
      button.textContent = icon;
      button.dataset.icon = icon; // data-icon属性に絵文字を保存
      this.iconGrid.appendChild(button);
    });
  }

  /**
   * アイコン選択ダイアログを開きます。
   * @param {function(string): void} callback - アイコンが選択されたときに呼び出されるコールバック関数。選択されたアイコン文字列を引数に取ります。
   */
  open(callback) {
    this.currentSelectCallback = callback; // 渡されたコールバックを保存
    this.searchInput.value = ''; // 検索入力をクリア
    this.renderIcons(this.icons); // すべてのアイコンを描画
    this.dialog.showModal(); // ダイアログを表示
  }
}