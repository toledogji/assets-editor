const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 3737;

const EDITORS = {
  dxb:   { file: path.resolve(__dirname, '../algo-trading-config-prod/dbb/config/assets.json'),    rootKey: 'DxB'   },
  dxc:   { file: path.resolve(__dirname, '../algo-trading-config-prod/dbc/config/assets.json'),    rootKey: 'DxB'   },
  tita:  { file: path.resolve(__dirname, '../algo-trading-config-prod/futop-tita/assets.json'),    rootKey: 'TITA'  },
  canje:       { file: path.resolve(__dirname, '../algo-trading-config-prod/canje/config/assets.json'),        rootKey: 'CANJE' },
  'tita-stocks': { file: path.resolve(__dirname, '../algo-trading-config-prod/futop-tita-stocks/assets.json'), rootKey: 'TITA'  },
};

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.get('/api/assets/:editor', (req, res) => {
  const editor = EDITORS[req.params.editor];
  if (!editor) return res.status(400).json({ error: 'Unknown editor: ' + req.params.editor });
  try {
    const data = JSON.parse(fs.readFileSync(editor.file, 'utf8'));
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: 'Failed to read assets.json: ' + err.message });
  }
});

app.post('/api/assets/:editor', (req, res) => {
  const editor = EDITORS[req.params.editor];
  if (!editor) return res.status(400).json({ error: 'Unknown editor: ' + req.params.editor });
  try {
    const data = req.body;
    if (!data || !Array.isArray(data[editor.rootKey])) {
      return res.status(400).json({ error: `Invalid payload: expected { ${editor.rootKey}: [...] }` });
    }
    fs.writeFileSync(editor.file, JSON.stringify(data, null, 4));
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to write assets.json: ' + err.message });
  }
});

app.listen(PORT, () => {
  console.log(`Assets editor running at http://localhost:${PORT}`);
  Object.entries(EDITORS).forEach(([k, v]) => console.log(`  ${k}: ${v.file}`));
});
