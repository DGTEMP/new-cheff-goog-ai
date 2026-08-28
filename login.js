
// ─── MODAL DE ESCOLHA DE ESTAÇÃO DE TRABALHO (QUANDO HÁ MÚLTIPLAS PERMISSÕES) ───
window.abrirModalEscolhaEstacao = function(data) {
  let modal = document.getElementById('modal-escolha-estacao');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'modal-escolha-estacao';
    modal.style.cssText = 'position:fixed; inset:0; z-index:10000; background:rgba(15,23,42,0.6); backdrop-filter:blur(8px); display:flex; align-items:center; justify-content:center; padding:16px;';
    document.body.appendChild(modal);
  }

  const estacoes = data.estacoes || ['garcom'];
  const nomeColab = data.nome || 'Colaborador';

  const estacoesConfig = {
    garcom: { titulo: 'Salão de Mesas & Comandas', sub: 'Atendimento e Lançamento de Pedidos', icone: 'ph-fork-knife', cor: '#fc4b15', url: '/garcom.html' },
    caixa: { titulo: 'Terminal de Caixa (PDV)', sub: 'Operação de Caixa, Fechamento e Pagamentos', icone: 'ph-desktop', cor: '#3b82f6', url: '/index.html' },
    cozinha: { titulo: 'KDS Cozinha & Preparo', sub: 'Fila de Pedidos e Controle de Produção', icone: 'ph-fire', cor: '#10b981', url: '/fila-pedidos.html' },
    gestao: { titulo: 'Painel do Dono & Gestão', sub: 'Relatórios, Faturamento e Configurações', icone: 'ph-crown', cor: '#a855f7', url: '/painel-dono.html' }
  };

  let cardsHtml = '';
  estacoes.forEach(est => {
    const cfg = estacoesConfig[est];
    if (cfg) {
      cardsHtml += `
        <button type="button" onclick="window.selecionarEstacaoTrabalho('${cfg.url}', '${est}')" style="display:flex; align-items:center; gap:16px; width:100%; padding:16px; background:#f8fafc; border:2px solid #e2e8f0; border-radius:16px; cursor:pointer; text-align:left; transition:all 0.15s; margin-bottom:10px;">
          <div style="width:50px; height:50px; border-radius:14px; background:${cfg.cor}18; color:${cfg.cor}; display:flex; align-items:center; justify-content:center; font-size:26px; flex-shrink:0;">
            <i class="ph-bold ${cfg.icone}"></i>
          </div>
          <div style="flex:1; min-width:0;">
            <strong style="display:block; font-size:16px; color:#0f172a; margin-bottom:2px;">${cfg.titulo}</strong>
            <span style="font-size:12.5px; color:#64748b;">${cfg.sub}</span>
          </div>
          <i class="ph-bold ph-arrow-right" style="color:#94a3b8; font-size:20px;"></i>
        </button>
      `;
    }
  });

  modal.innerHTML = `
    <div style="background:#ffffff; border-radius:24px; padding:28px; width:100%; max-width:480px; box-shadow:0 20px 50px rgba(0,0,0,0.25); text-align:center;">
      <div style="width:56px; height:56px; border-radius:18px; background:rgba(37,99,235,0.1); color:#2563eb; display:flex; align-items:center; justify-content:center; font-size:30px; margin:0 auto 16px;">
        <i class="ph-bold ph-identification-badge"></i>
      </div>
      <h2 style="font-size:22px; font-weight:800; color:#0f172a; margin-bottom:6px;">Olá, ${nomeColab}!</h2>
      <p style="color:#64748b; font-size:13.5px; margin-bottom:20px;">Selecione a estação de trabalho autorizada para seu turno:</p>
      
      <div style="display:flex; flex-direction:column; gap:4px; max-height:55vh; overflow-y:auto;">
        ${cardsHtml}
      </div>

      <button onclick="document.getElementById('modal-escolha-estacao').style.display='none'" style="margin-top:14px; background:transparent; border:none; color:#94a3b8; font-weight:700; font-size:13px; cursor:pointer;">
        Cancelar
      </button>
    </div>
  `;
  modal.style.display = 'flex';
};

window.selecionarEstacaoTrabalho = function(url, estacaoNome) {
  localStorage.setItem('chef_estacao_atual', estacaoNome);
  window.location.href = url;
};


let _tipoPerfil = 'owner'; // 'owner' ou 'colaborador'
let _modoColaborador = 'pin'; // 'pin' ou 'user'
let _loginResAtual = null;

