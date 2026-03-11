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

Left sidebar for switching editors + main content area with three tabs: Add, Edit Entries, Delete Entries.

### Backend (`server.js`)

Editor-scoped API. Each editor has a `file` path and a `rootKey`:

```js
const EDITORS = {
  dxb:  { file: '...dbb/config/assets.json',      rootKey: 'DxB'  },
  dxc:  { file: '...dbc/config/assets.json',      rootKey: 'DxB'  },
  tita: { file: '...futop-tita/assets.json',       rootKey: 'TITA' },
};
// GET  /api/assets/:editor  — returns raw JSON file
// POST /api/assets/:editor  — validates Array.isArray(data[rootKey]), writes file
```

### Frontend (`public/app.js`)

**State:**
- `currentEditor` — active editor key, drives all API calls and config lookups
- `entryData` — in-memory copy of the active editor's data array
- `selectedIndices` — `Set` of checked indices for the Delete tab

**Three editor types** — controlled by `EDITOR_CONFIG[e].type`:

| type    | editors              | description |
|---------|----------------------|-------------|
| `dxb`   | DxB, DxC             | Multi-currency assets (USD/EXT/ARS), paired T+0/T+1 entries per TradingGroup, routing balance panel |
| `tita`  | TITA Bonds, TITA Stocks | Single-currency ARS, one entry per symbol, Asset + optional LiquidityAsset |
| `canje` | Canje                | USD+EXT pairs, LiquidityAsset, per-entry routing, Balance Routing feature |

**Full EDITOR_CONFIG:**
```js
const EDITOR_CONFIG = {
  dxb:   { label: 'DxB',          type: 'dxb',   toleranceMs: 3000, routingIds: ['XMEV_1','XMEV_2','XMEV_3','XMEV_4'], rootKey: 'DxB' },
  dxc:   { label: 'DxC',          type: 'dxb',   toleranceMs: 5000, routingIds: ['XMEV_1','XMEV_2','XMEV_3'],           rootKey: 'DxB' },
  tita:  { label: 'TITA Bonds',   type: 'tita',  toleranceMs: 1000, rootKey: 'TITA',
    routingIds: ['XMEV','XMEV_2'],
    tradingGroups: ['BONOS','LETRAS','ONs','REPO'],
    securityTypes: ['BOND','NEGOTIABLE_BOND','LETRAS_DEL_TESORO'],
  },
  'tita-stocks': { label: 'TITA Stocks', type: 'tita', toleranceMs: 5000, rootKey: 'TITA',
    routingIds: ['XMEV','XMEV_2'],
    tradingGroups: ['CEDEAR','ADR','BR','SEC','REPO'],
    securityTypes: ['CERTIFICATE_OF_DEPOSIT','STOCK'],
  },
  canje: { label: 'Canje',        type: 'canje', toleranceMs: 3000, mdsIds: [], routingIds: [], rootKey: 'CANJE' },
};
```
`canje.mdsIds` and `canje.routingIds` are populated dynamically from `entryData` via `deriveCanjeDynamicOptions()` after each load.

