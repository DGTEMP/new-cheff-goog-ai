/* Notificações push (Web Push API) — compartilhado por garcom.html e fila-pedidos.html */
(function () {
  var ROLE = window.PUSH_ROLE || 'garcom';
  var VAPID_PUBLIC_KEY = 'BCaA01Z--nSI2tJaXLNEf_mlW959ex1fW7x-jAH1tYSEqVYemjVApDllzr1jpwQqB_nlyjX3GIRb9uEyP_IUuRI';
  var NOME = window.PUSH_NOME || '';

  function urlB64ToUint8Array(base64String) {
    var padding = '='.repeat((4 - (base64String.length % 4)) % 4);
    var base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    var raw = atob(base64);
    var outputArray = new Uint8Array(raw.length);
    for (var i = 0; i < raw.length; ++i) outputArray[i] = raw.charCodeAt(i);
    return outputArray;
  }

  function marcarAtivado() {
    var btn = document.getElementById('btn-notificacoes');
    if (btn) {
      btn.textContent = '🔔 Notificações ativadas';
      btn.disabled = true;
      btn.style.opacity = '0.65';
      btn.style.cursor = 'default';
    }
  }

  async function registrarPush() {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return false;
    var reg = await navigator.serviceWorker.register('/service-worker.js');
    await navigator.serviceWorker.ready;
    var sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlB64ToUint8Array(VAPID_PUBLIC_KEY)
    });
    var dados = sub.toJSON();
    var sk = window.socket;
    if (sk && sk.emit) {
      sk.emit('register_push', {
        subscription: { endpoint: dados.endpoint, keys: { auth: dados.keys.auth, p256dh: dados.keys.p256dh } },
        role: ROLE,
        nome: NOME
      });
    }
    marcarAtivado();
    return true;
  }

  async function restaurarPush() {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;
    if (typeof Notification !== 'undefined' && Notification.permission !== 'granted') return;
    try {
      var reg = await navigator.serviceWorker.register('/service-worker.js');
      await navigator.serviceWorker.ready;
      var sub = await reg.pushManager.getSubscription();
      if (sub) {
        var dados = sub.toJSON();
        var sk = window.socket;
        if (sk && sk.emit) {
          sk.emit('register_push', {
            subscription: { endpoint: dados.endpoint, keys: { auth: dados.keys.auth, p256dh: dados.keys.p256dh } },
            role: ROLE,
            nome: NOME
          });
        }
        marcarAtivado();
      }
    } catch (e) {
      console.error('Erro ao restaurar push:', e);
    }
  }

  window.ativarNotificacoes = async function () {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      alert('Este navegador não suporta notificações push. Use Chrome (Android) ou Safari com o app adicionado à Tela Inicial (iOS 16.4+).');
      return false;
    }
    if (typeof Notification === 'undefined') {
      alert('Notificações não suportadas neste navegador.');
      return false;
    }
    if (Notification.permission === 'denied') {
      alert('As notificações estão bloqueadas neste navegador. Libere nas configurações do site (ícone de cadeado na barra de endereço).');
      return false;
    }
    var perm = await Notification.requestPermission();
    if (perm !== 'granted') {
      alert('Permissão negada. Sem permissão, as notificações não serão enviadas.');
      return false;
    }
    try {
      return await registrarPush();
    } catch (e) {
      console.error('Erro ao ativar push:', e);
      alert('Não foi possível ativar as notificações. Verifique se a página está acessada via HTTPS.');
      return false;
    }
  };

  if (document.readyState === 'complete') restaurarPush();
  else window.addEventListener('load', restaurarPush);
})();
