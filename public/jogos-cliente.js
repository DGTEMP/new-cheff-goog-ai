// --- GAMIFICACAO CLIENTE ---
let currentGame = null;

function renderJogosDisponiveis() {
  if (typeof mesaUrl === 'undefined' || !mesaUrl) {
    document.getElementById('jogos-disponiveis').innerHTML = '<p style="color:#94a3b8; font-size:13px;">Voce precisa estar em uma mesa para jogar.</p>';
    return;
  }
  let html = `
    <div class="pedido-card" style="display:flex; justify-content:space-between; align-items:center;">
      <div><h4 style="margin:0; font-size:15px;"><i class="ph ph-hand-fist"></i> Par ou Impar (2P)</h4><p style="margin:0; font-size:12px; color:var(--text-muted);">Decida na sorte!</p></div>
      <button onclick="criarJogo('par_impar')" style="background:var(--primary); border:none; color:white; padding:6px 12px; border-radius:8px; font-weight:bold; cursor:pointer;">Criar</button>
    </div>
    <div class="pedido-card" style="display:flex; justify-content:space-between; align-items:center;">
      <div><h4 style="margin:0; font-size:15px;"><i class="ph ph-lightning"></i> Duelo de Reflexo (2P)</h4><p style="margin:0; font-size:12px; color:var(--text-muted);">Quem clicar mais rapido!</p></div>
      <button onclick="criarJogo('reflexo')" style="background:var(--primary); border:none; color:white; padding:6px 12px; border-radius:8px; font-weight:bold; cursor:pointer;">Criar</button>
    </div>
    <div class="pedido-card" style="display:flex; justify-content:space-between; align-items:center;">
      <div><h4 style="margin:0; font-size:15px;"><i class="ph ph-hash"></i> Jogo da Velha (2P)</h4><p style="margin:0; font-size:12px; color:var(--text-muted);">Estrategia e paciencia!</p></div>
      <button onclick="criarJogo('velha')" style="background:var(--primary); border:none; color:white; padding:6px 12px; border-radius:8px; font-weight:bold; cursor:pointer;">Criar</button>
    </div>
    <div class="pedido-card" style="display:flex; justify-content:space-between; align-items:center;">
      <div><h4 style="margin:0; font-size:15px;"><i class="ph ph-spades"></i> Blackjack 21 (Mesa)</h4><p style="margin:0; font-size:12px; color:var(--text-muted);">Chegue o mais perto de 21!</p></div>
      <button onclick="criarJogo('blackjack')" style="background:var(--primary); border:none; color:white; padding:6px 12px; border-radius:8px; font-weight:bold; cursor:pointer;">Criar</button>
    </div>
    <div class="pedido-card" style="display:flex; justify-content:space-between; align-items:center;">
      <div><h4 style="margin:0; font-size:15px;"><i class="ph ph-fire"></i> Batata Quente (Mesa)</h4><p style="margin:0; font-size:12px; color:var(--text-muted);">Passe para frente antes do estouro!</p></div>
      <button onclick="criarJogo('batata_quente')" style="background:var(--primary); border:none; color:white; padding:6px 12px; border-radius:8px; font-weight:bold; cursor:pointer;">Criar</button>
    </div>
    <div class="pedido-card" style="display:flex; justify-content:space-between; align-items:center;">
      <div><h4 style="margin:0; font-size:15px;"><i class="ph ph-crosshair"></i> Roleta Russa (Mesa)</h4><p style="margin:0; font-size:12px; color:var(--text-muted);">Sorteio rapido, quem vai pagar?</p></div>
      <button onclick="criarJogo('roleta_russa')" style="background:var(--primary); border:none; color:white; padding:6px 12px; border-radius:8px; font-weight:bold; cursor:pointer;">Criar</button>
    </div>
    <div class="pedido-card" style="display:flex; justify-content:space-between; align-items:center;">
      <div><h4 style="margin:0; font-size:15px;"><i class="ph ph-arrows-clockwise"></i> Consequencias (Mesa)</h4><p style="margin:0; font-size:12px; color:var(--text-muted);">Uma roleta de micos e prendas!</p></div>
      <button onclick="criarJogo('roleta_consequencias')" style="background:var(--primary); border:none; color:white; padding:6px 12px; border-radius:8px; font-weight:bold; cursor:pointer;">Criar</button>
    </div>
  `;
  document.getElementById('jogos-disponiveis').innerHTML = html;
}

