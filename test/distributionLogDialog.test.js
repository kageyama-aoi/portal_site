import { DistributionLogDialog } from '../js/dialogs/distributionLogDialog.js';
import { DistributionLogManager } from '../js/distributionLog.js';

function memoryStorage() {
  const map = new Map();
  return {
    getItem: k => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, String(v)),
    removeItem: k => map.delete(k)
  };
}

function setup() {
  document.body.innerHTML = `
    <dialog id="distributionLogDialog"><div id="distributionLogDialogContent"></div></dialog>
  `;
  const dlg = document.getElementById('distributionLogDialog');
  dlg.showModal = () => { dlg.open = true; };
  dlg.close = () => { dlg.open = false; };

  const mgr = new DistributionLogManager(memoryStorage());
  const dialog = new DistributionLogDialog(mgr, { getActivePortalId: () => 'default' });
  dialog.init();
  return { mgr, dialog };
}

describe('DistributionLogDialog', () => {
  test('履歴があれば行を描画し、配布先メモ入力の変更を保存する', () => {
    const { mgr, dialog } = setup();
    const e = mgr.addEntry({
      portalId: 'default', workflowId: 'wf_1', title: 'フローA',
      rev: 2, code: 'R2-0827-KTMR', format: 'html', recipientNote: ''
    });
    dialog.open();

    const rows = document.querySelectorAll('.dist-row');
    expect(rows).toHaveLength(1);

    const input = document.querySelector('.dist-note-input');
    input.value = '営業部 田中さん';
    input.dispatchEvent(new Event('change'));
    expect(mgr.getEntries()[0].recipientNote).toBe('営業部 田中さん');
    expect(mgr.getEntries()[0].id).toBe(e.id);
  });

  test('未保存の追記があると警告バナーを表示する', () => {
    const { mgr, dialog } = setup();
    mgr.addEntry({ portalId: 'default', workflowId: 'wf_1', title: 'A', rev: 1, format: 'html' });
    dialog.open();
    expect(document.querySelector('.dist-dirty')).not.toBeNull();

    mgr.markSaved();
    dialog.open();
    expect(document.querySelector('.dist-dirty')).toBeNull();
  });

  test('フロー別フィルタで表示件数が絞られる', () => {
    const { mgr, dialog } = setup();
    mgr.addEntry({ portalId: 'default', workflowId: 'wf_1', title: 'A', rev: 1, format: 'html' });
    mgr.addEntry({ portalId: 'default', workflowId: 'wf_2', title: 'B', rev: 1, format: 'pdf' });
    dialog.open();
    expect(document.querySelectorAll('.dist-row')).toHaveLength(2);

    const sel = document.getElementById('distFilterSelect');
    sel.value = 'wf_2';
    sel.dispatchEvent(new Event('change'));
    const rows = document.querySelectorAll('.dist-row');
    expect(rows).toHaveLength(1);
    expect(rows[0].querySelector('.dist-title').textContent).toBe('B');
  });
});
