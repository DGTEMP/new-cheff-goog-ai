import codecs
path = r'c:\Users\computer\Desktop\chef cozinha\server.js'

with codecs.open(path, 'r', 'utf-8') as f:
    content = f.read()

games_code = '''
  // --- GAMIFICACAO / JOGOS DE MESA ---
  socket.on('game_create_lobby', (data) => {
    const roomId = socketTenantId + '_' + data.mesa;
    const cid = data.cliente_id || socket.id;
    
    let initialState = {};
    if (data.type === 'velha') initialState = { board: Array(9).fill(null), turn: cid };
    else if (data.type === 'blackjack') initialState = { deck: [], dealerScore: 0, turn: null };
    else if (data.type === 'batata_quente') initialState = { currentHolder: null, timer: null };

    tableGames[roomId] = {
      status: 'waiting', type: data.type, prize: data.prize, host: cid,
      players: { [cid]: { name: data.cliente_nome || 'Cliente 1', id: cid, ready: true, choice: null, actionTime: null, state: {} } },
      winner: null, loser: null, state: initialState
    };
    io.to('restaurante_' + socketTenantId).emit('game_lobby_updated', { mesa: data.mesa, game: tableGames[roomId] });
  });

  socket.on('game_join_lobby', (data) => {
    const roomId = socketTenantId + '_' + data.mesa;
    const game = tableGames[roomId];
    if(game && game.status === 'waiting') {
      const cid = data.cliente_id || socket.id;
      game.players[cid] = { name: data.cliente_nome || 'Cliente', id: cid, ready: true, choice: null, actionTime: null, state: {} };
      
      const pKeys = Object.keys(game.players);
      let startGame = false;
      
      if (['par_impar', 'reflexo', 'velha'].includes(game.type) && pKeys.length >= 2) startGame = true;
      // Para jogos multi-player, precisa de um botao explicito para "Começar" ou começa com >= 2 e alguem clica começar.
      // O host podera emitir um 'game_start' manual.
      
      if(startGame) game.status = 'playing';
      io.to('restaurante_' + socketTenantId).emit('game_lobby_updated', { mesa: data.mesa, game });
    }
  });

  socket.on('game_start', (data) => {
    const roomId = socketTenantId + '_' + data.mesa;
    const game = tableGames[roomId];
    if(game && game.status === 'waiting' && game.host === (data.cliente_id || socket.id)) {
      game.status = 'playing';
      
      if (game.type === 'batata_quente') {
        const pKeys = Object.keys(game.players);
        game.state.currentHolder = pKeys[Math.floor(Math.random() * pKeys.length)];
        const timeToExplode = 15000 + Math.random() * 25000;
        
        setTimeout(() => {
          if (tableGames[roomId] === game && game.status === 'playing') {
            game.status = 'finished';
            game.loser = game.state.currentHolder; // current holder loses
            io.to('restaurante_' + socketTenantId).emit('game_lobby_updated', { mesa: data.mesa, game });
            setTimeout(() => { if(tableGames[roomId] === game) delete tableGames[roomId]; }, 15000);
          }
        }, timeToExplode);
      } else if (game.type === 'roleta_russa' || game.type === 'roleta_consequencias') {
         // Decide instantly
         setTimeout(() => {
           game.status = 'finished';
           const pKeys = Object.keys(game.players);
           game.loser = pKeys[Math.floor(Math.random() * pKeys.length)];
           if (game.type === 'roleta_consequencias') {
             const cons = ['Pagar a conta inteira!', 'Imitar um pinguim', 'Beber um copo de agua de uma vez', 'Pagar a proxima bebida', 'Ficar sem celular por 10 min'];
             game.prize = cons[Math.floor(Math.random() * cons.length)];
           }
           io.to('restaurante_' + socketTenantId).emit('game_lobby_updated', { mesa: data.mesa, game });
           setTimeout(() => { if(tableGames[roomId] === game) delete tableGames[roomId]; }, 15000);
         }, 3000); // 3 seconds spin
      } else if (game.type === 'blackjack') {
         // Deck init
         const suits = ['H', 'D', 'C', 'S'];
         const values = ['2','3','4','5','6','7','8','9','10','J','Q','K','A'];
         let deck = [];
         suits.forEach(s => values.forEach(v => deck.push(v+s)));
         deck = deck.sort(() => Math.random() - 0.5);
         game.state.deck = deck;
         Object.keys(game.players).forEach(p => game.players[p].state.cards = [deck.pop(), deck.pop()]);
      }
      
      io.to('restaurante_' + socketTenantId).emit('game_lobby_updated', { mesa: data.mesa, game });
    }
  });

  socket.on('game_action', (data) => {
    const roomId = socketTenantId + '_' + data.mesa;
    const game = tableGames[roomId];
    if(!game || game.status !== 'playing') return;
    const cid = data.cliente_id || socket.id;
    if(!game.players[cid]) return;

    if (game.type === 'batata_quente') {
      if (game.state.currentHolder === cid) {
         const pKeys = Object.keys(game.players).filter(id => id !== cid);
         game.state.currentHolder = pKeys[Math.floor(Math.random() * pKeys.length)];
         io.to('restaurante_' + socketTenantId).emit('game_lobby_updated', { mesa: data.mesa, game });
      }
      return;
    }

    if (game.type === 'velha') {
      if (game.state.turn !== cid) return;
      if (game.state.board[data.choice] !== null) return;
      
      const pKeys = Object.keys(game.players);
      const isP1 = pKeys[0] === cid;
      game.state.board[data.choice] = isP1 ? 'X' : 'O';
      
      const wins = [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];
      const b = game.state.board;
      let winner = null;
      for (let w of wins) {
         if (b[w[0]] && b[w[0]] === b[w[1]] && b[w[0]] === b[w[2]]) {
            winner = cid; break;
         }
      }
      
      if (winner) {
         game.status = 'finished'; game.winner = winner;
         setTimeout(() => { if(tableGames[roomId] === game) delete tableGames[roomId]; }, 15000);
      } else if (!b.includes(null)) {
         game.status = 'finished'; game.winner = 'draw';
         setTimeout(() => { if(tableGames[roomId] === game) delete tableGames[roomId]; }, 15000);
      } else {
         game.state.turn = isP1 ? pKeys[1] : pKeys[0];
      }
      io.to('restaurante_' + socketTenantId).emit('game_lobby_updated', { mesa: data.mesa, game });
      return;
    }

    // fallback for par_impar and reflexo
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

start_marker = '// --- GAMIFICACAO / JOGOS DE MESA ---'
end_marker = '// --- FIM GAMIFICACAO ---'

start_idx = content.find(start_marker)
end_idx = content.find(end_marker, start_idx)

if start_idx != -1 and end_idx != -1:
    content = content[:start_idx] + games_code.strip() + content[end_idx + len(end_marker):]
    with codecs.open(path, 'w', 'utf-8') as f:
        f.write(content)
    print("Patched successfully!")
else:
    print("Markers not found.")
