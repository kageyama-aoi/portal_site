// test/dataManager.test.js
import { DataManager } from '../js/dataManager.js';

describe('DataManager', () => {
  let dataManager;
  let initialData;
  let onDirtyMock;

  beforeEach(() => {
    // 各テストの前にDataManagerのインスタンスを新しく作成し、初期データを設定
    initialData = [
      { id: 'cat1', title: 'Category 1', links: [{ id: 'link1', title: 'Link 1', url: 'http://example.com' }] },
      { id: 'cat2', title: 'Category 2', links: [] },
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

  test('getCategory() should return the correct category by ID', () => {
    const category = dataManager.getCategory('cat1');
    expect(category).toEqual(initialData[0]);
    expect(dataManager.getCategory('nonExistentCat')).toBeUndefined();
  });

  test('getLink() should return the correct link by category ID and link ID', () => {
    const link = dataManager.getLink('cat1', 'link1');
    expect(link).toEqual(initialData[0].links[0]);
    expect(dataManager.getLink('cat1', 'nonExistentLink')).toBeUndefined();
    expect(dataManager.getLink('nonExistentCat', 'link1')).toBeUndefined();
  });

  // --- カテゴリ操作 ---

  test('addCategory() should add a new category', () => {
    const newCategoryTitle = 'New Category';
    dataManager.addCategory(newCategoryTitle);
    const data = dataManager.getData();
    expect(data.length).toBe(3);
    expect(data[2].title).toBe(newCategoryTitle);
    expect(data[2].links).toEqual([]);
    expect(onDirtyMock).toHaveBeenCalled();
    expect(dataManager.hasUnsavedChanges).toBe(true);
  });

  test('updateCategory() should update an existing category title', () => {
    const updatedTitle = 'Updated Category 1';
    dataManager.updateCategory('cat1', updatedTitle);
    const category = dataManager.getCategory('cat1');
    expect(category.title).toBe(updatedTitle);
    expect(onDirtyMock).toHaveBeenCalled();
    expect(dataManager.hasUnsavedChanges).toBe(true);
  });

  test('updateCategory() should not update a non-existent category', () => {
    const updatedTitle = 'Non Existent';
    dataManager.updateCategory('nonExistentCat', updatedTitle);
    expect(dataManager.getCategory('nonExistentCat')).toBeUndefined();
    expect(onDirtyMock).not.toHaveBeenCalled(); // 変更がないので呼ばれない
    expect(dataManager.hasUnsavedChanges).toBe(false);
  });

  test('deleteCategory() should delete an existing category', () => {
    dataManager.deleteCategory('cat1');
    const data = dataManager.getData();
    expect(data.length).toBe(1);
    expect(dataManager.getCategory('cat1')).toBeUndefined();
    expect(onDirtyMock).toHaveBeenCalled();
    expect(dataManager.hasUnsavedChanges).toBe(true);
  });

  test('deleteCategory() should not delete a non-existent category', () => {
    dataManager.deleteCategory('nonExistentCat');
    const data = dataManager.getData();
    expect(data.length).toBe(2); // データは変わらない
    expect(onDirtyMock).not.toHaveBeenCalled();
    expect(dataManager.hasUnsavedChanges).toBe(false);
  });

  test('moveCategory() should move a category down', () => {
    dataManager.moveCategory(0, 1); // cat1を下へ (インデックス0からインデックス1へ)
    const data = dataManager.getData();
    expect(data[0].id).toBe('cat2');
    expect(data[1].id).toBe('cat1');
    expect(onDirtyMock).toHaveBeenCalled();
    expect(dataManager.hasUnsavedChanges).toBe(true);
  });

  test('moveCategory() should move a category up', () => {
    dataManager.moveCategory(1, 0); // cat2を上へ (インデックス1からインデックス0へ)
    const data = dataManager.getData();
    expect(data[0].id).toBe('cat2');
    expect(data[1].id).toBe('cat1');
    expect(onDirtyMock).toHaveBeenCalled();
    expect(dataManager.hasUnsavedChanges).toBe(true);
  });
  
  test('moveCategory() should handle invalid indices', () => {
    dataManager.moveCategory(0, 99); // 範囲外
    expect(dataManager.getData()).toEqual(initialData); // データは変わらない
    dataManager.moveCategory(99, 0); // 範囲外
    expect(dataManager.getData()).toEqual(initialData); // データは変わらない
    expect(onDirtyMock).not.toHaveBeenCalled();
    expect(dataManager.hasUnsavedChanges).toBe(false);
  });
  
  // --- リンク操作 ---

  test('addLink() should add a new link to an existing category', () => {
    const newLink = { title: 'New Link', url: 'http://new.com' };
    dataManager.addLink('cat2', newLink);
    const category = dataManager.getCategory('cat2');
    expect(category.links.length).toBe(1);
    expect(category.links[0].title).toBe('New Link');
    expect(category.links[0].url).toBe('http://new.com');
    expect(category.links[0].id).toMatch(/^link_/); // IDが自動生成されていることを確認
    expect(onDirtyMock).toHaveBeenCalled();
    expect(dataManager.hasUnsavedChanges).toBe(true);
  });

  test('addLink() should not add a link to a non-existent category', () => {
    const newLink = { title: 'New Link', url: 'http://new.com' };
    dataManager.addLink('nonExistentCat', newLink);
    // データが変わっていないことを確認
    expect(dataManager.getData()).toEqual(initialData);
    expect(onDirtyMock).not.toHaveBeenCalled();
    expect(dataManager.hasUnsavedChanges).toBe(false);
  });

  test('updateLink() should update an existing link', () => {
    const updatedLink = { title: 'Updated Link 1', url: 'http://updated.com', icon: '✨', badge: 'v2', memo: 'updated memo' };
    dataManager.updateLink('cat1', 'link1', updatedLink);
    const link = dataManager.getLink('cat1', 'link1');
    expect(link.title).toBe('Updated Link 1');
    expect(link.url).toBe('http://updated.com');
    expect(link.icon).toBe('✨');
    expect(link.badge).toBe('v2');
    expect(link.memo).toBe('updated memo');
    expect(onDirtyMock).toHaveBeenCalled();
    expect(dataManager.hasUnsavedChanges).toBe(true);
  });

  test('updateLink() should not update a non-existent link', () => {
    const updatedLink = { title: 'Updated Link', url: 'http://updated.com' };
    dataManager.updateLink('cat1', 'nonExistentLink', updatedLink);
    expect(dataManager.getLink('cat1', 'link1')).toEqual(initialData[0].links[0]); // 元のリンクは変わらない
    expect(onDirtyMock).not.toHaveBeenCalled();
    expect(dataManager.hasUnsavedChanges).toBe(false);
  });

  test('deleteLink() should delete an existing link', () => {
    dataManager.deleteLink('cat1', 'link1');
    const category = dataManager.getCategory('cat1');
    expect(category.links.length).toBe(0);
    expect(dataManager.getLink('cat1', 'link1')).toBeUndefined();
    expect(onDirtyMock).toHaveBeenCalled();
    expect(dataManager.hasUnsavedChanges).toBe(true);
  });

  test('deleteLink() should not delete a non-existent link', () => {
    dataManager.deleteLink('cat1', 'nonExistentLink');
    const category = dataManager.getCategory('cat1');
    expect(category.links.length).toBe(1); // リンク数は変わらない
    expect(onDirtyMock).not.toHaveBeenCalled();
    expect(dataManager.hasUnsavedChanges).toBe(false);
  });
  
  test('addBulkLinks() should add multiple links to a category', () => {
    const newLinks = [
      { title: 'Bulk Link 1', url: 'http://bulk1.com' },
      { title: 'Bulk Link 2', url: 'http://bulk2.com', icon: 'B' }
    ];
    dataManager.addBulkLinks('cat2', newLinks);
    
    const cat = dataManager.getCategory('cat2');
    expect(cat.links.length).toBe(2);
    expect(cat.links[0].title).toBe('Bulk Link 1');
    expect(cat.links[1].icon).toBe('B');
    expect(cat.links[0].id).toMatch(/^link_/);
    expect(onDirtyMock).toHaveBeenCalled();
    expect(dataManager.hasUnsavedChanges).toBe(true);
  });

  test('addBulkLinks() should not add links to a non-existent category', () => {
    const newLinks = [{ title: 'Bulk Link', url: 'http://bulk.com' }];
    dataManager.addBulkLinks('nonExistentCat', newLinks);
    expect(dataManager.getData()).toEqual(initialData);
    expect(onDirtyMock).not.toHaveBeenCalled();
    expect(dataManager.hasUnsavedChanges).toBe(false);
  });

  // --- ダーティ状態管理 ---

  test('hasUnsavedChanges should be true after data modification', () => {
    dataManager.addCategory('Test');
    expect(dataManager.hasUnsavedChanges).toBe(true);
  });

  test('markAsClean() should set hasUnsavedChanges to false', () => {
    dataManager.addCategory('Test');
    expect(dataManager.hasUnsavedChanges).toBe(true);
    dataManager.markAsClean();
    expect(dataManager.hasUnsavedChanges).toBe(false);
  });

  test('onDirty callback should be called on data modification', () => {
    dataManager.addCategory('Test');
    expect(onDirtyMock).toHaveBeenCalledTimes(1);
    dataManager.updateLink('cat1', 'link1', { title: 'x' });
    expect(onDirtyMock).toHaveBeenCalledTimes(2);
  });
});