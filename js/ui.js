/**
 * @file ui.js
 * @brief DOM の描画とユーザーイベントの処理、およびダイアログとの連携を管理するクラス。
 * @module UI
 */

import { verificationCode } from './workflowVersion.js';
import { escapeHtml } from './util/html.js';
import { copyToClipboard } from './util/clipboard.js';
import { freqLabel } from './workflowConstants.js';
import { exportWorkflowsAsHtml, exportWorkflowsAsPdf } from './workflowExporter.js';

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
   * @property {Set<string>} expandedWorkflowIds - ユーザーがこのセッションで開いた作業フローカードのID。
   * 作業フローは既定で折りたたみ表示にし、開いたものだけここに記憶する
   * （タグ別グループが既定で開いているのと逆の扱い）。
   */
  expandedWorkflowIds = new Set();
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
          copyToClipboard(localPath, (ok) => {
            if (!ok) return;
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
      const unsaved = this.distributionLog && this.distributionLog.hasUnsavedChanges;
      logBtn.innerHTML = `<span class="icon icon-sm">history</span> 発行履歴${unsaved ? '<span class="dist-dot" title="未保存の追記があります">●</span>' : ''}`;
      logBtn.title = 'どの版をいつ誰に配ったかの記録';
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
      // 既定は折りたたみ。セッション中に開いたフローだけ開いた状態を復元する。
      card.open = this.expandedWorkflowIds.has(wf.id);
      card.addEventListener('toggle', () => {
        if (card.open) this.expandedWorkflowIds.add(wf.id);
        else this.expandedWorkflowIds.delete(wf.id);
      });

      const wfFreqLabel = freqLabel(wf.freq);
      const tags = (wf.tags || []).map(t => `<span class="tag-chip tag-chip-sm">${this._escapeHtml(t)}</span>`).join('');
      const stepCount = wf.steps.length;

      const summary = document.createElement('summary');
      summary.className = 'workflow-card-summary';
      summary.innerHTML = `
        <div class="workflow-card-head">
          <div class="workflow-card-title">
            <span class="icon icon-sm workflow-card-icon">account_tree</span>
            <span class="workflow-card-title-text">${this._escapeHtml(wf.title)}</span>
            ${wfFreqLabel ? `<span class="wf-freq-badge wf-freq-${wf.freq}">${wfFreqLabel}</span>` : ''}
            <span class="workflow-card-count">${stepCount} ステップ</span>
          </div>
          ${(wf.description || tags) ? `<div class="workflow-card-sub">
            ${wf.description ? `<span class="workflow-card-desc">${this._escapeHtml(wf.description)}</span>` : ''}
            ${tags ? `<span class="wf-tags-row">${tags}</span>` : ''}
          </div>` : ''}
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
              memo.textContent = step.memo;
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
    const formatLabel = format === 'pdf' ? 'PDF' : 'HTML';

    const itemsHtml = workflows.map((wf, i) => `
      <label class="wf-export-item">
        <input type="radio" name="wfExportRadio" class="wf-export-check" value="${wf.id}" ${i === 0 ? 'checked' : ''}>
        <span class="wf-export-item-title">${this._escapeHtml(wf.title)}</span>
        <span class="wf-export-item-rev">v${wf.rev || 1}</span>
        <span class="wf-freq-badge wf-freq-${wf.freq}">${freqLabel(wf.freq)}</span>
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
          <span>配布先メモ <span class="wf-export-opt">（任意・発行履歴に記録／配布物には出ません）</span></span>
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
   * @private エクスポート対象の作業フロー配列を返す。0件なら alert して null。
   * @param {string[]} [selectedIds]
   * @returns {object[]|null}
   */
  _workflowsForExport(selectedIds) {
    const portalId = this.configManager.getActivePortalId();
    let workflows = this.workflowManager ? this.workflowManager.getWorkflows(portalId) : [];
    if (selectedIds) workflows = workflows.filter(w => selectedIds.includes(w.id));
    if (workflows.length === 0) {
      alert('エクスポートするワークフローがありません。');
      return null;
    }
    return workflows;
  }

  /** @private エクスポート用オプション（ポータル情報・リンク解決）を組み立てる。 */
  _exportOptions(exportMeta) {
    return {
      portal: this.configManager.getActivePortal(),
      resolveLink: (id) => (this.searchManager ? this.searchManager.findLinkById(id) : null),
      exportMeta
    };
  }

  /**
   * ワークフローを印刷用HTML（PDF化前提）として開きます。
   * @private
   * @param {string[]} [selectedIds]
   * @param {{reviewDue?: string, sourceHint?: string}} [exportMeta]
   */
  _exportWorkflowAsPdf(selectedIds, exportMeta = {}) {
    const workflows = this._workflowsForExport(selectedIds);
    if (!workflows) return;
    exportWorkflowsAsPdf(workflows, this._exportOptions(exportMeta));
  }

  /**
   * ワークフローを配布用の単体HTMLファイルとして書き出します。
   * @private
   * @param {string[]} [selectedIds]
   * @param {{reviewDue?: string, sourceHint?: string}} [exportMeta]
   */
  _exportWorkflowAsHtml(selectedIds, exportMeta = {}) {
    const workflows = this._workflowsForExport(selectedIds);
    if (!workflows) return;
    exportWorkflowsAsHtml(workflows, this._exportOptions(exportMeta));
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
    copyToClipboard(text, showResult);
  }

  /**
   * @private - HTML特殊文字をエスケープします（共通実装 util/html.js へ委譲）。
   */
  _escapeHtml(str) {
    return escapeHtml(str);
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