/**
 * @file tagManager.js
 * @brief まだどのリンクにも紐づいていない「事前登録タグ」を管理するクラス。
 *        リンクに実際に使われているタグは data 側から動的に集計されるため（SearchManager.getAllTags）、
 *        ここでは「登録だけ済ませておきたい、リンク0件のタグ」だけを保持します。
 * @module TagManager
 */

/**
 * @class TagManager
 * @brief ポータルごとの事前登録タグを管理します。
 *        DataManagerのallTagRegistryを参照・更新します。
 */
export class TagManager {
  /** @property {DataManager} dataManager */
  dataManager;

  /**
   * @param {DataManager} dataManager
   */
  constructor(dataManager) {
    this.dataManager = dataManager;
  }

  /**
   * 指定ポータルの事前登録タグ一覧を返します。
   * @param {string} portalId
   * @returns {string[]}
   */
  getRegisteredTags(portalId) {
    return [...(this.dataManager.allTagRegistry[portalId] || [])];
  }

  /**
   * 新しいタグを事前登録します（空文字・重複は無視）。
   * @param {string} portalId
   * @param {string} tagName
   * @returns {boolean} 実際に追加された場合 true。
   */
  addTag(portalId, tagName) {
    const name = (tagName || '').trim();
    if (!name) return false;
    if (!this.dataManager.allTagRegistry[portalId]) {
      this.dataManager.allTagRegistry[portalId] = [];
    }
    const list = this.dataManager.allTagRegistry[portalId];
    if (list.includes(name)) return false;
    list.push(name);
    this.dataManager.markAsDirty();
    return true;
  }

  /**
   * 事前登録タグを削除します（リンクに実際に使われているタグには影響しません）。
   * @param {string} portalId
   * @param {string} tagName
   */
  removeTag(portalId, tagName) {
    if (!this.dataManager.allTagRegistry[portalId]) return;
    this.dataManager.allTagRegistry[portalId] =
      this.dataManager.allTagRegistry[portalId].filter(t => t !== tagName);
    this.dataManager.markAsDirty();
  }
}
