import sys
import codecs

path = r'c:\Users\computer\Desktop\chef cozinha\server.js'
with codecs.open(path, 'r', 'utf-8') as f:
    content = f.read()

# Add tableGames declaration
if 'let tableGames = {};' not in content:
    content = content.replace('const pendingLogs = [];', 'const pendingLogs = [];\nlet tableGames = {};')

games_code = '''
  // --- GAMIFICACAO / JOGOS DE MESA ---
  socket.on('game_create_lobby', (data) => {
    const roomId = socketTenantId + '_' + data.mesa;
    const cid = data.cliente_id || socket.id;
    tableGames[roomId] = {
      status: 'waiting', type: data.type, prize: data.prize, host: cid,
      players: { [cid]: { name: data.cliente_nome || 'Cliente 1', id: cid, ready: true, choice: null, actionTime: null } },
      winner: null
    };
    io.to('restaurante_' + socketTenantId).emit('game_lobby_updated', { mesa: data.mesa, game: tableGames[roomId] });
  });

  socket.on('game_join_lobby', (data) => {
    const roomId = socketTenantId + '_' + data.mesa;
    const game = tableGames[roomId];
    if(game && game.status === 'waiting') {
      const cid = data.cliente_id || socket.id;
      game.players[cid] = { name: data.cliente_nome || 'Cliente 2', id: cid, ready: true, choice: null, actionTime: null };
      if(Object.keys(game.players).length >= 2) game.status = 'playing';
      io.to('restaurante_' + socketTenantId).emit('game_lobby_updated', { mesa: data.mesa, game });
    }
  });

  socket.on('game_action', (data) => {
    const roomId = socketTenantId + '_' + data.mesa;
    const game = tableGames[roomId];
    if(!game || game.status !== 'playing') return;
    const cid = data.cliente_id || socket.id;
    if(game.players[cid]) {
      game.players[cid].choice = data.choice;
      game.players[cid].actionTime = Date.now();
      const pKeys = Object.keys(game.players);
      const allPlayed = pKeys.every(k => game.players[k].choice !== null);
      if(allPlayed) {
        game.status = 'finished';
        if(game.type === 'par_impar') {
          const p1 = game.players[pKeys[0]]; const p2 = game.players[pKeys[1]];
          const isPar = ((p1.choice.fingers || 0) + (p2.choice.fingers || 0)) % 2 === 0;
          game.winner = (p1.choice.side === 'par' && isPar) || (p1.choice.side === 'impar' && !isPar) ? p1.id : p2.id;
        } else if (game.type === 'reflexo') {
          const p1 = game.players[pKeys[0]]; const p2 = game.players[pKeys[1]];
          game.winner = p1.actionTime < p2.actionTime ? p1.id : p2.id;
        }
        io.to('restaurante_' + socketTenantId).emit('game_lobby_updated', { mesa: data.mesa, game });
        setTimeout(() => {
          if(tableGames[roomId] === game) delete tableGames[roomId];
          io.to('restaurante_' + socketTenantId).emit('game_lobby_updated', { mesa: data.mesa, game: null });
        }, 15000);
      }
    }
  });
  
  socket.on('game_cancel', (data) => {
    const roomId = socketTenantId + '_' + data.mesa;
    if(tableGames[roomId]) { delete tableGames[roomId]; io.to('restaurante_' + socketTenantId).emit('game_lobby_updated', { mesa: data.mesa, game: null }); }
  });

  socket.on('get_table_game', (data) => {
    const roomId = socketTenantId + '_' + data.mesa;
    socket.emit('game_lobby_updated', { mesa: data.mesa, game: tableGames[roomId] || null });
  });
  // --- FIM GAMIFICACAO ---
'''

idx = content.find("io.on('connection', (socket) => {")
if idx != -1 and 'game_create_lobby' not in content:
    insert_point = content.find("if (!socket.auth) {", idx)
    if insert_point != -1:
        content = content[:insert_point] + games_code + '\n  ' + content[insert_point:]

with codecs.open(path, 'w', 'utf-8') as f:
    f.write(content)

print('Server JS patched successfully!')
