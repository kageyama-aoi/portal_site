/**
 * @file memoryManager.js
 * @brief リンクの訪問履歴をlocalStorageで管理するクラス。
 *        最近使ったリンク・よく使うリンクの集計に使用します。
 * @module MemoryManager
 */

/**
 * @class MemoryManager
 * @brief リンクごとの訪問回数・最終訪問日時をlocalStorageに保存し、
 *        「最近使った」「よく使う」のランキングを提供します。
 *        data.json は汚染しません。
 */
export class MemoryManager {
  static STORAGE_KEY = 'portalMemory_v1';

  /** @property {object} _data - { [linkId]: { visitCount, lastVisited } } */
  _data = {};

  constructor() {
    this._data = this._load();
  }

  /**
   * @private
   */
  _load() {
    try {
      return JSON.parse(localStorage.getItem(MemoryManager.STORAGE_KEY)) || {};
    } catch {
      return {};
    }
  }

  /**
   * @private
   */
  _save() {
    localStorage.setItem(MemoryManager.STORAGE_KEY, JSON.stringify(this._data));
  }

  /**
   * 指定リンクの訪問を記録します。
   * @param {string} linkId
   */
  recordVisit(linkId) {
    if (!this._data[linkId]) {
      this._data[linkId] = { visitCount: 0, lastVisited: null };
    }
    this._data[linkId].visitCount += 1;
    this._data[linkId].lastVisited = Date.now();
    this._save();
  }

  /**
   * 指定リンクの訪問情報を返します。
   * @param {string} linkId
   * @returns {{ visitCount: number, lastVisited: number|null }}
   */
  getVisitInfo(linkId) {
    return this._data[linkId] || { visitCount: 0, lastVisited: null };
  }

  /**
   * 最近訪問したリンクのIDを新しい順で返します。
   * @param {number} [limit=8]
   * @returns {string[]}
   */
  getRecentLinkIds(limit = 8) {
    return Object.entries(this._data)
      .filter(([, v]) => v.lastVisited)
      .sort((a, b) => b[1].lastVisited - a[1].lastVisited)
      .slice(0, limit)
      .map(([id]) => id);
  }

  /**
   * 訪問回数が多いリンクのIDを返します（2回以上）。
   * @param {number} [limit=8]
   * @returns {string[]}
   */
  getFrequentLinkIds(limit = 8) {
    return Object.entries(this._data)
      .filter(([, v]) => v.visitCount >= 2)
      .sort((a, b) => b[1].visitCount - a[1].visitCount)
      .slice(0, limit)
      .map(([id]) => id);
  }

  /**
   * タイムスタンプを「○分前」「○日前」形式に変換します。
   * @param {number|null} timestamp
   * @returns {string}
   */
  formatTimeAgo(timestamp) {
    if (!timestamp) return '';
    const diff = Date.now() - timestamp;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);
    if (minutes < 1) return 'たった今';
    if (minutes < 60) return `${minutes}分前`;
    if (hours < 24) return `${hours}時間前`;
    if (days < 30) return `${days}日前`;
    return `${Math.floor(days / 30)}ヶ月前`;
  }
}