function criarJogo(type) {
  let prize = "A Conta";
  if (type !== 'roleta_consequencias') {
     prize = prompt("O que esta valendo? (Ex: Quem perde paga a conta, Paga a proxima cerveja...)");
     if(!prize) return;
  } else {
     prize = "Uma consequencia aleatoria!";
  }
  socket.emit('game_create_lobby', { mesa: mesaUrl, type, prize, cliente_id: clienteAtual?.id || socket.id, cliente_nome: clienteAtual?.nome || 'Convidado' });
}

function entrarJogo() {
  socket.emit('game_join_lobby', { mesa: mesaUrl, cliente_id: clienteAtual?.id || socket.id, cliente_nome: clienteAtual?.nome || 'Convidado' });
}

function jogarParImpar(side, fingers) { socket.emit('game_action', { mesa: mesaUrl, cliente_id: clienteAtual?.id || socket.id, choice: { side, fingers } }); }
function jogarReflexo() { socket.emit('game_action', { mesa: mesaUrl, cliente_id: clienteAtual?.id || socket.id, choice: true }); }
function jogarVelha(idx) { socket.emit('game_action', { mesa: mesaUrl, cliente_id: clienteAtual?.id || socket.id, choice: idx }); }
function passarBatata() { socket.emit('game_action', { mesa: mesaUrl, cliente_id: clienteAtual?.id || socket.id, choice: 'pass' }); }
function acaoBlackjack(choice) { socket.emit('game_action', { mesa: mesaUrl, cliente_id: clienteAtual?.id || socket.id, choice }); }

