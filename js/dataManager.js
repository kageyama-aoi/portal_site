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
   * @property {Array<Category>} data - アプリケーションのすべてのカテゴリとリンクを保持する配列。
   */
  data = [];
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
    return this.data;
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
    return cat ? cat.links.find(l => l.id === linkId) : null;
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
   * @returns {Promise<Array<Category>>} パースされたJSONデータを含むPromise。
   * @throws {Error} データ形式が不正な場合（配列でない場合）。
   */
  _readJsonFile(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (ev) => {
        try {
          const json = JSON.parse(ev.target.result);
          if (!Array.isArray(json)) {
             throw new Error('Invalid data format. Expected an array.');
          }
          resolve(json);
        } catch (err) {
          reject(err);
        }
      };
      reader.onerror = (err) => reject(err);
      reader.readAsText(file);
    });
  }

  /**
   * 指定されたファイル名から初期データを読み込みます。
   * 主にアプリケーション起動時に使用されます。
   * @async
   * @param {string} [fileName='data.json'] - 読み込むJSONファイルの名前。
   * @returns {Promise<{success: boolean, data?: Array<Category>, error?: Error}>} 読み込みの成否とデータまたはエラー。
   */
  async load(fileName = 'data.json') {
    // ファイルパスを 'data/' ディレクトリ内から取得するように調整
    const filePath = fileName.startsWith('data/') ? fileName : `data/${fileName}`;
    try {
      const response = await fetch(filePath);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      this.data = await response.json();
      return { success: true, data: this.data };
    } catch (e) {
      console.error(`Data load failed for ${filePath}:`, e);
      return { success: false, error: e };
    }
  }

  /**
   * ユーザーが選択したファイルからデータを手動で読み込みます。
   * @async
   * @param {File} file - 読み込むファイルオブジェクト。
   * @returns {Promise<Array<Category>>} 読み込まれたデータを含むPromise。
   * @throws {Error} ファイル読み込みまたはJSONパースに失敗した場合。
   */
  async loadFromFile(file) {
    try {
      const json = await this._readJsonFile(file);
      this.data = json;
      return this.data;
    } catch (err) {
      throw err;
    }
  }
  
  /**
   * ユーザーが選択したファイルからデータをインポートし、現在のデータを差し替えます。
   * データは変更されたものとしてマークされます。
   * @async
   * @param {File} file - インポートするファイルオブジェクト。
   * @returns {Promise<void>} インポート操作が完了したときに解決されるPromise。
   * @throws {Error} ファイル読み込みまたはJSONパースに失敗した場合。
   */
  async importData(file) {
    try {
      const json = await this._readJsonFile(file);
      this.data = json;
      this.markAsDirty();
    } catch (err) {
      throw err;
    }
  }

  /**
   * 現在のデータをJSONファイルとしてダウンロード（保存）します。
   * データは保存済みとしてマークされます。
   * @param {string} [fileName='data.json'] - 保存するファイルの名前。
   */
  save(fileName = 'data.json') {
    const dataStr = JSON.stringify(this.data, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
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
    this.data = this.data.filter(c => c.id !== id);
    this.markAsDirty();
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
      cat.links = cat.links.filter(l => l.id !== linkId);
      this.markAsDirty();
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