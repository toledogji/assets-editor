// ── State ──────────────────────────────────────────────────────────────────
let entryData = [];
let selectedIndices = new Set();
let currentEditor = 'dxb';
let searchQuery = '';

const EDITOR_CONFIG = {
  dxb:   { label: 'DxB',        type: 'dxb',   toleranceMs: 3000, routingIds: ['XMEV_1','XMEV_2','XMEV_3','XMEV_4'], rootKey: 'DxB'   },
  dxc:   { label: 'DxC',        type: 'dxb',   toleranceMs: 5000, routingIds: ['XMEV_1','XMEV_2','XMEV_3'],           rootKey: 'DxB'   },
  tita:  { label: 'TITA Bonds',  type: 'tita', toleranceMs: 1000, rootKey: 'TITA',
    routingIds: ['XMEV', 'XMEV_2'],
    tradingGroups: ['BONOS', 'LETRAS', 'ONs', 'REPO'],
    securityTypes: ['BOND', 'NEGOTIABLE_BOND', 'LETRAS_DEL_TESORO'],
  },
  'tita-stocks': { label: 'TITA Stocks', type: 'tita', toleranceMs: 5000, rootKey: 'TITA',
    routingIds: ['XMEV', 'XMEV_2'],
    tradingGroups: ['CEDEAR', 'ADR', 'BR', 'SEC', 'REPO'],
    securityTypes: ['CERTIFICATE_OF_DEPOSIT', 'STOCK'],
  },
  canje: { label: 'Canje',      type: 'canje', toleranceMs: 3000, mdsIds: [], routingIds: [], rootKey: 'CANJE' },
};

// ── Helpers ────────────────────────────────────────────────────────────────
function searchPlaceholder() {
  return EDITOR_CONFIG[currentEditor].type === 'tita' ? 'Search by Underlying…' : 'Search by Trading Group…';
}

function matchesSearch(value) {
  if (!searchQuery) return true;
  return value.toLowerCase().includes(searchQuery.toLowerCase());
}

function getVisibleIndices() {
  const { type } = EDITOR_CONFIG[currentEditor];
  return entryData.reduce((acc, entry, i) => {
    const key = type === 'tita' ? entry.Underlying : entry.TradingGroup;
    if (matchesSearch(key)) acc.push(i);
    return acc;
  }, []);
}

function settlementBadge(s) {
  const cls = s === 'T_PLUS_0' ? 't0' : 't1';
  const label = s === 'T_PLUS_0' ? 'T+0' : 'T+1';
  return `<span class="entry-settlement ${cls}">${label}</span>`;
}

function assetChips(assets) {
  return assets.map(a =>
    `<span class="asset-chip">${a.Symbol}<span class="currency">${a.Currency}</span></span>`
  ).join('');
}

function groupByTradingGroup(arr) {
  const map = new Map();
  arr.forEach((entry, idx) => {
    const tg = entry.TradingGroup;
    if (!map.has(tg)) map.set(tg, []);
    map.get(tg).push({ entry, idx });
  });
  return new Map([...map.entries()].sort((a, b) => a[0].localeCompare(b[0])));
}

function tgBadge(tg) {
  const cls = tg === 'BONOS'  ? 'tg-bonos'
    : tg === 'LETRAS'  ? 'tg-letras'
    : tg === 'ONs'     ? 'tg-ons'
    : tg === 'REPO'    ? 'tg-repo'
    : tg === 'CEDEAR'  ? 'tg-cedear'
    : tg === 'ADR'     ? 'tg-adr'
    : tg === 'BR'      ? 'tg-br'
    : tg === 'SEC'     ? 'tg-sec'
    : 'tg-bonos';
  return `<span class="tg-badge ${cls}">${tg}</span>`;
}

// ── Load data ──────────────────────────────────────────────────────────────
async function loadAssets() {
  const res = await fetch(`/api/assets/${currentEditor}`);
  if (!res.ok) throw new Error(await res.text());
  const data = await res.json();
  const rootKey = EDITOR_CONFIG[currentEditor].rootKey;
  entryData = data[rootKey];
  selectedIndices.clear();
  renderAll();
}

function renderAll() {
  const { type } = EDITOR_CONFIG[currentEditor];
  if (type === 'tita') {
    renderTitaChecklist();
    renderTitaEditList();
    renderRoutingBalance();
  } else if (type === 'canje') {
    deriveCanjeDynamicOptions();
    populateCanjeDropdowns();
    renderCanjeChecklist();
    renderCanjeEditList();
    renderRoutingBalance();
  } else {
    renderChecklist();
    renderEditList();
    renderRoutingBalance();
  }
}

// ── Checklist render (DxB/DxC) ─────────────────────────────────────────────
function renderChecklist() {
  const container = document.getElementById('checklist-container');
  const grouped = groupByTradingGroup(entryData);

  if (grouped.size === 0) {
    container.innerHTML = '<p class="loading">No entries found.</p>';
    return;
  }

  let html = '';
  for (const [tg, items] of grouped) {
    if (!matchesSearch(tg)) continue;
    const allIdxs = items.map(i => i.idx);
    const allChecked = allIdxs.every(i => selectedIndices.has(i));
    const someChecked = allIdxs.some(i => selectedIndices.has(i));
    const indeterminate = someChecked && !allChecked;

    html += `
      <div class="group-block">
        <div class="group-header" data-tg="${tg}">
          <div class="group-check-wrap">
            <input type="checkbox" class="group-checkbox" data-tg="${tg}"
              ${allChecked ? 'checked' : ''} data-indeterminate="${indeterminate}" />
          </div>
          <span class="group-title">${tg}</span>
          <span class="group-badge">${items.length} entr${items.length === 1 ? 'y' : 'ies'}</span>
        </div>
        <div class="group-entries">
    `;

    for (const { entry, idx } of items) {
      html += `
        <div class="entry-row">
          <input type="checkbox" class="entry-checkbox" data-idx="${idx}" ${selectedIndices.has(idx) ? 'checked' : ''} />
          <div class="entry-info">
            ${settlementBadge(entry.SettlementType)}
            <div class="entry-meta">
              <strong>Primary:</strong> ${entry.PrimaryOrderRoutingId} &nbsp;|&nbsp;
              <strong>Liquidity:</strong> ${entry.LiquidityOrderRoutingId} &nbsp;|&nbsp;
              <strong>MinQty:</strong> ${entry.MinimumQty} &nbsp;|&nbsp;
              <strong>ToleranceMs:</strong> ${entry.ToleranceThresholdMs}
            </div>
            <div class="entry-assets">${assetChips(entry.Assets)}</div>
          </div>
        </div>
      `;
    }

    html += `</div></div>`;
  }

  container.innerHTML = html || '<p class="loading">No entries match your search.</p>';

  container.querySelectorAll('.group-checkbox').forEach(cb => {
    if (cb.dataset.indeterminate === 'true') cb.indeterminate = true;
  });

  container.querySelectorAll('.entry-checkbox').forEach(cb => {
    cb.addEventListener('change', () => {
      const idx = parseInt(cb.dataset.idx, 10);
      cb.checked ? selectedIndices.add(idx) : selectedIndices.delete(idx);
      updateToolbar();
      rerenderGroupHeader(cb.closest('.group-block'));
    });
  });

  container.querySelectorAll('.group-checkbox').forEach(cb => {
    cb.addEventListener('change', e => {
      e.stopPropagation();
      const tg = cb.dataset.tg;
      (groupByTradingGroup(entryData).get(tg) || []).forEach(({ idx }) => {
        cb.checked ? selectedIndices.add(idx) : selectedIndices.delete(idx);
      });
      updateToolbar();
      renderChecklist();
    });
  });

  container.querySelectorAll('.group-header').forEach(header => {
    header.addEventListener('click', e => {
      if (e.target.type === 'checkbox') return;
      const cb = header.querySelector('.group-checkbox');
      cb.checked = !cb.checked;
      cb.dispatchEvent(new Event('change'));
    });
  });

  updateToolbar();
}

function rerenderGroupHeader(groupBlock) {
  const tg = groupBlock.querySelector('.group-checkbox').dataset.tg;
  const items = groupByTradingGroup(entryData).get(tg) || [];
  const allIdxs = items.map(i => i.idx);
  const allChecked = allIdxs.every(i => selectedIndices.has(i));
  const someChecked = allIdxs.some(i => selectedIndices.has(i));
  const cb = groupBlock.querySelector('.group-checkbox');
  cb.checked = allChecked;
  cb.indeterminate = someChecked && !allChecked;
}

function updateToolbar() {
  const n = selectedIndices.size;
  document.getElementById('selected-count').textContent =
    n === 0 ? 'No entries selected' : `${n} entr${n === 1 ? 'y' : 'ies'} selected`;
  document.getElementById('delete-btn').disabled = n === 0;
}

