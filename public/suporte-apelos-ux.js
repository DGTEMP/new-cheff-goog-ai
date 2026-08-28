/**
 * suporte-apelos-ux.js — Gerador de Apelos e Argumentos de Vendas baseados nos 3 Pilares da Usabilidade
 */
(function (window) {
  'use strict';

  const apelos = [
    {
      pilar: '🎯 Eficácia (Precisão & Zero Falhas)',
      tag: 'Eficácia',
      cor: '#10b981',
      icone: 'ph-target',
      titulo: 'Zero Erro de Fechamento no Caixa',
      texto: 'O Chef Cozinha possui conferência automática de pagamentos parciais e sincronização em tempo real: você tem zero divergência de centavos e fechamentos 100% precisos todos os dias.'
    },
    {
      pilar: '⚡ Eficiência (Velocidade & 1-Clique)',
      tag: 'Eficiência',
      cor: '#fc4b15',
      icone: 'ph-lightning',
      titulo: 'Atendimento 65% Mais Rápido',
      texto: 'Com atalhos de teclado inteligentes (F2, F4, F8) e ações em 1-clique com botões de cédulas rápidas, sua equipe reduz as filas do caixa e fecha contas em menos da metade do tempo.'
    },
    {
      pilar: '💎 Satisfação (Experiência Apple)',
      tag: 'Satisfação',
      cor: '#8b5cf6',
      icone: 'ph-sparkle',
      titulo: 'Experiência Fluida Padrão Apple',
      texto: 'Navegação contínua inspirada no macOS e iOS com aceleração gráfica e transições naturais. Seus colaboradores aprendem a usar em menos de 5 minutos e adoram o sistema.'
    },
    {
      pilar: '✂️ Eficácia & Divisão de Contas',
      tag: 'Fracionamento',
      cor: '#0ea5e9',
      icone: 'ph-scissors',
      titulo: 'Divisão de Itens Descomplicada',
      texto: 'Seus clientes querem dividir uma pizza ou garrafa de vinho entre mesas ou pessoas? O garçom fraciona na hora e o caixa acompanha a barra de progresso do pagamento em tempo real.'
    }
  ];

  window.copiarApeloSuporte = function (index, btnEl) {
    const item = apelos[index];
    if (!item) return;

    const textoCompleto = `*${item.titulo}*\n${item.texto}`;
    navigator.clipboard.writeText(textoCompleto).then(() => {
      if (btnEl) {
        const original = btnEl.innerHTML;
        btnEl.innerHTML = '<i class="ph-bold ph-check"></i> Copiado!';
        btnEl.style.background = '#10b981';
        btnEl.style.color = '#fff';
        setTimeout(() => {
          btnEl.innerHTML = original;
          btnEl.style.background = '';
          btnEl.style.color = '';
        }, 2000);
      }
      if (typeof window.showToast === 'function') {
        window.showToast('Apelo copiado para a área de transferência!', 'success');
      }
    });
  };

  window.renderizarPainelApelosSuporte = function (containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;

    let html = `
      <div style="background:var(--bg-card, #ffffff); border:1px solid var(--border-color, #e2e8f0); border-radius:16px; padding:20px; margin-bottom:24px; box-shadow:0 4px 20px rgba(0,0,0,0.03);">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px;">
          <div>
            <h3 style="margin:0; font-size:17px; font-weight:800; color:#0f172a; display:flex; align-items:center; gap:8px;">
              <span style="background:linear-gradient(135deg, #fc4b15, #ff7a45); color:white; width:28px; height:28px; border-radius:8px; display:inline-flex; align-items:center; justify-content:center; font-size:15px;">💡</span>
              Apelos de Vendas & Suporte (3 Pilares da Usabilidade)
            </h3>
            <p style="margin:4px 0 0; font-size:13px; color:#64748b;">Copie argumentos de alto impacto com 1-clique para usar no atendimento e conversão de clientes.</p>
          </div>
        </div>

        <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(280px, 1fr)); gap:14px;">
    `;

    apelos.forEach((a, idx) => {
      html += `
        <div style="background:#f8fafc; border:1.5px solid #e2e8f0; border-radius:12px; padding:16px; display:flex; flex-direction:column; justify-content:space-between; gap:12px; transition:transform 0.2s ease;">
          <div>
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
              <span style="font-size:11px; font-weight:800; color:${a.cor}; background:rgba(0,0,0,0.04); padding:3px 8px; border-radius:6px;">${a.tag}</span>
              <span style="color:${a.cor}; font-size:18px;"><i class="ph-bold ${a.icone}"></i></span>
            </div>
            <h4 style="margin:0 0 6px; font-size:14px; font-weight:700; color:#0f172a;">${a.titulo}</h4>
            <p style="margin:0; font-size:12.5px; color:#475569; line-height:1.45;">${a.texto}</p>
          </div>
          <button type="button" onclick="window.copiarApeloSuporte(${idx}, this)" style="background:#0f172a; color:#fff; border:none; padding:8px 12px; border-radius:8px; font-weight:700; font-size:12px; cursor:pointer; display:flex; align-items:center; justify-content:center; gap:6px; transition:background 0.15s;">
            <i class="ph-bold ph-copy"></i> Copiar com 1-Clique
          </button>
        </div>
      `;
    });

    html += `
        </div>
      </div>
    `;

    container.innerHTML = html;
  };

  document.addEventListener('DOMContentLoaded', () => {
    window.renderizarPainelApelosSuporte('painel-apelos-suporte-container');
  });

})(window);
