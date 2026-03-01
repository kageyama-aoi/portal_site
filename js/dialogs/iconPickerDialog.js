/**
 * @file iconPickerDialog.js
 * @brief アイコン選択ダイアログを管理するクラス。
 * @module IconPickerDialog
 */

import { iconList, iconCategories } from '../iconList.js';

/**
 * @class IconPickerDialog
 * @brief Material Symbols アイコンを検索・カテゴリ絞り込みして選択するモーダルダイアログを制御します。
 */
export class IconPickerDialog {
  dialog;
  iconGrid;
  searchInput;
  categoryFilter;
  icons = iconList;
  currentSelectCallback = null;
  /** @type {string} 現在選択中のカテゴリID（'all' = 全表示） */
  currentCategory = 'all';

  constructor() {
    this.icons = iconList;
    this.currentSelectCallback = null;
    this.currentCategory = 'all';
  }

  init() {
    this.dialog = document.getElementById('iconPickerDialog');
    this.iconGrid = document.getElementById('iconGrid');
    this.searchInput = document.getElementById('iconSearchInput');
    this.categoryFilter = document.getElementById('iconCategoryFilter');
    this.initEventListeners();
    this.renderCategories();
  }

  initEventListeners() {
    document.getElementById('closeIconPickerDialogBtn').addEventListener('click', () => {
      this.dialog.close();
      this.currentSelectCallback = null;
    });

    this.searchInput.addEventListener('input', () => this.filterIcons());

    this.iconGrid.addEventListener('click', (e) => {
      const targetButton = e.target.closest('button[data-icon]');
      if (targetButton && this.currentSelectCallback) {
        this.currentSelectCallback(targetButton.dataset.icon);
        this.dialog.close();
        this.currentSelectCallback = null;
      }
    });
  }

  /**
   * カテゴリフィルターボタン群を描画します。
   * @private
   */
  renderCategories() {
    this.categoryFilter.innerHTML = '';
    iconCategories.forEach(cat => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = `icon-category-btn${cat.id === this.currentCategory ? ' active' : ''}`;
      btn.dataset.category = cat.id;

      const iconSpan = document.createElement('span');
      iconSpan.className = 'icon';
      iconSpan.style.fontSize = '14px';
      iconSpan.style.fontVariationSettings = "'FILL' 0, 'wght' 300, 'GRAD' 0, 'opsz' 20";
      iconSpan.textContent = cat.icon;

      btn.appendChild(iconSpan);
      btn.append(' ' + cat.label);

      btn.addEventListener('click', () => {
        this.currentCategory = cat.id;
        // アクティブクラスを切り替え
        this.categoryFilter.querySelectorAll('.icon-category-btn').forEach(b =>
          b.classList.toggle('active', b.dataset.category === cat.id)
        );
        this.filterIcons();
      });

      this.categoryFilter.appendChild(btn);
    });
  }

  /**
   * 検索文字列・カテゴリに基づいてアイコンをフィルタリングし、グリッドを再描画します。
   * @private
   */
  filterIcons() {
    const searchTerm = this.searchInput.value.toLowerCase().trim();

    const filtered = this.icons.filter(icon => {
      const categoryMatch = this.currentCategory === 'all' || icon.category === this.currentCategory;
      const searchMatch = !searchTerm ||
        icon.name.includes(searchTerm) ||
        icon.label.toLowerCase().includes(searchTerm);
      return categoryMatch && searchMatch;
    });

    this.renderIcons(filtered);
  }

  /**
   * 指定されたアイコンのリストをグリッドに描画します。
   * @private
   * @param {Array<IconEntry>} iconsToRender
   */
  renderIcons(iconsToRender) {
    this.iconGrid.innerHTML = '';

    if (iconsToRender.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'icon-grid-empty';
      empty.textContent = '該当するアイコンがありません';
      this.iconGrid.appendChild(empty);
      return;
    }

    iconsToRender.forEach(icon => {
      const button = document.createElement('button');
      button.type = 'button';
      button.dataset.icon = icon.name;
      // ツールチップ: アイコン名 + 日本語キーワード（最初の2語）
      const keywords = icon.label.split(' ').slice(0, 3).join(' ');
      button.title = `${icon.name}\n${keywords}`;

      const iconSpan = document.createElement('span');
      iconSpan.className = 'icon icon-lg';
      iconSpan.textContent = icon.name;

      // アイコン名を短縮して表示（スネークケース → スペース区切り、12文字まで）
      const nameLabel = document.createElement('span');
      nameLabel.className = 'icon-grid-label';
      const displayName = icon.name.replace(/_/g, ' ');
      nameLabel.textContent = displayName.length > 11 ? displayName.slice(0, 10) + '…' : displayName;

      button.appendChild(iconSpan);
      button.appendChild(nameLabel);
      this.iconGrid.appendChild(button);
    });
  }

  open(callback) {
    this.currentSelectCallback = callback;
    this.searchInput.value = '';
    this.currentCategory = 'all';
    // カテゴリボタンのアクティブ状態をリセット
    if (this.categoryFilter) {
      this.categoryFilter.querySelectorAll('.icon-category-btn').forEach(b =>
        b.classList.toggle('active', b.dataset.category === 'all')
      );
    }
    this.filterIcons();
    this.dialog.showModal();
  }
}
