const fs = require('fs');

const filePath = 'main.js';
let content = fs.readFileSync(filePath, 'utf8');

// Normalize all newlines to \n to avoid carriage return mismatch issues
content = content.replace(/\r+/g, '');

// 1. Replace pagamentosParciais push in renderOrders
const targetPush = "groupedOrders[mesaName].pagamentosParciais.push({ valor: Math.abs(val), metodo });";
const replacementPush = "groupedOrders[mesaName].pagamentosParciais.push({ valor: Math.abs(val), metodo, id: order.id });";

if (content.includes(targetPush)) {
  content = content.replace(targetPush, replacementPush);
  console.log("SUCCESS: Replaced pagamentosParciais push in renderOrders!");
} else {
  console.error("ERROR: Push in renderOrders target not found!");
}

// 2. Replace btnConcluir handler
const targetConcluir = `  const btnConcluir = document.getElementById('btn-movimento-concluir');
  if (btnConcluir) {
    btnConcluir.addEventListener('click', () => {
      const btnFinalizar = document.getElementById('btn-finalizar-venda');
      if (btnFinalizar) {
        if (!window.mesaAtual) return alert('Selecione uma mesa primeiro.');
        btnFinalizar.click();
      }
    });
  }`;

const replacementConcluir = `  const btnConcluir = document.getElementById('btn-movimento-concluir');
  if (btnConcluir) {
    btnConcluir.onclick = () => {
      if (!window.mesaAtual || window.mesaAtual.isGroup === false) return alert('Selecione uma mesa ocupada primeiro.');
      window.abrirCheckoutModal();
    };
  }`;

if (content.includes(targetConcluir)) {
  content = content.replace(targetConcluir, replacementConcluir);
  console.log("SUCCESS: Replaced btnConcluir handler!");
} else {
  console.error("ERROR: btnConcluir target not found!");
}

// 3. Replace calcRestante calculation and UI updates
let startCalcRestante = -1;
let searchIdx = 0;
while ((searchIdx = content.indexOf('window.calcularTotal();', searchIdx)) !== -1) {
  const snippet = content.substring(searchIdx, searchIdx + 200);
  if (snippet.includes('taxaCheckbox') && (snippet.includes('calcRestante') || snippet.includes('pagamentosParciais'))) {
    startCalcRestante = searchIdx;
    break;
  }
  searchIdx += 'window.calcularTotal();'.length;
}

if (startCalcRestante === -1) {
  console.error("ERROR: Start of calcRestante block not found!");
  process.exit(1);
}

const endCalcRestante = content.indexOf('window.calcRestante();', startCalcRestante) + 'window.calcRestante();'.length;
if (endCalcRestante === -1) {
  console.error("ERROR: End of calcRestante block not found!");
  process.exit(1);
}

