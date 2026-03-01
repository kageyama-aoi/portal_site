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
import { CategoryDialog } from './dialogs/categoryDialog.js';

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
   * @type {LinkDialog}
   * @description 単一リンク編集ダイアログのインスタンス。
   */
  const linkDialog = new LinkDialog(dataManager, () => uiRenderCallback(), iconPickerDialog); 

      /**
       * @type {BulkLinkDialog}
       * @description 複数リンク一括追加ダイアログのインスタンス。
       */
      const bulkLinkDialog = new BulkLinkDialog(dataManager, () => uiRenderCallback(), iconPickerDialog); 
      
      /**
       * @type {CategoryDialog}
       * @description カテゴリ編集ダイアログのインスタンス。
       */
      const categoryDialog = new CategoryDialog(dataManager);
  
      /**
       * @type {UI}
       * @description ユーザーインターフェースの描画とイベント処理を管理するインスタンス。
       */
      ui = new UI(dataManager, configManager, categoryDialog, linkDialog, bulkLinkDialog); // categoryDialogを追加
        /**
   * @type {PortalDialog}
   * @description ポータル設定ダイアログのインスタンス。
   */
  const portalDialog = new PortalDialog(dataManager, configManager, (...args) => ui.setPageTitle(...args));
  ui.portalDialog = portalDialog; 
  
  uiRenderCallback = () => ui.render();


  const activePortalId = configManager.getActivePortalId();

  // データをロード（常に data/data.json から）
  const loadResult = await dataManager.load(activePortalId);

  // ページタイトルとサブタイトルを設定
  ui.setPageTitle(activePortal.title, activePortal.subtitle);

  if (loadResult.success) {
    ui.init();

    // 各種ダイアログの初期化
    categoryDialog.init(() => uiRenderCallback());
    linkDialog.init(() => uiRenderCallback());
    bulkLinkDialog.init(() => uiRenderCallback());
    portalDialog.init(() => ui.render());
    iconPickerDialog.init();

  } else {
    console.error('Failed to load data/data.json:', loadResult.error);
    document.getElementById('errorArea').style.display = 'block';
    alert('データの自動読み込みに失敗しました (data/data.json)。\nWebサーバー経由でない場合、セキュリティ制限が原因の可能性があります。\n\n下の「ファイルを選択」ボタンから手動でファイルを読み込んでください。');
  }
  // 保存ボタンの状態を更新
  ui.updateSaveButtonState(dataManager.hasUnsavedChanges);
});