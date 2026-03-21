# CLAUDE.md — AI Assistant Guide for portal_site

## Project Overview

A lightweight, serverless personal portal site built with **vanilla JavaScript** (no framework, no bundler). Users organize links into categories within multiple named "portals". Data is stored in a local `data/data.json` file and persisted via browser download/upload. Configuration is stored in `localStorage`.

---

## Repository Structure

```
portal_site/
├── index.html            # Single-page app shell; defines all <dialog> elements
├── style.css             # All styles; CSS Variables for theming
├── data/
│   └── data.json         # Portal data (categories + links); the only "database"
├── js/
│   ├── app.js            # Entry point — initializes everything on DOMContentLoaded
│   ├── configManager.js  # Portal config (active portal ID, titles) via localStorage
│   ├── dataManager.js    # CRUD for categories and links; dirty-state tracking
│   ├── iconList.js       # Material Symbols icon definitions used in icon picker
│   ├── ui.js             # DOM rendering, edit mode, drag-and-drop, view switching
│   └── dialogs/
│       ├── categoryDialog.js   # Create/edit categories
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
- **Methods/Variables:** camelCase (`getCategory`, `isDirty`)
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
```json
{
  "portals": {
    "default": [
      {
        "id": "cat_<timestamp>_<random>",
        "title": "Category Name",
        "isOpen": true,
        "links": [
          {
            "id": "link_<timestamp>_<random>",
            "title": "Link Title",
            "url": "https://example.com",
            "badge": "doc",
            "icon": "article",
            "iconColor": "#4A90D9",
            "iconStyle": "outlined",
            "memo": "Optional note"
          }
        ]
      }
    ]
  }
}
```

### Valid `badge` values
`video`, `doc`, `article`, `portal`, `code`, `tool`

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

### Drag and Drop
Drag-and-drop reordering is implemented natively (HTML5 drag events). Both categories and links within a category can be reordered.

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

  test('should add a category', () => {
    dm.addCategory('Test');
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
