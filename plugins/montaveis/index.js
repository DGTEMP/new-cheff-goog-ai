/**
 * Plugin: montaveis
 * CRUD de itens montáveis — categorias, opções, vínculo com produtos
 */
module.exports = function({ app, db, io, options, log }) {
  const { withTenant } = options || {};

  // Garantir criação das tabelas
  db.run(`CREATE TABLE IF NOT EXISTS itens_montaveis (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    produto_id INTEGER,
    pricing_model TEXT DEFAULT 'soma',
    preco_fixo REAL DEFAULT 0,
    ativo INTEGER DEFAULT 1,
    criado_em DATETIME DEFAULT (datetime('now'))
  )`, (err) => { if(err) console.error('Erro tabela itens_montaveis:', err); });

  db.run(`CREATE TABLE IF NOT EXISTS montavel_categorias (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    montavel_id INTEGER,
    nome TEXT,
    obrigatoria INTEGER DEFAULT 0,
    min_escolhas INTEGER DEFAULT 0,
    max_escolhas INTEGER DEFAULT 1,
    ordem INTEGER DEFAULT 0
  )`, (err) => { if(err) console.error('Erro tabela montavel_categorias:', err); });

  db.run(`CREATE TABLE IF NOT EXISTS montavel_opcoes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    categoria_id INTEGER,
    nome TEXT,
    preco REAL DEFAULT 0,
    ativo INTEGER DEFAULT 1,
    ordem INTEGER DEFAULT 0,
    produto_id INTEGER
  )`, (err) => { if(err) console.error('Erro tabela montavel_opcoes:', err); });

  // Middleware flexível de autenticação (aceita Bearer ou fallback direto)
  function authFlex(req, res, next) {
    if (typeof options.verificarToken === 'function') {
      const authHeader = req.headers['authorization'];
      if (authHeader && authHeader.startsWith('Bearer ') && authHeader.length > 15) {
        return options.verificarToken(req, res, next);
      }
    }
    // Fallback permissivo para ambiente admin local
    req.restaurante_id = req.query.restaurante_id || 1;
    next();
  }

  function runWithTenant(req, fn) {
    if (typeof withTenant === 'function') {
      withTenant(req, fn);
    } else {
      fn();
    }
  }

  function resolverOpcoesVinculadas(opts, done) {
    const lista = opts || [];
    const comVinculo = lista.filter(o => o.produto_id);
    if (!comVinculo.length) return done(lista);
    db.all(`SELECT id, nome, preco, emoji, visibilidade FROM produtos`, [], (eP, prods) => {
      if (eP) return done(lista);
      const mapa = {};
      (prods || []).forEach(p => { mapa[p.id] = p; });
      lista.forEach(o => {
        if (o.produto_id && mapa[o.produto_id]) {
          o.nome = mapa[o.produto_id].nome;
          o.preco = mapa[o.produto_id].preco;
          o.emoji_vinculado = mapa[o.produto_id].emoji || null;
          o.vinculado = true;
        } else if (o.produto_id) {
          o.vinculo_quebrado = true;
        }
      });
      done(lista);
    });
  }

  function insertCategorias(montavelId, cats, done) {
    if (!cats || !cats.length) return done();
    let pending = cats.length;
    cats.forEach((cat, ci) => {
      db.run(`INSERT INTO montavel_categorias (montavel_id, nome, obrigatoria, min_escolhas, max_escolhas, ordem) VALUES (?, ?, ?, ?, ?, ?)`,
        [montavelId, cat.nome || '', cat.obrigatoria ? 1 : 0, cat.min_escolhas || 0, cat.max_escolhas || 1, ci], function (err) {
          if (err || !cat.opcoes || !cat.opcoes.length) { if (--pending === 0) done(); return; }
          const catId = this.lastID;
          let optPending = cat.opcoes.length;
          cat.opcoes.forEach((opt, oi) => {
            db.run(`INSERT INTO montavel_opcoes (categoria_id, nome, preco, ativo, ordem, produto_id) VALUES (?, ?, ?, ?, ?, ?)`,
              [catId, opt.nome || '', Number(opt.preco) || 0, opt.ativo !== undefined ? (opt.ativo ? 1 : 0) : 1, oi, opt.produto_id || null], () => {
                if (--optPending === 0 && --pending === 0) done();
              });
          });
        });
    });
  }

  log('Registering routes...');

  app.get('/api/config/produtos', (req, res) => {
    runWithTenant(req, () => {
      db.all(`SELECT id, nome, preco, emoji, categoria, visibilidade, status FROM produtos WHERE status != 'inativo' ORDER BY nome`, [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows || []);
      });
    });
  });

  app.get('/api/montaveis', (req, res) => {
    runWithTenant(req, () => {
      db.all(`SELECT m.*, p.nome AS produto_nome, p.emoji AS produto_emoji, p.preco AS produto_preco
              FROM itens_montaveis m LEFT JOIN produtos p ON m.produto_id = p.id
              WHERE m.ativo = 1 ORDER BY m.id DESC`, [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows || []);
      });
    });
  });

  app.get('/api/montaveis/:id', (req, res) => {
    const mid = parseInt(req.params.id);
    if (!mid) return res.status(400).json({ error: 'ID inválido' });
    runWithTenant(req, () => {
      db.get(`SELECT m.*, p.nome AS produto_nome, p.preco AS produto_preco FROM itens_montaveis m LEFT JOIN produtos p ON m.produto_id = p.id WHERE m.id = ?`, [mid], (eM, mRow) => {
        if (eM || !mRow) return res.status(404).json({ error: 'Item não encontrado' });
        db.all(`SELECT * FROM montavel_categorias WHERE montavel_id = ? ORDER BY ordem, id`, [mid], (eC, cats) => {
          const catList = cats || [];
          if (catList.length === 0) return res.json({ ...mRow, categorias: [] });
          const catIds = catList.map(c => c.id);
          const ph = catIds.map(() => '?').join(',');
          db.all(`SELECT * FROM montavel_opcoes WHERE categoria_id IN (${ph}) ORDER BY ordem, id`, catIds, (eO, opts) => {
            resolverOpcoesVinculadas(opts || [], (allOpts) => {
              catList.forEach(cat => {
                cat.opcoes = allOpts.filter(o => o.categoria_id === cat.id);
              });
              res.json({ ...mRow, categorias: catList });
            });
          });
        });
      });
    });
  });

  app.post('/api/montaveis', (req, res) => {
    const { produto_id, pricing_model, preco_fixo, categorias } = req.body || {};
    if (!produto_id) return res.status(400).json({ error: 'produto_id obrigatório' });
    runWithTenant(req, () => {
      db.run(`INSERT INTO itens_montaveis (produto_id, pricing_model, preco_fixo) VALUES (?, ?, ?)`,
        [produto_id, pricing_model || 'soma', Number(preco_fixo) || 0], function (err) {
          if (err) return res.status(500).json({ error: err.message });
          const mid = this.lastID;
          insertCategorias(mid, categorias || [], () => {
            res.json({ success: true, id: mid });
          });
        });
    });
  });

  app.put('/api/montaveis/:id', (req, res) => {
    const mid = parseInt(req.params.id);
    if (!mid) return res.status(400).json({ error: 'ID inválido' });
    const { produto_id, pricing_model, preco_fixo, categorias } = req.body || {};
    runWithTenant(req, () => {
      db.run(`UPDATE itens_montaveis SET produto_id = ?, pricing_model = ?, preco_fixo = ? WHERE id = ?`,
        [produto_id, pricing_model || 'soma', Number(preco_fixo) || 0, mid], (err) => {
          if (err) return res.status(500).json({ error: err.message });
          db.run(`DELETE FROM montavel_opcoes WHERE categoria_id IN (SELECT id FROM montavel_categorias WHERE montavel_id = ?)`, [mid], () => {
            db.run(`DELETE FROM montavel_categorias WHERE montavel_id = ?`, [mid], () => {
              insertCategorias(mid, categorias || [], () => {
                res.json({ success: true, id: mid });
              });
            });
          });
        });
    });
  });

  app.delete('/api/montaveis/:id', (req, res) => {
    const mid = parseInt(req.params.id);
    if (!mid) return res.status(400).json({ error: 'ID inválido' });
    runWithTenant(req, () => {
      db.run(`DELETE FROM montavel_opcoes WHERE categoria_id IN (SELECT id FROM montavel_categorias WHERE montavel_id = ?)`, [mid], () => {
        db.run(`DELETE FROM montavel_categorias WHERE montavel_id = ?`, [mid], () => {
          db.run(`DELETE FROM itens_montaveis WHERE id = ?`, [mid], (err) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ success: true });
          });
        });
      });
    });
  });

  app.get('/api/montaveis/produto/:produtoId', (req, res) => {
    const pid = parseInt(req.params.produtoId);
    if (!pid) return res.status(400).json({ error: 'ID inválido' });
    runWithTenant(req, () => {
      db.get(`SELECT * FROM itens_montaveis WHERE produto_id = ? AND ativo = 1`, [pid], (eM, mRow) => {
        if (eM || !mRow) return res.json(null);
        const mid = mRow.id;
        db.all(`SELECT * FROM montavel_categorias WHERE montavel_id = ? ORDER BY ordem, id`, [mid], (eC, cats) => {
          const catList = cats || [];
          if (catList.length === 0) return res.json({ ...mRow, categorias: [] });
          const catIds = catList.map(c => c.id);
          const ph = catIds.map(() => '?').join(',');
          db.all(`SELECT * FROM montavel_opcoes WHERE categoria_id IN (${ph}) AND ativo = 1 ORDER BY ordem, id`, catIds, (eO, opts) => {
            resolverOpcoesVinculadas(opts || [], (allOpts) => {
              catList.forEach(cat => { cat.opcoes = allOpts.filter(o => o.categoria_id === cat.id); });
              res.json({ ...mRow, categorias: catList });
            });
          });
        });
      });
    });
  });

  log('Routes registered.');
};
