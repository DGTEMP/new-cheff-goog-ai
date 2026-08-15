const fs = require('fs');

try {
    const header = fs.readFileSync('server-prod-header.js', 'utf8');
    const server = fs.readFileSync('server.js', 'utf8');
    
    const lines = server.split('\n');
    const index = lines.findIndex(l => l.includes('db.serialize(() => {'));
    
    if (index !== -1) {
        fs.writeFileSync('server-prod.js', header + '\n' + lines.slice(index).join('\n'));
        console.log('✅ server-prod.js atualizado com sucesso a partir do server.js!');
    } else {
        console.error('❌ db.serialize não encontrado no server.js');
        process.exit(1);
    }
} catch (error) {
    console.error('❌ Erro ao sincronizar server-prod.js:', error);
    process.exit(1);
}