const replacementCalcRestante = `window.calcularTotal();
        const modalTaxaCheckbox = document.getElementById('checkout-modal-taxa');
        if (modalTaxaCheckbox && taxaCheckbox) {
          modalTaxaCheckbox.checked = taxaCheckbox.checked;
          modalTaxaCheckbox.onchange = () => {
            taxaCheckbox.checked = modalTaxaCheckbox.checked;
            window.calcRestante();
          };
          taxaCheckbox.onchange = () => {
            modalTaxaCheckbox.checked = taxaCheckbox.checked;
            window.calcRestante();
          };
        } else if (taxaCheckbox) {
          taxaCheckbox.onchange = () => { window.calcRestante(); };
        }

        window.pagamentosParciais = item.pagamentosParciais || [];
        
        window.calcRestante = () => {
            const finalTotal = window.calcularTotal();
            const pago = window.pagamentosParciais.reduce((acc, curr) => acc + curr.valor, 0);
            const taxaMult = (taxaCheckbox && taxaCheckbox.checked) ? 1.1 : 1.0;
            const paidItemsTotal = ((window.mesaAtual.totalBruto || window.mesaAtual.total) - window.mesaAtual.total) * taxaMult;
            const falta = finalTotal - pago - paidItemsTotal;
            
            // Salvar nas variáveis globais para validações
            window.mesaFaltaPagar = falta;
            window.mesaTotalComTaxa = finalTotal;

            // Atualizar textos antigos (se existirem)
            const elTot = document.getElementById('total-pagar-text');
            if(elTot) elTot.innerText = \`R$ \${finalTotal.toFixed(2).replace('.', ',')}\`;
            const elPago = document.getElementById('total-pago-text');
            if(elPago) elPago.innerText = \`R$ \${pago.toFixed(2).replace('.', ',')}\`;
            const elFalta = document.getElementById('falta-pagar-text');
            if(elFalta) elFalta.innerText = \`R$ \${falta > 0 ? falta.toFixed(2).replace('.', ',') : '0,00'}\`;
            
            // Atualizar textos do Modal Novo
            const subtotal = window.mesaAtual.totalBruto || window.mesaAtual.total || 0;
            const desc = window.descontoAdicional || 0;
            const valorServicos = (taxaCheckbox && taxaCheckbox.checked) ? Math.max(0, subtotal - desc) * 0.10 : 0;

            const modSubtotal = document.getElementById('checkout-modal-subtotal');
            if(modSubtotal) modSubtotal.innerText = \`R$ \${subtotal.toFixed(2).replace('.', ',')}\`;
            const modDesc = document.getElementById('checkout-modal-descontos');
            if(modDesc) modDesc.innerText = \`R$ \${desc.toFixed(2).replace('.', ',')}\`;
            const modTaxasVal = document.getElementById('checkout-modal-taxas-val');
            if(modTaxasVal) modTaxasVal.innerText = \`R$ \${valorServicos.toFixed(2).replace('.', ',')}\`;
            
            const modTotal = document.getElementById('checkout-modal-total-pagar');
            if(modTotal) modTotal.innerText = \`R$ \${finalTotal.toFixed(2).replace('.', ',')}\`;
            const modPago = document.getElementById('checkout-modal-pago');
            if(modPago) modPago.innerText = \`R$ \${pago.toFixed(2).replace('.', ',')}\`;
            
            const modRest = document.getElementById('checkout-modal-restante');
            const modRestLabel = document.getElementById('checkout-modal-restante-label');
            if(modRestLabel && modRest) {
              if (falta < -0.01) {
                 modRestLabel.innerText = 'Troco:';
                 modRest.style.color = '#27ae60';
                 modRest.innerText = \`R$ \${Math.abs(falta).toFixed(2).replace('.', ',')}\`;
              } else {
                 modRestLabel.innerText = 'Faltando:';
                 modRest.style.color = '#e53e3e';
                 modRest.innerText = \`R$ \${falta > 0 ? falta.toFixed(2).replace('.', ',') : '0,00'}\`;
              }
            }
            
            // Renderizar itens no tbody do modal de checkout
            let itemsToRender = window.mesaAtual.items || [];
            if (window.agruparItens) {
              const grouped = {};
              itemsToRender.forEach(order => {
                const key = order.productName;
                if (!grouped[key]) grouped[key] = { ...order, quantity: 0, totalVal: 0 };
                const totalVal = parseFloat(String(order.total).replace(',', '.'));
                grouped[key].quantity += (order.quantity || 1);
                grouped[key].totalVal += totalVal;
              });
              itemsToRender = Object.values(grouped).map(g => ({ ...g, total: g.totalVal }));
            }

            let modalItemsHTML = '';
            itemsToRender.forEach((order) => {
              const totalVal = parseFloat(String(order.total).replace(',', '.'));
              const isPaid = order.status === 'Pago';
              modalItemsHTML += \`
                <tr style="\${isPaid ? 'opacity: 0.5; background: #f9f9f9;' : ''}">
                  <td style="padding: 8px 4px; \${isPaid ? 'text-decoration: line-through;' : ''}">\${order.productEmoji || ''} \${order.productName || 'Produto'} \${isPaid ? '<strong style="color: #3ab55b; margin-left: 8px;">(PAGO)</strong>' : ''}</td>
                  <td style="padding: 8px 4px; text-align: center;">\${order.quantity || 1}</td>
                  <td style="padding: 8px 4px; text-align: right; font-weight: 600; color: #3ab55b;">R$ \${totalVal.toFixed(2).replace('.', ',')}</td>
                </tr>
              \`;
            });
            const tbodyModal = document.getElementById('checkout-modal-items-tbody');
            if (tbodyModal) tbodyModal.innerHTML = modalItemsHTML;

            // Atualizar lista de pagamentos no Modal (e no antigo se precisar)
            const htmlLista = window.pagamentosParciais.map((p, idx) => \`
                <div style="display:flex; justify-content:space-between; align-items:center; border-bottom: 1px dashed #ccc; padding-bottom: 8px;">
                  <span style="font-size: 16px;">\${p.metodo}</span>
                  <span style="font-size: 18px; font-weight: bold;">R$ \dots_totalVal = parseFloat(String(order.total).replace(',', '.')); \${p.valor.toFixed(2).replace('.', ',')} 
                    <i class="ph ph-trash" style="color:#e74c3c; cursor:pointer; margin-left: 12px;" onclick="window.removerPagamento(\dots_idx)})"></i>
                  </span>
                </div>
            \`).join('');
            
            const listaElModal = document.getElementById('checkout-modal-lista-pagamentos');
            if (listaElModal) listaElModal.innerHTML = htmlLista;
            const listaElAntiga = document.getElementById('lista-pagamentos-parciais');
            if (listaElAntiga) listaElAntiga.innerHTML = htmlLista;
            
            // Habilitar ou desabilitar botões de envio baseados no saldo devedor
            const btnFinalizar = document.getElementById('btn-finalizar-venda');
            const submitBtnModal = document.getElementById('checkout-modal-submit-btn');
            const isQuted = falta <= 0.01 && (window.pagamentosParciais.length > 0 || finalTotal === 0);
            
            if (btnFinalizar) {
              btnFinalizar.style.opacity = '1';
              btnFinalizar.style.pointerEvents = 'auto';
              btnFinalizar.onclick = () => {
                window.abrirCheckoutModal();
              };
              btnFinalizar.innerHTML = '<i class="ph ph-check-circle" style="font-size: 20px;"></i> Finalizar Venda';
            }

            if (submitBtnModal) {
              if (isQuted) {
                submitBtnModal.style.opacity = '1';
                submitBtnModal.style.pointerEvents = 'auto';
              } else {
                submitBtnModal.style.opacity = '0.5';
                submitBtnModal.style.pointerEvents = 'none';
              }
            }
            
            return finalTotal;
          };
        window.calcRestante();\n        // Force sync check for new checkout modal open items on update\n        const tbodyModal_check = document.getElementById('checkout-modal-items-tbody');\n        if (tbodyModal_check && window.mesaAtual && window.calcRestante) {\n          window.calcRestante();\n        }`;

content = content.substring(0, startCalcRestante) + replacementCalcRestante + content.substring(endCalcRestante);
console.log("SUCCESS: Replaced calcRestante block!");

// 4. Replace socket.on('mesa_finalizada') block
const startMesaFinalizada = content.indexOf("socket.on('mesa_finalizada', ({ mesaName }) => {");
if (startMesaFinalizada === -1) {
  console.error("ERROR: Start of mesa_finalizada block not found!");
  process.exit(1);
}
const endMesaFinalizada = content.indexOf("// Caixa Logic", startMesaFinalizada);
if (endMesaFinalizada === -1) {
  console.error("ERROR: End of mesa_finalizada block (// Caixa Logic) not found!");
  process.exit(1);
}