// ── TITA Checklist render ──────────────────────────────────────────────────
function renderTitaChecklist() {
  const container = document.getElementById('checklist-container');
  const grouped = groupByTradingGroup(entryData);

  if (grouped.size === 0) {
    container.innerHTML = '<p class="loading">No entries found.</p>';
    return;
  }

  let html = '';
  for (const [tg, items] of grouped) {
    const visItems = items.filter(({ entry }) => matchesSearch(entry.Underlying));
    if (visItems.length === 0) continue;
    const allIdxs = visItems.map(i => i.idx);
    const allChecked = allIdxs.every(i => selectedIndices.has(i));
    const someChecked = allIdxs.some(i => selectedIndices.has(i));
    const indeterminate = someChecked && !allChecked;

    html += `
      <div class="group-block">
        <div class="group-header" data-tg="${tg}">
          <div class="group-check-wrap">
            <input type="checkbox" class="group-checkbox" data-tg="${tg}"
              ${allChecked ? 'checked' : ''} data-indeterminate="${indeterminate}" />
          </div>
          <span class="group-title">${tg}</span>
          <span class="group-badge">${visItems.length} entr${visItems.length === 1 ? 'y' : 'ies'}</span>
        </div>
        <div class="group-entries">
    `;

    for (const { entry, idx } of visItems) {
      const assetChip = entry.Asset
        ? `<span class="asset-chip">${entry.Asset.Symbol} <span class="currency">${entry.Asset.SettlementType === 'T_PLUS_0' ? 'T+0' : 'T+1'}</span></span>`
        : '';
      const liquidityChip = entry.LiquidityAsset
        ? `<span class="asset-chip">${entry.LiquidityAsset.Symbol} <span class="currency">T+1 liq</span></span>`
        : '';

      html += `
        <div class="entry-row">
          <input type="checkbox" class="entry-checkbox" data-idx="${idx}" ${selectedIndices.has(idx) ? 'checked' : ''} />
          <div class="entry-info">
            ${tgBadge(entry.TradingGroup)}
            <div class="entry-meta">
              <strong>Underlying:</strong> ${entry.Underlying} &nbsp;|&nbsp;
              <strong>Routing:</strong> ${entry.OrderRoutingId} &nbsp;|&nbsp;
              <strong>SecurityType:</strong> ${entry.Asset ? entry.Asset.SecurityType : 'REPO'} &nbsp;|&nbsp;
              <strong>MinQty:</strong> ${entry.MinimumQty} &nbsp;|&nbsp;
              <strong>LotSize:</strong> ${entry.LotSize} &nbsp;|&nbsp;
              <strong>PxFactor:</strong> ${entry.PxDisplayFactor}
            </div>
            <div class="entry-assets">${assetChip}${liquidityChip}</div>
          </div>
        </div>
      `;
    }

    html += `</div></div>`;
  }

  container.innerHTML = html || '<p class="loading">No entries match your search.</p>';

  container.querySelectorAll('.group-checkbox').forEach(cb => {
    if (cb.dataset.indeterminate === 'true') cb.indeterminate = true;
  });

  container.querySelectorAll('.entry-checkbox').forEach(cb => {
    cb.addEventListener('change', () => {
      const idx = parseInt(cb.dataset.idx, 10);
      cb.checked ? selectedIndices.add(idx) : selectedIndices.delete(idx);
      updateToolbar();
      rerenderGroupHeader(cb.closest('.group-block'));
    });
  });

  container.querySelectorAll('.group-checkbox').forEach(cb => {
    cb.addEventListener('change', e => {
      e.stopPropagation();
      const tg = cb.dataset.tg;
      const allItems = groupByTradingGroup(entryData).get(tg) || [];
      const visItems = allItems.filter(({ entry }) => matchesSearch(entry.Underlying));
      visItems.forEach(({ idx }) => {
        cb.checked ? selectedIndices.add(idx) : selectedIndices.delete(idx);
      });
      updateToolbar();
      renderTitaChecklist();
    });
  });

  container.querySelectorAll('.group-header').forEach(header => {
    header.addEventListener('click', e => {
      if (e.target.type === 'checkbox') return;
      const cb = header.querySelector('.group-checkbox');
      cb.checked = !cb.checked;
      cb.dispatchEvent(new Event('change'));
    });
  });

  updateToolbar();
}

// ── Select / Deselect all ──────────────────────────────────────────────────
document.getElementById('select-all-btn').addEventListener('click', () => {
  getVisibleIndices().forEach(i => selectedIndices.add(i));
  const { type } = EDITOR_CONFIG[currentEditor];
  if (type === 'tita') renderTitaChecklist();
  else if (type === 'canje') renderCanjeChecklist();
  else renderChecklist();
});

document.getElementById('deselect-all-btn').addEventListener('click', () => {
  getVisibleIndices().forEach(i => selectedIndices.delete(i));
  const { type } = EDITOR_CONFIG[currentEditor];
  if (type === 'tita') renderTitaChecklist();
  else if (type === 'canje') renderCanjeChecklist();
  else renderChecklist();
});

// ── Delete flow ────────────────────────────────────────────────────────────
document.getElementById('delete-btn').addEventListener('click', () => {
  const n = selectedIndices.size;
  const groups = [...new Set([...selectedIndices].map(i => entryData[i].TradingGroup))].sort();
  document.getElementById('modal-msg').innerHTML =
    `You are about to delete <strong>${n}</strong> entr${n === 1 ? 'y' : 'ies'} ` +
    `from Trading Group${groups.length > 1 ? 's' : ''}: <strong>${groups.join(', ')}</strong>.<br/><br/>` +
    `This will overwrite <code>assets.json</code>. Are you sure?`;
  document.getElementById('modal-overlay').classList.remove('hidden');
});

document.getElementById('modal-cancel').addEventListener('click', () => {
  document.getElementById('modal-overlay').classList.add('hidden');
});

document.getElementById('modal-confirm').addEventListener('click', async () => {
  document.getElementById('modal-overlay').classList.add('hidden');
  await saveAssets(entryData.filter((_, i) => !selectedIndices.has(i)));
});

// ── Edit page (DxB/DxC) ────────────────────────────────────────────────────
const routingIds = () => EDITOR_CONFIG[currentEditor].routingIds;
const SEQ = { T_PLUS_0: '0001', T_PLUS_1: '0002' };

function getSymbolByCurrency(assets, currency) {
  return (assets.find(a => a.Currency === currency) || {}).Symbol || '';
}

function routingOptions(selected) {
  return routingIds().map(id =>
    `<option value="${id}" ${id === selected ? 'selected' : ''}>${id}</option>`
  ).join('');
}

