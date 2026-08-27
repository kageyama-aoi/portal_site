/**
 * @file ui.js
 * @brief DOM の描画とユーザーイベントの処理、およびダイアログとの連携を管理するクラス。
 * @module UI
 */

import { verificationCode } from './workflowVersion.js';

/**
 * @typedef {object} Link
 * @property {string} id - リンクのユニークID。
 * @property {string} title - リンクのタイトル。
 * @property {string} url - リンクのURL。
 * @property {string} icon - リンクのアイコン（絵文字など）。
 * @property {string} badge - リンクのバッジタイプ。
 * @property {string} memo - リンクのメモ。
 * @property {string[]} tags - リンクが属するタグ（グルーピングの唯一の手段。0件以上）。
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
   * @property {string|null} editingLinkId - 編集中のリンクのID。
   */
  editingLinkId = null;
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
   * @property {import('./distributionLog.js').DistributionLogManager|null} distributionLog
   *   作業フロー出力の発行履歴（配布台帳）。app.js で設定。
   */
  distributionLog = null;
  /**
   * @property {object|null} distributionLogDialog - 発行履歴ダイアログ。app.js で設定。
   */
  distributionLogDialog = null;
  /**
   * @property {TagManager|null} tagManager
   */
  tagManager = null;
  /**
   * @property {string} searchQuery - 現在の検索キーワード
   */
  searchQuery = '';
  /**
   * @property {string[]} selectedTags - 選択中のタグフィルタ
   */
  selectedTags = [];
  /**
   * @property {Set<string>} collapsedTagGroups - ユーザーが手動で折りたたんだタグ別グループの
   * ラベル（タグ名／「タグなし」）。render() のたびに details.open を毎回 true にリセットせず、
   * ここを参照して直前の開閉状態を復元する。
   */
  collapsedTagGroups = new Set();
  /**
   * @property {string} freqFilter - 選択中の頻度フィルタ
   */
  freqFilter = '';

  /**
   * UIの新しいインスタンスを作成します。
   * @param {DataManager} dataManager - データ管理オブジェクト。
   * @param {ConfigManager} configManager - 設定管理オブジェクト。
   * @param {LinkDialog} linkDialog - リンク編集ダイアログオブジェクト。
   * @param {BulkLinkDialog} bulkLinkDialog - リンク一括追加ダイアログオブジェクト。
   */
  constructor(dataManager, configManager, linkDialog, bulkLinkDialog) {
    this.dataManager = dataManager;
    this.configManager = configManager;
    this.linkDialog = linkDialog;
    this.bulkLinkDialog = bulkLinkDialog;
    this.isEditMode = false;
  }
  /**
   * UIの初期化を行います。イベントリスナーを設定し、初回描画を行います。
   */
  init() {
    this.container = document.getElementById('app-container');
    this.viewMode = localStorage.getItem(UI.VIEW_MODE_KEY) || 'card';
    this._initViewBtnOrder();
    this._updateViewButtons();
    this.initEventListeners();
    this._updateTagPanel();
    this.render();
  }

  /**
   * 表示切替ボタンの並び順を localStorage から復元し、D&D で並び替え可能にします。
   * @private
   */
  _initViewBtnOrder() {
    const group = document.querySelector('.view-btn-group');
    if (!group) return;

    // 保存済みの順序を復元
    const saved = localStorage.getItem('portalViewBtnOrder');
    if (saved) {
      try {
        JSON.parse(saved).forEach(id => {
          const btn = document.getElementById(id);
          if (btn) group.appendChild(btn);
        });
      } catch (_) {}
    }

    // D&D で並び替え
    let dragging = null;
    group.querySelectorAll('.view-btn').forEach(btn => {
      btn.draggable = true;
      btn.addEventListener('dragstart', () => {
        dragging = btn;
        setTimeout(() => btn.classList.add('view-btn-dragging'), 0);
      });
      btn.addEventListener('dragend', () => {
        btn.classList.remove('view-btn-dragging');
        dragging = null;
        const order = [...group.querySelectorAll('.view-btn')].map(b => b.id);
        localStorage.setItem('portalViewBtnOrder', JSON.stringify(order));
      });
      btn.addEventListener('dragover', e => {
        e.preventDefault();
        if (!dragging || dragging === btn) return;
        const rect = btn.getBoundingClientRect();
        const after = e.clientX > rect.left + rect.width / 2;
        group.insertBefore(dragging, after ? btn.nextSibling : btn);
      });
    });
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
      this._updateTagPanel();
      document.getElementById('addLinkBtn').style.display = this.isEditMode ? 'block' : 'none';
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

    document.getElementById('addLinkBtn').addEventListener('click', () => this.linkDialog.open());

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





  toggleAll(isOpen) {
    const details = document.querySelectorAll('details');
    details.forEach(d => d.open = isOpen);
  }

  /**
   * 与えられたリンク一覧を新規タブでまとめて開きます（タググループの「一括で開く」ボタンから使用）。
   * @param {Array<object>} links
   */
  openGroupLinks(links) {
    let blockedCount = 0;
    links.forEach(link => {
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
      spreadsheet: 'Sheet',
      website: 'Web',
      drive: 'Drive',
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
    const portalId = this.configManager.getActivePortalId();
    const usedTags = this.searchManager.getAllTags();
    const registeredTags = this.tagManager ? this.tagManager.getRegisteredTags(portalId) : [];
    // リンクにまだ紐づいていない（登録だけ済んだ）タグは見た目を区別する
    const emptyTagSet = new Set(registeredTags.filter(t => !usedTags.includes(t)));
    const tags = Array.from(new Set([...usedTags, ...registeredTags])).sort((a, b) => a.localeCompare(b, 'ja'));

    const row = document.getElementById('tagFilterRow');
    const chips = document.getElementById('tagFilterChips');
    const clearBtn = document.getElementById('tagFilterClearBtn');
    const addBtn = document.getElementById('tagAddBtn');

    addBtn.style.display = this.isEditMode ? 'inline-flex' : 'none';

    // 編集モード中は「タグ作成」ボタンを出したいので、タグが0件でも行自体は隠さない
    if (tags.length === 0 && !this.isEditMode) {
      row.style.display = 'none';
      return;
    }
    row.style.display = 'flex';
    chips.innerHTML = '';
    tags.forEach(tag => {
      const isEmpty = emptyTagSet.has(tag);
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'tag-chip' + (this.selectedTags.includes(tag) ? ' active' : '') + (isEmpty ? ' tag-chip-empty' : '');
      btn.textContent = tag;
      if (isEmpty) btn.title = 'まだリンクが紐づいていないタグです';
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

    if (!addBtn._hasListener) {
      addBtn._hasListener = true;
      addBtn.addEventListener('click', () => {
        const name = prompt('新しいタグ名を入力してください（まだリンクを付けなくても作成できます）:');
        if (name && this.tagManager) {
          const added = this.tagManager.addTag(this.configManager.getActivePortalId(), name);
          if (added) this._updateTagPanel();
        }
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

    this._renderModeHeader();
    this._renderGroupedByTag(this.dataManager.getData());
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
   * @returns {HTMLDivElement} 作成されたリンクカードのラッパー要素。
   */
  _createLinkCard(link) {
      const wrapper = document.createElement('div');
      wrapper.className = 'link-card-wrapper';

      const isLocal = link.url && link.url.startsWith('opendir:');
      const a = document.createElement('a');
      a.className = `link-card ${this.isEditMode ? 'disabled' : ''}${isLocal ? ' link-local' : ''}`;
      a.href = link.url;
      if (!isLocal) a.target = '_blank';
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
      if (this.isEditMode) this._makeTitleEditable(titleSpan, link);
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

      if (isLocal) {
        const pathDiv = document.createElement('div');
        pathDiv.className = 'link-local-path';
        pathDiv.textContent = link.url.replace('opendir:', '');
        contentArea.appendChild(pathDiv);
      }

      a.appendChild(iconArea);
      a.appendChild(contentArea);
      wrapper.appendChild(a);

      // ローカルリンクのクリップボードコピーボタン（閲覧モード時）
      if (isLocal && !this.isEditMode) {
        const copyBtn = document.createElement('button');
        copyBtn.className = 'local-copy-btn';
        copyBtn.title = 'パスをクリップボードにコピー';
        copyBtn.innerHTML = '<span class="icon icon-xs">content_copy</span>';
        copyBtn.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          const localPath = link.url.replace('opendir:', '');
          navigator.clipboard.writeText(localPath).then(() => {
            copyBtn.innerHTML = '<span class="icon icon-xs">check</span>';
            setTimeout(() => { copyBtn.innerHTML = '<span class="icon icon-xs">content_copy</span>'; }, 1500);
          });
        });
        wrapper.appendChild(copyBtn);
      }

      // 編集モード時のカードアクションボタン
      if (this.isEditMode) {
        const cardActions = document.createElement('div');
        cardActions.className = 'card-actions';

        const editBtn = this._createCardActionButton('<span class="icon icon-sm">edit</span>', () => this.linkDialog.open(link.id), 'リンクを編集');
        const delBtn = this._createCardActionButton('<span class="icon icon-sm">delete</span>', () => {
           if (confirm(`リンク「${link.title}」を削除しますか？`)) {
             this.dataManager.deleteLink(link.id);
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
    // 「すべて開く/閉じる」は <details> で開閉するグループがある表示（タグ別グループの
    // card/table表示、ワークフローカードのworkflow表示）にのみ意味を持つ。
    // 思い出しモードは <details> を使わない固定セクションなので対象外。
    const hasCollapsibleGroups = this.viewMode === 'card' || this.viewMode === 'table' || this.viewMode === 'workflow';
    document.getElementById('expandBtnGroup').style.display = hasCollapsibleGroups ? 'inline-flex' : 'none';
  }

  // ─────────────────────────────────────────────────────────
  // 検索結果モード
  // ─────────────────────────────────────────────────────────

  /**
   * 検索結果をタグ別グループで描画します。
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

    this._renderGroupedByTag(results.map(r => r.link));
  }

  // ─────────────────────────────────────────────────────────
  // カード表示・テーブル表示: タグ別グループ描画（共通）
  // ─────────────────────────────────────────────────────────

  /**
   * カード/テーブル表示共通のヘッダー（何を表示しているかの案内）を描画します。
   * @private
   */
  _renderModeHeader() {
    const isTable = this.viewMode === 'table';
    const header = document.createElement('div');
    header.className = 'table-mode-header';
    header.innerHTML = `
      <div class="table-mode-header-text">
        <span class="icon icon-md" style="color:var(--primary)">${isTable ? 'table_rows' : 'grid_view'}</span>
        <div>
          <div class="table-mode-title">${isTable ? 'テーブル表示' : 'カード表示'}</div>
          <div class="table-mode-hint">タグごとに整理されたリンク集です。タグはリンク編集画面の「タグ」欄で設定でき、1つのリンクを複数のタグに登録すると、それぞれのグループに表示されます。</div>
        </div>
      </div>
    `;
    if (this.isEditMode) {
      const addBtn = this._createActionButton(
        '<span class="icon icon-sm">add_link</span> リンク追加',
        'action-btn btn-add table-mode-add-btn',
        () => this.linkDialog.open(),
        'このビューに新しいリンクを追加'
      );
      header.appendChild(addBtn);
    }
    this.container.appendChild(header);
  }

  /**
   * リンク配列をタグ単位にグループ化します。
   * @private
   * @param {Array<object>} links
   * @returns {{grouped: Map<string, object[]>, untagged: object[]}}
   */
  _groupLinksByTag(links) {
    const grouped = new Map();
    const untagged = [];
    links.forEach(link => {
      // 同じタグを誤って重複入力していても（コピペミス等）、同じグループに
      // 同じリンクを二重表示しないよう重複を除いておく。
      const tags = Array.from(new Set(link.tags || []));
      if (tags.length === 0) {
        untagged.push(link);
      } else {
        tags.forEach(tag => {
          if (!grouped.has(tag)) grouped.set(tag, []);
          grouped.get(tag).push(link);
        });
      }
    });
    return { grouped, untagged };
  }

  /**
   * 与えられたリンク一覧をタグ単位に再グループ化して描画します。
   * 複数のタグを持つリンクは複数のグループに重複して表示されます。
   * カード/テーブルどちらの見た目にするかは現在の viewMode に従います。
   * @private
   * @param {Array<object>} links
   */
  _renderGroupedByTag(links) {
    if (links.length === 0) return;

    const { grouped, untagged } = this._groupLinksByTag(links);

    if (grouped.size === 0) {
      const empty = document.createElement('div');
      empty.className = 'table-group-empty';
      empty.innerHTML = `
        <span class="icon" style="font-size:2rem;color:var(--text-sub)">sell</span>
        <p>タグが設定されたリンクがまだありません。<br>リンク編集画面の「タグ」欄で設定すると、ここにグループとして表示されます。</p>
      `;
      this.container.appendChild(empty);
      return;
    }

    const sortedTags = Array.from(grouped.keys()).sort((a, b) => a.localeCompare(b, 'ja'));
    sortedTags.forEach(tag => {
      this._renderTagGroupSection(tag, grouped.get(tag));
    });

    if (untagged.length > 0) {
      this._renderTagGroupSection('タグなし', untagged, true);
    }
  }

  /**
   * タグ別グループの1グループ分（見出し + カード/テーブル行）を描画します。
   * @private
   * @param {string} label - グループ見出し（タグ名）。
   * @param {Array<object>} links - グループに属するリンク。
   * @param {boolean} [isUntagged=false] - タグなしグループかどうか。
   */
  _renderTagGroupSection(label, links, isUntagged = false) {
    const details = document.createElement('details');
    details.open = !this.collapsedTagGroups.has(label);
    details.className = 'tag-group-section';
    // ユーザーが手動で開閉した状態（クリック操作、または toggleAll() による
    // 一括開閉のどちらでも 'toggle' イベントは発火する）を記憶しておき、
    // 次の render() で details.open を勝手に戻さないようにする。
    details.addEventListener('toggle', () => {
      if (details.open) {
        this.collapsedTagGroups.delete(label);
      } else {
        this.collapsedTagGroups.add(label);
      }
    });

    const summary = document.createElement('summary');
    const summaryContent = document.createElement('div');
    summaryContent.className = 'summary-content';
    summaryContent.innerHTML = `
      <span class="icon icon-sm" style="color:${isUntagged ? 'var(--text-sub)' : 'var(--color-portal)'}">${isUntagged ? 'label_off' : 'sell'}</span>
      ${this._escapeHtml(label)}
      <span class="tag-group-count">${links.length}件</span>
    `;

    const groupActions = document.createElement('div');
    groupActions.className = 'group-actions';
    if (!this.isEditMode) {
      const openBtn = this._createActionButton('<span class="icon icon-sm">open_in_new</span> 一括で開く', 'action-btn btn-open', () => this.openGroupLinks(links));
      openBtn.title = 'このグループのリンクをすべて開く';
      groupActions.appendChild(openBtn);
    } else {
      const addBtn = this._createActionButton(
        '<span class="icon icon-sm">add_link</span> このグループに追加',
        'action-btn btn-add',
        () => this.linkDialog.open(null, isUntagged ? null : label)
      );
      addBtn.title = isUntagged ? '新しいリンクを追加' : `「${label}」タグ付きで新しいリンクを追加`;
      groupActions.appendChild(addBtn);
    }
    summaryContent.appendChild(groupActions);
    summary.appendChild(summaryContent);

    const chevron = document.createElement('span');
    chevron.className = 'icon icon-lg summary-chevron';
    chevron.textContent = 'expand_more';
    summary.appendChild(chevron);
    details.appendChild(summary);

    const list = document.createElement('div');
    list.className = this.viewMode === 'table' ? 'link-list link-list-table' : 'link-list';
    links.forEach(link => {
      const el = this.viewMode === 'table' ? this._createTableRow(link) : this._createLinkCard(link);
      list.appendChild(el);
    });
    details.appendChild(list);

    this.container.appendChild(details);
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
      () => 'rare'
    );
  }

  /**
   * @private - 思い出しモードのセクションを描画します。
   */
  _renderMemorySection(title, icon, color, links, subLabelFn) {
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
      links.forEach((link) => {
        if (!link) return;
        const subLabel = subLabelFn(link);
        const card = this._createMemoryCard(link, subLabel);
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
  _createMemoryCard(link, subLabel) {
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

    const headerBtns = document.createElement('div');
    headerBtns.style.cssText = 'display:flex; gap:8px;';

    const pdfBtn = document.createElement('button');
    pdfBtn.type = 'button';
    pdfBtn.className = 'secondary-btn';
    pdfBtn.innerHTML = '<span class="icon icon-sm">picture_as_pdf</span> PDF出力';
    pdfBtn.style.cssText = 'font-size:0.85rem;';
    pdfBtn.addEventListener('click', () => this._openExportSelectDialog('pdf'));
    headerBtns.appendChild(pdfBtn);

    const htmlBtn = document.createElement('button');
    htmlBtn.type = 'button';
    htmlBtn.className = 'secondary-btn';
    htmlBtn.innerHTML = '<span class="icon icon-sm">html</span> HTML出力';
    htmlBtn.title = 'サーバー不要・コピー/リンクボタン付きの単体HTMLとして書き出します';
    htmlBtn.style.cssText = 'font-size:0.85rem;';
    htmlBtn.addEventListener('click', () => this._openExportSelectDialog('html'));
    headerBtns.appendChild(htmlBtn);

    if (this.distributionLogDialog) {
      const logBtn = document.createElement('button');
      logBtn.type = 'button';
      logBtn.className = 'secondary-btn';
      logBtn.innerHTML = '<span class="icon icon-sm">history</span> 発行履歴';
      logBtn.title = 'どの版をいつ誰に配ったかの記録（この端末内のみ）';
      logBtn.style.cssText = 'font-size:0.85rem;';
      logBtn.addEventListener('click', () => this.distributionLogDialog.open());
      headerBtns.appendChild(logBtn);
    }

    const editBtn = document.createElement('button');
    editBtn.type = 'button';
    editBtn.className = 'secondary-btn';
    editBtn.innerHTML = '<span class="icon icon-sm">edit</span> フローを管理';
    editBtn.style.cssText = 'font-size:0.85rem;';
    editBtn.addEventListener('click', () => {
      if (this.workflowDialog) this.workflowDialog.open();
    });
    headerBtns.appendChild(editBtn);

    header.appendChild(headerBtns);

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

    // 並び順は WorkflowManager.getWorkflows() 側でタイトルの五十音順に統一済み。
    // ここで独自に頻度順などへ並べ替えないことで、フロー管理ダイアログや
    // 出力先選択ダイアログと表示順が食い違わないようにする。
    workflows.forEach(wf => {
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
          <span class="workflow-card-title-text">${this._escapeHtml(wf.title)}</span>
          <span class="wf-freq-badge wf-freq-${wf.freq}">${freqLabel}</span>
          ${wf.description ? `<span class="workflow-card-desc">${this._escapeHtml(wf.description)}</span>` : ''}
          ${tags ? `<div class="wf-tags-row">${tags}</div>` : ''}
        </div>
        <span class="icon icon-lg summary-chevron">expand_more</span>
      `;
      card.appendChild(summary);

      const stepsDiv = document.createElement('div');
      stepsDiv.className = 'workflow-steps';

      if (wf.steps.length === 0) {
        stepsDiv.innerHTML = '<div style="padding:12px 20px;color:var(--text-sub);font-size:0.85rem;">ステップがありません。</div>';
      } else {
        let dragSrcIdx = null;

        wf.steps.forEach((step, stepIndex) => {
          const stepRow = document.createElement('div');
          stepRow.className = 'workflow-step-row';

          // 編集モード: D&D並び替え
          if (this.isEditMode) {
            stepRow.draggable = true;
            const handle = document.createElement('span');
            handle.className = 'icon icon-xs workflow-step-drag-handle';
            handle.textContent = 'drag_indicator';
            stepRow.appendChild(handle);

            stepRow.addEventListener('dragstart', (e) => {
              dragSrcIdx = stepIndex;
              stepRow.classList.add('wf-step-dragging');
              e.dataTransfer.effectAllowed = 'move';
            });
            stepRow.addEventListener('dragend', () => {
              stepRow.classList.remove('wf-step-dragging');
              stepsDiv.querySelectorAll('.wf-step-drag-over').forEach(el => el.classList.remove('wf-step-drag-over'));
            });
            stepRow.addEventListener('dragover', (e) => {
              e.preventDefault();
              e.dataTransfer.dropEffect = 'move';
              stepsDiv.querySelectorAll('.wf-step-drag-over').forEach(el => el.classList.remove('wf-step-drag-over'));
              if (dragSrcIdx !== stepIndex) stepRow.classList.add('wf-step-drag-over');
            });
            stepRow.addEventListener('drop', (e) => {
              e.preventDefault();
              if (dragSrcIdx === null || dragSrcIdx === stepIndex) return;
              const wfData = this.workflowManager.getWorkflow(portalId, wf.id);
              const steps = [...wfData.steps];
              const [moved] = steps.splice(dragSrcIdx, 1);
              steps.splice(stepIndex, 0, moved);
              steps.forEach((s, i) => { s.step = i + 1; });
              this.workflowManager.updateWorkflow(portalId, wf.id, { steps });
              dragSrcIdx = null;
              this.render();
            });
          }

          const num = document.createElement('div');
          num.className = 'workflow-step-num';
          num.textContent = step.step;
          stepRow.appendChild(num);

          const content = document.createElement('div');
          content.className = 'workflow-step-content';

          // タイトル行
          const titleRow = document.createElement('div');
          titleRow.className = 'workflow-step-title-row';

          const stepTitle = document.createElement('div');
          stepTitle.className = 'workflow-step-title';

          if (this.isEditMode) {
            stepTitle.contentEditable = 'true';
            stepTitle.textContent = step.title;
            stepTitle.addEventListener('blur', () => {
              const newTitle = stepTitle.textContent.trim();
              if (newTitle !== step.title) {
                this.workflowManager.updateStep(portalId, wf.id, stepIndex, { title: newTitle });
              }
            });
            stepTitle.addEventListener('keydown', (e) => {
              if (e.key === 'Enter') { e.preventDefault(); stepTitle.blur(); }
            });
          } else {
            stepTitle.textContent = step.title;
          }
          titleRow.appendChild(stepTitle);

          // メモ展開ボタン（メモ・プロンプトあり or 編集モード）
          let expandBtn = null;
          const hasVisiblePrompt = step.prompt && (step.promptType || 'prompt') !== 'none';
          if (step.memo || hasVisiblePrompt || this.isEditMode) {
            expandBtn = document.createElement('button');
            expandBtn.type = 'button';
            expandBtn.className = 'workflow-step-expand-btn';
            expandBtn.innerHTML = '<span class="icon icon-xs">expand_more</span>';
            expandBtn.title = 'メモを表示/非表示';
            expandBtn.addEventListener('click', () => {
              stepRow.classList.toggle('wf-expanded');
              expandBtn.querySelector('.icon').textContent =
                stepRow.classList.contains('wf-expanded') ? 'expand_less' : 'expand_more';
            });
            titleRow.appendChild(expandBtn);

            // 編集モードでも、既にメモ/プロンプトがあるステップだけ自動展開する。
            // 空のステップまで一律展開すると、1行だけの単純な手順でも
            // 空のメモ入力欄・2行のプロンプト欄が常に表示されて縦に間延びしてしまうため。
            if (this.isEditMode && (step.memo || step.prompt)) {
              stepRow.classList.add('wf-expanded');
              expandBtn.querySelector('.icon').textContent = 'expand_less';
            }
          }

          content.appendChild(titleRow);

          // 詳細パネル（メモ）
          const detailsPanel = document.createElement('div');
          detailsPanel.className = 'workflow-step-details';

          if (this.isEditMode) {
            const memoInput = document.createElement('input');
            memoInput.type = 'text';
            memoInput.className = 'workflow-step-memo-input';
            memoInput.placeholder = 'メモ（補足説明）';
            memoInput.value = step.memo || '';
            memoInput.addEventListener('blur', () => {
              this.workflowManager.updateStep(portalId, wf.id, stepIndex, { memo: memoInput.value });
            });
            detailsPanel.appendChild(memoInput);

            const promptInput = document.createElement('textarea');
            promptInput.className = 'workflow-step-prompt-input';
            promptInput.rows = 2;
            promptInput.placeholder = 'AIプロンプト（省略可・出力時にコピーボタンが付きます）';
            promptInput.value = step.prompt || '';
            promptInput.addEventListener('blur', () => {
              this.workflowManager.updateStep(portalId, wf.id, stepIndex, { prompt: promptInput.value });
            });
            detailsPanel.appendChild(promptInput);
          } else {
            if (step.memo) {
              const memo = document.createElement('div');
              memo.className = 'workflow-step-memo';
              memo.innerHTML = `<span class="icon icon-xs">lightbulb</span> ${this._escapeHtml(step.memo)}`;
              detailsPanel.appendChild(memo);
            }
            if (hasVisiblePrompt) {
              const typeMeta = this._promptTypeMeta(step.promptType);
              const promptBlock = document.createElement('div');
              promptBlock.className = `workflow-step-prompt ${typeMeta.cls}`;
              promptBlock.innerHTML = `
                <div class="workflow-step-prompt-header">
                  <span class="icon icon-xs">${typeMeta.icon}</span> ${typeMeta.label}
                  <button type="button" class="wf-copy-btn" title="${typeMeta.label}をコピー">
                    <span class="icon icon-xs">content_copy</span> コピー
                  </button>
                </div>
                <pre class="workflow-step-prompt-text wf-clamp"></pre>
                <button type="button" class="wf-prompt-toggle-btn" style="display:none;">▼ 続きを見る</button>
              `;
              const promptTextEl = promptBlock.querySelector('.workflow-step-prompt-text');
              promptTextEl.textContent = step.prompt;
              const copyBtn = promptBlock.querySelector('.wf-copy-btn');
              copyBtn.addEventListener('click', () => this._copyToClipboard(step.prompt, copyBtn));
              const clampToggleBtn = promptBlock.querySelector('.wf-prompt-toggle-btn');
              clampToggleBtn.addEventListener('click', () => {
                const stillClamped = promptTextEl.classList.toggle('wf-clamp');
                clampToggleBtn.textContent = stillClamped ? '▼ 続きを見る' : '▲ 折りたたむ';
              });
              // 折りたたみパネルは初期状態で非表示のため、展開された時点で長さを判定する
              if (expandBtn) {
                expandBtn.addEventListener('click', () => {
                  if (stepRow.classList.contains('wf-expanded') && promptTextEl.scrollHeight > promptTextEl.clientHeight + 1) {
                    clampToggleBtn.style.display = 'inline-block';
                  }
                });
              }
              if (stepRow.classList.contains('wf-expanded') && promptTextEl.scrollHeight > promptTextEl.clientHeight + 1) {
                clampToggleBtn.style.display = 'inline-block';
              }
              detailsPanel.appendChild(promptBlock);
            }
          }

          content.appendChild(detailsPanel);
          stepRow.appendChild(content);

          if (step.linkId) {
            const found = this.searchManager?.findLinkById(step.linkId);
            if (found) {
              const isLocal = found.link.url && found.link.url.startsWith('opendir:');
              const linkBtn = document.createElement('a');
              linkBtn.className = 'workflow-step-link-btn' + (isLocal ? ' wf-link-local' : '');
              linkBtn.href = found.link.url;
              if (!isLocal) linkBtn.target = '_blank';
              linkBtn.innerHTML = `<span class="icon icon-sm">open_in_new</span> ${this._escapeHtml(found.link.title)}`;
              if (found.link.memo) {
                linkBtn.dataset.tooltip = found.link.memo;
                linkBtn.classList.add('has-tooltip');
              }
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
   * PDF/HTML出力の対象とする作業フローを選択するダイアログを開きます。
   * 「どの作業フローを出力するか」を指定しないまま全件出力すると
   * 配布資料としての意味が薄くなるため、出力前に必ず対象を選ばせます。
   * @private
   * @param {'pdf'|'html'} format
   */
  _openExportSelectDialog(format) {
    const portalId = this.configManager.getActivePortalId();
    const workflows = this.workflowManager ? this.workflowManager.getWorkflows(portalId) : [];

    if (workflows.length === 0) {
      alert('エクスポートするワークフローがありません。');
      return;
    }

    const dialog = document.getElementById('wfExportDialog');
    const content = document.getElementById('wfExportDialogContent');
    const freqLabel = { daily: '毎日', weekly: '週次', monthly: '月次', rare: 'たまに' };
    const formatLabel = format === 'pdf' ? 'PDF' : 'HTML';

    const itemsHtml = workflows.map((wf, i) => `
      <label class="wf-export-item">
        <input type="radio" name="wfExportRadio" class="wf-export-check" value="${wf.id}" ${i === 0 ? 'checked' : ''}>
        <span class="wf-export-item-title">${this._escapeHtml(wf.title)}</span>
        <span class="wf-export-item-rev">v${wf.rev || 1}</span>
        <span class="wf-freq-badge wf-freq-${wf.freq}">${freqLabel[wf.freq] || ''}</span>
      </label>
    `).join('');

    const prefs = this.distributionLog ? this.distributionLog.getExportPrefs() : { reviewDue: '', sourceHint: '' };
    const recents = this.distributionLog ? this.distributionLog.getRecentRecipients() : [];
    const recentsOptions = recents.map(r => `<option value="${this._escapeHtml(r)}">`).join('');

    content.innerHTML = `
      <h3 style="margin:0 0 4px;">${formatLabel}出力する作業フローを選択</h3>
      <p style="margin:0 0 12px;font-size:0.82rem;color:var(--text-sub);">出力できるのは1つの作業フローのみです。</p>
      <div class="wf-export-list">${itemsHtml}</div>

      <div class="wf-export-meta">
        <label class="wf-export-field">
          <span>配布先メモ <span class="wf-export-opt">（任意・この端末の記録だけに残ります）</span></span>
          <input type="text" id="wfExportRecipient" list="wfExportRecentList" autocomplete="off"
                 placeholder="誰に渡すか一言（例: 営業部 田中さん）">
          <datalist id="wfExportRecentList">${recentsOptions}</datalist>
        </label>
        <div class="wf-export-row">
          <label class="wf-export-field">
            <span>次回見直し予定 <span class="wf-export-opt">（任意）</span></span>
            <input type="month" id="wfExportReviewDue" value="${this._escapeHtml(prefs.reviewDue || '')}">
          </label>
          <label class="wf-export-field">
            <span>最新版の入手先 <span class="wf-export-opt">（任意・配布物に表示されます）</span></span>
            <input type="text" id="wfExportSourceHint" autocomplete="off"
                   value="${this._escapeHtml(prefs.sourceHint || '')}"
                   placeholder="例: 共有フォルダ「作業手順」／担当 総務 佐藤">
          </label>
        </div>
      </div>

      <div style="display:flex; justify-content:flex-end; gap:8px; margin-top:12px;">
        <button type="button" id="wfExportCancelBtn" class="secondary-btn">キャンセル</button>
        <button type="button" id="wfExportConfirmBtn" class="primary-btn">${formatLabel}を出力</button>
      </div>
    `;

    document.getElementById('wfExportCancelBtn').addEventListener('click', () => dialog.close());
    document.getElementById('wfExportConfirmBtn').addEventListener('click', () => {
      const checked = content.querySelector('.wf-export-check:checked');
      if (!checked) {
        alert('出力する作業フローを1つ選択してください。');
        return;
      }
      const wf = workflows.find(w => w.id === checked.value);
      const recipientNote = document.getElementById('wfExportRecipient').value.trim();
      const reviewDue = document.getElementById('wfExportReviewDue').value;
      const sourceHint = document.getElementById('wfExportSourceHint').value.trim();

      if (this.distributionLog) {
        this.distributionLog.setExportPrefs({ reviewDue, sourceHint });
      }

      const exportMeta = { reviewDue, sourceHint };
      dialog.close();

      if (format === 'pdf') {
        this._exportWorkflowAsPdf([checked.value], exportMeta);
      } else {
        this._exportWorkflowAsHtml([checked.value], exportMeta);
      }

      // 発行履歴に1件記録（配布先メモは配布物には含めない）
      if (this.distributionLog && wf) {
        const code = verificationCode(wf.rev || 1, wf.contentHash, wf.updatedAt);
        this.distributionLog.addEntry({
          portalId,
          workflowId: wf.id,
          title: wf.title,
          rev: wf.rev || 1,
          code,
          format,
          recipientNote
        });
      }
    });

    dialog.showModal();
  }

  /**
   * ワークフロービューの内容をPDFエクスポート用HTMLとして新規ウィンドウで開きます。
   * ブラウザの印刷機能でPDFとして保存可能です。
   * @private
   * @param {string[]} [selectedIds] - 出力対象のワークフローID。省略時は全件。
   */
  _exportWorkflowAsPdf(selectedIds, exportMeta = {}) {
    const portalId = this.configManager.getActivePortalId();
    const portal = this.configManager.getActivePortal();
    let workflows = this.workflowManager ? this.workflowManager.getWorkflows(portalId) : [];
    if (selectedIds) workflows = workflows.filter(w => selectedIds.includes(w.id));

    if (workflows.length === 0) {
      alert('エクスポートするワークフローがありません。');
      return;
    }

    const freqLabel = { daily: '毎日', weekly: '週次', monthly: '月次', rare: 'たまに' };
    const esc = (s) => this._escapeHtml(s);
    const sourceHint = (exportMeta && exportMeta.sourceHint) ? String(exportMeta.sourceHint) : '';

    const workflowsHtml = workflows.map(wf => {
      const rev = wf.rev || 1;
      const code = verificationCode(rev, wf.contentHash, wf.updatedAt);
      const updatedDate = wf.updatedAt
        ? new Date(wf.updatedAt).toLocaleDateString('ja-JP')
        : new Date().toLocaleDateString('ja-JP');
      const freq = freqLabel[wf.freq] || '';
      const tags = (wf.tags || []).map(t => `<span class="tag">${esc(t)}</span>`).join('');

      const stepsHtml = wf.steps.map(step => {
        // 手順書としては「手順名」が主役なので、リンクは資料名を控えめに示す程度に留める。
        // ローカルパスも生のパスをそのまま前面に出さず、資料名を主表示・パスは小さい補足にする。
        let linkHtml = '';
        if (step.linkId) {
          const found = this.searchManager?.findLinkById(step.linkId);
          if (found) {
            const isLocal = found.link.url?.startsWith('opendir:');
            if (isLocal) {
              const path = found.link.url.replace('opendir:', '');
              linkHtml = `<div class="link-name">📁 ${esc(found.link.title)}</div><div class="link-path">${esc(path)}</div>`;
            } else {
              linkHtml = `<div class="link-name">🔗 <a href="${esc(found.link.url)}" class="link-url">${esc(found.link.title)}</a></div>`;
            }
          }
        }
        return `<tr>
          <td class="step-num">${step.step}</td>
          <td class="step-body">
            <div class="step-title">${esc(step.title)}</div>
            ${step.memo ? `<div class="step-memo">${esc(step.memo)}</div>` : ''}
          </td>
          <td class="step-resource">${linkHtml}</td>
        </tr>`;
      }).join('');

      return `<div class="workflow">
        <div class="wf-header">
          <h2>${esc(wf.title)}</h2>
          ${freq ? `<span class="freq-badge">${freq}</span>` : ''}
          <span class="wf-version">v${rev} ・ ${esc(updatedDate)} ・ ${esc(code)}</span>
        </div>
        ${wf.description ? `<p class="wf-desc">${esc(wf.description)}</p>` : ''}
        ${tags ? `<div class="wf-tags">${tags}</div>` : ''}
        <table class="steps-table"><tbody>${stepsHtml}</tbody></table>
      </div>`;
    }).join('');

    const title = portal?.title || '作業フロー';
    const subtitle = portal?.subtitle || '';
    const today = new Date().toLocaleDateString('ja-JP');

    const html = `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <title>${esc(title)} - 作業フロー</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Hiragino Sans', 'Yu Gothic', 'Meiryo', sans-serif; font-size: 11pt; color: #1B2421; background: #fff; padding: 20mm 15mm; }
    h1 { font-size: 18pt; margin-bottom: 4px; }
    .subtitle { font-size: 10pt; color: #57645E; margin-bottom: 6px; }
    .export-date { font-size: 9pt; color: #8B968F; margin-bottom: 6px; }
    .dist-hint { font-size: 9pt; color: #57645E; margin-bottom: 24px; }
    .workflow { margin-bottom: 24px; border: 1px solid #DCE3DF; border-radius: 8px; overflow: hidden; break-inside: avoid; page-break-inside: avoid; }
    .wf-header { display: flex; align-items: center; gap: 10px; padding: 10px 14px; background: #EAF0EE; border-bottom: 1px solid #DCE3DF; flex-wrap: wrap; }
    .wf-header h2 { font-size: 13pt; flex: 1; }
    .wf-version { font-size: 7.5pt; font-weight: 600; color: #57645E; background: #DCE3DF; padding: 1px 7px; border-radius: 8px; white-space: nowrap; }
    .freq-badge { font-size: 8pt; font-weight: 600; padding: 2px 8px; border-radius: 10px; background: #d1fae5; color: #059669; white-space: nowrap; }
    .wf-desc { padding: 6px 14px; font-size: 10pt; color: #57645E; border-bottom: 1px solid #E8EDEA; }
    .wf-tags { padding: 4px 14px 6px; border-bottom: 1px solid #E8EDEA; }
    .tag { display: inline-block; font-size: 8.5pt; padding: 1px 6px; border-radius: 8px; background: #DCE3DF; color: #57645E; margin-right: 4px; }
    .steps-table { width: 100%; border-collapse: collapse; table-layout: fixed; }
    .step-num { width: 36px; text-align: center; font-weight: 700; font-size: 10pt; color: #fff; background: #1F5F4A; vertical-align: top; padding: 10px 4px; }
    .step-body { padding: 10px 14px; vertical-align: top; border-bottom: 1px solid #E8EDEA; }
    /* 手順名・説明は左詰めの本文欄、資料（リンク）は右側の専用列にして
       本文と資料が同じ開始位置に並んで見えないようにする。資料は行の下端に揃える。 */
    .step-resource { width: 40%; padding: 10px 14px; vertical-align: bottom; border-bottom: 1px solid #E8EDEA; text-align: left; }
    .steps-table tr:last-child .step-body,
    .steps-table tr:last-child .step-num,
    .steps-table tr:last-child .step-resource { border-bottom: none; }
    .step-title { font-weight: 600; font-size: 11pt; }
    .step-memo { font-size: 10pt; font-weight: 400; color: #1B2421; margin-top: 3px; }
    .link-name { font-size: 9.5pt; color: #57645E; }
    .link-name .link-url { color: #57645E; text-decoration: none; }
    .link-path { font-size: 8pt; color: #9AA69F; font-family: monospace; margin-top: 1px; }
    @media print {
      body { padding: 0; }
      @page { margin: 15mm; size: A4; }
    }
  </style>
</head>
<body>
  <h1>${esc(title)}</h1>
  ${subtitle ? `<div class="subtitle">${esc(subtitle)}</div>` : ''}
  <div class="export-date">出力日: ${today}</div>
  ${sourceHint ? `<div class="dist-hint">最新版の入手先: ${esc(sourceHint)}</div>` : ''}
  ${workflowsHtml}
  <script>window.onload = function() { window.print(); };<\/script>
</body>
</html>`;

    const win = window.open('', '_blank');
    if (win) {
      win.document.write(html);
      win.document.close();
    }
  }

  /**
   * ワークフローをサーバー不要・単体で動作するHTMLファイルとして書き出します。
   * プロンプトのコピー、リンクへの移動、内容の直接編集＋再保存に対応します。
   * @private
   * @param {string[]} [selectedIds] - 出力対象のワークフローID。省略時は全件。
   * @param {{reviewDue?: string, sourceHint?: string}} [exportMeta] - 出力ダイアログで入力された配布メタ。
   */
  _exportWorkflowAsHtml(selectedIds, exportMeta = {}) {
    const portalId = this.configManager.getActivePortalId();
    const portal = this.configManager.getActivePortal();
    let workflows = this.workflowManager ? this.workflowManager.getWorkflows(portalId) : [];
    if (selectedIds) workflows = workflows.filter(w => selectedIds.includes(w.id));

    if (workflows.length === 0) {
      alert('エクスポートするワークフローがありません。');
      return;
    }

    const freqLabel = { daily: '毎日', weekly: '週次', monthly: '月次', rare: 'たまに' };
    const esc = (s) => this._escapeHtml(s);

    // 改変検知の基準値。配布時点の [data-editable] / .link-input の値を DOM 出現順に並べる。
    // 属性値だと改行が正規化されてしまうため、JSON にまとめて埋め込む。
    const baseEditables = [];
    const baseLinkInputs = [];
    const recEditable = (raw) => { baseEditables.push(raw == null ? '' : String(raw)); return esc(raw || ''); };
    const recLinkInput = (raw) => { baseLinkInputs.push(raw == null ? '' : String(raw)); return esc(raw || ''); };

    // wf-meta 用の版情報（配布物には Git 由来の文字列を一切入れない）
    const metaWorkflows = [];

    const pageTitle = portal?.title || '作業フロー';
    const pageSubtitle = portal?.subtitle || '';
    // ページ見出し（h1 → subtitle）は全ワークフローより前に DOM に出るので、真っ先に基準値を記録する
    const pageTitleHtml = recEditable(pageTitle);
    const pageSubtitleHtml = pageSubtitle ? recEditable(pageSubtitle) : '';

    const workflowsHtml = workflows.map(wf => {
      const rev = wf.rev || 1;
      const code = verificationCode(rev, wf.contentHash, wf.updatedAt);
      const updatedDate = wf.updatedAt
        ? new Date(wf.updatedAt).toLocaleDateString('ja-JP')
        : new Date().toLocaleDateString('ja-JP');
      metaWorkflows.push({ workflowId: wf.id, title: wf.title, rev, contentHash: wf.contentHash || '', code });

      const freq = freqLabel[wf.freq] || '';
      const tags = (wf.tags || []).map(t => `<span class="tag">${esc(t)}</span>`).join('');

      // 改変検知の基準値は DOM 出現順に記録する必要があるため、
      // 見出し（h2 → wf-desc）を先に記録してからステップを組み立てる。
      const wfTitleHtml = recEditable(wf.title);
      const wfDescHtml = wf.description ? recEditable(wf.description) : '';

      const stepsHtml = wf.steps.map(step => {
        let linkHtml = '';
        if (step.linkId) {
          const found = this.searchManager?.findLinkById(step.linkId);
          if (found && found.link.url) {
            const isLocal = found.link.url.startsWith('opendir:');
            // ローカルパスは opendir: を付けたままコピーすると、PowerShell等の
            // ターミナルに貼り付けた際にプロトコルURIとして解釈されず構文エラーになる
            // （かっこ等を含むフォルダ名だと特に顕著）。コピー・表示は生パスにし、
            // 「開く」を押したときだけ opendir: を付けてプロトコルハンドラに渡す。
            const displayValue = isLocal ? found.link.url.replace('opendir:', '') : found.link.url;
            // 手順書としては「手順名」が主役なので、資料名を控えめなラベルとして主表示にし、
            // 生のパス／URLとコピー・開くボタンはその下に一段小さく添える。
            linkHtml = `
              <div class="link-block${isLocal ? ' link-block-local' : ''}">
                <div class="link-name"><span class="icon-txt">${isLocal ? '📁' : '🔗'}</span> ${esc(found.link.title)}</div>
                <div class="link-controls">
                  <input type="text" class="link-input" value="${recLinkInput(displayValue)}" spellcheck="false" readonly ${isLocal ? 'data-scheme="opendir:"' : ''}>
                  <button type="button" class="mini-btn open-btn" onclick="wfOpenLink(this)">開く</button>
                  <button type="button" class="mini-btn copy-btn" onclick="wfCopyLink(this)">コピー</button>
                </div>
              </div>`;
          }
        }
        const hasVisiblePrompt = step.prompt && (step.promptType || 'prompt') !== 'none';
        // step-title → step-memo → prompt-text の順で改変検知の基準値を記録する
        const stepTitleHtml = recEditable(step.title);
        const stepMemoHtml = recEditable(step.memo || '');
        let promptHtml = '';
        if (hasVisiblePrompt) {
          const ptMeta = {
            prompt: { icon: '🤖', label: 'プロンプト', cls: '' },
            code: { icon: '💻', label: 'コード', cls: 'pt-code' },
            text: { icon: '📝', label: 'テキスト', cls: 'pt-text' }
          }[step.promptType] || { icon: '🤖', label: 'プロンプト', cls: '' };
          const promptTextHtml = recEditable(step.prompt || '');
          // 折りたたみ/展開ボタンをテキスト末尾ではなくヘッダーに置く。
          // プロンプトが長いと、末尾のボタンを押すためだけに毎回一番下まで
          // スクロールする必要があり、閉じる時も同様に不便だったため。
          promptHtml = `
              <div class="prompt-block ${ptMeta.cls}">
                <div class="prompt-header">
                  <span>${ptMeta.icon} ${ptMeta.label}</span>
                  <div class="prompt-header-actions">
                    <button type="button" class="mini-btn prompt-toggle-btn" onclick="wfToggleClamp(this)" style="display:none;">▼ 続きを見る</button>
                    <button type="button" class="mini-btn copy-btn" onclick="wfCopyPrompt(this)">📋 コピー</button>
                  </div>
                </div>
                <div class="prompt-text wf-clamp" data-editable contenteditable="false" data-placeholder="${ptMeta.label}を入力/貼り付け...">${promptTextHtml}</div>
              </div>`;
        }
        // 本文（タイトル・説明・プロンプト）は左詰めの列、資料（リンク）は右側の
        // 専用列にして、本文の開始位置と資料が同列に見えないようにする。
        // 資料は行の下端に揃え、複数ステップを見たときに資料だけが縦に
        // 並んだ落ち着いた一覧のように見えるようにする。
        return `<div class="step">
          <div class="step-num">${step.step}</div>
          <div class="step-body">
            <div class="step-title" data-editable contenteditable="false">${stepTitleHtml}</div>
            <div class="step-memo" data-editable contenteditable="false" data-placeholder="補足メモ">${stepMemoHtml}</div>
            ${promptHtml}
          </div>
          ${linkHtml ? `<div class="step-resource">${linkHtml}</div>` : ''}
        </div>`;
      }).join('');

      return `<div class="workflow">
        <div class="wf-header">
          <h2 data-editable contenteditable="false">${wfTitleHtml}</h2>
          ${freq ? `<span class="freq-badge">${freq}</span>` : ''}
          <span class="wf-version" title="配布バージョン（受領者との照合用）">v${rev} ・ ${esc(updatedDate)} ・ ${esc(code)}</span>
        </div>
        ${wfDescHtml ? `<p class="wf-desc" data-editable contenteditable="false">${wfDescHtml}</p>` : ''}
        ${tags ? `<div class="wf-tags">${tags}</div>` : ''}
        <div class="steps">${stepsHtml}</div>
      </div>`;
    }).join('');

    const title = pageTitle;
    const subtitle = pageSubtitle;
    const today = new Date().toLocaleDateString('ja-JP');
    const exportedAtIso = new Date().toISOString();
    const dateStamp = exportedAtIso.slice(0, 10).replace(/-/g, '');
    // 単一フロー出力（通常経路）ならファイル名に版を入れる
    const revTag = metaWorkflows.length === 1 ? `_v${metaWorkflows[0].rev}` : '';
    const singleTitle = metaWorkflows.length === 1 ? metaWorkflows[0].title : title;
    const baseFileName = `${singleTitle}${revTag}_${dateStamp}`;
    const baseFileNameJs = JSON.stringify(baseFileName).replace(/<\/script/gi, '<\\/script');

    // 配布メタ（Git 由来の文字列は入れない）。改変検知の基準値もここに同梱する。
    const reviewDue = (exportMeta && exportMeta.reviewDue) ? String(exportMeta.reviewDue) : '';
    const sourceHint = (exportMeta && exportMeta.sourceHint) ? String(exportMeta.sourceHint) : '';
    const wfMetaJson = JSON.stringify({
      schema: 1,
      exportedAt: exportedAtIso,
      portalTitle: title,
      reviewDue,
      sourceHint,
      workflows: metaWorkflows
    }).replace(/</g, '\\u003c');
    const wfBaselineJson = JSON.stringify({
      editables: baseEditables,
      linkInputs: baseLinkInputs
    }).replace(/</g, '\\u003c');

    const html = `<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)} - 作業フロー</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Hiragino Sans', 'Yu Gothic', 'Meiryo', sans-serif; font-size: 15px; color: #1B2421; background: #F3F5F3; padding: 24px 16px 64px; line-height: 1.45; }
  .page { max-width: 760px; margin: 0 auto; }
  .page-header { display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; flex-wrap: wrap; }
  h1 { font-size: 1.5rem; margin-bottom: 4px; }
  .subtitle { font-size: 0.9rem; color: #57645E; margin-bottom: 4px; }
  .export-date, .export-note { font-size: 0.78rem; color: #8B968F; }
  .edit-toggle { display: flex; align-items: center; gap: 8px; flex-shrink: 0; padding-top: 2px; }
  .edit-toggle-label { font-size: 0.8rem; font-weight: 600; color: #57645E; white-space: nowrap; }
  .switch { position: relative; display: inline-block; width: 40px; height: 22px; flex-shrink: 0; }
  .switch input { opacity: 0; width: 0; height: 0; }
  .switch .slider { position: absolute; inset: 0; background: #C7D0CB; border-radius: 22px; cursor: pointer; transition: 0.15s; }
  .switch .slider:before { position: absolute; content: ""; height: 16px; width: 16px; left: 3px; bottom: 3px; background: #fff; border-radius: 50%; transition: 0.15s; }
  .switch input:checked + .slider { background: #dc2626; }
  .switch input:checked + .slider:before { transform: translateX(18px); }
  .status-bar { display: inline-flex; align-items: center; gap: 5px; margin: 8px 0 12px; padding: 3px 11px; border-radius: 20px; font-size: 0.72rem; font-weight: 600; cursor: help; }
  .status-bar.locked { background: #fffbeb; color: #92400e; border: 1px solid #fcd34d; }
  .status-bar.editing { background: #fef2f2; color: #991b1b; border: 1px solid #fca5a5; }
  .status-hint { font-weight: 400; opacity: 0.75; }
  .workflow { margin-top: 14px; background: #fff; border: 1px solid #DCE3DF; border-radius: 10px; overflow: hidden; }
  .wf-header { display: flex; align-items: center; gap: 10px; padding: 10px 18px; background: #EAF0EE; border-bottom: 1px solid #DCE3DF; }
  .wf-header h2 { font-size: 1.1rem; flex: 1; outline: none; }
  .freq-badge { font-size: 0.72rem; font-weight: 600; padding: 2px 10px; border-radius: 10px; background: #d1fae5; color: #059669; white-space: nowrap; }
  .wf-desc { padding: 6px 18px; font-size: 0.85rem; color: #57645E; border-bottom: 1px solid #E8EDEA; outline: none; }
  .wf-tags { padding: 4px 18px 6px; border-bottom: 1px solid #E8EDEA; }
  .tag { display: inline-block; font-size: 0.75rem; padding: 2px 8px; border-radius: 8px; background: #DCE3DF; color: #57645E; margin-right: 4px; }
  .steps { }
  /* 本文（番号・タイトル・説明）は左詰めのまま上揃え、資料（.step-resource）だけ
     行の右側・下端に寄せる。本文の開始位置と資料が同じ列に並んで見えないようにし、
     資料だけが縦に連なると落ち着いた一覧のように見える。 */
  .step { display: flex; align-items: flex-start; gap: 12px; padding: 10px 18px; border-bottom: 1px solid #E8EDEA; }
  .step:last-child { border-bottom: none; }
  .step-num { flex-shrink: 0; width: 26px; height: 26px; border-radius: 50%; background: #1F5F4A; color: #fff; font-size: 0.8rem; font-weight: 700; display: flex; align-items: center; justify-content: center; }
  .step-resource { flex: 0 0 auto; align-self: flex-end; width: 42%; min-width: 220px; max-width: 320px; }
  .step-body { flex: 1; min-width: 0; }
  .step-title { font-weight: 600; font-size: 1rem; outline: none; padding: 1px 0; }
  .step-title[contenteditable]:focus, .step-memo[contenteditable]:focus, .prompt-text[contenteditable]:focus { background: #E7F1EC; border-radius: 4px; }
  .step-memo { font-size: 0.9rem; font-weight: 400; color: #1B2421; margin-top: 1px; outline: none; padding: 1px 0; min-height: 1.2em; }
  /* メモが空のときは、PDF出力と同じく枠ごと場所を取らないようにする。
     「クリックして追加」のプレースホルダーは、実際に編集できる編集モード中だけ出す。 */
  .step-memo:empty { min-height: 0; margin-top: 0; padding: 0; }
  body.wf-edit-mode .step-memo:empty { min-height: 1.2em; margin-top: 1px; padding: 1px 0; }
  body.wf-edit-mode .step-memo:empty:before { content: attr(data-placeholder); color: #AEB8B2; }
  .prompt-block { margin-top: 6px; border: 1px dashed #9EC6B4; border-radius: 8px; overflow: hidden; background: #E7F1EC; }
  .prompt-header { display: flex; align-items: center; justify-content: space-between; gap: 8px; padding: 4px 10px; font-size: 0.75rem; font-weight: 600; color: #164A38; background: #D7EAE1; }
  .prompt-header-actions { display: flex; align-items: center; gap: 6px; flex-shrink: 0; }
  .prompt-text { padding: 6px 10px; font-family: 'Consolas', 'Menlo', monospace; font-size: 0.82rem; white-space: pre-wrap; outline: none; color: #1C3226; min-height: 1.4em; }
  .prompt-text:empty:before { content: attr(data-placeholder); color: #9EC6B4; }
  .prompt-text.wf-clamp { display: -webkit-box; -webkit-line-clamp: 2; line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
  /* 折りたたみ/展開ボタンはヘッダー内の他ボタンと同じ mini-btn の見た目に揃える
     （プロンプトの色テーマに合わせた着色はせず、コピーボタンと同じ中立トーンにする）。 */
  .prompt-block.pt-code { border-color: #94a3b8; background: #DCE3DF; }
  .prompt-block.pt-code .prompt-header { color: #334155; background: #CBD5D1; }
  .prompt-block.pt-code .prompt-text { color: #1B2421; }
  .prompt-block.pt-text { border-color: #6ee7b7; background: #d1fae5; }
  .prompt-block.pt-text .prompt-header { color: #047857; background: #a7f3d0; }
  .prompt-block.pt-text .prompt-text { color: #064e3b; font-family: inherit; }
  /* 資料名（link-name）を主表示にし、生のパス／URL（link-controls）は
     コピー・開くのために残しつつ、一段小さく控えめな見た目にする。 */
  .link-block { margin-top: 8px; }
  .link-name { font-size: 0.82rem; font-weight: 500; color: #57645E; margin-bottom: 4px; display: flex; align-items: center; gap: 5px; }
  .link-controls { display: flex; align-items: center; gap: 6px; }
  .icon-txt { font-size: 0.9rem; flex-shrink: 0; }
  .link-input { flex: 1; min-width: 0; font-size: 0.76rem; padding: 4px 7px; border: 1px solid #E8EDEA; border-radius: 5px; font-family: 'Consolas', 'Menlo', monospace; }
  .link-input:read-only { background: #F3F5F3; color: #8B968F; }
  .mini-btn { flex-shrink: 0; font-size: 0.72rem; padding: 4px 9px; border-radius: 6px; border: 1px solid #DCE3DF; background: #fff; color: #57645E; cursor: pointer; }
  .mini-btn:hover { background: #E7F1EC; color: #1F5F4A; }
  .mini-btn.copied { background: #1F5F4A; color: #fff; border-color: #1F5F4A; }
  .footer-bar { max-width: 760px; margin: 24px auto 0; display: flex; justify-content: flex-end; }
  #saveHtmlBtn { font-size: 0.85rem; padding: 9px 16px; border-radius: 8px; border: none; background: #1F5F4A; color: #fff; cursor: pointer; }
  #saveHtmlBtn:hover { background: #164A38; }
  #saveHtmlBtn:disabled { background: #C7D0CB; cursor: not-allowed; }
  .origin-badge { display: inline-flex; align-items: center; gap: 3px; font-size: 0.72rem; font-weight: 700; padding: 2px 9px; border-radius: 10px; margin-left: 8px; vertical-align: middle; }
  .origin-badge.origin-original { background: #dbeafe; color: #1e40af; }
  .origin-badge.origin-copy { background: #fef3c7; color: #92400e; }
  .wf-version { font-size: 0.68rem; font-weight: 600; color: #57645E; background: #DCE3DF; padding: 2px 8px; border-radius: 8px; white-space: nowrap; letter-spacing: 0.02em; }
  .dist-info { max-width: 760px; margin: 14px auto 0; font-size: 0.76rem; color: #57645E; display: flex; flex-direction: column; gap: 3px; }
  .dist-info .review-warn { color: #92400e; font-weight: 600; }
  .dist-info .src-hint b { color: #1B2421; }
  [data-editable]:not([contenteditable="true"]) { cursor: default; }
  body.wf-edit-mode [data-editable][contenteditable="true"] { cursor: text; }
  body.wf-edit-mode [data-editable][contenteditable="true"]:hover { background: #EAF0EE; border-radius: 4px; }
  @media (max-width: 600px) {
    .step { flex-wrap: wrap; }
    .step-resource { align-self: stretch; width: 100%; max-width: none; margin-left: 38px; }
    .link-controls { flex-wrap: wrap; }
    .link-input { flex-basis: 100%; }
  }
</style>
</head>
<body>
<div class="page">
  <div class="page-header">
    <div>
      <h1 data-editable contenteditable="false">${pageTitleHtml}</h1>
      ${pageSubtitleHtml ? `<div class="subtitle" data-editable contenteditable="false">${pageSubtitleHtml}</div>` : ''}
      <div class="export-date">出力日: ${today} <span id="wfIntegrityBadge" class="origin-badge origin-original">📄 配布時のまま</span></div>
    </div>
    <label class="edit-toggle">
      <span class="edit-toggle-label">編集する</span>
      <span class="switch"><input type="checkbox" id="wfEditToggle"><span class="slider"></span></span>
    </label>
  </div>
  <div class="status-bar locked" id="wfStatusBar" title="タイトル・メモ・プロンプト・リンク先のURLやパスは、右上の「編集する」をONにすると直接書き換えられます。書き換えた内容は下部の「保存」ボタンで新しいHTMLファイルとして書き出せます（このファイル自体は上書きされません）。">
    <span id="wfStatusIcon">🔒</span><span id="wfStatusText">編集ロック中</span><span class="status-hint">（詳細はここにカーソル）</span>
  </div>
  ${workflowsHtml}
</div>
<div class="dist-info" id="wfDistInfo">
  ${sourceHint ? `<div class="src-hint">最新版の入手先: <b>${esc(sourceHint)}</b></div>` : ''}
  <div class="review-note" id="wfReviewNote" data-review-due="${esc(reviewDue)}"></div>
</div>
<div class="footer-bar">
  <button type="button" id="saveHtmlBtn" onclick="wfSaveAsHtml()" disabled title="「編集する」をONにすると使えます">💾 この内容をHTMLとして保存</button>
</div>
<script type="application/json" id="wf-meta">${wfMetaJson}</script>
<script type="application/json" id="wf-baseline">${wfBaselineJson}</script>
<script>
var wfBaseFileName = ${baseFileNameJs};
function wfShowFeedback(btn, ok) {
  var orig = btn.textContent;
  btn.textContent = ok ? '✓ コピー済' : '× 失敗';
  btn.classList.toggle('copied', ok);
  setTimeout(function () { btn.textContent = orig; btn.classList.remove('copied'); }, 1400);
}
function wfCopyText(btn, text) {
  function done(ok) { wfShowFeedback(btn, ok); }
  if (navigator.clipboard && window.isSecureContext) {
    navigator.clipboard.writeText(text).then(function () { done(true); }, function () { wfFallbackCopy(text, done); });
  } else {
    wfFallbackCopy(text, done);
  }
}
function wfFallbackCopy(text, done) {
  var ta = document.createElement('textarea');
  ta.value = text;
  ta.style.position = 'fixed';
  ta.style.opacity = '0';
  document.body.appendChild(ta);
  ta.focus();
  ta.select();
  var ok = false;
  try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
  document.body.removeChild(ta);
  done(ok);
}
function wfCopyPrompt(btn) {
  var block = btn.closest('.prompt-block');
  var text = block.querySelector('.prompt-text').innerText;
  wfCopyText(btn, text);
}
function wfCopyLink(btn) {
  var input = btn.parentElement.querySelector('.link-input');
  wfCopyText(btn, input.value);
}
function wfOpenLink(btn) {
  var input = btn.parentElement.querySelector('.link-input');
  if (!input.value) return;
  var scheme = input.dataset.scheme || '';
  window.open(scheme + input.value, '_blank');
}
function wfUpdateClampToggle(text, btn) {
  if (!text || !btn) return;
  btn.textContent = '▼ 続きを見る';
  btn.style.display = (text.scrollHeight > text.clientHeight + 1) ? 'inline-block' : 'none';
}
function wfToggleClamp(btn) {
  var text = btn.closest('.prompt-block').querySelector('.prompt-text');
  var stillClamped = text.classList.toggle('wf-clamp');
  btn.textContent = stillClamped ? '▼ 続きを見る' : '▲ 折りたたむ';
}
function wfInitClamps() {
  document.querySelectorAll('.prompt-block').forEach(function (block) {
    wfUpdateClampToggle(block.querySelector('.prompt-text'), block.querySelector('.prompt-toggle-btn'));
  });
}
function wfSetEditMode(on) {
  document.querySelectorAll('[data-editable]').forEach(function (el) {
    el.setAttribute('contenteditable', on ? 'true' : 'false');
  });
  document.querySelectorAll('.link-input').forEach(function (el) {
    el.readOnly = !on;
  });
  document.body.classList.toggle('wf-edit-mode', on);
  var saveBtn = document.getElementById('saveHtmlBtn');
  if (saveBtn) saveBtn.disabled = !on;
  var statusBar = document.getElementById('wfStatusBar');
  if (statusBar) {
    statusBar.classList.toggle('locked', !on);
    statusBar.classList.toggle('editing', on);
    document.getElementById('wfStatusIcon').textContent = on ? '✏️' : '🔒';
    document.getElementById('wfStatusText').textContent = on ? '編集モード中' : '編集ロック中';
  }
  // 編集中はプロンプト全文が見えるよう展開し、ロックに戻したら折りたたみ状態を再計算する
  document.querySelectorAll('.prompt-block').forEach(function (block) {
    var text = block.querySelector('.prompt-text');
    var btn = block.querySelector('.prompt-toggle-btn');
    if (!text) return;
    if (on) {
      text.classList.remove('wf-clamp');
      if (btn) btn.style.display = 'none';
    } else {
      text.classList.add('wf-clamp');
      wfUpdateClampToggle(text, btn);
    }
  });
}
// ── 改変検知: 配布時点の基準値（wf-baseline）と現在の内容を突き合わせる ──
function wfReadBaseline() {
  try {
    var el = document.getElementById('wf-baseline');
    return el ? JSON.parse(el.textContent) : { editables: [], linkInputs: [] };
  } catch (e) {
    return { editables: [], linkInputs: [] };
  }
}
function wfCheckIntegrity() {
  var base = wfReadBaseline();
  var changed = false;
  var eds = document.querySelectorAll('[data-editable]');
  for (var i = 0; i < eds.length; i++) {
    if ((base.editables[i] != null ? base.editables[i] : '') !== eds[i].textContent) { changed = true; break; }
  }
  if (!changed) {
    var lis = document.querySelectorAll('.link-input');
    for (var j = 0; j < lis.length; j++) {
      if ((base.linkInputs[j] != null ? base.linkInputs[j] : '') !== lis[j].value) { changed = true; break; }
    }
  }
  var badge = document.getElementById('wfIntegrityBadge');
  if (badge) {
    badge.textContent = changed ? '⚠ 配布後に内容が変更されています' : '📄 配布時のまま';
    badge.className = 'origin-badge ' + (changed ? 'origin-copy' : 'origin-original');
  }
  return changed;
}
function wfInitReviewNote() {
  var note = document.getElementById('wfReviewNote');
  if (!note) return;
  var due = note.getAttribute('data-review-due') || '';
  if (!/^\\d{4}-\\d{2}$/.test(due)) { note.style.display = 'none'; return; }
  var parts = due.split('-');
  var end = new Date(Number(parts[0]), Number(parts[1]), 0); // 当月末
  var now = new Date();
  if (now > end) {
    note.className = 'review-warn';
    note.textContent = '⏰ この手順書は ' + due + ' に見直し予定でした。最新版を入手先にご確認ください。';
  } else {
    note.textContent = '次回見直し予定: ' + due;
  }
}
wfInitClamps();
wfCheckIntegrity();
wfInitReviewNote();
document.getElementById('wfEditToggle').addEventListener('change', function (e) {
  wfSetEditMode(e.target.checked);
});
document.addEventListener('input', function (e) {
  if (e.target && (e.target.matches('[data-editable]') || e.target.classList.contains('link-input'))) {
    wfCheckIntegrity();
  }
});
function wfSaveAsHtml() {
  // 配布事故防止のため、保存する内容は必ず「編集不可」状態に戻してから書き出す
  var toggle = document.getElementById('wfEditToggle');
  if (toggle) toggle.checked = false;
  wfSetEditMode(false);
  // 基準値（wf-baseline）は配布時点のまま据え置く。編集して保存し直したコピーは
  // 「⚠ 配布後に内容が変更されています」と表示され続け、原本との乖離が一目で分かる。
  wfCheckIntegrity();
  document.querySelectorAll('.link-input').forEach(function (el) {
    el.setAttribute('value', el.value);
    el.setAttribute('readonly', 'readonly');
  });
  var html = '<!DOCTYPE html>\\n' + document.documentElement.outerHTML;
  var blob = new Blob([html], { type: 'text/html' });
  var url = URL.createObjectURL(blob);
  var a = document.createElement('a');
  a.href = url;
  var now = new Date();
  var hh = String(now.getHours()).padStart(2, '0');
  var mm = String(now.getMinutes()).padStart(2, '0');
  a.download = wfBaseFileName + '_複製_' + hh + mm + '.html';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
<\/script>
</body>
</html>`;

    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${baseFileName}.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  /**
   * step.promptType に応じたアイコン・ラベル・修飾クラスを返します。
   * @private
   * @param {string} [type] - 'prompt'|'code'|'text'（省略時は'prompt'扱い）
   */
  _promptTypeMeta(type) {
    const map = {
      prompt: { icon: 'smart_toy', label: 'プロンプト', cls: '' },
      code: { icon: 'code', label: 'コード', cls: 'wf-pt-code' },
      text: { icon: 'notes', label: 'テキスト', cls: 'wf-pt-text' }
    };
    return map[type] || map.prompt;
  }

  /**
   * プロンプト等の文字列をクリップボードへコピーします（アプリ内UI用）。
   * @private
   * @param {string} text
   * @param {HTMLElement} btn - フィードバック表示対象のボタン要素
   */
  _copyToClipboard(text, btn) {
    const showResult = (ok) => {
      if (!btn) return;
      const orig = btn.innerHTML;
      btn.innerHTML = ok
        ? '<span class="icon icon-xs">check</span> コピー済'
        : '<span class="icon icon-xs">close</span> 失敗';
      setTimeout(() => { btn.innerHTML = orig; }, 1400);
    };
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(text).then(() => showResult(true), () => this._fallbackCopy(text, showResult));
    } else {
      this._fallbackCopy(text, showResult);
    }
  }

  /**
   * @private - Clipboard APIが使えない環境向けのフォールバックコピー処理。
   */
  _fallbackCopy(text, callback) {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    let ok = false;
    try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
    document.body.removeChild(ta);
    callback(ok);
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
   * @returns {HTMLDivElement} 作成されたラッパー要素。
   */
  _createTableRow(link) {
    const wrapper = document.createElement('div');
    wrapper.className = 'table-row-wrapper';

    const isLocalRow = link.url && link.url.startsWith('opendir:');
    const a = document.createElement('a');
    a.className = 'table-row' + (this.isEditMode ? ' disabled' : '') + (isLocalRow ? ' link-local' : '');
    a.href = link.url;
    if (!isLocalRow) a.target = '_blank';
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
    if (this.isEditMode) this._makeTitleEditable(titleCell, link);

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

      const editBtn = this._createCardActionButton('<span class="icon icon-sm">edit</span>', () => this.linkDialog.open(link.id), 'リンクを編集');
      const delBtn = this._createCardActionButton('<span class="icon icon-sm">delete</span>', () => {
        if (confirm(`リンク「${link.title}」を削除しますか？`)) {
          this.dataManager.deleteLink(link.id);
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

  /**
   * タイトル要素をその場（インライン）で編集できるようにします。
   * カード表示・テーブル表示のどちらの要素にも使える共通処理です。
   * 編集モード中、カード/テーブル行本体は pointer-events:none で無効化されているため、
   * この要素自身に pointer-events:auto を与えてクリック・フォーカスできるようにする必要があります（CSS側で対応）。
   * @private
   * @param {HTMLElement} el - タイトルを表示している要素（span）。
   * @param {Link} link - 対象のリンクデータ。呼び出し元のクロージャが持つローカルコピー。
   */
  _makeTitleEditable(el, link) {
    el.contentEditable = 'true';
    el.spellcheck = false;
    el.title = 'クリックしてタイトルを編集';
    el.classList.add('title-editable');

    // フォーカス取得はしたいが、リンクのナビゲーション（親<a>のデフォルト動作）は止める
    el.addEventListener('mousedown', (e) => e.stopPropagation());
    el.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
    });

    el.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        el.blur();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        el.textContent = link.title;
        el.blur();
      }
    });

    el.addEventListener('blur', () => {
      const newTitle = el.textContent.trim();
      if (!newTitle) {
        el.textContent = link.title; // 空欄は許可しない
        return;
      }
      if (newTitle !== link.title) {
        this.dataManager.updateLink(link.id, { title: newTitle });
        link.title = newTitle;
        el.textContent = newTitle;
      }
    });
  }

}