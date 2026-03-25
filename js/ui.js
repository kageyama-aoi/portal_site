/**
 * @file ui.js
 * @brief DOM の描画とユーザーイベントの処理、およびダイアログとの連携を管理するクラス。
 * @module UI
 */

import { CategoryDialog } from './dialogs/categoryDialog.js';

/**
 * @typedef {object} Category
 * @property {string} id - カテゴリのユニークID。
 * @property {string} title - カテゴリのタイトル。
 * @property {boolean} isOpen - カテゴリが展開されているかどうか。
 * @property {Array<Link>} links - カテゴリ内のリンクの配列。
 */

/**
 * @typedef {object} Link
 * @property {string} id - リンクのユニークID。
 * @property {string} title - リンクのタイトル。
 * @property {string} url - リンクのURL。
 * @property {string} icon - リンクのアイコン（絵文字など）。
 * @property {string} badge - リンクのバッジタイプ。
 * @property {string} memo - リンクのメモ。
 */

/**
 * @typedef {object} DragInfo
 * @property {'category'|'link'} type - ドラッグ中の要素のタイプ。
 * @property {number} index - ドラッグ中の要素のインデックス。
 * @property {number} [catIndex] - リンクの場合、親カテゴリのインデックス。
 * @property {'before'|'after'} [dropPosition] - ドロップ位置がターゲットの前か後か。
 */

/**
 * @class UI
 * @brief アプリケーションのユーザーインターフェースを構築し、DOMイベントを処理するクラス。
 *        DataManager, ConfigManager, および各種ダイアログと連携して動作します。
 */
export class UI {
  /**
   * @property {DataManager} dataManager - データ操作を管理するDataManagerのインスタンス。
   */
  dataManager;
  /**
   * @property {ConfigManager} configManager - 設定を管理するConfigManagerのインスタンス。
   */
  configManager;
  /**
   * @property {LinkDialog} linkDialog - リンク編集ダイアログのインスタンス。
   */
  linkDialog;
  /**
   * @property {BulkLinkDialog} bulkLinkDialog - リンク一括追加ダイアログのインスタンス。
   */
  bulkLinkDialog;
  /**
   * @property {PortalDialog|null} portalDialog - ポータル管理ダイアログのインスタンス。app.jsで後から設定されます。
   */
  portalDialog = null;
  /**
   * @property {HTMLElement} container - アプリケーションのコンテンツが描画されるDOM要素。
   */
  container;
  /**
   * @property {boolean} isEditMode - 編集モードが有効かどうかを示すフラグ。
   */
  isEditMode = false;
  /**
   * @property {CategoryDialog} categoryDialog - カテゴリ編集ダイアログのインスタンス。
   */
  categoryDialog;
  /**
   * @property {string|null} editingCategoryId - 編集中のカテゴリのID。
   */
  editingCategoryId = null;
  /**
   * @property {string|null} editingLinkId - 編集中のリンクのID。
   */
  editingLinkId = null;
  /**
   * @property {DragInfo|null} draggedInfo - ドラッグ中の要素に関する情報。
   */
  draggedInfo = null;
  /**
   * @property {HTMLElement|null} placeholder - ドラッグアンドドロップ操作中に表示されるプレースホルダー要素。
   */
  placeholder = null;
  /**
   * @property {'card'|'table'} viewMode - 現在のビューモード。
   */
  viewMode = 'card';
  static VIEW_MODE_KEY = 'portalViewMode';
  /**
   * @property {SearchManager|null} searchManager
   */
  searchManager = null;
  /**
   * @property {MemoryManager|null} memoryManager
   */
  memoryManager = null;
  /**
   * @property {WorkflowManager|null} workflowManager
   */
  workflowManager = null;
  /**
   * @property {WorkflowDialog|null} workflowDialog
   */
  workflowDialog = null;
  /**
   * @property {string} searchQuery - 現在の検索キーワード
   */
  searchQuery = '';
  /**
   * @property {string[]} selectedTags - 選択中のタグフィルタ
   */
  selectedTags = [];
  /**
   * @property {string} freqFilter - 選択中の頻度フィルタ
   */
  freqFilter = '';

  /**
   * UIの新しいインスタンスを作成します。
   * @param {DataManager} dataManager - データ管理オブジェクト。
   * @param {ConfigManager} configManager - 設定管理オブジェクト。
   * @param {CategoryDialog} categoryDialog - カテゴリ編集ダイアログオブジェクト。
   * @param {LinkDialog} linkDialog - リンク編集ダイアログオブジェクト。
   * @param {BulkLinkDialog} bulkLinkDialog - リンク一括追加ダイアログオブジェクト。
   */
  constructor(dataManager, configManager, categoryDialog, linkDialog, bulkLinkDialog) {
    this.dataManager = dataManager;
    this.configManager = configManager;
    this.categoryDialog = categoryDialog; // 引数から受け取る
    this.linkDialog = linkDialog;
    this.bulkLinkDialog = bulkLinkDialog;
    this.isEditMode = false;
  }
  /**
   * UIの初期化を行います。イベントリスナーを設定し、初回描画を行います。
   */
  init() {
    this.container = document.getElementById('app-container'); // init()に移動
    this.viewMode = localStorage.getItem(UI.VIEW_MODE_KEY) || 'card';
    this._updateViewButtons();
    this.initEventListeners();
    this._updateTagPanel();
    this.render();
  }

  /**
   * ページのタイトルとサブタイトルを設定します。
   * @param {string} title - 新しいページのタイトル。
   * @param {string} subtitle - 新しいページのサブタイトル。
   */
  setPageTitle(title, subtitle) {
    document.title = title;
    const h1 = document.querySelector('h1');
    const icon = document.createElement('span');
    icon.className = 'icon icon-lg';
    icon.style.color = 'var(--primary)';
    icon.textContent = 'menu_book';
    h1.textContent = '';
    h1.appendChild(icon);
    h1.append(' ' + title);
    document.querySelector('.note').textContent = subtitle;
  }
  
