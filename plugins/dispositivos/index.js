/**
 * Plugin: dispositivos
 * Gerenciamento de dispositivos conectados (routes + sockets)
 */
module.exports = function({ app, db, io, options, log }) {
  const { verificarToken, activeSockets, getTempoConectadoStr } = options;

  log('Registering routes...');

  app.get('/api/dispositivos', verificarToken, (req, res) => {
    const deviceList = Array.from(activeSockets.values()).map(d => ({
      ...d,
      tempoConectadoStr: getTempoConectadoStr(d.connectedAt)
    }));
    res.json(deviceList);
  });

  app.post('/api/dispositivos/:id/renomear', verificarToken, (req, res) => {
    const { id } = req.params;
    const { novoNome } = req.body || {};
    if (!novoNome) return res.status(400).json({ error: 'Nome é obrigatório' });

    const conn = activeSockets.get(id);
    if (conn) {
      conn.model = novoNome.trim();
      conn.device = `${conn.model} (${conn.os} • ${conn.browser})`;
      const targetSocket = io.sockets.sockets.get(id);
      if (targetSocket) {
        targetSocket.emit('apelido_atualizado_remoto', { apelido: novoNome.trim() });
      }
      io.emit('connected_devices_updated');
      res.json({ success: true });
    } else {
      res.status(404).json({ error: 'Dispositivo não encontrado ou desconectado' });
    }
  });

  app.post('/api/dispositivos/:id/desconectar', verificarToken, (req, res) => {
    const { id } = req.params;
    const targetSocket = io.sockets.sockets.get(id);
    if (targetSocket) {
      targetSocket.emit('sessao_derrubada_remotamente');
      targetSocket.disconnect(true);
      activeSockets.delete(id);
      io.emit('connected_devices_updated');
      res.json({ success: true });
    } else {
      activeSockets.delete(id);
      res.json({ success: true });
    }
  });

  log('Registering sockets...');

  io.on('connection', (socket) => {
    socket.on('get_connected_devices', () => {
      const deviceList = Array.from(activeSockets.values()).map(d => ({
        ...d,
        tempoConectadoStr: getTempoConectadoStr(d.connectedAt)
      }));
      /* Deduplicar por serial: manter apenas a conexão mais recente */
      const bySerial = {};
      const noSerial = [];
      deviceList.forEach(d => {
        if (d.serial) {
          if (!bySerial[d.serial] || d.connectedAt > bySerial[d.serial].connectedAt) {
            bySerial[d.serial] = d;
          }
          if (!bySerial[d.serial]._allSocketIds) bySerial[d.serial]._allSocketIds = [];
          bySerial[d.serial]._allSocketIds.push(d.id);
        } else {
          noSerial.push(d);
        }
      });
      const deduped = [...Object.values(bySerial), ...noSerial];

      const serials = [...new Set(deduped.map(d => d.serial).filter(Boolean))];
      if (!serials.length) return socket.emit('connected_devices', deduped);
      db.all(`SELECT serial, apelido, tipo, modo FROM dispositivos WHERE serial IN (${serials.map(() => '?').join(',')})`, serials, (err, rows) => {
        if (!err && rows) {
          const mapa = {};
          rows.forEach(r => { mapa[r.serial] = r; });
          deduped.forEach(d => {
            if (d.serial && mapa[d.serial]) {
              d.apelido = d.apelido || mapa[d.serial].apelido || '';
              d.tipo = d.tipo || mapa[d.serial].tipo || '';
              d.modo = d.modo || mapa[d.serial].modo || 'normal';
            }
          });
        }
        socket.emit('connected_devices', deduped);
      });
    });
  });

  log('Routes + sockets registered.');
};
