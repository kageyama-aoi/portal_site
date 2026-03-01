/**
 * @file portalDialog.js
 * @brief ポータル管理ダイアログを管理するクラス。
 * @module PortalDialog
 */

/**
 * @class PortalDialog
 * @brief ポータルの情報更新、切り替え、新規作成を行うためのモーダルダイアログを制御します。
 */
export class PortalDialog {
  /**
   * @property {DataManager} dataManager - データ操作を管理するDataManagerのインスタンス。
   */
  dataManager;
  /**
   * @property {ConfigManager} configManager - 設定を管理するConfigManagerのインスタンス。
   */
  configManager;
  /**
   * @property {function(string, string): void} setPageTitle - ページのタイトルとサブタイトルを設定するためのコールバック関数。
   */
  setPageTitle;
  /**
   * @property {HTMLDialogElement} dialog - ポータルダイアログのDOM要素。
   */
  dialog;

  /**
   * PortalDialogの新しいインスタンスを作成します。
   * @param {DataManager} dataManager - データ管理オブジェクト。
   * @param {ConfigManager} configManager - 設定管理オブジェクト。
   * @param {function(string, string): void} setPageTitleCallback - ページのタイトルとサブタイトルを設定するコールバック関数。
   */
  constructor(dataManager, configManager, setPageTitleCallback) {
    this.dataManager = dataManager;
    this.configManager = configManager;
    this.setPageTitle = setPageTitleCallback;
  }

  /**
   * ダイアログの初期化とイベントリスナーの設定を行います。
   */
  init() {
    this.dialog = document.getElementById('portalDialog');
    this.initEventListeners();
  }

  /**
   * ダイアログのイベントリスナーを初期化します。
   */
  initEventListeners() {
    // ポータル情報更新ボタン
    document.getElementById('updatePortalInfoBtn').addEventListener('click', () => {
        const title = document.getElementById('portalTitleInput').value;
        const subtitle = document.getElementById('portalSubtitleInput').value;
        this.configManager.updateActivePortalInfo({ title, subtitle });
        this.setPageTitle(title, subtitle); // コールバックを使用してページタイトルを設定
        alert('ポータル情報を更新しました。');
        this.dialog.close(); // 更新後にダイアログを閉じる
    });

    // ポータル切り替えボタン
    document.getElementById('switchPortalBtn').addEventListener('click', () => {
        const selectedPortalId = document.querySelector('input[name="portalSelection"]:checked')?.value;
        if (selectedPortalId && selectedPortalId !== this.configManager.getConfig().activePortalId) {
            this.configManager.setActivePortal(selectedPortalId);
            alert('ポータルを切り替えます。ページがリロードされます。');
            window.location.reload(); // ページリロードでポータルを切り替え
        }
    });

    // 新規ポータル作成ボタン
    document.getElementById('createPortalBtn').addEventListener('click', () => {
        const name = document.getElementById('newPortalNameInput').value.trim();
        if (!name) {
            alert('ポータル名を入力してください。');
            return;
        }
        const id = `portal_${Date.now()}`;
        this.configManager.addPortal({ id, name });
        this.configManager.setActivePortal(id);

        // 新しいポータルのために空のカテゴリ配列を設定して全体を保存
        this.dataManager.allPortals[id] = [];
        this.dataManager.data = [];
        this.dataManager.save(id);

        alert(`新規ポータル「${name}」を作成しました。ページがリロードされます。`);
        window.location.reload();
    });

    // ダイアログを閉じるボタン
    document.getElementById('closePortalDialogBtn').addEventListener('click', () => {
        this.dialog.close();
    });
  }

  /**
   * ポータル管理ダイアログを開きます。
   * 現在のアクティブポータル情報やポータルリストを表示し、新規作成フォームをクリアします。
   */
  open() {
    const config = this.configManager.getConfig();
    const activePortal = this.configManager.getActivePortal();

    // 現在のポータル情報をフォームに設定
    document.getElementById('portalTitleInput').value = activePortal.title;
    document.getElementById('portalSubtitleInput').value = activePortal.subtitle;

    // ポータル一覧を生成
    const listContainer = document.getElementById('portalListContainer');
    listContainer.innerHTML = '';
    Object.entries(config.portals).forEach(([id, portal]) => {
      const label = document.createElement('label');
      const radio = document.createElement('input');
      radio.type = 'radio';
      radio.name = 'portalSelection';
      radio.value = id;
      if (id === config.activePortalId) {
        radio.checked = true;
      }
      label.appendChild(radio);
      label.append(` ${portal.title}`);
      listContainer.appendChild(label);
    });

    // 新規作成フォームをクリア
    document.getElementById('newPortalNameInput').value = '';

    this.dialog.showModal(); // ダイアログを表示
  }
}