// Fila de Espera de Clientes por Mesas
module.exports = function(socket, io, db, helpers) {
  const ATIVOS = "status != 'Acomodado' AND status != 'Concluido' AND status != 'Cancelado'";

  function emitirFila(alvo) {
    const q = `SELECT * FROM fila_espera WHERE ${ATIVOS} ORDER BY criado_em ASC, id ASC`;
    db.all(q, (err, rows) => {
      const data = rows || [];
      if (alvo === 'broadcast') {
        io.emit('fila_espera_atualizada', data);
      } else if (alvo) {
        alvo.emit('fila_espera_atualizada', data);
      }
    });
  }

  socket.on('get_fila_espera', () => emitirFila(socket));

  socket.on('adicionar_fila_espera', (d) => {
    if (!d) return;
    const cliente_nome = String(d.cliente_nome || '').trim();
    if (!cliente_nome) return;
    const cliente_telefone = String(d.cliente_telefone || '').trim();
    const pessoas = parseInt(d.pessoas) || 2;
    const mesa_preferida = String(d.mesa_preferida || '').trim();
    const observacao = String(d.observacao || '').trim();
    db.run(
      `INSERT INTO fila_espera (cliente_nome, cliente_telefone, pessoas, mesa_preferida, observacao, status)
       VALUES (?, ?, ?, ?, ?, 'Esperando')`,
      [cliente_nome, cliente_telefone, pessoas, mesa_preferida, observacao],
      (err) => { if (!err) emitirFila('broadcast'); }
    );
  });

  socket.on('remover_fila_espera', (id) => {
    const pid = parseInt(id);
    if (!pid) return;
    db.run(`DELETE FROM fila_espera WHERE id = ?`, [pid], (err) => {
      if (!err) emitirFila('broadcast');
    });
  });

  socket.on('atualizar_status_fila_espera', (d) => {
    if (!d) return;
    const pid = parseInt(d.id);
    if (!pid) return;
    const status = String(d.status || '').slice(0, 50);
    if (!status) return;
    db.run(
      `UPDATE fila_espera SET status = ?, atualizado_em = datetime('now', 'localtime') WHERE id = ?`,
      [status, pid],
      (err) => { if (!err) emitirFila('broadcast'); }
    );
  });

  socket.on('acomodar_cliente_fila', (d) => {
    if (!d) return;
    const pid = parseInt(d.id);
    if (!pid) return;
    const mesaName = String(d.mesaName || '').trim();

    if (d.autoOffer) {
      // MODO AUTOMATICO: sempre oferta ao cliente
      const offerMesa = mesaName || null;
      if (!offerMesa) {
        // Se nao veio mesa, busca primeira disponivel
        db.get(`SELECT nome, id FROM mesas WHERE status = 'Disponível' OR status = 'Livre' ORDER BY id ASC LIMIT 1`, [], (errM, freeTable) => {
          const foundMesa = (freeTable && (freeTable.nome || freeTable.id)) ? (freeTable.nome || freeTable.id) : null;
          if (foundMesa) {
            db.run(
              `UPDATE fila_espera SET status = 'Mesa Ofertada', mesa_ofertada = ?, atualizado_em = datetime('now', 'localtime') WHERE id = ?`,
              [foundMesa, pid],
              (err) => { if (!err) emitirFila('broadcast'); }
            );
          } else {
            socket.emit('fila_erro', 'Nenhuma mesa livre disponivel no momento.');
          }
        });
      } else {
        db.run(
          `UPDATE fila_espera SET status = 'Mesa Ofertada', mesa_ofertada = ?, atualizado_em = datetime('now', 'localtime') WHERE id = ?`,
          [offerMesa, pid],
          (err) => { if (!err) emitirFila('broadcast'); }
        );
      }
    } else {
      // MODO MANUAL SEM AUTO: acomodacao direta (caixa escolheu a mesa)
      executarAcomodacaoDireta(pid, mesaName);
    }
  });

  function executarAcomodacaoDireta(pid, mesaName) {
    db.run(
      `UPDATE fila_espera SET status = 'Acomodado', mesa_acomodado = ?, atualizado_em = datetime('now', 'localtime') WHERE id = ?`,
      [mesaName, pid],
      (err) => {
        if (!err) {
          emitirFila('broadcast');
          if (mesaName) {
            db.run(`UPDATE mesas SET status = 'Ocupada' WHERE nome = ? OR id = ?`, [mesaName, mesaName], (errMesa) => {
              if (!errMesa) {
                io.emit('status_mesa_alterado', { nome: mesaName, status: 'Ocupada' });
                db.all('SELECT * FROM mesas', [], (errAll, allMesas) => {
                  if (!errAll && allMesas) io.emit('mesas_atualizadas', allMesas);
                });
              }
            });
          }
        }
      }
    );
  }

  // Cliente aceitou a oferta de mesa no celular
  socket.on('cliente_aceitou_mesa_fila', (d) => {
    if (!d) return;
    const pid = parseInt(d.id);
    const mesaName = String(d.mesaName || '').trim();
    if (!pid || !mesaName) return;
    executarAcomodacaoDireta(pid, mesaName);
  });

  // Cliente recusou a oferta de mesa no celular (passa a mesa pro próximo da fila)
  socket.on('cliente_recusou_mesa_fila', (d) => {
    if (!d) return;
    const pid = parseInt(d.id);
    const mesaName = String(d.mesaName || '').trim();
    if (!pid) return;

    db.run(`UPDATE fila_espera SET status = 'Esperando', mesa_ofertada = NULL WHERE id = ?`, [pid], (err) => {
      if (!err) {
        if (mesaName) {
          // Oferta a mesa para o PRÓXIMO cliente da fila
          db.get(`SELECT * FROM fila_espera WHERE ${ATIVOS} AND id != ? AND (mesa_ofertada IS NULL OR mesa_ofertada = '') ORDER BY criado_em ASC, id ASC LIMIT 1`, [pid], (errN, nextRow) => {
            if (!errN && nextRow) {
              db.run(`UPDATE fila_espera SET status = 'Mesa Ofertada', mesa_ofertada = ? WHERE id = ?`, [mesaName, nextRow.id], () => {
                emitirFila('broadcast');
              });
            } else {
              emitirFila('broadcast');
            }
          });
        } else {
          emitirFila('broadcast');
        }
      }
    });
  });
};
