/**
 * Backend do Módulo: Balança Comercial (balanca)
 */
module.exports = function ({ app, db, masterDb, io, options, log }) {
  log('Inicializando backend do módulo Balança Comercial...');

  // Rota de exemplo (automaticamente protegida por moduloGuard)
  app.get('/api/modulo/balanca/status', (req, res) => {
    res.json({
      modulo: 'balanca',
      nome: 'Balança Comercial',
      status: 'ativo',
      timestamp: Date.now()
    });
  });

  // Socket listener de exemplo
  io.on('connection', (socket) => {
    socket.on('modulo_balanca_ping', (data) => {
      socket.emit('modulo_balanca_pong', { status: 'ok', data });
    });
  });
};