const replacementMesaFinalizada = `socket.on('mesa_finalizada', ({ mesaName }) => {
    // Remove items that were closed
    ordersData = ordersData.filter(o => o.localName !== mesaName);
    renderOrders();
    
    // Close the new checkout modal if it's currently open for this table
    if (window.mesaAtual && (window.mesaAtual.nome || window.mesaAtual.mesaName) === mesaName) {
      window.fecharCheckoutModal();
      window.mesaAtual = null;
    }
    
    // Sucesso Interativo e Dinâmico
    const btnFinalizarModal = document.getElementById('btn-finalizar-venda');
    const newBtnSubmit = document.getElementById('checkout-modal-submit-btn');
    const isProcessing = (btnFinalizarModal && btnFinalizarModal.innerHTML.includes('Processando')) || 
                         (newBtnSubmit && newBtnSubmit.innerHTML.includes('Processando'));
                         
    if (isProcessing) {
      // Efeito de Confete
      if (typeof confetti === 'function') {
        confetti({
          particleCount: 150,
          spread: 80,
          origin: { y: 0.6 },
          colors: ['#3ab55b', '#ffffff', '#2D9CDB']
        });
      }

      // Tocar som de sucesso (Cha-Ching)
      try {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if(AudioContext) {
          const ctx = new AudioContext();
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(523.25, ctx.currentTime); // C5
          osc.frequency.setValueAtTime(659.25, ctx.currentTime + 0.1); // E5
          osc.frequency.setValueAtTime(783.99, ctx.currentTime + 0.2); // G5
          osc.frequency.setValueAtTime(1046.50, ctx.currentTime + 0.3); // C6
          
          gain.gain.setValueAtTime(0, ctx.currentTime);
          gain.gain.linearRampToValueAtTime(0.5, ctx.currentTime + 0.05);
          gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.6);
          
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start();
          osc.stop(ctx.currentTime + 0.6);
        }
      } catch (e) {}
      
      // Atualiza visual do botão para sucesso
      if (btnFinalizarModal) {
        btnFinalizarModal.style.background = '#27ae60';
        btnFinalizarModal.innerHTML = '<i class="ph ph-check-circle" style="font-size: 32px;"></i> VENDA CONCLUÍDA!';
      }
      
      if (newBtnSubmit) {
         newBtnSubmit.style.background = '#27ae60';
         newBtnSubmit.innerHTML = '<i class="ph ph-check-circle" style="font-size: 24px;"></i> CONTA FECHADA COM SUCESSO!';
      }
      
      // Fecha o modal automaticamente após 2.5 segundos
      setTimeout(() => {
        const modalPagamento = document.getElementById('pagamento-overlay');
        if (modalPagamento) modalPagamento.style.display = 'none';
        
        // Reseta os botões para a próxima venda
        if (btnFinalizarModal) {
          btnFinalizarModal.innerHTML = '<i class="ph ph-check-circle" style="font-size: 28px;"></i> FINALIZAR VENDA';
          btnFinalizarModal.style.background = '#3ab55b';
        }
        if (newBtnSubmit) {
          newBtnSubmit.innerHTML = '<i class="ph ph-check-circle" style="font-size: 24px;"></i> CONCLUIR E FECHAR MESA';
          newBtnSubmit.style.background = '#3ab55b';
        }
      }, 2500);
    }
    
    const rightPanel = document.querySelector('.right-panel');
    if(rightPanel) {
      const itemsContainer = document.getElementById('panel-items');
      if (itemsContainer) itemsContainer.innerHTML = '<div style="padding: 20px; text-align: center; color: gray;">Mesa Paga / Finalizada</div>';
      
      const panelHeader = document.querySelector('.panel-header h2');
      if (panelHeader) panelHeader.innerText = 'Mesa Paga';
      
      const paymentVal = document.querySelector('.payment-val');
      if (paymentVal) paymentVal.innerText = 'R$ 0,00';
      
      const btnFinalizar = document.getElementById('btn-finalizar');
      if(btnFinalizar) {
        btnFinalizar.innerHTML = '<i class="ph ph-check-circle" style="font-size: 20px;"></i> Finalizada';
        btnFinalizar.disabled = true;
      }
    }
  });

`;

content = content.substring(0, startMesaFinalizada) + replacementMesaFinalizada + content.substring(endMesaFinalizada);
console.log("SUCCESS: Replaced socket mesa_finalizada block!");

// 5. Update socket.on('erro_caixa') to reset submitBtnModal
const targetErroCaixa = `  socket.on('erro_caixa', (msg) => {
    alert(msg);
    const btnFinalizar = document.getElementById('btn-finalizar-venda');
    if(btnFinalizar) btnFinalizar.innerHTML = 'FINALIZAR VENDA';
  });`;

const replacementErroCaixa = `  socket.on('erro_caixa', (msg) => {
    alert(msg);
    const btnFinalizar = document.getElementById('btn-finalizar-venda');
    if(btnFinalizar) btnFinalizar.innerHTML = 'FINALIZAR VENDA';
    const submitBtnModal = document.getElementById('checkout-modal-submit-btn');
    if(submitBtnModal) {
      submitBtnModal.innerHTML = '<i class="ph ph-check-circle" style="font-size: 24px;"></i> CONCLUIR E FECHAR MESA';
      submitBtnModal.style.pointerEvents = 'auto';
    }
  });`;

if (content.includes(targetErroCaixa)) {
  content = content.replace(targetErroCaixa, replacementErroCaixa);
  console.log("SUCCESS: Updated erro_caixa socket listener!");
} else {
  console.error("ERROR: erro_caixa target not found!");
}

