/**
 * Plugin: rh — Recursos Humanos / Folha de Pagamento
 * Consolidado a partir de server.js:
 *   - sockets RH (pontos, vales, pagamentos, dias atípicos, consumo, gerência)
 *   - REST de extrato/pagamentos (migrou para cá)
 */
const bcrypt = require('bcrypt');

module.exports = function({ app, db, io, options, log }) {
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

  log('REST endpoints registered.');
};

// ══════════════════════════════════════════════════════════════
// SOCKET HANDLERS — chamado por server.js dentro de io.on('connection')
// ══════════════════════════════════════════════════════════════
module.exports.registerRhSockets = function(socket, ctx) {
  const { db, io, masterDb, activeSockets, getPontoToken, getLocalTimestamp, getLocalDateOnly, safeFloat, isValidId } = ctx;

  // ── BATER PONTO (entrada/saída via QR Code) ──
  socket.on('bater_ponto', ({ funcionario_id, acao, token }) => {
    if (token !== getPontoToken()) { return socket.emit('bater_ponto_error', 'QR Code expirado ou inválido! Escaneie novamente no Caixa.'); }
    const hoje = getLocalDateOnly();
    const agora = getLocalTimestamp();

    if (acao === 'entrada') {
      db.run(`INSERT INTO pontos (funcionario_id, entrada, data) VALUES (?, ?, ?)`, [funcionario_id, agora, hoje], function (err) {
        if (!err) socket.emit('ponto_registrado', { id: this.lastID, acao });
      });
    } else if (acao === 'saida') {
      db.get(`SELECT p.*, f.valor_hora, f.tipo_remuneracao, f.valor_dia, f.valor_semana, f.valor_mes FROM pontos p JOIN funcionarios f ON p.funcionario_id = f.id WHERE p.funcionario_id = ? AND p.saida IS NULL ORDER BY p.id DESC LIMIT 1`, [funcionario_id], (err, row) => {
        if (err) {
          return socket.emit('bater_ponto_error', 'Erro ao buscar ponto em aberto: ' + err.message);
        }
        if (row) {
          const t1 = new Date(row.entrada).getTime();
          const t2 = new Date(agora).getTime();
          const horasTrabalhadas = (t2 - t1) / (1000 * 60 * 60);

          let valorPagar = 0;
          const tipoRem = row.tipo_remuneracao || 'hora';
          if (tipoRem === 'hora') {
            valorPagar = horasTrabalhadas * (row.valor_hora || 0);
          } else if (tipoRem === 'dia') {
            valorPagar = row.valor_dia || 0;
          } else if (tipoRem === 'semana') {
            valorPagar = (row.valor_semana || 0) / 6;
          } else if (tipoRem === 'mes') {
            valorPagar = (row.valor_mes || 0) / 26;
          }

          db.run(`UPDATE pontos SET saida = ?, total_horas = ?, valor_pagar = ? WHERE id = ?`, [agora, horasTrabalhadas, valorPagar, row.id], (err2) => {
            if (!err2) {
              socket.emit('ponto_registrado', { id: row.id, acao, horasTrabalhadas, valorPagar });
            } else {
              socket.emit('bater_ponto_error', 'Erro ao registrar saída: ' + err2.message);
            }
          });
        } else {
          socket.emit('bater_ponto_error', 'Nenhuma entrada em aberto encontrada para registrar a saída.');
        }
      });
    }
  });

  // ── MÉTRICAS DO FUNCIONÁRIO ──
  socket.on('get_metricas_funcionario', (funcionario_id) => {
    db.all(`SELECT * FROM pontos WHERE funcionario_id = ? ORDER BY id DESC`, [funcionario_id], (err, pontos) => {
      if (err) {
        console.error('Error fetching pontos:', err);
        socket.emit('metricas_funcionario_response', { pontos: [], vales: [], pagamentos: [] });
        return;
      }
      db.all(`SELECT * FROM vales WHERE funcionario_id = ? ORDER BY id DESC`, [funcionario_id], (err2, vales) => {
        if (err2) {
          console.error('Error fetching vales:', err2);
          socket.emit('metricas_funcionario_response', { pontos: pontos || [], vales: [], pagamentos: [] });
          return;
        }
        db.all(`SELECT * FROM funcionarios_pagamentos WHERE funcionario_id = ? ORDER BY data_pagamento DESC`, [funcionario_id], (err3, pagamentos) => {
          socket.emit('metricas_funcionario_response', { pontos: pontos || [], vales: vales || [], pagamentos: pagamentos || [] });
        });
      });
    });
  });

  // ── SOLICITAR VALE ──
  socket.on('solicitar_vale', ({ funcionario_id, valor, motivo }) => {
    const agora = getLocalTimestamp();
    const obs = motivo ? String(motivo).trim().substring(0, 30) : '';
    db.run(`INSERT INTO vales (funcionario_id, data_pedido, valor, status, observacao) VALUES (?, ?, ?, 'Pendente', ?)`,
      [funcionario_id, agora, valor, obs], function (err) {
      if (!err) {
        socket.emit('vale_solicitado_success');
      } else {
        console.error('Error requesting vale:', err);
        socket.emit('bater_ponto_error', 'Erro ao solicitar vale: ' + err.message);
      }
    });
  });

  // ── DEFINIR PIN DO FUNCIONÁRIO ──
  socket.on('definir_meu_pin', ({ funcionario_id, pin }) => {
    if (!isValidId(funcionario_id) || !pin || pin.length < 4 || pin.length > 6 || !/^\d+$/.test(pin)) {
      return socket.emit('definir_pin_error', 'PIN inválido. Deve conter de 4 a 6 números.');
    }
    bcrypt.hash(pin, 10).then(hash => {
      db.run(`UPDATE funcionarios SET pin_hash = ? WHERE id = ?`, [hash, funcionario_id], (err) => {
        if (err) return socket.emit('definir_pin_error', 'Erro ao salvar PIN no servidor.');
        socket.emit('definir_pin_success', 'PIN salvo com sucesso! Você já pode usar seu PIN para entrar.');
      });
    }).catch(e => {
      socket.emit('definir_pin_error', 'Erro ao processar PIN.');
    });
  });

  // ── ATUALIZAR VALOR HORA ──
  socket.on('update_valor_hora', ({ funcionario_id, valor_hora }) => {
    db.run(`UPDATE funcionarios SET valor_hora = ? WHERE id = ?`, [valor_hora, funcionario_id], (err) => {
      if (!err) socket.emit('update_valor_hora_success');
    });
  });

  // ══════════════════════════════════════════════
  // ADMIN RH (dados agregados + ações de aprovação)
  // ══════════════════════════════════════════════

  socket.on('get_rh_data', () => {
    const valesQuery = "SELECT v.*, f.nome as funcionario_nome FROM vales v JOIN funcionarios f ON v.funcionario_id = f.id ORDER BY v.data_pedido DESC";
    const pontosQuery = "SELECT p.*, f.nome as funcionario_nome FROM pontos p JOIN funcionarios f ON p.funcionario_id = f.id ORDER BY p.entrada DESC";
    const loginsQuery = "SELECT * FROM historico_logins ORDER BY data_hora DESC LIMIT 100";
    const funcQuery = "SELECT id, nome, cargo FROM funcionarios WHERE status = 'Ativo'";
    const pedidosQuery = "SELECT userName, total, status FROM pedidos";
    const pagamentosQuery = "SELECT p.*, f.nome as funcionario_nome FROM funcionarios_pagamentos p JOIN funcionarios f ON p.funcionario_id = f.id ORDER BY p.data_pagamento DESC";

    db.all(valesQuery, (errV, vales) => {
      db.all(pontosQuery, (errP, pontos) => {
        db.all(loginsQuery, (errL, logins) => {
          db.all(funcQuery, (errF, funcs) => {
            db.all(pedidosQuery, (errPed, allPedidos) => {
              db.all(pagamentosQuery, (errPag, pagamentos) => {
                // Calculate metrics for each active employee
                const metrics = (funcs || []).map(f => {
                  const employeePontos = (pontos || []).filter(p => p.funcionario_id === f.id);
                  const totalHours = employeePontos.reduce((acc, p) => acc + (p.total_horas || 0), 0);

                  const employeePedidos = (allPedidos || []).filter(p => p.userName === f.nome);
                  const totalOrders = employeePedidos.length;
                  const totalSales = employeePedidos
                    .filter(p => p.status !== 'Cancelado')
                    .reduce((acc, p) => acc + (parseFloat(String(p.total).replace(',', '.')) || 0), 0);

                  return {
                    id: f.id,
                    nome: f.nome,
                    cargo: f.cargo,
                    horas_trabalhadas: totalHours,
                    total_pedidos: totalOrders,
                    total_vendas: totalSales,
                    produtividade: totalHours > 0 ? (totalOrders / totalHours) : 0
                  };
                });

                socket.emit('rh_data', {
                  vales: vales || [],
                  pontos: pontos || [],
                  logins: logins || [],
                  pagamentos: pagamentos || [],
                  metrics: metrics
                });
              });
            });
          });
        });
      });
    });
  });

  socket.on('aprovar_vale', (data) => {
    const { valeId, lancarCaixa, operador } = data;
    db.get("SELECT * FROM vales WHERE id = ?", [valeId], (err, vale) => {
      if (vale && vale.status === 'Pendente') {
        db.run("UPDATE vales SET status = 'Aprovado', data_aprovacao = datetime('now') WHERE id = ?", [valeId], (errU) => {
          if (!errU) {
            if (lancarCaixa) {
              // Gerar saída no caixa
              db.get("SELECT id FROM turnos_caixa WHERE status = 'Aberto' ORDER BY id DESC LIMIT 1", (errC, turno) => {
                if (turno) {
                  db.run(
                    "INSERT INTO movimentacoes (turno_id, tipo, valor, descricao, data, forma_pagamento) VALUES (?, 'saida', ?, ?, datetime('now'), 'Dinheiro')",
                    [turno.id, vale.valor, "Adiantamento/Vale - Func. ID " + vale.funcionario_id]
                  );
                }
              });
            }
            global.registrarAuditoria(data.operador || 'Admin', 'APROVAR_VALE', `Vale ${valeId} aprovado (R$ ${vale.valor.toFixed(2)})`, 'RH e Pagamentos', 'ALTO');
            // Emit update to all
            io.emit('rh_update');
            io.emit('vale_solicitado_success'); // To trigger refresh on employee panel
          }
        });
      }
    });
  });

  socket.on('recusar_vale', (data) => {
    const valeId = (typeof data === 'object') ? data.id : data;
    const op = (typeof data === 'object') ? data.operador : 'Admin';
    db.run("UPDATE vales SET status = 'Recusado' WHERE id = ?", [valeId], (err) => {
      if (!err) {
        global.registrarAuditoria(op || 'Admin', 'RECUSAR_VALE', `Vale ${valeId} recusado`, 'RH e Pagamentos', 'MEDIO');
        io.emit('rh_update');
        io.emit('vale_solicitado_success');
      }
    });
  });

  socket.on('pagar_ponto', (data) => {
    const pontoId = (typeof data === 'object') ? data.id : data;
    const op = (typeof data === 'object') ? data.operador : 'Admin';
    db.run("UPDATE pontos SET pago = 1 WHERE id = ?", [pontoId], (err) => {
      if (!err) {
        global.registrarAuditoria(op || 'Admin', 'PAGAR_PONTO', `Ponto pago (ID: ${pontoId})`, 'RH e Pagamentos', 'MEDIO');
        io.emit('rh_update');
        io.emit('ponto_registrado', { acao: 'pagamento' }); // to trigger refresh if needed
      }
    });
  });

  // === REGISTRAR PAGAMENTO RÁPIDO COLABORADOR ===
  socket.on('registrar_pagamento_colaborador', (data) => {
    const { funcionario_id, funcionario_nome, valor_bruto, valor_liquido, observacao } = data;
    if (!funcionario_id || !valor_bruto) return;

    const dataPagamento = getLocalTimestamp();

    db.run(
      `INSERT INTO funcionarios_pagamentos (funcionario_id, data_pagamento, valor_bruto, total_vales_abatidos, total_consumo_abatido, valor_liquido, observacao) VALUES (?, ?, ?, 0, 0, ?, ?)`,
      [funcionario_id, dataPagamento, valor_bruto, valor_liquido || valor_bruto, observacao || ''],
      function (err) {
        if (err) {
          console.error('Erro ao registrar pagamento rápido:', err);
          return;
        }
        const pagId = this.lastID;

        global.registrarAuditoria('Admin', 'PAGAMENTO_COLABORADOR', `Pagamento de R$ ${(valor_liquido || valor_bruto).toFixed(2)} para ${funcionario_nome} (ID: ${funcionario_id})`, 'RH e Pagamentos', 'ALTO');

        io.emit('rh_update');

        // Broadcast celebration to ALL connected clients
        io.emit('pagamento_colaborador_celebracao', {
          funcionario_id,
          funcionario_nome,
          valor: valor_liquido || valor_bruto,
          data_pagamento: dataPagamento,
          observacao: observacao || '',
          pagamento_id: pagId
        });
      }
    );
  });

  // ── DIAS ATÍPICOS (admin list) ──
  socket.on('get_dias_atipicos', (filtro) => {
    let query = `SELECT d.*, f.nome as funcionario_nome FROM dias_atipicos d JOIN funcionarios f ON f.id = d.funcionario_id`;
    const params = [];
    const where = [];
    if (filtro && filtro.status) {
      where.push('d.status = ?');
      params.push(filtro.status);
    }
    if (filtro && filtro.funcionario_id) {
      where.push('d.funcionario_id = ?');
      params.push(filtro.funcionario_id);
    }
    if (where.length) query += ' WHERE ' + where.join(' AND ');
    query += ' ORDER BY d.data DESC';
    db.all(query, params, (err, rows) => {
      socket.emit('dias_atipicos_list', rows || []);
    });
  });

  // Admin criar/salvar dia atipico
  socket.on('salvar_dia_atipico', ({ id, funcionario_id, data, valor, justificativa, status }) => {
    if (!isValidId(funcionario_id) && !id) return;
    const agora = getLocalTimestamp();
    if (id) {
      db.run(`UPDATE dias_atipicos SET data = ?, valor = ?, justificativa = ?, status = ? WHERE id = ?`,
        [data, safeFloat(valor, 0, 99999), justificativa || '', status || 'pendente', id], () => {
          socket.emit('dia_atipico_salvo');
        });
    } else {
      db.run(`INSERT INTO dias_atipicos (funcionario_id, data, valor, justificativa, status, created_at) VALUES (?, ?, ?, ?, 'pendente', ?)`,
        [funcionario_id, data, safeFloat(valor, 0, 99999), justificativa || '', agora], function (err) {
          if (!err) socket.emit('dia_atipico_salvo');
        });
    }
  });

  // Admin aprovar/recusar dia atipico / extra
  socket.on('aprovar_dia_atipico', ({ id, forma_pagamento }) => {
    const atipicoId = typeof id === 'object' ? id.id : id;
    const fp = typeof id === 'object' ? (id.forma_pagamento || forma_pagamento) : (forma_pagamento || 'proximo_pagamento');
    if (!isValidId(atipicoId)) return;
    db.run(`UPDATE dias_atipicos SET status = 'aprovado', forma_pagamento = ? WHERE id = ?`, [fp, atipicoId], () => {
      socket.emit('dia_atipico_atualizado');
    });
  });
  socket.on('recusar_dia_atipico', (id) => {
    const atipicoId = typeof id === 'object' ? id.id : id;
    if (!isValidId(atipicoId)) return;
    db.run(`UPDATE dias_atipicos SET status = 'recusado' WHERE id = ?`, [atipicoId], () => {
      socket.emit('dia_atipico_atualizado');
    });
  });

  // Consumo do funcionario - Configuracao (admin)
  socket.on('get_consumo_config', () => {
    db.all(`SELECT c.*, p.nome as produto_nome, p.preco as produto_preco, p.emoji, p.categoria
      FROM funcionario_consumo_config c
      JOIN produtos p ON p.id = c.produto_id
      ORDER BY p.categoria, p.nome`, (err, configs) => {
      db.all(`SELECT id, nome, categoria, preco, emoji FROM produtos WHERE status = 'ativo' ORDER BY categoria, nome`, (err2, produtos) => {
        socket.emit('consumo_config_data', { configs: configs || [], produtos: produtos || [] });
      });
    });
  });

  socket.on('save_consumo_config', ({ produto_id, preco_fixo, desconto_percentual, ativo }) => {
    if (!isValidId(produto_id)) return;
    db.get(`SELECT id FROM funcionario_consumo_config WHERE produto_id = ?`, [produto_id], (err, row) => {
      if (row) {
        db.run(`UPDATE funcionario_consumo_config SET preco_fixo = ?, desconto_percentual = ?, ativo = ? WHERE id = ?`,
          [preco_fixo || null, desconto_percentual || null, ativo ? 1 : 0, row.id], () => {
            socket.emit('consumo_config_saved');
          });
      } else {
        db.run(`INSERT INTO funcionario_consumo_config (produto_id, preco_fixo, desconto_percentual, ativo) VALUES (?, ?, ?, ?)`,
          [produto_id, preco_fixo || null, desconto_percentual || null, ativo ? 1 : 0], () => {
            socket.emit('consumo_config_saved');
          });
      }
    });
  });

  // ══════════════════════════════════════════════
  // PAINEL FUNCIONÁRIO — GERÊNCIA (manager)
  // ══════════════════════════════════════════════

  socket.on('manager_get_team_status', () => {
    db.all(`SELECT id, nome, cargo FROM funcionarios WHERE status = 'Ativo'`, [], (err, funcs) => {
      if (err || !funcs) return socket.emit('manager_team_status', []);
      db.all(`SELECT funcionario_id FROM pontos WHERE saida IS NULL`, [], (errP, pontosAbertos) => {
        const openPointsSet = new Set((pontosAbertos || []).map(p => p.funcionario_id));
        const activeSocketFuncs = new Set(
          Array.from((activeSockets || new Map()).values())
            .filter(conn => conn && conn.user)
            .map(conn => conn.user)
        );
        const result = funcs.map(f => {
          const isOnline = activeSocketFuncs.has(f.nome) || Array.from(io.sockets.sockets.values()).some(s => s.funcionarioId === f.id);
          return {
            id: f.id,
            nome: f.nome,
            cargo: f.cargo,
            online: isOnline,
            ponto_aberto: openPointsSet.has(f.id)
          };
        });
        socket.emit('manager_team_status', result);
      });
    });
  });

  socket.on('manager_get_pending_vales', () => {
    db.all(`SELECT v.*, f.nome as funcionario_nome FROM vales v JOIN funcionarios f ON v.funcionario_id = f.id WHERE v.status = 'Pendente' ORDER BY v.id DESC`, [], (err, vales) => {
      socket.emit('manager_pending_vales', vales || []);
    });
  });

  socket.on('manager_get_calendar_vales', () => {
    db.all(`SELECT v.*, f.nome as funcionario_nome FROM vales v JOIN funcionarios f ON v.funcionario_id = f.id ORDER BY v.data_pedido DESC`, [], (err, vales) => {
      socket.emit('manager_calendar_vales', vales || []);
    });
  });

  socket.on('manager_aprovar_vale', ({ id }) => {
    if (!['Gerente', 'Admin', 'Administrador', 'adm'].includes(socket.funcionarioCargo)) {
      return socket.emit('erro_caixa', 'Apenas gerentes ou administradores podem aprovar vales.');
    }
    db.get("SELECT * FROM vales WHERE id = ?", [id], (err, vale) => {
      if (vale && vale.status === 'Pendente') {
        db.run("UPDATE vales SET status = 'Aprovado', data_aprovacao = datetime('now') WHERE id = ?", [id], (errU) => {
          if (!errU) {
            db.get("SELECT id FROM turnos_caixa WHERE status = 'Aberto' ORDER BY id DESC LIMIT 1", (errC, turno) => {
              if (turno) {
                db.run(
                  "INSERT INTO movimentacoes (turno_id, tipo, valor, descricao, data, forma_pagamento) VALUES (?, 'saida', ?, ?, datetime('now'), 'Dinheiro')",
                  [turno.id, vale.valor, "Adiantamento/Vale - Func. ID " + vale.funcionario_id]
                );
              }
            });
            socket.emit('manager_vale_atualizado');
            io.emit('vale_solicitado_success');
            io.emit('rh_update');
          }
        });
      }
    });
  });

  socket.on('manager_recusar_vale', ({ id }) => {
    if (!['Gerente', 'Admin', 'Administrador', 'adm'].includes(socket.funcionarioCargo)) {
      return socket.emit('erro_caixa', 'Apenas gerentes ou administradores podem recusar vales.');
    }
    db.run("UPDATE vales SET status = 'Recusado' WHERE id = ?", [id], (err) => {
      if (!err) {
        socket.emit('manager_vale_atualizado');
        io.emit('vale_solicitado_success');
        io.emit('rh_update');
      }
    });
  });
};
