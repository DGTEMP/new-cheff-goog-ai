const HOST = window.location.hostname;
const socket = typeof io === 'function' ? io({ query: { token: localStorage.getItem('chef_token'), restaurante_id: localStorage.getItem('restaurante_id') || '1' } }) : (window.socket || {});

function esc(v) {
  return String(v == null ? '' : v)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

// Views
function getLoginView() { return document.getElementById('login-view'); }
function getDashView() { return document.getElementById('dashboard-view'); }

let currentUser = null;
let currentStatus = 'fora'; // fora, trabalhando
let calendarData = { pontos: [], consumo: [], vales: [] };
let calendarMonth = new Date().getMonth();
let calendarYear = new Date().getFullYear();

let managerCalendarData = [];
let managerCalMonth = new Date().getMonth();
let managerCalYear = new Date().getFullYear();
let restConfig = {};

// Carregar sessão (via token — nunca senha em texto puro)
localStorage.removeItem('chef_credentials');
const savedSession = localStorage.getItem('chef_session');
if (savedSession) {
  try {
    const sess = JSON.parse(savedSession);
    if (sess.token) socket.emit('login_funcionario_token', sess.token);
  } catch (e) {}
}

let loginTimeout = null;

function showLoginError(msg) {
  const errBox = document.getElementById('login-error-msg');
  if (errBox) {
    errBox.innerHTML = `<i class="ph ph-warning-circle" style="font-size:16px; margin-right:4px; vertical-align:middle;"></i> ${esc(msg)}`;
    errBox.style.display = 'block';
  } else {
    alert(msg);
  }
}

function resetLoginBtn() {
  if (loginTimeout) { clearTimeout(loginTimeout); loginTimeout = null; }
  const btn = document.getElementById('btn-login');
  if (btn) {
    btn.disabled = false;
    btn.innerHTML = 'Entrar';
    btn.style.opacity = '1';
  }
}

function initPainelFuncionarioDOM() {
  const btnLogin = document.getElementById('btn-login');
  if (btnLogin) {
    btnLogin.onclick = () => {
      const uEl = document.getElementById('login-user');
      const pEl = document.getElementById('login-pass');
      const u = uEl ? uEl.value.trim() : '';
      const p = pEl ? pEl.value : '';
      const errBox = document.getElementById('login-error-msg');
      if (errBox) errBox.style.display = 'none';

      if (!u || !p) {
        return showLoginError('Por favor, informe seu usuário e senha.');
      }

      if (!socket || !socket.connected) {
        return showLoginError('Sem conexão com o servidor. Verifique a rede e tente novamente.');
      }

      btnLogin.disabled = true;
      btnLogin.innerHTML = '<i class="ph ph-spinner-gap spin" style="font-size:18px; display:inline-block; vertical-align:middle;"></i> Entrando...';
      btnLogin.style.opacity = '0.7';

      loginTimeout = setTimeout(() => {
        resetLoginBtn();
        showLoginError('O servidor demorou para responder. Verifique sua conexão e tente novamente.');
      }, 6000);

      socket.emit('login_funcionario', { usuario: u, senha: p });
    };
  }

  ['login-user', 'login-pass'].forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      el.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          const btn = document.getElementById('btn-login');
          if (btn) btn.click();
        }
      });
    }
  });

  setInterval(() => {
    const el = document.getElementById('current-time');
    if (el) {
      const now = new Date();
      el.innerText = now.toLocaleTimeString('pt-BR');
    }
  }, 1000);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initPainelFuncionarioDOM);
} else {
  initPainelFuncionarioDOM();
}

socket.on('login_error', (msg) => {
  resetLoginBtn();
  localStorage.removeItem('chef_credentials');
  localStorage.removeItem('chef_session');
  showLoginError(msg || 'Usuário ou senha incorretos.');
});

socket.on('login_success', (user) => {
  resetLoginBtn();
  currentUser = user;

  const lv = getLoginView();
  const dv = getDashView();
  if (lv) lv.style.display = 'none';
  if (dv) dv.style.display = 'flex';

  const uName = document.getElementById('user-name');
  if (uName && user.nome) uName.innerText = user.nome.split(' ')[0];
  const uRole = document.getElementById('user-role');
  if (uRole) uRole.innerText = user.cargo || '';

  const btnAccess = document.getElementById('btn-access-system');
  if (btnAccess) {
    btnAccess.onclick = () => {
      const isAdmin = ['Admin', 'Administrador', 'adm', 'Gerente'].includes(user.cargo);
      if (isAdmin) {
        showSystemPicker();
        return;
      }
      if (user.cargo === 'Garçom') window.location.href = '/garcom.html';
      else if (user.cargo === 'Caixa') window.location.href = '/index.html';
      else window.location.href = '/fila-pedidos.html';
    };
  }

  const isAdmin = ['Admin', 'Administrador', 'adm', 'Gerente'].includes(user.cargo);
  if (isAdmin) {
    const btnToggle = document.getElementById('btn-manager-toggle');
    if (btnToggle) {
      btnToggle.style.display = '';
      btnToggle.onclick = () => {
        const panel = document.getElementById('manager-panel');
        if (panel && panel.style.display === 'flex') { panel.style.display = 'none'; return; }
        if (panel) panel.style.display = 'flex';
        loadManagerData();
      };
    }
    const btnClose = document.getElementById('btn-manager-close');
    if (btnClose) {
      btnClose.onclick = () => {
        const panel = document.getElementById('manager-panel');
        if (panel) panel.style.display = 'none';
      };
    }
  }

  socket.emit('get_metricas_funcionario', user.id);
});

// (Segurança) Armazena apenas o token de sessão (sem senha) para reautenticação automática.
socket.on('login_token', (token) => {
  if (!token || !currentUser) return;
  try {
    localStorage.setItem('chef_session', JSON.stringify({ token, usuario: currentUser.usuario, cargo: currentUser.cargo, nome: currentUser.nome, id: currentUser.id }));
  } catch (e) {}
});

document.getElementById('btn-logout').onclick = () => {
    localStorage.removeItem('chef_session');
    window.location.replace('/painel-funcionario.html');
  };

// Se a página for restaurada do cache do navegador (botão voltar) sem sessão de
// funcionário, garante que a tela de login seja exibida em vez do painel anterior.
window.addEventListener('pageshow', () => {
  if (!localStorage.getItem('chef_session') && currentUser) {
    currentUser = null;
    dashView.style.display = 'none';
    loginView.style.display = 'flex';
    socket.emit('logout_funcionario');
  }
});

// Ponto
const btnPonto = document.getElementById('btn-ponto');
const workStatus = document.getElementById('work-status');

btnPonto.onclick = () => {
  if (!currentUser) return;
  const acao = currentStatus === 'fora' ? 'entrada' : 'saida';
  abrirScanner(acao);
};

socket.on('ponto_registrado', ({ acao }) => {
  if (acao === 'entrada') {
    alert('Entrada registrada com sucesso!');
  } else {
    alert('Saída registrada com sucesso! Seu turno foi encerrado.');
  }
  socket.emit('get_metricas_funcionario', currentUser.id);
});

// Atualizar View com Métricas
socket.on('metricas_funcionario_response', ({ pontos, vales, pagamentos }) => {
  const lastPonto = pontos[0];
  if (lastPonto && !lastPonto.saida) {
    currentStatus = 'trabalhando';
    btnPonto.className = 'btn-main btn-danger';
    btnPonto.innerHTML = '<i class="ph ph-fingerprint" style="margin-right: 8px;"></i> REGISTRAR SAÍDA';
    workStatus.innerText = 'Turno em andamento (Entrada: ' + new Date(lastPonto.entrada).toLocaleTimeString('pt-BR') + ')';
  } else {
    currentStatus = 'fora';
    btnPonto.className = 'btn-main btn-success';
    btnPonto.innerHTML = '<i class="ph ph-fingerprint" style="margin-right: 8px;"></i> REGISTRAR ENTRADA';
    workStatus.innerText = 'Pronto para iniciar seu turno?';
  }

  const currentMonth = new Date().getMonth();
  let totalHoras = 0;
  let valorAcumulado = 0;
  let diasTrabalhados = new Set();

  pontos.forEach(p => {
    const pDate = new Date(p.entrada);
    if (pDate.getMonth() === currentMonth) {
      if (p.total_horas) totalHoras += p.total_horas;
      if (p.valor_pagar) valorAcumulado += p.valor_pagar;
      diasTrabalhados.add(p.data);
    }
  });

  document.getElementById('metric-horas').innerText = totalHoras.toFixed(1) + 'h';
  document.getElementById('metric-valor').innerText = 'R$ ' + valorAcumulado.toFixed(2).replace('.',',');
  document.getElementById('metric-dias').innerText = diasTrabalhados.size;
  
  const media = diasTrabalhados.size > 0 ? (totalHoras / diasTrabalhados.size).toFixed(1) : 0;
  document.getElementById('metric-media').innerText = media + 'h';

  // Render Vales
  const list = document.getElementById('vales-list');
  if (vales.length === 0) {
    list.innerHTML = '<div style="padding: 20px; text-align: center; color: var(--text-muted);">Nenhum vale solicitado.</div>';
  } else {
    let html = '';
    vales.forEach(v => {
      let statusClass = v.status.toLowerCase();
      if(statusClass === 'pendente') statusClass = 'pendente';
      else if(statusClass === 'aprovado') statusClass = 'aprovado';
      else statusClass = 'recusado';
      
      html += `
        <div class="vale-item">
          <div class="vale-info">
            <strong>R$ ${v.valor.toFixed(2).replace('.',',')}</strong>
            <span>${new Date(v.data_pedido).toLocaleDateString('pt-BR')}</span>
          </div>
          <span class="status-badge ${statusClass}">${esc(v.status)}</span>
        </div>
      `;
    });
    list.innerHTML = html;
  }

  // Render Pagamentos
  const pgtoList = document.getElementById('pagamentos-list');
  if (!pagamentos || pagamentos.length === 0) {
    pgtoList.innerHTML = '<div style="padding: 20px; text-align: center; color: var(--text-muted);">Nenhum pagamento registrado.</div>';
  } else {
    let pgHtml = '';
    pagamentos.forEach(p => {
      const data = p.data_pagamento ? new Date(p.data_pagamento).toLocaleDateString('pt-BR') : '-';
      const valor = parseFloat(p.valor_liquido || p.valor_bruto || 0);
      pgHtml += `
        <div class="pagamento-item" onclick="window.verDetalhePagamento(${JSON.stringify(p).replace(/"/g, '&quot;')})">
          <div class="pagamento-info">
            <strong>${esc(p.observacao || 'Pagamento')}</strong>
            <span>${data}</span>
          </div>
          <div class="pagamento-valor">R$ ${valor.toFixed(2).replace('.', ',')}</div>
        </div>
      `;
    });
    pgtoList.innerHTML = pgHtml;
  }

  // Load calendar & consumo after metrics
  if (currentUser) {
    loadCalendar();
    socket.emit('get_meu_consumo', currentUser.id);
  }
});

socket.on('restaurante_config', (cfg) => { restConfig = cfg; });
socket.emit('get_restaurante_config');

// Detalhe Pagamento Modal
document.getElementById('btn-close-pgto-detalhe').onclick = () => {
  document.getElementById('modal-pagamento-detalhe').style.display = 'none';
};