function renderEditList() {
  const container = document.getElementById('edit-list-container');
  const grouped = groupByTradingGroup(entryData);

  if (grouped.size === 0) {
    container.innerHTML = '<p class="loading">No entries found.</p>';
    return;
  }

  const firstTolerance = entryData.length > 0 ? entryData[0].ToleranceThresholdMs : 3000;
  container.innerHTML = `
    <div class="bulk-tolerance-bar">
      <label for="bulk-tolerance">ToleranceThresholdMs — apply to all entries:</label>
      <div class="bulk-tolerance-controls">
        <input type="number" id="bulk-tolerance" value="${firstTolerance}" min="0" />
        <button id="bulk-tolerance-btn" class="btn btn-secondary">Apply to All</button>
      </div>
    </div>
  `;

  let html = '';
  for (const [tg, items] of grouped) {
    if (!matchesSearch(tg)) continue;
    html += `
      <div class="group-block">
        <div class="group-header" style="cursor:default">
          <span class="group-title">${tg}</span>
          <span class="group-badge">${items.length} entr${items.length === 1 ? 'y' : 'ies'}</span>
        </div>
        <div class="group-entries">
    `;

    for (const { entry, idx } of items) {
      const usdSym = getSymbolByCurrency(entry.Assets, 'USD');
      const extSym = getSymbolByCurrency(entry.Assets, 'EXT');
      const arsSym = getSymbolByCurrency(entry.Assets, 'ARS');

      html += `
        <div class="entry-row-wrap" data-idx="${idx}">
          <div class="entry-row">
            <div class="entry-info">
              ${settlementBadge(entry.SettlementType)}
              <div class="entry-meta">
                <strong>Primary:</strong> ${entry.PrimaryOrderRoutingId} &nbsp;|&nbsp;
                <strong>Liquidity:</strong> ${entry.LiquidityOrderRoutingId} &nbsp;|&nbsp;
                <strong>MinQty:</strong> ${entry.MinimumQty}
              </div>
              <div class="entry-assets">${assetChips(entry.Assets)}</div>
            </div>
            <div class="entry-actions">
              <button class="btn-edit" data-idx="${idx}">Edit</button>
            </div>
          </div>
          <div class="edit-form-panel hidden" id="edit-panel-${idx}">
            <div class="form-grid">
              <div class="form-group">
                <label>Trading Group</label>
                <input type="text" class="ef-tg" value="${entry.TradingGroup}" />
              </div>
              <div class="form-group">
                <label>Minimum Qty</label>
                <input type="number" class="ef-qty" value="${entry.MinimumQty}" min="1" />
              </div>
            </div>
            <div class="section-label">Primary</div>
            <div class="form-grid">
              <div class="form-group">
                <label>PrimaryMarketDataSourceId</label>
                <select class="ef-primary-mds">${routingOptions(entry.PrimaryMarketDataSourceId)}</select>
              </div>
              <div class="form-group">
                <label>PrimaryOrderRoutingId</label>
                <select class="ef-primary-rid">${routingOptions(entry.PrimaryOrderRoutingId)}</select>
              </div>
            </div>
            <div class="section-label">Liquidity</div>
            <div class="form-grid">
              <div class="form-group">
                <label>LiquidityMarketDataSourceId</label>
                <select class="ef-liquidity-mds">${routingOptions(entry.LiquidityMarketDataSourceId)}</select>
              </div>
              <div class="form-group">
                <label>LiquidityOrderRoutingId</label>
                <select class="ef-liquidity-rid">${routingOptions(entry.LiquidityOrderRoutingId)}</select>
              </div>
            </div>
            <div class="section-label">Asset Symbols</div>
            <div class="form-grid">
              <div class="form-group">
                <label>USD Symbol</label>
                <input type="text" class="ef-usd" value="${usdSym}" />
              </div>
              <div class="form-group">
                <label>EXT Symbol</label>
                <input type="text" class="ef-ext" value="${extSym}" />
              </div>
              <div class="form-group">
                <label>ARS Symbol</label>
                <input type="text" class="ef-ars" value="${arsSym}" />
              </div>
              <div class="form-group">
                <label>ToleranceThresholdMs</label>
                <input type="number" class="ef-tolerance" value="${entry.ToleranceThresholdMs}" min="0" />
              </div>
            </div>
            <div class="edit-actions">
              <button class="btn btn-primary ef-save" data-idx="${idx}">Save</button>
              <button class="btn btn-secondary ef-cancel" data-idx="${idx}">Cancel</button>
              <span class="edit-saved-msg" id="edit-saved-${idx}">Saved!</span>
            </div>
          </div>
        </div>
      `;
    }

    html += `</div></div>`;
  }

  container.innerHTML += html;

  // Bulk apply ToleranceThresholdMs
  document.getElementById('bulk-tolerance-btn').addEventListener('click', async () => {
    const val = parseInt(document.getElementById('bulk-tolerance').value, 10);
    if (isNaN(val)) { alert('Enter a valid number.'); return; }
    await saveAssets(entryData.map(e => ({ ...e, ToleranceThresholdMs: val })));
  });

  container.querySelectorAll('.btn-edit').forEach(btn => {
    btn.addEventListener('click', () => {
      const idx = btn.dataset.idx;
      const panel = document.getElementById(`edit-panel-${idx}`);
      const isOpen = !panel.classList.contains('hidden');
      container.querySelectorAll('.edit-form-panel').forEach(p => p.classList.add('hidden'));
      container.querySelectorAll('.btn-edit').forEach(b => { b.classList.remove('active'); b.textContent = 'Edit'; });
      if (!isOpen) {
        panel.classList.remove('hidden');
        btn.classList.add('active');
        btn.textContent = 'Close';
      }
    });
  });

  container.querySelectorAll('.ef-save').forEach(btn => {
    btn.addEventListener('click', async () => {
      const idx = parseInt(btn.dataset.idx, 10);
      const panel = document.getElementById(`edit-panel-${idx}`);

      const newTg              = panel.querySelector('.ef-tg').value.trim().toUpperCase();
      const newPrimaryMds      = panel.querySelector('.ef-primary-mds').value;
      const newPrimaryRid      = panel.querySelector('.ef-primary-rid').value;
      const newLiquidityMds    = panel.querySelector('.ef-liquidity-mds').value;
      const newLiquidityRid    = panel.querySelector('.ef-liquidity-rid').value;
      const newQty             = parseInt(panel.querySelector('.ef-qty').value, 10);
      const newUsd             = panel.querySelector('.ef-usd').value.trim().toUpperCase();
      const newExt             = panel.querySelector('.ef-ext').value.trim().toUpperCase();
      const newArs             = panel.querySelector('.ef-ars').value.trim().toUpperCase();
      const newTolerance       = parseInt(panel.querySelector('.ef-tolerance').value, 10);

      if (!newTg || !newUsd || !newExt || !newArs || isNaN(newQty) || isNaN(newTolerance)) {
        alert('All fields are required.');
        return;
      }

      const entry = entryData[idx];
      const seq = SEQ[entry.SettlementType];
      const updated = {
        ...entry,
        PrimaryExchange: 'XMEV',
        PrimaryMarketDataSourceId: newPrimaryMds,
        PrimaryOrderRoutingId: newPrimaryRid,
        LiquidityExchange: 'XMEV',
        LiquidityMarketDataSourceId: newLiquidityMds,
        LiquidityOrderRoutingId: newLiquidityRid,
        TradingGroup: newTg,
        MinimumQty: newQty,
        ToleranceThresholdMs: newTolerance,
        Assets: [
          { Exchange: 'XMEV', Symbol: newUsd, SecurityID: `${newUsd}-${seq}-C-CT-USD`, SecurityType: entry.Assets[0]?.SecurityType || 'BOND', Currency: 'USD', Underlying: newTg, SettlementType: entry.SettlementType },
          { Exchange: 'XMEV', Symbol: newExt, SecurityID: `${newExt}-${seq}-C-CT-EXT`, SecurityType: entry.Assets[1]?.SecurityType || 'BOND', Currency: 'EXT', Underlying: newTg, SettlementType: entry.SettlementType },
          { Exchange: 'XMEV', Symbol: newArs, SecurityID: `${newArs}-${seq}-C-CT-ARS`, SecurityType: entry.Assets[2]?.SecurityType || 'BOND', Currency: 'ARS', Underlying: newTg, SettlementType: entry.SettlementType },
        ],
      };

      const newData = [...entryData];
      newData[idx] = updated;
      await saveAssets(newData);

      const msg = document.getElementById(`edit-saved-${idx}`);
      if (msg) { msg.classList.add('visible'); setTimeout(() => msg.classList.remove('visible'), 2000); }
    });
  });

  container.querySelectorAll('.ef-cancel').forEach(btn => {
    btn.addEventListener('click', () => {
      const idx = btn.dataset.idx;
      document.getElementById(`edit-panel-${idx}`).classList.add('hidden');
      const editBtn = container.querySelector(`.btn-edit[data-idx="${idx}"]`);
      if (editBtn) { editBtn.classList.remove('active'); editBtn.textContent = 'Edit'; }
    });
  });
}

