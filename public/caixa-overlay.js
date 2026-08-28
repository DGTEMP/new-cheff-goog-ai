/**
 * caixa-overlay.js — Lógica de abertura/estado do caixa
 * Gerencia o overlay de caixa aberto/fechado via socket
 */
window.abrirCaixaClick = function () {
  var valInput = document.getElementById('fundo-troco');
  var val = valInput ? valInput.value : '100.00';
  var t = parseFloat(String(val).replace(',', '.'));
  if (isNaN(t)) t = 0;
  
  var operador = (window.crmPerfil && window.crmPerfil.nome) || localStorage.getItem('usuario_logado') || 'Caixa';
  var sock = (typeof window.socket !== 'undefined' && window.socket) ? window.socket : (typeof socket !== 'undefined' ? socket : null);
  
  var overlay = document.getElementById('caixa-overlay');
  var statusName = document.getElementById('status-caixa-name');
  if (overlay) overlay.style.display = 'none';
  if (statusName) statusName.innerText = 'Caixa Aberto';

  if (sock) {
    sock.emit('abrir_caixa', { fundo_troco: t, operador: operador });
  }

  fetch('/api/caixa/abrir', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fundo_troco: t, operador: operador })
  }).catch(function(){});
};

document.addEventListener('DOMContentLoaded', function () {
  function initSocketCaixa() {
    var sock = (typeof window.socket !== 'undefined' && window.socket) ? window.socket : (typeof socket !== 'undefined' ? socket : null);
    if (sock) {
      sock.on('estado_caixa', function (turno) {
        var overlay = document.getElementById('caixa-overlay');
        var statusName = document.getElementById('status-caixa-name');
        if (turno && (turno.status === 'Aberto' || turno.id || !turno.data_fechamento)) {
          if (overlay) overlay.style.display = 'none';
          if (statusName) statusName.innerText = 'Caixa Aberto';
        } else {
          if (overlay) overlay.style.display = 'flex';
          if (statusName) statusName.innerText = 'Caixa Fechado';
        }
      });
      sock.on('caixa_aberto_sucesso', function () {
        var overlay = document.getElementById('caixa-overlay');
        var statusName = document.getElementById('status-caixa-name');
        if (overlay) overlay.style.display = 'none';
        if (statusName) statusName.innerText = 'Caixa Aberto';
      });
      sock.emit('get_estado_caixa');
    } else {
      setTimeout(initSocketCaixa, 500);
    }
  }
  initSocketCaixa();
});
