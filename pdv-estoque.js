// ==========================================
// ESTOQUE & LEITOR DE CÓDIGO DE BARRAS
// ==========================================

let html5QrcodeScanner = null;
let currentScannedProduct = null;

function initEstoqueScanner() {
  if (html5QrcodeScanner) return; // Já inicializado
  
  html5QrcodeScanner = new Html5QrcodeScanner(
    "reader",
    { fps: 10, qrbox: {width: 250, height: 250} },
    /* verbose= */ false
  );
  
  html5QrcodeScanner.render(onScanSuccess, onScanFailure);
}

function stopEstoqueScanner() {
  if (html5QrcodeScanner) {
    html5QrcodeScanner.clear().catch(error => {
      console.error("Failed to clear html5QrcodeScanner. ", error);
    });
    html5QrcodeScanner = null;
  }
}

function onScanSuccess(decodedText, decodedResult) {
  // Pausa a leitura para não disparar várias vezes
  html5QrcodeScanner.pause();
  
  // Toca um beep de sucesso (API Web Audio simples)
  tocarBeep();
  
  // Mostra mensagem na tela
  const msgEl = document.getElementById('scan-result-msg');
  if (msgEl) {
    msgEl.innerText = `Código lido: ${decodedText}\nBuscando produto...`;
    msgEl.style.display = 'block';
  }
  
  // Busca o produto pelo código no servidor
  window.socket.emit('buscar_produto_por_codigo', decodedText);
}

function onScanFailure(error) {
  // Ignora, pois o scanner tenta ler a cada frame
}

function tocarBeep() {
  try {
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const oscillator = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();
    
    oscillator.type = 'sine';
    oscillator.frequency.value = 800; // hz
    gainNode.gain.value = 0.1; // volume
    
    oscillator.connect(gainNode);
    gainNode.connect(audioCtx.destination);
    
    oscillator.start();
    setTimeout(() => {
      oscillator.stop();
    }, 150); // 150ms
  } catch(e) { console.error("Beep erro:", e); }
}

// Modal Estoque
window.abrirModalEstoque = (produto) => {
  currentScannedProduct = produto;
  const modal = document.getElementById('modal-estoque');
  const nomeEl = document.getElementById('estoque-produto-nome');
  
  if (nomeEl) nomeEl.innerText = `${produto.nome}\n(Estoque Atual: ${produto.estoque || 0})`;
  
  document.getElementById('estoque-qtd').value = 1;
  document.getElementById('estoque-custo').value = '';
  document.getElementById('estoque-validade').value = '';
  
  if (modal) modal.classList.add('active');
};

window.fecharModalEstoque = (e) => {
  if(e) e.stopPropagation();
  document.getElementById('modal-estoque').classList.remove('active');
  currentScannedProduct = null;
  // Retoma o scanner se a pessoa fechou o modal sem salvar
  if (html5QrcodeScanner) html5QrcodeScanner.resume();
};

window.confirmarEntradaEstoque = () => {
  if (!currentScannedProduct) return;
  
  const qtd = document.getElementById('estoque-qtd').value;
  const validade = document.getElementById('estoque-validade').value;
  const valorUnitario = document.getElementById('estoque-custo').value;
  
  if (!qtd || qtd <= 0) {
    alert("Informe uma quantidade válida!");
    return;
  }
  
  window.socket.emit('atualizar_estoque', {
    id: currentScannedProduct.id,
    quantidade: qtd,
    validade: validade,
    valor_unitario: valorUnitario,
    operador: window.currentUser || 'Caixa Mobile' // from auth.js se existir
  });
};

// Integrar Inicialização do Scanner e Sockets com as abas de Navegação
document.addEventListener('DOMContentLoaded', () => {
  // Configurar Sockets de Estoque apenas após window.socket existir
  if (window.socket) {
    // Resposta do Servidor ao Buscar Produto
    window.socket.on('produto_estoque_resultado', (produto) => {
      const msgEl = document.getElementById('scan-result-msg');
      if (msgEl) msgEl.style.display = 'none';

      // Fluxo de Nota Fiscal ativo: o item vai para a nota, não abre o modal
      if (window.__notaFlowActive && typeof window.__notaOnBarcode === 'function') {
        if (produto && !produto.error) {
          window.__notaOnBarcode(produto);
        } else {
          const bmsg = document.getElementById('nota-barcode-msg');
          if (bmsg) { bmsg.textContent = 'Produto não encontrado com esse código.'; bmsg.style.display = 'block'; }
          if (typeof window.__notaResumeBarcode === 'function') window.__notaResumeBarcode();
        }
        return;
      }

      if (produto && !produto.error) {
        currentScannedProduct = produto;
        window.abrirModalEstoque(produto);
      } else {
        alert("Produto não encontrado no sistema com este código de barras!");
        if (html5QrcodeScanner) html5QrcodeScanner.resume();
      }
    });

    window.socket.on('estoque_atualizado_sucesso', (res) => {
      alert(`Estoque atualizado com sucesso!\n${res.nome} agora possui ${res.novoEstoque} em estoque.`);
      document.getElementById('modal-estoque').classList.remove('active');
      currentScannedProduct = null;
      
      // Retoma a leitura para o próximo produto
      if (html5QrcodeScanner) html5QrcodeScanner.resume();
    });
  }

  const navItems = document.querySelectorAll('.nav-item');
  navItems.forEach(item => {
    item.addEventListener('click', (e) => {
      const targetId = item.getAttribute('data-target');
      
      if (targetId === 'view-estoque') {
        // Inicializa o scanner se for para a aba de estoque
        setTimeout(initEstoqueScanner, 300);
      } else {
        // Para a câmera se sair da aba de estoque
        stopEstoqueScanner();
      }
    });
  });
});
