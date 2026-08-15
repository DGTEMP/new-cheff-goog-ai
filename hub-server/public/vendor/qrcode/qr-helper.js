/* Gerador de QR local (funciona sem internet).
   Depende de qrcode-generator.js carregado antes (/vendor/qrcode/qrcode-generator.js).
   Se a lib local não estiver disponível, cai no endpoint local /api/qr como fallback. */
(function (window) {
  var qrLibReady = false;

  function ensureQr() {
    if (qrLibReady) return true;
    if (typeof window.qrcode === 'function') {
      qrLibReady = true;
      return true;
    }
    return false;
  }

  // Gera a URL do QR como data URL local (assíncrono via callback).
  // Se a lib local faltar, devolve URL remota (fallback online).
  function gerarQrDataUrl(texto, tamanho, callback) {
    var size = tamanho || 200;
    var txt = String(texto || '');
    if (ensureQr()) {
      try {
        var qr = window.qrcode(0, 'M');
        qr.addData(txt);
        qr.make();
        var cell = Math.max(2, Math.floor(size / Math.max(qr.getModuleCount(), 1)));
        callback(qr.createDataURL(cell, 0));
        return;
      } catch (e) {
        // continua para o fallback
      }
    }
    callback((window.location.origin || '') + '/api/qr?size=' + size + '&data=' + encodeURIComponent(txt));
  }

  // Preenche a src de um <img> com o QR local.
  function qrImg(imgEl, texto, tamanho) {
    if (!imgEl) return;
    gerarQrDataUrl(texto, tamanho, function (dataUrl) {
      imgEl.src = dataUrl;
    });
  }

  // Preenche todos os <img data-qr-data="..." data-qr-size="..."> da página.
  function initQrImages() {
    var list = document.querySelectorAll('img[data-qr-data]');
    for (var i = 0; i < list.length; i++) {
      var img = list[i];
      var data = img.getAttribute('data-qr-data');
      var size = parseInt(img.getAttribute('data-qr-size') || '200', 10);
      qrImg(img, data, size);
    }
  }

  window.gerarQrDataUrl = gerarQrDataUrl;
  window.qrImg = qrImg;
  window.initQrImages = initQrImages;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initQrImages);
  } else {
    initQrImages();
  }
})(window);