// 6. Append helper functions at the end of the file
const modalHelpers = `
// --- TOUCH SCREEN CHECKOUT CONTROLS ---
window.checkoutModalTouchModeActive = false;
window.checkoutModalCents = 0;

window.checkoutModalToggleTouchMode = (forcedState) => {
  if (typeof forcedState === 'boolean') {
    window.checkoutModalTouchModeActive = forcedState;
  } else {
    window.checkoutModalTouchModeActive = !window.checkoutModalTouchModeActive;
  }
  
  const btn = document.getElementById('checkout-modal-toggle-touch-btn');
  const standardContainer = document.getElementById('checkout-modal-standard-container');
  const touchContainer = document.getElementById('checkout-modal-touch-container');
  
  if (btn) {
    if (window.checkoutModalTouchModeActive) {
      btn.style.background = '#fc4b15';
      btn.style.borderColor = '#fc4b15';
      btn.style.color = 'white';
      btn.querySelector('span').innerText = 'Modo Touch: ON';
    } else {
      btn.style.background = '#edf2f7';
      btn.style.borderColor = '#cbd5e0';
      btn.style.color = '#4a5568';
      btn.querySelector('span').innerText = 'Modo Touch: OFF';
    }
  }
  
  if (standardContainer) standardContainer.style.display = window.checkoutModalTouchModeActive ? 'none' : 'block';
  if (touchContainer) touchContainer.style.display = window.checkoutModalTouchModeActive ? 'flex' : 'none';
  
  // Sync values
  const inputValor = document.getElementById('checkout-modal-valor');
  if (inputValor) {
    const parseCurrencyInput = (valStr) => {
      let clean = valStr.trim().replace('R$', '').replace(/\\s/g, '');
      if (clean.includes('.') && clean.includes(',')) {
        if (clean.indexOf('.') < clean.indexOf(',')) {
          clean = clean.replace(/\\./g, '').replace(',', '.');
        } else {
          clean = clean.replace(/,/g, '');
        }
      } else if (clean.includes(',')) {
        clean = clean.replace(',', '.');
      } else if (clean.includes('.')) {
        const parts = clean.split('.');
        if (parts[1].length !== 3 || parseInt(parts[0]) === 0) {
          // decimal dot
        } else {
          clean = clean.replace(/\\./g, '');
        }
      }
      return parseFloat(clean);
    };
    
    const parsed = parseCurrencyInput(inputValor.value);
    window.checkoutModalCents = isNaN(parsed) || parsed < 0 ? 0 : Math.round(parsed * 100);
  }
  
  // Select Dinheiro by default in touch mode
  window.checkoutModalSelectTouchMethod('Dinheiro');
  window.checkoutModalUpdateTouchVisor();
};

window.checkoutModalUpdateTouchVisor = () => {
  const visor = document.getElementById('checkout-modal-touch-visor');
  if (visor) {
    visor.innerText = "R$ " + (window.checkoutModalCents / 100).toFixed(2).replace('.', ',');
  }
  // Keep the hidden/native input updated so existing add logic functions
  const inputValor = document.getElementById('checkout-modal-valor');
  if (inputValor) {
    inputValor.value = "R$ " + (window.checkoutModalCents / 100).toFixed(2).replace('.', ',');
  }
};

window.checkoutModalSelectTouchMethod = (metodo) => {
  const selectMetodo = document.getElementById('checkout-modal-metodo');
  if (selectMetodo) {
    selectMetodo.value = metodo;
  }
  
  // Style large method buttons
  document.querySelectorAll('.touch-method-btn').forEach(btn => {
    const m = btn.getAttribute('data-method');
    if (m === metodo) {
      btn.style.borderColor = '#fc4b15';
      btn.style.background = '#fff5f0';
      btn.style.boxShadow = '0 0 8px rgba(252, 75, 21, 0.15)';
    } else {
      btn.style.borderColor = '#e2e8f0';
      btn.style.background = 'white';
      btn.style.boxShadow = 'none';
    }
  });
};

window.checkoutModalClearTouchValue = () => {
  window.checkoutModalCents = 0;
  window.checkoutModalUpdateTouchVisor();
};

window.checkoutModalSetRemainingTouchValue = () => {
  const falta = window.mesaFaltaPagar || 0;
  if (falta > 0) {
    window.checkoutModalCents = Math.round(falta * 100);
  } else {
    window.checkoutModalCents = 0;
  }
  window.checkoutModalUpdateTouchVisor();
};

// Bind keyboard input and touch numpad buttons
setTimeout(() => {
  const inputValor = document.getElementById('checkout-modal-valor');
  if (inputValor) {
    const parseCurrencyInput = (valStr) => {
      let clean = valStr.trim().replace('R$', '').replace(/\\s/g, '');
      if (clean.includes('.') && clean.includes(',')) {
        if (clean.indexOf('.') < clean.indexOf(',')) {
          clean = clean.replace(/\\./g, '').replace(',', '.');
        } else {
          clean = clean.replace(/,/g, '');
        }
      } else if (clean.includes(',')) {
        clean = clean.replace(',', '.');
      } else if (clean.includes('.')) {
        const parts = clean.split('.');
        if (parts[1].length !== 3 || parseInt(parts[0]) === 0) {
          // decimal
        } else {
          clean = clean.replace(/\\./g, '');
        }
      }
      return parseFloat(clean);
    };

    inputValor.addEventListener('input', (e) => {
      const parsed = parseCurrencyInput(e.target.value);
      if (!isNaN(parsed) && parsed >= 0) {
        window.checkoutModalCents = Math.round(parsed * 100);
      } else {
        window.checkoutModalCents = 0;
      }
      const visor = document.getElementById('checkout-modal-touch-visor');
      if (visor) {
        visor.innerText = "R$ " + (window.checkoutModalCents / 100).toFixed(2).replace('.', ',');
      }
    });
  }
  
  // Bind touch numpad buttons
  document.querySelectorAll('.touch-num-btn').forEach(btn => {
    btn.onclick = () => {
      const val = btn.getAttribute('data-val');
      let str = window.checkoutModalCents.toString();
      if (val === 'BACKSPACE') {
        if (str.length <= 1) {
          window.checkoutModalCents = 0;
        } else {
          window.checkoutModalCents = parseInt(str.slice(0, -1), 10) || 0;
        }
      } else if (val === '00') {
        if (window.checkoutModalCents > 0) {
          window.checkoutModalCents = parseInt(str + '00', 10) || 0;
        }
      } else {
        if (window.checkoutModalCents === 0) {
          window.checkoutModalCents = parseInt(val, 10);
        } else {
          window.checkoutModalCents = parseInt(str + val, 10) || 0;
        }
      }
      window.checkoutModalUpdateTouchVisor();
    };
  });
}, 1000);

// --- CHECKOUT MODAL LIFECYCLE CONTROLS ---
window.abrirCheckoutModal = () => {
  if (!window.mesaAtual || window.mesaAtual.isGroup === false) return alert('Selecione uma mesa ocupada primeiro.');
  
  const titleEl = document.getElementById('checkout-modal-mesa-title');
  if (titleEl) {
    titleEl.innerText = window.mesaAtual.nome || window.mesaAtual.mesaName;
  }
  
  const overlay = document.getElementById('checkout-modal-overlay');
  if (overlay) overlay.style.display = 'flex';
  
  const inputValor = document.getElementById('checkout-modal-valor');
  if (inputValor) inputValor.value = '';
  
  const inputSplitParts = document.getElementById('checkout-modal-split-parts');
  if (inputSplitParts) inputSplitParts.value = '';

  // Configurar o Modo Touch padrão baseado nas configurações
  const defaultTouch = window.pdvConfigs && (window.pdvConfigs.modo_touch === 'true' || window.pdvConfigs.modo_touch === true);
  window.checkoutModalToggleTouchMode(defaultTouch);
  
  if (window.calcRestante) window.calcRestante();
};

window.fecharCheckoutModal = () => {
  const overlay = document.getElementById('checkout-modal-overlay');
  if (overlay) overlay.style.display = 'none';
};

window.checkoutModalAddPagamento = () => {
  if (!window.mesaAtual) return alert('Selecione uma mesa primeiro.');
  const inputValor = document.getElementById('checkout-modal-valor');
  const selectMetodo = document.getElementById('checkout-modal-metodo');
  if (!inputValor || !selectMetodo) return;
  
  const parseCurrencyInput = (valStr) => {
    let clean = valStr.trim().replace('R$', '').replace(/\\s/g, '');
    if (clean.includes('.') && clean.includes(',')) {
      if (clean.indexOf('.') < clean.indexOf(',')) {
        clean = clean.replace(/\\./g, '').replace(',', '.');
      } else {
        clean = clean.replace(/,/g, '');
      }
    } else if (clean.includes(',')) {
      clean = clean.replace(',', '.');
    } else if (clean.includes('.')) {
      const parts = clean.split('.');
      if (parts[1].length !== 3 || parseInt(parts[0]) === 0) {
        // Treat dot as decimal separator
      } else {
        clean = clean.replace(/\\./g, '');
      }
    }
    return parseFloat(clean);
  };

  const valor = parseCurrencyInput(inputValor.value);
  if (isNaN(valor) || valor <= 0) {
    return alert('Digite um valor de pagamento válido maior que zero.');
  }
  
  const metodo = selectMetodo.value;
  const mesaName = window.mesaAtual.nome || window.mesaAtual.mesaName;
  
  const falta = window.mesaFaltaPagar;
  if (falta <= 0.01) {
    return alert('Esta mesa/comanda já está totalmente paga!');
  }
  
  let valorRegistrado = valor;
  if (valor > falta + 0.01) {
    if (metodo !== 'Dinheiro') {
      return alert('O valor do pagamento eletrônico não pode ser maior que o saldo restante!');
    } else {
      valorRegistrado = falta;
      alert("Pagamento em dinheiro registrado. Troco: R$ " + (valor - falta).toFixed(2).replace('.', ','));
    }
  }
  
  // Register partial payment in background
  socket.emit('movimentacao_caixa', {
    tipo: 'Entrada',
    valor: valorRegistrado,
    descricao: "Pgto Parcial: " + mesaName,
    forma_pagamento: metodo
  });
  
  socket.emit('pagamento_parcial_valor', {
    mesaName: mesaName,
    valor: valorRegistrado,
    metodo: metodo,
    userName: window.loggedInUser || 'Caixa'
  });
  
  inputValor.value = '';
};

window.checkoutModalCalcularDivisao = () => {
  const inputParts = document.getElementById('checkout-modal-split-parts');
  if (!inputParts) return;
  const parts = parseInt(inputParts.value, 10);
  if (isNaN(parts) || parts < 2) {
    return alert('Por favor, informe uma quantidade válida de pessoas (mínimo 2).');
  }
  
  const falta = window.mesaFaltaPagar;
  if (falta <= 0) {
    return alert('Não há saldo restante para dividir.');
  }
  
  const share = falta / parts;
  const inputValor = document.getElementById('checkout-modal-valor');
  if (inputValor) {
    inputValor.value = "R$ " + share.toFixed(2).replace('.', ',');
  }
  
  window.checkoutModalCents = Math.round(share * 100);
  if (typeof window.checkoutModalUpdateTouchVisor === 'function') {
    window.checkoutModalUpdateTouchVisor();
  }
};

window.checkoutModalConfirmarFechamento = () => {
  if (!window.mesaAtual) return alert('Selecione uma mesa primeiro.');
  
  const falta = window.mesaFaltaPagar;
  const finalTotal = window.mesaTotalComTaxa;
  
  if (falta > 0.01) {
    return alert('Pagamento incompleto! A mesa não pode ser fechada sem o pagamento total.');
  }
  
  const btnSubmit = document.getElementById('checkout-modal-submit-btn');
  if (btnSubmit) {
    btnSubmit.innerHTML = '<i class="ph ph-spinner-gap"></i> Processando...';
    btnSubmit.style.pointerEvents = 'none';
  }
  
  socket.emit('finalizar_mesa', {
    mesaName: window.mesaAtual.nome || window.mesaAtual.mesaName,
    payments: window.pagamentosParciais,
    totalValue: finalTotal
  });
};
`;

