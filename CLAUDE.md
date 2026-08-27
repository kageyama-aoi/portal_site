# CLAUDE.md — AI Assistant Guide for portal_site

## Project Overview

A lightweight, serverless personal portal site built with **vanilla JavaScript** (no framework, no bundler). Users organize links with tags (a link can carry zero, one, or many tags) within multiple named "portals". Data is stored in a local `data/data.json` file and persisted via browser download/upload. Configuration is stored in `localStorage`.

---

## Repository Structure

```
portal_site/
├── index.html            # Single-page app shell; defines all <dialog> elements
├── style.css             # All styles; CSS Variables for theming
├── data/
│   └── data.json         # Portal data (flat links with tags); the only "database"
├── js/
│   ├── app.js            # Entry point — initializes everything on DOMContentLoaded
│   ├── configManager.js  # Portal config (active portal ID, titles) via localStorage
│   ├── dataManager.js    # CRUD for links (flat, tag-grouped); dirty-state tracking
│   ├── iconList.js       # Material Symbols icon definitions used in icon picker
│   ├── ui.js             # DOM rendering, edit mode, drag-and-drop, view switching
│   └── dialogs/
│       ├── linkDialog.js       # Create/edit individual links
│       ├── bulkLinkDialog.js   # Batch-add links (newline-separated)
│       ├── iconPickerDialog.js # Select/configure icon + color/style
│       └── portalDialog.js     # Manage multiple portals
├── test/
│   ├── setup.js              # Jest global polyfills (TextEncoder, TextDecoder)
│   ├── sample.test.js         # Smoke test
│   ├── dataManager.test.js    # Unit tests for DataManager
│   └── ui.test.js             # Unit tests for UI
├── DOCS/                      # Design proposals and analysis docs (informational)
├── babel.config.js            # Babel — transpiles ESM for Jest
├── jest.config.js             # Jest — jsdom environment
└── package.json               # Dev deps: jest, babel only
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
| Persistence | `data/data.json` (file I/O) + `localStorage` (config) |

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
1. Data model changes → `dataManager.js`
2. UI rendering changes → `ui.js`
3. New dialog → create `js/dialogs/newDialog.js`, register in `app.js`
4. New icon → add to `iconList.js`
5. Theming → add/modify CSS variables in `style.css`

---

## Code Conventions

### Naming
- **Classes:** PascalCase (`DataManager`, `LinkDialog`)
- **Methods/Variables:** camelCase (`getLink`, `isDirty`)
- **Private methods:** Underscore prefix (`_generateId`, `_load`)
- **Constants:** SCREAMING_SNAKE_CASE (`CONFIG_KEY`)
- **IDs:** Prefix + timestamp + random (`cat_1234567890_abc`, `link_1234567890_def`)

### Module Pattern
Each file exports a single class. No default exports — use named exports:
```js
export class ClassName { ... }
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
1. `ConfigManager` — loads/creates portal config from localStorage
2. `DataManager` — initialized with active portal ID
3. `UI` — initialized with managers and dialog references
4. All `Dialog` instances — initialized with manager references
5. `fetch('data/data.json')` → `dataManager.loadData()` → `ui.render()`

### Edit Mode
The app has a read-only and an edit mode. Most mutations (add/delete/reorder) are only possible in edit mode. The UI class tracks this state and toggles button visibility accordingly.

### Dirty State
`DataManager.isDirty` tracks unsaved changes. When dirty, the UI shows a save button. Saving triggers a file download of the current `data.json`.

### View Modes
The UI supports **card view** (CSS Grid of link cards) and **table view** (compact rows). State is toggled via `ui.toggleViewMode()`.

### Ordering
There is no manual reordering. Links are a flat array grouped dynamically by tag at render time (a link with multiple tags appears in multiple groups), so a single "position" isn't meaningful once a link can belong to more than one group. Display order follows array order (creation order). There is a separate, unrelated drag-and-drop feature for reordering the header view-mode buttons (card/table/memory/workflow) — see `_initViewBtnOrder()` in `ui.js`.

---

## Testing Guidelines

- Test files live in `test/` and follow the `*.test.js` naming convention
- The JSDOM environment simulates browser APIs; `localStorage`, `document`, etc. are available
- `test/setup.js` adds `TextEncoder`/`TextDecoder` polyfills — add other globals there if needed
- Mock `fetch` for tests that involve data loading
- Do not import CSS or HTML templates in test files

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

### Running a specific test file
```bash
npx jest test/dataManager.test.js
```

---

## Git Workflow

- Default branch: `main`
- Development branch naming: `claude/<description>-<SESSION_ID>`
- Commit messages are primarily in Japanese (following existing history)
- Push with: `git push -u origin <branch-name>`