window.setTipoPerfil = function(tipo) {
  _tipoPerfil = tipo;
  const btnOwner = document.getElementById('tab-login-owner');
  const btnColab = document.getElementById('tab-login-colaborador');
  const formOwner = document.getElementById('form-owner-side');
  const formColab = document.getElementById('form-colaborador-side');
  const title = document.getElementById('login-title');
  const subtitle = document.getElementById('login-subtitle');

  if (tipo === 'owner') {
    if (btnOwner) { btnOwner.style.background = 'var(--primary)'; btnOwner.style.color = 'white'; btnOwner.style.fontWeight = '800'; }
    if (btnColab) { btnColab.style.background = 'transparent'; btnColab.style.color = 'var(--text-muted)'; btnColab.style.fontWeight = '700'; }
    if (formOwner) formOwner.style.display = 'block';
    if (formColab) formColab.style.display = 'none';
    if (title) title.innerText = 'Painel do Proprietário';
    if (subtitle) subtitle.innerText = 'Acesse a gestão, relatórios e controle financeiro.';
  } else {
    if (btnOwner) { btnOwner.style.background = 'transparent'; btnOwner.style.color = 'var(--text-muted)'; btnOwner.style.fontWeight = '700'; }
    if (btnColab) { btnColab.style.background = '#2563eb'; btnColab.style.color = 'white'; btnColab.style.fontWeight = '800'; }
    if (formOwner) formOwner.style.display = 'none';
    if (formColab) formColab.style.display = 'block';
    if (title) title.innerText = 'Acesso do Colaborador';
    if (subtitle) subtitle.innerText = 'Digite seu PIN ou usuário para abrir suas rotas operacionais.';
  }
};

window.setModoColaborador = function(modo) {
  _modoColaborador = modo;
  const btnPin = document.getElementById('btn-colab-mode-pin');
  const btnUser = document.getElementById('btn-colab-mode-user');
  const pinBox = document.getElementById('colab-pin-box');
  const userBox = document.getElementById('colab-user-box');

  if (modo === 'pin') {
    if (btnPin) { btnPin.style.background = 'rgba(37,99,235,0.12)'; btnPin.style.color = '#2563eb'; btnPin.style.borderColor = 'rgba(37,99,235,0.3)'; }
    if (btnUser) { btnUser.style.background = '#f1f5f9'; btnUser.style.color = '#64748b'; btnUser.style.borderColor = '#e2e8f0'; }
    if (pinBox) pinBox.style.display = 'block';
    if (userBox) userBox.style.display = 'none';
    document.getElementById('colab-pin-input')?.focus();
  } else {
    if (btnPin) { btnPin.style.background = '#f1f5f9'; btnPin.style.color = '#64748b'; btnPin.style.borderColor = '#e2e8f0'; }
    if (btnUser) { btnUser.style.background = 'rgba(37,99,235,0.12)'; btnUser.style.color = '#2563eb'; btnUser.style.borderColor = 'rgba(37,99,235,0.3)'; }
    if (pinBox) pinBox.style.display = 'none';
    if (userBox) userBox.style.display = 'block';
    document.getElementById('colab-user-input')?.focus();
  }
};

function vibrar(ms) {
  try { if (navigator.vibrate) navigator.vibrate(ms || 10); } catch (e) {}
}

// ─── LOGIN DO OWNER / PROPRIETÁRIO ───
window.attemptOwnerLogin = async function() {
  const usernameInput = document.getElementById('username');
  const passwordInput = document.getElementById('password');
  const errorMsg = document.getElementById('error-msg');
  const btnSubmit = document.getElementById('btn-submit');

  const email = usernameInput.value.trim();
  const senha = passwordInput.value.trim();
  if (!email || !senha) {
    errorMsg.innerText = 'Preencha usuário/e-mail e senha!';
    errorMsg.style.display = 'block';
    return;
  }

  errorMsg.style.display = 'none';
  btnSubmit.innerText = 'Autenticando...';
  btnSubmit.disabled = true;

  try {
    const response = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, senha })
    });
    const res = await response.json();

    if (res.success) {
      localStorage.setItem('chef_token', res.token);
      localStorage.setItem('restaurante_id', String(res.restaurante_id || 1));
      localStorage.setItem('usuario_role', res.role || 'garcom');
      localStorage.setItem('colaborador_cargo', res.role || 'garcom');
      localStorage.setItem('usuario_logado', res.nome || 'Colaborador');
      localStorage.setItem('chef_permissoes_estacoes', JSON.stringify(res.estacoes || []));
      localStorage.setItem('chef_credentials', JSON.stringify({
        id: res.id || null,
        cargo: res.role || 'garcom',
        role: res.role || 'garcom',
        nome: res.nome || 'Colaborador',
        estacoes: res.estacoes || []
      }));

      vibrar([10, 40, 10]);

      // Se possui mais de uma estação autorizada, deixa o colaborador escolher
      if (Array.isArray(res.estacoes) && res.estacoes.length > 1) {
        btnSubmit.innerText = 'Escolha sua estação...';
        window.abrirModalEscolhaEstacao(res);
        return;
      }

      window.location.href = res.redirectUrl || '/garcom.html';
    } else {
      errorMsg.innerText = res.error || 'PIN ou credencial inválida.';
      errorMsg.style.display = 'block';
      btnSubmit.innerText = 'Validar e Entrar';
      btnSubmit.disabled = false;
    }
  } catch (err) {
    errorMsg.innerText = 'Erro ao conectar no servidor.';
    errorMsg.style.display = 'block';
    btnSubmit.innerText = 'Validar e Entrar';
    btnSubmit.disabled = false;
  }
};

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('password')?.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') attemptOwnerLogin();
  });
  document.getElementById('colab-pin-input')?.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') attemptColaboradorLogin();
  });
  document.getElementById('colab-pass-input')?.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') attemptColaboradorLogin();
  });
});
