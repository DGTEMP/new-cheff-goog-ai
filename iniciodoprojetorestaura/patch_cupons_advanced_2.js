const fs = require('fs');

let js = fs.readFileSync('configuracoes.js', 'utf8');

const jsLogic = `
window.cupomItensBuilder = [];

// Init UI Dias
function initDiasGrid() {
    const grid = document.getElementById('cupom-dias-grid');
    if (!grid) return;
    
    const dias = [
        { id: 'domingo', nome: 'Domingo' },
        { id: 'segunda', nome: 'Segunda-feira' },
        { id: 'terca', nome: 'Terça-feira' },
        { id: 'quarta', nome: 'Quarta-feira' },
        { id: 'quinta', nome: 'Quinta-feira' },
        { id: 'sexta', nome: 'Sexta-feira' },
        { id: 'sabado', nome: 'Sábado' }
    ];
    
    let h = '';
    dias.forEach(d => {
        h += \`
          <div style="display:flex; align-items:center; gap: 10px; background: #f9f9f9; padding: 5px 10px; border-radius: 4px; border: 1px solid #eee;">
             <label style="width: 120px; display:flex; align-items:center; gap:5px; font-weight:bold;">
               <input type="checkbox" id="chk-dia-\${d.id}" checked> \${d.nome}
             </label>
             <input type="time" id="inicio-dia-\${d.id}" value="00:00" style="padding: 4px; border:1px solid #ccc; border-radius:4px;">
             <span>até</span>
             <input type="time" id="fim-dia-\${d.id}" value="23:59" style="padding: 4px; border:1px solid #ccc; border-radius:4px;">
          </div>
        \`;
    });
    grid.innerHTML = h;
}
// Call it when script loads
setTimeout(initDiasGrid, 500);

window.addCupomItem = () => {
    const sel = document.getElementById('admin-cupom-produto-sel');
    const qtd = parseInt(document.getElementById('admin-cupom-qtd').value);
    
    if (!sel.value) return alert('Selecione um produto.');
    if (isNaN(qtd) || qtd < 1) return alert('Quantidade inválida.');
    
    const opt = sel.selectedOptions[0];
    
    window.cupomItensBuilder.push({
        nome: opt.value,
        emoji: opt.dataset.emoji || "🎁",
        sector: opt.dataset.sector || "Bar",
        quantity: qtd
    });
    
    renderCupomItens();
};

window.removerCupomItem = (idx) => {
    window.cupomItensBuilder.splice(idx, 1);
    renderCupomItens();
};

function renderCupomItens() {
    const list = document.getElementById('cupom-itens-list');
    const noItems = document.getElementById('cupom-no-items');
    
    if (window.cupomItensBuilder.length === 0) {
        if(noItems) noItems.style.display = 'block';
        list.innerHTML = '';
        if(noItems) list.appendChild(noItems);
        return;
    }
    
    let h = '';
    window.cupomItensBuilder.forEach((item, i) => {
        h += \`
          <div style="display:flex; justify-content:space-between; align-items:center; background: #f1f3f5; padding: 6px 10px; border-radius: 4px;">
             <span>\${item.quantity}x \${item.emoji} \${item.nome}</span>
             <button style="background:red; color:white; border:none; padding:2px 6px; border-radius:4px; cursor:pointer;" onclick="window.removerCupomItem(\${i})">X</button>
          </div>
        \`;
    });
    list.innerHTML = h;
}

window.gerarCupomQrAvançado = () => {
    let codigo = document.getElementById('admin-cupom-codigo').value.trim().toUpperCase();
    const validade = document.getElementById('admin-cupom-validade').value;
    const valorTipo = document.getElementById('admin-cupom-valor-tipo').value;
    const valorStr = document.getElementById('admin-cupom-valor').value;
    const valor = parseFloat(valorStr) || 0;

    if (!codigo) {
        codigo = 'PROMO-' + Math.random().toString(36).substring(2, 8).toUpperCase();
    }
    
    if (window.cupomItensBuilder.length === 0 && valorTipo === 'preco_fixo') {
        return alert("Você precisa adicionar itens no combo se quiser cobrar um preço fixo por ele.");
    }
    
    const dias = ['domingo', 'segunda', 'terca', 'quarta', 'quinta', 'sexta', 'sabado'];
    const dias_horarios = {};
    dias.forEach(d => {
       const chk = document.getElementById('chk-dia-'+d);
       const ini = document.getElementById('inicio-dia-'+d);
       const fim = document.getElementById('fim-dia-'+d);
       if (chk) {
           dias_horarios[d] = {
               ativo: chk.checked,
               inicio: ini.value,
               fim: fim.value
           };
       }
    });

    let titulo = "CUPOM DESCONTO";
    if (window.cupomItensBuilder.length > 0) titulo = window.cupomItensBuilder[0].nome + (window.cupomItensBuilder.length > 1 ? " + outros" : "");

    const payload = {
        codigo,
        titulo,
        itens: window.cupomItensBuilder,
        validade: validade || null,
        dias_horarios,
        valor_tipo: valorTipo,
        valor: valor
    };

    socket.emit('criar_cupom', payload);
};

window.printCupomAvançado = () => {
    const titulo = document.getElementById('cupom-qr-title').innerText;
    const cod = document.getElementById('cupom-qr-code-text').innerText;
    const imgSrc = document.getElementById('cupom-qr-image').src;
    
    const w = window.open('', '_blank', 'width=400,height=600');
    w.document.write(\`
      <html><head><style>
        body { font-family: monospace; text-align: center; margin: 0; padding: 20px; }
        .bold { font-weight: bold; }
      </style></head><body>
        <div class="bold" style="font-size:20px; margin-bottom:10px;">CHEF COZINHA</div>
        <div style="font-size:16px; margin-bottom:15px;">VOUCHER / COMBO PROMOCIONAL</div>
        <div class="bold" style="font-size:18px; margin-bottom:20px;">\${titulo}</div>
        <img src="\${imgSrc}" style="width: 200px; height: 200px; margin-bottom: 10px;">
        <div style="font-size:24px; font-weight:bold; margin-bottom:20px;">\${cod}</div>
        <div style="font-size:12px; margin-top:30px;">Apresente este QR Code para o garçom.</div>
        <div style="font-size:10px; margin-top:5px; color:#666;">Uso único. Sujeito a restrições de horários e validade.</div>
      </body></html>
    \`);
    w.document.close();
    setTimeout(() => { w.print(); }, 1000);
};

`;

// Fix population selector
const populateReplace = `
          // Popular select de cupons avançados
          const selectCupom = document.getElementById('admin-cupom-produto-sel');
          if (selectCupom) {
             selectCupom.innerHTML = '<option value="">-- Selecione um Produto --</option>';
             prods.forEach(p => {
                const opt = document.createElement('option');
                opt.value = p.nome;
                opt.dataset.emoji = p.emoji || "🎁";
                opt.dataset.sector = p.sector || "Bar";
                opt.innerText = (p.emoji || "") + " " + p.nome + " - R$ " + parseFloat(p.valor).toFixed(2).replace('.', ',');
                selectCupom.appendChild(opt);
             });
          }
`;

js = js.replace(/const selectCupom = document\.getElementById\('admin-cupom-produto'\);[\s\S]*?\}\s*resolve\(\);/, populateReplace + "\n          resolve();");

// Replace the old gerarCupomQr completely
js = js.replace(/window\.gerarCupomQr = \(\) => \{[\s\S]*?window\.printCupom = \(\) => \{[\s\S]*?setTimeout\(\(\) => \{ w\.print\(\); \}, 1000\);\s*\};\s*/, jsLogic);

fs.writeFileSync('configuracoes.js', js, 'utf8');
console.log("JS patched.");
