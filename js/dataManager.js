/**
 * @file dataManager.js
 * @brief データの状態管理と永続化ロジックを提供するクラス。
 * @module DataManager
 */

/**
 * @class DataManager
 * @brief アプリケーションのリンクデータを管理するクラス。
 *        データの取得、追加、更新、削除、保存（ダウンロード）、インポートなどの機能を提供します。
 */
export class DataManager {
  /**
   * @property {Array<Link>} data - 現在アクティブなポータルのリンクを保持するフラットな配列。
   */
  data = [];
  /**
   * @property {object} allPortals - すべてのポータルのリンクデータを保持するオブジェクト。
   */
  allPortals = {};
  /**
   * @property {object} allWorkflows - すべてのポータルのワークフローデータを保持するオブジェクト。
   */
  allWorkflows = {};
  /**
   * @property {object} allTagRegistry - ポータルごとに事前登録された「まだリンク0件のタグ」を保持するオブジェクト。
   *   リンクに実際に使われているタグは data 側から動的に集計されるため、
   *   ここにはリンクとまだ紐づいていないタグ名のみを保持すれば十分。
   */
  allTagRegistry = {};
  /**
   * @property {boolean} hasUnsavedChanges - 未保存の変更があるかどうかを示すフラグ。
   */
  hasUnsavedChanges = false;
  /**
   * @property {function(): void} onDirty - データに変更があった際に呼び出されるコールバック関数。
   */
  onDirty;

  /**
   * DataManagerの新しいインスタンスを作成します。
   * @param {function(): void} onDirty - データに変更があったときに呼び出されるコールバック関数。
   */
  constructor(onDirty) {
    this.onDirty = onDirty;
  }

  /**
   * すべてのリンクのデータを取得します。
   * @returns {Array<Link>} すべてのデータ。
   */
  getData() {
    return JSON.parse(JSON.stringify(this.data));
  }

  /**
   * 指定されたIDを持つリンクを取得します。
   * @param {string} linkId - 取得するリンクのID。
   * @returns {Link|undefined} 見つかったリンク、または見つからなかった場合は `undefined`。
   */
  getLink(linkId) {
    return this.data.find(l => l.id === linkId);
  }

  /**
   * データに変更があったことをマークし、`onDirty` コールバックを呼び出します。
   */
  markAsDirty() {
    this.hasUnsavedChanges = true;
    if (this.onDirty) {
      this.onDirty();
    }
  }

  /**
   * 変更が保存されたことをマークします。
   */
  markAsClean() {
    this.hasUnsavedChanges = false;
  }

