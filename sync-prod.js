const fs = require('fs');

try {
    const header = fs.readFileSync('server-prod-header.js', 'utf8');
    const server = fs.readFileSync('server.js', 'utf8');

    const lines = server.split('\n');
    // O corte correto é no db.serialize do BANCO DO TENANT (seguido dos PRAGMAs),
    // não no primeiro db.serialize do arquivo (que está dentro de seedTenantDb).
    let index = -1;
    for (let i = 0; i < lines.length; i++) {
        if (lines[i].includes('db.serialize(() => {')) {
            const proxima = (lines[i + 1] || '') + (lines[i + 2] || '');
            if (proxima.includes("PRAGMA journal_mode = WAL")) { index = i; break; }
        }
    }

    if (index !== -1) {
        fs.writeFileSync('server-prod.js', header + '\n' + lines.slice(index).join('\n'));
        console.log('✅ server-prod.js atualizado com sucesso a partir do server.js! (corte na linha ' + (index + 1) + ')');
    } else {
        console.error('❌ db.serialize do banco tenant (com PRAGMAs) não encontrado no server.js');
        process.exit(1);
    }
} catch (error) {
    console.error('❌ Erro ao sincronizar server-prod.js:', error.message);
    process.exit(1);
}
