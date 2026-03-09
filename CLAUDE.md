# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Git workflow

After completing any meaningful unit of work, commit and push to GitHub so progress is never lost:

```bash
git add <specific files>
git commit -m "short descriptive message"
git push
```

Keep commits focused and atomic — one logical change per commit. Do not batch unrelated changes together.

## Commands

```bash
# Install dependencies
npm install

# Start the server (runs on http://localhost:3737)
npm start

# Kill a running instance before restarting
pkill -f "node server.js"
```

No build step — the frontend is plain HTML/CSS/JS served as static files.

## Architecture

Single-file Express server (`server.js`) + vanilla JS frontend (`public/`). No framework, no bundler.

### Layout

The UI has a **left sidebar** for switching between editors and a **main content area** with three tabs per editor: Add Trading Group, Edit Entries, Delete Entries.

### Backend (`server.js`)

API is editor-scoped. Add new editors here by extending `ASSET_PATHS`:

```js
const ASSET_PATHS = {
  dxb: '../algo-trading-config-prod/dbb/config/assets.json',
  dxc: '../algo-trading-config-prod/dbc/config/assets.json',
};
// GET  /api/assets/:editor
// POST /api/assets/:editor  — expects { DxB: [...] }
```

Both files use `DxB` as the root JSON key regardless of editor name.

### Frontend (`public/app.js`)

**State:**
- `currentEditor` — `'dxb'` or `'dxc'`, drives all API calls and config lookups
- `dxbData` — in-memory copy of the active editor's `DxB` array
- `selectedIndices` — `Set` of checked indices for the Delete tab

**Per-editor config** — add new editors here too:
```js
const EDITOR_CONFIG = {
  dxb: { label: 'DxB', toleranceMs: 3000, routingIds: ['XMEV_1', 'XMEV_2', 'XMEV_3', 'XMEV_4'] },
  dxc: { label: 'DxC', toleranceMs: 5000, routingIds: ['XMEV_1', 'XMEV_2', 'XMEV_3'] },
};
```

**Key functions:**
- `loadAssets()` — fetches `/api/assets/${currentEditor}`, then calls `renderAll()`
- `renderAll()` — calls `renderChecklist()`, `renderEditList()`, `renderRoutingBalance()`
- `saveAssets(newDxB, isAdd)` — POSTs to `/api/assets/${currentEditor}`, then calls `renderAll()`
- `renderChecklist()` — Delete tab; group checkboxes with indeterminate state via `selectedIndices`
- `renderEditList()` — Edit tab; inline expand/collapse form per entry
- `renderRoutingBalance()` — Add tab; balance cards counting unique TradingGroups per OrderRoutingId
- `populateRoutingDropdown()` — rebuilds the Add form's routing select from `routingIds()` for the active editor
- `routingIds()` — returns `EDITOR_CONFIG[currentEditor].routingIds`

**Sticky layout:** the header is `position: sticky; top: 0`. The toolbar uses `top: var(--header-h)`, set via JS after measuring `#main-header.offsetHeight`.

### Adding a new editor

1. `server.js` — add entry to `ASSET_PATHS`
2. `app.js` — add entry to `EDITOR_CONFIG` (label, toleranceMs, routingIds)
3. `index.html` — add `<button class="editor-btn" data-editor="...">` in the sidebar

### JSON schema

Each entry in the `DxB` array:
```json
{
  "MarketDataSourceId": "XMEV_1",
  "OrderRoutingId": "XMEV_1",
  "TradingGroup": "AL30",
  "SettlementType": "T_PLUS_0",
  "MinimumQty": 1,
  "ToleranceThresholdMs": 3000,
  "Assets": [
    { "Symbol": "AL30D", "SecurityID": "AL30D-0001-C-CT-USD", "SecurityType": "BOND", "Currency": "USD", "Underlying": "AL30", "SettlementType": "T_PLUS_0" },
    { "Symbol": "AL30C", "SecurityID": "AL30C-0001-C-CT-EXT", "SecurityType": "BOND", "Currency": "EXT", "Underlying": "AL30", "SettlementType": "T_PLUS_0" },
    { "Symbol": "AL30",  "SecurityID": "AL30-0001-C-CT-ARS",  "SecurityType": "BOND", "Currency": "ARS", "Underlying": "AL30", "SettlementType": "T_PLUS_0" }
  ]
}
```

SecurityID convention: `{Symbol}-{seq}-C-CT-{Currency}` — `seq` is `0001` for T_PLUS_0, `0002` for T_PLUS_1. Auto-generated in Add and Edit flows; `Underlying` is always set to `TradingGroup`.

Each TradingGroup always has exactly two entries — one per SettlementType.
