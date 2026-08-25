/**
 * caixa-overlay.js — Lógica de abertura/estado do caixa
 * Gerencia o overlay de caixa aberto/fechado via socket
 */
window.abrirCaixaClick = function () {
  var valInput = document.getElementById('fundo-troco');
  var val = valInput ? valInput.value : '100.00';
  var t = parseFloat(String(val).replace(',', '.'));
  if (isNaN(t)) return alert('Digite um valor numérico válido para o fundo de troco.');
  if (!confirm('Deseja abrir o caixa com fundo de troco R$ ' + t.toFixed(2).replace('.', ',') + '?')) return;
  var sock = (typeof window.socket !== 'undefined' && window.socket) ? window.socket : (typeof socket !== 'undefined' ? socket : null);
  if (sock) {
    sock.emit('abrir_caixa', { fundo_troco: t, operador: (window.crmPerfil && window.crmPerfil.nome) || 'Caixa' });
  } else {
    alert('Aguardando conexão com o servidor...');
  }
};

document.addEventListener('DOMContentLoaded', function () {
  function initSocketCaixa() {
    if (typeof socket !== 'undefined' && socket) {
      socket.on('estado_caixa', function (turno) {
        var overlay = document.getElementById('caixa-overlay');
        var statusName = document.getElementById('status-caixa-name');
        if (turno && (turno.status === 'Aberto' || turno.id)) {
          if (overlay) overlay.style.display = 'none';
          if (statusName) statusName.innerText = 'Caixa Aberto';
        } else {
          if (overlay) overlay.style.display = 'flex';
          if (statusName) statusName.innerText = 'Caixa Fechado';
        }
      });
      socket.on('caixa_aberto_sucesso', function () {
        var overlay = document.getElementById('caixa-overlay');
        var statusName = document.getElementById('status-caixa-name');
        if (overlay) overlay.style.display = 'none';
        if (statusName) statusName.innerText = 'Caixa Aberto';
      });
      socket.emit('get_estado_caixa');
    } else {
      setTimeout(initSocketCaixa, 500);
    }
  }
  initSocketCaixa();
});