function getCardIcon(cardStr) {
  const v = cardStr.slice(0,-1);
  const s = cardStr.slice(-1);
  let suit = '♣'; let color = 'black';
  if(s === 'H') { suit = '♥'; color = 'red'; }
  if(s === 'D') { suit = '♦'; color = 'red'; }
  if(s === 'S') { suit = '♠'; color = 'black'; }
  return `<div style="background:white; border-radius:4px; padding:2px 6px; display:inline-block; margin:2px; font-weight:bold; color:${color}; font-size:16px;">${v}${suit}</div>`;
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
    const pKeys = Object.keys(currentGame.players);
    const playerCount = pKeys.length;
    
    let actBtn = isPlayer ? 
      `<button onclick="socket.emit('game_cancel', {mesa: mesaUrl})" style="background:#ef4444; border:none; color:white; padding:8px 16px; border-radius:8px; font-weight:bold; cursor:pointer; margin-top:10px;">Cancelar</button>` :
      `<button onclick="entrarJogo()" style="background:#10b981; border:none; color:white; padding:8px 16px; border-radius:8px; font-weight:bold; cursor:pointer; margin-top:10px;">Entrar na Partida!</button>`;
    
    let startBtn = '';
    if (currentGame.host === pId && ['blackjack', 'batata_quente', 'roleta_russa', 'roleta_consequencias'].includes(currentGame.type) && playerCount >= 2) {
       startBtn = `<button onclick="socket.emit('game_start', {mesa: mesaUrl, cliente_id: '${pId}'})" style="background:var(--primary); border:none; color:white; padding:8px 16px; border-radius:8px; font-weight:bold; cursor:pointer; margin-top:10px; margin-left:10px;">Comecar Partida!</button>`;
    }
      
    document.getElementById('lista-partidas-ativas').innerHTML = `
      <div class="pedido-card">
        <h4 style="margin:0; font-size:16px;">${currentGame.type.replace('_',' ').toUpperCase()}</h4>
        <p style="margin:0; font-size:13px; color:var(--text-muted);">Criado por: ${hostName}</p>
        <p style="margin:4px 0 0 0; font-size:14px; font-weight:bold; color:#f59e0b;">Valendo: ${currentGame.prize}</p>
        <p style="margin:4px 0 0 0; font-size:12px; color:var(--text-muted);">Jogadores: ${playerCount}</p>
        ${actBtn}
        ${startBtn}
      </div>
    `;
  } 
  else if (currentGame.status === 'playing') {
    document.getElementById('jogos-partidas-ativas').style.display = 'none';
    document.getElementById('jogos-game-area').style.display = 'block';
    
    document.getElementById('jogos-game-header').innerHTML = `
      <h4 style="margin:0; font-size:18px; text-transform:capitalize;">${currentGame.type.replace('_',' ')}</h4>
      <span style="font-size:12px; background:var(--primary); padding:2px 8px; border-radius:4px; font-weight:bold;">Premio: ${currentGame.prize}</span>
    `;
    
    if(!isPlayer) {
      document.getElementById('jogos-game-content').innerHTML = '<p style="text-align:center;">Partida em andamento...</p>';
      document.getElementById('jogos-game-actions').innerHTML = '';
      return;
    }

    if (currentGame.type === 'velha') {
      const b = currentGame.state.board;
      const isMyTurn = currentGame.state.turn === pId;
      document.getElementById('jogos-game-content').innerHTML = `
        <h3 style="text-align:center; color:${isMyTurn ? '#10b981' : 'white'};">${isMyTurn ? 'SUA VEZ!' : 'Aguarde o adversario...'}</h3>
        <div style="display:grid; grid-template-columns:repeat(3, 80px); gap:5px; justify-content:center; margin-top:20px;">
          ${b.map((val, i) => `<div onclick="if(${isMyTurn}) jogarVelha(${i})" style="width:80px; height:80px; background:#333; display:flex; align-items:center; justify-content:center; font-size:36px; font-weight:bold; color:white; cursor:${isMyTurn && val===null ? 'pointer' : 'default'}; border-radius:8px;">${val||''}</div>`).join('')}
        </div>
      `;
      document.getElementById('jogos-game-actions').innerHTML = '';
    } 
    else if (currentGame.type === 'batata_quente') {
      const holder = currentGame.state.currentHolder;
      const amIHolder = holder === pId;
      const holderName = currentGame.players[holder]?.name;
      
      let potatoUI = amIHolder ? 
        `<div style="text-align:center;">
           <i class="ph-fill ph-fire" style="font-size:80px; color:#ef4444; animation: pulse 0.5s infinite alternate;"></i>
           <h2 style="color:#ef4444; margin:10px 0;">A BATATA ESTA COM VOCE!</h2>
           <button onclick="passarBatata()" style="padding:20px 40px; font-size:24px; font-weight:bold; background:#ef4444; color:white; border:none; border-radius:12px; cursor:pointer;">PASSAR!!</button>
         </div>` :
        `<div style="text-align:center;">
           <i class="ph-fill ph-fire" style="font-size:50px; color:#f59e0b;"></i>
           <h3 style="color:white;">A batata esta com ${holderName}!</h3>
         </div>`;
         
      document.getElementById('jogos-game-content').innerHTML = potatoUI;
      document.getElementById('jogos-game-actions').innerHTML = '';
      
      // Inject pulse animation if not exists
      if(!document.getElementById('potato-pulse')) {
         const style = document.createElement('style');
         style.id = 'potato-pulse';
         style.innerHTML = `@keyframes pulse { 0% { transform: scale(1); } 100% { transform: scale(1.3); } }`;
         document.head.appendChild(style);
      }
    }
    else if (currentGame.type === 'blackjack') {
      const tIdx = currentGame.state.turnIndex;
      const currentTurnId = currentGame.state.turnOrder[tIdx];
      const isMyTurn = currentTurnId === pId;
      const turnName = currentGame.players[currentTurnId]?.name || 'Ninguem';
      
      const myCards = currentGame.players[pId].state.cards;
      const myStatus = currentGame.players[pId].state.status;
      
      let html = `<div style="text-align:center; margin-bottom:20px;">
        <h4 style="color:#94a3b8; margin:0 0 5px 0;">Dealer</h4>
        <div>${getCardIcon(currentGame.state.dealerCards[0])} <div style="background:#555; border-radius:4px; width:28px; height:36px; display:inline-block; margin:2px;"></div></div>
      </div>
      
      <div style="text-align:center; margin-bottom:20px; border-top:1px solid #333; padding-top:15px;">
        <h4 style="color:white; margin:0 0 5px 0;">Sua Mao</h4>
        <div>${myCards.map(c => getCardIcon(c)).join('')}</div>
        <p style="color:#f59e0b; margin:5px 0; font-weight:bold; font-size:14px;">Status: ${myStatus.toUpperCase()}</p>
      </div>`;
      
      if(isMyTurn && myStatus === 'playing') {
         html += `<div style="text-align:center;">
           <h3 style="color:#10b981; margin-top:0;">SUA VEZ!</h3>
           <button onclick="acaoBlackjack('hit')" style="background:var(--primary); color:white; border:none; padding:10px 20px; border-radius:8px; font-weight:bold; margin-right:10px; cursor:pointer;">Hit (Pedir)</button>
           <button onclick="acaoBlackjack('stand')" style="background:#333; color:white; border:none; padding:10px 20px; border-radius:8px; font-weight:bold; cursor:pointer;">Stand (Parar)</button>
         </div>`;
      } else {
         html += `<h4 style="text-align:center; color:#94a3b8;">Turno de: ${turnName}</h4>`;
      }
      
      document.getElementById('jogos-game-content').innerHTML = html;
      document.getElementById('jogos-game-actions').innerHTML = '';
    }
    // Existing games...
    else if (currentGame.type === 'par_impar' || currentGame.type === 'reflexo') {
        const myChoice = currentGame.players[pId].choice;
        if (currentGame.type === 'par_impar') {
           if(myChoice) {
             document.getElementById('jogos-game-content').innerHTML = `<h3 style="text-align:center; color:white;">Aguardando oponente...</h3>`;
             document.getElementById('jogos-game-actions').innerHTML = '';
           } else {
             document.getElementById('jogos-game-content').innerHTML = `<h3 style="text-align:center; color:white;">Faca sua jogada!</h3>`;
             document.getElementById('jogos-game-actions').innerHTML = `
               <div style="display:flex; gap:10px; width:100%; justify-content:center; margin-bottom:10px;">
                 <button onclick="window.gameSide='par'; this.style.background='var(--primary)';" style="flex:1; padding:10px; border-radius:8px; border:1px solid #ccc; background:#222; color:white;">PAR</button>
                 <button onclick="window.gameSide='impar'; this.style.background='var(--primary)';" style="flex:1; padding:10px; border-radius:8px; border:1px solid #ccc; background:#222; color:white;">IMPAR</button>
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
  } 
  else if (currentGame.status === 'finished') {
    document.getElementById('jogos-partidas-ativas').style.display = 'none';
    document.getElementById('jogos-game-area').style.display = 'block';
    window.reflexTimeout = null;
    
    let isWinner = false;
    let isLoser = false;
    let winnerName = 'Ninguem';
    
    if (currentGame.winner === 'draw') {
        winnerName = 'Empate';
    } else if (currentGame.winner === 'dealer') {
        winnerName = 'Dealer (A Casa)';
    } else if (currentGame.winner) {
        isWinner = currentGame.winner === pId;
        winnerName = currentGame.players[currentGame.winner]?.name || 'Alguem';
    } else if (currentGame.loser) {
        isLoser = currentGame.loser === pId;
        const loserName = currentGame.players[currentGame.loser]?.name || 'Alguem';
        winnerName = 'Sobreviventes (Perdedor: ' + loserName + ')';
    }
    
    let message = '';
    let icon = ''; let color = '';
    if (currentGame.loser) {
        if (isLoser) { icon = 'ph-fill ph-skull'; color = '#ef4444'; message = 'VOCE SE DEU MAL!'; }
        else { icon = 'ph-fill ph-party-face'; color = '#10b981'; message = 'VOCE SE SALVOU!'; }
    } else if (currentGame.winner === 'draw' || currentGame.winner === 'dealer') {
        icon = 'ph-fill ph-scales'; color = '#94a3b8'; message = 'A CASA VENCE / EMPATE';
    } else {
        if (isWinner) { icon = 'ph-fill ph-trophy'; color = '#f59e0b'; message = 'VOCE VENCEU!'; }
        else { icon = 'ph-fill ph-smiley-sad'; color = '#94a3b8'; message = 'VOCE PERDEU...'; }
    }
    
    document.getElementById('jogos-game-content').innerHTML = `
      <div style="text-align:center;">
        <i class="${icon}" style="font-size:60px; color:${color}; margin-bottom:15px;"></i>
        <h2 style="color:white; margin:0 0 10px 0;">${message}</h2>
        <p style="color:var(--text-muted); font-size:14px; margin:0;">${currentGame.loser ? 'A prenda ficou para: ' + (currentGame.players[currentGame.loser]?.name) : 'Vencedor: ' + winnerName}</p>
        <div style="margin-top:15px; padding:10px; background:rgba(255,255,255,0.1); border-radius:8px;">
          <span style="font-weight:bold; font-size:12px; color:#f59e0b;">Premio/Prenda: ${currentGame.prize}</span>
        </div>
      </div>
    `;
    document.getElementById('jogos-game-actions').innerHTML = '';
    
    const hList = document.getElementById('lista-jogos-historico');
    const div = document.createElement('div');
    div.className = 'pedido-card';
    div.innerHTML = `<h4 style="margin:0; font-size:14px; text-transform:capitalize;">${currentGame.type.replace('_',' ')}</h4><p style="margin:0; font-size:12px; color:var(--text-muted);">Vencedor: ${winnerName} | Premio: ${currentGame.prize}</p>`;
    hList.prepend(div);
  }
});

socket.on('connect', () => {
  if(typeof mesaUrl !== 'undefined' && mesaUrl) socket.emit('get_table_game', { mesa: mesaUrl });
  renderJogosDisponiveis();
});
