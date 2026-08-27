/**
 * @file themeManager.js
 * @brief ライト/ダークテーマの切り替えとlocalStorageへの永続化を管理するクラス。
 * @module ThemeManager
 */

/**
 * @constant {string} STORAGE_KEY
 * @description テーマ設定をlocalStorageに保存するためのキー。
 */
const STORAGE_KEY = 'portalTheme';

/**
 * @class ThemeManager
 * @brief `<html>` 要素の `data-theme` 属性を切り替えることでテーマを管理します。
 *        初期テーマは index.html 内のインラインスクリプトで即時適用済みのため、
 *        ここではトグルボタンのイベント配線のみを行います。
 */
export class ThemeManager {
  /** @property {HTMLButtonElement|null} button */
  button = null;

  /**
   * ボタンにイベントを配線し、現在のテーマに合わせてアイコンを更新します。
   */
  init() {
    this.button = document.getElementById('themeToggleBtn');
    if (!this.button) return;
    this._updateIcon();
    this.button.addEventListener('click', () => this.toggle());
  }

  /**
   * 現在のテーマ名を返します。
   * @returns {'light'|'dark'}
   */
  getTheme() {
    return document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
  }

  /**
   * テーマをライト/ダークで切り替え、localStorageに保存します。
   */
  toggle() {
    const next = this.getTheme() === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch (e) {
      // localStorageが使えない環境でも表示切り替え自体は継続する
    }
    this._updateIcon();
  }

  /**
   * @private - トグルボタンのアイコンを現在のテーマに合わせます。
   */
  _updateIcon() {
    if (!this.button) return;
    const icon = this.button.querySelector('.icon');
    if (icon) {
      icon.textContent = this.getTheme() === 'dark' ? 'light_mode' : 'dark_mode';
    }
    this.button.title = this.getTheme() === 'dark' ? 'ライトモードに切り替え' : 'ダークモードに切り替え';
  }
}
