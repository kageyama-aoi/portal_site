/**
 * @file workflowManager.js
 * @brief ワークフロー（作業フロー）のCRUDを管理するクラス。
 *        ワークフローはdata.jsonの "workflows" キーに保存されます。
 * @module WorkflowManager
 */

/**
 * @typedef {object} WorkflowStep
 * @property {number} step - ステップ番号（1始まり）
 * @property {string} title - ステップのタイトル
 * @property {string} memo - ステップの補足説明
 * @property {string|null} linkId - 関連リンクのID（省略可）
 */

/**
 * @typedef {object} Workflow
 * @property {string} id - ワークフローのユニークID
 * @property {string} title - ワークフロータイトル
 * @property {string} description - ワークフローの説明
 * @property {string[]} tags - タグ配列
 * @property {string} freq - 頻度 ('daily'|'weekly'|'monthly'|'rare')
 * @property {WorkflowStep[]} steps - ステップ配列
 */

/**
 * @class WorkflowManager
 * @brief ポータルごとのワークフローを管理します。
 *        DataManagerのallWorkflowsを参照・更新します。
 */
export class WorkflowManager {
  /** @property {DataManager} dataManager */
  dataManager;

  /**
   * @param {DataManager} dataManager
   */
  constructor(dataManager) {
    this.dataManager = dataManager;
  }

  /**
   * 指定ポータルのワークフロー一覧を返します（深いコピー）。
   * @param {string} portalId
   * @returns {Workflow[]}
   */
  getWorkflows(portalId) {
    return JSON.parse(JSON.stringify(this.dataManager.allWorkflows[portalId] || []));
  }

  /**
   * 指定IDのワークフローを返します。
   * @param {string} portalId
   * @param {string} workflowId
   * @returns {Workflow|undefined}
   */
  getWorkflow(portalId, workflowId) {
    return (this.dataManager.allWorkflows[portalId] || []).find(w => w.id === workflowId);
  }

  /**
   * 新しいワークフローを追加します。
   * @param {string} portalId
   * @param {Partial<Workflow>} workflowData
   * @returns {Workflow} 追加されたワークフロー
   */
  addWorkflow(portalId, workflowData) {
    if (!this.dataManager.allWorkflows[portalId]) {
      this.dataManager.allWorkflows[portalId] = [];
    }
    const wf = {
      id: this._generateId('wf'),
      title: '',
      description: '',
      tags: [],
      freq: 'rare',
      steps: [],
      ...workflowData
    };
    this.dataManager.allWorkflows[portalId].push(wf);
    this.dataManager.markAsDirty();
    return wf;
  }

  /**
   * ワークフローを更新します。
   * @param {string} portalId
   * @param {string} workflowId
   * @param {Partial<Workflow>} workflowData
   */
  updateWorkflow(portalId, workflowId, workflowData) {
    const workflows = this.dataManager.allWorkflows[portalId] || [];
    const idx = workflows.findIndex(w => w.id === workflowId);
    if (idx !== -1) {
      this.dataManager.allWorkflows[portalId][idx] = {
        ...this.dataManager.allWorkflows[portalId][idx],
        ...workflowData
      };
      this.dataManager.markAsDirty();
    }
  }

  /**
   * ワークフローを削除します。
   * @param {string} portalId
   * @param {string} workflowId
   */
  deleteWorkflow(portalId, workflowId) {
    if (this.dataManager.allWorkflows[portalId]) {
      this.dataManager.allWorkflows[portalId] =
        this.dataManager.allWorkflows[portalId].filter(w => w.id !== workflowId);
      this.dataManager.markAsDirty();
    }
  }

  /**
   * ステップを追加します。
   * @param {string} portalId
   * @param {string} workflowId
   * @param {Partial<WorkflowStep>} stepData
   */
  addStep(portalId, workflowId, stepData) {
    const wf = this.getWorkflow(portalId, workflowId);
    if (wf) {
      const step = {
        step: wf.steps.length + 1,
        title: '',
        memo: '',
        linkId: null,
        ...stepData
      };
      wf.steps.push(step);
      this.dataManager.markAsDirty();
    }
  }

  /**
   * ステップを更新します。
   * @param {string} portalId
   * @param {string} workflowId
   * @param {number} stepIndex
   * @param {Partial<WorkflowStep>} stepData
   */
  updateStep(portalId, workflowId, stepIndex, stepData) {
    const wf = this.getWorkflow(portalId, workflowId);
    if (wf && wf.steps[stepIndex]) {
      Object.assign(wf.steps[stepIndex], stepData);
      this.dataManager.markAsDirty();
    }
  }

  /**
   * ステップを削除し、ステップ番号を振り直します。
   * @param {string} portalId
   * @param {string} workflowId
   * @param {number} stepIndex
   */
  deleteStep(portalId, workflowId, stepIndex) {
    const wf = this.getWorkflow(portalId, workflowId);
    if (wf) {
      wf.steps.splice(stepIndex, 1);
      wf.steps.forEach((s, i) => { s.step = i + 1; });
      this.dataManager.markAsDirty();
    }
  }

  /**
   * @private
   */
  _generateId(prefix) {
    return `${prefix}_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
  }
}