**Key functions:**
- `loadAssets()` — fetches `/api/assets/${currentEditor}`, extracts `data[rootKey]` into `entryData`, calls `renderAll()`
- `renderAll()` — branches on `type`: calls dxb or tita render functions
- `saveAssets(newData, isAdd, isTitaAdd)` — POSTs `{ [rootKey]: newData }`, calls `renderAll()`
- `renderChecklist()` / `renderTitaChecklist()` — Delete tab per type
- `renderEditList()` / `renderTitaEditList()` — Edit tab per type
- `renderRoutingBalance()` — Add tab; for dxb type shows two sections (Primary / Liquidity), each with cards per routing ID counting unique TradingGroups; for tita type shows a single flat count per OrderRoutingId
- `buildNewEntries(tg, primaryMdsId, primaryRoutingId, liquidityMdsId, liquidityRoutingId, minQty, usdSym, extSym, arsSym)` — builds T+0 + T+1 pair; all 4 routing fields are set independently
- `buildTitaEntry()` — builds single TITA entry; REPO uses `#-U-CT-ARS` pattern, no LiquidityAsset
- `buildCanjeEntry()` — builds CANJE entry with 4 assets (USD T+0/T+1, EXT T+0/T+1) + LiquidityAsset (USD T+1)
- `populateRoutingDropdown()` — populates all 4 Add-form routing selects (`primary-mds-id`, `primary-routing-id`, `liquidity-mds-id`, `liquidity-routing-id`)
- `populateTitaDropdowns()` — fills `tita-trading-group`, `tita-security-type`, `tita-order-routing-id` from `EDITOR_CONFIG[currentEditor]`; called on editor switch and after save
- `populateCanjeDropdowns()` — fills `canje-mds-id` and `canje-routing-id` from `EDITOR_CONFIG.canje.mdsIds/routingIds`
- `deriveCanjeDynamicOptions()` — derives unique `MarketDataSourceId` and `OrderRoutingId` from `entryData` and stores into `EDITOR_CONFIG.canje`
- `renderCanjeChecklist()` / `renderCanjeEditList()` — Delete/Edit tab for Canje
- Balance Routing (Canje Edit tab) — round-robin assigns `OrderRoutingId` across sorted entries to equalize distribution

**Add tab HTML:** three wrappers inside `#tab-add` — `#dxb-add-wrapper`, `#tita-add-wrapper`, `#canje-add-wrapper`. Only one is visible at a time based on editor type.

**DxB/DxC Add form routing fields** (4 independent selects):
- `#primary-mds-id` → `PrimaryMarketDataSourceId`
- `#primary-routing-id` → `PrimaryOrderRoutingId`
- `#liquidity-mds-id` → `LiquidityMarketDataSourceId`
- `#liquidity-routing-id` → `LiquidityOrderRoutingId`

**DxB/DxC Edit panel routing fields** (4 independent selects):
- `.ef-primary-mds` → `PrimaryMarketDataSourceId`
- `.ef-primary-rid` → `PrimaryOrderRoutingId`
- `.ef-liquidity-mds` → `LiquidityMarketDataSourceId`
- `.ef-liquidity-rid` → `LiquidityOrderRoutingId`

**Sticky layout:** header `position: sticky; top: 0`. Toolbar uses `top: var(--header-h)` set by JS from `#main-header.offsetHeight`.

### Adding a new editor

**Same schema as DxB/DxC:**
1. `server.js` — add to `EDITORS` with `file` and `rootKey: 'DxB'`
2. `app.js` — add to `EDITOR_CONFIG` with `type: 'dxb'`, `toleranceMs`, `routingIds`
3. `index.html` — add `<button class="editor-btn" data-editor="...">` in the sidebar

**Same schema as TITA (reuse tita type):**
1. `server.js` — add to `EDITORS` with `file` and `rootKey: 'TITA'`
2. `app.js` — add to `EDITOR_CONFIG` with `type: 'tita'`, `toleranceMs`, `routingIds`, `tradingGroups`, `securityTypes`
3. `index.html` — add sidebar button (the TITA wrappers and form are shared)

**New schema type:**
1–3 above, plus add render functions (`renderXxxChecklist`, `renderXxxEditList`), an add form wrapper in HTML, and branch in `renderAll()`.

### JSON schemas

