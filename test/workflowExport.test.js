/**
 * 作業フロー HTML 出力（配布バージョン管理）の検証。
 * 生成された単体HTMLを jsdom に読み込み、版スタンプ・メタ情報・改変検知が
 * 期待どおり動くこと、Git 由来の文字列が漏れていないことを確認する。
 */
import { UI } from '../js/ui.js';

const RealBlob = global.Blob;

function makeUI(workflow) {
  const ui = new UI({}, {
    getActivePortalId: () => 'default',
    getActivePortal: () => ({ title: 'ポータル', subtitle: 'サブ' })
  }, {}, {});
  ui.workflowManager = { getWorkflows: () => [JSON.parse(JSON.stringify(workflow))] };
  ui.searchManager = { findLinkById: () => null };
  return ui;
}

const sampleWorkflow = {
  id: 'wf_1',
  title: 'フロー<A>',
  description: '説明"x"',
  freq: 'rare',
  tags: ['t1'],
  rev: 3,
  updatedAt: '2026-08-20T00:00:00Z',
  contentHash: 'abcd1234',
  steps: [
    { step: 1, title: 'ステップ1', memo: 'メモ\n複数行', prompt: 'echo hi', promptType: 'code', linkId: null },
    { step: 2, title: 'ステップ2', memo: '', prompt: '', promptType: 'none', linkId: null }
  ]
};

/** UI._exportWorkflowAsHtml が Blob へ渡す HTML 文字列を捕捉する。 */
function exportHtml(workflow, exportMeta) {
  let html = null;
  global.Blob = class { constructor(parts) { html = parts.join(''); } };
  global.URL.createObjectURL = () => 'blob:x';
  global.URL.revokeObjectURL = () => {};
  try {
    makeUI(workflow)._exportWorkflowAsHtml(['wf_1'], exportMeta);
  } finally {
    global.Blob = RealBlob;
  }
  return html;
}

/** 生成HTMLを現在の document に流し込み、インラインスクリプトを実行する。 */
function loadIntoDom(html) {
  const inner = html.replace(/^[\s\S]*?<html[^>]*>/i, '').replace(/<\/html>\s*$/i, '');
  document.documentElement.innerHTML = inner;
  document.querySelectorAll('script:not([type])').forEach(s => {
    (0, eval)(s.textContent); // eslint-disable-line no-eval
  });
}

describe('作業フロー HTML 出力の配布バージョン管理', () => {
  test('版スタンプ・入手先・メタ情報が埋め込まれる', () => {
    const html = exportHtml(sampleWorkflow, { reviewDue: '2020-01', sourceHint: '共有フォルダ' });
    expect(html).toContain('v3 ・ 2026/8/20 ・ R3-');
    expect(html).toContain('最新版の入手先: <b>共有フォルダ</b>');
    expect(html).toContain('id="wf-meta"');
    expect(html).toContain('id="wf-baseline"');
  });

  test('Git / GitHub 由来の文字列が配布物に含まれない', () => {
    const html = exportHtml(sampleWorkflow, {}).toLowerCase();
    expect(html).not.toContain('github');
    expect(html).not.toContain('repository');
    expect(html).not.toContain('.git');
  });

  test('開いた直後は「配布時のまま」、本文を書き換えると「変更されています」', () => {
    loadIntoDom(exportHtml(sampleWorkflow, {}));
    expect(document.getElementById('wfIntegrityBadge').textContent).toContain('配布時のまま');

    document.querySelector('[data-editable]').textContent = '改ざんされた見出し';
    window.wfCheckIntegrity();
    expect(document.getElementById('wfIntegrityBadge').textContent).toContain('変更されています');
  });

  test('見直し予定日を過ぎていれば注意文、未来なら予定表示', () => {
    loadIntoDom(exportHtml(sampleWorkflow, { reviewDue: '2020-01' }));
    expect(document.getElementById('wfReviewNote').textContent).toContain('見直し予定でした');

    loadIntoDom(exportHtml(sampleWorkflow, { reviewDue: '2099-12' }));
    expect(document.getElementById('wfReviewNote').textContent).toContain('次回見直し予定: 2099-12');
  });

  test('改行を含むメモ／プロンプトでも改変誤検知しない', () => {
    loadIntoDom(exportHtml(sampleWorkflow, {}));
    expect(window.wfCheckIntegrity()).toBe(false);
  });
});