// ── TITA Edit list ─────────────────────────────────────────────────────────
function renderTitaEditList() {
  const container = document.getElementById('edit-list-container');
  const grouped = groupByTradingGroup(entryData);

  if (grouped.size === 0) {
    container.innerHTML = '<p class="loading">No entries found.</p>';
    return;
  }

  const { securityTypes, tradingGroups } = EDITOR_CONFIG[currentEditor];

  const secTypeOptions = (selected) =>
    securityTypes.map(st =>
      `<option value="${st}" ${st === selected ? 'selected' : ''}>${st}</option>`
    ).join('');

  const tgOptions = (selected) =>
    tradingGroups.map(tg =>
      `<option value="${tg}" ${tg === selected ? 'selected' : ''}>${tg}</option>`
    ).join('');

  // Bulk tolerance bar
  const firstTolerance = entryData.length > 0 ? entryData[0].ToleranceThresholdMs : 1000;
  container.innerHTML = `
    <div class="bulk-tolerance-bar">
      <label for="bulk-tolerance">ToleranceThresholdMs — apply to all entries:</label>
      <div class="bulk-tolerance-controls">
        <input type="number" id="bulk-tolerance" value="${firstTolerance}" min="0" />
        <button id="bulk-tolerance-btn" class="btn btn-secondary">Apply to All</button>
      </div>
    </div>
  `;

  let html = '';
  for (const [tg, items] of grouped) {
    const visItems = items.filter(({ entry }) => matchesSearch(entry.Underlying));
    if (visItems.length === 0) continue;
    html += `
      <div class="group-block">
        <div class="group-header" style="cursor:default">
          <span class="group-title">${tg}</span>
          <span class="group-badge">${visItems.length} entr${visItems.length === 1 ? 'y' : 'ies'}</span>
        </div>
        <div class="group-entries">
    `;

    for (const { entry, idx } of visItems) {
      const isRepo = entry.TradingGroup === 'REPO';
      const currentSecType = isRepo ? 'REPO' : (entry.Asset ? entry.Asset.SecurityType : 'BOND');
      const assetChip = entry.Asset
        ? `<span class="asset-chip">${entry.Asset.Symbol} <span class="currency">${entry.Asset.SettlementType === 'T_PLUS_0' ? 'T+0' : 'T+1'}</span></span>`
        : '';
      const liquidityChip = entry.LiquidityAsset
        ? `<span class="asset-chip">${entry.LiquidityAsset.Symbol} <span class="currency">T+1 liq</span></span>`
        : '';

      html += `
        <div class="entry-row-wrap" data-idx="${idx}">
          <div class="entry-row">
            <div class="entry-info">
              ${tgBadge(entry.TradingGroup)}
              <div class="entry-meta">
                <strong>Underlying:</strong> ${entry.Underlying} &nbsp;|&nbsp;
                <strong>SecurityType:</strong> ${currentSecType} &nbsp;|&nbsp;
                <strong>MinQty:</strong> ${entry.MinimumQty} &nbsp;|&nbsp;
                <strong>LotSize:</strong> ${entry.LotSize} &nbsp;|&nbsp;
                <strong>PxFactor:</strong> ${entry.PxDisplayFactor}
              </div>
              <div class="entry-assets">${assetChip}${liquidityChip}</div>
            </div>
            <div class="entry-actions">
              <button class="btn-edit" data-idx="${idx}">Edit</button>
            </div>
          </div>
          <div class="edit-form-panel hidden" id="edit-panel-${idx}">
            <div class="form-grid">
              <div class="form-group">
                <label>Trading Group</label>
                <select class="ef-tita-tg">${tgOptions(entry.TradingGroup)}</select>
              </div>
              <div class="form-group">
                <label>Symbol (Underlying)</label>
                <input type="text" class="ef-tita-sym" value="${entry.Underlying}" />
              </div>
              <div class="form-group">
                <label>Security Type</label>
                <select class="ef-tita-sectype" ${isRepo ? 'disabled' : ''}>
                  ${isRepo
                    ? '<option value="REPO" selected>REPO</option>'
                    : secTypeOptions(currentSecType, false)
                  }
                </select>
              </div>
              <div class="form-group">
                <label>Order Routing ID</label>
                <select class="ef-tita-rid">
                  <option value="XMEV" ${entry.OrderRoutingId === 'XMEV' ? 'selected' : ''}>XMEV</option>
                  <option value="XMEV_2" ${entry.OrderRoutingId === 'XMEV_2' ? 'selected' : ''}>XMEV_2</option>
                </select>
              </div>
            </div>
            <div class="form-grid">
              <div class="form-group">
                <label>Minimum Qty</label>
                <input type="number" class="ef-tita-qty" value="${entry.MinimumQty}" min="1" />
              </div>
              <div class="form-group">
                <label>Lot Size</label>
                <input type="number" class="ef-tita-lot" value="${entry.LotSize}" min="1" />
              </div>
              <div class="form-group">
                <label>PxDisplayFactor</label>
                <input type="number" class="ef-tita-px" value="${entry.PxDisplayFactor}" min="1" />
              </div>
              <div class="form-group">
                <label>ToleranceThresholdMs</label>
                <input type="number" class="ef-tita-tolerance" value="${entry.ToleranceThresholdMs}" min="0" />
              </div>
            </div>
            <div class="edit-actions">
              <button class="btn btn-primary ef-tita-save" data-idx="${idx}">Save</button>
              <button class="btn btn-secondary ef-cancel" data-idx="${idx}">Cancel</button>
              <span class="edit-saved-msg" id="edit-saved-${idx}">Saved!</span>
            </div>
          </div>
        </div>
      `;
    }

    html += `</div></div>`;
  }

  container.innerHTML += html;

  // Bulk apply ToleranceThresholdMs
  document.getElementById('bulk-tolerance-btn').addEventListener('click', async () => {
    const val = parseInt(document.getElementById('bulk-tolerance').value, 10);
    if (isNaN(val)) { alert('Enter a valid number.'); return; }
    const newData = entryData.map(e => ({ ...e, ToleranceThresholdMs: val }));
    await saveAssets(newData);
  });

  // Toggle Trading Group → force REPO security type
  container.querySelectorAll('.ef-tita-tg').forEach(sel => {
    sel.addEventListener('change', () => {
      const panel = sel.closest('.edit-form-panel');
      const secSel = panel.querySelector('.ef-tita-sectype');
      if (sel.value === 'REPO') {
        secSel.innerHTML = '<option value="REPO" selected>REPO</option>';
        secSel.disabled = true;
      } else {
        secSel.innerHTML = EDITOR_CONFIG[currentEditor].securityTypes
          .map(st => `<option value="${st}">${st}</option>`).join('');
        secSel.disabled = false;
      }
    });
  });

  container.querySelectorAll('.btn-edit').forEach(btn => {
    btn.addEventListener('click', () => {
      const idx = btn.dataset.idx;
      const panel = document.getElementById(`edit-panel-${idx}`);
      const isOpen = !panel.classList.contains('hidden');
      container.querySelectorAll('.edit-form-panel').forEach(p => p.classList.add('hidden'));
      container.querySelectorAll('.btn-edit').forEach(b => { b.classList.remove('active'); b.textContent = 'Edit'; });
      if (!isOpen) {
        panel.classList.remove('hidden');
        btn.classList.add('active');
        btn.textContent = 'Close';
      }
    });
  });

  container.querySelectorAll('.ef-tita-save').forEach(btn => {
    btn.addEventListener('click', async () => {
      const idx = parseInt(btn.dataset.idx, 10);
      const panel = document.getElementById(`edit-panel-${idx}`);

      const newTg        = panel.querySelector('.ef-tita-tg').value;
      const newSym       = panel.querySelector('.ef-tita-sym').value.trim().toUpperCase();
      const newSecType   = panel.querySelector('.ef-tita-sectype').value;
      const newRid       = panel.querySelector('.ef-tita-rid').value;
      const newQty       = parseInt(panel.querySelector('.ef-tita-qty').value, 10);
      const newLot       = parseInt(panel.querySelector('.ef-tita-lot').value, 10);
      const newPx        = parseInt(panel.querySelector('.ef-tita-px').value, 10);
      const newTolerance = parseInt(panel.querySelector('.ef-tita-tolerance').value, 10);

      if (!newSym || isNaN(newQty) || isNaN(newLot) || isNaN(newPx) || isNaN(newTolerance)) {
        alert('All fields are required.');
        return;
      }

      const entry = entryData[idx];
      const updated = buildTitaEntry(newTg, newSym, newSecType, newQty, newLot, newPx, newRid);
      updated.ToleranceThresholdMs = newTolerance;

      const newData = [...entryData];
      newData[idx] = updated;
      await saveAssets(newData);

      const msg = document.getElementById(`edit-saved-${idx}`);
      if (msg) { msg.classList.add('visible'); setTimeout(() => msg.classList.remove('visible'), 2000); }
    });
  });

  container.querySelectorAll('.ef-cancel').forEach(btn => {
    btn.addEventListener('click', () => {
      const idx = btn.dataset.idx;
      document.getElementById(`edit-panel-${idx}`).classList.add('hidden');
      const editBtn = container.querySelector(`.btn-edit[data-idx="${idx}"]`);
      if (editBtn) { editBtn.classList.remove('active'); editBtn.textContent = 'Edit'; }
    });
  });
}

