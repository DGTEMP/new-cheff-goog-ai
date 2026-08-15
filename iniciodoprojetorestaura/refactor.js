const fs = require('fs');

let c = fs.readFileSync('server.js', 'utf8');

function removeBlock(regex) {
    c = c.replace(regex, '');
}

// Very careful regexes using [\s\S]*? to match the body up to the ending signature.
removeBlock(/\s*socket\.on\('get_financeiro'[\s\S]*?\}\);\s*\}\);\s*\}\);/);
removeBlock(/\s*socket\.on\('add_despesa'[\s\S]*?\}\);\s*\}\);\s*\}\);/);
removeBlock(/\s*socket\.on\('get_relatorios'[\s\S]*?\}\);\s*\}\);\s*\}\);\s*\}\);\s*\}\);/);
removeBlock(/\s*socket\.on\('get_estado_caixa'[\s\S]*?\}\);\s*\}\);/);
removeBlock(/\s*socket\.on\('abrir_caixa'[\s\S]*?\}\);\s*\}\);\s*\}\);/);
removeBlock(/\s*socket\.on\('fechar_caixa'[\s\S]*?\}\);\s*\}\);/);
removeBlock(/\s*socket\.on\('movimentacao_caixa'[\s\S]*?\}\);\s*\}\);/);
removeBlock(/\s*socket\.on\('get_relatorio_caixa'[\s\S]*?\}\);\s*\}\);\s*\}\);\s*\}\);/);
removeBlock(/\s*\/\/\s*Global lock set for duplicate payment prevention[\s\S]*?const activePaymentLocks = new Set\(\);/);
removeBlock(/\s*\/\/\s*Finaliza a mesa \(Pagamento\)[\s\S]*?\/\/\s*--- NEW: Pagamento Parcial por Valor\/Pessoas ---[\s\S]*?socket\.on\('pagamento_parcial_valor'[\s\S]*?\}\);\s*\}\);\s*\}\);/);
removeBlock(/\s*socket\.on\('finalizar_parcial_mesa'[\s\S]*?\}\);\s*\}\);\s*\}\);/);

const requireCode = `
  // --- MÓDULOS EXTERNOS (CONTROLLERS) ---
  const activePaymentLocks = new Set();
  require('./controllers/socket-financeiro')(socket, io, db, {
    checkCaixa,
    activePaymentLocks,
    broadcastPedidos,
    mesasFechando,
    licenseManager
  });
`;

c = c.replace('// --- ADMIN & SETUP ROUTES ---', requireCode + '\n  // --- ADMIN & SETUP ROUTES ---');

fs.writeFileSync('server.js', c);
console.log('Refactor completed successfully!');
