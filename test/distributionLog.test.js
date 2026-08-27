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

describe('DistributionLogManager: 共有ファイル運用', () => {
  let mgr;
  beforeEach(() => { mgr = new DistributionLogManager(memoryStorage()); });

  test('addEntry で hasUnsavedChanges が立ち、markSaved で下りる', () => {
    expect(mgr.hasUnsavedChanges).toBe(false);
    mgr.addEntry(baseEntry());
    expect(mgr.hasUnsavedChanges).toBe(true);
    mgr.markSaved();
    expect(mgr.hasUnsavedChanges).toBe(false);
  });

  test('onDirtyChange は変化時のみ呼ばれる', () => {
    let calls = 0;
    mgr.onDirtyChange = () => { calls++; };
    mgr.addEntry(baseEntry());   // false -> true
    mgr.addEntry(baseEntry());   // true -> true（呼ばれない）
    mgr.markSaved();             // true -> false
    expect(calls).toBe(2);
  });

  test('mergeEntries: 同一idは引数側で上書き、新規は追加', () => {
    const a = mgr.addEntry(baseEntry({ recipientNote: '旧メモ' }));
    const res = mgr.mergeEntries([
      { ...a, recipientNote: '新メモ' },
      { id: 'dist_x', title: '外部', rev: 1, workflowId: 'wf_9', format: 'html', exportedAt: '2026-05-01T00:00:00Z' }
    ]);
    expect(res).toEqual({ added: 1, updated: 1 });
    const byId = Object.fromEntries(mgr.getEntries().map(e => [e.id, e]));
    expect(byId[a.id].recipientNote).toBe('新メモ');
    expect(byId['dist_x'].title).toBe('外部');
  });

  test('applyFileData: {entries:[...]} と素の配列の両方を受け付け、取り込み後は保存済み扱い', () => {
    mgr.addEntry(baseEntry());
    expect(mgr.hasUnsavedChanges).toBe(true);
    const r1 = mgr.applyFileData({ entries: [{ id: 'dist_f1', title: 'F1', rev: 2, workflowId: 'wf_1', format: 'pdf', exportedAt: '2026-06-01T00:00:00Z' }] });
    expect(r1.added).toBe(1);
    expect(mgr.hasUnsavedChanges).toBe(false);
    const r2 = mgr.applyFileData([{ id: 'dist_f2', title: 'F2', rev: 1, workflowId: 'wf_1', format: 'html', exportedAt: '2026-06-02T00:00:00Z' }]);
    expect(r2.added).toBe(1);
  });

  test('toFileJson は schema/savedAt/entries を持つ整形JSON', () => {
    mgr.addEntry(baseEntry({ recipientNote: '田中さん' }));
    const parsed = JSON.parse(mgr.toFileJson());
    expect(parsed.schema).toBe(1);
    expect(typeof parsed.savedAt).toBe('string');
    expect(parsed.entries).toHaveLength(1);
    expect(parsed.entries[0].recipientNote).toBe('田中さん');
  });
});
