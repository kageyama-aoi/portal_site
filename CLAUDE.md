# CLAUDE.md — AI Assistant Guide for portal_site

## Project Overview

A lightweight, serverless personal portal site built with **vanilla JavaScript** (no framework, no bundler). Users organize links with tags (a link can carry zero, one, or many tags) within multiple named "portals". Data is stored in a local `data/data.json` file and persisted via browser download/upload. Configuration is stored in `localStorage`.

主な機能: タグ別のリンク一覧（カード/テーブル表示）、思い出しモード（訪問履歴ベース）、
そして**作業フロー**（手順を記録し、配布バージョン管理・改変検知・チェックリスト付きの単体HTML/PDFとして書き出せる）。

---

## Repository Structure

```
portal_site/
├── index.html            # Single-page app shell; defines all <dialog> elements
├── style.css             # All styles; CSS Variables for theming (先頭に目次コメント)
├── data/
│   ├── data.json              # Portal data (flat links + tags + workflows + tagRegistry); the "database"
│   └── distribution-log.json  # 作業フロー出力の発行履歴 — 任意・.gitignore 対象（§作業フロー参照）
├── js/
│   ├── app.js            # Entry point — DOMContentLoaded で全マネージャ/ダイアログを DI 配線
│   ├── configManager.js  # Portal config (active portal ID, titles) via localStorage
│   ├── dataManager.js    # links の CRUD（フラット・タグ分類）＋ dirty 追跡＋旧形式マイグレーション
│   ├── searchManager.js  # 全リンク検索・タグ集計・findLinkById
│   ├── tagManager.js     # 事前登録タグ（tagRegistry）の管理
│   ├── tagSuggest.js     # タグ入力欄の共通サジェスト（link/workflow ダイアログ共用）
│   ├── badgeDetector.js  # URL からバッジ種別を自動推定
│   ├── memoryManager.js  # リンク訪問履歴（思い出しモード用）
│   ├── themeManager.js   # ライト/ダーク切り替え
│   ├── iconList.js       # Material Symbols アイコン定義（アイコンピッカー用）
│   ├── workflowManager.js    # 作業フロー（workflows）の CRUD・版更新
│   ├── workflowVersion.js    # 版管理の純粋関数（内容ハッシュ・照合コード・rev bump）
│   ├── workflowConstants.js  # FREQ_LABELS / freqLabel()（頻度ラベルの単一情報源）
│   ├── workflowExporter.js   # 作業フローの HTML/PDF 書き出し（巨大な文字列テンプレ・DOM非依存）
│   ├── distributionLog.js    # 発行履歴（localStorage 作業コピー＋共有ファイル）
│   ├── ui.js             # DOM 描画・編集モード・ビュー切替・各モードのレンダリング
│   ├── util/
│   │   ├── html.js           # escapeHtml()（全モジュール共通）
│   │   └── clipboard.js      # copyToClipboard()（Clipboard API＋execCommand フォールバック）
│   └── dialogs/
│       ├── linkDialog.js            # 個別リンクの作成/編集
│       ├── bulkLinkDialog.js        # 複数リンク一括追加（改行区切り）
│       ├── iconPickerDialog.js      # アイコン＋色/スタイル選択
│       ├── portalDialog.js          # 複数ポータル管理
│       ├── workflowDialog.js        # 作業フローの閲覧/作成/編集（ステップ並べ替え含む）
│       └── distributionLogDialog.js # 発行履歴の一覧・配布先メモ編集・CSV/JSON 書き出し
├── test/
│   ├── setup.js                    # Jest polyfills (TextEncoder, TextDecoder)
│   ├── dataManager.test.js         # DataManager
│   ├── ui.test.js                  # UI（タググループ描画・編集モード）
│   ├── ui.characterization.test.js # リファクタ用の特性テスト（現行挙動の固定）
│   ├── workflowDialog.test.js      # ステップ並べ替え（moveStep / ▲▼）
│   ├── workflowVersion.test.js     # 内容ハッシュ・照合コード・rev bump
│   ├── workflowExport.test.js      # 出力HTMLを jsdom で生成→検証（版スタンプ・改変検知・チェックリスト）
│   ├── distributionLog.test.js     # 発行履歴マネージャ
│   └── distributionLogDialog.test.js # 発行履歴ダイアログ
├── DOCS/                      # 設計提案・分析ドキュメント（情報用）
├── .agent/handoff/           # セッション引き継ぎメモ
├── babel.config.js            # Babel — Jest 用 ESM トランスパイル
├── jest.config.js             # Jest — jsdom 環境
└── package.json               # dev deps: jest, babel のみ
```

