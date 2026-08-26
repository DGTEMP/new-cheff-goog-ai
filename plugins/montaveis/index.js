/**
 * Plugin: montaveis
 * CRUD de itens montáveis — categorias, opções, vínculo com produtos
 */
module.exports = function({ app, db, io, options, log }) {
  const { withTenant, verificarToken } = options;

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
    if (!cats.length) return done();
    let pending = cats.length;
    cats.forEach((cat, ci) => {
      db.run(`INSERT INTO montavel_categorias (montavel_id, nome, obrigatoria, min_escolhas, max_escolhas, ordem) VALUES (?, ?, ?, ?, ?, ?)`,
        [montavelId, cat.nome || '', cat.obrigatoria ? 1 : 0, cat.min_escolhas || 0, cat.max_escolhas || 1, ci], function (err) {
          if (err || !cat.opcoes || !cat.opcoes.length) { if (--pending === 0) done(); return; }
          const catId = this.lastID;
          let optPending = cat.opcoes.length;
          cat.opcoes.forEach((opt, oi) => {
            db.run(`INSERT INTO montavel_opcoes (categoria_id, nome, preco, ativo, ordem, produto_id) VALUES (?, ?, ?, ?, ?, ?)`,
              [catId, opt.nome || '', opt.preco || 0, opt.ativo !== undefined ? (opt.ativo ? 1 : 0) : 1, oi, opt.produto_id || null], () => {
                if (--optPending === 0 && --pending === 0) done();
              });
          });
        });
    });
  }

  log('Registering routes...');

  app.get('/api/config/produtos', verificarToken, (req, res) => {
    withTenant(req, () => {
      db.all(`SELECT id, nome, preco, emoji, categoria, visibilidade, status FROM produtos WHERE status != 'inativo' ORDER BY nome`, [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows || []);
      });
    });
  });

  app.get('/api/montaveis', verificarToken, (req, res) => {
    withTenant(req, () => {
      db.all(`SELECT m.*, p.nome AS produto_nome, p.emoji AS produto_emoji
              FROM itens_montaveis m LEFT JOIN produtos p ON m.produto_id = p.id
              WHERE m.ativo = 1 ORDER BY m.id DESC`, [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows || []);
      });
    });
  });

  app.get('/api/montaveis/:id', verificarToken, (req, res) => {
    const mid = parseInt(req.params.id);
    if (!mid) return res.status(400).json({ error: 'ID inválido' });
    withTenant(req, () => {
      db.get(`SELECT m.*, p.nome AS produto_nome FROM itens_montaveis m LEFT JOIN produtos p ON m.produto_id = p.id WHERE m.id = ?`, [mid], (eM, mRow) => {
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

  app.post('/api/montaveis', verificarToken, (req, res) => {
    const { produto_id, pricing_model, preco_fixo, categorias } = req.body || {};
    if (!produto_id) return res.status(400).json({ error: 'produto_id obrigatório' });
    withTenant(req, () => {
      db.run(`INSERT INTO itens_montaveis (produto_id, pricing_model, preco_fixo) VALUES (?, ?, ?)`,
        [produto_id, pricing_model || 'soma', preco_fixo || 0], function (err) {
          if (err) return res.status(500).json({ error: err.message });
          const mid = this.lastID;
          insertCategorias(mid, categorias || [], () => {
            res.json({ success: true, id: mid });
          });
        });
    });
  });

  app.put('/api/montaveis/:id', verificarToken, (req, res) => {
    const mid = parseInt(req.params.id);
    if (!mid) return res.status(400).json({ error: 'ID inválido' });
    const { produto_id, pricing_model, preco_fixo, categorias } = req.body || {};
    withTenant(req, () => {
      db.run(`UPDATE itens_montaveis SET produto_id = ?, pricing_model = ?, preco_fixo = ? WHERE id = ?`,
        [produto_id, pricing_model || 'soma', preco_fixo || 0, mid], (err) => {
          if (err) return res.status(500).json({ error: err.message });
          db.run(`DELETE FROM montavel_opcoes WHERE categoria_id IN (SELECT id FROM montavel_categorias WHERE montavel_id = ?)`, [mid], () => {
            db.run(`DELETE FROM montavel_categorias WHERE montavel_id = ?`, [mid], () => {
              insertCategorias(mid, categorias || [], () => {
                res.json({ success: true });
              });
            });
          });
        });
    });
  });

  app.delete('/api/montaveis/:id', verificarToken, (req, res) => {
    const mid = parseInt(req.params.id);
    if (!mid) return res.status(400).json({ error: 'ID inválido' });
    withTenant(req, () => {
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

  app.get('/api/montaveis/produto/:produtoId', verificarToken, (req, res) => {
    const pid = parseInt(req.params.produtoId);
    if (!pid) return res.status(400).json({ error: 'ID inválido' });
    withTenant(req, () => {
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