// ── Routing balance ────────────────────────────────────────────────────────
function renderRoutingBalance() {
  const { type } = EDITOR_CONFIG[currentEditor];
  const elId = type === 'tita' ? 'tita-routing-balance'
    : type === 'canje' ? 'canje-routing-balance'
    : 'routing-balance';
  const el = document.getElementById(elId);
  if (!el) return;

  const counts = {};
  routingIds().forEach(id => counts[id] = 0);

  if (type === 'tita' || type === 'canje') {
    // Count total entries per OrderRoutingId
    entryData.forEach(entry => {
      if (counts[entry.OrderRoutingId] !== undefined) counts[entry.OrderRoutingId]++;
    });

    const max = Math.max(...routingIds().map(id => counts[id]), 1);
    const minCount = Math.min(...routingIds().map(id => counts[id]));
    el.innerHTML = '<div class="routing-cards-row">' + routingIds().map(id => {
      const n = counts[id];
      const pct = Math.round((n / max) * 100);
      const isFewest = n === minCount;
      return `
        <div class="routing-card${isFewest ? ' fewest' : ''}">
          <div class="routing-card-header">
            <span class="routing-card-name">${id}</span>
            ${isFewest ? '<span class="fewest-badge">fewest</span>' : ''}
          </div>
          <div class="routing-card-count">${n}</div>
          <div class="routing-card-label">${n !== 1 ? 'entries' : 'entry'}</div>
          <div class="routing-bar-wrap"><div class="routing-bar" style="width:${pct}%"></div></div>
        </div>
      `;
    }).join('') + '</div>';
  } else {
    // Count unique TradingGroups per PrimaryOrderRoutingId and LiquidityOrderRoutingId
    const primaryCounts = {};
    const liquidityCounts = {};
    routingIds().forEach(id => { primaryCounts[id] = 0; liquidityCounts[id] = 0; });

    const seenPrimary = {};
    const seenLiquidity = {};
    entryData.forEach(entry => {
      const pk = entry.PrimaryOrderRoutingId + '|' + entry.TradingGroup;
      if (!seenPrimary[pk] && primaryCounts[entry.PrimaryOrderRoutingId] !== undefined) {
        seenPrimary[pk] = true;
        primaryCounts[entry.PrimaryOrderRoutingId]++;
      }
      const lk = entry.LiquidityOrderRoutingId + '|' + entry.TradingGroup;
      if (!seenLiquidity[lk] && liquidityCounts[entry.LiquidityOrderRoutingId] !== undefined) {
        seenLiquidity[lk] = true;
        liquidityCounts[entry.LiquidityOrderRoutingId]++;
      }
    });

    const makeCards = (countMap) => {
      const max = Math.max(...routingIds().map(id => countMap[id]), 1);
      const minCount = Math.min(...routingIds().map(id => countMap[id]));
      return routingIds().map(id => {
        const n = countMap[id];
        const pct = Math.round((n / max) * 100);
        const isFewest = n === minCount;
        return `
          <div class="routing-card${isFewest ? ' fewest' : ''}">
            <div class="routing-card-header">
              <span class="routing-card-name">${id}</span>
              ${isFewest ? '<span class="fewest-badge">fewest</span>' : ''}
            </div>
            <div class="routing-card-count">${n}</div>
            <div class="routing-card-label">${n !== 1 ? 'trading groups' : 'trading group'}</div>
            <div class="routing-bar-wrap"><div class="routing-bar" style="width:${pct}%"></div></div>
          </div>
        `;
      }).join('');
    };

    el.innerHTML = `
      <div class="routing-groups-row">
        <div class="routing-section-group">
          <div class="routing-section-label">Primary</div>
          <div class="routing-cards-row">${makeCards(primaryCounts)}</div>
        </div>
        <div class="routing-section-group">
          <div class="routing-section-label">Liquidity</div>
          <div class="routing-cards-row">${makeCards(liquidityCounts)}</div>
        </div>
      </div>
    `;
  }
}

// ── Add form (DxB/DxC) ─────────────────────────────────────────────────────
function buildNewEntries(tg, primaryMdsId, primaryRoutingId, liquidityMdsId, liquidityRoutingId, minQty, usdSym, extSym, arsSym) {
  const { toleranceMs } = EDITOR_CONFIG[currentEditor];
  const makeEntry = (settlement, seqCode) => ({
    PrimaryExchange: 'XMEV',
    PrimaryMarketDataSourceId: primaryMdsId,
    PrimaryOrderRoutingId: primaryRoutingId,
    LiquidityExchange: 'XMEV',
    LiquidityMarketDataSourceId: liquidityMdsId,
    LiquidityOrderRoutingId: liquidityRoutingId,
    TradingGroup: tg,
    SettlementType: settlement,
    MinimumQty: Number(minQty),
    ToleranceThresholdMs: toleranceMs,
    Assets: [
      { Exchange: 'XMEV', Symbol: usdSym, SecurityID: `${usdSym}-${seqCode}-C-CT-USD`, SecurityType: 'BOND', Currency: 'USD', Underlying: tg, SettlementType: settlement },
      { Exchange: 'XMEV', Symbol: extSym, SecurityID: `${extSym}-${seqCode}-C-CT-EXT`, SecurityType: 'BOND', Currency: 'EXT', Underlying: tg, SettlementType: settlement },
      { Exchange: 'XMEV', Symbol: arsSym, SecurityID: `${arsSym}-${seqCode}-C-CT-ARS`, SecurityType: 'BOND', Currency: 'ARS', Underlying: tg, SettlementType: settlement },
    ],
  });
  return [makeEntry('T_PLUS_0', '0001'), makeEntry('T_PLUS_1', '0002')];
}

function getFormValues() {
  return {
    tg: document.getElementById('trading-group').value.trim().toUpperCase(),
    primaryMdsId: document.getElementById('primary-mds-id').value,
    primaryRoutingId: document.getElementById('primary-routing-id').value,
    liquidityMdsId: document.getElementById('liquidity-mds-id').value,
    liquidityRoutingId: document.getElementById('liquidity-routing-id').value,
    minQty: document.getElementById('minimum-qty').value,
    usdSym: document.getElementById('symbol-usd').value.trim().toUpperCase(),
    extSym: document.getElementById('symbol-ext').value.trim().toUpperCase(),
    arsSym: document.getElementById('symbol-ars').value.trim().toUpperCase(),
  };
}

document.getElementById('preview-btn').addEventListener('click', () => {
  const { tg, primaryMdsId, primaryRoutingId, liquidityMdsId, liquidityRoutingId, minQty, usdSym, extSym, arsSym } = getFormValues();
  if (!tg || !usdSym || !extSym || !arsSym) { showResult('Please fill in all fields before previewing.', 'error'); return; }
  const [e0, e1] = buildNewEntries(tg, primaryMdsId, primaryRoutingId, liquidityMdsId, liquidityRoutingId, minQty, usdSym, extSym, arsSym);
  document.getElementById('preview-t0').textContent = JSON.stringify(e0, null, 2);
  document.getElementById('preview-t1').textContent = JSON.stringify(e1, null, 2);
  document.getElementById('preview-container').classList.remove('hidden');
  document.getElementById('add-result').classList.add('hidden');
});

document.getElementById('add-form').addEventListener('submit', async e => {
  e.preventDefault();
  const { tg, primaryMdsId, primaryRoutingId, liquidityMdsId, liquidityRoutingId, minQty, usdSym, extSym, arsSym } = getFormValues();
  if (entryData.some(d => d.TradingGroup === tg)) {
    showResult(`Trading Group "${tg}" already exists in assets.json.`, 'error');
    return;
  }
  const [e0, e1] = buildNewEntries(tg, primaryMdsId, primaryRoutingId, liquidityMdsId, liquidityRoutingId, minQty, usdSym, extSym, arsSym);
  await saveAssets([...entryData, e0, e1], true);
});

// ── Canje build entry ──────────────────────────────────────────────────────
function buildCanjeEntry(mdsId, routingId, tg, minQty, tolerance, usdSym, extSym) {
  return {
    MarketDataSourceId: mdsId,
    OrderRoutingId: routingId,
    TradingGroup: tg,
    MinimumQty: Number(minQty),
    ToleranceThresholdMs: Number(tolerance),
    LiquidityAsset: {
      NormalTradingHours: `${usdSym}-0002-C-CT-USD`,
      T1TradingHours: `${usdSym}-0002-C-CT-USD`,
    },
    Assets: [
      { Symbol: usdSym, SecurityID: `${usdSym}-0001-C-CT-USD`, Currency: 'USD', SettlementType: 'T_PLUS_0', SecurityType: 'BOND' },
      { Symbol: usdSym, SecurityID: `${usdSym}-0002-C-CT-USD`, Currency: 'USD', SettlementType: 'T_PLUS_1', SecurityType: 'BOND' },
      { Symbol: extSym, SecurityID: `${extSym}-0001-C-CT-EXT`, Currency: 'EXT', SettlementType: 'T_PLUS_0', SecurityType: 'BOND' },
      { Symbol: extSym, SecurityID: `${extSym}-0002-C-CT-EXT`, Currency: 'EXT', SettlementType: 'T_PLUS_1', SecurityType: 'BOND' },
    ],
  };
}

