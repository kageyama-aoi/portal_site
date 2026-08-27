// test/ui.test.js
import { UI } from '../js/ui.js';
import { DataManager } from '../js/dataManager.js';
import { ConfigManager } from '../js/configManager.js';

import fs from 'fs';
import path from 'path';

// index.html の内容を読み込む (プロジェクトルートからの相対パスで指定)
const html = fs.readFileSync(path.resolve(process.cwd(), 'index.html'), 'utf8');

describe('UI', () => {
  let dataManager;
  let ui;
  let configManager;
  let linkDialogMock;
  let bulkLinkDialogMock;

  // フラットなリンク配列（タグのみで分類）
  const initialData = [
    { id: 'link1', title: 'Link 1', url: 'http://example.com', icon: 'article', badge: 'doc', memo: 'Memo', tags: ['仕事'] },
    { id: 'link2', title: 'Link 2', url: 'http://example2.com', icon: 'link', badge: 'doc', memo: '', tags: [] },
  ];

  beforeEach(() => {
    // 実際のindex.htmlをDOMに読み込み、renderが依存する実要素（#app-container等）を用意する
    document.body.innerHTML = html;
    localStorage.clear();

    dataManager = new DataManager(() => {});
    dataManager.data = JSON.parse(JSON.stringify(initialData));

    // ConfigManagerはlocalStorageのみに依存するため実体をそのまま使う
    configManager = new ConfigManager();

    // ダイアログはrender()中には呼ばれず、クリックハンドラ内でのみ参照されるためモックで十分
    linkDialogMock = { open: jest.fn(), init: jest.fn() };
    bulkLinkDialogMock = { open: jest.fn(), init: jest.fn() };

    ui = new UI(dataManager, configManager, linkDialogMock, bulkLinkDialogMock);
    ui.portalDialog = { open: jest.fn() };
    ui.init();
  });

  // --- 初期レンダリング ---

  test('should render links grouped by tag without errors', () => {
    ui.render();

    const groups = ui.container.querySelectorAll('.tag-group-section');
    expect(groups.length).toBe(2); // 「仕事」グループ + 「タグなし」グループ

    const linkElements = ui.container.querySelectorAll('.link-card-wrapper');
    expect(linkElements.length).toBe(2);

    // 1つ目のグループは「仕事」タグ（五十音順で先に、タグなしは最後）
    const firstGroupLabel = groups[0].querySelector('.summary-content');
    expect(firstGroupLabel.textContent).toContain('仕事');

    const secondGroupLabel = groups[1].querySelector('.summary-content');
    expect(secondGroupLabel.textContent).toContain('タグなし');

    // リンク1のタイトルとURLを確認
    const linkTitle = ui.container.querySelector('.link-title').textContent.trim();
    const linkHref = ui.container.querySelector('.link-card').getAttribute('href');
    expect(linkTitle).toBe('Link 1');
    expect(linkHref).toBe('http://example.com');

    // タググループは常に展開された状態で表示される
    expect(groups[0].open).toBe(true);
    expect(groups[1].open).toBe(true);
  });

  test('should render no tag groups when no data is available', () => {
    dataManager.data = []; // データがない状態
    ui.render();
    // カード表示のヘッダーは常設のため残るが、タググループは0件になる
    expect(ui.container.querySelectorAll('.tag-group-section').length).toBe(0);
  });

  test('should show a hint when links exist but none have tags yet', () => {
    dataManager.data = [
      { id: 'link1', title: 'Link 1', url: 'http://example.com', tags: [] },
    ];
    ui.render();
    expect(ui.container.querySelectorAll('.tag-group-section').length).toBe(0);
    expect(ui.container.querySelector('.table-group-empty')).not.toBeNull();
  });

  // --- 編集モードのトグル ---

  test('should toggle edit mode visuals', () => {
    const editModeToggle = document.getElementById('editModeToggle');
    const addLinkBtn = document.getElementById('addLinkBtn');
    const bulkAddLinkBtn = document.getElementById('bulkAddLinkBtn');

    // 初期状態（編集モードOFF）
    expect(ui.isEditMode).toBe(false);
    expect(addLinkBtn.style.display).toBe('none');
    expect(bulkAddLinkBtn.style.display).toBe('none');
    expect(ui.container.querySelector('.card-actions')).toBeNull();

    // 編集モードON
    editModeToggle.checked = true;
    editModeToggle.dispatchEvent(new Event('change'));

    expect(ui.isEditMode).toBe(true);
    expect(addLinkBtn.style.display).toBe('block');
    expect(bulkAddLinkBtn.style.display).toBe('block');
    expect(ui.container.querySelector('.card-actions')).not.toBeNull();
    expect(ui.container.querySelector('.card-actions .btn-delete')).not.toBeNull();

    // 編集モードOFFに戻す
    editModeToggle.checked = false;
    editModeToggle.dispatchEvent(new Event('change'));

    expect(ui.isEditMode).toBe(false);
    expect(addLinkBtn.style.display).toBe('none');
    expect(ui.container.querySelector('.card-actions')).toBeNull();
  });
});
