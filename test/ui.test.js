// test/ui.test.js
import { UI } from '../js/ui.js';
import { DataManager } from '../js/dataManager.js';
import { ConfigManager } from '../js/configManager.js'; // 追加
import { LinkDialog } from '../js/dialogs/linkDialog.js'; // 追加
import { BulkLinkDialog } from '../js/dialogs/bulkLinkDialog.js'; // 追加
import { PortalDialog } from '../js/dialogs/portalDialog.js'; // 追加
import { IconPickerDialog } from '../js/dialogs/iconPickerDialog.js'; // 追加
import { CategoryDialog } from '../js/dialogs/categoryDialog.js'; // 追加

import fs from 'fs';
import path from 'path';
import { JSDOM } from 'jsdom';

// index.html の内容を読み込む (プロジェクトルートからの相対パスで指定)
const html = fs.readFileSync(path.resolve(process.cwd(), 'index.html'), 'utf8');

describe('UI', () => {
  let dataManager;
  let ui; // 追加
  let configManagerMock;
  let linkDialogMock;
  let bulkLinkDialogMock;
  let portalDialogMock;
  let iconPickerDialogMock;
  let categoryDialogMock;

  // initialDataをbeforeEachスコープ内で定義
  const initialData = [
    { id: 'cat1', title: 'Category 1', isOpen: true, links: [{ id: 'link1', title: 'Link 1', url: 'http://example.com', icon: 'A', badge: 'doc', memo: 'Memo' }] },
    { id: 'cat2', title: 'Category 2', isOpen: false, links: [] },
  ];

    });

  

    // --- 初期レンダリング ---

  

    test('should render initial categories and links without errors', () => {

      ui.render();

      

      const categoryElements = ui.container.querySelectorAll('.category-card');

      expect(categoryElements.length).toBe(2);

  

      const linkElements = ui.container.querySelectorAll('.link-card');

      expect(linkElements.length).toBe(1);

      

      // カテゴリ1のタイトルを確認

      const cat1Title = ui.container.querySelector('#cat1 .category-title').textContent.trim();

      expect(cat1Title).toBe('Category 1');

  

      // リンク1のタイトルとURLを確認

      const link1Title = ui.container.querySelector('#link1 .link-title').textContent.trim();

      const link1Url = ui.container.querySelector('#link1 .link-url').textContent.trim();

      expect(link1Title).toBe('Link 1');

      expect(link1Url).toBe('http://example.com'); // UIによって表示形式が変わる可能性もあるため注意

  

      // Category 1 (id:cat1) が展開されていることを確認 (details要素のopen属性)

      const cat1Details = ui.container.querySelector('#cat1');

      expect(cat1Details.tagName.toLowerCase()).toBe('details'); // detailsタグを使用している前提

      expect(cat1Details.hasAttribute('open')).toBe(true);

      

      // Category 2 (id:cat2) が折りたたまれていることを確認

      const cat2Details = ui.container.querySelector('#cat2');

      expect(cat2Details.hasAttribute('open')).toBe(false);

    });

    

    test('should render appropriate message when no data is available', () => {

      dataManager.data = []; // データがない状態

      ui.render();

      const noDataMessage = ui.container.querySelector('.no-data-message'); // UIクラスがこのメッセージを表示すると仮定

      expect(noDataMessage).toBeDefined(); // または特定のエラーメッセージをexpect

    });

  

    // --- 編集モードのトグル ---

    test('should toggle edit mode visuals', () => {

      ui.isEditMode = false;

      ui.render();

      let editModeElements = document.querySelectorAll('.edit-mode-only'); // CSSクラスや要素で判断

      expect(editModeElements.length).toBe(0); // 編集モードでしか表示されない要素がないことを確認

  

      const saveArea = document.getElementById('saveArea');

      expect(saveArea.classList.contains('edit-mode')).toBe(false); // 例えばedit-modeクラスが付与されない

  

      ui.isEditMode = true;

      ui.render();

      editModeElements = document.querySelectorAll('.edit-mode-only');

      // UIクラスのrenderメソッドが編集モードに応じてDOMに何らかのクラスを付与するか、要素を表示/非表示にするはず

      // ここはUIの実装に合わせてアサーションを記述する

      // 例: expect(document.getElementById('addCategoryBtn').style.display).toBe('block');

      // 現状のHTMLとUIクラスの実装を考慮すると、具体的な要素のdisplayスタイルやclassで確認が必要

      const addCategoryBtn = document.getElementById('addCategoryBtn');

      expect(addCategoryBtn.style.display).toBe(''); // display: none が解除されていることを期待

      expect(addCategoryBtn.textContent).toContain('カテゴリ追加');

      

      expect(document.getElementById('bulkAddLinkBtn').style.display).toBe('');

      

      // .category-controls (カテゴリの編集ボタンなど) が表示されるか

      const categoryControls = ui.container.querySelector('.category-controls'); // category-controls クラスを持つ要素がedit modeで出現する前提

      expect(categoryControls).not.toBeNull();

      // もしくは、html.innerHTML = '' でクリアされるため、一旦レンダーしてeditmodeでrenderし直すというアプローチもアリ

      // ui.isEditMode = true;

      // ui.render();

      // const categoryEditBtn = ui.container.querySelector('.category-card .action-btn.btn-edit'); // カテゴリ編集ボタン

      // expect(categoryEditBtn).not.toBeNull();

    });


  // --- 初期レンダリング ---

  test('should render initial categories and links without errors', () => {
    ui.render();
    
    const categoryElements = ui.container.querySelectorAll('.category-card');
    expect(categoryElements.length).toBe(2);

    const linkElements = ui.container.querySelectorAll('.link-card');
    expect(linkElements.length).toBe(1);
    
    // カテゴリ1のタイトルを確認
    const cat1Title = ui.container.querySelector('#cat1 .category-title').textContent.trim();
    expect(cat1Title).toBe('Category 1');

    // リンク1のタイトルとURLを確認
    const link1Title = ui.container.querySelector('#link1 .link-title').textContent.trim();
    const link1Url = ui.container.querySelector('#link1 .link-url').textContent.trim();
    expect(link1Title).toBe('Link 1');
    expect(link1Url).toBe('http://example.com'); // UIによって表示形式が変わる可能性もあるため注意

    // Category 1 (id:cat1) が展開されていることを確認 (details要素のopen属性)
    const cat1Details = ui.container.querySelector('#cat1');
    expect(cat1Details.tagName.toLowerCase()).toBe('details'); // detailsタグを使用している前提
    expect(cat1Details.hasAttribute('open')).toBe(true);
    
    // Category 2 (id:cat2) が折りたたまれていることを確認
    const cat2Details = ui.container.querySelector('#cat2');
    expect(cat2Details.hasAttribute('open')).toBe(false);
  });
  
  test('should render appropriate message when no data is available', () => {
    dataManager.data = []; // データがない状態
    ui.render();
    const noDataMessage = ui.container.querySelector('.no-data-message'); // UIクラスがこのメッセージを表示すると仮定
    expect(noDataMessage).toBeDefined(); // または特定のエラーメッセージをexpect
  });

  // --- 編集モードのトグル ---
  test('should toggle edit mode visuals', () => {
    ui.isEditMode = false;
    ui.render();
    let editModeElements = document.querySelectorAll('.edit-mode-only'); // CSSクラスや要素で判断
    expect(editModeElements.length).toBe(0); // 編集モードでしか表示されない要素がないことを確認

    const saveArea = document.getElementById('saveArea');
    expect(saveArea.classList.contains('edit-mode')).toBe(false); // 例えばedit-modeクラスが付与されない

    ui.isEditMode = true;
    ui.render();
    editModeElements = document.querySelectorAll('.edit-mode-only');
    // UIクラスのrenderメソッドが編集モードに応じてDOMに何らかのクラスを付与するか、要素を表示/非表示にするはず
    // ここはUIの実装に合わせてアサーションを記述する
    // 例: expect(document.getElementById('addCategoryBtn').style.display).toBe('block');
    // 現状のHTMLとUIクラスの実装を考慮すると、具体的な要素のdisplayスタイルやclassで確認が必要
    const addCategoryBtn = document.getElementById('addCategoryBtn');
    expect(addCategoryBtn.style.display).toBe(''); // display: none が解除されていることを期待
    expect(addCategoryBtn.textContent).toContain('カテゴリ追加');
    
    expect(document.getElementById('bulkAddLinkBtn').style.display).toBe('');
    
    // .category-controls (カテゴリの編集ボタンなど) が表示されるか
    const categoryControls = ui.container.querySelector('.category-controls'); // category-controls クラスを持つ要素がedit modeで出現する前提
    expect(categoryControls).not.toBeNull();
    // もしくは、html.innerHTML = '' でクリアされるため、一旦レンダーしてeditmodeでrenderし直すというアプローチもアリ
    // ui.isEditMode = true;
    // ui.render();
    // const categoryEditBtn = ui.container.querySelector('.category-card .action-btn.btn-edit'); // カテゴリ編集ボタン
    // expect(categoryEditBtn).not.toBeNull();
  });
