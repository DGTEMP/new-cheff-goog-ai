const io = require('socket.io-client');
const socket = io('http://localhost:3000', { query: { token: localStorage.getItem('chef_token') } });
socket.on('connect', () => {
  socket.emit('get_estado_caixa');
});
socket.on('estado_caixa', (turno) => {
  console.log('Recebido estado_caixa:', turno);
  process.exit(0);
});