// Clean up replacements (removing transcript placeholder issues)
let cleanReplacementCalcRestante = replacementCalcRestante
  .replace("R$ \\dots_totalVal = parseFloat(String(order.total).replace(',', '.')); \\${totalVal.toFixed(2).replace('.', ',')}", "R$ \\${totalVal.toFixed(2).replace('.', ',')}")
  .replace("R$ \\dots_totalVal = parseFloat(String(order.total).replace(',', '.')); \\${p.valor.toFixed(2).replace('.', ',')}", "R$ \\${p.valor.toFixed(2).replace('.', ',')}")
  .replace("onclick=\\\"window.removerPagamento(\\dots_idx)})\\\"", "onclick=\\\"window.removerPagamento(\\${idx})\\\"");

content = content.substring(0, startCalcRestante) + cleanReplacementCalcRestante + content.substring(endCalcRestante);
console.log("SUCCESS: Replaced calcRestante block!");

// 4. Replace socket.on('mesa_finalizada') block
const startMesaFinalizada = content.indexOf("socket.on('mesa_finalizada', ({ mesaName }) => {");
if (startMesaFinalizada === -1) {
  console.error("ERROR: Start of mesa_finalizada block not found!");
  process.exit(1);
}
const endMesaFinalizada = content.indexOf("// Caixa Logic", startMesaFinalizada);
if (endMesaFinalizada === -1) {
  console.error("ERROR: End of mesa_finalizada block (// Caixa Logic) not found!");
  process.exit(1);
}