  /**
   * 保存ボタンの状態（有効/無効）と表示を更新します。
   * @param {boolean} isDirty - 未保存の変更があるかどうか。
   */
  updateSaveButtonState(isDirty) {
    const btn = document.getElementById('saveChangesBtn');
    const warning = document.getElementById('unsavedWarning');

    const iconEl = btn.querySelector('.icon') || document.createElement('span');
    iconEl.className = 'icon icon-sm';
    iconEl.textContent = 'save';
    if (!btn.contains(iconEl)) btn.prepend(iconEl);

    const textNode = btn.childNodes[btn.childNodes.length - 1];
    const setLabel = (text) => {
      if (textNode && textNode.nodeType === Node.TEXT_NODE) {
        textNode.textContent = ` ${text}`;
      } else {
        btn.append(` ${text}`);
      }
    };

    if (isDirty) {
      btn.disabled = false;
      btn.classList.add('pulse-animation');
      setLabel('JSONを保存');
      warning.textContent = '未保存の変更あり';
      warning.style.color = 'var(--danger)';
    } else {
      btn.disabled = true;
      btn.classList.remove('pulse-animation');
      setLabel('JSONを保存');
      warning.textContent = 'データは最新です';
      warning.style.color = 'var(--text-sub)';
    }
  }

  /**
   * すべての主要なDOMイベントリスナーを初期化します。
   */
  initEventListeners() {
    // 全開閉
    document.getElementById('openAll').addEventListener('click', () => this.toggleAll(true));
    document.getElementById('closeAll').addEventListener('click', () => this.toggleAll(false));
    
    // 編集モード切替
    document.getElementById('editModeToggle').addEventListener('change', (e) => {
      this.isEditMode = e.target.checked;
      this.render();
      document.getElementById('addCategoryBtn').style.display = this.isEditMode ? 'block' : 'none';
      document.getElementById('bulkAddLinkBtn').style.display = this.isEditMode ? 'block' : 'none';
    });

    // 保存ボタン
    document.getElementById('saveChangesBtn').addEventListener('click', () => {
      const activePortalId = this.configManager.getActivePortalId();
      this.dataManager.save(activePortalId);
      this.updateSaveButtonState(false);
      alert('ダウンロードされた "data.json" を\n元の data/data.json に上書きしてください。');
    });

    // JSON読み込み（インポート・差し替え）
    document.getElementById('importFileInput').addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;

      const activePortalId = this.configManager.getActivePortalId();
      const overwrite = confirm(`現在のポータル「${this.configManager.getActivePortal().title}」のデータを、読み込んだファイルの内容で上書きしますか？\n（この操作はまだ保存されません）`);

      if (overwrite) {
        try {
          await this.dataManager.importData(file, activePortalId);
          alert('データを読み込みました。内容を確認し、問題なければ右上の「保存」ボタンを押してください。');
          this.render();
        } catch (err) {
          console.error(err);
          alert(`JSONファイルの読み込みに失敗しました: ${err.message}`);
        }
      } else {
        const createNew = confirm("では、読み込んだファイルから新しいポータルを作成しますか？");
        if (createNew) {
          const portalName = prompt("新しいポータルの名前を入力してください:", file.name.replace('.json', ''));
          if (portalName) {
            try {
              const id = `portal_${Date.now()}`;
              this.configManager.addPortal({ id, name: portalName });
              this.configManager.setActivePortal(id);
              await this.dataManager.loadFromFile(file, id);
              this.dataManager.save(id);
              alert(`新規ポータル「${portalName}」を作成し、切り替えました。`);
              window.location.reload();
            } catch(err) {
              alert(`新規ポータルの作成に失敗しました: ${err.message}`);
            }
          }
        }
      }
      e.target.value = ''; // inputをリセット
    });

    document.getElementById('portalSettingsBtn').addEventListener('click', () => this.portalDialog.open());

    document.getElementById('viewCardBtn').addEventListener('click', () => {
      this.viewMode = 'card';
      localStorage.setItem(UI.VIEW_MODE_KEY, 'card');
      this._updateViewButtons();
      this.render();
    });
    document.getElementById('viewTableBtn').addEventListener('click', () => {
      this.viewMode = 'table';
      localStorage.setItem(UI.VIEW_MODE_KEY, 'table');
      this._updateViewButtons();
      this.render();
    });

    document.getElementById('viewMemoryBtn').addEventListener('click', () => {
      this.viewMode = 'memory';
      localStorage.setItem(UI.VIEW_MODE_KEY, 'memory');
      this._updateViewButtons();
      this.render();
    });

    document.getElementById('viewWorkflowBtn').addEventListener('click', () => {
      this.viewMode = 'workflow';
      localStorage.setItem(UI.VIEW_MODE_KEY, 'workflow');
      this._updateViewButtons();
      this.render();
    });

    // 手動ファイル読み込み（エラー時用）
    document.getElementById('manualLoadInput').addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      try {
        await this.dataManager.loadFromFile(file);
        document.getElementById('errorArea').style.display = 'none';
        this.render();
      } catch (err) {
        alert('JSONの読み込みに失敗しました');
      }
    });

    document.getElementById('addCategoryBtn').addEventListener('click', () => this.categoryDialog.open());





    document.getElementById('bulkAddLinkBtn').addEventListener('click', () => this.bulkLinkDialog.open());

    // 検索バー
    const searchInput = document.getElementById('searchInput');
    const searchClearBtn = document.getElementById('searchClearBtn');
    searchInput.addEventListener('input', () => {
      this.searchQuery = searchInput.value;
      searchClearBtn.style.display = this.searchQuery ? 'flex' : 'none';
      this._updateTagPanel();
      this.render();
    });
    searchClearBtn.addEventListener('click', () => {
      searchInput.value = '';
      this.searchQuery = '';
      searchClearBtn.style.display = 'none';
      this._updateTagPanel();
      this.render();
    });

    // 頻度フィルタ
    document.querySelectorAll('.freq-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        this.freqFilter = chip.dataset.freq;
        document.querySelectorAll('.freq-chip').forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
        this.render();
      });
    });
    // 初期状態で「全て」をアクティブに
    document.querySelector('.freq-chip[data-freq=""]')?.classList.add('active');
  }




  openCategoryDialog(categoryId = null) {
    this.editingCategoryId = categoryId;
    const dialog = document.getElementById('categoryDialog');
    const titleInput = document.getElementById('catTitleInput');
    
    if (categoryId) {
      const cat = this.dataManager.getCategory(categoryId);
      titleInput.value = cat.title;
    } else {
      titleInput.value = '';
    }
    dialog.showModal();
  }





  toggleAll(isOpen) {
    const details = document.querySelectorAll('details');
    details.forEach(d => d.open = isOpen);
    this.dataManager.getData().forEach(cat => cat.isOpen = isOpen);
  }

  openCategoryLinks(category) {
    let blockedCount = 0;
    category.links.forEach(link => {
      if (link.url) {
        const win = window.open(link.url, '_blank');
        if (!win || win.closed || typeof win.closed == 'undefined') {
          blockedCount++;
        }
      }
    });

    if (blockedCount > 0) {
      alert(`⚠️ ${blockedCount}個のリンクが開けませんでした。\n\nブラウザの「ポップアップブロック」が作動しています。\nアドレスバーの右端（または設定）から、このサイトのポップアップ表示を「常に許可」に設定してください。`);
    }
  }

  getBadgeLabel(type) {
    const map = {
      video: 'Video',
      doc: 'Docs',
      portal: 'Portal',
      article: 'Article',
      code: 'Code',
      tool: 'Tool',
      sns: 'SNS',
      cloud: 'Cloud',
      local: 'Local',
      money: 'Money',
      news: 'News',
      idea: 'Idea',
      company: 'Company'
    };
    return map[type] || type;
  }

  /**
   * タグパネルを更新します（利用中タグをボタン表示）。
   */
  _updateTagPanel() {
    if (!this.searchManager) return;
    const tags = this.searchManager.getAllTags();
    const row = document.getElementById('tagFilterRow');
    const chips = document.getElementById('tagFilterChips');
    const clearBtn = document.getElementById('tagFilterClearBtn');

    if (tags.length === 0) {
      row.style.display = 'none';
      return;
    }
    row.style.display = 'flex';
    chips.innerHTML = '';
    tags.forEach(tag => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'tag-chip' + (this.selectedTags.includes(tag) ? ' active' : '');
      btn.textContent = tag;
      btn.addEventListener('click', () => {
        if (this.selectedTags.includes(tag)) {
          this.selectedTags = this.selectedTags.filter(t => t !== tag);
        } else {
          this.selectedTags.push(tag);
        }
        this._updateTagPanel();
        this.render();
      });
      chips.appendChild(btn);
    });

    const hasActive = this.selectedTags.length > 0;
    clearBtn.style.display = hasActive ? 'inline-flex' : 'none';
    if (!clearBtn._hasListener) {
      clearBtn._hasListener = true;
      clearBtn.addEventListener('click', () => {
        this.selectedTags = [];
        this._updateTagPanel();
        this.render();
      });
    }
  }

  /**
   * アプリケーションのUI全体を再描画します。
   */
  render() {
    this.container.innerHTML = ''; // コンテナをクリア

    // 検索/フィルタがアクティブな場合は検索結果表示
    const isSearchActive = this.searchQuery.trim() || this.selectedTags.length > 0 || this.freqFilter;
    if (isSearchActive && this.searchManager) {
      this._renderSearchResults();
      return;
    }

    // viewMode による切り替え
    if (this.viewMode === 'memory') {
      this._renderMemoryMode();
      return;
    }
    if (this.viewMode === 'workflow') {
      this._renderWorkflowMode();
      return;
    }

    const data = this.dataManager.getData(); // 最新のデータを取得

    data.forEach((category, catIndex) => {
      const details = document.createElement('details');
      details.open = category.isOpen;
      
      details.addEventListener('toggle', () => {
        category.isOpen = details.open;
      });

      // D&D for Categories
      if (this.isEditMode) {
        details.draggable = true;
        details.addEventListener('dragstart', (e) => this._handleDragStart(e, { type: 'category', index: catIndex }));
        details.addEventListener('dragover', (e) => this._handleDragOver(e));
        details.addEventListener('drop', (e) => this._handleDrop(e, { type: 'category', index: catIndex }));
        details.addEventListener('dragend', (e) => this._handleDragEnd(e));
      }

      const summary = document.createElement('summary');
      const summaryContent = document.createElement('div');
      summaryContent.className = 'summary-content';
      summaryContent.textContent = category.title;

      const groupActions = document.createElement('div');
      groupActions.className = 'group-actions';

      if (this.isEditMode) {
        if (catIndex > 0) {
          const upBtn = this._createActionButton('<span class="icon icon-sm">arrow_upward</span>', 'action-btn btn-move', () => this.dataManager.moveCategory(catIndex, catIndex - 1), 'カテゴリを上に移動');
          groupActions.appendChild(upBtn);
        }
        if (catIndex < data.length - 1) {
          const downBtn = this._createActionButton('<span class="icon icon-sm">arrow_downward</span>', 'action-btn btn-move', () => this.dataManager.moveCategory(catIndex, catIndex + 1), 'カテゴリを下に移動');
          groupActions.appendChild(downBtn);
        }
        const editBtn = this._createActionButton('<span class="icon icon-sm">edit</span>', 'action-btn btn-edit', () => this.categoryDialog.open(category.id), 'カテゴリを編集');
        const deleteBtn = this._createActionButton('<span class="icon icon-sm">delete</span>', 'action-btn btn-delete', () => {
          if (confirm(`カテゴリ「${category.title}」と中のリンクをすべて削除しますか？`)) {
            this.dataManager.deleteCategory(category.id);
            this.render();
          }
        }, 'カテゴリを削除');
        groupActions.appendChild(editBtn);
        groupActions.appendChild(deleteBtn);
      } else {
        const openBtn = this._createActionButton('<span class="icon icon-sm">open_in_new</span> 一括で開く', 'action-btn btn-open', () => this.openCategoryLinks(category));
        openBtn.title = 'このカテゴリのリンクをすべて開く';
        groupActions.appendChild(openBtn);
      }

      summaryContent.appendChild(groupActions);
      summary.appendChild(summaryContent);

      const chevron = document.createElement('span');
      chevron.className = 'icon icon-lg summary-chevron';
      chevron.textContent = 'expand_more';
      summary.appendChild(chevron);

      details.appendChild(summary);

      const linkList = document.createElement('div');
      linkList.className = this.viewMode === 'table' ? 'link-list link-list-table' : 'link-list';

      category.links.forEach((link, linkIndex) => {
        const el = this.viewMode === 'table'
          ? this._createTableRow(link, category.id, catIndex, linkIndex)
          : this._createLinkCard(link, category.id, catIndex, linkIndex);
        linkList.appendChild(el);
      });

      if (this.isEditMode) {
        const addPlaceholder = document.createElement('div');
        addPlaceholder.className = 'add-link-placeholder';
        addPlaceholder.innerHTML = '<span class="icon icon-md">add_link</span> リンクを追加';
        addPlaceholder.addEventListener('click', () => this.linkDialog.open(category.id));
        linkList.appendChild(addPlaceholder);
      }

      details.appendChild(linkList);
      this.container.appendChild(details);
    });
  }

  /**
   * アクションボタン要素を作成します。
   * @private
   * @param {string} text - ボタンの表示テキストまたはHTML。
   * @param {string} className - ボタンに適用するCSSクラス名。
   * @param {function(): void} onClick - クリック時に実行されるコールバック関数。
   * @param {string} [title=''] - ボタンのツールチップテキスト。
   * @returns {HTMLButtonElement} 作成されたボタン要素。
   */
  _createActionButton(text, className, onClick, title = '') {
    const btn = document.createElement('button');
    btn.className = className;
    btn.innerHTML = text;
    if (title) btn.title = title;
    btn.addEventListener('click', (e) => {
      e.stopPropagation(); 
      e.preventDefault();
      onClick();
      if(this.dataManager.hasUnsavedChanges) this.render(); // 変更があった場合のみ再レンダリング
    });
    return btn;
  }
  
  /**
   * 個々のリンクカード要素を作成します。
   * @private
   * @param {Link} link - リンクデータオブジェクト。
   * @param {string} catId - 親カテゴリのID。
   * @param {number} catIndex - 親カテゴリのインデックス。
   * @param {number} linkIndex - リンクのインデックス。
   * @returns {HTMLDivElement} 作成されたリンクカードのラッパー要素。
   */
  _createLinkCard(link, catId, catIndex, linkIndex) {
      const wrapper = document.createElement('div');
      wrapper.className = 'link-card-wrapper';

      // リンクのドラッグアンドドロップ設定
      if (this.isEditMode) {
        wrapper.draggable = true;
        wrapper.addEventListener('dragstart', (e) => this._handleDragStart(e, { type: 'link', catIndex, index: linkIndex }));
        wrapper.addEventListener('dragover', (e) => this._handleDragOver(e));
        wrapper.addEventListener('drop', (e) => this._handleDrop(e, { type: 'link', catIndex, index: linkIndex }));
        wrapper.addEventListener('dragend', (e) => this._handleDragEnd(e));
      }

      const a = document.createElement('a');
      a.className = `link-card ${this.isEditMode ? 'disabled' : ''}`;
      a.href = link.url;
      a.target = '_blank'; // 新しいタブで開く
      if (!this.isEditMode && this.memoryManager) {
        a.addEventListener('click', () => this.memoryManager.recordVisit(link.id));
      }

      const iconArea = document.createElement('div');
      iconArea.className = 'icon-area';
      if (/^[a-z][a-z_0-9]*$/.test(link.icon)) {
        // Material Symbol
        const iconSpan = document.createElement('span');
        iconSpan.className = 'icon icon-lg';
        iconSpan.textContent = link.icon;
        if (link.iconColor) iconSpan.style.color = link.iconColor;
        this._applyIconStyle(iconSpan, link, false);
        iconArea.appendChild(iconSpan);
      } else {
        // 絵文字（既存データの後方互換）
        iconArea.textContent = link.icon;
      }

      const contentArea = document.createElement('div');
      contentArea.className = 'content-area';

      const headerRow = document.createElement('div');
      headerRow.className = 'header-row';
      const titleSpan = document.createElement('span');
      titleSpan.className = 'link-title';
      titleSpan.textContent = link.title;
      const badgeSpan = document.createElement('span');
      badgeSpan.className = `badge badge-${link.badge}`;
      badgeSpan.textContent = this.getBadgeLabel(link.badge);

      headerRow.appendChild(titleSpan);
      headerRow.appendChild(badgeSpan);

      const memoDiv = document.createElement('div');
      memoDiv.className = 'link-memo';
      memoDiv.textContent = link.memo;

      contentArea.appendChild(headerRow);
      contentArea.appendChild(memoDiv);

      a.appendChild(iconArea);
      a.appendChild(contentArea);
      wrapper.appendChild(a);

      // 編集モード時のカードアクションボタン
      if (this.isEditMode) {
        const cardActions = document.createElement('div');
        cardActions.className = 'card-actions';
        
        // リンク移動ボタン
        if (linkIndex > 0) {
           const upBtn = this._createCardActionButton('<span class="icon icon-sm">arrow_upward</span>', () => this.dataManager.moveLink(catIndex, linkIndex, linkIndex - 1), 'リンクを上に移動');
           cardActions.appendChild(upBtn);
        }
        if (linkIndex < this.dataManager.getCategory(catId).links.length - 1) {
          const downBtn = this._createCardActionButton('<span class="icon icon-sm">arrow_downward</span>', () => this.dataManager.moveLink(catIndex, linkIndex, linkIndex + 1), 'リンクを下に移動');
          cardActions.appendChild(downBtn);
        }

        // リンク編集・削除ボタン
        const editBtn = this._createCardActionButton('<span class="icon icon-sm">edit</span>', () => this.linkDialog.open(catId, link.id), 'リンクを編集');
        const delBtn = this._createCardActionButton('<span class="icon icon-sm">delete</span>', () => {
           if (confirm(`リンク「${link.title}」を削除しますか？`)) {
             this.dataManager.deleteLink(catId, link.id);
             this.render();
           }
        }, 'リンクを削除');
        delBtn.classList.add('btn-delete'); // 削除ボタンにスタイルクラスを追加

        cardActions.appendChild(editBtn);
        cardActions.appendChild(delBtn);
        wrapper.appendChild(cardActions);
      }
      return wrapper;
  }
  
  /**
   * リンクのアイコンスタイル（FILL/wght/size）をスパン要素に適用します。
   * iconFill/iconWeight/iconSize のいずれかが設定されている場合のみ動作します。
   * @private
   * @param {HTMLElement} span - アイコンの span 要素。
   * @param {Link} link - リンクデータ。
   * @param {boolean} isTable - テーブルビューかどうか。
   */
  _applyIconStyle(span, link, isTable = false) {
    const hasFill = link.iconFill !== undefined && link.iconFill !== null;
    const hasWeight = !!link.iconWeight;
    const hasSize = link.iconSize && link.iconSize !== 'normal';
    if (!hasFill && !hasWeight && !hasSize) return;

    const fill = link.iconFill ?? 0;
    const weight = link.iconWeight || 400;
    span.style.fontVariationSettings = `'FILL' ${fill}, 'wght' ${weight}, 'GRAD' 0, 'opsz' 40`;

    if (hasSize) {
      if (isTable) {
        span.style.fontSize = link.iconSize === 'xl' ? '26px' : '22px';
      } else {
        span.style.fontSize = link.iconSize === 'xl' ? '40px' : '32px';
      }
    }
  }

  /**
   * ビュー切り替えボタンのアクティブ状態を更新します。
   * @private
   */
  _updateViewButtons() {
    document.getElementById('viewCardBtn').classList.toggle('active', this.viewMode === 'card');
    document.getElementById('viewTableBtn').classList.toggle('active', this.viewMode === 'table');
    document.getElementById('viewMemoryBtn').classList.toggle('active', this.viewMode === 'memory');
    document.getElementById('viewWorkflowBtn').classList.toggle('active', this.viewMode === 'workflow');
  }

  // ─────────────────────────────────────────────────────────
  // 検索結果モード
  // ─────────────────────────────────────────────────────────

  /**
   * 検索結果をフラットなカードリストで描画します。
   * @private
   */
  _renderSearchResults() {
    const results = this.searchManager.search(this.searchQuery, {
      tags: this.selectedTags,
      freq: this.freqFilter || null
    });

    const header = document.createElement('div');
    header.className = 'search-results-header';
    header.innerHTML = `
      <span class="icon icon-sm" style="color:var(--primary)">search</span>
      検索結果: <strong>${results.length}</strong> 件
    `;
    this.container.appendChild(header);

    if (results.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'search-empty';
      empty.innerHTML = `
        <span class="icon" style="font-size:2rem;color:var(--text-sub)">search_off</span>
        <p>該当するリンクが見つかりませんでした。</p>
      `;
      this.container.appendChild(empty);
      return;
    }

    // カテゴリごとにグループ化して表示
    const grouped = {};
    results.forEach(r => {
      if (!grouped[r.catTitle]) grouped[r.catTitle] = [];
      grouped[r.catTitle].push(r);
    });

    Object.entries(grouped).forEach(([catTitle, items]) => {
      const section = document.createElement('div');
      section.className = 'search-result-section';
      const catLabel = document.createElement('div');
      catLabel.className = 'search-result-cat-label';
      catLabel.textContent = catTitle;
      section.appendChild(catLabel);

      const grid = document.createElement('div');
      grid.className = 'link-list';
      items.forEach(({ link, catId }) => {
        const el = this._createLinkCard(link, catId, 0, 0);
        grid.appendChild(el);
      });
      section.appendChild(grid);
      this.container.appendChild(section);
    });
  }

  // ─────────────────────────────────────────────────────────
  // 思い出しモード
  // ─────────────────────────────────────────────────────────

  /**
   * 思い出しモード（最近使った / よく使う / たまに使う）を描画します。
   * @private
   */
  _renderMemoryMode() {
    const header = document.createElement('div');
    header.className = 'memory-mode-header';
    header.innerHTML = `
      <span class="icon" style="color:var(--primary);font-size:1.4rem">psychology</span>
      <div>
        <div style="font-weight:700;font-size:1rem;">思い出しモード</div>
        <div style="font-size:0.8rem;color:var(--text-sub);">リンクをクリックすると自動的に訪問履歴が記録されます</div>
      </div>
    `;
    this.container.appendChild(header);

    // 最近使った
    this._renderMemorySection(
      '最近使った',
      'schedule',
      '#3b82f6',
      this._resolveLinks(this.memoryManager.getRecentLinkIds()),
      link => {
        const info = this.memoryManager.getVisitInfo(link.id);
        return this.memoryManager.formatTimeAgo(info.lastVisited);
      }
    );

    // よく使う
    this._renderMemorySection(
      'よく使う',
      'star',
      '#f59e0b',
      this._resolveLinks(this.memoryManager.getFrequentLinkIds()),
      link => {
        const info = this.memoryManager.getVisitInfo(link.id);
        return `${info.visitCount}回`;
      }
    );

    // たまに使う（freq:rare）
    const rareLinks = this.searchManager.getRareLinks();
    this._renderMemorySection(
      'たまにしか使わない（思い出し対象）',
      'lightbulb',
      '#10b981',
      rareLinks.map(r => r.link),
      () => 'rare',
      rareLinks.map(r => r.catTitle)
    );
  }

  /**
   * @private - 思い出しモードのセクションを描画します。
   */
  _renderMemorySection(title, icon, color, links, subLabelFn, catTitles = []) {
    const section = document.createElement('div');
    section.className = 'memory-section';

    const sectionHeader = document.createElement('div');
    sectionHeader.className = 'memory-section-header';
    sectionHeader.innerHTML = `
      <span class="icon icon-sm" style="color:${color}">${icon}</span>
      <span>${title}</span>
      <span class="memory-count">${links.length}件</span>
    `;
    section.appendChild(sectionHeader);

    if (links.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'memory-empty';
      empty.textContent = title === 'よく使う' ? 'まだ複数回訪問したリンクはありません。' :
                          title.startsWith('最近') ? 'まだ訪問履歴がありません。' :
                          'freq: "rare" が設定されたリンクがありません。';
      section.appendChild(empty);
    } else {
      const grid = document.createElement('div');
      grid.className = 'memory-card-grid';
      links.forEach((link, i) => {
        if (!link) return;
        const catTitle = catTitles[i] || '';
        const subLabel = subLabelFn(link);
        const card = this._createMemoryCard(link, subLabel, catTitle);
        grid.appendChild(card);
      });
      section.appendChild(grid);
    }
    this.container.appendChild(section);
  }

  /**
   * @private - linkIdの配列をlinkオブジェクト配列に解決します。
   */
  _resolveLinks(linkIds) {
    if (!this.searchManager) return [];
    return linkIds.map(id => {
      const found = this.searchManager.findLinkById(id);
      return found ? found.link : null;
    }).filter(Boolean);
  }

  /**
   * @private - 思い出しモード用のコンパクトカードを作成します。
   */
  _createMemoryCard(link, subLabel, catTitle) {
    const card = document.createElement('a');
    card.className = 'memory-card';
    card.href = link.url;
    card.target = '_blank';
    card.addEventListener('click', () => {
      if (this.memoryManager) this.memoryManager.recordVisit(link.id);
    });

    const iconSpan = document.createElement('span');
    iconSpan.className = 'icon icon-lg';
    iconSpan.textContent = link.icon || 'link';
    if (link.iconColor) iconSpan.style.color = link.iconColor;
    this._applyIconStyle(iconSpan, link, false);

    const info = document.createElement('div');
    info.className = 'memory-card-info';

    const titleEl = document.createElement('div');
    titleEl.className = 'memory-card-title';
    titleEl.textContent = link.title;

    const meta = document.createElement('div');
    meta.className = 'memory-card-meta';
    if (catTitle) {
      const catEl = document.createElement('span');
      catEl.className = 'memory-card-cat';
      catEl.textContent = catTitle;
      meta.appendChild(catEl);
    }
    const subEl = document.createElement('span');
    subEl.className = 'memory-card-sub';
    subEl.textContent = subLabel;
    meta.appendChild(subEl);

    if (link.tags && link.tags.length > 0) {
      const tagsEl = document.createElement('div');
      tagsEl.className = 'memory-card-tags';
      link.tags.slice(0, 3).forEach(tag => {
        const chip = document.createElement('span');
        chip.className = 'tag-chip tag-chip-sm';
        chip.textContent = tag;
        tagsEl.appendChild(chip);
      });
      info.appendChild(titleEl);
      info.appendChild(meta);
      info.appendChild(tagsEl);
    } else {
      info.appendChild(titleEl);
      info.appendChild(meta);
    }

    card.appendChild(iconSpan);
    card.appendChild(info);
    return card;
  }

  // ─────────────────────────────────────────────────────────
  // ワークフローモード
  // ─────────────────────────────────────────────────────────

  /**
   * ワークフローモードを描画します。
   * @private
   */
  _renderWorkflowMode() {
    const portalId = this.configManager.getActivePortalId();
    const workflows = this.workflowManager ? this.workflowManager.getWorkflows(portalId) : [];

    const header = document.createElement('div');
    header.className = 'workflow-mode-header';
    header.innerHTML = `
      <div style="display:flex; align-items:center; gap:10px;">
        <span class="icon" style="color:var(--primary);font-size:1.4rem">account_tree</span>
        <div>
          <div style="font-weight:700;font-size:1rem;">作業フロー</div>
          <div style="font-size:0.8rem;color:var(--text-sub);">たまにしかやらない手順を忘れないために</div>
        </div>
      </div>
    `;

    const editBtn = document.createElement('button');
    editBtn.type = 'button';
    editBtn.className = 'secondary-btn';
    editBtn.innerHTML = '<span class="icon icon-sm">edit</span> フローを管理';
    editBtn.style.cssText = 'font-size:0.85rem;';
    editBtn.addEventListener('click', () => {
      if (this.workflowDialog) this.workflowDialog.open();
    });
    header.appendChild(editBtn);

    this.container.appendChild(header);

    if (workflows.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'workflow-empty';
      empty.innerHTML = `
        <span class="icon" style="font-size:2.5rem;color:var(--text-sub)">account_tree</span>
        <p>ワークフローがまだ登録されていません。</p>
        <button type="button" class="primary-btn" id="wfCreateFromEmpty" style="margin-top:8px;">
          <span class="icon icon-sm">add</span> 最初のフローを作成
        </button>
      `;
      this.container.appendChild(empty);
      document.getElementById('wfCreateFromEmpty')?.addEventListener('click', () => {
        if (this.workflowDialog) this.workflowDialog.open();
      });
      return;
    }

    const freqOrder = { rare: 0, monthly: 1, weekly: 2, daily: 3 };
    const sorted = [...workflows].sort((a, b) => (freqOrder[a.freq] ?? 9) - (freqOrder[b.freq] ?? 9));

    sorted.forEach(wf => {
      const card = document.createElement('details');
      card.className = 'workflow-card';
      card.open = true;

      const freqLabel = { daily: '毎日', weekly: '週次', monthly: '月次', rare: 'たまに' }[wf.freq] || '';
      const tags = (wf.tags || []).map(t => `<span class="tag-chip tag-chip-sm">${this._escapeHtml(t)}</span>`).join('');

      const summary = document.createElement('summary');
      summary.className = 'workflow-card-summary';
      summary.innerHTML = `
        <div class="workflow-card-title">
          <span class="icon icon-sm" style="color:var(--primary)">account_tree</span>
          ${this._escapeHtml(wf.title)}
          <span class="wf-freq-badge wf-freq-${wf.freq}">${freqLabel}</span>
        </div>
        <div class="workflow-card-meta">
          ${wf.description ? `<span style="color:var(--text-sub);font-size:0.8rem">${this._escapeHtml(wf.description)}</span>` : ''}
          ${tags ? `<div class="wf-tags-row" style="margin-top:4px">${tags}</div>` : ''}
        </div>
        <span class="icon icon-lg summary-chevron">expand_more</span>
      `;
      card.appendChild(summary);

      const stepsDiv = document.createElement('div');
      stepsDiv.className = 'workflow-steps';

      if (wf.steps.length === 0) {
        stepsDiv.innerHTML = '<div style="padding:12px 20px;color:var(--text-sub);font-size:0.85rem;">ステップがありません。</div>';
      } else {
        wf.steps.forEach(step => {
          const stepRow = document.createElement('div');
          stepRow.className = 'workflow-step-row';

          const num = document.createElement('div');
          num.className = 'workflow-step-num';
          num.textContent = step.step;

          const content = document.createElement('div');
          content.className = 'workflow-step-content';

          const stepTitle = document.createElement('div');
          stepTitle.className = 'workflow-step-title';
          stepTitle.textContent = step.title;

          content.appendChild(stepTitle);

          if (step.memo) {
            const memo = document.createElement('div');
            memo.className = 'workflow-step-memo';
            memo.innerHTML = `<span class="icon icon-xs">lightbulb</span> ${this._escapeHtml(step.memo)}`;
            content.appendChild(memo);
          }

          stepRow.appendChild(num);
          stepRow.appendChild(content);

          if (step.linkId) {
            const found = this.searchManager?.findLinkById(step.linkId);
            if (found) {
              const linkBtn = document.createElement('a');
              linkBtn.className = 'workflow-step-link-btn';
              linkBtn.href = found.link.url;
              linkBtn.target = '_blank';
              linkBtn.innerHTML = `<span class="icon icon-sm">open_in_new</span> ${this._escapeHtml(found.link.title)}`;
              linkBtn.addEventListener('click', () => {
                if (this.memoryManager) this.memoryManager.recordVisit(found.link.id);
              });
              stepRow.appendChild(linkBtn);
            }
          }

          stepsDiv.appendChild(stepRow);
        });
      }

      card.appendChild(stepsDiv);
      this.container.appendChild(card);
    });
  }

  /**
   * @private - HTML特殊文字をエスケープします。
   */
  _escapeHtml(str) {
    return String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  /**
   * テーブルビュー用のリンク行要素を作成します。
   * @private
   * @param {Link} link - リンクデータオブジェクト。
   * @param {string} catId - 親カテゴリのID。
   * @param {number} catIndex - 親カテゴリのインデックス。
   * @param {number} linkIndex - リンクのインデックス。
   * @returns {HTMLDivElement} 作成されたラッパー要素。
   */
  _createTableRow(link, catId, catIndex, linkIndex) {
    const wrapper = document.createElement('div');
    wrapper.className = 'table-row-wrapper';

    if (this.isEditMode) {
      wrapper.draggable = true;
      wrapper.addEventListener('dragstart', (e) => this._handleDragStart(e, { type: 'link', catIndex, index: linkIndex }));
      wrapper.addEventListener('dragover', (e) => this._handleDragOver(e));
      wrapper.addEventListener('drop', (e) => this._handleDrop(e, { type: 'link', catIndex, index: linkIndex }));
      wrapper.addEventListener('dragend', (e) => this._handleDragEnd(e));
    }

    const a = document.createElement('a');
    a.className = 'table-row' + (this.isEditMode ? ' disabled' : '');
    a.href = link.url;
    a.target = '_blank';
    if (link.memo) a.dataset.memo = link.memo;
    if (!this.isEditMode && this.memoryManager) {
      a.addEventListener('click', () => this.memoryManager.recordVisit(link.id));
    }

    const iconArea = document.createElement('div');
    iconArea.className = 'icon-area-sm';
    if (/^[a-z][a-z_0-9]*$/.test(link.icon)) {
      const iconSpan = document.createElement('span');
      iconSpan.className = 'icon icon-sm';
      iconSpan.textContent = link.icon;
      if (link.iconColor) iconSpan.style.color = link.iconColor;
      this._applyIconStyle(iconSpan, link, true);
      iconArea.appendChild(iconSpan);
    } else {
      iconArea.textContent = link.icon;
    }

    const titleCell = document.createElement('span');
    titleCell.className = 'link-title-cell';
    titleCell.textContent = link.title;

    const badgeSpan = document.createElement('span');
    badgeSpan.className = `badge badge-cell badge-${link.badge}`;
    badgeSpan.textContent = this.getBadgeLabel(link.badge);

    a.appendChild(iconArea);
    a.appendChild(titleCell);
    a.appendChild(badgeSpan);
    wrapper.appendChild(a);

    if (this.isEditMode) {
      const cardActions = document.createElement('div');
      cardActions.className = 'card-actions';

      if (linkIndex > 0) {
        const upBtn = this._createCardActionButton('<span class="icon icon-sm">arrow_upward</span>', () => this.dataManager.moveLink(catIndex, linkIndex, linkIndex - 1), 'リンクを上に移動');
        cardActions.appendChild(upBtn);
      }
      if (linkIndex < this.dataManager.getCategory(catId).links.length - 1) {
        const downBtn = this._createCardActionButton('<span class="icon icon-sm">arrow_downward</span>', () => this.dataManager.moveLink(catIndex, linkIndex, linkIndex + 1), 'リンクを下に移動');
        cardActions.appendChild(downBtn);
      }

      const editBtn = this._createCardActionButton('<span class="icon icon-sm">edit</span>', () => this.linkDialog.open(catId, link.id), 'リンクを編集');
      const delBtn = this._createCardActionButton('<span class="icon icon-sm">delete</span>', () => {
        if (confirm(`リンク「${link.title}」を削除しますか？`)) {
          this.dataManager.deleteLink(catId, link.id);
          this.render();
        }
      }, 'リンクを削除');
      delBtn.classList.add('btn-delete');

      cardActions.appendChild(editBtn);
      cardActions.appendChild(delBtn);
      wrapper.appendChild(cardActions);
    }

    return wrapper;
  }

  /**
   * カード内のアクションボタン要素を作成します。
   * @private
   * @param {string} text - ボタンの表示テキストまたはHTML。
   * @param {function(): void} onClick - クリック時に実行されるコールバック関数。
   * @param {string} [title=''] - ボタンのツールチップテキスト。
   * @returns {HTMLButtonElement} 作成されたボタン要素。
   */
   _createCardActionButton(text, onClick, title = '') {
    const btn = document.createElement('button');
    btn.className = 'action-btn';
    btn.innerHTML = text;
    if (title) btn.title = title;
    btn.addEventListener('click', (e) => {
      e.stopPropagation(); // 親要素へのイベント伝播を停止
      e.preventDefault();  // デフォルトの動作（リンクのクリックなど）を停止
      onClick();
      if(this.dataManager.hasUnsavedChanges) this.render(); // 変更があった場合のみ再レンダリング
    });
    return btn;
  }

  // --- Drag and Drop Handlers ---

  /**
   * ドラッグ操作が開始されたときに呼び出されます。
   * @private
   * @param {DragEvent} e - ドラッグイベントオブジェクト。
   * @param {DragInfo} info - ドラッグ中の要素に関する情報。
   */
  _handleDragStart(e, info) {
    // summary要素でのdragstartがdetails要素に伝播しないようにする
    if (e.target.tagName === 'SUMMARY') {
      e.stopPropagation();
    }
    this.draggedInfo = info;
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', null); // Firefoxで必須
    
    // プレースホルダーを作成
    this.placeholder = document.createElement('div');
    this.placeholder.className = `drag-placeholder ${info.type}-placeholder`;
    const rect = e.currentTarget.getBoundingClientRect();
    this.placeholder.style.height = `${rect.height}px`;
    if (info.type === 'link') {
       this.placeholder.style.width = `${rect.width}px`;
    }

    // 少し遅延させてからクラスを適用しないと、ドラッグゴーストにスタイルが反映されてしまう
    setTimeout(() => {
      e.currentTarget.classList.add('dragging');
    }, 0);
  }

  /**
   * ドラッグ中の要素がドロップターゲット上にあるときに呼び出されます。
   * ドロップ位置に応じてプレースホルダーを挿入します。
   * @private
   * @param {DragEvent} e - ドラッグイベントオブジェクト。
   */
  _handleDragOver(e) {
    e.preventDefault(); // ドロップを許可する
    const targetElement = e.currentTarget;
    
    // プレースホルダーが存在しない場合や、ターゲットがプレースホルダー自身の場合は処理しない
    if (!this.placeholder || targetElement.classList.contains('drag-placeholder')) {
        return;
    }

    const rect = targetElement.getBoundingClientRect();
    const isCategory = this.draggedInfo.type === 'category';
    // 垂直方向のD&D（カテゴリ）か水平方向のD&D（リンク）かで中央点を計算
    const midpoint = isCategory ? rect.top + rect.height / 2 : rect.left + rect.width / 2;
    const clientPos = isCategory ? e.clientY : e.clientX;

    // プレースホルダーを挿入する位置を決定
    if (clientPos < midpoint) {
        // ターゲット要素の前にプレースホルダーを挿入
        targetElement.parentNode.insertBefore(this.placeholder, targetElement);
        this.draggedInfo.dropPosition = 'before';
    } else {
        // ターゲット要素の後にプレースホルダーを挿入
        targetElement.parentNode.insertBefore(this.placeholder, targetElement.nextSibling);
        this.draggedInfo.dropPosition = 'after';
    }
  }

  /**
   * ドラッグ中の要素がドロップされたときに呼び出されます。
   * データの並び替えを行い、UIを更新します。
   * @private
   * @param {DragEvent} e - ドラッグイベントオブジェクト。
   * @param {object} dropTargetInfo - ドロップターゲットの情報。
   * @param {'category'|'link'} dropTargetInfo.type - ドロップターゲットの要素タイプ。
   * @param {number} dropTargetInfo.index - ドロップターゲットのインデックス。
   * @param {number} [dropTargetInfo.catIndex] - リンクの場合、親カテゴリのインデックス。
   */
  _handleDrop(e, dropTargetInfo) {
    e.preventDefault();
    e.stopPropagation();

    if (!this.draggedInfo) return;

    // ドロップターゲットがプレースホルダー自身なら何もしない
    if (e.currentTarget.classList.contains('drag-placeholder')) return;
    
    let fromIndex = this.draggedInfo.index;
    let toIndex = dropTargetInfo.index;
    
    // 異なるカテゴリ間でのリンク移動は許可しない
    if (this.draggedInfo.type === 'link' && this.draggedInfo.catIndex !== dropTargetInfo.catIndex) {
        this._cleanupDragStyles(); // クリーンアップのみ行って終了
        return;
    }

    // toIndexをプレースホルダーの位置に基づいて再計算する
    // e.currentTarget.parentNode は .link-list または #app-container
    const children = Array.from(e.currentTarget.parentNode.children);
    const placeholderIndex = children.indexOf(this.placeholder);
    
    if (placeholderIndex !== -1) {
       toIndex = placeholderIndex;
       // ドラッグ元の要素がプレースホルダーより前にあった場合、
       // 削除することでインデックスが1つずれるため調整
       if (fromIndex < placeholderIndex) {
           // fromIndexがplaceholderIndexより小さい場合、元の要素が削除されることで、
           // toIndexの計算時に1つずれてしまうのを補正する。
           // 例: [A,B,C,D], AをCの後に移動。placeholderIndex=3。fromIndex=0。
           // toIndex=3-(1)=2 (0番目のAが削除されるとB,C,Dは0,1,2に詰まるため)
           // (Aが削除された後の配列での新しいインデックス)
           toIndex--; // 0番目の要素が削除されると、それ以降の要素のインデックスが1つ減るため
       }
    }

    if (this.draggedInfo.type === 'category') {
        if (fromIndex !== toIndex) {
            this.dataManager.moveCategory(fromIndex, toIndex);
        }
    } else if (this.draggedInfo.type === 'link') {
        // 同じカテゴリ内でリンクを移動
        if (fromIndex !== toIndex) { // fromIndexとtoIndexが異なる場合のみ移動
            this.dataManager.moveLink(this.draggedInfo.catIndex, fromIndex, toIndex);
        }
    }
    
    this._cleanupDragStyles(); // ドラッグスタイルとプレースホルダーをクリーンアップ
    this.render(); // UIを即座に更新して変更を反映
  }

  /**
   * ドラッグ操作が終了したときに呼び出されます。
   * @private
   * @param {DragEvent} e - ドラッグイベントオブジェクト。
   */
  _handleDragEnd(e) {
    this._cleanupDragStyles(); // クリーンアップ処理を実行
  }
  
  /**
   * ドラッグアンドドロップ操作に関連する一時的なスタイルと要素をクリーンアップします。
   * @private
   */
  _cleanupDragStyles() {
    // ドラッグ中の要素のスタイルを戻す
    const draggingElement = document.querySelector('.dragging');
    if (draggingElement) {
        draggingElement.classList.remove('dragging');
    }
    
    // プレースホルダーをDOMから削除
    if (this.placeholder) {
      this.placeholder.remove();
      this.placeholder = null; // 参照をクリア
    }
    
    this.draggedInfo = null; // ドラッグ情報をリセット
  }
}