// ── Canje Checklist render ─────────────────────────────────────────────────
function renderCanjeChecklist() {
  const container = document.getElementById('checklist-container');
  if (entryData.length === 0) {
    container.innerHTML = '<p class="loading">No entries found.</p>';
    return;
  }

  // Group by OrderRoutingId
  const grouped = new Map();
  entryData.forEach((entry, idx) => {
    const key = entry.OrderRoutingId;
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key).push({ entry, idx });
  });
  const sortedKeys = [...grouped.keys()].sort();

  let html = '';
  for (const key of sortedKeys) {
    const allItems = grouped.get(key);
    const items = allItems.filter(({ entry }) => matchesSearch(entry.TradingGroup));
    if (items.length === 0) continue;
    const allIdxs = items.map(i => i.idx);
    const allChecked = allIdxs.every(i => selectedIndices.has(i));
    const someChecked = allIdxs.some(i => selectedIndices.has(i));
    const indeterminate = someChecked && !allChecked;

    html += `
      <div class="group-block">
        <div class="group-header" data-key="${key}">
          <div class="group-check-wrap">
            <input type="checkbox" class="group-checkbox" data-key="${key}"
              ${allChecked ? 'checked' : ''} data-indeterminate="${indeterminate}" />
          </div>
          <span class="group-title">${key}</span>
          <span class="group-badge">${items.length} entr${items.length === 1 ? 'y' : 'ies'}</span>
        </div>
        <div class="group-entries">
    `;

    for (const { entry, idx } of items) {
      const usdSym = entry.Assets.find(a => a.Currency === 'USD')?.Symbol || '';
      const extSym = entry.Assets.find(a => a.Currency === 'EXT')?.Symbol || '';
      html += `
        <div class="entry-row">
          <input type="checkbox" class="entry-checkbox" data-idx="${idx}" ${selectedIndices.has(idx) ? 'checked' : ''} />
          <div class="entry-info">
            <div class="entry-meta">
              <strong>${entry.TradingGroup}</strong> &nbsp;|&nbsp;
              <strong>MDS:</strong> ${entry.MarketDataSourceId} &nbsp;|&nbsp;
              <strong>MinQty:</strong> ${entry.MinimumQty} &nbsp;|&nbsp;
              <strong>ToleranceMs:</strong> ${entry.ToleranceThresholdMs}
            </div>
            <div class="entry-assets">
              <span class="asset-chip">${usdSym}<span class="currency">USD</span></span>
              <span class="asset-chip">${extSym}<span class="currency">EXT</span></span>
            </div>
          </div>
        </div>
      `;
    }

    html += `</div></div>`;
  }

  container.innerHTML = html || '<p class="loading">No entries match your search.</p>';

  container.querySelectorAll('.group-checkbox').forEach(cb => {
    if (cb.dataset.indeterminate === 'true') cb.indeterminate = true;
  });

  container.querySelectorAll('.entry-checkbox').forEach(cb => {
    cb.addEventListener('change', () => {
      const idx = parseInt(cb.dataset.idx, 10);
      cb.checked ? selectedIndices.add(idx) : selectedIndices.delete(idx);
      updateToolbar();
      rerenderCanjeGroupHeader(cb.closest('.group-block'));
    });
  });

  container.querySelectorAll('.group-checkbox').forEach(cb => {
    cb.addEventListener('change', e => {
      e.stopPropagation();
      const key = cb.dataset.key;
      const allItems = grouped.get(key) || [];
      const visItems = allItems.filter(({ entry }) => matchesSearch(entry.TradingGroup));
      visItems.forEach(({ idx }) => {
        cb.checked ? selectedIndices.add(idx) : selectedIndices.delete(idx);
      });
      updateToolbar();
      renderCanjeChecklist();
    });
  });

  container.querySelectorAll('.group-header').forEach(header => {
    header.addEventListener('click', e => {
      if (e.target.type === 'checkbox') return;
      const cb = header.querySelector('.group-checkbox');
      cb.checked = !cb.checked;
      cb.dispatchEvent(new Event('change'));
    });
  });

  updateToolbar();
}

function rerenderCanjeGroupHeader(groupBlock) {
  const key = groupBlock.querySelector('.group-checkbox').dataset.key;
  const idxs = entryData.reduce((acc, entry, idx) => {
    if (entry.OrderRoutingId === key) acc.push(idx);
    return acc;
  }, []);
  const cb = groupBlock.querySelector('.group-checkbox');
  cb.checked = idxs.every(i => selectedIndices.has(i));
  cb.indeterminate = idxs.some(i => selectedIndices.has(i)) && !cb.checked;
}

// ── Canje Edit list ────────────────────────────────────────────────────────
function renderCanjeEditList() {
  const container = document.getElementById('edit-list-container');
  if (entryData.length === 0) {
    container.innerHTML = '<p class="loading">No entries found.</p>';
    return;
  }

  const canjeMdsOpts = (selected) =>
    EDITOR_CONFIG.canje.mdsIds.map(id =>
      `<option value="${id}" ${id === selected ? 'selected' : ''}>${id}</option>`
    ).join('');
  const canjeRidOpts = (selected) =>
    EDITOR_CONFIG.canje.routingIds.map(id =>
      `<option value="${id}" ${id === selected ? 'selected' : ''}>${id}</option>`
    ).join('');

  // Compute current distribution and balanced target for preview
  const rids = [...EDITOR_CONFIG.canje.routingIds].sort();
  const currentCounts = {};
  rids.forEach(id => { currentCounts[id] = 0; });
  entryData.forEach(e => { if (currentCounts[e.OrderRoutingId] !== undefined) currentCounts[e.OrderRoutingId]++; });
  const total = entryData.length;
  const base = Math.floor(total / rids.length);
  const extra = total % rids.length;
  const targetCounts = {};
  rids.forEach((id, i) => { targetCounts[id] = base + (i < extra ? 1 : 0); });
  const currentSummary = rids.map(id => `${id}: ${currentCounts[id]}`).join(' &nbsp;·&nbsp; ');
  const targetSummary  = rids.map(id => `${id}: ${targetCounts[id]}`).join(' &nbsp;·&nbsp; ');

  const firstTolerance = entryData.length > 0 ? entryData[0].ToleranceThresholdMs : 3000;
  container.innerHTML = `
    <div class="bulk-tolerance-bar">
      <div class="balance-info">
        <span class="balance-label">Balance OrderRoutingId across routing sessions</span>
        <span class="balance-summary">Now: ${currentSummary} &nbsp;→&nbsp; After: ${targetSummary}</span>
      </div>
      <button id="bulk-balance-btn" class="btn btn-secondary">Balance</button>
    </div>
    <div class="bulk-tolerance-bar">
      <label for="bulk-tolerance">ToleranceThresholdMs — apply to all entries:</label>
      <div class="bulk-tolerance-controls">
        <input type="number" id="bulk-tolerance" value="${firstTolerance}" min="0" />
        <button id="bulk-tolerance-btn" class="btn btn-secondary">Apply to All</button>
      </div>
    </div>
  `;

  // Sort alphabetically by TradingGroup, group by OrderRoutingId for display
  const grouped = new Map();
  entryData.forEach((entry, idx) => {
    const key = entry.OrderRoutingId;
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key).push({ entry, idx });
  });
  const sortedKeys = [...grouped.keys()].sort();

  let html = '';
  for (const key of sortedKeys) {
    const items = grouped.get(key)
      .filter(({ entry }) => matchesSearch(entry.TradingGroup))
      .sort((a, b) => a.entry.TradingGroup.localeCompare(b.entry.TradingGroup));
    if (items.length === 0) continue;
    html += `
      <div class="group-block">
        <div class="group-header" style="cursor:default">
          <span class="group-title">${key}</span>
          <span class="group-badge">${items.length} entr${items.length === 1 ? 'y' : 'ies'}</span>
        </div>
        <div class="group-entries">
    `;

    for (const { entry, idx } of items) {
      const usdSym = entry.Assets.find(a => a.Currency === 'USD')?.Symbol || '';
      const extSym = entry.Assets.find(a => a.Currency === 'EXT')?.Symbol || '';

      html += `
        <div class="entry-row-wrap" data-idx="${idx}">
          <div class="entry-row">
            <div class="entry-info">
              <div class="entry-meta">
                <strong>${entry.TradingGroup}</strong> &nbsp;|&nbsp;
                <strong>MDS:</strong> ${entry.MarketDataSourceId} &nbsp;|&nbsp;
                <strong>MinQty:</strong> ${entry.MinimumQty} &nbsp;|&nbsp;
                <strong>ToleranceMs:</strong> ${entry.ToleranceThresholdMs}
              </div>
              <div class="entry-assets">
                <span class="asset-chip">${usdSym}<span class="currency">USD</span></span>
                <span class="asset-chip">${extSym}<span class="currency">EXT</span></span>
              </div>
            </div>
            <div class="entry-actions">
              <button class="btn-edit" data-idx="${idx}">Edit</button>
            </div>
          </div>
          <div class="edit-form-panel hidden" id="edit-panel-${idx}">
            <div class="form-grid">
              <div class="form-group">
                <label>Trading Group</label>
                <input type="text" class="ef-canje-tg" value="${entry.TradingGroup}" />
              </div>
              <div class="form-group">
                <label>MarketDataSourceId</label>
                <select class="ef-canje-mds">${canjeMdsOpts(entry.MarketDataSourceId)}</select>
              </div>
              <div class="form-group">
                <label>OrderRoutingId</label>
                <select class="ef-canje-rid">${canjeRidOpts(entry.OrderRoutingId)}</select>
              </div>
              <div class="form-group">
                <label>Minimum Qty</label>
                <input type="number" class="ef-canje-qty" value="${entry.MinimumQty}" min="1" />
              </div>
              <div class="form-group">
                <label>ToleranceThresholdMs</label>
                <input type="number" class="ef-canje-tolerance" value="${entry.ToleranceThresholdMs}" min="0" />
              </div>
            </div>
            <div class="section-label">Asset Symbols</div>
            <div class="form-grid">
              <div class="form-group">
                <label>USD Symbol</label>
                <input type="text" class="ef-canje-usd" value="${usdSym}" />
              </div>
              <div class="form-group">
                <label>EXT Symbol</label>
                <input type="text" class="ef-canje-ext" value="${extSym}" />
              </div>
            </div>
            <div class="edit-actions">
              <button class="btn btn-primary ef-canje-save" data-idx="${idx}">Save</button>
              <button class="btn btn-secondary ef-cancel" data-idx="${idx}">Cancel</button>
              <span class="edit-saved-msg" id="edit-saved-${idx}">Saved!</span>
            </div>
          </div>
        </div>
      `;
    }

    html += `</div></div>`;
  }

  container.innerHTML += html;

  document.getElementById('bulk-balance-btn').addEventListener('click', async () => {
    const sortedRids = [...EDITOR_CONFIG.canje.routingIds].sort();
    if (sortedRids.length === 0) return;
    const sortedIndices = [...entryData.keys()].sort((a, b) =>
      entryData[a].TradingGroup.localeCompare(entryData[b].TradingGroup)
    );
    const newData = [...entryData];
    sortedIndices.forEach((idx, i) => {
      newData[idx] = { ...entryData[idx], OrderRoutingId: sortedRids[i % sortedRids.length] };
    });
    await saveAssets(newData);
  });

  document.getElementById('bulk-tolerance-btn').addEventListener('click', async () => {
    const val = parseInt(document.getElementById('bulk-tolerance').value, 10);
    if (isNaN(val)) { alert('Enter a valid number.'); return; }
    await saveAssets(entryData.map(e => ({ ...e, ToleranceThresholdMs: val })));
  });

  container.querySelectorAll('.btn-edit').forEach(btn => {
    btn.addEventListener('click', () => {
      const idx = btn.dataset.idx;
      const panel = document.getElementById(`edit-panel-${idx}`);
      const isOpen = !panel.classList.contains('hidden');
      container.querySelectorAll('.edit-form-panel').forEach(p => p.classList.add('hidden'));
      container.querySelectorAll('.btn-edit').forEach(b => { b.classList.remove('active'); b.textContent = 'Edit'; });
      if (!isOpen) {
        panel.classList.remove('hidden');
        btn.classList.add('active');
        btn.textContent = 'Close';
      }
    });
  });

  container.querySelectorAll('.ef-canje-save').forEach(btn => {
    btn.addEventListener('click', async () => {
      const idx = parseInt(btn.dataset.idx, 10);
      const panel = document.getElementById(`edit-panel-${idx}`);

      const newTg        = panel.querySelector('.ef-canje-tg').value.trim().toUpperCase();
      const newMds       = panel.querySelector('.ef-canje-mds').value;
      const newRid       = panel.querySelector('.ef-canje-rid').value;
      const newQty       = parseInt(panel.querySelector('.ef-canje-qty').value, 10);
      const newTolerance = parseInt(panel.querySelector('.ef-canje-tolerance').value, 10);
      const newUsd       = panel.querySelector('.ef-canje-usd').value.trim().toUpperCase();
      const newExt       = panel.querySelector('.ef-canje-ext').value.trim().toUpperCase();

      if (!newTg || !newUsd || !newExt || isNaN(newQty) || isNaN(newTolerance)) {
        alert('All fields are required.');
        return;
      }

      const updated = buildCanjeEntry(newMds, newRid, newTg, newQty, newTolerance, newUsd, newExt);
      const newData = [...entryData];
      newData[idx] = updated;
      await saveAssets(newData);

      const msg = document.getElementById(`edit-saved-${idx}`);
      if (msg) { msg.classList.add('visible'); setTimeout(() => msg.classList.remove('visible'), 2000); }
    });
  });

  container.querySelectorAll('.ef-cancel').forEach(btn => {
    btn.addEventListener('click', () => {
      const idx = btn.dataset.idx;
      document.getElementById(`edit-panel-${idx}`).classList.add('hidden');
      const editBtn = container.querySelector(`.btn-edit[data-idx="${idx}"]`);
      if (editBtn) { editBtn.classList.remove('active'); editBtn.textContent = 'Edit'; }
    });
  });
}

