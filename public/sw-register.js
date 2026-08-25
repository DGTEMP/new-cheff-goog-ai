// Service Worker: habilita o PWA (instalação + notificações)
if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(function () { });
