import sys
import codecs

path = r'c:\Users\computer\Desktop\chef cozinha\area-cliente.html'
with codecs.open(path, 'r', 'utf-8') as f:
    content = f.read()

client_games_code = '''
    // --- GAMIFICACAO CLIENTE ---
    let currentGame = null;

    function renderJogosDisponiveis() {
      if (!mesaUrl) {
        document.getElementById('jogos-disponiveis').innerHTML = '<p style="color:#94a3b8; font-size:13px;">Voce precisa estar em uma mesa para jogar.</p>';
        return;
      }
      let html = `
        <div class="pedido-card" style="display:flex; justify-content:space-between; align-items:center;">
          <div><h4 style="margin:0; font-size:15px;"><i class="ph ph-hand-fist"></i> Par ou Impar</h4><p style="margin:0; font-size:12px; color:var(--text-muted);">Decida na sorte!</p></div>
          <button onclick="criarJogo('par_impar')" style="background:var(--primary); border:none; color:white; padding:6px 12px; border-radius:8px; font-weight:bold; cursor:pointer;">Criar</button>
        </div>
        <div class="pedido-card" style="display:flex; justify-content:space-between; align-items:center;">
          <div><h4 style="margin:0; font-size:15px;"><i class="ph ph-lightning"></i> Duelo de Reflexo</h4><p style="margin:0; font-size:12px; color:var(--text-muted);">Quem clicar mais rapido!</p></div>
          <button onclick="criarJogo('reflexo')" style="background:var(--primary); border:none; color:white; padding:6px 12px; border-radius:8px; font-weight:bold; cursor:pointer;">Criar</button>
        </div>
      `;
      document.getElementById('jogos-disponiveis').innerHTML = html;
    }

    function criarJogo(type) {
      const prize = prompt("O que esta valendo? (Ex: Quem perde paga a conta, Paga a proxima cerveja...)");
      if(prize) {
        socket.emit('game_create_lobby', { mesa: mesaUrl, type, prize, cliente_id: clienteAtual?.id || socket.id, cliente_nome: clienteAtual?.nome || 'Convidado' });
      }
    }
    
    function entrarJogo() {
      socket.emit('game_join_lobby', { mesa: mesaUrl, cliente_id: clienteAtual?.id || socket.id, cliente_nome: clienteAtual?.nome || 'Convidado' });
    }

    function jogarParImpar(side, fingers) {
      socket.emit('game_action', { mesa: mesaUrl, cliente_id: clienteAtual?.id || socket.id, choice: { side, fingers } });
    }

    function jogarReflexo() {
      socket.emit('game_action', { mesa: mesaUrl, cliente_id: clienteAtual?.id || socket.id, choice: true });
    }

    socket.on('game_lobby_updated', (data) => {
      if(!data || data.mesa !== mesaUrl) return;
      currentGame = data.game;
      
      const pId = clienteAtual?.id || socket.id;
      
      if(!currentGame) {
        document.getElementById('jogos-partidas-ativas').style.display = 'none';
        document.getElementById('jogos-game-area').style.display = 'none';
        document.getElementById('jogos-disponiveis').style.display = 'grid';
        return;
      }
      
      document.getElementById('jogos-disponiveis').style.display = 'none';
      const isPlayer = !!currentGame.players[pId];

      if (currentGame.status === 'waiting') {
        document.getElementById('jogos-partidas-ativas').style.display = 'block';
        document.getElementById('jogos-game-area').style.display = 'none';
        
        const hostName = Object.values(currentGame.players)[0].name;
        
        let actBtn = isPlayer ? 
          `<button onclick="socket.emit('game_cancel', {mesa: mesaUrl})" style="background:#ef4444; border:none; color:white; padding:8px 16px; border-radius:8px; font-weight:bold; cursor:pointer; margin-top:10px;">Cancelar Desafio</button>` :
          `<button onclick="entrarJogo()" style="background:#10b981; border:none; color:white; padding:8px 16px; border-radius:8px; font-weight:bold; cursor:pointer; margin-top:10px;">Aceitar Desafio!</button>`;
          
        document.getElementById('lista-partidas-ativas').innerHTML = `
          <div class="pedido-card">
            <h4 style="margin:0; font-size:16px;">${currentGame.type === 'par_impar' ? 'Par ou Impar' : 'Duelo de Reflexo'}</h4>
            <p style="margin:0; font-size:13px; color:var(--text-muted);">Criado por: ${hostName}</p>
            <p style="margin:4px 0 0 0; font-size:14px; font-weight:bold; color:#f59e0b;">Valendo: ${currentGame.prize}</p>
            ${actBtn}
          </div>
        `;
      } 
      else if (currentGame.status === 'playing') {
        document.getElementById('jogos-partidas-ativas').style.display = 'none';
        document.getElementById('jogos-game-area').style.display = 'block';
        
        document.getElementById('jogos-game-header').innerHTML = `
          <h4 style="margin:0; font-size:18px;">${currentGame.type === 'par_impar' ? 'Par ou Impar' : 'Reflexo'}</h4>
          <span style="font-size:12px; background:var(--primary); padding:2px 8px; border-radius:4px; font-weight:bold;">Valendo: ${currentGame.prize}</span>
        `;
        
        if(!isPlayer) {
          document.getElementById('jogos-game-content').innerHTML = '<p style="text-align:center;">Partida em andamento entre outros clientes...</p>';
          document.getElementById('jogos-game-actions').innerHTML = '';
          return;
        }
        
        const myChoice = currentGame.players[pId].choice;
        
        if (currentGame.type === 'par_impar') {
           if(myChoice) {
             document.getElementById('jogos-game-content').innerHTML = `<h3 style="text-align:center; color:white;">Aguardando oponente...</h3>`;
             document.getElementById('jogos-game-actions').innerHTML = '';
           } else {
             document.getElementById('jogos-game-content').innerHTML = `<h3 style="text-align:center; color:white;">Faca sua jogada!</h3>`;
             document.getElementById('jogos-game-actions').innerHTML = `
               <div style="display:flex; gap:10px; width:100%; justify-content:center; margin-bottom:10px;">
                 <button onclick="window.gameSide='par'" style="flex:1; padding:10px; border-radius:8px; border:1px solid #ccc; background:#222; color:white;">PAR</button>
                 <button onclick="window.gameSide='impar'" style="flex:1; padding:10px; border-radius:8px; border:1px solid #ccc; background:#222; color:white;">IMPAR</button>
               </div>
               <div style="display:flex; gap:5px; width:100%; justify-content:center;">
                 ${[0,1,2,3,4,5].map(n => `<button onclick="if(!window.gameSide){alert('Escolha PAR ou IMPAR primeiro');return;} jogarParImpar(window.gameSide, ${n})" style="padding:10px 15px; border-radius:8px; border:none; background:var(--primary); color:white; font-weight:bold; font-size:18px;">${n}</button>`).join('')}
               </div>
             `;
           }
        } 
        else if (currentGame.type === 'reflexo') {
           if(myChoice) {
             document.getElementById('jogos-game-content').innerHTML = `<h3 style="text-align:center; color:white;">Aguardando oponente...</h3>`;
             document.getElementById('jogos-game-actions').innerHTML = '';
           } else {
             document.getElementById('jogos-game-content').innerHTML = `<div id="reflex-box" style="width:100%; height:150px; background:#ef4444; border-radius:12px; display:flex; align-items:center; justify-content:center;"><h2 style="color:white; margin:0;">Espere ficar VERDE!</h2></div>`;
             document.getElementById('jogos-game-actions').innerHTML = `<button id="btn-reflexo" style="width:100%; padding:15px; font-size:20px; font-weight:bold; background:#333; color:white; border:none; border-radius:12px; cursor:not-allowed;" disabled>Toque aqui!</button>`;
             
             // Random time to turn green
             if(!window.reflexTimeout) {
               window.reflexTimeout = setTimeout(() => {
                 const box = document.getElementById('reflex-box');
                 const btn = document.getElementById('btn-reflexo');
                 if(box && btn) {
                   box.style.background = '#10b981';
                   box.innerHTML = '<h2 style="color:white; margin:0;">AGORA!</h2>';
                   btn.style.background = 'var(--primary)';
                   btn.disabled = false;
                   btn.style.cursor = 'pointer';
                   btn.onclick = jogarReflexo;
                 }
               }, 2000 + Math.random() * 4000);
             }
           }
        }
      } 
      else if (currentGame.status === 'finished') {
        document.getElementById('jogos-partidas-ativas').style.display = 'none';
        document.getElementById('jogos-game-area').style.display = 'block';
        window.reflexTimeout = null;
        
        const isWinner = currentGame.winner === pId;
        const winnerName = currentGame.players[currentGame.winner]?.name || 'Alguem';
        
        document.getElementById('jogos-game-content').innerHTML = `
          <div style="text-align:center;">
            <i class="${isWinner ? 'ph-fill ph-trophy' : 'ph-fill ph-smiley-sad'}" style="font-size:60px; color:${isWinner ? '#f59e0b' : '#94a3b8'}; margin-bottom:15px;"></i>
            <h2 style="color:white; margin:0 0 10px 0;">${isWinner ? 'VOCE VENCEU!' : 'VOCE PERDEU...'}</h2>
            <p style="color:var(--text-muted); font-size:14px; margin:0;">${isWinner ? 'Parabens, voce ganhou o desafio!' : winnerName + ' foi o vencedor.'}</p>
            <div style="margin-top:15px; padding:10px; background:rgba(255,255,255,0.1); border-radius:8px;">
              <span style="font-weight:bold; font-size:12px; color:#f59e0b;">Premio: ${currentGame.prize}</span>
            </div>
          </div>
        `;
        document.getElementById('jogos-game-actions').innerHTML = '';
        
        // Add to history
        const hList = document.getElementById('lista-jogos-historico');
        const div = document.createElement('div');
        div.className = 'pedido-card';
        div.innerHTML = `<h4 style="margin:0; font-size:14px;">${currentGame.type}</h4><p style="margin:0; font-size:12px; color:var(--text-muted);">Vencedor: ${winnerName} | Premio: ${currentGame.prize}</p>`;
        hList.prepend(div);
      }
    });

    // Check games on connect
    socket.on('connect', () => {
      if(mesaUrl) socket.emit('get_table_game', { mesa: mesaUrl });
      renderJogosDisponiveis();
    });
    // --- FIM GAMIFICACAO CLIENTE ---
'''

idx = content.find('// Check games on connect')
if idx == -1:
    insert_point = content.find('</script>\n</body>')
    if insert_point != -1:
        content = content[:insert_point] + client_games_code + '\n' + content[insert_point:]
        with codecs.open(path, 'w', 'utf-8') as f:
            f.write(content)
        print('Client JS patched successfully!')
else:
    print('Already patched.')
