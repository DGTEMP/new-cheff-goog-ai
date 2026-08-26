/**
 * Plugin: formas-pagamento
 * Gerenciamento de formas de pagamento (CRUD + broadcast)
 */
module.exports = function({ app, db, io, options, log }) {
  const { withTenant, resolveTenantId } = options;

  // ── Broadcast helper (reusável por server.js via options) ──
  function broadcastFormasPagamento(targetSocket, tenantId) {
    db.all(`SELECT * FROM formas_pagamento ORDER BY ordem ASC, id ASC`, [], (err, rows) => {
      if (!err) {
        if (targetSocket) {
          targetSocket.emit('formas_pagamento_atualizadas', rows || []);
        } else if (Number.isFinite(tenantId) && tenantId > 0) {
          io.to(`restaurante_${tenantId}`).emit('formas_pagamento_atualizadas', rows || []);
        } else {
          io.emit('formas_pagamento_atualizadas', rows || []);
        }
      }
    });
  }

  // Expor para server.js usar
  options.broadcastFormasPagamento = broadcastFormasPagamento;

  // ── HTTP Routes ──
  log('Registering routes...');

  app.get('/api/formas-pagamento', (req, res) => {
    withTenant(req, () => {
      db.all(`SELECT * FROM formas_pagamento ORDER BY ordem ASC, id ASC`, [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows || []);
      });
    });
  });

  app.post('/api/formas-pagamento', (req, res) => {
    const { id, nome, tipo, taxa, prazo_dias, ativo, icone } = req.body || {};
    if (!nome) return res.status(400).json({ error: 'Nome é obrigatório' });
    const tid = resolveTenantId(req);

    withTenant(req, () => {
      if (id) {
        db.run(
          `UPDATE formas_pagamento SET nome = ?, tipo = ?, taxa = ?, prazo_dias = ?, ativo = ?, icone = ? WHERE id = ?`,
          [nome, tipo || 'credito', parseFloat(taxa) || 0, parseInt(prazo_dias) || 0, ativo ? 1 : 0, icone || 'ph-credit-card', id],
          function (err) {
            if (err) return res.status(500).json({ error: err.message });
            broadcastFormasPagamento(null, tid);
            res.json({ success: true, id });
          }
        );
      } else {
        db.run(
          `INSERT INTO formas_pagamento (nome, tipo, taxa, prazo_dias, ativo, icone) VALUES (?, ?, ?, ?, ?, ?)`,
          [nome, tipo || 'credito', parseFloat(taxa) || 0, parseInt(prazo_dias) || 0, ativo !== undefined ? (ativo ? 1 : 0) : 1, icone || 'ph-credit-card'],
          function (err) {
            if (err) return res.status(500).json({ error: err.message });
            const newId = this.lastID;
            broadcastFormasPagamento(null, tid);
            res.json({ success: true, id: newId });
          }
        );
      }
    });
  });

  app.post('/api/formas-pagamento/:id/toggle', (req, res) => {
    const { id } = req.params;
    const { ativo } = req.body || {};
    const tid = resolveTenantId(req);
    withTenant(req, () => {
      db.run(`UPDATE formas_pagamento SET ativo = ? WHERE id = ?`, [ativo ? 1 : 0, id], function (err) {
        if (err) return res.status(500).json({ error: err.message });
        broadcastFormasPagamento(null, tid);
        res.json({ success: true });
      });
    });
  });

  app.delete('/api/formas-pagamento/:id', (req, res) => {
    const { id } = req.params;
    const tid = resolveTenantId(req);
    withTenant(req, () => {
      db.get(`SELECT nome FROM formas_pagamento WHERE id = ?`, [id], (err, row) => {
        if (err || !row) return res.status(404).json({ error: 'Forma de pagamento não encontrada.' });
        db.get(`SELECT COUNT(*) as count FROM pedidos WHERE paymentMethod = ?`, [row.nome], (e, r) => {
          if (!e && r && r.count > 0) {
            return res.status(400).json({ error: `"${row.nome}" não pode ser excluído pois já foi utilizado em ${r.count} pedido(s). Apenas desative-o.` });
          }
          db.run(`DELETE FROM formas_pagamento WHERE id = ?`, [id], function (err2) {
            if (err2) return res.status(500).json({ error: err2.message });
            broadcastFormasPagamento(null, tid);
            res.json({ success: true });
          });
        });
      });
    });
  });

  // ── Socket: reconnect envia formas atuais ──
  io.on('connection', (socket) => {
    socket.on('get_formas_pagamento', () => {
      broadcastFormasPagamento(socket);
    });
  });

  log('Routes + sockets registered.');
};
