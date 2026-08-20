/* ══════ SISTEMA DE JOGOS / GAMIFICAÇÃO - CLIENTE ══════ */
var jogosDisponiveis = [];
var partidaEmAndamento = null;

function initJogos() {
  socket.emit('jogos_listar');
  if (mesaUrl) {
    socket.emit('jogos_partidas_mesa', mesaUrl);
  }
}

socket.on('jogos_lista', function(lista) {
  jogosDisponiveis = lista || [];
  renderJogosDisponiveis();
});

socket.on('jogos_partidas_lista', function(partidas) {
  var container = document.getElementById('jogos-partidas-ativas');
  var lista = document.getElementById('lista-partidas-ativas');
  if (!partidas || !partidas.length) {
    if (container) container.style.display = 'none';
    return;
  }
  if (container) container.style.display = 'block';
  if (!lista) return;
  lista.innerHTML = partidas.map(function(p) {
    var botaoOuStatus = '';
    if (p.status === 'aguardando' && p.jogador1 && p.jogador1.nome !== (clienteAtual ? clienteAtual.nome : '')) {
      botaoOuStatus = '<button onclick="entrarNaPartida(' + p.id + ')" style="background:linear-gradient(135deg,#8b5cf6,#6366f1);color:white;border:none;padding:8px 16px;border-radius:8px;cursor:pointer;font-weight:600;">Entrar!</button>';
    } else {
      var txt = p.status === 'aguardando' ? 'Aguardando adversario...' : 'Em jogo';
      botaoOuStatus = '<span style="color:#f59e0b;font-size:12px;">' + txt + '</span>';
    }
    return '<div style="background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);border-radius:12px;padding:16px;">' +
      '<div style="display:flex;justify-content:space-between;align-items:center;">' +
        '<div><span style="font-size:24px;">' + (p.jogo_emoji || '🎮') + '</span> ' +
        '<strong style="color:white;margin-left:8px;">' + esc(p.jogo_nome) + '</strong> ' +
        '<span style="color:var(--text-muted);font-size:12px;margin-left:8px;">Rodada ' + (p.rodada || 1) + '/' + (p.max_rodadas || 3) + '</span></div>' +
        botaoOuStatus +
      '</div></div>';
  }).join('');
});