window.verDetalhePagamento = function(pag) {
  const data = pag.data_pagamento ? new Date(pag.data_pagamento).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' }) : '-';
  const valorBruto = parseFloat(pag.valor_bruto || 0);
  const vales = parseFloat(pag.total_vales_abatidos || 0);
  const consumo = parseFloat(pag.total_consumo_abatido || 0);
  const liquido = parseFloat(pag.valor_liquido || 0);

  document.getElementById('pgto-detalhe-content').innerHTML = `
    <div style="background: #f0fdf4; border-radius: 12px; padding: 20px; text-align: center; margin-bottom: 16px;">
      <div style="font-size: 14px; color: #166534;">Valor Recebido</div>
      <div style="font-size: 32px; font-weight: 900; color: #16a34a;">R$ ${liquido.toFixed(2).replace('.', ',')}</div>
    </div>
    <div style="display: flex; flex-direction: column; gap: 8px;">
      <div style="display: flex; justify-content: space-between; padding: 10px 12px; background: #f8f9fa; border-radius: 8px;">
        <span style="color: #64748b;">Data</span>
        <span style="font-weight: 600;">${data}</span>
      </div>
      <div style="display: flex; justify-content: space-between; padding: 10px 12px; background: #f8f9fa; border-radius: 8px;">
        <span style="color: #64748b;">Valor Bruto</span>
        <span style="font-weight: 600;">R$ ${valorBruto.toFixed(2).replace('.', ',')}</span>
      </div>
      ${vales > 0 ? `<div style="display: flex; justify-content: space-between; padding: 10px 12px; background: #fff1f2; border-radius: 8px;">
        <span style="color: #e11d48;">Vales Abatidos</span>
        <span style="font-weight: 600; color: #e11d48;">- R$ ${vales.toFixed(2).replace('.', ',')}</span>
      </div>` : ''}
      ${consumo > 0 ? `<div style="display: flex; justify-content: space-between; padding: 10px 12px; background: #fff7ed; border-radius: 8px;">
        <span style="color: #ea580c;">Consumo Abatido</span>
        <span style="font-weight: 600; color: #ea580c;">- R$ ${consumo.toFixed(2).replace('.', ',')}</span>
      </div>` : ''}
      ${pag.observacao ? `<div style="padding: 10px 12px; background: #f8f9fa; border-radius: 8px;">
        <span style="color: #64748b;">Observação: </span>
        <span style="font-weight: 500;">${esc(pag.observacao)}</span>
      </div>` : ''}
    </div>
  `;
  document.getElementById('modal-pagamento-detalhe').style.display = 'flex';
};

// === CELEBRATION SYSTEM ===
function launchConfetti() {
  const canvas = document.getElementById('confetti-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;

  const colors = ['#6c5ce7', '#a29bfe', '#00b894', '#fdcb6e', '#e17055', '#ff7675', '#74b9ff', '#55efc4', '#fd79a8'];
  const particles = [];

  for (let i = 0; i < 120; i++) {
    particles.push({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height - canvas.height,
      w: Math.random() * 10 + 5,
      h: Math.random() * 6 + 3,
      color: colors[Math.floor(Math.random() * colors.length)],
      vx: (Math.random() - 0.5) * 4,
      vy: Math.random() * 3 + 2,
      rot: Math.random() * 360,
      rotSpeed: (Math.random() - 0.5) * 10,
      opacity: 1
    });
  }

  let frame = 0;
  function animate() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    let alive = false;
    particles.forEach(p => {
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.05;
      p.rot += p.rotSpeed;
      if (frame > 60) p.opacity -= 0.015;
      if (p.opacity > 0 && p.y < canvas.height + 50) {
        alive = true;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate((p.rot * Math.PI) / 180);
        ctx.globalAlpha = Math.max(0, p.opacity);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
        ctx.restore();
      }
    });
    frame++;
    if (alive) requestAnimationFrame(animate);
    else ctx.clearRect(0, 0, canvas.width, canvas.height);
  }
  animate();
}

function playCelebrationSound() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const notes = [523.25, 659.25, 783.99, 1046.50, 783.99, 1046.50];
    const durations = [0.12, 0.12, 0.12, 0.2, 0.12, 0.3];
    let t = ctx.currentTime;

    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.3, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + durations[i] + 0.05);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(t);
      osc.stop(t + durations[i] + 0.05);
      t += durations[i];
    });
  } catch (e) { /* silent fail */ }
}

function showCelebration(data) {
  if (currentUser && data.funcionario_id !== currentUser.id) return;

  const overlay = document.getElementById('celebration-overlay');
  document.getElementById('celebration-name').textContent = data.funcionario_nome;
  document.getElementById('celebration-value').textContent = 'R$ ' + parseFloat(data.valor).toFixed(2).replace('.', ',');
  document.getElementById('celebration-obs').textContent = data.observacao || '';

  overlay.style.display = 'flex';
  launchConfetti();
  playCelebrationSound();

  setTimeout(() => { overlay.style.display = 'none'; }, 8000);
}

socket.on('pagamento_colaborador_celebracao', (data) => {
  showCelebration(data);
  if (currentUser) socket.emit('get_metricas_funcionario', currentUser.id);
});

// Modal Vales
const modalVale = document.getElementById('modal-vale');
document.getElementById('btn-solicitar-vale').onclick = () => modalVale.style.display = 'flex';
document.getElementById('btn-close-vale').onclick = () => modalVale.style.display = 'none';

document.getElementById('btn-confirm-vale').onclick = () => {
  const val = parseFloat(document.getElementById('vale-valor').value);
  if (!val || val <= 0) return alert('Insira um valor válido');
  
  socket.emit('solicitar_vale', { funcionario_id: currentUser.id, valor: val });
  modalVale.style.display = 'none';
  document.getElementById('vale-valor').value = '';
};

socket.on('vale_solicitado_success', () => {
  alert('Vale solicitado com sucesso!');
  socket.emit('get_metricas_funcionario', currentUser.id);
});

socket.on('bater_ponto_error', (msg) => { alert(msg); });

let html5QrCode = null;

window.fecharScannerPonto = function() {
  document.getElementById('modal-qr-scanner').style.display = 'none';
  if (html5QrCode) {
    html5QrCode.stop().then(() => {
      html5QrCode.clear();
      html5QrCode = null;
    }).catch(e => console.error("Falha ao parar scanner", e));
  }
};

function abrirScanner(acao) {
  const modal = document.getElementById('modal-qr-scanner');
  
  if (typeof Html5Qrcode === 'undefined') {
    if (modal) modal.style.display = 'none';
    alert('Leitor de QR indisponível (biblioteca não carregada).');
    return;
  }
  
  if (modal) modal.style.display = 'flex';
  
  if (!html5QrCode) {
    html5QrCode = new Html5Qrcode("qr-reader");
  }

  html5QrCode.start(
    { facingMode: "environment" },
    {
      fps: 10,
      qrbox: { width: 250, height: 250 }
    },
    (decodedText, decodedResult) => {
      try {
        const url = new URL(decodedText);
        const t = url.searchParams.get('t');
        if (t) {
          fecharScannerPonto();
          socket.emit('bater_ponto', { funcionario_id: currentUser.id, acao, token: t });
        } else {
          fecharScannerPonto();
          alert("QR Code inválido. Token não encontrado.");
        }
      } catch(e) {
        fecharScannerPonto();
        alert("QR Code não reconhecido. Certifique-se de escanear o código correto.");
      }
    },
    (errorMessage) => {
      // ignore
    }
  ).catch(err => {
    alert("Erro ao acessar a câmera. Verifique se deu permissão ao navegador.");
    fecharScannerPonto();
  });
}

// === CONSUMO BARCODE SCANNER ===
let consumoScanner = null;

window.fecharScannerConsumo = function() {
  document.getElementById('modal-consumo-scanner').style.display = 'none';
  if (consumoScanner) {
    consumoScanner.stop().then(() => {
      consumoScanner.clear();
      consumoScanner = null;
    }).catch(e => console.error("Falha ao parar scanner consumo", e));
  }
};

window.abrirScannerBarcode = function(onDecoded) {
  document.getElementById('modal-consumo-scanner').style.display = 'flex';
  
  if (!consumoScanner) {
    consumoScanner = new Html5Qrcode("consumo-qr-reader", {
      formatsToSupport: [
        Html5QrcodeSupportedFormats.EAN_13,
        Html5QrcodeSupportedFormats.EAN_8,
        Html5QrcodeSupportedFormats.UPC_A,
        Html5QrcodeSupportedFormats.UPC_E,
        Html5QrcodeSupportedFormats.CODE_128,
        Html5QrcodeSupportedFormats.CODE_39,
        Html5QrcodeSupportedFormats.CODE_93,
        Html5QrcodeSupportedFormats.ITF
      ]
    });
  }

  consumoScanner.start(
    { facingMode: "environment" },
    {
      fps: 10,
      qrbox: { width: 250, height: 250 }
    },
    (decodedText, decodedResult) => {
      fecharScannerConsumo();
      if (onDecoded) onDecoded(decodedText);
    },
    (errorMessage) => {
      // ignore
    }
  ).catch(err => {
    alert("Erro ao acessar a câmera. Verifique se deu permissão ao navegador.");
    fecharScannerConsumo();
  });
};

window.abrirScannerConsumo = function() {
  abrirScannerBarcode(function(codigo) {
    const input = document.getElementById('consumo-barcode');
    if (input) input.value = codigo;
    buscarProdutoBarcodeConsumo();
  });
};

window.abrirScannerEstoque = function() {
  abrirScannerBarcode(function(codigo) {
    const input = document.getElementById('mgr-estq-barcode');
    if (input) input.value = codigo;
    buscarProdutoPorBarcode();
  });
};

// === MEU CONSUMO ===
document.getElementById('btn-meu-consumo').onclick = () => {
  document.getElementById('modal-consumo').style.display = 'flex';
  document.getElementById('consumo-barcode').value = '';
  socket.emit('get_cardapio_funcionario');
};
document.getElementById('btn-close-consumo').onclick = () => {
  document.getElementById('modal-consumo').style.display = 'none';
};

socket.on('cardapio_funcionario', (produtos) => {
  const container = document.getElementById('cardapio-funcionario');
  if (!produtos || produtos.length === 0) {
    container.innerHTML = '<div style="padding:20px;text-align:center;color:var(--text-muted);">Nenhum item disponível.</div>';
    return;
  }
  let html = '';
  produtos.forEach(p => {
    let preco = p.preco || 0;
    if (p.preco_fixo) preco = p.preco_fixo;
    else if (p.desconto_percentual) preco = preco * (1 - p.desconto_percentual / 100);
    html += `
      <div class="cardapio-item">
        <div class="cardapio-item-info">
          <span class="cardapio-item-emoji">${esc(p.emoji || '🍽️')}</span>
          <div>
            <div class="cardapio-item-nome">${esc(p.nome)}</div>
            <div class="cardapio-item-preco">R$ ${preco.toFixed(2).replace('.', ',')}</div>
          </div>
        </div>
        <button class="cardapio-item-add" onclick="adicionarConsumo(${p.id})">+</button>
      </div>
    `;
  });
  container.innerHTML = html;
});

window.adicionarConsumo = function(produto_id) {
  if (!currentUser) return;
  socket.emit('adicionar_consumo_funcionario', { funcionario_id: currentUser.id, produto_id, quantidade: 1 });
};

window.buscarProdutoBarcodeConsumo = function() {
  const input = document.getElementById('consumo-barcode');
  const codigo = input ? input.value.trim() : '';
  if (!codigo) return;
  socket.emit('get_produto_by_barcode', codigo);
  socket.once('produto_by_barcode_result', (prod) => {
    if (!prod) {
      alert('Produto não encontrado para o código de barras informado.');
      return;
    }
    adicionarConsumo(prod.id);
    input.value = '';
    const container = document.getElementById('cardapio-funcionario');
    container.innerHTML = `<div style="padding:20px;text-align:center;color:#16a34a;font-weight:600;">✓ ${esc(prod.nome)} adicionado ao consumo!</div>`;
    setTimeout(() => socket.emit('get_cardapio_funcionario'), 800);
  });
};