const replacementMesaFinalizada = `socket.on('mesa_finalizada', ({ mesaName }) => {
    // Remove items that were closed
    ordersData = ordersData.filter(o => o.localName !== mesaName);
    renderOrders();
    
    // Close the new checkout modal if it's currently open for this table
    if (window.mesaAtual && (window.mesaAtual.nome || window.mesaAtual.mesaName) === mesaName) {
      window.fecharCheckoutModal();
      window.mesaAtual = null;
    }
    
    // Sucesso Interativo e Dinâmico
    const btnFinalizarModal = document.getElementById('btn-finalizar-venda');
    const newBtnSubmit = document.getElementById('checkout-modal-submit-btn');
    const isProcessing = (btnFinalizarModal && btnFinalizarModal.innerHTML.includes('Processando')) || 
                         (newBtnSubmit && newBtnSubmit.innerHTML.includes('Processando'));
                         
    if (isProcessing) {
      // Efeito de Confete
      if (typeof confetti === 'function') {
        confetti({
          particleCount: 150,
          spread: 80,
          origin: { y: 0.6 },
          colors: ['#3ab55b', '#ffffff', '#2D9CDB']
        });
      }

      // Tocar som de sucesso (Cha-Ching)
      try {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if(AudioContext) {
          const ctx = new AudioContext();
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(523.25, ctx.currentTime); // C5
          osc.frequency.setValueAtTime(659.25, ctx.currentTime + 0.1); // E5
          osc.frequency.setValueAtTime(783.99, ctx.currentTime + 0.2); // G5
          osc.frequency.setValueAtTime(1046.50, ctx.currentTime + 0.3); // C6
          
          gain.gain.setValueAtTime(0, ctx.currentTime);
          gain.gain.linearRampToValueAtTime(0.5, ctx.currentTime + 0.05);
          gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.6);
          
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start();
          osc.stop(ctx.currentTime + 0.6);
        }
      } catch (e) {}
      
      // Atualiza visual do botão para sucesso
      if (btnFinalizarModal) {
        btnFinalizarModal.style.background = '#27ae60';
        btnFinalizarModal.innerHTML = '<i class="ph ph-check-circle" style="font-size: 32px;"></i> VENDA CONCLUÍDA!';
      }
      
      if (newBtnSubmit) {
         newBtnSubmit.style.background = '#27ae60';
         newBtnSubmit.innerHTML = '<i class="ph ph-check-circle" style="font-size: 24px;"></i> CONTA FECHADA COM SUCESSO!';
      }
      
      // Fecha o modal automaticamente após 2.5 segundos
      setTimeout(() => {
        const modalPagamento = document.getElementById('pagamento-overlay');
        if (modalPagamento) modalPagamento.style.display = 'none';
        
        // Reseta os botões para a próxima venda
        if (btnFinalizarModal) {
          btnFinalizarModal.innerHTML = '<i class="ph ph-check-circle" style="font-size: 28px;"></i> FINALIZAR VENDA';
          btnFinalizarModal.style.background = '#3ab55b';
        }
        if (newBtnSubmit) {
          newBtnSubmit.innerHTML = '<i class="ph ph-check-circle" style="font-size: 24px;"></i> CONCLUIR E FECHAR MESA';
          newBtnSubmit.style.background = '#3ab55b';
        }
      }, 2500);
    }
    
    const rightPanel = document.querySelector('.right-panel');
    if(rightPanel) {
      const itemsContainer = document.getElementById('panel-items');
      if (itemsContainer) itemsContainer.innerHTML = '<div style="padding: 20px; text-align: center; color: gray;">Mesa Paga / Finalizada</div>';
      
      const panelHeader = document.querySelector('.panel-header h2');
      if (panelHeader) panelHeader.innerText = 'Mesa Paga';
      
      const paymentVal = document.querySelector('.payment-val');
      if (paymentVal) paymentVal.innerText = 'R$ 0,00';
      
      const btnFinalizar = document.getElementById('btn-finalizar');
      if(btnFinalizar) {
        btnFinalizar.innerHTML = '<i class="ph ph-check-circle" style="font-size: 20px;"></i> Finalizada';
        btnFinalizar.disabled = true;
      }
    }
  });

`;

content = content.substring(0, startMesaFinalizada) + replacementMesaFinalizada + content.substring(endMesaFinalizada);
console.log("SUCCESS: Replaced socket mesa_finalizada block!");

// 5. Update socket.on('erro_caixa') to reset submitBtnModal
const targetErroCaixa = `  socket.on('erro_caixa', (msg) => {
    alert(msg);
    const btnFinalizar = document.getElementById('btn-finalizar-venda');
    if(btnFinalizar) btnFinalizar.innerHTML = 'FINALIZAR VENDA';
  });`;

const replacementErroCaixa = `  socket.on('erro_caixa', (msg) => {
    alert(msg);
    const btnFinalizar = document.getElementById('btn-finalizar-venda');
    if(btnFinalizar) btnFinalizar.innerHTML = 'FINALIZAR VENDA';
    const submitBtnModal = document.getElementById('checkout-modal-submit-btn');
    if(submitBtnModal) {
      submitBtnModal.innerHTML = '<i class="ph ph-check-circle" style="font-size: 24px;"></i> CONCLUIR E FECHAR MESA';
      submitBtnModal.style.pointerEvents = 'auto';
    }
  });`;

if (content.includes(targetErroCaixa)) {
  content = content.replace(targetErroCaixa, replacementErroCaixa);
  console.log("SUCCESS: Updated erro_caixa socket listener!");
} else {
  console.error("ERROR: erro_caixa target not found!");
}

