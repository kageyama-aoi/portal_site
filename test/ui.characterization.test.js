/**
 * 特性テスト（characterization tests）。
 * リファクタ前の ui.js の「現行の見た目・挙動」を固定する。
 * ここで assert している内容は仕様というより「今こう動いている」の記録であり、
 * 分割リファクタで壊れていないことを検知するのが目的。
 */
import { UI } from '../js/ui.js';
import { DataManager } from '../js/dataManager.js';
import { ConfigManager } from '../js/configManager.js';
import { WorkflowManager } from '../js/workflowManager.js';
import { SearchManager } from '../js/searchManager.js';

import fs from 'fs';
import path from 'path';

const html = fs.readFileSync(path.resolve(process.cwd(), 'index.html'), 'utf8');

function makeUI({ links = [], workflows = null } = {}) {
  document.body.innerHTML = html;
  localStorage.clear();

  const dataManager = new DataManager(() => {});
  dataManager.data = JSON.parse(JSON.stringify(links));
  if (workflows) dataManager.allWorkflows = JSON.parse(JSON.stringify({ default: workflows }));

  const configManager = new ConfigManager();
  const ui = new UI(dataManager, configManager, { open: jest.fn(), init: jest.fn() }, { open: jest.fn(), init: jest.fn() });
  ui.searchManager = new SearchManager(dataManager);
  ui.workflowManager = new WorkflowManager(dataManager);
  ui.portalDialog = { open: jest.fn() };
  ui.workflowDialog = { open: jest.fn() };
  ui.init();
  return ui;
}

const sampleWorkflows = [
  {
    id: 'wf_a', title: 'DB更新', description: 'DB更新の流れ', freq: 'monthly', tags: ['DB'],
    steps: [
      { step: 1, title: 'SQL作成', memo: 'テンプレから', prompt: '', promptType: 'none', linkId: null },
      { step: 2, title: 'SQL検証', memo: '', prompt: 'SELECT 1', promptType: 'code', linkId: null }
    ]
  },
  {
    id: 'wf_b', title: '確定申告', description: '', freq: 'rare', tags: [],
    steps: [{ step: 1, title: '書類集め', memo: '', prompt: '', promptType: 'none', linkId: null }]
  }
];

describe('特性: ワークフロービュー', () => {
  test('ヘッダーに PDF出力 / HTML出力 / 発行履歴 / フローを管理 ボタンが出る', () => {
    const ui = makeUI({ workflows: sampleWorkflows });
    ui.distributionLogDialog = { open: jest.fn() };
    ui.viewMode = 'workflow';
    ui.render();

    const btns = [...ui.container.querySelectorAll('.workflow-mode-header button')].map(b => b.textContent.trim());
    expect(btns.some(t => t.includes('PDF出力'))).toBe(true);
    expect(btns.some(t => t.includes('HTML出力'))).toBe(true);
    expect(btns.some(t => t.includes('発行履歴'))).toBe(true);
    expect(btns.some(t => t.includes('フローを管理'))).toBe(true);
  });

  test('ワークフローが無いと空状態＋作成ボタン', () => {
    const ui = makeUI({ workflows: [] });
    ui.viewMode = 'workflow';
    ui.render();
    expect(ui.container.querySelector('.workflow-empty')).not.toBeNull();
    expect(ui.container.querySelector('#wfCreateFromEmpty')).not.toBeNull();
  });

  test('カードは既定で折りたたみ、タイトル五十音順、ステップ数チップと頻度バッジを出す', () => {
    const ui = makeUI({ workflows: sampleWorkflows });
    ui.viewMode = 'workflow';
    ui.render();

    const cards = ui.container.querySelectorAll('.workflow-card');
    expect(cards).toHaveLength(2);
    expect([...cards].every(c => c.open === false)).toBe(true);

    const titles = [...ui.container.querySelectorAll('.workflow-card-title-text')].map(e => e.textContent);
    expect(titles).toEqual(['DB更新', '確定申告']); // localeCompare('ja')

    const firstCard = cards[0];
    expect(firstCard.querySelector('.workflow-card-count').textContent).toBe('2 ステップ');
    expect(firstCard.querySelector('.wf-freq-badge').textContent).toBe('月次');
    expect(firstCard.querySelectorAll('.workflow-step-row')).toHaveLength(2);
    expect(firstCard.querySelector('.workflow-step-title').textContent).toBe('SQL作成');
  });

  test('カードを開くと expandedWorkflowIds に記録され、再描画で開いたまま', () => {
    const ui = makeUI({ workflows: sampleWorkflows });
    ui.viewMode = 'workflow';
    ui.render();

    const card = ui.container.querySelector('.workflow-card');
    card.open = true;
    card.dispatchEvent(new Event('toggle'));
    expect(ui.expandedWorkflowIds.has('wf_a')).toBe(true);

    ui.render();
    expect(ui.container.querySelector('.workflow-card').open).toBe(true);
  });
});

describe('特性: リンクカード / テーブル行', () => {
  const links = [
    { id: 'l1', title: 'ドキュメント', url: 'https://example.com/doc', icon: 'article', badge: 'doc', memo: '設計メモ', tags: ['仕事'] },
    { id: 'l2', title: 'ローカル', url: 'opendir:C:\\work\\proj', icon: 'folder', badge: 'local', memo: '', tags: ['仕事'] }
  ];

  test('カード: タイトル・バッジラベル・メモ・href', () => {
    const ui = makeUI({ links });
    ui.render();
    const card = ui.container.querySelector('.link-card');
    expect(card.querySelector('.link-title').textContent).toBe('ドキュメント');
    expect(card.querySelector('.badge').textContent).toBe(ui.getBadgeLabel('doc'));
    expect(card.querySelector('.link-memo').textContent).toBe('設計メモ');
    expect(card.getAttribute('href')).toBe('https://example.com/doc');
  });

  test('カード: opendir リンクは link-local クラス・パス表示・コピーボタン', () => {
    const ui = makeUI({ links });
    ui.render();
    const localCard = [...ui.container.querySelectorAll('.link-card')].find(c => c.classList.contains('link-local'));
    expect(localCard).toBeTruthy();
    expect(localCard.querySelector('.link-local-path').textContent).toBe('C:\\work\\proj');
    const wrapper = localCard.closest('.link-card-wrapper');
    expect(wrapper.querySelector('.local-copy-btn')).not.toBeNull();
  });

  test('テーブル表示: 行にタイトルとバッジセル', () => {
    const ui = makeUI({ links });
    ui.viewMode = 'table';
    ui.render();
    const row = ui.container.querySelector('.table-row');
    expect(row.querySelector('.link-title-cell').textContent).toBe('ドキュメント');
    expect(row.querySelector('.badge-cell').textContent).toBe(ui.getBadgeLabel('doc'));
  });
});