socket.on('consumo_adicionado', (item) => {
  document.getElementById('modal-consumo').style.display = 'none';
  socket.emit('get_meu_consumo', currentUser.id);
  loadCalendar();
});

socket.on('consumo_erro', (msg) => { alert(msg); });

window.filtrarCardapio = function(valor) {
  const termo = valor.toLowerCase();
  document.querySelectorAll('.cardapio-item').forEach(el => {
    const nome = el.querySelector('.cardapio-item-nome').innerText.toLowerCase();
    el.style.display = nome.includes(termo) ? 'flex' : 'none';
  });
};

socket.on('meu_consumo', (items) => {
  const list = document.getElementById('consumo-list');
  if (!items || items.length === 0) {
    list.innerHTML = '<div style="padding: 20px; text-align: center; color: var(--text-muted);">Nenhum consumo registrado.</div>';
    return;
  }
  let html = '';
  let total = 0;
  items.forEach(i => {
    const val = parseFloat(i.total || 0);
    total += val;
    html += `
      <div class="consumo-item">
        <div>
          <div class="consumo-nome">${esc(i.productName)}</div>
          <div style="font-size:11px;color:var(--text-muted);">${new Date(i.createdAt).toLocaleDateString('pt-BR')}</div>
        </div>
        <div class="consumo-total">- R$ ${val.toFixed(2).replace('.', ',')}</div>
      </div>
    `;
  });
  html += `
    <div class="consumo-item" style="background:#fff3cd;">
      <div class="consumo-nome" style="font-weight:700;">Total a Pagar</div>
      <div style="font-weight:800;color:#dc2626;">R$ ${total.toFixed(2).replace('.', ',')}</div>
    </div>
  `;
  list.innerHTML = html;
});

// === CALENDÁRIO ===
function loadCalendar() {
  if (currentUser) socket.emit('get_calendario_funcionario', currentUser.id);
}

socket.on('calendario_funcionario', (data) => {
  calendarData = data;
  renderCalendar();
});

function renderCalendar() {
  const container = document.getElementById('calendario-view');
  const mes = calendarMonth;
  const ano = calendarYear;
  document.getElementById('cal-mes-label').innerText = new Date(ano, mes).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });

  const firstDay = new Date(ano, mes, 1).getDay();
  const daysInMonth = new Date(ano, mes + 1, 0).getDate();
  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`;
  const dataCadastro = calendarData.data_cadastro ? String(calendarData.data_cadastro).split(' ')[0] : '';

  // Expected work days from restaurant config (default: Qua-Dom = [0,3,4,5,6])
  let expectedDays = [0, 3, 4, 5, 6];
  try {
    const cfgDays = restConfig['rest_dias_funcionamento'];
    if (cfgDays) {
      const parsed = JSON.parse(cfgDays);
      if (Array.isArray(parsed) && parsed.length > 0) expectedDays = parsed;
    }
  } catch(e) {}
  function isExpectedWorkDay(d) {
    const dow = new Date(ano, mes, d).getDay();
    return expectedDays.includes(dow);
  }

  const pontosMap = {};
  (calendarData.pontos || []).forEach(p => {
    const key = p.data ? p.data.split(' ')[0] : '';
    pontosMap[key] = p;
  });

  const consumoMap = {};
  (calendarData.consumo || []).forEach(c => {
    const key = c.createdAt ? c.createdAt.split(' ')[0] : '';
    if (!consumoMap[key]) consumoMap[key] = 0;
    consumoMap[key] += parseFloat(c.total || 0);
  });

  const atipicosMap = {};
  (calendarData.atipicos || []).forEach(a => {
    const key = a.data ? a.data.split(' ')[0] : '';
    if (!atipicosMap[key]) atipicosMap[key] = [];
    atipicosMap[key].push(a);
  });

  const valesMap = {};
  (calendarData.vales || []).forEach(v => {
    const key = v.data_pedido ? v.data_pedido.split(' ')[0] : '';
    if (!valesMap[key]) valesMap[key] = [];
    valesMap[key].push(v);
  });

  const dispoMap = {};
  (calendarData.disponibilidades || []).forEach(d => {
    dispoMap[d.data] = d.disponivel;
  });

  let html = '<div class="cal-grid">';
  const dayNames = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
  dayNames.forEach(d => { html += `<div class="cal-header">${d}</div>`; });

  for (let i = 0; i < firstDay; i++) {
    html += '<div></div>';
  }

  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${ano}-${String(mes + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const ponto = pontosMap[dateStr];
    const atipicos = atipicosMap[dateStr] || [];
    const vales = valesMap[dateStr] || [];
    const isToday = dateStr === todayStr;
    const isWorked = !!ponto;
    const isExpected = isExpectedWorkDay(d);
    const isPast = dateStr < todayStr;
    const isFalta = isExpected && isPast && !isWorked && atipicos.length === 0 && (!dataCadastro || dateStr >= dataCadastro);
    const isDisponivel = dispoMap[dateStr] === 1;

    let cls = 'cal-day';
    if (isWorked) cls += ' worked';
    else if (isFalta) cls += ' falta';
    else if (atipicos.some(a => a.status === 'aprovado')) cls += ' atipico-aprovado';
    else if (atipicos.length > 0) cls += ' atipico';
    if (vales.length > 0) cls += ' tem-vale';
    if (isDisponivel) cls += ' disponivel';
    if (isToday) cls += ' today';

    const horas = ponto ? (ponto.total_horas || 0) : 0;

    const totalVale = vales.reduce((s, v) => s + parseFloat(v.valor || 0), 0);
    const temValePendente = vales.some(v => v.status === 'Pendente');

    let badge = '';
    if (isFalta) badge = '<div class="cal-horas" style="color:#dc3545;">Falta</div>';
    else if (atipicos.length > 0) badge = `<div class="cal-horas" style="color:#6c2c8a;">Extra R$ ${atipicos.reduce((s,a)=>s+parseFloat(a.valor||0),0).toFixed(0)}</div>`;
    else if (horas > 0) badge = `<div class="cal-horas">${horas.toFixed(1)}h</div>`;
    if (vales.length > 0) badge = `<div class="cal-horas" style="color:${temValePendente ? '#b45309' : '#047857'};">${vales.length} vale${vales.length > 1 ? 's' : ''} R$ ${totalVale.toFixed(0)}</div>`;

    html += `
      <div class="${cls}" onclick="selectCalDay('${dateStr}')">
        <div>${d}</div>
        ${badge}
      </div>
    `;
  }

  html += '</div>';

  let totalHoras = 0, totalValor = 0, totalDias = 0, totalFaltas = 0, totalExtra = 0;
  (calendarData.pontos || []).forEach(p => {
    if (p.data && p.data.startsWith(`${ano}-${String(mes + 1).padStart(2, '0')}`)) {
      totalHoras += parseFloat(p.total_horas || 0);
      totalValor += parseFloat(p.valor_pagar || 0);
      totalDias++;
    }
  });
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${ano}-${String(mes + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    if (dateStr >= todayStr) continue;
    if (dateStr < dataCadastro) continue;
    if (isExpectedWorkDay(d) && !pontosMap[dateStr] && (!atipicosMap[dateStr] || atipicosMap[dateStr].length === 0)) {
      totalFaltas++;
    }
  }
  let totalConsumo = 0;
  Object.values(consumoMap).forEach(v => totalConsumo += v);
  (calendarData.atipicos || []).forEach(a => {
    if (a.data && a.data.startsWith(`${ano}-${String(mes + 1).padStart(2, '0')}`) && a.status === 'aprovado') {
      totalExtra += parseFloat(a.valor || 0);
    }
  });

  html += `
    <div class="cal-summary visible" style="margin-top:16px;">
      <div style="font-weight:600;margin-bottom:8px;">Resumo do Mês</div>
      <div class="cal-summary-row">
        <span class="cal-summary-label">Dias Trabalhados</span>
        <span class="cal-summary-value">${totalDias}</span>
      </div>
      <div class="cal-summary-row">
        <span class="cal-summary-label">Faltas</span>
        <span class="cal-summary-value" style="color:#dc3545;">${totalFaltas}</span>
      </div>
      <div class="cal-summary-row">
        <span class="cal-summary-label">Total Horas</span>
        <span class="cal-summary-value">${totalHoras.toFixed(1)}h</span>
      </div>
      <div class="cal-summary-row">
        <span class="cal-summary-label">Valor Bruto</span>
        <span class="cal-summary-value">R$ ${totalValor.toFixed(2).replace('.', ',')}</span>
      </div>
      ${totalExtra > 0 ? `<div class="cal-summary-row">
        <span class="cal-summary-label">Dias Extras (Aprovados)</span>
        <span class="cal-summary-value" style="color:#7c3aed;">R$ ${totalExtra.toFixed(2).replace('.', ',')}</span>
      </div>` : ''}
      <div class="cal-summary-row">
        <span class="cal-summary-label">Consumo (Fiado)</span>
        <span class="cal-summary-value" style="color:#dc2626;">R$ ${totalConsumo.toFixed(2).replace('.', ',')}</span>
      </div>
    </div>
  `;

  container.innerHTML = html;
}

window.selectCalDay = function(dateStr) {
  renderCalendar();
  const ponto = (calendarData.pontos || []).find(p => p.data && p.data.startsWith(dateStr));
  const itens = (calendarData.consumo || []).filter(c => c.createdAt && c.createdAt.startsWith(dateStr));
  const atipicos = (calendarData.atipicos || []).filter(a => a.data && a.data.startsWith(dateStr));
  const vales = (calendarData.vales || []).filter(v => v.data_pedido && v.data_pedido.startsWith(dateStr));
  const container = document.getElementById('calendario-view');

  const dt = new Date(dateStr + 'T12:00:00');
  let detailHtml = `
    <div class="cal-summary visible" style="margin-top:12px;border:2px solid var(--primary);">
      <div style="font-weight:600;margin-bottom:8px;">${dt.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' })}</div>
  `;
  if (ponto) {
    detailHtml += `
      <div class="cal-summary-row">
        <span class="cal-summary-label">Entrada</span>
        <span class="cal-summary-value">${ponto.entrada ? new Date(ponto.entrada).toLocaleTimeString('pt-BR') : '-'}</span>
      </div>
      <div class="cal-summary-row">
        <span class="cal-summary-label">Saída</span>
        <span class="cal-summary-value">${ponto.saida ? new Date(ponto.saida).toLocaleTimeString('pt-BR') : 'Em andamento'}</span>
      </div>
      <div class="cal-summary-row">
        <span class="cal-summary-label">Horas</span>
        <span class="cal-summary-value">${(ponto.total_horas || 0).toFixed(1)}h</span>
      </div>
      <div class="cal-summary-row">
        <span class="cal-summary-label">Valor</span>
        <span class="cal-summary-value">R$ ${(ponto.valor_pagar || 0).toFixed(2).replace('.', ',')}</span>
      </div>
    `;
  } else {
    detailHtml += `<div style="padding:12px;text-align:center;color:var(--text-muted);">Nenhum ponto registrado neste dia.</div>`;
  }
  // Dias atipicos
  if (atipicos.length > 0) {
    detailHtml += `<div style="margin-top:8px;font-weight:600;color:#7c3aed;">Convocação Extra</div>`;
    atipicos.forEach(a => {
      const st = a.status === 'aprovado' ? '✅ Aceito' : a.status === 'recusado' ? '❌ Recusado' : '⏳ Pendente';
      const canRespond = a.status === 'pendente';
      detailHtml += `
        <div class="cal-summary-row" style="flex-wrap:wrap;">
          <span class="cal-summary-label">${esc(a.justificativa || 'Dia Extra')} <span style="font-size:11px;color:#94a3b8;">${st}</span></span>
          <span class="cal-summary-value" style="color:#7c3aed;">R$ ${parseFloat(a.valor || 0).toFixed(2).replace('.', ',')}</span>
        </div>
        ${canRespond ? `
        <div style="display:flex;gap:8px;margin-top:6px;">
          <button onclick="responderAtipico(${a.id},'aceitar')" style="flex:1;padding:8px;background:#16a34a;color:white;border:none;border-radius:8px;font-weight:600;cursor:pointer;">✅ Aceitar</button>
          <button onclick="responderAtipico(${a.id},'recusar')" style="flex:1;padding:8px;background:#dc2626;color:white;border:none;border-radius:8px;font-weight:600;cursor:pointer;">❌ Recusar</button>
        </div>` : ''}
      `;
    });
  }
  if (itens.length > 0) {
    detailHtml += `<div style="margin-top:8px;font-weight:600;">Consumo do Dia</div>`;
    itens.forEach(i => {
      detailHtml += `
        <div class="cal-summary-row">
          <span class="cal-summary-label">${esc(i.productName)}</span>
          <span class="cal-summary-value" style="color:#dc2626;">R$ ${parseFloat(i.total || 0).toFixed(2).replace('.', ',')}</span>
        </div>
      `;
    });
  }
  if (vales.length > 0) {
    detailHtml += `<div style="margin-top:8px;font-weight:600;">Vales do Dia</div>`;
    vales.forEach(v => {
      const st = v.status === 'Aprovado' ? '✅ Aprovado' : v.status === 'Recusado' ? '❌ Recusado' : '⏳ Pendente';
      detailHtml += `
        <div class="cal-summary-row" style="flex-wrap:wrap;">
          <span class="cal-summary-label">Vale <span style="font-size:11px;color:#94a3b8;">${st}</span></span>
          <span class="cal-summary-value" style="color:${v.status === 'Recusado' ? '#dc2626' : (v.status === 'Pendente' ? '#b45309' : '#047857')};">R$ ${parseFloat(v.valor || 0).toFixed(2).replace('.', ',')}</span>
        </div>
      `;
    });
  }
  const isDisponivel = (calendarData.disponibilidades || []).some(d => d.data === dateStr && d.disponivel === 1);
  detailHtml += `
    <div class="cal-summary-row" style="margin-top: 10px; padding-top: 10px; border-top: 1px solid rgba(255,255,255,0.06); align-items: center;">
      <span class="cal-summary-label"><i class="ph ph-calendar-check" style="color:#10b981; font-size:16px; vertical-align: middle; margin-right: 4px;"></i> Disponibilidade</span>
      <span class="cal-summary-value" style="display: flex; align-items: center; gap: 6px;">
        <label for="chk-dispo-${dateStr}" style="font-size: 11px; color:#10b981; font-weight: 600; cursor: pointer;">Disponível p/ trabalhar</label>
        <input type="checkbox" id="chk-dispo-${dateStr}" ${isDisponivel ? 'checked' : ''} onchange="toggleDisponibilidade('${dateStr}', this.checked)" style="width: 18px; height: 18px; accent-color: #10b981; cursor: pointer; margin: 0;">
      </span>
    </div>
  `;
  detailHtml += '</div>';

  container.insertAdjacentHTML('beforeend', detailHtml);
};

window.toggleDisponibilidade = function(dateStr, isChecked) {
  if (currentUser) {
    socket.emit('toggle_disponibilidade', {
      funcionario_id: currentUser.id,
      data: dateStr,
      disponivel: isChecked
    });
  }
};

socket.on('disponibilidade_funcionario', (rows) => {
  calendarData.disponibilidades = rows;
  renderCalendar();
});

document.getElementById('btn-cal-mes-menor').onclick = () => {
  calendarMonth--;
  if (calendarMonth < 0) { calendarMonth = 11; calendarYear--; }
  renderCalendar();
};
document.getElementById('btn-cal-mes-maior').onclick = () => {
  calendarMonth++;
  if (calendarMonth > 11) { calendarMonth = 0; calendarYear++; }
  renderCalendar();
};

// === DIA EXTRA RESPONSE ===
window.responderAtipico = function(id, acao) {
  if (!currentUser) return;
  socket.emit('responder_dia_atipico', { id, acao });
};
socket.on('dia_atipico_atualizado', () => {
  loadCalendar();
});

// Remove solicitar-dia-extra button if it exists (flow changed: admin convoca)
const btnSolicitar = document.getElementById('btn-solicitar-dia-extra');
if (btnSolicitar) btnSolicitar.style.display = 'none';

// === SYSTEM PICKER FOR MANAGERS ===
function showSystemPicker() {
  const existing = document.getElementById('manager-system-picker-overlay');
  if (existing) existing.remove();

  const overlay = document.createElement('div');
  overlay.id = 'manager-system-picker-overlay';
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.6);z-index:20000;display:flex;align-items:center;justify-content:center;padding:20px;';

  const box = document.createElement('div');
  box.style.cssText = 'background:white;border-radius:20px;padding:24px;max-width:420px;width:100%;box-shadow:0 20px 60px rgba(0,0,0,0.3);';

  const systems = [
    { label: 'PDV / Caixa', icon: 'ph ph-currency-circle-dollar', href: '/index.html', desc: 'Sistema principal de vendas e mesas' },
    { label: 'Garçom', icon: 'ph ph-note-pencil', href: '/garcom.html', desc: 'Comandas e pedidos para garçons' },
    { label: 'Fila de Pedidos', icon: 'ph ph-list-bullets', href: '/fila-pedidos.html', desc: 'Visualização da fila de produção' },
    { label: 'Cardápio Digital', icon: 'ph ph-qr-code', href: '/cardapio.html', desc: 'Cardápio online para clientes' },
  ];

  box.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">
      <h3 style="margin:0;font-size:18px;"><i class="ph ph-desktop"></i> Acessar Sistema</h3>
      <button id="picker-close-btn" style="background:none;border:none;font-size:24px;cursor:pointer;color:#666;"><i class="ph ph-x"></i></button>
    </div>
    <div style="display:flex;flex-direction:column;gap:8px;">
      ${systems.map(s => `
        <button onclick="window.location.href='${s.href}'" style="display:flex;align-items:center;gap:12px;padding:14px 16px;background:#f8f9fa;border:1px solid #e9ecef;border-radius:12px;cursor:pointer;text-align:left;transition:background 0.15s;width:100%;font-family:inherit;font-size:inherit;">
          <i class="${s.icon}" style="font-size:24px;color:#9b59b6;width:32px;text-align:center;"></i>
          <div style="flex:1;">
            <div style="font-weight:600;color:#2c3e50;font-size:15px;">${s.label}</div>
            <div style="font-size:12px;color:#7f8c8d;margin-top:2px;">${s.desc}</div>
          </div>
          <i class="ph ph-caret-right" style="color:#adb5bd;"></i>
        </button>
      `).join('')}
    </div>
  `;

  overlay.appendChild(box);
  document.body.appendChild(overlay);

  document.getElementById('picker-close-btn').onclick = () => overlay.remove();
  overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });
}