// 6. Append helper functions at the end of the file
const modalHelpers = `
// --- TOUCH SCREEN CHECKOUT CONTROLS ---
window.checkoutModalTouchModeActive = false;
window.checkoutModalCents = 0;

window.checkoutModalToggleTouchMode = (forcedState) => {
  if (typeof forcedState === 'boolean') {
    window.checkoutModalTouchModeActive = forcedState;
  } else {
    window.checkoutModalTouchModeActive = !window.checkoutModalTouchModeActive;
  }
  
  const btn = document.getElementById('checkout-modal-toggle-touch-btn');
  const standardContainer = document.getElementById('checkout-modal-standard-container');
  const touchContainer = document.getElementById('checkout-modal-touch-container');
  
  if (btn) {
    if (window.checkoutModalTouchModeActive) {
      btn.style.background = '#fc4b15';
      btn.style.borderColor = '#fc4b15';
      btn.style.color = 'white';
      btn.querySelector('span').innerText = 'Modo Touch: ON';
    } else {
      btn.style.background = '#edf2f7';
      btn.style.borderColor = '#cbd5e0';
      btn.style.color = '#4a5568';
      btn.querySelector('span').innerText = 'Modo Touch: OFF';
    }
  }
  
  if (standardContainer) standardContainer.style.display = window.checkoutModalTouchModeActive ? 'none' : 'block';
  if (touchContainer) touchContainer.style.display = window.checkoutModalTouchModeActive ? 'flex' : 'none';
  
  // Sync values
  const inputValor = document.getElementById('checkout-modal-valor');
  if (inputValor) {
    const parseCurrencyInput = (valStr) => {
      let clean = valStr.trim().replace('R$', '').replace(/\\s/g, '');
      if (clean.includes('.') && clean.includes(',')) {
        if (clean.indexOf('.') < clean.indexOf(',')) {
          clean = clean.replace(/\\./g, '').replace(',', '.');
        } else {
          clean = clean.replace(/,/g, '');
        }
      } else if (clean.includes(',')) {
        clean = clean.replace(',', '.');
      } else if (clean.includes('.')) {
        const parts = clean.split('.');
        if (parts[1].length !== 3 || parseInt(parts[0]) === 0) {
          // decimal dot
        } else {
          clean = clean.replace(/\\./g, '');
        }
      }
      return parseFloat(clean);
    };
    
    const parsed = parseCurrencyInput(inputValor.value);
    window.checkoutModalCents = isNaN(parsed) || parsed < 0 ? 0 : Math.round(parsed * 100);
  }
  
  // Select Dinheiro by default in touch mode
  window.checkoutModalSelectTouchMethod('Dinheiro');
  window.checkoutModalUpdateTouchVisor();
};

window.checkoutModalUpdateTouchVisor = () => {
  const visor = document.getElementById('checkout-modal-touch-visor');
  if (visor) {
    visor.innerText = "R$ " + (window.checkoutModalCents / 100).toFixed(2).replace('.', ',');
  }
  // Keep the hidden/native input updated so existing add logic functions
  const inputValor = document.getElementById('checkout-modal-valor');
  if (inputValor) {
    inputValor.value = "R$ " + (window.checkoutModalCents / 100).toFixed(2).replace('.', ',');
  }
};

window.checkoutModalSelectTouchMethod = (metodo) => {
  const selectMetodo = document.getElementById('checkout-modal-metodo');
  if (selectMetodo) {
    selectMetodo.value = metodo;
  }
  
  // Style large method buttons
  document.querySelectorAll('.touch-method-btn').forEach(btn => {
    const m = btn.getAttribute('data-method');
    if (m === metodo) {
      btn.style.borderColor = '#fc4b15';
      btn.style.background = '#fff5f0';
      btn.style.boxShadow = '0 0 8px rgba(252, 75, 21, 0.15)';
    } else {
      btn.style.borderColor = '#e2e8f0';
      btn.style.background = 'white';
      btn.style.boxShadow = 'none';
    }
  });
};

window.checkoutModalClearTouchValue = () => {
  window.checkoutModalCents = 0;
  window.checkoutModalUpdateTouchVisor();
};

window.checkoutModalSetRemainingTouchValue = () => {
  const falta = window.mesaFaltaPagar || 0;
  if (falta > 0) {
    window.checkoutModalCents = Math.round(falta * 100);
  } else {
    window.checkoutModalCents = 0;
  }
  window.checkoutModalUpdateTouchVisor();
};

// Bind keyboard input and touch numpad buttons
setTimeout(() => {
  const inputValor = document.getElementById('checkout-modal-valor');
  if (inputValor) {
    const parseCurrencyInput = (valStr) => {
      let clean = valStr.trim().replace('R$', '').replace(/\\s/g, '');
      if (clean.includes('.') && clean.includes(',')) {
        if (clean.indexOf('.') < clean.indexOf(',')) {
          clean = clean.replace(/\\./g, '').replace(',', '.');
        } else {
          clean = clean.replace(/,/g, '');
        }
      } else if (clean.includes(',')) {
        clean = clean.replace(',', '.');
      } else if (clean.includes('.')) {
        const parts = clean.split('.');
        if (parts[1].length !== 3 || parseInt(parts[0]) === 0) {
          // decimal
        } else {
          clean = clean.replace(/\\./g, '');
        }
      }
      return parseFloat(clean);
    };

    inputValor.addEventListener('input', (e) => {
      const parsed = parseCurrencyInput(e.target.value);
      if (!isNaN(parsed) && parsed >= 0) {
        window.checkoutModalCents = Math.round(parsed * 100);
      } else {
        window.checkoutModalCents = 0;
      }
      const visor = document.getElementById('checkout-modal-touch-visor');
      if (visor) {
        visor.innerText = "R$ " + (window.checkoutModalCents / 100).toFixed(2).replace('.', ',');
      }
    });
  }
  
  // Bind touch numpad buttons
  document.querySelectorAll('.touch-num-btn').forEach(btn => {
    btn.onclick = () => {
      const val = btn.getAttribute('data-val');
      let str = window.checkoutModalCents.toString();
      if (val === 'BACKSPACE') {
        if (str.length <= 1) {
          window.checkoutModalCents = 0;
        } else {
          window.checkoutModalCents = parseInt(str.slice(0, -1), 10) || 0;
        }
      } else if (val === '00') {
        if (window.checkoutModalCents > 0) {
          window.checkoutModalCents = parseInt(str + '00', 10) || 0;
        }
      } else {
        if (window.checkoutModalCents === 0) {
          window.checkoutModalCents = parseInt(val, 10);
        } else {
          window.checkoutModalCents = parseInt(str + val, 10) || 0;
        }
      }
      window.checkoutModalUpdateTouchVisor();
    };
  });
}, 1000);

// --- CHECKOUT MODAL LIFECYCLE CONTROLS ---
window.abrirCheckoutModal = () => {
  if (!window.mesaAtual || window.mesaAtual.isGroup === false) return alert('Selecione uma mesa ocupada primeiro.');
  
  const titleEl = document.getElementById('checkout-modal-mesa-title');
  if (titleEl) {
    titleEl.innerText = window.mesaAtual.nome || window.mesaAtual.mesaName;
  }
  
  const overlay = document.getElementById('checkout-modal-overlay');
  if (overlay) overlay.style.display = 'flex';
  
  const inputValor = document.getElementById('checkout-modal-valor');
  if (inputValor) inputValor.value = '';
  
  const inputSplitParts = document.getElementById('checkout-modal-split-parts');
  if (inputSplitParts) inputSplitParts.value = '';

  // Configurar o Modo Touch padrão baseado nas configurações
  const defaultTouch = window.pdvConfigs && (window.pdvConfigs.modo_touch === 'true' || window.pdvConfigs.modo_touch === true);
  window.checkoutModalToggleTouchMode(defaultTouch);
  
  if (window.calcRestante) window.calcRestante();
};

window.fecharCheckoutModal = () => {
  const overlay = document.getElementById('checkout-modal-overlay');
  if (overlay) overlay.style.display = 'none';
};

window.checkoutModalAddPagamento = () => {
  if (!window.mesaAtual) return alert('Selecione uma mesa primeiro.');
  const inputValor = document.getElementById('checkout-modal-valor');
  const selectMetodo = document.getElementById('checkout-modal-metodo');
  if (!inputValor || !selectMetodo) return;
  
  const parseCurrencyInput = (valStr) => {
    let clean = valStr.trim().replace('R$', '').replace(/\\s/g, '');
    if (clean.includes('.') && clean.includes(',')) {
      if (clean.indexOf('.') < clean.indexOf(',')) {
        clean = clean.replace(/\\./g, '').replace(',', '.');
      } else {
        clean = clean.replace(/,/g, '');
      }
    } else if (clean.includes(',')) {
      clean = clean.replace(',', '.');
    } else if (clean.includes('.')) {
      const parts = clean.split('.');
      if (parts[1].length !== 3 || parseInt(parts[0]) === 0) {
        // Treat dot as decimal separator
      } else {
        clean = clean.replace(/\\./g, '');
      }
    }
    return parseFloat(clean);
  };

  const valor = parseCurrencyInput(inputValor.value);
  if (isNaN(valor) || valor <= 0) {
    return alert('Digite um valor de pagamento válido maior que zero.');
  }
  
  const metodo = selectMetodo.value;
  const mesaName = window.mesaAtual.nome || window.mesaAtual.mesaName;
  
  const falta = window.mesaFaltaPagar;
  if (falta <= 0.01) {
    return alert('Esta mesa/comanda já está totalmente paga!');
  }
  
  let valorRegistrado = valor;
  if (valor > falta + 0.01) {
    if (metodo !== 'Dinheiro') {
      return alert('O valor do pagamento eletrônico não pode ser maior que o saldo restante!');
    } else {
      valorRegistrado = falta;
      alert("Pagamento em dinheiro registrado. Troco: R$ " + (valor - falta).toFixed(2).replace('.', ','));
    }
  }
  
  // Register partial payment in background
  socket.emit('movimentacao_caixa', {
    tipo: 'Entrada',
    valor: valorRegistrado,
    descricao: "Pgto Parcial: " + mesaName,
    forma_pagamento: metodo
  });
  
  socket.emit('pagamento_parcial_valor', {
    mesaName: mesaName,
    valor: valorRegistrado,
    metodo: metodo,
    userName: window.loggedInUser || 'Caixa'
  });
  
  inputValor.value = '';
};

window.checkoutModalCalcularDivisao = () => {
  const inputParts = document.getElementById('checkout-modal-split-parts');
  if (!inputParts) return;
  const parts = parseInt(inputParts.value, 10);
  if (isNaN(parts) || parts < 2) {
    return alert('Por favor, informe uma quantidade válida de pessoas (mínimo 2).');
  }
  
  const falta = window.mesaFaltaPagar;
  if (falta <= 0) {
    return alert('Não há saldo restante para dividir.');
  }
  
  const share = falta / parts;
  const inputValor = document.getElementById('checkout-modal-valor');
  if (inputValor) {
    inputValor.value = "R$ " + share.toFixed(2).replace('.', ',');
  }
  
  window.checkoutModalCents = Math.round(share * 100);
  if (typeof window.checkoutModalUpdateTouchVisor === 'function') {
    window.checkoutModalUpdateTouchVisor();
  }
};

window.checkoutModalConfirmarFechamento = () => {
  if (!window.mesaAtual) return alert('Selecione uma mesa primeiro.');
  
  const falta = window.mesaFaltaPagar;
  const finalTotal = window.mesaTotalComTaxa;
  
  if (falta > 0.01) {
    return alert('Pagamento incompleto! A mesa não pode ser fechada sem o pagamento total.');
  }
  
  const btnSubmit = document.getElementById('checkout-modal-submit-btn');
  if (btnSubmit) {
    btnSubmit.innerHTML = '<i class="ph ph-spinner-gap"></i> Processando...';
    btnSubmit.style.pointerEvents = 'none';
  }
  
  socket.emit('finalizar_mesa', {
    mesaName: window.mesaAtual.nome || window.mesaAtual.mesaName,
    payments: window.pagamentosParciais,
    totalValue: finalTotal
  });
};
`;

content += "\n\n" + modalHelpers;
console.log("SUCCESS: Appended touch screen and lifecycle helper functions to main.js!");

fs.writeFileSync(filePath, content, 'utf8');
console.log("SUCCESS: All edits applied successfully to main.js!");
