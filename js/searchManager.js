/**
 * @file searchManager.js
 * @brief リンクとワークフローの横断検索・タグ収集を管理するクラス。
 * @module SearchManager
 */

/**
 * @class SearchManager
 * @brief ポータル内のリンクをタイトル・メモ・タグ・キーワードで横断検索し、
 *        タグ一覧の収集も行います。
 */
export class SearchManager {
  /** @property {DataManager} dataManager */
  dataManager;

  /**
   * @param {DataManager} dataManager
   */
  constructor(dataManager) {
    this.dataManager = dataManager;
  }

  /**
   * 現在のポータルのリンクを横断検索します。
   * @param {string} query - 検索キーワード（空文字で全件）
   * @param {object} [filters={}]
   * @param {string[]} [filters.tags=[]] - AND絞り込みするタグ配列
   * @param {string|null} [filters.badge=null] - バッジ絞り込み
   * @param {string|null} [filters.freq=null] - 頻度絞り込み ('daily'|'weekly'|'monthly'|'rare')
   * @returns {{ link: object, catId: string, catTitle: string }[]}
   */
  search(query, { tags = [], badge = null, freq = null } = {}) {
    const data = this.dataManager.getData();
    const q = (query || '').trim().toLowerCase();
    const results = [];

    data.forEach(cat => {
      cat.links.forEach(link => {
        const textMatch = !q ||
          link.title.toLowerCase().includes(q) ||
          (link.memo || '').toLowerCase().includes(q) ||
          (link.tags || []).some(t => t.toLowerCase().includes(q)) ||
          (link.keywords || []).some(k => k.toLowerCase().includes(q));

        const tagMatch = tags.length === 0 ||
          tags.every(tag => (link.tags || []).includes(tag));

        const badgeMatch = !badge || link.badge === badge;
        const freqMatch = !freq || link.freq === freq;

        if (textMatch && tagMatch && badgeMatch && freqMatch) {
          results.push({ link, catId: cat.id, catTitle: cat.title });
        }
      });
    });

    return results;
  }

  /**
   * 現在のポータルで使われているタグをすべて収集します。
   * @returns {string[]} ソート済みタグ配列
   */
  getAllTags() {
    const data = this.dataManager.getData();
    const tagSet = new Set();
    data.forEach(cat => {
      cat.links.forEach(link => {
        (link.tags || []).forEach(t => { if (t) tagSet.add(t); });
      });
    });
    return Array.from(tagSet).sort();
  }

  /**
   * freq='rare' のリンクを全カテゴリから収集します。
   * @returns {{ link: object, catId: string, catTitle: string }[]}
   */
  getRareLinks() {
    return this.search('', { freq: 'rare' });
  }

  /**
   * 与えられたIDのリンクオブジェクトを全カテゴリから探します。
   * @param {string} linkId
   * @returns {{ link: object, catId: string, catTitle: string }|null}
   */
  findLinkById(linkId) {
    const data = this.dataManager.getData();
    for (const cat of data) {
      const link = cat.links.find(l => l.id === linkId);
      if (link) return { link, catId: cat.id, catTitle: cat.title };
    }
    return null;
  }

  /**
   * 全リンクをフラットなリストで返します（カテゴリ情報付き）。
   * @returns {{ link: object, catId: string, catTitle: string }[]}
   */
  getAllLinks() {
    return this.search('');
  }
}