// === MANAGER DATA ===
async function loadManagerData() {
  const statusEl = document.getElementById('manager-team-status');
  const valesEl = document.getElementById('manager-vales-pendentes');
  statusEl.innerHTML = 'Carregando...';
  valesEl.innerHTML = 'Carregando...';
  socket.emit('manager_get_team_status');
  socket.emit('manager_get_pending_vales');
  socket.emit('manager_get_calendar_vales');
}

socket.on('manager_team_status', (funcionarios) => {
  const el = document.getElementById('manager-team-status');
  if (!el) return;
  let online = 0, offline = 0, clockedIn = 0;
  funcionarios.forEach(f => {
    if (f.online) online++;
    if (!f.online) offline++;
    if (f.ponto_aberto) clockedIn++;
  });
  el.innerHTML = `
    <div style="display:flex; gap:16px; flex-wrap:wrap;">
      <span><strong>${funcionarios.length}</strong> total</span>
      <span style="color:#4ade80;"><strong>${online}</strong> online</span>
      <span style="color:#94a3b8;"><strong>${offline}</strong> offline</span>
      <span style="color:#facc15;"><strong>${clockedIn}</strong> em ponto</span>
    </div>
    <div style="margin-top:6px; max-height:120px; overflow-y:auto;">
      ${funcionarios.map(f => `
        <div style="display:flex; justify-content:space-between; padding:2px 0; font-size:12px; border-bottom:1px solid rgba(255,255,255,0.05);">
          <span>${esc(f.nome)}</span>
          <span>${f.ponto_aberto ? '<i class="ph ph-clock"></i>' : (f.online ? '<span style="color:#4ade80;">online</span>' : '<span style="opacity:0.5;">offline</span>')}</span>
        </div>
      `).join('')}
    </div>
  `;
});

socket.on('manager_pending_vales', (vales) => {
  const el = document.getElementById('manager-vales-pendentes');
  const countEl = document.getElementById('manager-pending-count');
  if (!el) return;
  countEl.textContent = vales.length;
  if (!vales.length) {
    el.innerHTML = 'Nenhum vale pendente.';
    return;
  }
  el.innerHTML = vales.map(v => `
    <div class="vales-pendentes-item">
      <div class="vp-info">
        <strong>${esc(v.funcionario_nome)}</strong><br>
        <span>R$ ${parseFloat(v.valor).toFixed(2)}</span>
        <span style="opacity:0.6; font-size:11px;"> — ${esc(v.motivo || 'sem motivo')}</span>
      </div>
      <div class="vp-actions">
        <button class="vp-aprovar" onclick="managerAprovarVale(${v.id}, this)">Aprovar</button>
        <button class="vp-recusar" onclick="managerRecusarVale(${v.id}, this)">Recusar</button>
      </div>
    </div>
  `).join('');
});

window.managerAprovarVale = function(id, btn) {
  btn.disabled = true;
  btn.textContent = '...';
  socket.emit('manager_aprovar_vale', { id });
};

window.managerRecusarVale = function(id, btn) {
  btn.disabled = true;
  btn.textContent = '...';
  socket.emit('manager_recusar_vale', { id });
};

socket.on('manager_vale_atualizado', (data) => {
  loadManagerData();
});

// === MANAGER VALES CALENDAR ===
socket.on('manager_calendar_vales', (vales) => {
  managerCalendarData = vales || [];
  renderManagerCalendar();
});