// ── Canje add form ─────────────────────────────────────────────────────────
document.getElementById('canje-preview-btn').addEventListener('click', () => {
  const mdsId  = document.getElementById('canje-mds-id').value;
  const rid    = document.getElementById('canje-routing-id').value;
  const tg     = document.getElementById('canje-trading-group').value.trim().toUpperCase();
  const minQty = document.getElementById('canje-min-qty').value;
  const tol    = document.getElementById('canje-tolerance').value;
  const usdSym = document.getElementById('canje-symbol-usd').value.trim().toUpperCase();
  const extSym = document.getElementById('canje-symbol-ext').value.trim().toUpperCase();

  if (!tg || !usdSym || !extSym) { showCanjeResult('Please fill in all fields before previewing.', 'error'); return; }
  const entry = buildCanjeEntry(mdsId, rid, tg, minQty, tol, usdSym, extSym);
  document.getElementById('canje-preview-json').textContent = JSON.stringify(entry, null, 2);
  document.getElementById('canje-preview-container').classList.remove('hidden');
  document.getElementById('canje-add-result').classList.add('hidden');
});

document.getElementById('canje-add-form').addEventListener('submit', async e => {
  e.preventDefault();
  const mdsId  = document.getElementById('canje-mds-id').value;
  const rid    = document.getElementById('canje-routing-id').value;
  const tg     = document.getElementById('canje-trading-group').value.trim().toUpperCase();
  const minQty = document.getElementById('canje-min-qty').value;
  const tol    = document.getElementById('canje-tolerance').value;
  const usdSym = document.getElementById('canje-symbol-usd').value.trim().toUpperCase();
  const extSym = document.getElementById('canje-symbol-ext').value.trim().toUpperCase();

  if (entryData.some(d => d.TradingGroup === tg)) {
    showCanjeResult(`TradingGroup "${tg}" already exists.`, 'error');
    return;
  }
  const entry = buildCanjeEntry(mdsId, rid, tg, minQty, tol, usdSym, extSym);
  await saveAssets([...entryData, entry], false, false, true);
});

function showCanjeResult(msg, type) {
  const el = document.getElementById('canje-add-result');
  el.textContent = msg;
  el.className = `result-msg ${type}`;
  el.classList.remove('hidden');
}

// ── TITA build entry ───────────────────────────────────────────────────────
function buildTitaEntry(tradingGroup, symbol, securityType, minQty, lotSize, pxFactor, orderRoutingId = 'XMEV') {
  const isRepo = tradingGroup === 'REPO';
  const entry = {
    TradingGroup: tradingGroup,
    SecurityExchange: 'XMEV',
    OrderRoutingId: orderRoutingId,
    Underlying: symbol,
    Currency: 'ARS',
    MinimumQty: Number(minQty),
    LotSize: Number(lotSize),
    PxDisplayFactor: Number(pxFactor),
    ToleranceThresholdMs: 1000,
    Asset: isRepo
      ? { Symbol: symbol, SecurityID: `${symbol}-#-U-CT-ARS`, SettlementType: 'T_PLUS_1', SecurityType: 'REPO' }
      : { Symbol: symbol, SecurityID: `${symbol}-0001-C-CT-ARS`, SettlementType: 'T_PLUS_0', SecurityType: securityType },
  };
  if (!isRepo) {
    entry.LiquidityAsset = { Symbol: symbol, SecurityID: `${symbol}-0002-C-CT-ARS`, SettlementType: 'T_PLUS_1', SecurityType: securityType };
  }
  return entry;
}

// ── TITA add form ──────────────────────────────────────────────────────────
document.getElementById('tita-trading-group').addEventListener('change', () => {
  const tg = document.getElementById('tita-trading-group').value;
  const secSel = document.getElementById('tita-security-type');
  if (tg === 'REPO') {
    secSel.innerHTML = '<option value="REPO" selected>REPO</option>';
    secSel.disabled = true;
  } else {
    secSel.innerHTML = EDITOR_CONFIG[currentEditor].securityTypes
      .map(st => `<option value="${st}">${st}</option>`).join('');
    secSel.disabled = false;
  }
});

document.getElementById('tita-preview-btn').addEventListener('click', () => {
  const tradingGroup   = document.getElementById('tita-trading-group').value;
  const symbol         = document.getElementById('tita-symbol').value.trim().toUpperCase();
  const securityType   = document.getElementById('tita-security-type').value;
  const orderRoutingId = document.getElementById('tita-order-routing-id').value;
  const minQty         = document.getElementById('tita-min-qty').value;
  const lotSize        = document.getElementById('tita-lot-size').value;
  const pxFactor       = document.getElementById('tita-px-factor').value;

  if (!symbol) { showTitaResult('Please fill in all fields before previewing.', 'error'); return; }

  const entry = buildTitaEntry(tradingGroup, symbol, securityType, minQty, lotSize, pxFactor, orderRoutingId);
  document.getElementById('tita-preview-json').textContent = JSON.stringify(entry, null, 2);
  document.getElementById('tita-preview-container').classList.remove('hidden');
  document.getElementById('tita-add-result').classList.add('hidden');
});

