/**
 * @file app.js
 * @brief アプリケーションのエントリーポイント。主要なモジュールを初期化し、イベントリスナーを設定してアプリケーションを起動します。
 * @module app
 */

import { DataManager } from './dataManager.js';
import { UI } from './ui.js';
import { ConfigManager } from './configManager.js';
import { LinkDialog } from './dialogs/linkDialog.js';
import { BulkLinkDialog } from './dialogs/bulkLinkDialog.js';
import { PortalDialog } from './dialogs/portalDialog.js';
import { IconPickerDialog } from './dialogs/iconPickerDialog.js';
import { SearchManager } from './searchManager.js';
import { MemoryManager } from './memoryManager.js';
import { WorkflowManager } from './workflowManager.js';
import { WorkflowDialog } from './dialogs/workflowDialog.js';
import { ThemeManager } from './themeManager.js';
import { TagManager } from './tagManager.js';
import { DistributionLogManager, LEDGER_FILE_PATH } from './distributionLog.js';
import { DistributionLogDialog } from './dialogs/distributionLogDialog.js';

/**
 * DOMContentLoaded イベントリスナー。DOMが完全にロードされた後にアプリケーションを初期化します。
 * @async
 * @returns {Promise<void>}
 */
document.addEventListener('DOMContentLoaded', async () => {
  /**
   * @type {ConfigManager}
   * @description アプリケーションの設定（ポータル情報など）を管理するインスタンス。
   */
  const configManager = new ConfigManager();
  /**
   * @type {object}
   * @property {string} title - アクティブなポータルの表示タイトル。
   * @property {string} subtitle - アクティブなポータルのサブタイトル。
   * @description 現在アクティブなポータルの情報。
   */
  const activePortal = configManager.getActivePortal();

  if (!activePortal) {
    alert('ポータルの設定が見つかりません。');
    return;
  }

  /**
   * @type {UI}
   * @description ユーザーインターフェースの描画とイベント処理を管理するインスタンス。（後で初期化）
   */
  let ui;

  /**
   * @callback onDirtyCallback
   * @description データに変更があった際に呼び出されるコールバック。UIの保存ボタンの状態を更新します。
   * @param {boolean} isDirty - 変更があるかどうか。
   */
  const onDirtyCallback = () => {
    if (ui) {
      ui.updateSaveButtonState(true);
    }
  };

  /**
   * @type {DataManager}
   * @description アプリケーションのデータを管理するインスタンス。
   */
  const dataManager = new DataManager(onDirtyCallback);
  
  /**
   * @type {function(): void}
   * @description UIの再レンダリングをトリガーするためのコールバック関数。`ui`インスタンスが完全に初期化された後に割り当てられます。
   */
  let uiRenderCallback = () => {}; 
  
  /**
   * @type {IconPickerDialog}
   * @description アイコン選択ダイアログのインスタンス。
   */
  const iconPickerDialog = new IconPickerDialog();

  /**
   * @type {SearchManager}
   * @description タグ一覧の収集にも使うため、LinkDialogより先に作る。
   */
  const searchManager = new SearchManager(dataManager);

  /**
   * @type {TagManager}
   * @description リンク未紐づけの事前登録タグを管理。LinkDialogのタグ候補にも使うため先に作る。
   */
  const tagManager = new TagManager(dataManager);

  /**
   * @type {LinkDialog}
   * @description 単一リンク編集ダイアログのインスタンス。
   */
  const linkDialog = new LinkDialog(dataManager, () => uiRenderCallback(), iconPickerDialog, configManager, searchManager, tagManager);

      /**
       * @type {BulkLinkDialog}
       * @description 複数リンク一括追加ダイアログのインスタンス。
       */
      const bulkLinkDialog = new BulkLinkDialog(dataManager, () => uiRenderCallback(), iconPickerDialog);

      /**
       * @type {UI}
       * @description ユーザーインターフェースの描画とイベント処理を管理するインスタンス。
       */
      ui = new UI(dataManager, configManager, linkDialog, bulkLinkDialog);

  ui.searchManager = searchManager;
  ui.tagManager = tagManager;

  /**
   * @type {MemoryManager}
   */
  const memoryManager = new MemoryManager();
  ui.memoryManager = memoryManager;

  /**
   * @type {WorkflowManager}
   */
  const workflowManager = new WorkflowManager(dataManager);
  ui.workflowManager = workflowManager;

  /**
   * @type {DistributionLogManager}
   * @description 作業フロー出力の発行履歴（配布台帳）。localStorage に保存。
   */
  const distributionLog = new DistributionLogManager();
  ui.distributionLog = distributionLog;
  // 未保存バッジ（発行履歴ボタンの●）を最新化する
  distributionLog.onDirtyChange = () => {
    if (ui && ui.viewMode === 'workflow') ui.render();
  };

  /**
   * @type {DistributionLogDialog}
   */
  const distributionLogDialog = new DistributionLogDialog(distributionLog, configManager);
  distributionLogDialog.workflowsProvider = () => {
    const pid = configManager.getActivePortalId();
    return workflowManager.getWorkflows(pid).map(w => ({
      id: w.id,
      title: w.title,
      rev: w.rev || 1
    }));
  };
  ui.distributionLogDialog = distributionLogDialog;

        /**
   * @type {PortalDialog}
   * @description ポータル設定ダイアログのインスタンス。
   */
  const portalDialog = new PortalDialog(dataManager, configManager, (...args) => ui.setPageTitle(...args));
  ui.portalDialog = portalDialog;

  uiRenderCallback = () => ui.render();

  /**
   * @type {WorkflowDialog}
   */
  const workflowDialog = new WorkflowDialog(workflowManager, dataManager, configManager, () => uiRenderCallback(), searchManager, tagManager);
  ui.workflowDialog = workflowDialog;


  const activePortalId = configManager.getActivePortalId();

  // データをロード（常に data/data.json から）
  const loadResult = await dataManager.load(activePortalId);

  // 発行履歴の共有ファイル（data/distribution-log.json）があれば取り込む。
  // 同一PC内なら、別ブラウザ・別ポートで開いても同じ履歴が見られるようにするため。
  // ファイルが無い / file:// で開いている等で失敗しても、localStorage の作業コピーで動作を続ける。
  try {
    const ledgerRes = await fetch(LEDGER_FILE_PATH, { cache: 'no-store' });
    if (ledgerRes.ok) {
      distributionLog.applyFileData(await ledgerRes.json());
    }
  } catch (e) {
    /* 共有ファイルが無い環境ではそのまま localStorage のみで動く */
  }

  // ページタイトルとサブタイトルを設定
  ui.setPageTitle(activePortal.title, activePortal.subtitle);

  if (loadResult.success) {
    // data.json に存在するが configManager 未登録のポータルを自動登録
    // （GitHub Pages など localStorage が空の環境でもポータル一覧に表示されるようにする）
    Object.keys(dataManager.allPortals).forEach(portalId => {
      if (!configManager.getConfig().portals[portalId]) {
        configManager.addPortal({ id: portalId, name: portalId });
      }
    });

    ui.init();

    // 各種ダイアログの初期化
    linkDialog.init(() => uiRenderCallback());
    bulkLinkDialog.init(() => uiRenderCallback());
    portalDialog.init(() => ui.render());
    iconPickerDialog.init();
    workflowDialog.init();
    distributionLogDialog.init();

  } else {
    console.error('Failed to load data/data.json:', loadResult.error);
    document.getElementById('errorArea').style.display = 'block';
    alert('データの自動読み込みに失敗しました (data/data.json)。\nWebサーバー経由でない場合、セキュリティ制限が原因の可能性があります。\n\n下の「ファイルを選択」ボタンから手動でファイルを読み込んでください。');
  }
  // 保存ボタンの状態を更新
  ui.updateSaveButtonState(dataManager.hasUnsavedChanges);

  // テーマ切り替え（ライト/ダーク）
  const themeManager = new ThemeManager();
  themeManager.init();

  // 使い方ガイド
  const usageGuideBtn = document.getElementById('usageGuideBtn');
  const usageGuideDialog = document.getElementById('usageGuideDialog');
  const closeUsageGuideDialogBtn = document.getElementById('closeUsageGuideDialogBtn');
  if (usageGuideBtn && usageGuideDialog) {
    usageGuideBtn.addEventListener('click', () => usageGuideDialog.showModal());
  }
  if (closeUsageGuideDialogBtn && usageGuideDialog) {
    closeUsageGuideDialogBtn.addEventListener('click', () => usageGuideDialog.close());
  }

  // サイドバートグル
  const sidebarToggleBtn = document.getElementById('sidebarToggleBtn');
  const appSidebar = document.getElementById('appSidebar');
  if (sidebarToggleBtn && appSidebar) {
    sidebarToggleBtn.addEventListener('click', () => {
      appSidebar.classList.toggle('collapsed');
    });
  }

  // 各ダイアログ右上の閉じる（×）ボタン。
  // 'cancel' を返して閉じることで、キャンセルボタンと同じ扱いにする
  // （保存扱いされて中途半端なデータが登録されるのを防ぐ）。
  document.querySelectorAll('[data-dialog-close]').forEach(btn => {
    btn.addEventListener('click', () => {
      const dialog = btn.closest('dialog');
      if (dialog) dialog.close('cancel');
    });
  });
});