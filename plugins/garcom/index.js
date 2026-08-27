/**
 * plugin: garcom — Salão, Mesas, Garçom, Cupons, RH
 * Extraído de server.js: socket handlers do módulo garçom + endpoints REST RH
 *
 * Padrão: registerGarcomSockets(socket, ctx) é chamado de dentro do
 * io.on('connection') do server.js, injetando as dependências do closure.
 */
const fs = require('fs');
const path = require('path');

module.exports = function({ app, db, io, options }) {
  const { verificarToken } = options;

  // ══════════════════════════════════════════════════════════════
  // REST ENDPOINTS
  // ══════════════════════════════════════════════════════════════

  // ── RH: EXTRATO DO FUNCIONÁRIO ──
  app.get('/api/rh/extrato/:id', verificarToken, (req, res) => {
    const funcId = req.params.id;
    db.get("SELECT nome FROM funcionarios WHERE id = ?", [funcId], (errF, func) => {
      if (errF || !func) return res.status(404).send("Funcionário não encontrado");
      const funcName = func.nome;
      db.all("SELECT id, valor, data_pedido, observacao FROM vales WHERE funcionario_id = ? AND status = 'Aprovado' AND pagamento_id IS NULL", [funcId], (errV, vales) => {
        db.all("SELECT id, total, productName, quantity, createdAt FROM pedidos WHERE status = 'Finalizado' AND paymentMethod = 'Fiado' AND pagamento_id IS NULL AND funcionario_id = ?", [funcId], (errP, fiados) => {
          const buscarFiados = (fiados && fiados.length > 0) ? Promise.resolve(fiados) : new Promise((resolve) => {
            db.all("SELECT id, total, productName, quantity, createdAt FROM pedidos WHERE status = 'Finalizado' AND paymentMethod = 'Fiado' AND pagamento_id IS NULL AND userName = ?", [funcName], (e, rows) => {
              resolve(rows || []);
            });
          });
          buscarFiados.then(fiadosLista => {
            db.all("SELECT id, data, valor, justificativa, forma_pagamento FROM dias_atipicos WHERE funcionario_id = ? AND status = 'aprovado' AND pagamento_id IS NULL", [funcId], (errD, atipicos) => {
              let totalVales = 0;
              (vales || []).forEach(v => totalVales += parseFloat(v.valor || 0));
              let totalConsumo = 0;
              (fiadosLista || []).forEach(f => {
                let rawTotal = String(f.total || '0').replace('R$', '').replace(/\./g, '').replace(',', '.').trim();
                let val = parseFloat(rawTotal || 0);
                if (!isNaN(val) && val > 0 && val < 5000) totalConsumo += val;
              });
              let totalAtipicos = 0;
              (atipicos || []).forEach(a => totalAtipicos += parseFloat(a.valor || 0));
              res.json({
                vales: vales || [], fiados: fiadosLista || [], atipicos: atipicos || [],
                total_vales: totalVales, total_consumo: totalConsumo,
                total_dias_extras: totalAtipicos, suggested_bruto: totalAtipicos
              });
            });
          });
        });
      });
    });
  });

  // ── RH: PAGAMENTOS ──
  app.post('/api/rh/pagamentos', verificarToken, (req, res) => {
    const { funcionario_id, valor_bruto, total_vales_abatidos, total_consumo_abatido, valor_liquido, observacao, vales_ids, pedidos_ids } = req.body;
    const dataPagamento = new Date().toISOString();
    db.run(`INSERT INTO funcionarios_pagamentos (funcionario_id, data_pagamento, valor_bruto, total_vales_abatidos, total_consumo_abatido, valor_liquido, observacao) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [funcionario_id, dataPagamento, valor_bruto, total_vales_abatidos, total_consumo_abatido, valor_liquido, observacao || ''],
      function (err) {
        if (err) return res.status(500).send("Erro ao registrar pagamento");
        const pagId = this.lastID;
        if (vales_ids && vales_ids.length > 0) {
          db.run(`UPDATE vales SET pagamento_id = ? WHERE id IN (${vales_ids.map(() => '?').join(',')})`, [pagId, ...vales_ids]);
        }
        if (pedidos_ids && pedidos_ids.length > 0) {
          db.run(`UPDATE pedidos SET pagamento_id = ? WHERE id IN (${pedidos_ids.map(() => '?').join(',')})`, [pagId, ...pedidos_ids]);
        }
        io.emit('rh_update');
        db.get("SELECT nome FROM funcionarios WHERE id = ?", [funcionario_id], (errF, func) => {
          const nome = func ? func.nome : 'Colaborador';
          io.emit('pagamento_colaborador_celebracao', {
            funcionario_id, funcionario_nome: nome,
            valor: valor_liquido || valor_bruto,
            data_pagamento: dataPagamento,
            observacao: observacao || '',
            pagamento_id: pagId
          });
        });
        res.json({ success: true, pagamento_id: pagId });
      }
    );
  });

  console.log('[plugin:garcom] REST endpoints registered.');
};

// ══════════════════════════════════════════════════════════════
// SOCKET HANDLERS — chamado por server.js dentro de io.on('connection')
// ══════════════════════════════════════════════════════════════

module.exports.registerGarcomSockets = function(socket, ctx) {
  const { db, io, socketTenantId, broadcastPedidos, broadcastMesaClientes, sendPush, exigirAdminSocket, exigirAuthSocket, chamarTimestamps, pdvCalls, liberarMesaSeVazia, avisarClienteMesa, mesasFechando } = ctx;
  const globalBroadcast = global.__chefBroadcast || {};
  const _broadcastPedidos = broadcastPedidos || globalBroadcast.pedidos || function() {};
  const _broadcastMesaClientes = broadcastMesaClientes || globalBroadcast.mesaClientes || function() {};
  const _avisarClienteMesa = avisarClienteMesa || globalBroadcast.avisarCliente || function() {};

  // ── TRANSFERIR MESA ──
  socket.on('transferir_mesa', ({ mesaAtual, novaMesa, operador }) => {
    db.run(`UPDATE pedidos SET localName = ? WHERE localName = ? AND status != 'Finalizado'`, [novaMesa, mesaAtual], (err) => {
      if (!err) {
        global.registrarAuditoria(operador || 'Sistema', 'TRANSFERENCIA_MESA', `Mesa ${mesaAtual} transferida para ${novaMesa}`, 'Operação de Salão', 'MEDIO');
        _broadcastPedidos();
      }
    });
  });

  // ── JUNTAR MESAS ──
  socket.on('juntar_mesas', ({ mesaA, mesaB, operador }, ack) => {
    const responder = (ok, mensagem) => {
      if (typeof ack === 'function') ack({ ok, mensagem });
      else if (!ok) socket.emit('erro_servidor', mensagem);
    };
    if (!mesaA || !mesaB || mesaA === mesaB) return responder(false, 'Mesas inválidas para junção.');
    db.all(`SELECT * FROM mesas WHERE nome IN (?, ?)`, [mesaA, mesaB], (eSel, alvos) => {
      if (eSel || !alvos || alvos.length < 2) return responder(false, 'Mesa não encontrada.');
      const tokenBase = alvos.map(m => m.grupo_juncao).filter(Boolean)[0] || `J${Date.now()}`;
      const nomesAlvo = alvos.map(m => m.nome);
      db.all(`SELECT * FROM mesas WHERE grupo_juncao = ? OR nome IN (?, ?)`, [tokenBase, mesaA, mesaB], (eGrp, grupo) => {
        const integrantes = [...new Set([...(grupo || []).map(m => m.nome), ...nomesAlvo])];
        db.run(`UPDATE mesas SET grupo_juncao = ? WHERE grupo_juncao = ? OR nome IN (${integrantes.map(() => '?').join(', ')})`,
          [tokenBase, tokenBase, ...integrantes], (eUp) => {
            if (eUp) return responder(false, 'Falha ao juntar as mesas.');
            const rotulo = integrantes.slice().sort((a, b) => a.localeCompare(b, 'pt-BR', { numeric: true })).join(' + ');
            db.run(`UPDATE pedidos SET mesa_grupo = ? WHERE localName IN (${integrantes.map(() => '?').join(', ')}) AND status NOT IN ('Finalizado','Cancelado')`,
              [rotulo, ...integrantes], () => {
                global.registrarAuditoria(operador || 'Sistema', 'JUNCAO_MESAS', `${integrantes.join(' + ')} → grupo "${rotulo}"`, 'Operação de Salão', 'BAIXO');
                db.all(`SELECT * FROM mesas`, (e, rows) => io.emit('mesas_atualizadas', rows || []));
                _broadcastPedidos();
                responder(true, `Mesas unidas: ${rotulo}`);
              });
          });
      });
    });
  });

  // ── DESFAZER JUNÇÃO ──
  socket.on('desfazer_juncao', ({ mesaNome, operador }, ack) => {
    const responder = (ok, mensagem) => {
      if (typeof ack === 'function') ack({ ok, mensagem });
      else if (!ok) socket.emit('erro_servidor', mensagem);
    };
    if (!mesaNome) return responder(false, 'Mesa inválida.');
    db.get(`SELECT grupo_juncao FROM mesas WHERE nome = ?`, [mesaNome], (eSel, row) => {
      if (eSel || !row) return responder(false, 'Mesa não encontrada.');
      if (!row.grupo_juncao) return responder(true, 'Esta mesa não está em junção.');
      db.all(`SELECT nome FROM mesas WHERE grupo_juncao = ?`, [row.grupo_juncao], (eG, grupo) => {
        const nomes = (grupo || []).map(g => g.nome);
        db.run(`UPDATE mesas SET grupo_juncao = NULL WHERE grupo_juncao = ?`, [row.grupo_juncao], () => {
          if (nomes.length) {
            db.run(`UPDATE pedidos SET mesa_grupo = NULL WHERE localName IN (${nomes.map(() => '?').join(', ')}) AND status NOT IN ('Finalizado','Cancelado')`,
              nomes, () => { });
          }
          global.registrarAuditoria(operador || 'Sistema', 'DESFAZER_JUNCAO', `Grupo ${nomes.join(' + ')} desfeito`, 'Operação de Salão', 'BAIXO');
          db.all(`SELECT * FROM mesas`, (e, rows) => io.emit('mesas_atualizadas', rows || []));
          _broadcastPedidos();
          responder(true, 'Junção desfeita.');
        });
      });
    });
  });

  // ── SALVAR LAYOUT DO SALÃO ──
  socket.on('salvar_layout_salao', ({ mesas: layout, operador } = {}, ack) => {
    const responder = (ok, mensagem) => {
      if (typeof ack === 'function') ack({ ok, mensagem });
      else if (!ok) socket.emit('erro_servidor', mensagem);
    };
    if (!exigirAdminSocket(socket)) return responder(false, 'Apenas administradores podem editar o layout do salão.');
    if (!Array.isArray(layout)) return responder(false, 'Layout inválido.');
    let pendentes = layout.length;
    if (!pendentes) return responder(true, 'Nada para salvar.');
    let falhas = 0;
    layout.forEach(m => {
      if (!m || !m.id) { pendentes--; return; }
      db.run(`UPDATE mesas SET pos_x = ?, pos_y = ?, lugares = ?, sala = ? WHERE id = ?`,
        [Number(m.pos_x) || 0, Number(m.pos_y) || 0, Math.max(1, parseInt(m.lugares, 10) || 4), String(m.sala || 'Salão principal').slice(0, 60), m.id],
        (err) => {
          if (err) falhas++;
          pendentes--;
          if (pendentes <= 0) {
            if (falhas) return responder(false, `${falhas} mesa(s) não puderam ser salvas.`);
            global.registrarAuditoria(socket.auth?.nome || operador || 'Sistema', 'LAYOUT_SALAO', `Layout do salão atualizado (${layout.length} mesas)`, 'Configurações', 'BAIXO');
            db.all(`SELECT * FROM mesas`, (e, rows) => io.emit('mesas_atualizadas', rows || []));
            responder(true, 'Layout do salão salvo.');
          }
        });
    });
  });

  // ── TRANSFERIR MESAS (ITENS) ──
  socket.on('transferir_mesas_itens', ({ mesaA, mesaB, operador }) => {
    db.run(`UPDATE pedidos SET localName = ?, mesa_grupo = NULL WHERE localName = ? AND status != 'Finalizado'`, [mesaB, mesaA], (err) => {
      if (!err) {
        db.run(`UPDATE mesas SET status = 'Disponível' WHERE nome = ?`, [mesaA], () => {
          db.all(`SELECT * FROM mesas`, (e, rows) => io.emit('mesas_atualizadas', rows || []));
        });
        global.registrarAuditoria(operador || 'Sistema', 'TRANSFERENCIA_MESAS_ITENS', `Itens de ${mesaA} movidos para ${mesaB}. Mesa ${mesaA} liberada.`, 'Operação de Salão', 'MEDIO');
        _broadcastPedidos();
      }
    });
  });

  // ── TRANSFERIR ITEM ──
  socket.on('transferir_item', ({ itemId, novaMesa, operador }) => {
    db.get(`SELECT localName FROM pedidos WHERE id = ?`, [itemId], (errGet, rowGet) => {
      const mesaAntiga = rowGet ? rowGet.localName : null;
      db.run(`UPDATE pedidos SET localName = ?, mesa_grupo = NULL WHERE id = ?`, [novaMesa, itemId], (err) => {
        if (!err) {
          global.registrarAuditoria(operador || 'Sistema', 'TRANSFERENCIA_ITEM', `Item ${itemId} transferido para ${novaMesa}`, 'Operação de Salão', 'MEDIO');
          _broadcastPedidos();
          if (liberarMesaSeVazia) liberarMesaSeVazia(mesaAntiga);
        }
      });
    });
  });

  // ── ATRIBUIR COMANDA ──
  socket.on('atribuir_comanda_item', ({ itemId, comandaName, operador }) => {
    const comandaVal = (comandaName && String(comandaName).trim()) ? String(comandaName).trim() : null;
    db.run(`UPDATE pedidos SET mesa_comanda = ? WHERE id = ?`, [comandaVal, itemId], (err) => {
      if (!err) {
        global.registrarAuditoria(operador || 'Sistema', 'ATRIBUICAO_COMANDA', `Item ${itemId} associado à comanda: ${comandaVal}`, 'Operação de Salão', 'BAIXO');
        _broadcastPedidos();
      }
    });
  });

  // ── CHAMAR GARÇOM ──
  socket.on('chamar_garcom', (data) => {
    const d = data || {};
    const id = d.id || null;
    const productName = d.productName || d.mensagem || 'Garçom chamado';
    const quantity = d.quantity || 1;
    const localName = d.localName || d.nome || 'PDV Mobile';
    const userName = d.userName || 'PDV Mobile';
    const clienteNome = d.clienteNome || '';
    const now = Date.now();
    if (socket._lastChamarTime && (now - socket._lastChamarTime) < 3000) return;
    socket._lastChamarTime = now;
    const lastCall = chamarTimestamps[id];
    const isReChamado = lastCall && (now - lastCall) < 10000;
    chamarTimestamps[id] = now;
    if (!id) {
      const entry = { id: 'pdv_' + now, localName, productName, quantity, userName, clienteNome, tipo: 'pdv', criadoEm: now, status: 'Pronto', targetGarcom: d.targetGarcom || null };
      if (!isReChamado) pdvCalls.push(entry);
      io.emit('notificacao_garcom', Object.assign({}, entry, { reChamado: isReChamado }));
      if (!isReChamado) sendPush('garcom', '🔔 Garçom Chamado!', `${quantity}x ${productName} — ${localName}${clienteNome ? ' (' + clienteNome + ')' : ''}`, 'chamar-pdv-' + now, '/garcom.html');
      _broadcastPedidos();
    } else {
      io.emit('notificacao_garcom', { id, productName, quantity, localName, userName, clienteNome, tipo: 'chamada', reChamado: isReChamado, targetGarcom: d.targetGarcom || null });
      if (!isReChamado) {
        sendPush('garcom', '🔔 Garçom Chamado!', `${quantity}x ${productName} — ${localName}${clienteNome ? ' (' + clienteNome + ')' : ''}`, 'chamar-' + id, '/garcom.html');
        db.run(`UPDATE pedidos SET garcom_call = datetime('now', 'localtime') WHERE id = ?`, [id]);
        _broadcastPedidos();
      }
    }
  });

  // ── GARÇOM BUSCANDO ──
  socket.on('garcom_buscando', ({ pedidoId, garcomNome, localName, productName }) => {
    if (typeof pedidoId === 'number' || !isNaN(pedidoId)) {
      db.run(`UPDATE pedidos SET garcom_call = NULL WHERE id = ?`, [pedidoId], function () {
        io.emit('garcom_buscando', { pedidoId, garcomNome, localName, productName });
      });
    } else {
      io.emit('garcom_buscando', { pedidoId, garcomNome, localName, productName });
    }
  });

  // ── GARÇOM ACEITOU CHAMADO ──
  socket.on('garcom_aceitou_chamado', ({ localName, garcomNome }) => {
    io.to(`mesa_${localName}`).emit('garcom_chegando', { garcomNome, localName });
    io.emit('notificacao_garcom', { productName: `${garcomNome} aceitou`, localName, userName: 'Sistema', tipo: 'aceite' });
  });

  // ── CLIENTE NA MESA (join room) ──
  socket.on('cliente_na_mesa', (localName) => {
    if (localName) socket.join(`mesa_${localName}`);
  });

  // ── VERIFICAR CONFLITO DE MESA ──
  socket.on('verificar_mesa_conflict', ({ mesa, clienteId }, cb) => {
    if (!mesa) return cb && cb({ conflict: false });
    db.get(`SELECT cliente_nome, cliente_id FROM mesa_clientes WHERE mesa = ?`, [mesa], (err, row) => {
      if (err || !row) return cb && cb({ conflict: false });
      if (row.cliente_id && clienteId && row.cliente_id === clienteId) return cb && cb({ conflict: false });
      if (row.cliente_nome) return cb && cb({ conflict: true, ocupadoPor: row.cliente_nome });
      cb && cb({ conflict: false });
    });
  });

  // ── CLIENTE ENTROU NA MESA (QR) ──
  socket.on('cliente_entrou_mesa', ({ mesa, cliente }) => {
    if (!mesa || !cliente || !cliente.nome) return;
    db.run(
      `INSERT INTO mesa_clientes (mesa, cliente_id, cliente_nome, cliente_telefone, updated_at) VALUES (?, ?, ?, ?, datetime('now', 'localtime'))
       ON CONFLICT(mesa) DO UPDATE SET cliente_id = excluded.cliente_id, cliente_nome = excluded.cliente_nome, cliente_telefone = excluded.cliente_telefone, updated_at = datetime('now', 'localtime')`,
      [mesa, cliente.id || null, cliente.nome, cliente.telefone || ''],
      (err) => {
        if (err) return console.error('[Mesa Cliente] Erro ao associar cliente à mesa:', err);
        _broadcastMesaClientes();
        db.run(`UPDATE mesas SET status = 'Ocupada' WHERE nome = ? AND status IN ('Disponível','Disponivel')`, [mesa], () => {
          db.all(`SELECT * FROM mesas`, (e, rows) => io.emit('mesas_atualizadas', rows || []));
        });
      }
    );
  });

  // ── CAIXA AVISAR CLIENTE ──
  socket.on('caixa_avisar_cliente', ({ mesaName, titulo, mensagem }, cb) => {
    if (!mesaName || !mensagem || !String(mensagem).trim()) return cb && cb({ ok: false });
    if (!exigirAuthSocket(socket)) return cb && cb({ ok: false, erro: 'sem_auth' });
    _avisarClienteMesa(mesaName, { tipo: 'mensagem', titulo: titulo || 'Aviso do Caixa', mensagem: String(mensagem).trim() }, (ok, id) => {
      cb && cb({ ok: !!ok, id });
    });
  });

  // ── ALERTAS: MARCAR ENTREGUES ──
  socket.on('alerta_marcar_entregues', (ids) => {
    if (!Array.isArray(ids) || !ids.length) return;
    const safe = ids.map(Number).filter(n => Number.isInteger(n) && n > 0);
    if (!safe.length) return;
    db.run(`UPDATE alertas_cliente SET entregue = 1 WHERE id IN (${safe.map(() => '?').join(',')})`, safe);
  });

  // ── BUSCAR CLIENTE POR TELEFONE ──
  socket.on('buscar_cliente_telefone', (telefone) => {
    if (!telefone) return;
    const q = String(telefone).trim();
    const cleanPhone = q.replace(/\D/g, '');
    db.get(`SELECT nome FROM clientes WHERE telefone = ? OR telefone LIKE ? OR id IN (SELECT id FROM clientes WHERE REPLACE(REPLACE(REPLACE(REPLACE(telefone, ' ', ''), '-', ''), '(', ''), ')', '') = ?) OR nome LIKE ? LIMIT 1`, [q, `%${cleanPhone}`, cleanPhone, `%${q}%`], (err, row) => {
      socket.emit('resultado_cliente_telefone', row || null);
      socket.emit('cliente_telefone_encontrado', { telefone: q, nome: row ? row.nome : null });
    });
  });

  // ── ATUALIZAR STATUS DA MESA ──
  socket.on('atualizar_status_mesa', ({ nome, status, observacao }) => {
    if (!nome) return;
    if (status === 'Disponível' && mesasFechando) {
      mesasFechando.delete(nome);
      io.emit('sync_mesas_fechando', Array.from(mesasFechando));
    }
    let query = `UPDATE mesas SET status = ?`;
    let params = [status];
    if (observacao !== undefined) {
      query += `, observacao = ?`;
      params.push(observacao);
    }
    query += ` WHERE nome = ?`;
    params.push(nome);
    db.run(query, params, () => {
      db.all(`SELECT * FROM mesas`, (e, rows) => io.emit('mesas_atualizadas', rows || []));
    });
  });
};
