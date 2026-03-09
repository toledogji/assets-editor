// ── State ──────────────────────────────────────────────────────────────────
let dxbData = [];
let selectedIndices = new Set();
let currentEditor = 'dxb';

const EDITOR_CONFIG = {
  dxb: { label: 'DxB', toleranceMs: 3000 },
  dxc: { label: 'DxC', toleranceMs: 5000 },
};

// ── Helpers ────────────────────────────────────────────────────────────────
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

// ── Load data ──────────────────────────────────────────────────────────────
async function loadAssets() {
  const res = await fetch(`/api/assets/${currentEditor}`);
  if (!res.ok) throw new Error(await res.text());
  const data = await res.json();
  dxbData = data.DxB;
  selectedIndices.clear();
  renderAll();
}

function renderAll() {
  renderChecklist();
  renderEditList();
  renderRoutingBalance();
}

// ── Checklist render ───────────────────────────────────────────────────────
function renderChecklist() {
  const container = document.getElementById('checklist-container');
  const grouped = groupByTradingGroup(dxbData);

  if (grouped.size === 0) {
    container.innerHTML = '<p class="loading">No entries found.</p>';
    return;
  }

  let html = '';
  for (const [tg, items] of grouped) {
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
              <strong>OrderRoutingId:</strong> ${entry.OrderRoutingId} &nbsp;|&nbsp;
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

  container.innerHTML = html;

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
      (groupByTradingGroup(dxbData).get(tg) || []).forEach(({ idx }) => {
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
  const items = groupByTradingGroup(dxbData).get(tg) || [];
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

// ── Select / Deselect all ──────────────────────────────────────────────────
document.getElementById('select-all-btn').addEventListener('click', () => {
  dxbData.forEach((_, i) => selectedIndices.add(i));
  renderChecklist();
});

document.getElementById('deselect-all-btn').addEventListener('click', () => {
  selectedIndices.clear();
  renderChecklist();
});

// ── Delete flow ────────────────────────────────────────────────────────────
document.getElementById('delete-btn').addEventListener('click', () => {
  const n = selectedIndices.size;
  const groups = [...new Set([...selectedIndices].map(i => dxbData[i].TradingGroup))].sort();
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
  await saveAssets(dxbData.filter((_, i) => !selectedIndices.has(i)));
});

// ── Edit page ──────────────────────────────────────────────────────────────
const ROUTING_IDS = ['XMEV_1', 'XMEV_2', 'XMEV_3', 'XMEV_4'];
const SEQ = { T_PLUS_0: '0001', T_PLUS_1: '0002' };

function getSymbolByCurrency(assets, currency) {
  return (assets.find(a => a.Currency === currency) || {}).Symbol || '';
}

function routingOptions(selected) {
  return ROUTING_IDS.map(id =>
    `<option value="${id}" ${id === selected ? 'selected' : ''}>${id}</option>`
  ).join('');
}

function renderEditList() {
  const container = document.getElementById('edit-list-container');
  const grouped = groupByTradingGroup(dxbData);

  if (grouped.size === 0) {
    container.innerHTML = '<p class="loading">No entries found.</p>';
    return;
  }

  let html = '';
  for (const [tg, items] of grouped) {
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
                <strong>OrderRoutingId:</strong> ${entry.OrderRoutingId} &nbsp;|&nbsp;
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
                <label>Order Routing ID</label>
                <select class="ef-rid">${routingOptions(entry.OrderRoutingId)}</select>
              </div>
              <div class="form-group">
                <label>Minimum Qty</label>
                <input type="number" class="ef-qty" value="${entry.MinimumQty}" min="1" />
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

  container.innerHTML = html;

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

      const newTg  = panel.querySelector('.ef-tg').value.trim().toUpperCase();
      const newRid = panel.querySelector('.ef-rid').value;
      const newQty = parseInt(panel.querySelector('.ef-qty').value, 10);
      const newUsd = panel.querySelector('.ef-usd').value.trim().toUpperCase();
      const newExt = panel.querySelector('.ef-ext').value.trim().toUpperCase();
      const newArs = panel.querySelector('.ef-ars').value.trim().toUpperCase();

      if (!newTg || !newUsd || !newExt || !newArs || isNaN(newQty)) {
        alert('All fields are required.');
        return;
      }

      const entry = dxbData[idx];
      const seq = SEQ[entry.SettlementType];
      const updated = {
        ...entry,
        TradingGroup: newTg,
        OrderRoutingId: newRid,
        MinimumQty: newQty,
        Assets: [
          { Symbol: newUsd, SecurityID: `${newUsd}-${seq}-C-CT-USD`, SecurityType: entry.Assets[0]?.SecurityType || 'BOND', Currency: 'USD', Underlying: newTg, SettlementType: entry.SettlementType },
          { Symbol: newExt, SecurityID: `${newExt}-${seq}-C-CT-EXT`, SecurityType: entry.Assets[1]?.SecurityType || 'BOND', Currency: 'EXT', Underlying: newTg, SettlementType: entry.SettlementType },
          { Symbol: newArs, SecurityID: `${newArs}-${seq}-C-CT-ARS`, SecurityType: entry.Assets[2]?.SecurityType || 'BOND', Currency: 'ARS', Underlying: newTg, SettlementType: entry.SettlementType },
        ],
      };

      const newDxB = [...dxbData];
      newDxB[idx] = updated;
      await saveAssets(newDxB);

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
  const counts = {};
  ROUTING_IDS.forEach(id => counts[id] = 0);
  const seen = {};
  dxbData.forEach(entry => {
    const key = entry.OrderRoutingId + '|' + entry.TradingGroup;
    if (!seen[key] && counts[entry.OrderRoutingId] !== undefined) {
      seen[key] = true;
      counts[entry.OrderRoutingId]++;
    }
  });

  const max = Math.max(...ROUTING_IDS.map(id => counts[id]), 1);
  const minCount = Math.min(...ROUTING_IDS.map(id => counts[id]));

  document.getElementById('routing-balance').innerHTML = ROUTING_IDS.map(id => {
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
        <div class="routing-card-label">trading group${n !== 1 ? 's' : ''}</div>
        <div class="routing-bar-wrap"><div class="routing-bar" style="width:${pct}%"></div></div>
      </div>
    `;
  }).join('');
}

// ── Add form ───────────────────────────────────────────────────────────────
function buildNewEntries(tg, orderRoutingId, minQty, usdSym, extSym, arsSym) {
  const { toleranceMs } = EDITOR_CONFIG[currentEditor];
  const makeEntry = (settlement, seqCode) => ({
    MarketDataSourceId: 'XMEV_1',
    OrderRoutingId: orderRoutingId,
    TradingGroup: tg,
    SettlementType: settlement,
    MinimumQty: Number(minQty),
    ToleranceThresholdMs: toleranceMs,
    Assets: [
      { Symbol: usdSym, SecurityID: `${usdSym}-${seqCode}-C-CT-USD`, SecurityType: 'BOND', Currency: 'USD', Underlying: tg, SettlementType: settlement },
      { Symbol: extSym, SecurityID: `${extSym}-${seqCode}-C-CT-EXT`, SecurityType: 'BOND', Currency: 'EXT', Underlying: tg, SettlementType: settlement },
      { Symbol: arsSym, SecurityID: `${arsSym}-${seqCode}-C-CT-ARS`, SecurityType: 'BOND', Currency: 'ARS', Underlying: tg, SettlementType: settlement },
    ],
  });
  return [makeEntry('T_PLUS_0', '0001'), makeEntry('T_PLUS_1', '0002')];
}

function getFormValues() {
  return {
    tg: document.getElementById('trading-group').value.trim().toUpperCase(),
    orderRoutingId: document.getElementById('order-routing-id').value,
    minQty: document.getElementById('minimum-qty').value,
    usdSym: document.getElementById('symbol-usd').value.trim().toUpperCase(),
    extSym: document.getElementById('symbol-ext').value.trim().toUpperCase(),
    arsSym: document.getElementById('symbol-ars').value.trim().toUpperCase(),
  };
}

document.getElementById('preview-btn').addEventListener('click', () => {
  const { tg, orderRoutingId, minQty, usdSym, extSym, arsSym } = getFormValues();
  if (!tg || !usdSym || !extSym || !arsSym) { showResult('Please fill in all fields before previewing.', 'error'); return; }
  const [e0, e1] = buildNewEntries(tg, orderRoutingId, minQty, usdSym, extSym, arsSym);
  document.getElementById('preview-t0').textContent = JSON.stringify(e0, null, 2);
  document.getElementById('preview-t1').textContent = JSON.stringify(e1, null, 2);
  document.getElementById('preview-container').classList.remove('hidden');
  document.getElementById('add-result').classList.add('hidden');
});

document.getElementById('add-form').addEventListener('submit', async e => {
  e.preventDefault();
  const { tg, orderRoutingId, minQty, usdSym, extSym, arsSym } = getFormValues();
  if (dxbData.some(d => d.TradingGroup === tg)) {
    showResult(`Trading Group "${tg}" already exists in assets.json.`, 'error');
    return;
  }
  const [e0, e1] = buildNewEntries(tg, orderRoutingId, minQty, usdSym, extSym, arsSym);
  await saveAssets([...dxbData, e0, e1], true);
});

// ── Save ───────────────────────────────────────────────────────────────────
async function saveAssets(newDxB, isAdd = false) {
  try {
    const res = await fetch(`/api/assets/${currentEditor}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ DxB: newDxB }),
    });
    if (!res.ok) { const err = await res.json(); throw new Error(err.error || 'Unknown error'); }
    dxbData = newDxB;
    selectedIndices.clear();
    renderAll();
    if (isAdd) {
      showResult('Trading Group added successfully!', 'success');
      document.getElementById('add-form').reset();
      document.getElementById('preview-container').classList.add('hidden');
    }
  } catch (err) {
    if (isAdd) { showResult('Error: ' + err.message, 'error'); }
    else { alert('Error saving: ' + err.message); renderAll(); }
  }
}

function showResult(msg, type) {
  const el = document.getElementById('add-result');
  el.textContent = msg;
  el.className = `result-msg ${type}`;
  el.classList.remove('hidden');
}

// ── Export ─────────────────────────────────────────────────────────────────
document.getElementById('export-btn').addEventListener('click', () => {
  const json = JSON.stringify({ DxB: dxbData }, null, 4);
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

    // Reset to Add tab
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(s => s.classList.remove('active'));
    document.querySelector('.tab-btn[data-tab="add"]').classList.add('active');
    document.getElementById('tab-add').classList.add('active');

    // Clear add form
    document.getElementById('add-form').reset();
    document.getElementById('preview-container').classList.add('hidden');
    document.getElementById('add-result').classList.add('hidden');

    document.getElementById('checklist-container').innerHTML = '<p class="loading">Loading...</p>';
    document.getElementById('edit-list-container').innerHTML = '<p class="loading">Loading...</p>';

    await loadAssets().catch(err => {
      document.getElementById('checklist-container').innerHTML =
        `<p class="loading" style="color:#f87171">Failed to load: ${err.message}</p>`;
    });
  });
});

// ── Sticky header offset ───────────────────────────────────────────────────
function updateHeaderOffset() {
  const h = document.getElementById('main-header').offsetHeight;
  document.documentElement.style.setProperty('--header-h', h + 'px');
}

// ── Init ───────────────────────────────────────────────────────────────────
updateHeaderOffset();
window.addEventListener('resize', updateHeaderOffset);

loadAssets().catch(err => {
  document.getElementById('checklist-container').innerHTML =
    `<p class="loading" style="color:#f87171">Failed to load: ${err.message}</p>`;
});