---

## Technology Stack

| Layer | Technology |
|---|---|
| Language | Vanilla JavaScript (ES Modules) |
| Markup | HTML5 (native `<dialog>`, `<details>`) |
| Styling | CSS3 with CSS Custom Properties |
| Icons | Material Symbols (Google Fonts CDN) |
| Testing | Jest 30 + JSDOM + babel-jest |
| Transpilation | Babel (@babel/preset-env, current Node target) |
| Build | None — browser loads modules directly |
| Persistence | `data/data.json` (file I/O) + `localStorage` (config・発行履歴の作業コピー) + `data/distribution-log.json` (発行履歴の共有ファイル・任意) |

No React, Vue, Angular, or bundler (webpack/vite/rollup). Do not introduce frameworks or bundlers unless explicitly asked.

---

## Development Workflow

### Running Tests
```bash
npm test
```
This is the only available npm script. Tests run via Jest in a JSDOM environment.

### Running Locally
Open `index.html` in a browser — or use any static file server:
```bash
npx serve .
# or
python3 -m http.server
```
No build step required.

### Adding Features
1. Link のデータモデル変更 → `dataManager.js`
2. UI 描画変更 → `ui.js`（各モードは `_renderXxxMode` / `_buildXxx` メソッド）
3. 新ダイアログ → `js/dialogs/newDialog.js` を作成し `app.js` で配線
4. 新アイコン → `iconList.js` に追加
5. テーマ → `style.css` の CSS 変数（先頭に目次あり）
6. 作業フロー機能・出力HTML → §作業フロー参照（`workflowManager.js` / `workflowExporter.js`）
7. 共通処理（エスケープ・クリップボード・定数）→ `js/util/` / `js/workflowConstants.js`

---

## Code Conventions

### Naming
- **Classes:** PascalCase (`DataManager`, `LinkDialog`)
- **Methods/Variables:** camelCase (`getLink`, `isDirty`)
- **Private methods:** Underscore prefix (`_generateId`, `_load`)
- **Constants:** SCREAMING_SNAKE_CASE (`CONFIG_KEY`, `FREQ_LABELS`)
- **IDs:** Prefix + timestamp + random (`link_1234567890_def`, `wf_1234567890_abc`, `dist_...`)

### Module Pattern
No default exports — 名前付き export のみ。多くのマネージャ/ダイアログは1ファイル1クラス
（`export class ClassName {}`）。ただし小さなユーティリティ（`util/html.js`・`workflowConstants.js`・
`workflowExporter.js`）は関数を名前付き export する。
```js
export class ClassName { ... }        // マネージャ・ダイアログ
export function helper(...) { ... }    // ユーティリティ
```

### Dependency Injection
Managers are passed as constructor arguments. Dialogs receive the managers they need:
```js
const linkDialog = new LinkDialog(dataManager, ui);
```

### Callbacks vs Events
Communication between modules uses callbacks, not DOM events:
```js
dataManager.onDirty = () => ui.updateSaveButton();
```

### Deep Cloning
Always deep-clone data objects when mutating state:
```js
JSON.parse(JSON.stringify(obj))
```

### JSDoc
All public methods and classes have JSDoc comments. Maintain this when adding new code.

---

## Data Model

### `data/data.json` structure
Links are stored as a **flat array per portal** — there is no category/folder concept. `tags` is the only grouping mechanism: a link may have zero, one, or many tags, and a link with N tags is displayed inside N tag groups (card view, table view, and search results all group by tag). Links with no tags are shown under a "タグなし" (no tag) group.

```json
{
  "portals": {
    "default": [
      {
        "id": "link_<timestamp>_<random>",
        "title": "Link Title",
        "url": "https://example.com",
        "badge": "doc",
        "icon": "article",
        "iconColor": "#4A90D9",
        "iconStyle": "outlined",
        "memo": "Optional note",
        "tags": ["work", "reference"]
      }
    ]
  }
}
```

