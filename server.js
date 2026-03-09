const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 3737;

const ASSET_PATHS = {
  dxb: path.resolve(__dirname, '../algo-trading-config-prod/dbb/config/assets.json'),
  dxc: path.resolve(__dirname, '../algo-trading-config-prod/dbc/config/assets.json'),
};

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.get('/api/assets/:editor', (req, res) => {
  const filePath = ASSET_PATHS[req.params.editor];
  if (!filePath) return res.status(400).json({ error: 'Unknown editor: ' + req.params.editor });
  try {
    const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: 'Failed to read assets.json: ' + err.message });
  }
});

app.post('/api/assets/:editor', (req, res) => {
  const filePath = ASSET_PATHS[req.params.editor];
  if (!filePath) return res.status(400).json({ error: 'Unknown editor: ' + req.params.editor });
  try {
    const data = req.body;
    if (!data || !Array.isArray(data.DxB)) {
      return res.status(400).json({ error: 'Invalid payload: expected { DxB: [...] }' });
    }
    fs.writeFileSync(filePath, JSON.stringify(data, null, 4));
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to write assets.json: ' + err.message });
  }
});

app.listen(PORT, () => {
  console.log(`Assets editor running at http://localhost:${PORT}`);
  Object.entries(ASSET_PATHS).forEach(([k, v]) => console.log(`  ${k}: ${v}`));
});
