import { DistributionLogManager } from '../js/distributionLog.js';

/** テスト用のインメモリ Storage 実装。 */
function memoryStorage() {
  const map = new Map();
  return {
    getItem: k => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, String(v)),
    removeItem: k => map.delete(k),
    clear: () => map.clear()
  };
}

function baseEntry(over = {}) {
  return {
    portalId: 'default',
    workflowId: 'wf_1',
    title: 'フローA',
    rev: 2,
    code: 'R2-0827-KTMR',
    format: 'html',
    recipientNote: '',
    ...over
  };
}

describe('DistributionLogManager', () => {
  let mgr;
  beforeEach(() => { mgr = new DistributionLogManager(memoryStorage()); });

  test('addEntry で id と exportedAt が付与され、getEntries で取得できる', () => {
    const e = mgr.addEntry(baseEntry({ recipientNote: '田中さん' }));
    expect(e.id).toMatch(/^dist_/);
    expect(e.exportedAt).toBeTruthy();
    const list = mgr.getEntries();
    expect(list).toHaveLength(1);
    expect(list[0].recipientNote).toBe('田中さん');
  });

  test('getEntries は新しい順', () => {
    mgr.addEntry(baseEntry({ exportedAt: '2026-01-01T00:00:00Z', title: '古い' }));
    mgr.addEntry(baseEntry({ exportedAt: '2026-08-01T00:00:00Z', title: '新しい' }));
    expect(mgr.getEntries().map(e => e.title)).toEqual(['新しい', '古い']);
  });

  test('updateEntry で配布先メモを後から追記できる', () => {
    const e = mgr.addEntry(baseEntry());
    mgr.updateEntry(e.id, { recipientNote: '営業部 全員' });
    expect(mgr.getEntries()[0].recipientNote).toBe('営業部 全員');
  });

  test('deleteEntry で行を削除できる', () => {
    const e1 = mgr.addEntry(baseEntry({ title: 'A' }));
    mgr.addEntry(baseEntry({ title: 'B' }));
    mgr.deleteEntry(e1.id);
    expect(mgr.getEntries().map(e => e.title)).toEqual(['B']);
  });

  test('getRecentRecipients は重複除去した直近の配布先', () => {
    mgr.addEntry(baseEntry({ exportedAt: '2026-01-01T00:00:00Z', recipientNote: '佐藤' }));
    mgr.addEntry(baseEntry({ exportedAt: '2026-02-01T00:00:00Z', recipientNote: '田中' }));
    mgr.addEntry(baseEntry({ exportedAt: '2026-03-01T00:00:00Z', recipientNote: '田中' }));
    expect(mgr.getRecentRecipients()).toEqual(['田中', '佐藤']);
  });

  test('getExportPrefs / setExportPrefs は前回値を保持', () => {
    expect(mgr.getExportPrefs()).toEqual({ reviewDue: '', sourceHint: '' });
    mgr.setExportPrefs({ reviewDue: '2026-12', sourceHint: '共有フォルダ' });
    expect(mgr.getExportPrefs()).toEqual({ reviewDue: '2026-12', sourceHint: '共有フォルダ' });
    mgr.setExportPrefs({ sourceHint: '別の場所' });
    expect(mgr.getExportPrefs()).toEqual({ reviewDue: '2026-12', sourceHint: '別の場所' });
  });

  test('summaryFor はフローごとの最古/最新版を返す', () => {
    mgr.addEntry(baseEntry({ workflowId: 'wf_1', rev: 3, recipientNote: '新規' }));
    mgr.addEntry(baseEntry({ workflowId: 'wf_1', rev: 1, recipientNote: '田中さん' }));
    mgr.addEntry(baseEntry({ workflowId: 'wf_2', rev: 5 }));
    const s = mgr.summaryFor('wf_1');
    expect(s.count).toBe(2);
    expect(s.oldestRev).toBe(1);
    expect(s.latestRev).toBe(3);
    expect(s.oldestNote).toBe('田中さん');
    expect(mgr.summaryFor('wf_missing')).toBeNull();
  });

  test('toCsv はヘッダー行付き・ダブルクオートをエスケープ', () => {
    mgr.addEntry(baseEntry({ title: 'フロー"X"', recipientNote: '田中, 佐藤' }));
    const csv = mgr.toCsv();
    const lines = csv.split('\r\n');
    expect(lines[0]).toBe('"出力日時","フロー","版","照合コード","形式","配布先メモ"');
    expect(lines[1]).toContain('"フロー""X"""');
    expect(lines[1]).toContain('"田中, 佐藤"');
  });

  test('storage が無くても壊れない（no-op）', () => {
    const noStore = new DistributionLogManager(null);
    expect(noStore.getEntries()).toEqual([]);
    expect(() => noStore.addEntry(baseEntry())).not.toThrow();
    expect(noStore.getExportPrefs()).toEqual({ reviewDue: '', sourceHint: '' });
  });
});
