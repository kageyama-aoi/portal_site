// test/dataManager.test.js
import { DataManager } from '../js/dataManager.js';

// テストをグループ化するためのユーティリティ
const describe = (name, fn) => ({ name, fn });
const it = (name, fn) => ({ name, fn });

export const dataManagerTests = describe('DataManager', ({ test, assert, beforeEach }) => {
  let dataManager;

  // 各テストの前に実行
  beforeEach(() => {
    dataManager = new DataManager(() => {}); // onDirtyコールバックは空でOK
    // テスト用の初期データを設定
    dataManager.data = [
      { id: 'cat1', title: 'Category 1', links: [{ id: 'link1', title: 'Link 1' }] },
      { id: 'cat2', title: 'Category 2', links: [] },
    ];
  });

  test(it('should add a new category', () => {
    dataManager.addCategory('New Category');
    const data = dataManager.getData();
    assert(data.length === 3, 'Category count should be 3');
    assert(data[2].title === 'New Category', 'New category title should be correct');
  }));

  test(it('should update a category', () => {
    dataManager.updateCategory('cat1', 'Updated Title');
    const cat = dataManager.getCategory('cat1');
    assert(cat.title === 'Updated Title', 'Category title should be updated');
  }));

  test(it('should delete a category', () => {
    dataManager.deleteCategory('cat1');
    const data = dataManager.getData();
    assert(data.length === 1, 'Category count should be 1');
    assert(dataManager.getCategory('cat1') === undefined, 'Deleted category should not exist');
  }));

  test(it('should move a category down', () => {
    dataManager.moveCategory(0, 1); // cat1を下へ
    const data = dataManager.getData();
    assert(data[0].id === 'cat2', 'cat2 should be the first category');
    assert(data[1].id === 'cat1', 'cat1 should be the second category');
  }));

  test(it('should add a new link', () => {
    dataManager.addLink('cat2', { title: 'New Link', url: 'http://a.com' });
    const cat = dataManager.getCategory('cat2');
    assert(cat.links.length === 1, 'Link count in cat2 should be 1');
    assert(cat.links[0].title === 'New Link', 'New link title should be correct');
  }));

  test(it('should delete a link', () => {
    dataManager.deleteLink('cat1', 'link1');
    const cat = dataManager.getCategory('cat1');
    assert(cat.links.length === 0, 'Link count in cat1 should be 0');
  }));
  
  test(it('should mark as dirty when data changes', () => {
    let dirtyCalled = false;
    dataManager.onDirty = () => { dirtyCalled = true; };
    
    dataManager.addCategory('test');
    assert(dirtyCalled === true, 'onDirty should be called after adding category');
    assert(dataManager.hasUnsavedChanges === true, 'hasUnsavedChanges should be true');

    dirtyCalled = false; // reset
    dataManager.markAsClean();
    assert(dataManager.hasUnsavedChanges === false, 'hasUnsavedChanges should be false after markAsClean');
  }));

  test(it('should add multiple links via addBulkLinks', () => {
    const newLinks = [
      { title: 'Bulk Link 1', url: 'http://bulk1.com' },
      { title: 'Bulk Link 2', url: 'http://bulk2.com', icon: 'B' }
    ];
    dataManager.addBulkLinks('cat2', newLinks);
    
    const cat = dataManager.getCategory('cat2');
    assert(cat.links.length === 2, 'Link count in cat2 should be 2 after bulk add');
    assert(cat.links[0].title === 'Bulk Link 1', 'First bulk link title should be correct');
    assert(cat.links[1].icon === 'B', 'Second bulk link icon should be correct');
    assert(cat.links[0].id.startsWith('link_'), 'New links should have a generated ID');
  }));
});