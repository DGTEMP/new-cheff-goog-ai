const fs = require('fs');

// --- 1. Patch configuracoes.html ---
let html = fs.readFileSync('configuracoes.html', 'utf8');

const inputHtml = '<input type="text" id="admin-cupom-produto" placeholder="Nome do Produto (Ex: 1x Cerveja 600ml)" style="padding: 10px; border: 1px solid #ccc; border-radius: 6px;">';
const selectHtml = '<select id="admin-cupom-produto" style="padding: 10px; border: 1px solid #ccc; border-radius: 6px;"><option value="">-- Selecione um Produto --</option></select>';

if (html.includes(inputHtml)) {
    html = html.replace(inputHtml, selectHtml);
    fs.writeFileSync('configuracoes.html', html, 'utf8');
    console.log("HTML select added.");
}

// --- 2. Patch configuracoes.js ---
let js = fs.readFileSync('configuracoes.js', 'utf8');

// A. Populating the select box
const populateLogic = `
        socket.once('produtos_atualizados', prods => {
          allProducts = prods;
          
          // Popular select de cupons
          const selectCupom = document.getElementById('admin-cupom-produto');
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
          
          resolve();
        });
`;

// Replace the old get_produtos block
js = js.replace(/socket\.once\('produtos_atualizados', prods => {[\s\S]*?resolve\(\);\s*}\);/, populateLogic);

// B. Updating gerarCupomQr to use the actual selected data
const oldGerarLogic = `    const itens = [
        {
            nome: produto,
            emoji: "🎁",
            quantity: 1,
            sector: "Bar" // Default
        }
    ];`;

const newGerarLogic = `
    const selectEl = document.getElementById('admin-cupom-produto');
    const selectedOpt = selectEl.selectedOptions[0];
    
    if (!selectedOpt || selectedOpt.value === "") return alert("Selecione um produto.");
    
    const itens = [
        {
            nome: "1x " + produto,
            emoji: selectedOpt.dataset.emoji || "🎁",
            quantity: 1,
            sector: selectedOpt.dataset.sector || "Bar"
        }
    ];
`;

js = js.replace(oldGerarLogic, newGerarLogic);

fs.writeFileSync('configuracoes.js', js, 'utf8');
console.log("JS select logic added.");
