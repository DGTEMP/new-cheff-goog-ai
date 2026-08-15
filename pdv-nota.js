// ==========================================
// pdv-nota.js — Captura de Nota Fiscal de Compra / Entrada de Estoque
// Métodos: Foto (OCR local Tesseract), QR Code da nota (DANFE), Código de barras por item
// ==========================================

window.__notaFlowActive = false;

let notaItens = [];
let notaScannerQR = null;
let notaScannerBarcode = null;
let notaMetodoAtual = 'foto';
let notaFotoFile = null;
let _notaTempId = 1;

function notaVazio() {
  return { _t: _notaTempId++, nome: '', quantidade: 1, valor_unitario: 0, codigo_barras: '', unidade: 'UN', categoria: '', produto_id: null };
}

function moedaParaFloat(v) {
  if (typeof v === 'number') return v;
  const s = String(v || '').replace(/[R$\s]/g, '').replace(/\./g, '').replace(',', '.');
  const n = parseFloat(s);
  return isNaN(n) ? 0 : n;
}

function floatParaMoeda(n) {
  return 'R$ ' + (parseFloat(n) || 0).toFixed(2).replace('.', ',');
}

// ---------------- Modal principal ----------------

function abrirModalNota() {
  window.__notaFlowActive = true;
  notaItens = [];
  notaFotoFile = null;
  _notaTempId = 1;
  ['nota-fornecedor', 'nota-numero', 'nota-chave', 'nota-obs'].forEach(function (id) {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
  const dt = document.getElementById('nota-data');
  if (dt) dt.value = new Date().toISOString().slice(0, 10);
  const prev = document.getElementById('nota-foto-preview');
  if (prev) prev.innerHTML = '';
  const ocr = document.getElementById('nota-ocr-status');
  if (ocr) ocr.style.display = 'none';
  renderNotaItens();
  notaSelecionarMetodo('foto');
  const modal = document.getElementById('modal-nota');
  if (modal) modal.classList.add('active');
  // Pausa o leitor da tela para não conflitar com a câmera
  stopEstoqueScanner();
}

function fecharModalNota() {
  window.__notaFlowActive = false;
  pararScannerNotaQR();
  pararScannerNotaBarcode();
  const modal = document.getElementById('modal-nota');
  if (modal) modal.classList.remove('active');
  const viewEstoque = document.getElementById('view-estoque');
  if (viewEstoque && viewEstoque.classList.contains('active')) {
    setTimeout(initEstoqueScanner, 400);
  }
}

function notaSelecionarMetodo(m) {
  notaMetodoAtual = m;
  document.querySelectorAll('.nota-method-tab').forEach(function (t) {
    t.classList.toggle('active', t.dataset.method === m);
  });
  ['nota-panel-foto', 'nota-panel-qr', 'nota-panel-barcode'].forEach(function (id) {
    const el = document.getElementById(id);
    if (el) el.style.display = (id === 'nota-panel-' + m) ? '' : 'none';
  });
  if (m === 'qr') { pararScannerNotaBarcode(); setTimeout(notaIniciarScannerQR, 250); }
  else pararScannerNotaQR();
  if (m === 'barcode') { pararScannerNotaQR(); setTimeout(notaIniciarScannerBarcode, 250); }
  else pararScannerNotaBarcode();
}

// ---------------- Foto + OCR ----------------

function notaEscolherFoto() {
  document.getElementById('nota-foto-input').click();
}

function notaFotoSelecionada(input) {
  const file = input && input.files && input.files[0];
  if (!file) return;
  notaFotoFile = file;
  const prev = document.getElementById('nota-foto-preview');
  if (prev) {
    prev.innerHTML = '';
    const img = document.createElement('img');
    img.src = URL.createObjectURL(file);
    img.style.maxWidth = '100%';
    img.style.maxHeight = '260px';
    img.style.borderRadius = '10px';
    img.style.display = 'block';
    prev.appendChild(img);
  }
}

function carregarImagemCanvas(file) {
  return new Promise(function (resolve, reject) {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = function () {
      const maxDim = 2200;
      let scale = 1;
      if (img.width > maxDim || img.height > maxDim) scale = Math.min(maxDim / img.width, maxDim / img.height);
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      resolve(canvas);
    };
    img.onerror = reject;
    img.src = url;
  });
}

function notaReconhecerOCR() {
  if (!notaFotoFile) {
    alert('Tire ou selecione a foto da nota primeiro.');
    return;
  }
  if (typeof Tesseract === 'undefined') {
    alert('O módulo OCR (Tesseract) não está disponível. Verifique a conexão ou o carregamento.');
    return;
  }
  const status = document.getElementById('nota-ocr-status');
  if (status) {
    status.style.display = 'block';
    status.textContent = 'Lendo itens da nota... 0%';
    status.style.color = '';
  }
  carregarImagemCanvas(notaFotoFile)
    .then(function (canvas) {
      const logger = function (m) {
        if (m && m.status === 'recognizing text' && status) {
          status.textContent = 'Lendo itens da nota... ' + Math.round((m.progress || 0) * 100) + '%';
        }
      };
      const opts = { workerPath: '/vendor/tesseract/worker.min.js', langPath: '/vendor/tesseract/lang/', logger: logger };
      opts.corePath = '/vendor/tesseract/tesseract-core-simd.wasm.js';
      return Tesseract.recognize(canvas, 'por', opts).catch(function () {
        opts.corePath = '/vendor/tesseract/tesseract-core.wasm.js';
        return Tesseract.recognize(canvas, 'por', opts);
      });
    })
    .then(function (res) {
      const text = (res && res.data && res.data.text) || '';
      const itens = parseNotaOCR(text);
      if (status) status.style.color = '';
      if (itens.length === 0) {
        if (status) status.textContent = 'Nenhum item reconhecido automaticamente. Digite manualmente na tabela abaixo ou tente outro método.';
        return;
      }
      itens.forEach(function (it) {
        notaItens.push(Object.assign(notaVazio(), { nome: it.nome, quantidade: it.quantidade, valor_unitario: it.valor_unitario }));
      });
      renderNotaItens();
      if (status) status.textContent = itens.length + ' item(ns) reconhecido(s). Revise e ajuste antes de salvar.';
    })
    .catch(function (e) {
      if (status) {
        status.textContent = 'Falha na leitura OCR: ' + (e && e.message || e);
        status.style.color = '#f87171';
      }
    });
}

function parseNotaOCR(text) {
  const out = [];
  String(text).split(/\r?\n/).forEach(function (lineRaw) {
    const line = String(lineRaw).replace(/[|;]/g, ' ').replace(/\s+/g, ' ').trim();
    if (!line) return;
    if (/^(nota|danfe|nf-?e|nfce|cupom|consumidor|estabelecimento|cgc|cnpj|cpf|endere|data|hora|protocolo|chave|via|item descri|descrição|qtd|valor unit|valor total|total|subtotal|desconto|acréscimo|troco|pagamento|dinheiro|cartão|pix|crédito|débito)/i.test(line)) return;

    const hasValor = /[\d]+[.,]\d{1,2}/.test(line);
    if (!hasValor && line.length > 6) return;

    // Padrão DANFE: "002 DESCRICAO 2 UN x 5,00 10,00" ou "2 UN 5,00"
    const m = line.match(/^(\d{1,4})\s+(.+?)\s+(\d+[.,]?\d*)\s+((?:UN|KG|G|GR|L|ML|LT|CX|CXA|PCT|PC|DZ|UND|UNIDADE|CAIXA)\b)?\s*(?:[xX×]\s*)?(\d+[.,]\d{1,2})(?:\s+(\d+[.,]\d{1,2}))?\s*$/i);
    if (m) {
      const nome = (m[2] || '').trim();
      if (nome && /[a-zà-ú0-9]/i.test(nome)) {
        out.push({ nome: nome, quantidade: parseFloat((m[3] || '1').replace(',', '.')), valor_unitario: parseFloat((m[5] || '0').replace(',', '.')) });
        return;
      }
    }

    // Padrão simples: "DESCRICAO 5 x 2,50"
    const m2 = line.match(/^(.+?)\s+(\d+[.,]?\d*)\s+[xX×]\s+(\d+[.,]\d{1,2})\s*$/);
    if (m2) {
      const nome = (m2[1] || '').trim();
      if (nome && /[a-zà-ú]/i.test(nome)) {
        out.push({ nome: nome, quantidade: parseFloat((m2[2] || '1').replace(',', '.')), valor_unitario: parseFloat((m2[3] || '0').replace(',', '.')) });
        return;
      }
    }

    // Padrão: "DESCRICAO 2 UN 5,00" (sem x e sem número de item)
    const m3 = line.match(/^(.+?)\s+(\d+[.,]?\d*)\s+(UN|KG|G|GR|L|ML|LT|CX|CXA|PCT|PC|DZ|UND|UNIDADE|CAIXA)\b\s+(\d+[.,]\d{1,2})\s*$/i);
    if (m3) {
      const nome = (m3[1] || '').trim();
      if (nome && /[a-zà-ú]/i.test(nome)) {
        out.push({ nome: nome, quantidade: parseFloat((m3[2] || '1').replace(',', '.')), valor_unitario: parseFloat((m3[4] || '0').replace(',', '.')) });
      }
    }
  });
  return out;
}

// ---------------- QR Code da nota ----------------

function notaIniciarScannerQR() {
  if (notaScannerQR || typeof Html5QrcodeScanner === 'undefined') return;
  notaScannerQR = new Html5QrcodeScanner(
    "nota-qr-reader",
    { fps: 10, qrbox: { width: 220, height: 220 } },
    false
  );
  notaScannerQR.render(notaOnQRDecoded, function () {});
}

function notaOnQRDecoded(decodedText) {
  if (notaScannerQR) notaScannerQR.pause();
  tocarBeep();
  const msg = document.getElementById('nota-qr-msg');
  if (msg) {
    msg.textContent = 'QR lido! Processando...';
    msg.style.color = '';
    msg.style.display = 'block';
  }
  const dig = String(decodedText).replace(/\D/g, '').match(/\d{44}/);
  if (dig) {
    const el = document.getElementById('nota-chave');
    if (el) el.value = dig[0];
  }
  window.socket.emit('nota_buscar_por_chave', decodedText);
}

function pararScannerNotaQR() {
  if (notaScannerQR) {
    try { notaScannerQR.clear(); } catch (e) { /* ignora */ }
    notaScannerQR = null;
  }
}

// ---------------- Código de barras por item ----------------

function notaIniciarScannerBarcode() {
  if (notaScannerBarcode || typeof Html5QrcodeScanner === 'undefined') return;
  notaScannerBarcode = new Html5QrcodeScanner(
    "nota-barcode-reader",
    { fps: 10, qrbox: { width: 220, height: 220 } },
    false
  );
  notaScannerBarcode.render(notaOnBarcodeDecoded, function () {});
}

function notaOnBarcodeDecoded(decodedText) {
  if (notaScannerBarcode) notaScannerBarcode.pause();
  tocarBeep();
  const msg = document.getElementById('nota-barcode-msg');
  if (msg) {
    msg.textContent = 'Código ' + decodedText + ' lido. Buscando produto...';
    msg.style.color = '';
    msg.style.display = 'block';
  }
  window.socket.emit('buscar_produto_por_codigo', decodedText);
}

function pararScannerNotaBarcode() {
  if (notaScannerBarcode) {
    try { notaScannerBarcode.clear(); } catch (e) { /* ignora */ }
    notaScannerBarcode = null;
  }
}

function notaResumeBarcode() {
  if (notaScannerBarcode) notaScannerBarcode.resume();
}

window.__notaOnBarcode = function (produto) {
  if (!window.__notaFlowActive) return;
  const msg = document.getElementById('nota-barcode-msg');
  const item = notaVazio();
  item.nome = produto.nome || 'Produto';
  item.codigo_barras = produto.codigo_barras || '';
  item.categoria = produto.categoria || '';
  item.unidade = produto.unidade || 'UN';
  item.produto_id = produto.id;
  item.quantidade = 1;
  item.valor_unitario = parseFloat(produto.preco_custo) || 0;
  notaItens.push(item);
  renderNotaItens();
  if (msg) {
    msg.textContent = 'Produto "' + produto.nome + '" adicionado. Ajuste quantidade/custo se necessário e escaneie o próximo.';
    msg.style.color = '';
    msg.style.display = 'block';
  }
  notaResumeBarcode();
};

window.__notaResumeBarcode = notaResumeBarcode;

// ---------------- Itens da nota (revisão) ----------------

function renderNotaTotal() {
  let total = 0;
  notaItens.forEach(function (it) {
    total += (parseFloat(it.quantidade) || 0) * (parseFloat(it.valor_unitario) || 0);
  });
  const el = document.getElementById('nota-total');
  if (el) el.textContent = floatParaMoeda(total);
}

function renderNotaItens() {
  const wrap = document.getElementById('nota-itens-list');
  if (!wrap) return;
  if (notaItens.length === 0) {
    wrap.innerHTML = '<div style="color:var(--text-muted);font-size:13px;text-align:center;padding:20px;">Nenhum item ainda. Use Foto, QR da Nota ou Código de barras.</div>';
    renderNotaTotal();
    return;
  }
  wrap.innerHTML = '';
  notaItens.forEach(function (it, idx) {
    const sub = (parseFloat(it.quantidade) || 0) * (parseFloat(it.valor_unitario) || 0);
    const row = document.createElement('div');
    row.style.cssText = 'background:var(--surface, #fff);border:1px solid var(--border-color);border-radius:10px;padding:10px;margin-bottom:8px;';
    row.innerHTML =
      '<div style="display:flex;gap:8px;margin-bottom:8px;">' +
        '<input type="text" class="form-input nota-item-nome" value="' + escHtml(it.nome) + '" placeholder="Nome do produto" data-idx="' + idx + '" style="flex:1;">' +
        '<button onclick="notaRemoverItem(' + idx + ')" style="background:#fee2e2;border:none;border-radius:8px;padding:0 12px;color:#ef4444;cursor:pointer;"><i class="ph ph-trash"></i></button>' +
      '</div>' +
      '<div style="display:flex;gap:8px;align-items:flex-end;">' +
        '<div style="flex:1;">' +
          '<label style="font-size:11px;color:var(--text-muted);display:block;margin-bottom:2px;">Qtd</label>' +
          '<input type="number" class="form-input nota-item-qtd" value="' + it.quantidade + '" min="0" step="0.01" data-idx="' + idx + '">' +
        '</div>' +
        '<div style="flex:1.4;">' +
          '<label style="font-size:11px;color:var(--text-muted);display:block;margin-bottom:2px;">Custo unit. (R$)</label>' +
          '<input type="number" class="form-input nota-item-custo" value="' + (it.valor_unitario || '') + '" min="0" step="0.01" data-idx="' + idx + '">' +
        '</div>' +
        '<div style="font-weight:700;color:var(--primary);padding-bottom:8px;white-space:nowrap;">' + floatParaMoeda(sub) + '</div>' +
      '</div>';
    wrap.appendChild(row);
  });
  renderNotaTotal();

  wrap.querySelectorAll('.nota-item-nome').forEach(function (inp) {
    inp.addEventListener('input', function () { notaItens[inp.dataset.idx].nome = inp.value; });
  });
  wrap.querySelectorAll('.nota-item-qtd').forEach(function (inp) {
    inp.addEventListener('input', function () {
      notaItens[inp.dataset.idx].quantidade = parseFloat(inp.value) || 0;
      renderNotaTotal();
    });
  });
  wrap.querySelectorAll('.nota-item-custo').forEach(function (inp) {
    inp.addEventListener('input', function () {
      notaItens[inp.dataset.idx].valor_unitario = moedaParaFloat(inp.value);
      renderNotaTotal();
    });
  });
}

function notaAddLinha() {
  notaItens.push(notaVazio());
  renderNotaItens();
  const wrap = document.getElementById('nota-itens-list');
  if (wrap) {
    const nome = wrap.querySelector('.nota-item-nome');
    if (nome) nome.focus();
  }
}

function notaRemoverItem(idx) {
  notaItens.splice(idx, 1);
  renderNotaItens();
}

// ---------------- Salvar nota ----------------

function notaSalvar() {
  const itens = notaItens
    .filter(function (it) { return (it.nome || '').toString().trim(); })
    .map(function (it) {
      return {
        nome: it.nome.trim(),
        quantidade: parseFloat(it.quantidade) || 1,
        valor_unitario: parseFloat(it.valor_unitario) || 0,
        codigo_barras: it.codigo_barras || '',
        unidade: it.unidade || 'UN',
        categoria: it.categoria || '',
        produto_id: it.produto_id || null
      };
    });
  if (itens.length === 0) {
    alert('Adicione pelo menos um item antes de salvar.');
    return;
  }
  window.socket.emit('nota_salvar', {
    fornecedor: document.getElementById('nota-fornecedor').value,
    numero: document.getElementById('nota-numero').value,
    chave_acesso: document.getElementById('nota-chave').value,
    data_nota: document.getElementById('nota-data').value,
    observacao: document.getElementById('nota-obs').value,
    metodo: notaMetodoAtual,
    colaborador: window.currentUser || 'Caixa Mobile',
    itens: itens
  });
}

// ---------------- Lista de notas anteriores ----------------

let notasLista = [];

function abrirNotasLista() {
  document.getElementById('modal-notas-list').classList.add('active');
  document.getElementById('notas-list-body').innerHTML = '<div style="text-align:center;color:var(--text-muted);padding:20px;">Carregando notas...</div>';
  window.socket.emit('notas_listar');
}

function fecharNotasLista() {
  document.getElementById('modal-notas-list').classList.remove('active');
}

function renderNotasLista() {
  const wrap = document.getElementById('notas-list-body');
  if (!wrap) return;
  if (notasLista.length === 0) {
    wrap.innerHTML = '<div style="text-align:center;color:var(--text-muted);padding:20px;">Nenhuma nota registrada ainda.</div>';
    return;
  }
  wrap.innerHTML = '';
  notasLista.forEach(function (n) {
    const dataStr = String(n.created_at || '').replace('T', ' ').slice(0, 16);
    const card = document.createElement('div');
    card.style.cssText = 'background:var(--surface,#fff);border:1px solid var(--border-color);border-radius:10px;padding:12px;margin-bottom:8px;';
    card.innerHTML =
      '<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px;">' +
        '<div style="flex:1;">' +
          '<div style="font-weight:700;color:var(--text-main);">' + escHtml(n.fornecedor || 'Sem fornecedor') + (n.numero ? ' · Nº ' + escHtml(n.numero) : '') + '</div>' +
          '<div style="font-size:12px;color:var(--text-muted);margin-top:4px;">' + escHtml(dataStr) + ' · ' + (n.itens_qtd || 0) + ' item(ns) · por ' + escHtml(n.colaborador || '') + '</div>' +
        '</div>' +
        '<div style="text-align:right;">' +
          '<div style="font-weight:800;color:var(--primary);">' + floatParaMoeda(n.valor_total) + '</div>' +
          '<div style="font-size:11px;color:var(--text-muted);text-transform:capitalize;">' + escHtml(n.metodo || 'manual') + '</div>' +
        '</div>' +
      '</div>' +
      '<div style="display:flex;gap:8px;margin-top:10px;">' +
        '<button class="btn-primary" style="flex:1;padding:8px;font-size:12px;" onclick="notaVerDetalhes(' + n.id + ')">Ver detalhes</button>' +
        '<button onclick="notaExcluir(' + n.id + ')" style="background:#fee2e2;border:none;border-radius:8px;padding:0 14px;color:#ef4444;cursor:pointer;"><i class="ph ph-trash"></i></button>' +
      '</div>';
    wrap.appendChild(card);
  });
}

function notaVerDetalhes(id) {
  window.socket.emit('nota_detalhes', id);
}

function notaExcluir(id) {
  if (!confirm('Excluir esta nota do histórico? (O estoque já adicionado NÃO será removido)')) return;
  window.socket.emit('nota_excluir', id);
}

// ---------------- Socket ----------------

document.addEventListener('DOMContentLoaded', function () {
  if (!window.socket) return;

  window.socket.on('nota_chave_resultado', function (res) {
    if (!window.__notaFlowActive) return;
    const msg = document.getElementById('nota-qr-msg');
    if (res && res.chave) {
      const el = document.getElementById('nota-chave');
      if (el) el.value = res.chave;
    }
    if (res && res.error) {
      if (msg) {
        msg.textContent = res.error;
        msg.style.color = '#f87171';
        msg.style.display = 'block';
      }
    } else if (res && res.itens && res.itens.length) {
      res.itens.forEach(function (it) {
        notaItens.push(Object.assign(notaVazio(), {
          nome: it.nome,
          quantidade: parseFloat(it.quantidade) || 1,
          valor_unitario: parseFloat(it.valor_unitario) || 0
        }));
      });
      renderNotaItens();
      if (msg) {
        msg.textContent = res.itens.length + ' item(ns) importados do QR. Revise os valores antes de salvar.';
        msg.style.color = '';
        msg.style.display = 'block';
      }
    } else if (msg) {
      msg.textContent = (res && res.aviso) || 'QR da nota registrado (chave). Preencha os itens manualmente ou use Foto/Barcode.';
      msg.style.color = '';
      msg.style.display = 'block';
    }
    notaResumeBarcode();
    if (notaScannerQR) notaScannerQR.resume();
  });

  window.socket.on('nota_salvar_resultado', function (res) {
    if (!res) return;
    if (res.error) { alert(res.error); return; }
    alert('Nota salva! ' + res.atualizados + ' produto(s) atualizado(s), ' + res.criados + ' criado(s). Total R$ ' + parseFloat(res.valor_total || 0).toFixed(2).replace('.', ','));
    fecharModalNota();
    abrirNotasLista();
  });

  window.socket.on('notas_lista', function (res) {
    if (res && res.error) {
      document.getElementById('notas-list-body').innerHTML = '<div style="color:#ef4444;">' + escHtml(res.error) + '</div>';
      return;
    }
    notasLista = (res && res.notas) || [];
    renderNotasLista();
  });

  window.socket.on('nota_detalhes_resultado', function (res) {
    const wrap = document.getElementById('notas-list-body');
    if (!wrap) return;
    if (!res || res.error || !res.nota) {
      wrap.innerHTML = '<div style="color:#ef4444;">' + escHtml((res && res.error) || 'Erro ao carregar detalhes') + '</div>';
      return;
    }
    const n = res.nota;
    let html = '<div style="margin-bottom:8px;"><button onclick="renderNotasLista()" style="background:none;border:none;color:var(--primary);cursor:pointer;font-weight:600;"><i class="ph ph-arrow-left"></i> Voltar</button></div>';
    html += '<div style="background:var(--surface,#fff);border:1px solid var(--border-color);border-radius:10px;padding:12px;">' +
      '<div style="font-weight:700;color:var(--text-main);">' + escHtml(n.fornecedor || 'Sem fornecedor') + '</div>' +
      '<div style="font-size:12px;color:var(--text-muted);margin-top:4px;">' + escHtml(String(n.created_at || '').replace('T', ' ').slice(0, 16)) + ' · ' + (res.itens || []).length + ' item(ns) · ' + escHtml(n.metodo || 'manual') + '</div>' +
      (n.chave_acesso ? '<div style="font-size:11px;color:var(--text-muted);margin-top:6px;word-break:break-all;">Chave: ' + escHtml(n.chave_acesso) + '</div>' : '') +
      '</div>';
    (res.itens || []).forEach(function (it) {
      html += '<div style="display:flex;justify-content:space-between;align-items:center;background:var(--surface,#fff);border:1px solid var(--border-color);border-radius:10px;padding:10px 12px;margin-top:8px;">' +
        '<div style="flex:1;">' +
          '<div style="font-weight:600;font-size:14px;">' + escHtml(it.nome) + '</div>' +
          '<div style="font-size:12px;color:var(--text-muted);">' + it.quantidade + ' ' + escHtml(it.unidade || 'UN') + ' x ' + floatParaMoeda(it.valor_unitario) + '</div>' +
        '</div>' +
        '<div style="font-weight:700;color:var(--primary);">' + floatParaMoeda(it.valor_total) + '</div>' +
      '</div>';
    });
    html += '<div style="display:flex;justify-content:space-between;align-items:center;margin-top:12px;font-weight:800;color:var(--text-main);font-size:15px;"><span>Total</span><span>' + floatParaMoeda(n.valor_total) + '</span></div>';
    wrap.innerHTML = html;
  });

  window.socket.on('nota_excluir_resultado', function (res) {
    if (res && res.error) { alert(res.error); return; }
    window.socket.emit('notas_listar');
  });
});
