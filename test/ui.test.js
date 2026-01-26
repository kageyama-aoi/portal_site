// test/ui.test.js
import { DataManager } from '../js/dataManager.js';
import { UI } from '../js/ui.js';

const describe = (name, fn) => ({ name, fn });
const it = (name, fn) => ({ name, fn });

export const uiTests = describe('UI', ({ test, assert, beforeEach }) => {
  let dataManager;
  let ui;
  let appContainer;

  beforeEach(() => {
    // DOMのコンテナをリセット
    const appRoot = document.getElementById('app-root');
    appRoot.style.display = 'block';
    appContainer = appRoot.querySelector('#app-container');
    appContainer.innerHTML = '';
    
    // インスタンス作成
    dataManager = new DataManager(() => {});
    dataManager.data = [
      { id: 'cat1', title: 'Category 1', isOpen: true, links: [{ id: 'link1', title: 'Link 1', icon: 'A', badge: 'doc', memo: 'Memo' }] },
      { id: 'cat2', title: 'Category 2', isOpen: false, links: [] },
    ];
    ui = new UI(dataManager);
  });

  test(it('should render initial categories and links without errors', () => {
    ui.render();
    const categoryElements = appContainer.querySelectorAll('details');
    assert(categoryElements.length === 2, 'Should render 2 categories');

    const linkElements = appContainer.querySelectorAll('.link-card');
    assert(linkElements.length === 1, 'Should render 1 link');
    
    const title = appContainer.querySelector('.link-title').textContent;
    assert(title === 'Link 1', 'Link title should be rendered correctly');
  }));
  
  test(it('should toggle edit mode', () => {
    ui.isEditMode = false;
    ui.render();
    let editButtons = appContainer.querySelectorAll('.action-btn.btn-edit');
    assert(editButtons.length === 0, 'No edit buttons should be visible in normal mode');
    
    ui.isEditMode = true;
    ui.render();
    editButtons = appContainer.querySelectorAll('.action-btn.btn-edit');
    assert(editButtons.length === 2, 'Edit buttons should be visible for each category in edit mode');
    
    const addPlaceholder = appContainer.querySelector('.add-link-placeholder');
    assert(addPlaceholder !== null, 'Add link placeholder should be visible in edit mode');
  }));

  test(it('should open a dialog', () => {
    // ダミーのdialog要素を取得
    const catDialog = document.getElementById('categoryDialog');
    
    // showModalが呼ばれたかをチェックするスパイ
    let showModalCalled = false;
    catDialog.showModal = () => { showModalCalled = true; };
    
    ui.openCategoryDialog();
    assert(showModalCalled, 'showModal() should be called on category dialog');
  });

});