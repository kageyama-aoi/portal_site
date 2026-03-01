/**
 * @file dataManager.js
 * @brief データの状態管理と永続化ロジックを提供するクラス。
 * @module DataManager
 */

/**
 * @class DataManager
 * @brief アプリケーションのカテゴリとリンクのデータを管理するクラス。
 *        データの取得、追加、更新、削除、移動、保存（ダウンロード）、インポートなどの機能を提供します。
 */
export class DataManager {
  /**
   * @property {Array<Category>} data - 現在アクティブなポータルのカテゴリとリンクを保持する配列。
   */
  data = [];
  /**
   * @property {object} allPortals - すべてのポータルのカテゴリデータを保持するオブジェクト。
   */
  allPortals = {};
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
   * すべてのカテゴリとリンクのデータを取得します。
   * @returns {Array<Category>} すべてのデータ。
   */
  getData() {
    return JSON.parse(JSON.stringify(this.data));
  }

  /**
   * 指定されたIDを持つカテゴリを取得します。
   * @param {string} id - 取得するカテゴリのID。
   * @returns {Category|undefined} 見つかったカテゴリ、または見つからなかった場合は `undefined`。
   */
  getCategory(id) {
    return this.data.find(c => c.id === id);
  }
  
  /**
   * 指定されたカテゴリ内の指定されたIDを持つリンクを取得します。
   * @param {string} catId - リンクが属するカテゴリのID。
   * @param {string} linkId - 取得するリンクのID。
   * @returns {Link|null} 見つかったリンク、または見つからなかった場合は `null`。
   */
  getLink(catId, linkId) {
    const cat = this.getCategory(catId);
    return cat ? cat.links.find(l => l.id === linkId) : undefined;
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
   * @param {string} prefix - IDのプレフィックス (例: 'cat', 'link')。
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
   * 常に data/data.json を fetch し、指定ポータルIDのカテゴリをロードします。
   * @async
   * @param {string} [portalId='default'] - ロードするポータルのID。
   * @returns {Promise<{success: boolean, data?: Array<Category>, error?: Error}>}
   */
  async load(portalId = 'default') {
    try {
      const response = await fetch('data/data.json');
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const parsed = await response.json();
      // 旧形式（配列）への後方互換対応
      if (Array.isArray(parsed)) {
        this.allPortals = { default: parsed };
      } else {
        this.allPortals = parsed.portals || {};
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
   * @returns {Promise<Array<Category>>} 読み込まれたデータを含むPromise。
   */
  async loadFromFile(file, portalId = 'default') {
    try {
      const json = await this._readJsonFile(file);
      if (json && typeof json === 'object' && !Array.isArray(json) && json.portals) {
        this.allPortals = json.portals;
      } else if (Array.isArray(json)) {
        this.allPortals[portalId] = json;
      } else {
        throw new Error('Invalid data format.');
      }
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
      } else if (Array.isArray(json)) {
        this.allPortals[portalId] = json;
      } else {
        throw new Error('Invalid data format.');
      }
      this.data = this.allPortals[portalId] ?? [];
      this.markAsDirty();
    } catch (err) {
      throw err;
    }
  }

  /**
   * 全ポータルデータを data.json としてダウンロード（保存）します。
   * データは保存済みとしてマークされます。
   * @param {string} [portalId='default'] - 現在アクティブなポータルID（allPortals を更新するために使用）。
   */
  save(portalId = 'default') {
    this.allPortals[portalId] = this.data;
    const dataStr = JSON.stringify({ portals: this.allPortals }, null, 2);
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
   * 新しいカテゴリを追加します。
   * @param {string} title - 新しいカテゴリのタイトル。
   */
  addCategory(title) {
    this.data.push({
      id: this._generateId('cat'),
      title: title,
      isOpen: true,
      links: []
    });
    this.markAsDirty();
  }
  
  /**
   * 指定されたIDのカテゴリのタイトルを更新します。
   * @param {string} id - 更新するカテゴリのID。
   * @param {string} title - 新しいカテゴリのタイトル。
   */
  updateCategory(id, title) {
    const cat = this.getCategory(id);
    if (cat) {
      cat.title = title;
      this.markAsDirty();
    }
  }
  
  /**
   * 指定されたIDのカテゴリを削除します。
   * @param {string} id - 削除するカテゴリのID。
   */
  deleteCategory(id) {
    const initialLength = this.data.length;
    this.data = this.data.filter(c => c.id !== id);
    if (this.data.length < initialLength) {
      this.markAsDirty();
    }
  }

  /**
   * カテゴリの順序を移動します。
   * @param {number} fromIndex - 移動元カテゴリのインデックス。
   * @param {number} toIndex - 移動先カテゴリのインデックス。
   */
  moveCategory(fromIndex, toIndex) {
    // 境界チェック
    if (fromIndex < 0 || fromIndex >= this.data.length || toIndex < 0 || toIndex > this.data.length) {
      return;
    }
    const [item] = this.data.splice(fromIndex, 1); // 元の位置から削除
    this.data.splice(toIndex, 0, item); // 新しい位置に挿入
    this.markAsDirty();
  }
  
  /**
   * 指定されたカテゴリに新しいリンクを追加します。
   * @param {string} catId - リンクを追加するカテゴリのID。
   * @param {object} linkData - 追加するリンクのデータ（タイトル、URLなど）。
   */
  addLink(catId, linkData) {
    const cat = this.getCategory(catId);
    if (cat) {
       cat.links.push({
        id: this._generateId('link'),
        ...linkData
      });
      this.markAsDirty();
    }
  }
  
  /**
   * 指定されたカテゴリ内の指定されたIDを持つリンクを更新します。
   * @param {string} catId - リンクが属するカテゴリのID。
   * @param {string} linkId - 更新するリンクのID。
   * @param {object} linkData - 更新するリンクの新しいデータ。
   */
  updateLink(catId, linkId, linkData) {
     const cat = this.getCategory(catId);
     if (cat) {
       const link = cat.links.find(l => l.id === linkId);
       if (link) {
         Object.assign(link, linkData);
         this.markAsDirty();
       }
     }
  }

  /**
   * 指定されたカテゴリ内の指定されたIDを持つリンクを削除します。
   * @param {string} catId - リンクが属するカテゴリのID。
   * @param {string} linkId - 削除するリンクのID。
   */
  deleteLink(catId, linkId) {
    const cat = this.getCategory(catId);
    if (cat) {
      const initialLinksLength = cat.links.length;
      cat.links = cat.links.filter(l => l.id !== linkId);
      if (cat.links.length < initialLinksLength) {
        this.markAsDirty();
      }
    }
  }

  /**
   * 指定されたカテゴリ内のリンクの順序を移動します。
   * @param {number} catIndex - リンクが属するカテゴリのインデックス。
   * @param {number} fromIndex - 移動元リンクのインデックス。
   * @param {number} toIndex - 移動先リンクのインデックス。
   */
  moveLink(catIndex, fromIndex, toIndex) {
    const cat = this.data[catIndex];
    // 境界チェック
    if (!cat || fromIndex < 0 || fromIndex >= cat.links.length || toIndex < 0 || toIndex > cat.links.length) {
      return;
    }
    const [item] = cat.links.splice(fromIndex, 1); // 元の位置から削除
    cat.links.splice(toIndex, 0, item); // 新しい位置に挿入
    this.markAsDirty();
  }

  /**
   * 指定されたカテゴリに複数のリンクを一括で追加します。
   * @param {string} catId - リンクを追加するカテゴリのID。
   * @param {Array<object>} links - 追加するリンクのデータ配列。
   */
  addBulkLinks(catId, links) {
    const cat = this.getCategory(catId);
    if (cat) {
      const newLinks = links.map(link => ({
        id: this._generateId('link'),
        ...link
      }));
      cat.links.push(...newLinks);
      this.markAsDirty();
    }
  }
}