Older files that still use the pre-tag category-nested shape (`[{id, title, isOpen, links: [...]}]`) are automatically flattened on load by `DataManager._migrateLegacyPortal()` — each category's title becomes an initial tag on all of its links.

### Tag registry (`tagRegistry`)
Tags normally only exist implicitly as strings inside each link's `tags` array (`SearchManager.getAllTags()` derives the "all tags" list by scanning links). `data/data.json` also has an optional top-level `tagRegistry` key (sibling of `portals`/`workflows`, portal-scoped like `workflows`) for tags that have been deliberately pre-created but aren't attached to any link yet:
```json
{ "portals": {...}, "workflows": {...}, "tagRegistry": { "default": ["タグA", "タグB"] } }
```
Managed by `js/tagManager.js` (`TagManager`, mirrors `WorkflowManager`'s pattern). The sidebar tag filter panel merges `SearchManager.getAllTags()` (used tags) with `TagManager.getRegisteredTags(portalId)` (registered-but-unused tags, shown with a dashed `.tag-chip-empty` style) and exposes a "＋タグ作成" button (edit mode only) to add new registry entries via `prompt()`.

### Workflows (`workflows`)
`data/data.json` の top-level `workflows` キーはポータルごとの作業フロー配列。`WorkflowManager` が管理。

```json
{
  "workflows": {
    "default": [
      {
        "id": "wf_<ts>_<rnd>",
        "title": "確定申告フロー",
        "description": "年1回の手順",
        "tags": ["税務"],
        "freq": "rare",              // daily | weekly | monthly | rare（FREQ_LABELS）
        "rev": 3,                    // 版番号。内容変更を伴う保存で +1
        "updatedAt": "2026-08-27T...",
        "contentHash": "a1b2c3d4",   // title+description+steps の内容ハッシュ（rev bump 判定用）
        "steps": [
          { "step": 1, "title": "…", "memo": "", "prompt": "", "promptType": "none", "linkId": null }
        ]
      }
    ]
  }
}
```

- `promptType`: `none` | `prompt` | `code` | `text`（`none` は本文があっても非表示）
- 旧データ（`rev` 無し）は読み込み時 `DataManager._ensureWorkflowVersions()` が `rev:1` 補完（dirty にはしない）
- 版フィールドの純粋ロジックは `js/workflowVersion.js`（`workflowContentHash` / `verificationCode` / `bumpRevIfContentChanged`）

### 発行履歴（発行台帳 / distributionLog）
作業フローを HTML/PDF 出力したとき「どの版を・いつ・誰に配ったか」を残す。**配布物には含めない**。
- 作業コピー: `localStorage['portalWorkflowDistributionLog']`（＋ `portalWorkflowExportPrefs` で出力ダイアログの前回値）
- 共有ファイル: `data/distribution-log.json`（**.gitignore 対象** — 配布先メモに個人名が入りうるため）。
  起動時に `app.js` が fetch → `DistributionLogManager.applyFileData()` で localStorage へマージ。
- `data.json` と同じ「fetch で読み・download で書き」モデル。ダイアログの「台帳を保存」で書き出し、`data/` に置き直す。

### Valid `badge` values
`doc`, `spreadsheet`, `website`, `drive`, `video`, `article`, `portal`, `code`, `tool`, `sns`, `cloud`, `local`, `money`, `news`, `idea`, `company`

`spreadsheet`, `website`, `drive` and `local` (opendir: paths, and when the opendir checkbox is used) are auto-suggested from the URL by `js/badgeDetector.js` when adding/editing a link, but the user can always override the selection manually. `drive` (Google Drive) is kept separate from the generic `cloud` badge (Dropbox/OneDrive/iCloud/Sharepoint) since it's used far more often.

### Valid `iconStyle` values
`outlined`, `rounded`, `sharp`

### Portal config in `localStorage` (key: `portalAppConfig`)
```json
{
  "activePortalId": "default",
  "portals": {
    "default": {
      "title": "My Portal",
      "subtitle": "Subtitle text"
    }
  }
}
```

---

## UI Architecture

### Initialization Order (`app.js`)
1. `ConfigManager` — localStorage からポータル設定を読み込み/生成
2. `DataManager` — onDirty コールバック付きで生成
3. `SearchManager` / `TagManager` を先に生成（ダイアログのタグ候補に使うため）
4. `LinkDialog` / `BulkLinkDialog` → `UI` を生成し、`searchManager` / `tagManager` / `memoryManager` / `workflowManager` を後付け
5. `DistributionLogManager` + `DistributionLogDialog`（`onDirtyChange` で発行履歴ボタンの● を更新）
6. `WorkflowDialog` / `PortalDialog`
7. `await dataManager.load(activePortalId)` → `await fetch('data/distribution-log.json')`（失敗は無視）
8. 各ダイアログ `init()` → `ui.init()` → `ui.render()`
9. `ThemeManager.init()`

### Edit Mode
The app has a read-only and an edit mode. Most mutations (add/delete/reorder) are only possible in edit mode. The UI class tracks this state and toggles button visibility accordingly.

### Dirty State
`DataManager.isDirty` tracks unsaved changes. When dirty, the UI shows a save button. Saving triggers a file download of the current `data.json`.

### View Modes
`ui.viewMode` で切り替え（`localStorage['portalViewMode']` に永続化）。ヘッダーのボタンは D&D で並べ替え可（`_initViewBtnOrder()`）。
- **card** — リンクカードのグリッド（タグ別グループ）
- **table** — コンパクトな行（タグ別グループ）
- **memory**（思い出しモード）— 訪問履歴ベースの「久しく開いていないリンク」提示（`memoryManager.js`）
- **workflow**（作業フロー）— §作業フロー参照

### Ordering
リンクに手動並べ替えは無い（タグで複数グループに現れるため位置が一意にならない）。表示順は配列順（作成順）。
作業フローの**ステップ**は手動並べ替え可（編集時：ドラッグ＋▲▼、`workflowDialog.js` の `WorkflowDialog.moveStep`／メイン画面：D&D）。

---

## 作業フロー（Workflow）

「たまにしかやらない手順」を記録し、単体HTML/PDFとして配布できる機能。

### 構成
| 役割 | ファイル |
|---|---|
| データ CRUD・版更新 | `workflowManager.js`（`getWorkflows` は clone を返し、内容変更系メソッドで `bumpRevIfContentChanged`） |
| 版管理の純粋ロジック | `workflowVersion.js` |
| 頻度ラベル定数 | `workflowConstants.js`（`FREQ_LABELS` / `freqLabel()` — ここが単一情報源。他所でマップを再定義しない） |
| 閲覧/編集ダイアログ | `dialogs/workflowDialog.js` |
| メイン画面のビュー描画 | `ui.js` の `_renderWorkflowMode` → `_buildWorkflowModeHeader` / `_buildWorkflowCard` / `_buildWorkflowStepRow` / `_buildWorkflowStepPrompt` / `_buildWorkflowStepLink`（既定は折りたたみ・`expandedWorkflowIds` で開いたものを記憶） |
| HTML/PDF 書き出し | `workflowExporter.js`（`exportWorkflowsAsHtml` / `exportWorkflowsAsPdf`。UI は `_workflowsForExport` + `_exportOptions` で薄く委譲） |
| 発行履歴 | `distributionLog.js` / `dialogs/distributionLogDialog.js` |

### 出力HTML（`exportWorkflowsAsHtml`）
巨大な文字列テンプレート（HTML＋インラインCSS＋インラインJS）を1つ生成。**サーバー不要・単体動作**。
- **配布バージョン管理**: 見出しに `v{rev} ・ 更新日 ・ 照合コード`、ファイル名 `名前_v{rev}_日付.html`、`<script id="wf-meta">` に版情報
- **改変検知**: 配布時の本文を `<script id="wf-baseline">`(JSON) に同梱。開くたび照合し「📄 配布時のまま / ⚠ 配布後に内容が変更されています」バッジ
- **編集モード**: `[data-editable]` を contenteditable 化 → 「HTMLとして保存」で新ファイルとしてDL（元は上書きしない）。基準値は据え置くので編集済みコピーは ⚠ が残る
- **チェックリスト**: 各ステップにチェックボックス。チェックで打ち消し線＋畳み、見出しに円形プログレス（％）。状態は `localStorage['wfcheck:{id}:{contentHash}']`（版が変われば自動リセット）。保存時に `checked` 属性へ焼き込み
- **見直し予定日 / 入手先**: 出力ダイアログで任意入力。フッター表示・期限超過で注意文
- **Git 非露出**: 配布物・出力設定に `github` / リポジトリ名 / `.git` を含めない（`workflowExport.test.js` で担保）。照合コードは16進8桁を避ける（`R{rev}-{MMDD}-{4文字}`）

出力HTMLのインラインJSはモジュールを import できないため、`escapeHtml` 等は使えず自前実装。ここを編集するときは `workflowExport.test.js`（jsdom で生成→検証、16+ケース）を必ず回す。

---

## Testing Guidelines

- Test files live in `test/` and follow the `*.test.js` naming convention
- The JSDOM environment simulates browser APIs; `localStorage`, `document`, etc. are available
- `test/setup.js` adds `TextEncoder`/`TextDecoder` polyfills — add other globals there if needed
- Mock `fetch` for tests that involve data loading
- Do not import CSS or HTML templates in test files（`ui.test.js` は `index.html` を `fs.readFileSync` で読み `document.body.innerHTML` に流すのは可）
- **出力HTML のテスト**: `workflowExport.test.js` は UI をモック依存で組み、`Blob` を差し替えて生成HTML文字列を捕捉 → `document.documentElement.innerHTML` に流し込んでインライン `<script>` を `eval` 実行し挙動検証する
- **特性テスト**: 大きめのリファクタ前は `ui.characterization.test.js` のように「現行の見た目・挙動」を固定するテストを先に足す

### Example test structure
```js
import { DataManager } from '../js/dataManager.js';

describe('DataManager', () => {
  let dm;
  beforeEach(() => {
    dm = new DataManager('default');
  });

  test('should add a link', () => {
    dm.addLink({ title: 'Test', url: 'https://example.com', tags: [] });
    expect(dm.getData().length).toBe(1);
  });
});
```

---

## Key Constraints

1. **No server required** — all functionality must work from a static file server
2. **No external runtime dependencies** — only `jest-environment-jsdom` is in `dependencies` (for tests); do not add runtime npm packages
3. **No build step** — the browser imports ES Modules directly from `js/`
4. **Data persistence is manual** — users must download and replace `data.json` to save; there is no auto-save to disk
5. **Vanilla JS only** — do not introduce TypeScript, JSX, or a UI framework without explicit request

---

## Common Tasks for AI Assistants

### Adding a new link field
1. Update the link object creation in `dataManager.js` (`addLink`)
2. Add input to the dialog HTML in `index.html` (inside `#linkDialog`)
3. Read/write the field in `linkDialog.js`
4. Render it in `ui.js` (card and/or table view)
5. Add a test in `test/dataManager.test.js`

### Adding a new dialog
1. Create `js/dialogs/myDialog.js` exporting `class MyDialog`
2. Add the `<dialog id="myDialog">` markup in `index.html`
3. Import and instantiate in `app.js`, pass to `UI` constructor if needed
4. Add trigger button in `ui.js` or relevant dialog

### Modifying the theme
All colors are CSS variables in `style.css` under `:root`. Dark mode overrides are under `[data-theme="dark"]`. Modify variables there — do not hardcode colors.
CSS の節見出しは `/* ── 名前 ── */` 形式で統一。`!important` は詳細度の綱引きを避けるための保険で
現状は必要（外す前に実ブラウザで before/after を確認すること — 視覚回帰テストは無い）。

### 作業フローの出力HTMLに手を入れる
`workflowExporter.js` を編集。HTML/PDF でステップ描画・リンク解決・freq ラベルを共有しているので
片方だけ直さない。編集後は必ず `npx jest test/workflowExport.test.js`。

### Running a specific test file
```bash
npx jest test/dataManager.test.js
```

---

## Git Workflow

- Default branch: `main`。ソロ運用のため通常は `main` に直接コミット＆push（別ブランチは明示依頼時のみ）
- 開発作業は `/github-issue-dev` スキルの流れに従う: Issue 登録 → 開発 → `npm test` → コミットメッセージ候補提示 → コミット → push → Issue クローズ（ハッシュ記載）
- コミットメッセージは日本語（既存履歴に合わせる）、Conventional Commits の type を付ける（`feat` / `fix` / `refactor` / `style` / `test` / `chore` / `docs`）
- `data/data.json` は追跡対象。`data/distribution-log.json` と `data/＿*.json`（手動バックアップ）、`.vscode/`、`*.code-workspace` は `.gitignore`