function renderManagerCalendar() {
  const container = document.getElementById('manager-calendar-view');
  if (!container) return;
  const mes = managerCalMonth;
  const ano = managerCalYear;
  document.getElementById('mgr-cal-mes-label').innerText = new Date(ano, mes).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });

  const firstDay = new Date(ano, mes, 1).getDay();
  const daysInMonth = new Date(ano, mes + 1, 0).getDate();
  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`;

  const valesMap = {};
  managerCalendarData.forEach(v => {
    const key = v.data_pedido ? v.data_pedido.split(' ')[0] : '';
    if (!valesMap[key]) valesMap[key] = [];
    valesMap[key].push(v);
  });

  let html = '<div class="cal-grid">';
  const dayNames = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
  dayNames.forEach(d => { html += `<div class="cal-header">${d}</div>`; });

  for (let i = 0; i < firstDay; i++) {
    html += '<div></div>';
  }

  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${ano}-${String(mes + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const vales = valesMap[dateStr] || [];
    const isToday = dateStr === todayStr;

    let cls = 'cal-day';
    if (vales.length > 0) cls += ' tem-vale';
    if (isToday) cls += ' today';

    const totalVale = vales.reduce((s, v) => s + parseFloat(v.valor || 0), 0);
    let badge = '';
    if (vales.length > 0) badge = `<div class="cal-horas" style="color:#047857;">${vales.length} vale${vales.length > 1 ? 's' : ''} R$ ${totalVale.toFixed(0)}</div>`;

    html += `
      <div class="${cls}" onclick="selectManagerCalDay('${dateStr}')">
        <div>${d}</div>
        ${badge}
      </div>
    `;
  }

  html += '</div>';

  const mesVales = managerCalendarData.filter(v => v.data_pedido && v.data_pedido.startsWith(`${ano}-${String(mes + 1).padStart(2, '0')}`));
  const totalMes = mesVales.reduce((s, v) => s + parseFloat(v.valor || 0), 0);
  const pendentes = mesVales.filter(v => v.status === 'Pendente').length;
  const aprovados = mesVales.filter(v => v.status === 'Aprovado').length;
  const recusados = mesVales.filter(v => v.status === 'Recusado').length;

  html += `
    <div style="margin-top:10px; display:flex; gap:10px; flex-wrap:wrap; font-size:11px; opacity:0.9;">
      <span><strong>${mesVales.length}</strong> vales</span>
      <span style="color:#b45309;"><strong>${pendentes}</strong> pendentes</span>
      <span style="color:#4ade80;"><strong>${aprovados}</strong> aprovados</span>
      <span style="color:#f87171;"><strong>${recusados}</strong> recusados</span>
      <span><strong>R$ ${totalMes.toFixed(2).replace('.', ',')}</strong> total</span>
    </div>
  `;

  container.innerHTML = html;
}

window.selectManagerCalDay = function(dateStr) {
  renderManagerCalendar();
  const vales = managerCalendarData.filter(v => v.data_pedido && v.data_pedido.startsWith(dateStr));
  const container = document.getElementById('manager-calendar-view');
  if (!container || !vales.length) return;

  const dt = new Date(dateStr + 'T12:00:00');
  let detailHtml = `
    <div class="cal-summary visible" style="margin-top:12px;border:2px solid var(--primary);">
      <div style="font-weight:600;margin-bottom:8px;">${dt.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' })}</div>
  `;
  vales.forEach(v => {
    const st = v.status === 'Aprovado' ? '✅ Aprovado' : v.status === 'Recusado' ? '❌ Recusado' : '⏳ Pendente';
    detailHtml += `
      <div class="cal-summary-row" style="flex-wrap:wrap;">
        <span class="cal-summary-label">${esc(v.funcionario_nome || '')} <span style="font-size:11px;color:#94a3b8;">${st}</span></span>
        <span class="cal-summary-value" style="color:${v.status === 'Recusado' ? '#dc2626' : (v.status === 'Pendente' ? '#b45309' : '#047857')};">R$ ${parseFloat(v.valor || 0).toFixed(2).replace('.', ',')}</span>
      </div>
    `;
  });
  detailHtml += '</div>';
  container.insertAdjacentHTML('beforeend', detailHtml);
};

document.addEventListener('DOMContentLoaded', () => {
  const btnMenor = document.getElementById('btn-mgr-cal-menor');
  const btnMaior = document.getElementById('btn-mgr-cal-maior');
  if (btnMenor) btnMenor.onclick = () => {
    managerCalMonth--;
    if (managerCalMonth < 0) { managerCalMonth = 11; managerCalYear--; }
    renderManagerCalendar();
  };
  if (btnMaior) btnMaior.onclick = () => {
    managerCalMonth++;
    if (managerCalMonth > 11) { managerCalMonth = 0; managerCalYear++; }
    renderManagerCalendar();
  };
});

// === MANAGER MODAL HELPERS ===
window.fecharModal = function(id) {
  const el = document.getElementById(id);
  if (el) el.style.display = 'none';
};

function popularSelectFuncionarios(selectId) {
  socket.emit('get_funcionarios');
  socket.once('funcionarios_atualizados', (funcs) => {
    const sel = document.getElementById(selectId);
    if (!sel) return;
    sel.innerHTML = '<option value="">Selecione...</option>' +
      (funcs || []).filter(f => f.status === 'Ativo').map(f =>
        `<option value="${f.id}">${esc(f.nome)} (${esc(f.cargo || '')})</option>`
      ).join('');
  });
}

// === 1. LANÇAR VALE ===
window.openModalLancarVale = function() {
  document.getElementById('modal-mgr-vale').style.display = 'flex';
  document.getElementById('mgr-vale-valor').value = '';
  document.getElementById('mgr-vale-motivo').value = '';
  popularSelectFuncionarios('mgr-vale-func');
};

window.confirmarLancarVale = function() {
  const funcId = document.getElementById('mgr-vale-func').value;
  const valor = parseFloat(document.getElementById('mgr-vale-valor').value);
  const motivo = document.getElementById('mgr-vale-motivo').value || '';
  if (!funcId) return alert('Selecione um colaborador.');
  if (!valor || valor <= 0) return alert('Informe um valor válido.');
  socket.emit('solicitar_vale', { funcionario_id: parseInt(funcId), valor, motivo });
  socket.once('vale_solicitado_success', () => {
    fecharModal('modal-mgr-vale');
    alert('Vale concedido com sucesso!');
    loadManagerData();
  });
  socket.once('solicitar_vale_error', (msg) => alert(msg || 'Erro ao conceder vale.'));
};

// === 2. FAZER PAGAMENTO ===
window.openModalFazerPagamento = function() {
  document.getElementById('modal-mgr-pagamento').style.display = 'flex';
  document.getElementById('mgr-pgto-extrato').style.display = 'none';
  document.getElementById('mgr-pgto-bruto').value = '';
  document.getElementById('mgr-pgto-obs').value = '';
  document.getElementById('mgr-pgto-liquido').textContent = 'R$ 0,00';
  popularSelectFuncionarios('mgr-pgto-func');
};

window.carregarExtratoPagamento = function() {
  const funcId = document.getElementById('mgr-pgto-func').value;
  const extratoDiv = document.getElementById('mgr-pgto-extrato');
  if (!funcId) { extratoDiv.style.display = 'none'; return; }
  extratoDiv.style.display = 'block';
  document.getElementById('mgr-pgto-vales-abater').innerHTML = 'Carregando...';
  document.getElementById('mgr-pgto-consumo-abater').innerHTML = '';

  fetch(`/api/rh/extrato/${funcId}`)
    .then(r => r.json())
    .then(data => {
      const valesHtml = (data.vales || []).map(v =>
        `<label style="display:flex;align-items:center;gap:8px;padding:4px 0;border-bottom:1px solid #f1f5f9;cursor:pointer;">
          <input type="checkbox" class="mgr-pgto-check-vale" data-id="${v.id}" data-valor="${v.valor}" checked>
          <span style="flex:1;">Vale #${v.id} <span style="font-size:11px;color:#94a3b8;">${new Date(v.data_pedido).toLocaleDateString('pt-BR')}</span></span>
          <span style="font-weight:700;color:#dc2626;">-R$ ${parseFloat(v.valor).toFixed(2)}</span>
        </label>`
      ).join('');
      document.getElementById('mgr-pgto-vales-abater').innerHTML =
        (valesHtml ? `<strong style="font-size:12px;">Vales a Abater:</strong><br>${valesHtml}` : '<span style="opacity:0.7;">Nenhum vale pendente</span>');

      const consumoHtml = (data.fiados || []).map(c =>
        `<label style="display:flex;align-items:center;gap:8px;padding:4px 0;border-bottom:1px solid #f1f5f9;cursor:pointer;">
          <input type="checkbox" class="mgr-pgto-check-consumo" data-id="${c.id}" data-valor="${c.total}" checked>
          <span style="flex:1;">${esc(c.productName)} x${c.quantity} <span style="font-size:11px;color:#94a3b8;">${new Date(c.createdAt).toLocaleDateString('pt-BR')}</span></span>
          <span style="font-weight:700;color:#ea580c;">-R$ ${parseFloat(String(c.total).replace('R$','').replace(/\./g,'').replace(',','.')).toFixed(2)}</span>
        </label>`
      ).join('');
      document.getElementById('mgr-pgto-consumo-abater').innerHTML =
        (consumoHtml ? `<strong style="font-size:12px;">Consumo a Abater:</strong><br>${consumoHtml}` : '<span style="opacity:0.7;">Nenhum consumo pendente</span>');

      document.querySelectorAll('.mgr-pgto-check-vale, .mgr-pgto-check-consumo').forEach(cb => {
        cb.addEventListener('change', calcularLiquidoPagamento);
      });

      if (data.suggested_bruto) {
        document.getElementById('mgr-pgto-bruto').value = data.suggested_bruto.toFixed(2);
        calcularLiquidoPagamento();
      } else {
        calcularLiquidoPagamento();
      }
    })
    .catch(() => {
      document.getElementById('mgr-pgto-vales-abater').innerHTML = 'Erro ao carregar extrato.';
    });
};

window.calcularLiquidoPagamento = function() {
  const bruto = parseFloat(document.getElementById('mgr-pgto-bruto').value) || 0;
  let totalVales = 0;
  document.querySelectorAll('.mgr-pgto-check-vale:checked').forEach(cb => {
    totalVales += parseFloat(cb.dataset.valor) || 0;
  });
  let totalConsumo = 0;
  document.querySelectorAll('.mgr-pgto-check-consumo:checked').forEach(cb => {
    totalConsumo += parseFloat(String(cb.dataset.valor).replace('R$','').replace(/\./g,'').replace(',','.')) || 0;
  });
  const totalAbates = totalVales + totalConsumo;
  const liq = Math.max(0, bruto - totalAbates);
  document.getElementById('mgr-pgto-total-vales').textContent = `R$ ${totalVales.toFixed(2)}`;
  document.getElementById('mgr-pgto-total-consumo').textContent = `R$ ${totalConsumo.toFixed(2)}`;
  document.getElementById('mgr-pgto-total-abates').textContent = `R$ ${totalAbates.toFixed(2)}`;
  document.getElementById('mgr-pgto-liquido').textContent = `R$ ${liq.toFixed(2)}`;
};

window.confirmarPagamento = function() {
  const funcId = document.getElementById('mgr-pgto-func').value;
  const bruto = parseFloat(document.getElementById('mgr-pgto-bruto').value);
  const obs = document.getElementById('mgr-pgto-obs').value || 'Pagamento via Painel Gerente';
  if (!funcId) return alert('Selecione um colaborador.');
  if (!bruto || bruto <= 0) return alert('Informe um valor bruto válido.');

  const valesIds = [];
  const pedidosIds = [];
  let totalVales = 0;
  let totalConsumo = 0;
  document.querySelectorAll('.mgr-pgto-check-vale:checked').forEach(cb => {
    valesIds.push(parseInt(cb.dataset.id));
    totalVales += parseFloat(cb.dataset.valor) || 0;
  });
  document.querySelectorAll('.mgr-pgto-check-consumo:checked').forEach(cb => {
    pedidosIds.push(parseInt(cb.dataset.id));
    totalConsumo += parseFloat(String(cb.dataset.valor).replace('R$','').replace(/\./g,'').replace(',','.')) || 0;
  });
  const totalAbates = totalVales + totalConsumo;
  const liquido = Math.max(0, bruto - totalAbates);

  fetch('/api/rh/pagamentos', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      funcionario_id: parseInt(funcId),
      valor_bruto: bruto,
      total_vales_abatidos: totalVales,
      total_consumo_abatido: totalConsumo,
      valor_liquido: liquido,
      observacao: obs,
      vales_ids: valesIds,
      pedidos_ids: pedidosIds
    })
  })
  .then(r => r.json())
  .then(res => {
    if (res.success) {
      fecharModal('modal-mgr-pagamento');
      alert(`Pagamento de R$ ${liquido.toFixed(2)} registrado com sucesso!`);
      loadManagerData();
    } else {
      alert(res.erro || 'Erro ao registrar pagamento.');
    }
  })
  .catch(() => alert('Erro ao conectar com o servidor.'));
};

// === 3. REGISTRAR DESPESA ===
window.openModalDespesa = function() {
  document.getElementById('modal-mgr-despesa').style.display = 'flex';
  document.getElementById('mgr-despesa-valor').value = '';
  document.getElementById('mgr-despesa-desc').value = '';
};

window.confirmarDespesa = function() {
  const valor = parseFloat(document.getElementById('mgr-despesa-valor').value);
  const desc = document.getElementById('mgr-despesa-desc').value.trim();
  const forma = document.getElementById('mgr-despesa-forma').value;
  if (!valor || valor <= 0) return alert('Informe um valor válido.');
  if (!desc) return alert('Informe uma descrição para a despesa.');
  socket.emit('add_despesa', { valor, descricao: desc, forma_pagamento: forma });
  socket.once('financeiro_atualizado', () => {
    fecharModal('modal-mgr-despesa');
    alert('Despesa registrada com sucesso!');
  });
  // fallback timeout
  setTimeout(() => { fecharModal('modal-mgr-despesa'); alert('Despesa registrada!'); }, 1500);
};

// === 4. NF MERCADORIAS ===
window.openModalNfMercadorias = function() {
  document.getElementById('modal-mgr-nf').style.display = 'flex';
  document.getElementById('mgr-nf-form').style.display = 'block';
  document.getElementById('mgr-nf-lista').style.display = 'none';
  document.getElementById('mgr-nf-numero').value = '';
  document.getElementById('mgr-nf-fornecedor').value = '';
  document.getElementById('mgr-nf-valor').value = '';
  document.getElementById('mgr-nf-data').value = new Date().toISOString().split('T')[0];
  document.getElementById('mgr-nf-obs').value = '';
};

window.confirmarNfMercadoria = function() {
  const numero = document.getElementById('mgr-nf-numero').value.trim();
  const fornecedor = document.getElementById('mgr-nf-fornecedor').value.trim();
  const valor = parseFloat(document.getElementById('mgr-nf-valor').value);
  const data = document.getElementById('mgr-nf-data').value;
  const obs = document.getElementById('mgr-nf-obs').value.trim();
  if (!numero) return alert('Informe o número da NF.');
  if (!fornecedor) return alert('Informe o fornecedor.');
  if (!valor || valor <= 0) return alert('Informe o valor total.');
  socket.emit('add_nf_mercadoria', { numero_nf: numero, fornecedor, valor_total: valor, data_emissao: data, observacao: obs });
  socket.once('nf_mercadoria_adicionada', () => {
    document.getElementById('mgr-nf-numero').value = '';
    document.getElementById('mgr-nf-fornecedor').value = '';
    document.getElementById('mgr-nf-valor').value = '';
    document.getElementById('mgr-nf-obs').value = '';
    alert('NF registrada com sucesso!');
  });
  socket.once('nf_mercadoria_erro', (msg) => alert(msg || 'Erro ao registrar NF.'));
};

window.carregarNfMercadorias = function() {
  const el = document.getElementById('mgr-nf-lista');
  el.innerHTML = 'Carregando...';
  socket.emit('get_nf_mercadorias');
};

socket.on('nf_mercadorias_list', (list) => {
  const el = document.getElementById('mgr-nf-lista');
  if (!el) return;
  if (!list || !list.length) {
    el.innerHTML = '<div style="text-align:center;padding:20px;color:var(--text-muted);">Nenhuma NF registrada.</div>';
    return;
  }
  el.innerHTML = list.map(nf => `
    <div style="padding:10px;border-bottom:1px solid #e2e8f0;font-size:13px;">
      <div style="display:flex;justify-content:space-between;">
        <strong>NF ${esc(nf.numero_nf)}</strong>
        <span style="font-weight:700;">R$ ${parseFloat(nf.valor_total).toFixed(2)}</span>
      </div>
      <div style="color:var(--text-muted);">${esc(nf.fornecedor)} — ${esc(nf.data_emissao || '')}</div>
      ${nf.observacao ? `<div style="opacity:0.6;font-size:11px;">${esc(nf.observacao)}</div>` : ''}
    </div>
  `).join('');
});

// === 5. AJUSTES DE ROTINA ===
window.openModalAjustes = function() {
  document.getElementById('modal-mgr-ajustes').style.display = 'flex';
  document.getElementById('mgr-ajuste-info').style.display = 'none';
  document.getElementById('mgr-ajuste-preco').value = '';
  document.getElementById('mgr-ajuste-estoque').value = '';
  socket.emit('get_produtos');
  socket.once('produtos_atualizados', (prods) => {
    const sel = document.getElementById('mgr-ajuste-produto');
    if (!sel) return;
    sel.innerHTML = '<option value="">Selecione...</option>' +
      (prods || []).filter(p => p.status === 'ativo').map(p =>
        `<option value="${p.id}" data-preco="${p.preco}" data-estoque="${p.estoque || 0}" data-status="${p.status}">${esc(p.nome)} — R$ ${parseFloat(p.preco).toFixed(2)}</option>`
      ).join('');
  });
};

window.carregarDadosProduto = function() {
  const sel = document.getElementById('mgr-ajuste-produto');
  const opt = sel.options[sel.selectedIndex];
  const info = document.getElementById('mgr-ajuste-info');
  if (!opt || !opt.value) { info.style.display = 'none'; return; }
  info.style.display = 'block';
  const preco = parseFloat(opt.dataset.preco) || 0;
  const estoque = parseFloat(opt.dataset.estoque) || 0;
  const status = opt.dataset.status;
  info.innerHTML = `
    <strong>${opt.text.split(' — ')[0]}</strong><br>
    Preço atual: <strong>R$ ${preco.toFixed(2)}</strong> | 
    Estoque: <strong>${estoque}</strong> | 
    Status: <strong style="color:${status === 'ativo' ? '#16a34a' : '#dc2626'};">${status}</strong>
  `;
  document.getElementById('mgr-ajuste-preco').value = preco.toFixed(2);
  document.getElementById('mgr-ajuste-estoque').value = estoque;
};

window.alternarStatusProduto = function(novoStatus) {
  const sel = document.getElementById('mgr-ajuste-produto');
  const id = parseInt(sel.value);
  if (!id) return alert('Selecione um produto.');
  socket.emit('edit_produto', { id, status: novoStatus, operador: currentUser?.nome || 'Gerente' });
  socket.once('produtos_atualizados', () => {
    alert(`Produto ${novoStatus === 'ativo' ? 'ativado' : 'desativado'}!`);
    const opt = sel.options[sel.selectedIndex];
    if (opt) opt.dataset.status = novoStatus;
    carregarDadosProduto();
  });
};

window.salvarAjustePreco = function() {
  const sel = document.getElementById('mgr-ajuste-produto');
  const id = parseInt(sel.value);
  const preco = parseFloat(document.getElementById('mgr-ajuste-preco').value);
  if (!id) return alert('Selecione um produto.');
  if (!preco || preco <= 0) return alert('Informe um preço válido.');
  socket.emit('edit_produto', { id, preco, operador: currentUser?.nome || 'Gerente' });
  socket.once('produtos_atualizados', () => {
    alert('Preço atualizado!');
    carregarDadosProduto();
  });
};

window.salvarAjusteEstoque = function() {
  const sel = document.getElementById('mgr-ajuste-produto');
  const id = parseInt(sel.value);
  const qtd = parseFloat(document.getElementById('mgr-ajuste-estoque').value);
  if (!id) return alert('Selecione um produto.');
  if (isNaN(qtd)) return alert('Informe uma quantidade válida.');
  socket.emit('atualizar_estoque', { id, quantidade: qtd, operador: currentUser?.nome || 'Gerente' });
  socket.once('produtos_atualizados', () => {
    alert('Estoque atualizado!');
    carregarDadosProduto();
  });
};

// === 6. PONTO HOJE ===
window.openModalPontoHoje = function() {
  document.getElementById('modal-mgr-ponto-hoje').style.display = 'flex';
  document.getElementById('mgr-ponto-hoje-content').innerHTML = 'Carregando...';
  const hoje = new Date().toISOString().split('T')[0];
  socket.emit('get_rh_data', { start_date: hoje, end_date: hoje });
  socket.once('rh_data', (data) => {
    const el = document.getElementById('mgr-ponto-hoje-content');
    if (!el) return;
    const pontos = (data.pontos || []).filter(p => p.data === hoje);
    if (!pontos.length) {
      el.innerHTML = '<div style="text-align:center;padding:20px;color:var(--text-muted);">Nenhum registro de ponto hoje.</div>';
      return;
    }
    el.innerHTML = pontos.map(p => {
      const entrada = p.entrada ? new Date(p.entrada).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '--:--';
      const saida = p.saida ? new Date(p.saida).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '<span style="color:#facc15;">em aberto</span>';
      const horas = p.total_horas ? parseFloat(p.total_horas).toFixed(1) + 'h' : '--';
      return `<div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid #e2e8f0;">
        <span><strong>${esc(p.funcionario_nome)}</strong></span>
        <span>${entrada} → ${saida} <span style="color:var(--text-muted);font-size:12px;">${horas}</span></span>
      </div>`;
    }).join('');
  });
};

// === 7. GERENCIAR COLABORADORES ===
let colaboradoresCache = [];

window.openModalColaboradores = function() {
  document.getElementById('modal-mgr-colaboradores').style.display = 'flex';
  document.getElementById('mgr-colaboradores-form').style.display = 'none';
  document.getElementById('mgr-colab-search').value = '';
  carregarListaColaboradores();
};

function carregarListaColaboradores(filtro) {
  const el = document.getElementById('mgr-colaboradores-lista');
  el.innerHTML = 'Carregando...';
  socket.emit('get_funcionarios');
  socket.once('funcionarios_atualizados', (funcs) => {
    colaboradoresCache = funcs || [];
    renderListaColaboradores(filtro);
  });
}

function renderListaColaboradores(filtro) {
  const el = document.getElementById('mgr-colaboradores-lista');
  let list = colaboradoresCache;
  if (filtro) {
    const f = filtro.toLowerCase();
    list = list.filter(c => c.nome?.toLowerCase().includes(f) || c.cargo?.toLowerCase().includes(f));
  }
  if (!list.length) {
    el.innerHTML = '<div style="text-align:center;padding:20px;color:var(--text-muted);">Nenhum colaborador encontrado.</div>';
    return;
  }
  el.innerHTML = list.map(c => {
    const statusColor = c.status === 'Ativo' ? '#16a34a' : '#94a3b8';
    return `<div style="display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid #e2e8f0;">
      <div style="flex:1;">
        <strong>${esc(c.nome)}</strong><br>
        <span style="font-size:11px;color:var(--text-muted);">${esc(c.cargo || '')} ${c.valor_hora ? '- R$ ' + parseFloat(c.valor_hora).toFixed(2) + '/h' : ''}</span>
      </div>
      <div style="display:flex;gap:4px;align-items:center;">
        <span style="background:${statusColor};color:white;padding:2px 6px;border-radius:4px;font-size:10px;font-weight:600;">${c.status}</span>
        <button onclick="editarColaborador(${c.id})" style="background:none;border:none;cursor:pointer;font-size:16px;color:#6c5ce7;"><i class="ph ph-pencil-simple"></i></button>
        <button onclick="alternarStatusColaborador(${c.id}, '${esc(c.status)}')" style="background:none;border:none;cursor:pointer;font-size:16px;color:${c.status === 'Ativo' ? '#dc2626' : '#16a34a'};"><i class="ph ${c.status === 'Ativo' ? 'ph-prohibit' : 'ph-check-circle'}"></i></button>
      </div>
    </div>`;
  }).join('');
}

window.filtrarColaboradores = function(v) { renderListaColaboradores(v); };

window.abrirFormColaborador = function() {
  document.getElementById('mgr-colab-id').value = '';
  document.getElementById('mgr-colab-nome').value = '';
  document.getElementById('mgr-colab-usuario').value = '';
  document.getElementById('mgr-colab-senha').value = '';
  document.getElementById('mgr-colab-cargo').value = 'Garçom';
  document.getElementById('mgr-colab-valor-hora').value = '';
  document.getElementById('mgr-colab-telefone').value = '';
  document.getElementById('mgr-colaboradores-form').style.display = 'block';
};

window.cancelarFormColaborador = function() {
  document.getElementById('mgr-colaboradores-form').style.display = 'none';
};

window.editarColaborador = function(id) {
  const c = colaboradoresCache.find(x => x.id === id);
  if (!c) return;
  document.getElementById('mgr-colab-id').value = c.id;
  document.getElementById('mgr-colab-nome').value = c.nome || '';
  document.getElementById('mgr-colab-usuario').value = c.usuario || '';
  document.getElementById('mgr-colab-senha').value = '';
  document.getElementById('mgr-colab-cargo').value = c.cargo || 'Garçom';
  document.getElementById('mgr-colab-valor-hora').value = c.valor_hora || '';
  document.getElementById('mgr-colab-telefone').value = c.telefone || '';
  document.getElementById('mgr-colaboradores-form').style.display = 'block';
};

window.salvarColaborador = function() {
  const id = document.getElementById('mgr-colab-id').value;
  const nome = document.getElementById('mgr-colab-nome').value.trim();
  const usuario = document.getElementById('mgr-colab-usuario').value.trim();
  const senha = document.getElementById('mgr-colab-senha').value;
  const cargo = document.getElementById('mgr-colab-cargo').value;
  const valor_hora = parseFloat(document.getElementById('mgr-colab-valor-hora').value) || 0;
  const telefone = document.getElementById('mgr-colab-telefone').value.trim();
  if (!nome || !usuario) return alert('Nome e usuário são obrigatórios.');
  if (!id && !senha) return alert('Informe uma senha para o novo colaborador.');

  const payload = { nome, usuario, cargo, valor_hora, telefone };
  if (senha) payload.senha = senha;

  if (id) {
    payload.id = parseInt(id);
    socket.emit('update_funcionario', payload);
  } else {
    socket.emit('add_funcionario', payload);
  }
  socket.once('funcionarios_atualizados', () => {
    document.getElementById('mgr-colaboradores-form').style.display = 'none';
    alert(id ? 'Colaborador atualizado!' : 'Colaborador adicionado!');
    carregarListaColaboradores();
  });
};

window.alternarStatusColaborador = function(id, statusAtual) {
  const novoStatus = statusAtual === 'Ativo' ? 'Inativo' : 'Ativo';
  if (!confirm(`Deseja ${novoStatus === 'Ativo' ? 'ativar' : 'desativar'} este colaborador?`)) return;
  socket.emit('update_funcionario', { id, status: novoStatus });
  socket.once('funcionarios_atualizados', () => carregarListaColaboradores());
};

// === 8. RELÂMPAGO ===
window.openModalRelampago = function() {
  document.getElementById('modal-mgr-relampago').style.display = 'flex';
  document.getElementById('mgr-relampago-content').innerHTML = 'Carregando...';
  socket.emit('get_dashboard_stats');
  socket.once('dashboard_stats_result', (data) => {
    const el = document.getElementById('mgr-relampago-content');
    if (!el) return;
    el.innerHTML = `
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:12px;">
        <div style="background:#f0fdf4;padding:12px;border-radius:10px;text-align:center;">
          <div style="font-size:11px;color:var(--text-muted);">Faturamento Hoje</div>
          <div style="font-size:22px;font-weight:800;color:#16a34a;">R$ ${(data.faturamentoHoje || 0).toFixed(2)}</div>
        </div>
        <div style="background:#f0f9ff;padding:12px;border-radius:10px;text-align:center;">
          <div style="font-size:11px;color:var(--text-muted);">Faturamento Mês</div>
          <div style="font-size:22px;font-weight:800;color:#2563eb;">R$ ${(data.faturamentoMensal || 0).toFixed(2)}</div>
        </div>
        <div style="background:#fefce8;padding:12px;border-radius:10px;text-align:center;">
          <div style="font-size:11px;color:var(--text-muted);">Pedidos Hoje</div>
          <div style="font-size:22px;font-weight:800;color:#ca8a04;">${data.pedidosHoje || 0}</div>
        </div>
        <div style="background:#f5f3ff;padding:12px;border-radius:10px;text-align:center;">
          <div style="font-size:11px;color:var(--text-muted);">Ticket Médio</div>
          <div style="font-size:22px;font-weight:800;color:#6c5ce7;">R$ ${(data.ticketMedio || 0).toFixed(2)}</div>
        </div>
      </div>
      <div style="background:linear-gradient(135deg,#d1fae5,#a7f3d0);padding:12px;border-radius:10px;text-align:center;margin-bottom:12px;">
        <div style="font-size:11px;color:var(--text-muted);">Projeção de Fechamento do Mês</div>
        <div style="font-size:22px;font-weight:800;color:#059669;">R$ ${(data.projecaoMensal || 0).toFixed(2)}</div>
        <div style="font-size:11px;color:#6b7280;margin-top:2px;">${data.diasTranscorridos || 0} de ${data.diasTotalMes || 0} dias (${data.diasTranscorridos && data.diasTotalMes ? Math.round(data.diasTranscorridos / data.diasTotalMes * 100) : 0}% do mês)</div>
      </div>
      ${(data.produtosPopulares || []).length ? `
        <div style="margin-top:8px;">
          <strong style="font-size:13px;">Produtos Populares (Hoje)</strong>
          ${data.produtosPopulares.slice(0, 5).map(p => `
            <div style="display:flex;justify-content:space-between;padding:4px 0;font-size:13px;border-bottom:1px solid #f1f5f9;">
              <span>${esc(p.productName)}</span>
              <span style="font-weight:600;">${p.qty}x</span>
            </div>
          `).join('')}
        </div>
      ` : ''}
    `;
  });
};

// === 9. STATUS CAIXA ===
window.openModalCaixaStatus = function() {
  document.getElementById('modal-mgr-caixa').style.display = 'flex';
  document.getElementById('mgr-caixa-content').innerHTML = 'Carregando...';
  socket.emit('get_relatorio_caixa');
  socket.once('relatorio_caixa', (data) => {
    const el = document.getElementById('mgr-caixa-content');
    if (!el) return;
    if (!data) {
      el.innerHTML = '<div style="text-align:center;padding:20px;color:var(--text-muted);">Caixa está fechado no momento.</div>';
      return;
    }
    const format = (v) => `R$ ${(v || 0).toFixed(2)}`;
    el.innerHTML = `
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:12px;">
        <div style="background:#f0fdf4;padding:12px;border-radius:10px;text-align:center;">
          <div style="font-size:11px;color:var(--text-muted);">Fundo Troco</div>
          <div style="font-size:18px;font-weight:800;color:#16a34a;">${format(data.fundo_troco)}</div>
        </div>
        <div style="background:#f0f9ff;padding:12px;border-radius:10px;text-align:center;">
          <div style="font-size:11px;color:var(--text-muted);">Dinheiro</div>
          <div style="font-size:18px;font-weight:800;color:#2563eb;">${format(data.total_dinheiro)}</div>
        </div>
        <div style="background:#f5f3ff;padding:12px;border-radius:10px;text-align:center;">
          <div style="font-size:11px;color:var(--text-muted);">PIX</div>
          <div style="font-size:18px;font-weight:800;color:#6c5ce7;">${format(data.total_pix)}</div>
        </div>
        <div style="background:#fefce8;padding:12px;border-radius:10px;text-align:center;">
          <div style="font-size:11px;color:var(--text-muted);">Cartão</div>
          <div style="font-size:18px;font-weight:800;color:#ca8a04;">${format((data.total_credito || 0) + (data.total_debito || 0))}</div>
        </div>
      </div>
      <div style="font-size:13px;border-top:1px solid #e2e8f0;padding-top:8px;">
        ${data.total_sangria > 0 ? `<div style="display:flex;justify-content:space-between;"><span>Sangrias</span><span style="color:#dc2626;">${format(data.total_sangria)}</span></div>` : ''}
        ${data.total_suprimento > 0 ? `<div style="display:flex;justify-content:space-between;"><span>Suprimentos</span><span style="color:#16a34a;">${format(data.total_suprimento)}</span></div>` : ''}
      </div>
    `;
  });
};

// === 10. GESTÃO DE ESTOQUE ===
let estoqueProdutosCache = [];

window.openModalEstoque = function() {
  document.getElementById('modal-mgr-estoque').style.display = 'flex';
  mostrarAbaEstoque('entrada');
  // Load products and NFs for dropdowns
  socket.emit('get_estoque_produtos');
  socket.once('estoque_produtos_list', (prods) => {
    estoqueProdutosCache = prods || [];
    const sel = document.getElementById('mgr-estq-produto');
    if (!sel) return;
    sel.innerHTML = '<option value="">Selecione...</option>' +
      prods.map(p => `<option value="${p.id}" data-categoria="${p.categoria}">${esc(p.emoji || '')} ${esc(p.nome)} (${esc(p.categoria)}) — Est: ${p.estoque || 0}</option>`).join('');
  });
  socket.emit('get_nf_mercadorias');
  socket.once('nf_mercadorias_list', (nfs) => {
    const sel = document.getElementById('mgr-estq-nf');
    if (!sel) return;
    sel.innerHTML = '<option value="">Nenhuma</option>' +
      (nfs || []).map(n => `<option value="${n.id}">NF ${esc(n.numero_nf)} — ${esc(n.fornecedor)}</option>`).join('');
  });
};

window.buscarProdutoPorBarcode = function() {
  const input = document.getElementById('mgr-estq-barcode');
  const codigo = input ? input.value.trim() : '';
  if (!codigo) return;
  socket.emit('get_produto_by_barcode', codigo);
  socket.once('produto_by_barcode_result', (prod) => {
    const sel = document.getElementById('mgr-estq-produto');
    if (!sel) return;
    if (!prod) {
      alert('Produto não encontrado para o código de barras informado.');
      return;
    }
    // Select the product in dropdown
    for (let i = 0; i < sel.options.length; i++) {
      if (parseInt(sel.options[i].value) === prod.id) {
        sel.selectedIndex = i;
        break;
      }
    }
    input.value = '';
    document.getElementById('mgr-estq-qtd').focus();
  });
};

window.mostrarAbaEstoque = function(aba) {
  document.getElementById('mgr-estq-entrada').style.display = aba === 'entrada' ? 'block' : 'none';
  document.getElementById('mgr-estq-atual').style.display = aba === 'atual' ? 'block' : 'none';
  document.getElementById('mgr-estq-validade-aba').style.display = aba === 'validade' ? 'block' : 'none';
  document.getElementById('mgr-estq-movimentos').style.display = aba === 'movimentos' ? 'block' : 'none';
  if (aba === 'atual') renderEstoqueAtual();
  if (aba === 'validade') carregarProdutosValidade();
  if (aba === 'movimentos') carregarMovimentosEstoque();
  const btns = document.querySelectorAll('#modal-mgr-estoque .btn-main');
  const cores = { entrada: 0, atual: 1, validade: 2, movimentos: 3 };
  btns.forEach((b, i) => {
    b.style.background = i === cores[aba] ? '#9b59b6' : '#2c3e50';
  });
};

window.confirmarEntradaEstoque = function() {
  const produto_id = parseInt(document.getElementById('mgr-estq-produto').value);
  const quantidade = parseFloat(document.getElementById('mgr-estq-qtd').value);
  const custo_unitario = parseFloat(document.getElementById('mgr-estq-custo').value) || 0;
  const fornecedor = document.getElementById('mgr-estq-fornecedor').value.trim();
  const data_validade = document.getElementById('mgr-estq-validade').value || null;
  const nf_mercadoria_id = parseInt(document.getElementById('mgr-estq-nf').value) || null;
  const observacao = document.getElementById('mgr-estq-obs').value.trim();
  if (!produto_id) return alert('Selecione um produto.');
  if (!quantidade || quantidade <= 0) return alert('Informe a quantidade.');
  socket.emit('add_estoque_movimento', { produto_id, tipo: 'entrada', quantidade, custo_unitario, fornecedor, data_validade, nf_mercadoria_id, observacao });
  socket.once('estoque_movimento_adicionado', () => {
    document.getElementById('mgr-estq-qtd').value = '';
    document.getElementById('mgr-estq-custo').value = '';
    document.getElementById('mgr-estq-fornecedor').value = '';
    document.getElementById('mgr-estq-validade').value = '';
    document.getElementById('mgr-estq-obs').value = '';
    alert('Entrada de estoque registrada!');
    mostrarAbaEstoque('atual');
  });
  socket.once('estoque_erro', (msg) => alert(msg));
};

window.carregarProdutosValidade = function() {
  const el = document.getElementById('mgr-estq-validade-lista');
  if (!el) return;
  el.innerHTML = 'Carregando...';
  const dias = parseInt(document.getElementById('mgr-validade-dias').value) || 30;
  socket.emit('get_produtos_validade', dias);
  socket.once('produtos_validade_result', (prods) => {
    if (!el) return;
    if (!prods || !prods.length) {
      el.innerHTML = '<div style="text-align:center;padding:20px;color:var(--text-muted);">Nenhum produto próximo ao vencimento.</div>';
      return;
    }
    const hoje = new Date();
    el.innerHTML = prods.map(p => {
      const venc = new Date(p.data_validade + 'T23:59:59');
      const diff = Math.ceil((venc - hoje) / (1000 * 60 * 60 * 24));
      const diasLabel = diff <= 0 ? '<span style="color:#dc2626;font-weight:700;">VENCIDO</span>'
        : diff <= 7 ? `<span style="color:#dc2626;font-weight:700;">${diff}d</span>`
        : diff <= 14 ? `<span style="color:#eab308;font-weight:600;">${diff}d</span>`
        : diff <= 30 ? `<span style="color:#f97316;">${diff}d</span>`
        : `<span style="color:var(--text-muted);">${diff}d</span>`;
      const valorTotal = (p.estoque_atual || 0) * (p.produto_preco || 0);
      return `<div style="padding:8px 0;border-bottom:1px solid #e2e8f0;">
        <div style="display:flex;justify-content:space-between;align-items:center;">
          <div>
            <strong>${esc(p.produto_emoji || '')} ${esc(p.produto_nome)}</strong><br>
            <span style="font-size:11px;color:var(--text-muted);">${esc(p.produto_categoria)} | Est: ${p.estoque_atual || 0} un | R$ ${valorTotal.toFixed(2)}</span>
          </div>
          <div style="text-align:right;">
            <div style="font-size:18px;font-weight:800;">${diasLabel}</div>
            <div style="font-size:10px;color:var(--text-muted);">${new Date(p.data_validade).toLocaleDateString('pt-BR')}</div>
          </div>
        </div>
        <div style="display:flex;gap:6px;margin-top:6px;flex-wrap:wrap;">
          <button class="btn-main" style="flex:1;font-size:11px;padding:6px;background:#2563eb;" onclick="alert('Ação: Criar combo com ${esc(p.produto_nome)}')"><i class="ph ph-stack"></i> Criar Combo</button>
          <button class="btn-main" style="flex:1;font-size:11px;padding:6px;background:#16a34a;" onclick="alert('Ação: Aplicar desconto em ${esc(p.produto_nome)}')"><i class="ph ph-percent"></i> Desconto</button>
          <button class="btn-main" style="flex:1;font-size:11px;padding:6px;background:#dc2626;" onclick="alert('Ação: Descartar ${esc(p.produto_nome)}')"><i class="ph ph-trash"></i> Descartar</button>
        </div>
      </div>`;
    }).join('');
  });
};

window.renderEstoqueAtual = function(filtro) {
  const el = document.getElementById('mgr-estq-atual-lista');
  if (!el) return;
  let list = estoqueProdutosCache;
  if (filtro) {
    const f = filtro.toLowerCase();
    list = list.filter(p => p.nome?.toLowerCase().includes(f) || p.categoria?.toLowerCase().includes(f));
  }
  if (!list.length) {
    el.innerHTML = '<div style="text-align:center;padding:20px;color:var(--text-muted);">Nenhum produto encontrado.</div>';
    return;
  }
  // Re-query fresh data
  socket.emit('get_produtos');
  socket.once('produtos_atualizados', (prods) => {
    estoqueProdutosCache = prods || [];
    list = prods || [];
    if (filtro) { const f = filtro.toLowerCase(); list = list.filter(p => p.nome?.toLowerCase().includes(f) || p.categoria?.toLowerCase().includes(f)); }
    el.innerHTML = list.map(p => `
      <div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid #e2e8f0;">
        <div><strong>${esc(p.emoji || '')} ${esc(p.nome)}</strong><br><span style="font-size:11px;color:var(--text-muted);">${esc(p.categoria)} | Custo: R$ ${parseFloat(p.custo || 0).toFixed(2)} | Venda: R$ ${parseFloat(p.preco || 0).toFixed(2)}</span></div>
        <div style="text-align:right;">
          <span style="font-size:18px;font-weight:800;color:${(p.estoque || 0) > 0 ? '#16a34a' : '#dc2626'};">${p.estoque || 0}</span>
          <br><span style="font-size:10px;color:var(--text-muted);">em estoque</span>
        </div>
      </div>
    `).join('');
  });
};

window.carregarMovimentosEstoque = function() {
  const el = document.getElementById('mgr-estq-mov-lista');
  if (!el) return;
  el.innerHTML = 'Carregando...';
  const filtro = {
    start_date: document.getElementById('mgr-estq-mov-dtini').value || undefined,
    end_date: document.getElementById('mgr-estq-mov-dtfim').value || undefined
  };
  if (!filtro.start_date) delete filtro.start_date;
  if (!filtro.end_date) delete filtro.end_date;
  socket.emit('get_estoque_movimentacoes', filtro);
  socket.once('estoque_movimentacoes_list', (movs) => {
    if (!movs || !movs.length) {
      el.innerHTML = '<div style="text-align:center;padding:20px;color:var(--text-muted);">Nenhum movimento encontrado.</div>';
      return;
    }
    el.innerHTML = movs.map(m => {
      const cor = m.tipo === 'entrada' ? '#16a34a' : '#dc2626';
      const sinal = m.tipo === 'entrada' ? '+' : '-';
      const data = m.data_movimento ? new Date(m.data_movimento).toLocaleString('pt-BR') : '';
      return `<div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid #f1f5f9;">
        <div>
          <strong>${esc(m.produto_nome)}</strong><br>
          <span style="font-size:11px;color:var(--text-muted);">${data} ${m.fornecedor ? '— ' + esc(m.fornecedor) : ''}</span>
        </div>
        <div style="text-align:right;">
          <span style="font-weight:700;color:${cor};">${sinal}${m.quantidade}</span><br>
          <span style="font-size:11px;color:var(--text-muted);">R$ ${parseFloat(m.custo_unitario || 0).toFixed(2)}/un</span>
        </div>
      </div>`;
    }).join('');
  });
};

// === 11. PROJEÇÃO DE GANHOS ===
window.openModalProjecao = function() {
  document.getElementById('modal-mgr-projecao').style.display = 'flex';
  // Default to current month
  const now = new Date();
  const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
  document.getElementById('mgr-proj-dtini').value = firstDay.toISOString().split('T')[0];
  document.getElementById('mgr-proj-dtfim').value = now.toISOString().split('T')[0];
  carregarProjecao();
};

window.carregarProjecao = function() {
  const el = document.getElementById('mgr-projecao-content');
  if (!el) return;
  el.innerHTML = 'Carregando...';
  const filtro = {
    start_date: document.getElementById('mgr-proj-dtini').value || undefined,
    end_date: document.getElementById('mgr-proj-dtfim').value || undefined
  };
  if (!filtro.start_date) delete filtro.start_date;
  if (!filtro.end_date) delete filtro.end_date;
  socket.emit('get_estoque_metrics', filtro);
  socket.once('estoque_metrics_result', (data) => {
    if (!el) return;
    const format = (v) => `R$ ${(v || 0).toFixed(2)}`;
    el.innerHTML = `
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:12px;">
        <div style="background:#f0fdf4;padding:12px;border-radius:10px;text-align:center;">
          <div style="font-size:11px;color:var(--text-muted);">Custo Total Estoque</div>
          <div style="font-size:20px;font-weight:800;color:#dc2626;">${format(data.custo_total)}</div>
        </div>
        <div style="background:#f0f9ff;padding:12px;border-radius:10px;text-align:center;">
          <div style="font-size:11px;color:var(--text-muted);">Receita Potencial</div>
          <div style="font-size:20px;font-weight:800;color:#2563eb;">${format(data.receita_potencial)}</div>
        </div>
        <div style="background:#fefce8;padding:12px;border-radius:10px;text-align:center;">
          <div style="font-size:11px;color:var(--text-muted);">Lucro Projetado</div>
          <div style="font-size:20px;font-weight:800;color:#16a34a;">${format(data.lucro_potencial)}</div>
        </div>
        <div style="background:#f5f3ff;padding:12px;border-radius:10px;text-align:center;">
          <div style="font-size:11px;color:var(--text-muted);">Produtos em Estoque</div>
          <div style="font-size:20px;font-weight:800;color:#6c5ce7;">${data.total_produtos_estoque}</div>
        </div>
      </div>
      <div style="border-top:1px solid #e2e8f0;padding-top:12px;">
        <strong style="font-size:14px;">Período Filtrado</strong>
        <div style="display:flex;justify-content:space-between;padding:4px 0;font-size:13px;">
          <span>Total entradas (custo)</span>
          <span style="font-weight:600;">${format(data.total_entradas_periodo)}</span>
        </div>
        <div style="display:flex;justify-content:space-between;padding:4px 0;font-size:13px;">
          <span>Total itens entrados</span>
          <span style="font-weight:600;">${data.total_itens_entrados_periodo}</span>
        </div>
        <div style="display:flex;justify-content:space-between;padding:4px 0;font-size:13px;">
          <span>Total NF recebidas</span>
          <span style="font-weight:600;">${format(data.total_nfs_periodo)}</span>
        </div>
        <div style="display:flex;justify-content:space-between;padding:4px 0;font-size:13px;margin-top:8px;border-top:1px solid #e2e8f0;padding-top:8px;color:var(--text-muted);">
          <span>Margem projetada</span>
          <span style="font-weight:700;color:${data.receita_potencial > data.custo_total ? '#16a34a' : '#dc2626'};">
            ${data.custo_total > 0 ? ((data.receita_potencial - data.custo_total) / data.custo_total * 100).toFixed(1) : '0'}%
          </span>
        </div>
      </div>
    `;
  });
};
