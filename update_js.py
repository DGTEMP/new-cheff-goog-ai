import sys, os

fpath = r'c:\Users\computer\Desktop\chef cozinha\configuracoes.js'
with open(fpath, 'r', encoding='utf-8') as f:
    text = f.read()

start_idx = text.find('window.mostrarQrCodeMesa = function(nomeMesa) {')
end_idx = text.find("const clientesEl = document.getElementById('perfil-mesa-clientes');")

print('start_idx:', start_idx, 'end_idx:', end_idx)

replacement = """window.mostrarQrCodeMesa = function(nomeMesa) {
  const modal = document.getElementById('modal-qrcode-mesa');
  const img = document.getElementById('qr-mesa-img');
  const urlEl = document.getElementById('qr-mesa-url');
  const titulo = document.getElementById('qr-mesa-titulo');
  
  if (!modal) return alert("Erro: Modal de QR Code não encontrado no HTML!");
  
  if (titulo) titulo.innerText = `QR Code - ${nomeMesa}`;
  
  const cardapioUrl = buildCardapioUrl(nomeMesa);
  
  if (urlEl) urlEl.innerText = cardapioUrl;
  if (img) {
    if (typeof window.qrImg === 'function') {
      window.qrImg(img, cardapioUrl, 200);
    } else {
      img.src = (window.location.origin || '') + '/api/qr?size=200&data=' + encodeURIComponent(cardapioUrl);
    }
  }
  
  modal.style.display = 'flex';
};

window.abrirPerfilMesa = function(mesaNome) {
  const modal = document.getElementById('modal-perfil-mesa');
  if (!modal) return alert("Erro: Modal de Perfil da Mesa não encontrado no HTML!");
  
  const tituloEl = document.getElementById('perfil-mesa-titulo');
  if (tituloEl) tituloEl.innerText = 'Perfil: ' + mesaNome;
  
  // Gerar QR Code no Modal de Perfil
  const canvas = document.getElementById('canvas-perfil-qrcode');
  const tableUrl = window.location.protocol + '//' + window.location.host + '/area-cliente.html?mesa=' + encodeURIComponent(mesaNome);
  
  if (canvas) {
    try {
      if (typeof QRious !== 'undefined') {
        new QRious({
          element: canvas,
          value: tableUrl,
          size: 180,
          level: 'H'
        });
      } else {
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        const drawQrOnCanvas = function(url) {
          const qrImg = new Image();
          qrImg.crossOrigin = 'anonymous';
          qrImg.onload = function() {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.drawImage(qrImg, 0, 0, canvas.width, canvas.height);
          };
          qrImg.src = url;
        };

        if (typeof window.gerarQrDataUrl === 'function') {
          window.gerarQrDataUrl(tableUrl, 200, function(d) {
            drawQrOnCanvas(d);
          });
        } else {
          drawQrOnCanvas((window.location.origin || '') + '/api/qr?size=200&data=' + encodeURIComponent(tableUrl));
        }
      }
    } catch (e) { console.error(e); }
  }
  
  """

if start_idx != -1 and end_idx != -1:
    new_text = text[:start_idx] + replacement + text[end_idx:]
    with open(fpath, 'w', encoding='utf-8') as f:
        f.write(new_text)
    print('SUCCESS! Updated configuracoes.js')
else:
    print('ERROR: start_idx or end_idx not found')
