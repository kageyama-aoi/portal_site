/**
 * @file linkDialog.js
 * @brief リンクの追加・編集ダイアログを管理するクラス。
 * @module LinkDialog
 */

import { IconPickerDialog } from './iconPickerDialog.js';
import { detectBadge } from '../badgeDetector.js';
import { initTagsSuggest } from '../tagSuggest.js';

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
  /** @property {HTMLInputElement} linkIsLocalInput - ローカルフォルダ用チェックボックス。 */
  linkIsLocalInput;
  editingLinkId = null;
  /**
   * @property {boolean} badgeManuallySet - ユーザーがバッジを手動で選び直したかどうか。
   * true の間は URL からのバッジ自動判定を行わない（既存の選択を勝手に上書きしないため）。
   */
  badgeManuallySet = false;
  /** @property {ConfigManager} configManager - タグ候補を出す対象ポータルを知るために使う。 */
  configManager;
  /** @property {SearchManager} searchManager - リンクに実際に使われているタグの収集に使う。 */
  searchManager;
  /** @property {TagManager} tagManager - リンク未紐づけの事前登録タグの収集に使う。 */
  tagManager;
  /** @property {HTMLElement} tagsSuggestBox - タグ入力のサジェスト用ドロップダウン要素。 */
  tagsSuggestBox;
  /**
   * @property {string[]} _knownTagsCache - open() のたびに計算し直すタグ候補一覧。
   * キー入力のたびに全リンクを再スキャンしないよう、ダイアログを開いている間はこれを使い回す。
   */
  _knownTagsCache = [];

  constructor(dataManager, renderCallback, iconPickerDialog, configManager = null, searchManager = null, tagManager = null) {
    this.dataManager = dataManager;
    this.renderCallback = renderCallback;
    this.iconPickerDialog = iconPickerDialog;
    this.configManager = configManager;
    this.searchManager = searchManager;
    this.tagManager = tagManager;
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
    this.linkIsLocalInput = document.getElementById('linkIsLocalInput');
    this.tagsSuggestBox = document.getElementById('linkTagsSuggest');
    this.initEventListeners();
    this._initTagsSuggest();
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
          tags: Array.from(new Set(tagsRaw.split(',').map(t => t.trim()).filter(Boolean))),
          keywords: keywordsRaw.split(',').map(k => k.trim()).filter(Boolean),
          freq: document.getElementById('linkFreqInput').value || null
        };

        if (this.editingLinkId) {
          this.dataManager.updateLink(this.editingLinkId, linkData);
        } else {
          this.dataManager.addLink(linkData);
        }
        this.renderCallback();
      }
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

    // opendir: チェックボックス
    this.linkIsLocalInput.addEventListener('change', () => {
      const urlInput = this.form.linkUrlInput;
      if (this.linkIsLocalInput.checked) {
        if (!urlInput.value.startsWith('opendir:')) {
          urlInput.value = 'opendir:' + urlInput.value;
        }
        urlInput.placeholder = 'C:\\Users\\...（フォルダパス）';
        if (!this.badgeManuallySet) this.form.linkBadgeInput.value = 'local';
      } else {
        if (urlInput.value.startsWith('opendir:')) {
          urlInput.value = urlInput.value.slice('opendir:'.length);
        }
        urlInput.placeholder = 'https://example.com';
        if (!this.badgeManuallySet) {
          const detected = detectBadge(urlInput.value);
          if (detected) this.form.linkBadgeInput.value = detected;
        }
      }
      urlInput.focus();
    });

    // URLからバッジ種別を自動判定（スプレッドシート/ドキュメント/よく使うサイト等）。
    // ユーザーがバッジを手動で選び直したら、以降は自動判定で上書きしない。
    this.form.linkUrlInput.addEventListener('input', () => {
      if (this.badgeManuallySet || this.linkIsLocalInput.checked) return;
      const detected = detectBadge(this.form.linkUrlInput.value);
      if (detected) this.form.linkBadgeInput.value = detected;
    });
    this.form.linkBadgeInput.addEventListener('change', () => {
      this.badgeManuallySet = true;
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
   * 現在のポータルで「既に使われているタグ」＋「まだリンク0件の事前登録タグ」を
   * 合わせた候補一覧を返します（重複除去・ソート済み）。
   * @private
   * @returns {string[]}
   */
  _getKnownTags() {
    if (!this.searchManager || !this.tagManager || !this.configManager) return [];
    const portalId = this.configManager.getActivePortalId();
    const used = this.searchManager.getAllTags();
    const registered = this.tagManager.getRegisteredTags(portalId);
    return Array.from(new Set([...used, ...registered])).sort((a, b) => a.localeCompare(b, 'ja'));
  }

  /**
   * タグ欄（カンマ区切り）に、新規入力はそのまま・既存タグは選択できる
   * サジェストドロップダウンを設定します（js/tagSuggest.js の共通実装を使用）。
   * 候補一覧は open() 時に this._knownTagsCache へキャッシュしたものを参照する
   * （キー入力のたびに全リンクを再スキャンしないようにするため）。
   * @private
   */
  _initTagsSuggest() {
    if (!this.tagsSuggestBox) return;
    initTagsSuggest({
      inputEl: document.getElementById('linkTagsInput'),
      boxEl: this.tagsSuggestBox,
      getKnownTags: () => this._knownTagsCache || []
    });
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

  open(linkId = null, prefillTag = null) {
    this.editingLinkId = linkId;
    // 編集時は既存のバッジ選択を尊重（自動判定で上書きしない）。
    // 新規追加時のみ、URL入力に応じた自動判定を有効にする。
    this.badgeManuallySet = !!linkId;
    // タグ候補は開いている間キー入力のたびに再計算しないよう、ここで1回だけ計算する。
    this._knownTagsCache = this._getKnownTags();

    if (linkId) {
      const link = this.dataManager.getLink(linkId);
      const isLocal = !!link.url?.startsWith('opendir:');
      this.linkIsLocalInput.checked = isLocal;
      this.form.linkUrlInput.placeholder = isLocal ? 'C:\\Users\\...（フォルダパス）' : 'https://example.com';
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
      this.linkIsLocalInput.checked = false;
      this.form.linkUrlInput.placeholder = 'https://example.com';
      this.linkIconInput.value = 'link';
      this.form.linkBadgeInput.value = 'doc';
      this.linkIconColorInput.value = '#64748b';
      this.linkIconColorInput.dataset.custom = 'false';
      document.getElementById('linkTagsInput').value = prefillTag || '';
      document.getElementById('linkKeywordsInput').value = '';
      document.getElementById('linkFreqInput').value = '';
      this._loadStyle(0, 400, 'normal');
    }
    this._updatePreview();
    this.dialog.showModal();
  }
}
