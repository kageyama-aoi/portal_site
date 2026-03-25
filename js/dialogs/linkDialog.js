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
  /** @property {HTMLInputElement} linkIconColorInput - アイコン色を保持する color input。 */
  linkIconColorInput;
  /** @property {HTMLInputElement} linkIconFillInput - FILL 値を保持する hidden input。 */
  linkIconFillInput;
  /** @property {HTMLInputElement} linkIconWeightInput - wght 値を保持する hidden input。 */
  linkIconWeightInput;
  /** @property {HTMLInputElement} linkIconSizeInput - サイズを保持する hidden input。 */
  linkIconSizeInput;
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
    this.linkIconColorInput = document.getElementById('linkIconColorInput');
    this.linkIconFillInput = document.getElementById('linkIconFillInput');
    this.linkIconWeightInput = document.getElementById('linkIconWeightInput');
    this.linkIconSizeInput = document.getElementById('linkIconSizeInput');
    this.openIconPickerBtn = document.getElementById('openLinkIconPickerBtn');
    this.initEventListeners();
  }

  initEventListeners() {
    this.dialog.addEventListener('close', () => {
      if (this.dialog.returnValue === 'save') {
        const tagsRaw = document.getElementById('linkTagsInput').value;
        const keywordsRaw = document.getElementById('linkKeywordsInput').value;
        const linkData = {
          title: this.form.linkTitleInput.value,
          url: this.form.linkUrlInput.value,
          icon: this.linkIconInput.value || 'link',
          iconColor: this.linkIconColorInput.dataset.custom === 'true' ? this.linkIconColorInput.value : '',
          iconFill: Number(this.linkIconFillInput.value),
          iconWeight: Number(this.linkIconWeightInput.value),
          iconSize: this.linkIconSizeInput.value,
          badge: this.form.linkBadgeInput.value,
          memo: this.form.linkMemoInput.value,
          tags: tagsRaw.split(',').map(t => t.trim()).filter(Boolean),
          keywords: keywordsRaw.split(',').map(k => k.trim()).filter(Boolean),
          freq: document.getElementById('linkFreqInput').value || null
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
        this._updatePreview();
      });
    });

    this.linkIconColorInput.addEventListener('input', () => {
      this.linkIconColorInput.dataset.custom = 'true';
      this._updatePreview();
    });

    document.getElementById('resetIconColorBtn').addEventListener('click', () => {
      this.linkIconColorInput.dataset.custom = 'false';
      this.linkIconColorInput.value = '#64748b';
      this._updatePreview();
    });

    // アイコンスタイルボタン群
    this._initStyleGroup('iconFillGroup', this.linkIconFillInput);
    this._initStyleGroup('iconWeightGroup', this.linkIconWeightInput);
    this._initStyleGroup('iconSizeGroup', this.linkIconSizeInput);
  }

  /**
   * スタイルボタングループにクリックハンドラを設定します。
   * @private
   */
  _initStyleGroup(groupId, hiddenInput) {
    document.getElementById(groupId).querySelectorAll('.icon-style-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        hiddenInput.value = btn.dataset.value;
        this._activateBtn(groupId, btn.dataset.value);
        this._updatePreview();
      });
    });
  }

  /**
   * ボタングループ内でアクティブボタンを切り替えます。
   * @private
   */
  _activateBtn(groupId, value) {
    document.getElementById(groupId).querySelectorAll('.icon-style-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.value === String(value));
    });
  }

  /**
   * 現在の設定値に基づいてプレビューアイコンを更新します。
   * @private
   */
  _updatePreview() {
    const iconValue = this.linkIconInput.value;
    const color = this.linkIconColorInput.dataset.custom === 'true' ? this.linkIconColorInput.value : '';
    const fill = Number(this.linkIconFillInput.value);
    const weight = Number(this.linkIconWeightInput.value);
    const size = this.linkIconSizeInput.value;

    const isMaterialSymbol = iconValue && /^[a-z][a-z_0-9]*$/.test(iconValue);
    if (isMaterialSymbol) {
      this.linkIconDisplay.className = 'icon icon-lg';
      this.linkIconDisplay.style.fontSize = size === 'xl' ? '40px' : size === 'large' ? '32px' : '';
      this.linkIconDisplay.style.fontVariationSettings = `'FILL' ${fill}, 'wght' ${weight}, 'GRAD' 0, 'opsz' 40`;
    } else {
      this.linkIconDisplay.className = '';
      this.linkIconDisplay.style.fontSize = '1.4rem';
      this.linkIconDisplay.style.fontVariationSettings = '';
      this.linkIconDisplay.textContent = iconValue || '?';
    }
    if (isMaterialSymbol) this.linkIconDisplay.textContent = iconValue;
    this.linkIconDisplay.style.color = color || '';
  }

  /**
   * スタイル値を各コントロールに反映して表示を初期化します。
   * @private
   */
  _loadStyle(fill, weight, size) {
    this.linkIconFillInput.value = fill;
    this.linkIconWeightInput.value = weight;
    this.linkIconSizeInput.value = size;
    this._activateBtn('iconFillGroup', String(fill));
    this._activateBtn('iconWeightGroup', String(weight));
    this._activateBtn('iconSizeGroup', size);
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
      document.getElementById('linkTagsInput').value = (link.tags || []).join(', ');
      document.getElementById('linkKeywordsInput').value = (link.keywords || []).join(', ');
      document.getElementById('linkFreqInput').value = link.freq || '';
      const hasColor = !!link.iconColor;
      this.linkIconColorInput.value = link.iconColor || '#64748b';
      this.linkIconColorInput.dataset.custom = hasColor ? 'true' : 'false';
      this._loadStyle(link.iconFill ?? 0, link.iconWeight || 400, link.iconSize || 'normal');
    } else {
      this.form.reset();
      this.linkIconInput.value = 'link';
      this.form.linkBadgeInput.value = 'doc';
      this.linkIconColorInput.value = '#64748b';
      this.linkIconColorInput.dataset.custom = 'false';
      document.getElementById('linkTagsInput').value = '';
      document.getElementById('linkKeywordsInput').value = '';
      document.getElementById('linkFreqInput').value = '';
      this._loadStyle(0, 400, 'normal');
    }
    this._updatePreview();
    this.dialog.showModal();
  }
}