function renderJogosDisponiveis() {
  var container = document.getElementById('jogos-disponiveis');
  if (!container) return;
  if (!jogosDisponiveis.length) {
    container.innerHTML = '<p style="color:#94a3b8;text-align:center;padding:20px;">Nenhum jogo disponivel no momento.</p>';
    return;
  }
  container.innerHTML = jogosDisponiveis.map(function(j) {
    var nome = (j.nome || '').replace(/'/g, "\\'");
    return '<div onclick="criarPartidaJogo(' + j.id + ",'" + nome + "','" + (j.tipo || '') + "','" + (j.emoji || '🎮') + '\')" style="' +
      'background:linear-gradient(135deg,rgba(139,92,246,0.15),rgba(99,102,241,0.15));' +
      'border:1px solid rgba(139,92,246,0.3);border-radius:14px;padding:16px;cursor:pointer;transition:all 0.2s;' +
      'display:flex;align-items:center;gap:14px;" ' +
      'onmouseover="this.style.transform=\'translateY(-2px)\';this.style.borderColor=\'rgba(139,92,246,0.6)\'" ' +
      'onmouseout="this.style.transform=\'\';this.style.borderColor=\'rgba(139,92,246,0.3)\'">' +
      '<div style="font-size:36px;">' + (j.emoji || '🎮') + '</div>' +
      '<div style="flex:1;">' +
        '<h4 style="color:white;margin:0 0 4px 0;">' + esc(j.nome) + '</h4>' +
        '<p style="color:var(--text-muted);margin:0;font-size:13px;">' + esc(j.descricao || j.tipo) + '</p>' +
        '<p style="color:#8b5cf6;margin:4px 0 0 0;font-size:12px;">🏆 ' + esc(j.premio_vencedor || 'Vencedor nao paga!') + '</p>' +
      '</div>' +
      '<div style="color:rgba(255,255,255,0.3);font-size:20px;"><i class="ph ph-arrow-right"></i></div>' +
    '</div>';
  }).join('');
}

function criarPartidaJogo(jogoId, nome, tipo, emoji) {
  if (!mesaUrl) { alert('Acesse pelo QR Code da mesa para jogar!'); return; }
  if (!clienteAtual) { alert('Faca login primeiro!'); return; }
  socket.emit('jogos_criar_partida', {
    jogo_id: jogoId,
    mesa: mesaUrl,
    jogador1_nome: clienteAtual.nome,
    jogador1_comanda: '',
    jogador1_cliente_id: clienteAtual.id
  });
}

socket.on('jogos_partida_criada', function(partida) {
  partidaEmAndamento = partida;
  renderGameArea(partida);
});

socket.on('jogos_partida_atualizada', function(partida) {
  partidaEmAndamento = partida;
  renderGameArea(partida);
});

function entrarNaPartida(partidaId) {
  if (!clienteAtual) { alert('Faca login primeiro!'); return; }
  socket.emit('jogos_entrar_partida', {
    partida_id: partidaId,
    mesa: mesaUrl,
    jogador2_nome: clienteAtual.nome,
    jogador2_comanda: '',
    jogador2_cliente_id: clienteAtual.id
  });
}

socket.on('jogos_jogada_recebida', function(data) {
  if (data.jogador_nome !== (clienteAtual ? clienteAtual.nome : '') && !data.escolha_pendente) {
    var w = document.getElementById('jogos-waiting-opponent');
    if (w) w.innerHTML = '<i class="ph ph-spinner-gap ph-spin" style="font-size:20px;color:#8b5cf6;"></i> <span style="color:#8b5cf6;">Adversario fez a jogada! Sua vez...</span>';
  }
});

socket.on('jogos_resultado_rodada', function(data) {
  renderResultadoRodada(data);
});

socket.on('jogos_partida_finalizada', function(data) {
  renderResultadoFinal(data);
});

socket.on('jogos_partida_cancelada', function() {
  document.getElementById('jogos-game-area').style.display = 'none';
  var g = document.getElementById('jogos-disponiveis');
  if (g) g.style.display = 'grid';
  partidaEmAndamento = null;
  if (mesaUrl) socket.emit('jogos_partidas_mesa', mesaUrl);
});

socket.on('jogos_erro', function(data) {
  alert(data.erro || 'Erro nos jogos.');
});

function renderGameArea(partida) {
  var area = document.getElementById('jogos-game-area');
  var header = document.getElementById('jogos-game-header');
  var content = document.getElementById('jogos-game-content');
  var actions = document.getElementById('jogos-game-actions');
  var disponiveis = document.getElementById('jogos-disponiveis');
  if (!area || !header || !content || !actions) return;
  area.style.display = 'block';
  if (disponiveis) disponiveis.style.display = 'none';

  if (partida.status === 'aguardando') {
    header.innerHTML = '<div><h3 style="color:white;margin:0;">' + (partida.jogo_emoji || '🎮') + ' ' + esc(partida.jogo_nome) + '</h3>' +
      '<p style="color:var(--text-muted);margin:4px 0 0 0;font-size:13px;">Mesa: ' + esc(partida.mesa) + '</p></div>' +
      '<button onclick="cancelarPartida()" style="background:rgba(239,68,68,0.2);color:#ef4444;border:none;padding:8px 12px;border-radius:8px;cursor:pointer;">Cancelar</button>';
    content.innerHTML = '<div style="text-align:center;padding:20px;">' +
      '<div style="font-size:48px;margin-bottom:16px;">⏳</div>' +
      '<h3 style="color:white;margin:0 0 8px 0;">Aguardando adversario...</h3>' +
      '<p style="color:var(--text-muted);margin:0 0 16px 0;">' + esc(partida.jogador1.nome) + ' abriu o jogo. Outro jogador da mesa pode entrar!</p>' +
      '<div style="background:rgba(255,255,255,0.05);border-radius:12px;padding:16px;">' +
        '<p style="color:var(--text-muted);margin:0;font-size:13px;">🏆 Premiacao: <strong style="color:white;">' + esc(partida.premio_descricao) + '</strong></p>' +
        '<p style="color:var(--text-muted);margin:4px 0 0 0;font-size:13px;">🎯 Melhor de ' + (partida.max_rodadas || 3) + ' rodadas</p>' +
      '</div></div>';
    actions.innerHTML = '<button onclick="cancelarPartida()" style="background:rgba(255,255,255,0.1);color:white;border:none;padding:10px 20px;border-radius:8px;cursor:pointer;width:100%;">Cancelar Partida</button>';
    return;
  }

  if (partida.status === 'em_andamento') {
    var nomeAtual = clienteAtual ? clienteAtual.nome : '';
    var isJ1 = partida.jogador1 && partida.jogador1.nome === nomeAtual;
    var isJ2 = partida.jogador2 && partida.jogador2.nome === nomeAtual;
    var podeJogar = (isJ1 && !partida.jogador1.escolha) || (isJ2 && !partida.jogador2.escolha);

    header.innerHTML = '<div><h3 style="color:white;margin:0;">' + (partida.jogo_emoji || '🎮') + ' ' + esc(partida.jogo_nome) + '</h3>' +
      '<p style="color:var(--text-muted);margin:4px 0 0 0;font-size:13px;">Rodada ' + (partida.rodada || 1) + '/' + (partida.max_rodadas || 3) + ' &bull; ' + esc(partida.jogador1.nome) + ' vs ' + esc(partida.jogador2 ? partida.jogador2.nome : '?') + '</p></div>' +
      '<span style="background:rgba(139,92,246,0.2);color:#8b5cf6;padding:4px 12px;border-radius:20px;font-size:12px;font-weight:600;">Em jogo</span>';

    renderJogadaInterface(partida, isJ1, isJ2, podeJogar);
    actions.innerHTML = '';
  }
}

function renderJogadaInterface(partida, isJ1, isJ2, podeJogar) {
  var content = document.getElementById('jogos-game-content');
  var tipo = partida.jogo_tipo;
  var dis = podeJogar ? '' : 'opacity:0.3;cursor:not-allowed;';
  var waiting = podeJogar ? '' : '<div id="jogos-waiting-opponent" style="margin-bottom:16px;"><i class="ph ph-spinner-gap ph-spin" style="font-size:20px;color:#8b5cf6;"></i> <span style="color:#8b5cf6;">Aguardando adversario...</span></div>';

  if (tipo === 'par_impar') {
    content.innerHTML = '<div style="text-align:center;">' +
      '<h4 style="color:white;margin-bottom:16px;">Par ou Impar?</h4>' +
      '<p style="color:var(--text-muted);margin-bottom:20px;">Escolha par ou impar. Soma dos dedos!</p>' + waiting +
      '<div style="display:flex;gap:16px;justify-content:center;">' +
        '<button onclick="fazerEscolha(\'par\')" style="background:linear-gradient(135deg,#10b981,#059669);color:white;border:none;padding:16px 32px;border-radius:12px;font-size:18px;font-weight:700;cursor:pointer;min-width:100px;' + dis + '">' +
          '<div style="font-size:28px;">✌️</div><div>PAR</div></button>' +
        '<button onclick="fazerEscolha(\'impar\')" style="background:linear-gradient(135deg,#f59e0b,#d97706);color:white;border:none;padding:16px 32px;border-radius:12px;font-size:18px;font-weight:700;cursor:pointer;min-width:100px;' + dis + '">' +
          '<div style="font-size:28px;">🤞</div><div>IMPAR</div></button>' +
      '</div></div>';
  } else if (tipo === 'dedos') {
    var botoes = '';
    for (var n = 0; n <= 5; n++) {
      botoes += '<button onclick="fazerEscolha(\'' + n + '\')" style="background:linear-gradient(135deg,' + (n%2===0?'#6366f1':'#8b5cf6') + ',' + (n%2===0?'#4f46e5':'#7c3aed') + ');color:white;border:none;padding:14px 18px;border-radius:12px;font-size:20px;font-weight:700;cursor:pointer;' + dis + '">' + n + '</button>';
    }
    content.innerHTML = '<div style="text-align:center;">' +
      '<h4 style="color:white;margin-bottom:16px;">Dedos Iguais?</h4>' +
      '<p style="color:var(--text-muted);margin-bottom:20px;">Escolha um numero de 0 a 5!</p>' + waiting +
      '<div style="display:flex;gap:10px;justify-content:center;flex-wrap:wrap;">' + botoes + '</div>' +
      '<p style="color:var(--text-muted);font-size:12px;margin-top:12px;">Soma par -> Jogador 1 ganha. Impar -> Jogador 2 ganha!</p></div>';
  } else if (tipo === 'dois_ou_um') {
    content.innerHTML = '<div style="text-align:center;">' +
      '<h4 style="color:white;margin-bottom:16px;">Dois ou Um?</h4>' +
      '<p style="color:var(--text-muted);margin-bottom:20px;">Se voce escolher 2 e o outro 1, voce ganha!</p>' + waiting +
      '<div style="display:flex;gap:16px;justify-content:center;">' +
        '<button onclick="fazerEscolha(\'2\')" style="background:linear-gradient(135deg,#ef4444,#dc2626);color:white;border:none;padding:20px 40px;border-radius:14px;font-size:28px;font-weight:900;cursor:pointer;' + dis + '">2</button>' +
        '<button onclick="fazerEscolha(\'1\')" style="background:linear-gradient(135deg,#3b82f6,#2563eb);color:white;border:none;padding:20px 40px;border-radius:14px;font-size:28px;font-weight:900;cursor:pointer;' + dis + '">1</button>' +
      '</div></div>';
  } else if (tipo === 'botao_grande') {
    content.innerHTML = '<div style="text-align:center;">' +
      '<h4 style="color:white;margin-bottom:16px;">Botao Grande</h4>' +
      '<p style="color:var(--text-muted);margin-bottom:20px;">Aperte o botao o mais rapido que puder!</p>' + waiting +
      '<div id="botao-grande-timer" style="font-size:48px;color:white;font-weight:900;margin-bottom:20px;font-family:monospace;">00.000</div>' +
      '<button id="btn-grande-iniciar" onclick="iniciarBotaoGrande()" style="background:linear-gradient(135deg,#f59e0b,#d97706);color:white;border:none;padding:20px 60px;border-radius:16px;font-size:22px;font-weight:800;cursor:pointer;' + dis + '">🏎️ APERTAR!</button></div>';
  } else if (tipo === 'mao_orelha') {
    var botoesMao = '';
    for (var m = 0; m <= 5; m++) {
      botoesMao += '<button onclick="fazerEscolha(\'' + m + '\')" style="background:linear-gradient(135deg,' + (isJ1?'#ef4444,#dc2626':'#6366f1,#4f46e5') + ');color:white;border:none;padding:14px 18px;border-radius:12px;font-size:20px;font-weight:700;cursor:pointer;' + dis + '">' + m + '</button>';
    }
    var instrucao = isJ1 ? 'Quantos dedos voce vai mostrar?' : 'Quantos dedos o jogador 1 esta segurando?';
    content.innerHTML = '<div style="text-align:center;">' +
      '<h4 style="color:white;margin-bottom:16px;">Mao na Orelha</h4>' +
      '<p style="color:var(--text-muted);margin-bottom:20px;">' + instrucao + '</p>' + waiting +
      '<div style="display:flex;gap:10px;justify-content:center;flex-wrap:wrap;">' + botoesMao + '</div></div>';
  } else if (tipo === 'ultimo_tirar_dedo') {
    content.innerHTML = '<div style="text-align:center;">' +
      '<h4 style="color:white;margin-bottom:16px;">Ultimo a Tirar o Dedo</h4>' +
      '<p style="color:var(--text-muted);margin-bottom:20px;">Escolha 0 (tiro) ou 1 (fico)!</p>' + waiting +
      '<div style="display:flex;gap:16px;justify-content:center;">' +
        '<button onclick="fazerEscolha(\'0\')" style="background:linear-gradient(135deg,#6366f1,#4f46e5);color:white;border:none;padding:16px 32px;border-radius:12px;font-size:18px;font-weight:700;cursor:pointer;' + dis + '"><div style="font-size:28px;">✋</div><div>Tiro</div></button>' +
        '<button onclick="fazerEscolha(\'1\')" style="background:linear-gradient(135deg,#10b981,#059669);color:white;border:none;padding:16px 32px;border-radius:12px;font-size:18px;font-weight:700;cursor:pointer;' + dis + '"><div style="font-size:28px;">🖕</div><div>Fico</div></button>' +
      '</div></div>';
  } else {
    content.innerHTML = '<p style="color:#94a3b8;text-align:center;">Tipo de jogo nao implementado: ' + esc(tipo) + '</p>';
  }
}

function fazerEscolha(escolha) {
  if (!partidaEmAndamento || !mesaUrl || !clienteAtual) return;
  socket.emit('jogos_fazer_jogada', {
    partida_id: partidaEmAndamento.id,
    mesa: mesaUrl,
    jogador_nome: clienteAtual.nome,
    escolha: escolha
  });
}

function cancelarPartida() {
  if (!partidaEmAndamento || !mesaUrl) return;
  if (!confirm('Deseja cancelar esta partida?')) return;
  socket.emit('jogos_cancelar_partida', { partida_id: partidaEmAndamento.id, mesa: mesaUrl });
  document.getElementById('jogos-game-area').style.display = 'none';
  var g = document.getElementById('jogos-disponiveis');
  if (g) g.style.display = 'grid';
  partidaEmAndamento = null;
}

function renderResultadoRodada(data) {
  var content = document.getElementById('jogos-game-content');
  var r = data.resultado;
  var nomeAtual = clienteAtual ? clienteAtual.nome : '';
  var emoji = r.vencedor === nomeAtual ? '🎉' : '😊';
  var cor = r.vencedor === nomeAtual ? '#10b981' : '#f59e0b';
  var msg = r.vencedor === 'empate' ? 'EMPATE!' : 'Vencedor: ' + r.vencedor;

  if (r.tipo === 'par_impar' || r.tipo === 'dedos') {
    content.innerHTML = '<div style="text-align:center;padding:20px;">' +
      '<div style="font-size:48px;margin-bottom:12px;">' + emoji + '</div>' +
      '<h3 style="color:white;margin-bottom:8px;">Rodada ' + data.rodada + '</h3>' +
      '<p style="color:var(--text-muted);">' + r.escolha1 + ' + ' + r.escolha2 + ' = ' + r.soma + ' (' + r.resultado + ')</p>' +
      '<p style="color:' + cor + ';font-weight:700;font-size:16px;">' + msg + '</p>' +
      '<p style="color:var(--text-muted);font-size:12px;margin-top:8px;">Proxima rodada em breve...</p></div>';
  } else if (r.tipo === 'botao_grande') {
    content.innerHTML = '<div style="text-align:center;padding:20px;">' +
      '<div style="font-size:48px;margin-bottom:12px;">' + emoji + '</div>' +
      '<h3 style="color:white;margin-bottom:8px;">Rodada ' + data.rodada + '</h3>' +
      '<p style="color:var(--text-muted);">' + r.escolha1 + ' vs ' + r.escolha2 + '</p>' +
      '<p style="color:' + cor + ';font-weight:700;font-size:16px;">' + msg + '</p></div>';
  } else {
    content.innerHTML = '<div style="text-align:center;padding:20px;">' +
      '<div style="font-size:48px;margin-bottom:12px;">' + emoji + '</div>' +
      '<h3 style="color:white;margin-bottom:8px;">Rodada ' + data.rodada + '</h3>' +
      '<p style="color:' + cor + ';font-weight:700;font-size:16px;">' + msg + '</p></div>';
  }
}

function renderResultadoFinal(data) {
  var content = document.getElementById('jogos-game-content');
  var actions = document.getElementById('jogos-game-actions');
  var nomeAtual = clienteAtual ? clienteAtual.nome : '';
  var ganhou = data.vencedor === nomeAtual;
  var empate = data.vencedor === 'empate';

  var emojiFinal = empate ? '🤝' : (ganhou ? '🏆' : '😢');
  var tituloFinal = empate ? 'EMPATE!' : (ganhou ? 'VOCE GANHOU!' : 'VOCE PERDEU!');
  var corFinal = empate ? '#f59e0b' : (ganhou ? '#10b981' : '#ef4444');

  content.innerHTML = '<div style="text-align:center;padding:24px;">' +
    '<div style="font-size:64px;margin-bottom:16px;">' + emojiFinal + '</div>' +
    '<h2 style="color:' + corFinal + ';margin-bottom:8px;">' + tituloFinal + '</h2>' +
    '<div style="background:rgba(255,255,255,0.05);border-radius:12px;padding:16px;margin:16px 0;">' +
      '<p style="color:var(--text-muted);margin:0;">Placar: ' +
        '<strong style="color:white;">' + esc(data.placar.jogador1) + '</strong> x ' +
        '<strong style="color:white;">' + esc(data.placar.jogador2) + '</strong>' +
        (data.placar.empates > 0 ? ' (' + data.placar.empates + ' empates)' : '') + '</p>' +
      '<p style="color:#8b5cf6;margin:8px 0 0 0;font-size:14px;">🏆 Premio: ' + esc(data.premio || '') + '</p>' +
    '</div>' +
    '<p style="color:var(--text-muted);font-size:13px;">' +
      (ganhou ? 'Parabens! O adversario deve cumprir o premio!' : (empate ? 'Ninguem ganhou desta vez!' : 'Nao desista, tente novamente!')) + '</p>' +
  '</div>';

  actions.innerHTML = '<button onclick="voltarParaJogos()" style="background:linear-gradient(135deg,#8b5cf6,#6366f1);color:white;border:none;padding:12px 24px;border-radius:10px;cursor:pointer;width:100%;font-weight:600;">Voltar aos Jogos</button>';
}

function voltarParaJogos() {
  document.getElementById('jogos-game-area').style.display = 'none';
  var g = document.getElementById('jogos-disponiveis');
  if (g) g.style.display = 'grid';
  partidaEmAndamento = null;
  if (mesaUrl) socket.emit('jogos_partidas_mesa', mesaUrl);
  socket.emit('jogos_listar');
}

/* ═══ Botao Grande - Cronômetro ═══ */
var botaoGrandeTimer = null;
var botaoGrandeStart = 0;

function iniciarBotaoGrande() {
  var timerEl = document.getElementById('botao-grande-timer');
  var btn = document.getElementById('btn-grande-iniciar');
  if (!timerEl || !btn) return;

  if (!botaoGrandeTimer) {
    botaoGrandeStart = Date.now();
    botaoGrandeTimer = setInterval(function() {
      var elapsed = Date.now() - botaoGrandeStart;
      var secs = Math.floor(elapsed / 1000);
      var ms = elapsed % 1000;
      timerEl.textContent = String(secs).padStart(2, '0') + '.' + String(ms).padStart(3, '0');
    }, 17);
    btn.textContent = '🏁 PARAR!';
    btn.style.background = 'linear-gradient(135deg,#ef4444,#dc2626)';
  } else {
    clearInterval(botaoGrandeTimer);
    botaoGrandeTimer = null;
    var elapsed = Date.now() - botaoGrandeStart;
    var secs = Math.floor(elapsed / 1000);
    var ms = elapsed % 1000;
    var valorFinal = secs * 1000 + ms;
    timerEl.textContent = String(secs).padStart(2, '0') + '.' + String(ms).padStart(3, '0');
    btn.textContent = '✅ ' + valorFinal + 'ms';
    btn.disabled = true;
    btn.style.background = 'linear-gradient(135deg,#10b981,#059669)';
    fazerEscolha(String(valorFinal));
  }
}

/* ═══ Chamar initJogos quando a aba de jogos e selecionada ═══ */
var _showSectionOriginal = null;
if (typeof showSection === 'function') {
  _showSectionOriginal = showSection;
  showSection = function(name) {
    _showSectionOriginal(name);
    if (name === 'jogos') initJogos();
  };
}
