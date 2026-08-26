/**
 * plugin: cozinha — Pedidos, Cardápio, Configuração, Alertas, Offline Sync
 * Extraído de server.js: REST endpoints do módulo de cozinha
 */
const fs = require('fs');
const XLSX = require('xlsx');

module.exports = function({ app, db, io, options }) {
  const { verificarToken, withTenant, sendPush, upload } = options;

  const BC = global.__chefBroadcast || {};
  const broadcastProdutos = BC.produtos || function() {};
  const broadcastPedidos = BC.pedidos || function() {};

  const CONFIG_SECRET_KEYS = [
    'mp_access_token', 'pagbank_token', 'stone_stonecode', 'sitef_ip',
    'cert_senha', 'csc', 'token_api_fiscal', 'ponto_token', 'jwt_secret'
  ];

  // ── ROTA DE PEDIDOS DA FILA ──
  app.get('/api/pedidos', verificarToken, (req, res) => {
    db.all("SELECT * FROM pedidos WHERE status NOT IN ('Finalizado','Entregue','Pago','Cancelado') ORDER BY createdAt ASC", [], (err, rows) => {
      res.json(rows || []);
    });
  });

  // ── MÉTRICAS DE GARÇONS ──
  app.get('/api/metricas/garcons', verificarToken, (req, res) => {
    db.all(`SELECT * FROM funcionarios WHERE status = 'Ativo' ORDER BY nome`, [], (errFunc, funcionarios) => {
      if (errFunc) return res.json({ ok: false, erro: 'Erro ao consultar funcionários.' });
      db.all(`SELECT * FROM pedidos ORDER BY id`, [], (errPed, pedidos) => {
        if (errPed) return res.json({ ok: false, erro: 'Erro ao consultar pedidos.' });
        const metricas = (funcionarios || []).map(f => {
          const fPedidos = (pedidos || []).filter(p => p.userName === f.nome || p.userName === f.usuario);
          const total = fPedidos.length;
          const entregues = fPedidos.filter(p => p.status === 'Entregue' || p.status === 'Finalizado' || p.status === 'Pago').length;
          const emAndamento = fPedidos.filter(p => p.status !== 'Entregue' && p.status !== 'Finalizado' && p.status !== 'Pago' && p.status !== 'Cancelado').length;
          let somaMin = 0, countMin = 0;
          fPedidos.forEach(p => {
            if (p.entregueEm && p.createdAt) {
              const criado = new Date(p.createdAt).getTime();
              const entregue = new Date(p.entregueEm).getTime();
              if (!isNaN(criado) && !isNaN(entregue) && entregue > criado) {
                somaMin += (entregue - criado) / 60000;
                countMin++;
              }
            }
          });
          const tempoMedio = countMin > 0 ? Math.round(somaMin / countMin) : null;
          let totalGasto = 0;
          fPedidos.forEach(p => { const val = parseFloat(p.total); if (!isNaN(val)) totalGasto += val; });
          const hoje = new Date();
          const hojeStr = hoje.toISOString().slice(0, 10);
          const pedidosHoje = fPedidos.filter(p => p.createdAt && p.createdAt.slice(0, 10) === hojeStr).length;
          return {
            id: f.id, nome: f.nome, usuario: f.usuario,
            total, entregues, emAndamento,
            taxaEficiencia: total > 0 ? Math.round((entregues / total) * 100) : 0,
            tempoMedioEntrega: tempoMedio,
            totalGasto: Math.round(totalGasto * 100) / 100,
            pedidosHoje
          };
        });
        metricas.sort((a, b) => b.total - a.total);
        res.json({ ok: true, metricas });
      });
    });
  });

  // ── QR CODE ──
  app.get('/api/qr', (req, res) => {
    const data = String(req.query.data || '').slice(0, 2048);
    if (!data) return res.status(400).send('Missing data');
    const size = Math.min(Math.max(parseInt(req.query.size, 10) || 140, 60), 1000);
    try {
      const qrLib = require('../public/vendor/qrcode/qrcode-generator.js');
      const qr = qrLib(0, 'M');
      qr.addData(data);
      qr.make();
      const cell = Math.max(2, Math.floor(size / qr.getModuleCount()));
      const dataUrl = qr.createDataURL(cell, 4);
      const img = Buffer.from(dataUrl.replace(/^data:image\/gif;base64,/, ''), 'base64');
      res.setHeader('Content-Type', 'image/gif');
      res.setHeader('Cache-Control', 'no-store');
      res.send(img);
    } catch (err) {
      res.status(500).send('Erro ao gerar QR');
    }
  });

  // ── TEMPLATE + IMPORTAÇÃO DE PRODUTOS ──
  app.get('/api/template-produtos', (req, res) => {
    const headers = ['Categoria', 'Nome', 'Preço', 'Emoji', 'Setor', 'Status Inicial', 'Categoria Fiscal', 'Código de Barras', 'Descrição', 'Preço Custo', 'Unidade', 'Fornecedor', 'Visibilidade'];
    const exemplos = [
      ['Lanches', 'X-Burger', '28.90', '🍔', 'Cozinha 1', 'Em preparo', 'Alimentacao', '', 'Hamburger artesanal', '12.50', 'UN', '', 'todos'],
      ['Bebidas', 'Coca-Cola Lata', '8.00', '🥤', 'Bar', 'Em espera', 'Bebida_Nao_Alcoolica', '7891234567890', 'Refrigerante 350ml', '3.20', 'UN', 'Coca-Cola', 'todos'],
      ['Sobremesas', 'Pudim', '12.00', '🍮', 'Cozinha 1', 'Em preparo', 'Alimentacao', '', 'Pudim de leite', '4.00', 'UN', '', 'todos'],
    ];
    const sheetData = [headers, ...exemplos];
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(sheetData);
    ws['!cols'] = headers.map(() => ({ wch: 20 }));
    XLSX.utils.book_append_sheet(wb, ws, 'Produtos');
    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    res.setHeader('Content-Disposition', 'attachment; filename=template-produtos.xlsx');
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.send(Buffer.from(buf));
  });

  const uploadMulter = upload || require('multer')();
  app.post('/api/importar-produtos', verificarToken, uploadMulter.single('file'), (req, res) => {
    if (!req.file) return res.status(400).json({ ok: false, erro: 'Nenhum arquivo enviado.' });
    try {
      const wb = XLSX.readFile(req.file.path);
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(ws, { defval: '' });
      if (!rows.length) return res.json({ ok: false, erro: 'Planilha vazia ou formato inválido.' });
      const COL_MAP = {
        'categoria': 'categoria', 'nome': 'nome', 'preço': 'preco', 'preco': 'preco',
        'emoji': 'emoji', 'setor': 'setor', 'status inicial': 'status_inicial', 'status_inicial': 'status_inicial',
        'categoria fiscal': 'categoria_fiscal', 'categoria_fiscal': 'categoria_fiscal',
        'código de barras': 'codigo_barras', 'codigo_barras': 'codigo_barras',
        'descrição': 'descricao', 'descricao': 'descricao',
        'preço custo': 'preco_custo', 'preco_custo': 'preco_custo',
        'unidade': 'unidade', 'fornecedor': 'fornecedor', 'visibilidade': 'visibilidade'
      };
      const mapped = rows.map(r => {
        const out = {};
        Object.keys(r).forEach(k => {
          const key = COL_MAP[k.toLowerCase().trim()];
          if (key) out[key] = r[k];
        });
        return out;
      }).filter(r => r.nome && String(r.nome).trim());
      if (!mapped.length) return res.json({ ok: false, erro: 'Nenhum produto com nome encontrado na planilha.' });
      let inseridos = 0, erros = 0;
      const insertNext = (i) => {
        if (i >= mapped.length) {
          fs.unlinkSync(req.file.path);
          broadcastProdutos();
          return res.json({ ok: true, inseridos, erros, total: mapped.length });
        }
        const p = mapped[i];
        const nome = String(p.nome || '').trim();
        const categoria = String(p.categoria || 'Sem Categoria').trim();
        const preco = parseFloat(String(p.preco || '0').replace(',', '.')) || 0;
        const emoji = String(p.emoji || '').trim();
        const setor = String(p.setor || 'Cozinha 1').trim();
        const status_inicial = String(p.status_inicial || 'Em espera').trim();
        const categoria_fiscal = String(p.categoria_fiscal || 'Alimentacao').trim();
        const codigo_barras = String(p.codigo_barras || '').trim() || null;
        const descricao = String(p.descricao || '').trim();
        const preco_custo = parseFloat(String(p.preco_custo || '0').replace(',', '.')) || 0;
        const unidade = String(p.unidade || 'UN').trim();
        const fornecedor = String(p.fornecedor || '').trim() || null;
        const visibilidade = String(p.visibilidade || 'todos').trim();
        db.run(`INSERT INTO produtos (categoria, nome, preco, emoji, hasAddons, setor, status_inicial, status, categoria_fiscal, descricao, codigo_barras, preco_custo, unidade, fornecedor, visibilidade) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [categoria, nome, preco, emoji, false, setor, status_inicial, 'ativo', categoria_fiscal, descricao, codigo_barras, preco_custo, unidade, fornecedor, visibilidade],
          (err) => { if (err) { erros++; } else { inseridos++; } insertNext(i + 1); });
      };
      insertNext(0);
    } catch (e) {
      fs.unlinkSync(req.file.path);
      return res.status(500).json({ ok: false, erro: 'Erro ao processar arquivo: ' + e.message });
    }
  });

  // ── ATUALIZAR STATUS DO PEDIDO (REST para fila-lite) ──
  app.post('/api/pedidos/:id/status', verificarToken, (req, res) => {
    const { id } = req.params;
    const { status } = req.body;
    const validStatus = ['Em espera', 'Em preparo', 'Pronto'];
    if (!status || validStatus.indexOf(status) === -1) {
      return res.status(400).json({ error: 'Status inválido. Use: Em espera, Em preparo ou Pronto' });
    }
    const prontoUpdate = (status === 'Pronto') ? ", prontoEm = datetime('now', 'localtime')" : '';
    db.run('UPDATE pedidos SET status = ?' + prontoUpdate + ' WHERE id = ?', [status, id], function (err) {
      if (err) return res.status(500).json({ error: 'Erro ao atualizar status' });
      if (this.changes === 0) return res.status(404).json({ error: 'Pedido não encontrado' });
      db.get('SELECT * FROM pedidos WHERE id = ?', [id], (err2, row) => {
        if (err2 || !row) return res.status(500).json({ error: 'Erro ao buscar pedido' });
        io.emit('status_atualizado', row);
        if (status === 'Pronto') {
          io.emit('pedido_pronto', row);
          sendPush('garcom', '✅ Pedido Pronto!', `${row.quantity || 1}x ${row.productName || 'Item'} — ${row.localName || ''}`.trim(), 'pronto-' + id, '/garcom.html');
          const iaState = global.__chefIaState;
          if (iaState && iaState.alertasAtivos) {
            iaState.alertasAtivos.delete('pedido_' + id);
            iaState.alertasAtivos.delete('atencao_' + id);
          }
          if (iaState && iaState.manobrasAtivas) {
            iaState.manobrasAtivas.delete('manobra_' + id);
          }
          io.emit('ia_pedido_resolvido', { pedidoId: id, status: 'Pronto' });
          db.all("SELECT * FROM pedidos WHERE (userName = ? OR userName = 'Chamada') AND status = 'Pronto'", [row.userName], (err3, esteiraRows) => {
            if (esteiraRows) io.emit('esteira_atualizada', esteiraRows);
          });
        }
        broadcastPedidos();
        res.json({ success: true, pedido: row });
      });
    });
  });

  // ── CHAMAR GARÇOM (REST para fila-lite) ──
  const chamarTimestampsRest = {};
  app.post('/api/pedidos/chamar-garcom', verificarToken, (req, res) => {
    const d = req.body || {};
    const id = d.id || null;
    const productName = d.productName || d.mensagem || 'Garçom chamado';
    const quantity = d.quantity || 1;
    const localName = d.localName || d.nome || 'PDV Mobile';
    const userName = d.userName || 'PDV Mobile';
    const now = Date.now();
    const lastCall = chamarTimestampsRest[id];
    const isReChamado = lastCall && (now - lastCall) < 10000;
    chamarTimestampsRest[id] = now;
    if (!id) {
      const pdvCalls = global.__chefPdvCalls || [];
      const entry = { id: 'pdv_' + now, localName, productName, quantity, userName, tipo: 'pdv', criadoEm: now, status: 'Pronto', targetGarcom: d.targetGarcom || null };
      if (!isReChamado) pdvCalls.push(entry);
      io.emit('notificacao_garcom', Object.assign({}, entry, { reChamado: isReChamado }));
      if (!isReChamado) sendPush('garcom', '🔔 Garçom Chamado!', `${quantity}x ${productName} — ${localName}`, 'chamar-pdv-' + now, '/garcom.html');
      broadcastPedidos();
      res.json({ success: true });
    } else {
      io.emit('notificacao_garcom', { id: id, productName: productName, quantity: quantity, localName: localName, userName: userName, tipo: 'chamada', reChamado: isReChamado, targetGarcom: d.targetGarcom || null });
      if (!isReChamado) {
        sendPush('garcom', '🔔 Garçom Chamado!', `${quantity}x ${productName} — ${localName}`, 'chamar-' + id, '/garcom.html');
        db.run(`UPDATE pedidos SET garcom_call = datetime('now', 'localtime') WHERE id = ?`, [id]);
      }
      broadcastPedidos();
      res.json({ success: true });
    }
  });

  // ── CONFIGURAÇÃO DO RESTAURANTE ──
  app.get('/api/config', (req, res) => {
    withTenant(req, () => {
      db.all(`SELECT * FROM configuracoes`, (err, rows) => {
        if (err) return res.status(500).send(err);
        const cfgs = {};
        if (rows) rows.forEach(r => {
          if (CONFIG_SECRET_KEYS.includes(r.chave) && r.valor) {
            cfgs[r.chave] = '***';
          } else {
            cfgs[r.chave] = r.valor;
          }
        });
        res.json(cfgs);
      });
    });
  });

  app.post('/api/config', verificarToken, (req, res) => {
    const configs = req.body;
    if (!configs) return res.status(400).send('Dados inválidos');
    db.serialize(() => {
      db.run("BEGIN TRANSACTION;");
      Object.keys(configs).forEach(chave => {
        const valor = typeof configs[chave] === 'object' ? JSON.stringify(configs[chave]) : String(configs[chave]);
        if (CONFIG_SECRET_KEYS.includes(chave) && valor === '***') return;
        db.run(`INSERT INTO configuracoes (chave, valor) VALUES (?, ?) ON CONFLICT(chave) DO UPDATE SET valor = excluded.valor`, [chave, valor]);
      });
      db.run("COMMIT;");
    });
    setTimeout(() => {
      io.emit('configuracoes_atualizadas');
      broadcastProdutos();
      res.json({ success: true });
    }, 500);
  });

  // ── ALERTAS AO CLIENTE ──
  app.get('/api/alertas-cliente', (req, res) => {
    withTenant(req, () => {
      const mesa = String(req.query.mesa || '').trim();
      if (!mesa) return res.status(400).json({ error: 'mesa obrigatória' });
      db.all(
        `SELECT * FROM alertas_cliente WHERE mesa = ? AND entregue = 0 ORDER BY id ASC LIMIT 50`,
        [mesa],
        (err, rows) => {
          if (err) return res.status(500).json({ error: 'Erro ao buscar alertas.' });
          res.json({ alertas: rows || [] });
        }
      );
    });
  });

  app.post('/api/alertas-cliente/lidas', (req, res) => {
    withTenant(req, () => {
      const ids = Array.isArray(req.body && req.body.ids)
        ? req.body.ids.map(Number).filter(n => Number.isInteger(n) && n > 0).slice(0, 100)
        : [];
      if (!ids.length) return res.json({ ok: true, atualizados: 0 });
      db.run(`UPDATE alertas_cliente SET entregue = 1 WHERE id IN (${ids.map(() => '?').join(',')})`, ids, function (err) {
        if (err) return res.status(500).json({ error: 'Erro ao marcar alertas.' });
        res.json({ ok: true, atualizados: this.changes });
      });
    });
  });

  // ── OFFLINE SYNC ──
  app.post('/api/pedidos/offline-sync', require('express').json({ limit: '1mb' }), verificarToken, (req, res) => {
    const tid = req.restaurante_id;
    const itens = Array.isArray(req.body && req.body.pedidos) ? req.body.pedidos.slice(0, 100) : [];
    if (!itens.length) return res.json({ success: true, resultados: [] });
    const masterDb = options.masterDb;
    masterDb.get(`SELECT offline_habilitado FROM restaurantes WHERE id = ?`, [tid], (eR, rRow) => {
      if (eR || !rRow || rRow.offline_habilitado !== 1) {
        return res.status(403).json({ success: false, error: 'Modo offline não habilitado para este restaurante.' });
      }
      const core = global.__chefNovoPedidoCore;
      if (!core) return res.status(503).json({ success: false, error: 'Servidor inicializando, tente novamente.' });
      const resultados = [];
      let pendentes = itens.length;
      let respondido = false;
      const finalizar = () => {
        if (respondido) return;
        respondido = true;
        res.json({ success: true, resultados });
      };
      const tid2 = tid;
      itens.forEach(pedido => {
        const uuid = String(pedido.uuid_offline || '').slice(0, 64);
        if (!uuid) { resultados.push({ uuid_offline: '', status: 'erro' }); if (--pendentes <= 0) finalizar(); return; }
        db.get(`SELECT id FROM pedidos WHERE uuid_offline = ? LIMIT 1`, [uuid], (eDup, dup) => {
          if (!eDup && dup) { resultados.push({ uuid_offline: uuid, status: 'duplicado' }); if (--pendentes <= 0) finalizar(); return; }
          core(pedido, {
            tenantId: tid2,
            reply: (evt, data) => {
              resultados.push({ uuid_offline: uuid, status: (evt === 'pedido_erro') ? 'erro' : 'gravado' });
              if (--pendentes <= 0) finalizar();
            }
          });
        });
      });
      setTimeout(finalizar, 8000);
    });
  });
};
