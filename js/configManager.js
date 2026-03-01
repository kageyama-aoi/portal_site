/**
 * @file configManager.js
 * @brief localStorage を使用してアプリケーションのポータル設定を管理するクラス。
 * @module ConfigManager
 */

/**
 * @constant {string} CONFIG_KEY
 * @description localStorage に設定を保存するためのキー。
 */
const CONFIG_KEY = 'portalAppConfig';

/**
 * @constant {object} defaultConfig
 * @description ポータル設定のデフォルト値。
 * @property {string} activePortalId - デフォルトでアクティブにするポータルのID。
 * @property {object} portals - ポータルオブジェクトのマップ。
 * @property {object} portals.default - デフォルトポータルの詳細。
 * @property {string} portals.default.title - デフォルトポータルのタイトル。
 * @property {string} portals.default.subtitle - デフォルトポータルのサブタイトル。
 */
const defaultConfig = {
  activePortalId: 'default',
  portals: {
    default: {
      title: '📘 Study Portal',
      subtitle: '目的のリソースへ最短でアクセスするためのマイポータル'
    }
  }
};

/**
 * @class ConfigManager
 * @brief アプリケーションのポータル設定（アクティブポータル、ポータルリストなど）を管理するクラス。
 *        設定は localStorage に保存されます。
 */
export class ConfigManager {
  /**
   * @property {object} config - 現在のアプリケーション設定。
   * @property {string} config.activePortalId - アクティブなポータルのID。
   * @property {object} config.portals - ポータルオブジェクトのマップ。
   */
  config;

  /**
   * ConfigManager の新しいインスタンスを作成します。
   * インスタンス作成時に localStorage から設定をロードします。
   */
  constructor() {
    this.config = this._load();
  }

  /**
   * localStorage から設定をロードします。
   * 読み込みに失敗した場合や設定が存在しない場合は、デフォルト設定を返します。
   * @private
   * @returns {object} ロードされた設定、またはデフォルト設定。
   */
  _load() {
    try {
      const storedConfig = localStorage.getItem(CONFIG_KEY);
      if (storedConfig) {
        const parsed = JSON.parse(storedConfig);
        // Ensure essential keys exist, otherwise return default to prevent errors
        if(parsed.portals && parsed.activePortalId){
          return parsed;
        }
      }
    } catch (e) {
      console.error('Failed to parse config from localStorage', e);
    }
    // Return a deep copy of the default config if anything goes wrong or no config found
    return JSON.parse(JSON.stringify(defaultConfig));
  }

  /**
   * 現在の設定を localStorage に保存します。
   * @private
   */
  _save() {
    try {
      localStorage.setItem(CONFIG_KEY, JSON.stringify(this.config));
    } catch (e) {
      console.error('Failed to save config to localStorage', e);
    }
  }

  /**
   * 現在の全設定オブジェクトを取得します。
   * @returns {object} 現在の全設定。
   */
  getConfig() {
    return this.config;
  }

  /**
   * 現在アクティブなポータルの詳細情報を取得します。
   * @returns {object|null} アクティブなポータルの情報、またはアクティブなポータルが見つからない場合は `null`。
   */
  getActivePortal() {
    const activeId = this.config.activePortalId;
    return this.config.portals[activeId] || null;
  }
  
  /**
   * 指定されたIDのポータルをアクティブに設定します。
   * 設定後、localStorage に保存されます。
   * @param {string} portalId - アクティブにするポータルのID。
   * @returns {boolean} ポータルが正常にアクティブにされた場合は `true`、そうでない場合は `false`。
   */
  setActivePortal(portalId) {
    if (this.config.portals[portalId]) {
      this.config.activePortalId = portalId;
      this._save();
      return true;
    }
    return false;
  }
  
  /**
   * アクティブなポータルの情報（タイトル、サブタイトル）を更新します。
   * 更新後、localStorage に保存されます。
   * @param {object} updates - 更新する情報を含むオブジェクト。
   * @param {string} [updates.title] - 新しいポータルのタイトル。
   * @param {string} [updates.subtitle] - 新しいポータルのサブタイトル。
   */
  updateActivePortalInfo({ title, subtitle }) {
    const activePortal = this.getActivePortal();
    if (activePortal) {
      if (title !== undefined) activePortal.title = title;
      if (subtitle !== undefined) activePortal.subtitle = subtitle;
      this._save();
    }
  }
  
  /**
   * 現在アクティブなポータルのIDを取得します。
   * @returns {string} アクティブなポータルのID。
   */
  getActivePortalId() {
    return this.config.activePortalId;
  }

  /**
   * 新しいポータルを追加します。
   * 追加後、localStorage に保存されます。
   * @param {object} portalData - 追加するポータルのデータ。
   * @param {string} portalData.id - 新しいポータルのユニークID。
   * @param {string} portalData.name - 新しいポータルの名前（タイトルとして使用）。
   */
  addPortal({ id, name }) {
    const newPortal = {
      title: name,
      subtitle: `${name} links and resources`
    };
    this.config.portals[id] = newPortal;
    this._save();
  }
}