document.getElementById('tita-add-form').addEventListener('submit', async e => {
  e.preventDefault();
  const tradingGroup   = document.getElementById('tita-trading-group').value;
  const symbol         = document.getElementById('tita-symbol').value.trim().toUpperCase();
  const securityType   = document.getElementById('tita-security-type').value;
  const orderRoutingId = document.getElementById('tita-order-routing-id').value;
  const minQty         = document.getElementById('tita-min-qty').value;
  const lotSize        = document.getElementById('tita-lot-size').value;
  const pxFactor       = document.getElementById('tita-px-factor').value;

  if (entryData.some(d => d.TradingGroup === tradingGroup && d.Underlying === symbol)) {
    showTitaResult(`Entry for Underlying "${symbol}" in TradingGroup "${tradingGroup}" already exists.`, 'error');
    return;
  }

  const entry = buildTitaEntry(tradingGroup, symbol, securityType, minQty, lotSize, pxFactor, orderRoutingId);
  await saveAssets([...entryData, entry], false, true);
});

// ── Save ───────────────────────────────────────────────────────────────────
async function saveAssets(newData, isAdd = false, isTitaAdd = false, isCanjeAdd = false) {
  const rootKey = EDITOR_CONFIG[currentEditor].rootKey;
  try {
    const res = await fetch(`/api/assets/${currentEditor}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ [rootKey]: newData }),
    });
    if (!res.ok) { const err = await res.json(); throw new Error(err.error || 'Unknown error'); }
    entryData = newData;
    selectedIndices.clear();
    renderAll();
    if (isAdd) {
      showResult('Trading Group added successfully!', 'success');
      document.getElementById('add-form').reset();
      document.getElementById('preview-container').classList.add('hidden');
    }
    if (isTitaAdd) {
      showTitaResult('Entry added successfully!', 'success');
      document.getElementById('tita-add-form').reset();
      document.getElementById('tita-preview-container').classList.add('hidden');
      populateTitaDropdowns();
    }
    if (isCanjeAdd) {
      showCanjeResult('Entry added successfully!', 'success');
      document.getElementById('canje-add-form').reset();
      document.getElementById('canje-preview-container').classList.add('hidden');
      populateCanjeDropdowns();
    }
  } catch (err) {
    if (isAdd) { showResult('Error: ' + err.message, 'error'); }
    else if (isTitaAdd) { showTitaResult('Error: ' + err.message, 'error'); }
    else if (isCanjeAdd) { showCanjeResult('Error: ' + err.message, 'error'); }
    else { alert('Error saving: ' + err.message); renderAll(); }
  }
}

function showResult(msg, type) {
  const el = document.getElementById('add-result');
  el.textContent = msg;
  el.className = `result-msg ${type}`;
  el.classList.remove('hidden');
}

function showTitaResult(msg, type) {
  const el = document.getElementById('tita-add-result');
  el.textContent = msg;
  el.className = `result-msg ${type}`;
  el.classList.remove('hidden');
}

// ── Export ─────────────────────────────────────────────────────────────────
document.getElementById('export-btn').addEventListener('click', () => {
  const rootKey = EDITOR_CONFIG[currentEditor].rootKey;
  const json = JSON.stringify({ [rootKey]: entryData }, null, 4);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'assets.json';
  a.click();
  URL.revokeObjectURL(url);
});

// ── Tabs ───────────────────────────────────────────────────────────────────
document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(s => s.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById('tab-' + btn.dataset.tab).classList.add('active');
    const isAddTab = btn.dataset.tab === 'add';
    document.getElementById('search-bar').classList.toggle('hidden', isAddTab);
    updateHeaderOffset();
  });
});

// ── Editor switching ───────────────────────────────────────────────────────
document.querySelectorAll('.editor-btn').forEach(btn => {
  btn.addEventListener('click', async () => {
    if (btn.dataset.editor === currentEditor) return;
    currentEditor = btn.dataset.editor;
    document.querySelectorAll('.editor-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById('editor-title').textContent = EDITOR_CONFIG[currentEditor].label;
    searchQuery = '';
    const searchEl = document.getElementById('search-input');
    searchEl.value = '';
    searchEl.placeholder = searchPlaceholder();

    // Reset to Add tab
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(s => s.classList.remove('active'));
    document.querySelector('.tab-btn[data-tab="add"]').classList.add('active');
    document.getElementById('tab-add').classList.add('active');
    document.getElementById('search-bar').classList.add('hidden');
    updateHeaderOffset();

    // Show/hide appropriate add wrapper
    const editorType = EDITOR_CONFIG[currentEditor].type;
    document.getElementById('dxb-add-wrapper').classList.toggle('hidden', editorType !== 'dxb');
    document.getElementById('tita-add-wrapper').classList.toggle('hidden', editorType !== 'tita');
    document.getElementById('canje-add-wrapper').classList.toggle('hidden', editorType !== 'canje');

    // Clear add forms
    if (editorType === 'dxb') {
      populateRoutingDropdown();
      document.getElementById('add-form').reset();
      document.getElementById('preview-container').classList.add('hidden');
      document.getElementById('add-result').classList.add('hidden');
    } else if (editorType === 'tita') {
      populateTitaDropdowns();
      document.getElementById('tita-add-form').reset();
      document.getElementById('tita-preview-container').classList.add('hidden');
      document.getElementById('tita-add-result').classList.add('hidden');
    } else if (editorType === 'canje') {
      populateCanjeDropdowns();
      document.getElementById('canje-add-form').reset();
      document.getElementById('canje-preview-container').classList.add('hidden');
      document.getElementById('canje-add-result').classList.add('hidden');
    }

    document.getElementById('checklist-container').innerHTML = '<p class="loading">Loading...</p>';
    document.getElementById('edit-list-container').innerHTML = '<p class="loading">Loading...</p>';

    await loadAssets().catch(err => {
      document.getElementById('checklist-container').innerHTML =
        `<p class="loading" style="color:#f87171">Failed to load: ${err.message}</p>`;
    });
  });
});

// ── Populate routing dropdowns ─────────────────────────────────────────────
function populateRoutingDropdown() {
  const options = routingIds().map(id => `<option value="${id}">${id}</option>`).join('');
  document.getElementById('primary-mds-id').innerHTML = options;
  document.getElementById('primary-routing-id').innerHTML = options;
  document.getElementById('liquidity-mds-id').innerHTML = options;
  document.getElementById('liquidity-routing-id').innerHTML = options;
}

function deriveCanjeDynamicOptions() {
  EDITOR_CONFIG.canje.mdsIds     = [...new Set(entryData.map(e => e.MarketDataSourceId))].sort();
  EDITOR_CONFIG.canje.routingIds = [...new Set(entryData.map(e => e.OrderRoutingId))].sort();
}

function populateTitaDropdowns() {
  const { tradingGroups, securityTypes, routingIds: titaRids } = EDITOR_CONFIG[currentEditor];
  document.getElementById('tita-trading-group').innerHTML =
    tradingGroups.map(tg => `<option value="${tg}">${tg}</option>`).join('');
  document.getElementById('tita-security-type').innerHTML =
    securityTypes.map(st => `<option value="${st}">${st}</option>`).join('');
  document.getElementById('tita-order-routing-id').innerHTML =
    titaRids.map(id => `<option value="${id}">${id}</option>`).join('');
}

function populateCanjeDropdowns() {
  const mdsOpts = EDITOR_CONFIG.canje.mdsIds.map(id => `<option value="${id}">${id}</option>`).join('');
  const ridOpts = EDITOR_CONFIG.canje.routingIds.map(id => `<option value="${id}">${id}</option>`).join('');
  document.getElementById('canje-mds-id').innerHTML = mdsOpts;
  document.getElementById('canje-routing-id').innerHTML = ridOpts;
}

// ── Search ─────────────────────────────────────────────────────────────────
document.getElementById('search-input').addEventListener('input', e => {
  searchQuery = e.target.value;
  const { type } = EDITOR_CONFIG[currentEditor];
  const activeTab = document.querySelector('.tab-btn.active')?.dataset.tab;
  if (activeTab === 'delete') {
    if (type === 'tita') renderTitaChecklist();
    else if (type === 'canje') renderCanjeChecklist();
    else renderChecklist();
  } else if (activeTab === 'edit') {
    if (type === 'tita') renderTitaEditList();
    else if (type === 'canje') renderCanjeEditList();
    else renderEditList();
  }
});

// ── Sticky header offset ───────────────────────────────────────────────────
function updateHeaderOffset() {
  const h = document.getElementById('main-header').offsetHeight;
  document.documentElement.style.setProperty('--header-h', h + 'px');
}

// ── Init ───────────────────────────────────────────────────────────────────
updateHeaderOffset();
populateRoutingDropdown();
// Pre-populate TITA and canje dropdowns (editor is hidden on init, currentEditor is 'dxb')
currentEditor = 'tita'; populateTitaDropdowns();
currentEditor = 'dxb';
populateCanjeDropdowns();
window.addEventListener('resize', updateHeaderOffset);

loadAssets().catch(err => {
  document.getElementById('checklist-container').innerHTML =
    `<p class="loading" style="color:#f87171">Failed to load: ${err.message}</p>`;
});