**DxB/DxC entry** (root key `DxB`, two entries per TradingGroup — one per SettlementType):
```json
{
  "PrimaryExchange": "XMEV",
  "PrimaryMarketDataSourceId": "XMEV_1",
  "PrimaryOrderRoutingId": "XMEV_1",
  "LiquidityExchange": "XMEV",
  "LiquidityMarketDataSourceId": "XMEV_1",
  "LiquidityOrderRoutingId": "XMEV_1",
  "TradingGroup": "AL30",
  "SettlementType": "T_PLUS_0",
  "MinimumQty": 1,
  "ToleranceThresholdMs": 3000,
  "Assets": [
    { "Exchange": "XMEV", "Symbol": "AL30D", "SecurityID": "AL30D-0001-C-CT-USD", "SecurityType": "BOND", "Currency": "USD", "Underlying": "AL30", "SettlementType": "T_PLUS_0" },
    { "Exchange": "XMEV", "Symbol": "AL30C", "SecurityID": "AL30C-0001-C-CT-EXT", "SecurityType": "BOND", "Currency": "EXT", "Underlying": "AL30", "SettlementType": "T_PLUS_0" },
    { "Exchange": "XMEV", "Symbol": "AL30",  "SecurityID": "AL30-0001-C-CT-ARS",  "SecurityType": "BOND", "Currency": "ARS", "Underlying": "AL30", "SettlementType": "T_PLUS_0" }
  ]
}
```
SecurityID: `{Symbol}-0001-C-CT-{Currency}` (T+0) / `0002` (T+1). `Underlying` = `TradingGroup`. Exchange is always `XMEV`. All 4 routing fields (Primary/Liquidity × MarketDataSourceId/OrderRoutingId) are independently configurable.

**TITA entry** (root key `TITA`, one entry per symbol/Underlying):
```json
{
  "TradingGroup": "BONOS",
  "SecurityExchange": "XMEV",
  "OrderRoutingId": "XMEV",
  "Underlying": "AL30",
  "Currency": "ARS",
  "MinimumQty": 1,
  "LotSize": 100,
  "PxDisplayFactor": 100,
  "ToleranceThresholdMs": 1000,
  "Asset":         { "Symbol": "AL30", "SecurityID": "AL30-0001-C-CT-ARS", "SettlementType": "T_PLUS_0", "SecurityType": "BOND" },
  "LiquidityAsset":{ "Symbol": "AL30", "SecurityID": "AL30-0002-C-CT-ARS", "SettlementType": "T_PLUS_1", "SecurityType": "BOND" }
}
```
REPO entries: no `LiquidityAsset`, `SecurityType: "REPO"`, SecurityID uses `{Symbol}-#-U-CT-ARS`.
TITA Bonds TradingGroups: `BONOS`, `LETRAS`, `ONs`, `REPO`. SecurityTypes: `BOND`, `NEGOTIABLE_BOND`, `LETRAS_DEL_TESORO`.
TITA Stocks TradingGroups: `CEDEAR`, `ADR`, `BR`, `SEC`, `REPO`. SecurityTypes: `CERTIFICATE_OF_DEPOSIT`, `STOCK`.

**CANJE entry** (root key `CANJE`, one entry per TradingGroup):
```json
{
  "TradingGroup": "AL30",
  "MarketDataSourceId": "XMEV_1",
  "OrderRoutingId": "XMEV_1",
  "MinimumQty": 1,
  "ToleranceThresholdMs": 3000,
  "Assets": [
    { "Symbol": "AL30D", "SecurityID": "AL30D-0001-C-CT-USD", "Currency": "USD", "SettlementType": "T_PLUS_0" },
    { "Symbol": "AL30D", "SecurityID": "AL30D-0002-C-CT-USD", "Currency": "USD", "SettlementType": "T_PLUS_1" },
    { "Symbol": "AL30C", "SecurityID": "AL30C-0001-C-CT-EXT", "Currency": "EXT", "SettlementType": "T_PLUS_0" },
    { "Symbol": "AL30C", "SecurityID": "AL30C-0002-C-CT-EXT", "Currency": "EXT", "SettlementType": "T_PLUS_1" }
  ],
  "LiquidityAsset": { "Symbol": "AL30D", "SecurityID": "AL30D-0002-C-CT-USD", "Currency": "USD", "SettlementType": "T_PLUS_1" }
}
```
Routing IDs (both `MarketDataSourceId` and `OrderRoutingId`) are derived dynamically from the loaded file.
