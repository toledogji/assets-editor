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
```

No build step — the frontend is plain HTML/CSS/JS served as static files.

## Architecture

Single-file Express server (`server.js`) + vanilla JS frontend (`public/`). No framework, no bundler.

**Data flow:**
- The server reads/writes a single JSON file on disk: `../algo-trading-config-prod/dbb/config/assets.json` (relative to the repo root)
- The frontend fetches `GET /api/assets` on load and `POST /api/assets` on every mutation (delete, edit, add)
- All state lives in the `dxbData` array in `app.js`; every save replaces the full array on the server

**Frontend structure (`public/app.js`):**
- `dxbData` — in-memory copy of the `DxB` array
- `loadAssets()` — fetches from server, then calls all three render functions
- `saveAssets(newDxB, isAdd)` — POSTs and re-renders everything on success
- `renderChecklist()` — Delete Entries tab; groups by TradingGroup, manages checkbox selection state via `selectedIndices` Set
- `renderEditList()` — Edit Entries tab; inline expand/collapse forms per entry
- `renderRoutingBalance()` — Add Trading Group tab; counts unique TradingGroups per OrderRoutingId (XMEV_1–4)

**JSON schema for each DxB entry:**
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

**SecurityID convention:** `{Symbol}-{seq}-C-CT-{Currency}` where `seq` is `0001` for T_PLUS_0 and `0002` for T_PLUS_1. This is auto-generated in both the Add and Edit flows.

Each TradingGroup always has exactly two entries — one per SettlementType.
