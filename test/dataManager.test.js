// test/dataManager.test.js
import { DataManager } from '../js/dataManager.js';

describe('DataManager', () => {
  let dataManager;
  let initialData;
  let onDirtyMock;

  beforeEach(() => {
    // 各テストの前にDataManagerのインスタンスを新しく作成し、初期データ（フラットなリンク配列）を設定
    initialData = [
      { id: 'link1', title: 'Link 1', url: 'http://example.com', tags: ['仕事'] },
      { id: 'link2', title: 'Link 2', url: 'http://example2.com', tags: [] },
    ];
    onDirtyMock = jest.fn(); // onDirtyコールバックをモック化
    dataManager = new DataManager(onDirtyMock);
    dataManager.data = JSON.parse(JSON.stringify(initialData)); // ディープコピーで初期データを設定
  });

  // --- データ初期化と取得 ---

  test('should initialize DataManager correctly', () => {
    expect(dataManager).toBeInstanceOf(DataManager);
    expect(dataManager.hasUnsavedChanges).toBe(false);
  });

  test('getData() should return the current data', () => {
    const data = dataManager.getData();
    expect(data).toEqual(initialData);
    // 参照が渡されないことを確認するために、変更しても元のinitialDataに影響しないことを確認
    data[0].title = 'Changed';
    expect(dataManager.getData()[0].title).not.toBe('Changed');
  });

  test('getLink() should return the correct link by ID', () => {
    const link = dataManager.getLink('link1');
    expect(link).toEqual(initialData[0]);
    expect(dataManager.getLink('nonExistentLink')).toBeUndefined();
  });

  // --- リンク操作 ---

  test('addLink() should add a new link', () => {
    const newLink = { title: 'New Link', url: 'http://new.com', tags: ['趣味'] };
    dataManager.addLink(newLink);
    const data = dataManager.getData();
    expect(data.length).toBe(3);
    expect(data[2].title).toBe('New Link');
    expect(data[2].tags).toEqual(['趣味']);
    expect(data[2].id).toMatch(/^link_/); // IDが自動生成されていることを確認
    expect(onDirtyMock).toHaveBeenCalled();
    expect(dataManager.hasUnsavedChanges).toBe(true);
  });

  test('addLink() should default tags to an empty array when omitted', () => {
    dataManager.addLink({ title: 'No Tag Link', url: 'http://notag.com' });
    const data = dataManager.getData();
    expect(data[2].tags).toEqual([]);
  });

  test('updateLink() should update an existing link', () => {
    const updatedLink = { title: 'Updated Link 1', url: 'http://updated.com', icon: '✨', badge: 'v2', memo: 'updated memo', tags: ['仕事', '重要'] };
    dataManager.updateLink('link1', updatedLink);
    const link = dataManager.getLink('link1');
    expect(link.title).toBe('Updated Link 1');
    expect(link.url).toBe('http://updated.com');
    expect(link.icon).toBe('✨');
    expect(link.badge).toBe('v2');
    expect(link.memo).toBe('updated memo');
    expect(link.tags).toEqual(['仕事', '重要']);
    expect(onDirtyMock).toHaveBeenCalled();
    expect(dataManager.hasUnsavedChanges).toBe(true);
  });

  test('updateLink() should not update a non-existent link', () => {
    dataManager.updateLink('nonExistentLink', { title: 'x' });
    expect(dataManager.getLink('link1')).toEqual(initialData[0]); // 元のリンクは変わらない
    expect(onDirtyMock).not.toHaveBeenCalled();
    expect(dataManager.hasUnsavedChanges).toBe(false);
  });

  test('deleteLink() should delete an existing link', () => {
    dataManager.deleteLink('link1');
    const data = dataManager.getData();
    expect(data.length).toBe(1);
    expect(dataManager.getLink('link1')).toBeUndefined();
    expect(onDirtyMock).toHaveBeenCalled();
    expect(dataManager.hasUnsavedChanges).toBe(true);
  });

  test('deleteLink() should not delete a non-existent link', () => {
    dataManager.deleteLink('nonExistentLink');
    const data = dataManager.getData();
    expect(data.length).toBe(2); // リンク数は変わらない
    expect(onDirtyMock).not.toHaveBeenCalled();
    expect(dataManager.hasUnsavedChanges).toBe(false);
  });

  test('addBulkLinks() should add multiple links', () => {
    const newLinks = [
      { title: 'Bulk Link 1', url: 'http://bulk1.com', tags: ['雑多'] },
      { title: 'Bulk Link 2', url: 'http://bulk2.com', icon: 'B', tags: ['雑多'] }
    ];
    dataManager.addBulkLinks(newLinks);

    const data = dataManager.getData();
    expect(data.length).toBe(4);
    expect(data[2].title).toBe('Bulk Link 1');
    expect(data[3].icon).toBe('B');
    expect(data[2].id).toMatch(/^link_/);
    expect(onDirtyMock).toHaveBeenCalled();
    expect(dataManager.hasUnsavedChanges).toBe(true);
  });

  // --- ダーティ状態管理 ---

  test('hasUnsavedChanges should be true after data modification', () => {
    dataManager.addLink({ title: 'Test', url: 'http://test.com' });
    expect(dataManager.hasUnsavedChanges).toBe(true);
  });

  test('markAsClean() should set hasUnsavedChanges to false', () => {
    dataManager.addLink({ title: 'Test', url: 'http://test.com' });
    expect(dataManager.hasUnsavedChanges).toBe(true);
    dataManager.markAsClean();
    expect(dataManager.hasUnsavedChanges).toBe(false);
  });

  test('onDirty callback should be called on data modification', () => {
    dataManager.addLink({ title: 'Test', url: 'http://test.com' });
    expect(onDirtyMock).toHaveBeenCalledTimes(1);
    dataManager.updateLink('link1', { title: 'x' });
    expect(onDirtyMock).toHaveBeenCalledTimes(2);
  });

  // --- 旧カテゴリ形式からの自動移行 ---

  describe('_migrateLegacyPortal()', () => {
    test('should flatten a legacy category array and seed category title as a tag', () => {
      const legacy = [
        { id: 'cat1', title: 'カテゴリA', isOpen: true, links: [
          { id: 'link1', title: 'Link 1', url: 'http://a.com', tags: [] },
          { id: 'link2', title: 'Link 2', url: 'http://b.com' },
        ] },
        { id: 'cat2', title: 'カテゴリB', isOpen: false, links: [
          { id: 'link3', title: 'Link 3', url: 'http://c.com', tags: ['カテゴリB'] }, // 既に同名タグを持つケース
        ] },
      ];
      const { data, migrated } = dataManager._migrateLegacyPortal(legacy);
      expect(migrated).toBe(true);
      expect(data.length).toBe(3);
      expect(data[0].tags).toEqual(['カテゴリA']);
      expect(data[1].tags).toEqual(['カテゴリA']);
      // 既に同名タグがある場合は重複させない
      expect(data[2].tags).toEqual(['カテゴリB']);
    });

    test('should leave an already-flat portal unchanged', () => {
      const flat = [
        { id: 'link1', title: 'Link 1', url: 'http://a.com', tags: ['仕事'] },
      ];
      const { data, migrated } = dataManager._migrateLegacyPortal(flat);
      expect(migrated).toBe(false);
      expect(data).toEqual(flat);
    });

    test('should handle an empty array without error', () => {
      const { data, migrated } = dataManager._migrateLegacyPortal([]);
      expect(migrated).toBe(false);
      expect(data).toEqual([]);
    });

    test('should migrate every portal in allPortals via _migratePortals()', () => {
      dataManager.allPortals = {
        p1: [{ id: 'cat1', title: 'X', links: [{ id: 'l1', title: 'L1', url: 'http://x.com' }] }],
        p2: [{ id: 'link_flat', title: 'Flat', url: 'http://flat.com', tags: [] }],
      };
      const anyMigrated = dataManager._migratePortals();
      expect(anyMigrated).toBe(true);
      expect(dataManager.allPortals.p1.length).toBe(1);
      expect(dataManager.allPortals.p1[0].tags).toEqual(['X']);
      expect(dataManager.allPortals.p2).toEqual([{ id: 'link_flat', title: 'Flat', url: 'http://flat.com', tags: [] }]);
    });
  });
});