  /**
   * ユニークなIDを生成します。
   * @private
   * @param {string} prefix - IDのプレフィックス (例: 'link')。
   * @returns {string} 生成されたユニークID。
   */
  _generateId(prefix) {
    return `${prefix}_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
  }

  /**
   * プライベートヘルパー: 指定されたファイルからJSONデータを読み込み、パースします。
   * @private
   * @param {File} file - 読み込むファイルオブジェクト。
   * @returns {Promise<any>} パースされたJSONデータを含むPromise。
   */
  _readJsonFile(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (ev) => {
        try {
          resolve(JSON.parse(ev.target.result));
        } catch (err) {
          reject(err);
        }
      };
      reader.onerror = (err) => reject(err);
      reader.readAsText(file);
    });
  }

  /**
   * 旧形式（カテゴリ配列: `[{id, title, isOpen, links: [...]}]`）のポータルデータを、
   * 新形式（リンクのフラット配列、`tags`のみで分類）へ変換します。
   * カテゴリのタイトルは、そのカテゴリに属していた各リンクの初期タグとして引き継がれます
   * （既に同名タグを持つ場合は重複させません）。
   * 既にフラット形式（要素が`.url`を持つ）の場合はそのまま返します。
   * @private
   * @param {Array<object>} portalArray - 1ポータル分のデータ配列。
   * @returns {{data: Array<Link>, migrated: boolean}} 変換後のデータと、変換が発生したかどうか。
   */
  _migrateLegacyPortal(portalArray) {
    if (!Array.isArray(portalArray) || portalArray.length === 0) {
      return { data: portalArray ?? [], migrated: false };
    }
    // 配列の先頭要素だけで新旧形式を判定すると、旧形式（カテゴリ）と新形式（フラットな
    // リンク）が混在する配列で、先頭以外の新形式リンクが `.links` を持たないために
    // flatMap で無言で消えてしまう。要素ごとに個別判定することでこれを防ぐ。
    const hasLegacyCategory = portalArray.some(entry => entry && Array.isArray(entry.links));
    if (!hasLegacyCategory) {
      return { data: portalArray, migrated: false };
    }
    const flatLinks = portalArray.flatMap(entry => {
      if (entry && Array.isArray(entry.links)) {
        return entry.links.map(link => ({
          ...link,
          tags: Array.from(new Set([...(link.tags || []), entry.title]))
        }));
      }
      return entry ? [entry] : [];
    });
    return { data: flatLinks, migrated: true };
  }

  /**
   * 常に data/data.json を fetch し、指定ポータルIDのリンクをロードします。
   * 旧形式（カテゴリ配列）のポータルは自動的にタグ形式へ変換されます。
   * @async
   * @param {string} [portalId='default'] - ロードするポータルのID。
   * @returns {Promise<{success: boolean, data?: Array<Link>, error?: Error}>}
   */
  async load(portalId = 'default') {
    try {
      const response = await fetch('data/data.json', { cache: 'no-store' });
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const parsed = await response.json();
      // 旧形式（配列）への後方互換対応
      if (Array.isArray(parsed)) {
        this.allPortals = { default: parsed };
        this.allWorkflows = {};
        this.allTagRegistry = {};
      } else {
        this.allPortals = parsed.portals || {};
        this.allWorkflows = parsed.workflows || {};
        this.allTagRegistry = parsed.tagRegistry || {};
      }
      if (this._migratePortals()) {
        this.markAsDirty();
      }
      this.data = this.allPortals[portalId] ?? [];
      return { success: true, data: this.data };
    } catch (e) {
      console.error('Data load failed:', e);
      return { success: false, error: e };
    }
  }

  /**
   * ユーザーが選択したファイルからデータを手動で読み込みます。
   * 新形式（{portals:{...}}）と旧形式（カテゴリ配列）の両方に対応します。
   * @async
   * @param {File} file - 読み込むファイルオブジェクト。
   * @param {string} [portalId='default'] - 対象ポータルID（旧形式の場合に使用）。
   * @returns {Promise<Array<Link>>} 読み込まれたデータを含むPromise。
   */
  async loadFromFile(file, portalId = 'default') {
    try {
      const json = await this._readJsonFile(file);
      if (json && typeof json === 'object' && !Array.isArray(json) && json.portals) {
        this.allPortals = json.portals;
        this.allWorkflows = json.workflows || {};
        this.allTagRegistry = json.tagRegistry || {};
      } else if (Array.isArray(json)) {
        this.allPortals[portalId] = json;
        this.allWorkflows = {};
        this.allTagRegistry = {};
      } else {
        throw new Error('Invalid data format.');
      }
      this._migratePortals();
      this.data = this.allPortals[portalId] ?? [];
      return this.data;
    } catch (err) {
      throw err;
    }
  }

  /**
   * ユーザーが選択したファイルからデータをインポートし、現在のポータルデータを差し替えます。
   * データは変更されたものとしてマークされます。
   * @async
   * @param {File} file - インポートするファイルオブジェクト。
   * @param {string} [portalId='default'] - 対象ポータルID。
   * @returns {Promise<void>}
   */
  async importData(file, portalId = 'default') {
    try {
      const json = await this._readJsonFile(file);
      if (json && typeof json === 'object' && !Array.isArray(json) && json.portals) {
        this.allPortals = json.portals;
        this.allWorkflows = json.workflows || {};
        this.allTagRegistry = json.tagRegistry || {};
      } else if (Array.isArray(json)) {
        this.allPortals[portalId] = json;
        this.allWorkflows = {};
        this.allTagRegistry = {};
      } else {
        throw new Error('Invalid data format.');
      }
      this._migratePortals();
      this.data = this.allPortals[portalId] ?? [];
      this.markAsDirty();
    } catch (err) {
      throw err;
    }
  }

  /**
   * `this.allPortals` の全ポータルに対して旧形式からの変換を適用します。
   * @private
   * @returns {boolean} いずれかのポータルで変換が発生した場合 true。
   */
  _migratePortals() {
    let anyMigrated = false;
    Object.keys(this.allPortals).forEach(portalId => {
      const { data, migrated } = this._migrateLegacyPortal(this.allPortals[portalId]);
      this.allPortals[portalId] = data;
      if (migrated) anyMigrated = true;
    });
    return anyMigrated;
  }

  /**
   * 全ポータルデータを data.json としてダウンロード（保存）します。
   * データは保存済みとしてマークされます。
   * @param {string} [portalId='default'] - 現在アクティブなポータルID（allPortals を更新するために使用）。
   */
  save(portalId = 'default') {
    this.allPortals[portalId] = this.data;
    const dataStr = JSON.stringify({ portals: this.allPortals, workflows: this.allWorkflows, tagRegistry: this.allTagRegistry }, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = 'data.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    this.markAsClean();
  }

  /**
   * 新しいリンクを追加します。
   * @param {object} linkData - 追加するリンクのデータ（タイトル、URL、tagsなど）。
   */
  addLink(linkData) {
    this.data.push({
      id: this._generateId('link'),
      tags: [],
      ...linkData
    });
    this.markAsDirty();
  }

  /**
   * 指定されたIDを持つリンクを更新します。
   * @param {string} linkId - 更新するリンクのID。
   * @param {object} linkData - 更新するリンクの新しいデータ。
   */
  updateLink(linkId, linkData) {
    const link = this.getLink(linkId);
    if (link) {
      Object.assign(link, linkData);
      this.markAsDirty();
    }
  }

  /**
   * 指定されたIDを持つリンクを削除します。
   * @param {string} linkId - 削除するリンクのID。
   */
  deleteLink(linkId) {
    const initialLength = this.data.length;
    this.data = this.data.filter(l => l.id !== linkId);
    if (this.data.length < initialLength) {
      this.markAsDirty();
    }
  }

  /**
   * 複数のリンクを一括で追加します。
   * @param {Array<object>} links - 追加するリンクのデータ配列。
   */
  addBulkLinks(links) {
    const newLinks = links.map(link => ({
      id: this._generateId('link'),
      tags: [],
      ...link
    }));
    this.data.push(...newLinks);
    this.markAsDirty();
  }
}
