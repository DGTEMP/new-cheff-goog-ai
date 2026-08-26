/**
 * Plugin: nfce
 * Notas Fiscais de Consumidor Eletrônicas — rotas REST + sockets
 */
module.exports = function({ app, db, io, options, log }) {
  const { withTenant, nfceService } = options;

  const NOTAS_COLS = 'id, pedido_id, localName, cliente_nome, cpf_cnpj, valor_total, chave_acesso, numero_nota, serie, ambiente, status, protocolo, created_at';
  const NOTAS_SQL = `SELECT ${NOTAS_COLS} FROM nfce_notas ORDER BY id DESC`;

  function getConfigTenant(cb) {
    db.all(`SELECT * FROM configuracoes`, (err, rows) => {
      const config = {};
      if (rows) rows.forEach(r => config[r.chave] = r.valor);
      cb(config);
    });
  }

  // ── HTTP Routes ──
  log('Registering routes...');

  app.get('/api/nfce/notas', (req, res) => {
    withTenant(req, () => {
      db.all(`${NOTAS_SQL}`, (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows || []);
      });
    });
  });

  app.get('/api/nfce/danfe/:id', (req, res) => {
    withTenant(req, () => {
      db.get(`SELECT * FROM nfce_notas WHERE id = ?`, [req.params.id], (err, nota) => {
        if (err || !nota) return res.status(404).send('Nota Fiscal não encontrada');
        getConfigTenant(config => {
          const danfeHtml = nota.danfe_html || nfceService.gerarDANFEHTML(nota, config);
          res.setHeader('Content-Type', 'text/html; charset=utf-8');
          res.send(danfeHtml);
        });
      });
    });
  });

  app.get('/api/nfce/xml/:id', (req, res) => {
    withTenant(req, () => {
      db.get(`SELECT * FROM nfce_notas WHERE id = ?`, [req.params.id], (err, nota) => {
        if (err || !nota) return res.status(404).send('Nota Fiscal não encontrada');
        getConfigTenant(config => {
          const xml = nota.xml_content || nfceService.gerarXMLNFCe(nota, config);
          res.setHeader('Content-Type', 'application/xml');
          res.setHeader('Content-Disposition', `attachment; filename=NFCe_${nota.chave_acesso}.xml`);
          res.send(xml);
        });
      });
    });
  });

  app.post('/api/nfce/emitir', async (req, res) => {
    withTenant(req, () => {
      getConfigTenant(async config => {
        const result = await nfceService.emitirNFCe({ db, ...req.body, config });
        res.json(result);
      });
    });
  });

  // ── Socket Handlers ──
  log('Registering sockets...');

  io.on('connection', (socket) => {
    socket.on('emitir_nfce', async (data, ack) => {
      try {
        getConfigTenant(async config => {
          const res = await nfceService.emitirNFCe({
            db,
            pedidoId: data.pedidoId,
            localName: data.mesaName || data.localName || 'Mesa',
            items: data.items || [],
            totalValue: data.totalValue || data.total || 0,
            cpfCnpj: data.cpfCnpj || '',
            clienteNome: data.clienteNome || '',
            paymentMethods: data.paymentMethods || (data.payments ? data.payments.map(p => p.metodo).join(', ') : 'Dinheiro'),
            config
          });
          if (typeof ack === 'function') ack(res);
          socket.emit('nfce_emitida_sucesso', res);
          db.all(`${NOTAS_SQL}`, (errNotas, rows) => {
            io.emit('nfce_lista_atualizada', rows || []);
          });
        });
      } catch (e) {
        console.error('Erro na emissão de NFC-e:', e);
        if (typeof ack === 'function') ack({ ok: false, erro: e.message });
        socket.emit('erro_nfce', 'Erro na emissão de NFC-e: ' + e.message);
      }
    });

    socket.on('get_nfce_notas', (opts = {}) => {
      let limit = opts.period === 'semana' ? 300 : 50;
      db.all(`${NOTAS_SQL} LIMIT ?`, [limit], (err, rows) => {
        socket.emit('nfce_lista_atualizada', rows || []);
      });
    });

    socket.on('cancelar_nfce', async ({ id, motivo }, ack) => {
      const res = await nfceService.cancelarNFCe(db, id, motivo);
      if (typeof ack === 'function') ack(res);
      db.all(`${NOTAS_SQL}`, (err, rows) => {
        io.emit('nfce_lista_atualizada', rows || []);
      });
    });

    socket.on('get_nfce_notas_paginated', (opts, callback) => {
      const page = opts.page || 1;
      const limit = opts.limit || 15;
      const offset = (page - 1) * limit;
      const search = opts.search ? '%' + opts.search + '%' : '';
      const startDate = opts.startDate ? opts.startDate + ' 00:00:00' : '';
      const endDate = opts.endDate ? opts.endDate + ' 23:59:59' : '';

      let query = `SELECT ${NOTAS_COLS} FROM nfce_notas WHERE 1=1`;
      let countQuery = 'SELECT COUNT(*) as total FROM nfce_notas WHERE 1=1';
      const params = [];

      if (startDate) { query += ' AND created_at >= ?'; countQuery += ' AND created_at >= ?'; params.push(startDate); }
      if (endDate) { query += ' AND created_at <= ?'; countQuery += ' AND created_at <= ?'; params.push(endDate); }
      if (search) {
        const clause = ' AND (cliente_nome LIKE ? OR cpf_cnpj LIKE ? OR numero_nota LIKE ?)';
        query += clause; countQuery += clause;
        params.push(search, search, search);
      }

      db.get(countQuery, params, (err, countRow) => {
        if (err) { if (typeof callback === 'function') callback({ error: err.message }); return; }
        query += ' ORDER BY id DESC LIMIT ? OFFSET ?';
        db.all(query, [...params, limit, offset], (err2, rows) => {
          if (err2) { if (typeof callback === 'function') callback({ error: err2.message }); return; }
          if (typeof callback === 'function') callback({ data: rows || [], total: countRow.total, page, limit });
        });
      });
    });
  });

  log('Routes + sockets registered.');
};
