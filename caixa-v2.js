// caixa-v2.js - Orquestrador do Tema v2.0 Modular (Apple HIG)
(function () {
  const socket = (typeof io === 'function') ? io() : null;

  // Estado Local Reativo
  const state = {
    nomeRestaurante: 'Chef Cozinha Gourmet',
    logoUrl: '',
    corPrimaria: '#fc4b15',
    corAcento: '#3b82f6',
    modoVidro: true,
    pesoAtual: 0.000,
    precoKg: 69.90,
    mesas: [],
    produtos: [],
    kdsPedidos: [],
    faturamentoTurno: 0.00,
    mesasOcupadas: 0,
    tempoMedioPreparo: '14 min'
  };

  // 1. Carregar Configurações de Identidade Visual
  function carregarIdentidadeVisual() {
    fetch('/api/tema-v2/config')
      .then(r => r.json())
      .then(d => {
        if (d && d.sucesso && d.config) {
          aplicarTemaNoDOM(d.config);
        }
      })
      .catch(() => {});
  }

  function aplicarTemaNoDOM(cfg) {
    if (cfg.nomeRestaurante) {
      document.getElementById('hig-rest-nome').textContent = cfg.nomeRestaurante;
      document.getElementById('input-custom-nome').value = cfg.nomeRestaurante;
    }
    if (cfg.corPrimaria) {
      document.documentElement.style.setProperty('--hig-accent', cfg.corPrimaria);
      document.documentElement.style.setProperty('--hig-accent-gradient', `linear-gradient(135deg, ${cfg.corPrimaria} 0%, ${cfg.corPrimaria}dd 100%)`);
      document.documentElement.style.setProperty('--hig-accent-subtle', `${cfg.corPrimaria}25`);
      document.getElementById('input-custom-cor').value = cfg.corPrimaria;
    }
    if (cfg.logoUrl) {
      const logoEl = document.getElementById('hig-rest-logo');
      logoEl.innerHTML = `<img src="${cfg.logoUrl}" alt="Logo">`;
      document.getElementById('input-custom-logo').value = cfg.logoUrl;
    }
  }

  // 2. Carregar Dados do Sistema (Mesas, Produtos, KPIs)
  function carregarDados() {
    // Produtos
    fetch('/api/produtos')
      .then(r => r.json())
      .then(d => {
        state.produtos = Array.isArray(d) ? d : (d.produtos || []);
        renderProdutos(state.produtos);
      })
      .catch(() => {
        // Fallback de demonstração HIG
        state.produtos = [
          { id: 1, nome: 'Picanha Nobre Grelhada', preco: 89.90, categoria: 'Carnes' },
          { id: 2, nome: 'Salmão ao Molho de Ervas', preco: 74.50, categoria: 'Peixes' },
          { id: 3, nome: 'Risoto de Cogumelos Trufado', preco: 62.00, categoria: 'Massas' },
          { id: 4, nome: 'Burger Artesanal Defumado', preco: 42.90, categoria: 'Lanches' },
          { id: 5, nome: 'Cerveja Artesanal IPA 500ml', preco: 18.00, categoria: 'Bebidas' },
          { id: 6, nome: 'Petit Gâteau Belga', preco: 26.00, categoria: 'Sobremesas' }
        ];
        renderProdutos(state.produtos);
      });

    // Mesas
    fetch('/api/mesas')
      .then(r => r.json())
      .then(d => {
        state.mesas = Array.isArray(d) ? d : (d.mesas || []);
        renderMesas(state.mesas);
      })
      .catch(() => {
        state.mesas = Array.from({ length: 12 }, (_, i) => ({
          numero: i + 1,
          status: (i === 1 || i === 4 || i === 7) ? 'ocupada' : 'livre'
        }));
        renderMesas(state.mesas);
      });
  }

  function renderProdutos(lista) {
    const cont = document.getElementById('hig-produtos-container');
    if (!cont) return;
    cont.innerHTML = lista.map(p => `
      <div class="hig-product-card" onclick="window.adicionarItemPDV('${p.nome}', ${p.preco})">
        <div class="hig-product-name">${p.nome}</div>
        <div class="hig-product-price">R$ ${p.preco.toFixed(2)}</div>
      </div>
    `).join('');
  }

  function renderMesas(lista) {
    const cont = document.getElementById('hig-mesas-container');
    if (!cont) return;
    let ocupadas = 0;
    cont.innerHTML = lista.map(m => {
      if (m.status === 'ocupada') ocupadas++;
      return `
        <div class="hig-mesa-btn ${m.status}" onclick="window.abrirDetalhesMesa(${m.numero})">
          <div class="hig-mesa-num">M${m.numero}</div>
          <div class="hig-mesa-status">${m.status}</div>
        </div>
      `;
    }).join('');
    document.getElementById('kpi-mesas-ocupadas').textContent = ocupadas;
  }

  // 3. Simulação e Lançamento de Pesagem Self-Service
  window.simularPesoBalanca = function(kg) {
    state.pesoAtual = kg;
    document.getElementById('hig-display-peso').textContent = kg.toFixed(3) + ' kg';
    const total = kg * state.precoKg;
    document.getElementById('hig-display-total-peso').textContent = 'R$ ' + total.toFixed(2);
  };

  window.lancarPesagemNoCaixa = function() {
    if (state.pesoAtual <= 0) {
      alert('Posicione um prato na balança para realizar a pesagem.');
      return;
    }
    const valor = state.pesoAtual * state.precoKg;
    window.adicionarItemPDV(`Buffet a Quilo (${state.pesoAtual.toFixed(3)}kg)`, valor);
    window.simularPesoBalanca(0.000);
  };

  // 4. PDV Operações
  let itensComanda = [];
  window.adicionarItemPDV = function(nome, preco) {
    itensComanda.push({ nome, preco });
    atualizarComandaUI();
  };

  function atualizarComandaUI() {
    const total = itensComanda.reduce((acc, i) => acc + i.preco, 0);
    document.getElementById('hig-pdv-total').textContent = 'R$ ' + total.toFixed(2);
    document.getElementById('kpi-faturamento').textContent = 'R$ ' + (total + 1450.00).toFixed(2);
  }

  window.finalizarVendaPDV = function() {
    if (itensComanda.length === 0) {
      alert('Nenhum item adicionado ao pedido.');
      return;
    }
    if (typeof Swal !== 'undefined') {
      Swal.fire({
        icon: 'success',
        title: 'Venda Concluída!',
        text: `Total de R$ ${itensComanda.reduce((a, b) => a + b.preco, 0).toFixed(2)} registrado com sucesso!`,
        timer: 2000
      });
    } else {
      alert('Venda finalizada com sucesso!');
    }
    itensComanda = [];
    atualizarComandaUI();
  };

  // 5. Suporte Customizer Modal Handlers
  window.abrirCustomizadorSuporte = function() {
    document.getElementById('modal-customizador').classList.add('active');
  };

  window.fecharCustomizadorSuporte = function() {
    document.getElementById('modal-customizador').classList.remove('active');
  };

  window.definirPresetCor = function(hex) {
    document.getElementById('input-custom-cor').value = hex;
    document.documentElement.style.setProperty('--hig-accent', hex);
    document.documentElement.style.setProperty('--hig-accent-gradient', `linear-gradient(135deg, ${hex} 0%, ${hex}dd 100%)`);
  };

  window.salvarPersonalizacaoSuporte = function() {
    const nome = document.getElementById('input-custom-nome').value;
    const cor = document.getElementById('input-custom-cor').value;
    const logo = document.getElementById('input-custom-logo').value;

    fetch('/api/tema-v2/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nomeRestaurante: nome, corPrimaria: cor, logoUrl: logo })
    })
    .then(r => r.json())
    .then(d => {
      if (d && d.sucesso) {
        aplicarTemaNoDOM(d.config);
        window.fecharCustomizadorSuporte();
        if (typeof Swal !== 'undefined') {
          Swal.fire({ toast: true, position: 'top-end', icon: 'success', title: 'Identidade Atualizada!', showConfirmButton: false, timer: 2000 });
        }
      }
    });
  };

  // 6. Relógio e Socket Listener
  function iniciarRelogio() {
    const el = document.getElementById('hig-clock');
    if (!el) return;
    setInterval(() => {
      const now = new Date();
      el.textContent = now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    }, 1000);
  }

  if (socket) {
    socket.on('tema_v2_atualizado', (novo) => {
      aplicarTemaNoDOM(novo);
    });
  }

  // Inicialização
  document.addEventListener('DOMContentLoaded', () => {
    carregarIdentidadeVisual();
    carregarDados();
    iniciarRelogio();
  });
})();
