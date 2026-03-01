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
  dataManager;
  renderCallback;
  iconPickerDialog;
  dialog;
  form;
  /** @property {HTMLInputElement} linkIconInput - アイコン名を保持する hidden input。 */
  linkIconInput;
  /** @property {HTMLElement} linkIconDisplay - アイコンを視覚表示する span 要素。 */
  linkIconDisplay;
  openIconPickerBtn;
  editingCategoryId = null;
  editingLinkId = null;

  constructor(dataManager, renderCallback, iconPickerDialog) {
    this.dataManager = dataManager;
    this.renderCallback = renderCallback;
    this.iconPickerDialog = iconPickerDialog;
    this.editingCategoryId = null;
    this.editingLinkId = null;
  }

  init() {
    this.dialog = document.getElementById('linkDialog');
    this.form = this.dialog.querySelector('form');
    this.linkIconInput = document.getElementById('linkIconInput');
    this.linkIconDisplay = document.getElementById('linkIconDisplay');
    this.openIconPickerBtn = document.getElementById('openLinkIconPickerBtn');
    this.initEventListeners();
  }

  initEventListeners() {
    this.dialog.addEventListener('close', () => {
      if (this.dialog.returnValue === 'save') {
        const linkData = {
          title: this.form.linkTitleInput.value,
          url: this.form.linkUrlInput.value,
          icon: this.linkIconInput.value || 'link',
          badge: this.form.linkBadgeInput.value,
          memo: this.form.linkMemoInput.value
        };

        if (this.editingCategoryId && this.editingLinkId) {
          this.dataManager.updateLink(this.editingCategoryId, this.editingLinkId, linkData);
        } else if (this.editingCategoryId) {
          this.dataManager.addLink(this.editingCategoryId, linkData);
        }
        this.renderCallback();
      }
      this.editingCategoryId = null;
      this.editingLinkId = null;
    });

    this.openIconPickerBtn.addEventListener('click', () => {
      this.iconPickerDialog.open((selectedIcon) => {
        this.linkIconInput.value = selectedIcon;
        this._renderIconPreview(selectedIcon);
      });
    });
  }

  /**
   * アイコン名に応じてプレビュー要素を更新します。
   * Material Symbol 名（ASCII スネークケース）はシンボルとして、
   * それ以外（絵文字など）はそのままテキストとして表示します。
   * @private
   * @param {string} iconValue - アイコン値。
   */
  _renderIconPreview(iconValue) {
    const isMaterialSymbol = iconValue && /^[a-z][a-z_0-9]*$/.test(iconValue);
    if (isMaterialSymbol) {
      this.linkIconDisplay.className = 'icon icon-lg';
      this.linkIconDisplay.style.fontSize = '';
      this.linkIconDisplay.textContent = iconValue;
    } else {
      this.linkIconDisplay.className = '';
      this.linkIconDisplay.style.fontSize = '1.4rem';
      this.linkIconDisplay.textContent = iconValue || '?';
    }
  }

  open(categoryId, linkId = null) {
    this.editingCategoryId = categoryId;
    this.editingLinkId = linkId;

    if (linkId) {
      const link = this.dataManager.getLink(categoryId, linkId);
      this.form.linkTitleInput.value = link.title;
      this.form.linkUrlInput.value = link.url;
      this.linkIconInput.value = link.icon;
      this.form.linkBadgeInput.value = link.badge;
      this.form.linkMemoInput.value = link.memo;
      this._renderIconPreview(link.icon);
    } else {
      this.form.reset();
      this.linkIconInput.value = 'link';
      this.form.linkBadgeInput.value = 'doc';
      this._renderIconPreview('link');
    }
    this.dialog.showModal();
  }
}
