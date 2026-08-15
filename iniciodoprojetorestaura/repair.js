const fs = require('fs');

let lines = fs.readFileSync('server.js', 'utf8').split('\n');

const startIdx = lines.findIndex(l => l.includes("data_pedido DATETIME,"));
const endIdx = lines.findIndex((l, i) => i > startIdx && l.includes("valor TEXT") && lines[i+1].includes(")"));

if (startIdx !== -1 && endIdx !== -1) {
    const correctBlock = "      data_pedido DATETIME,\n" +
"      valor REAL,\n" +
"      status TEXT DEFAULT 'Pendente',\n" +
"      data_aprovacao DATETIME\n" +
"    )\n" +
"  `);\n" +
"\n" +
"  db.run(\"CREATE TABLE IF NOT EXISTS cupons (codigo TEXT PRIMARY KEY, itens_json TEXT, usado INTEGER DEFAULT 0, data_criacao DATETIME DEFAULT CURRENT_TIMESTAMP)\");\n" +
"  db.run(\"ALTER TABLE cupons ADD COLUMN validade TEXT\", () => {});\n" +
"  db.run(\"ALTER TABLE cupons ADD COLUMN dias_horarios_json TEXT\", () => {});\n" +
"  db.run(\"ALTER TABLE cupons ADD COLUMN valor_tipo TEXT\", () => {});\n" +
"  db.run(\"ALTER TABLE cupons ADD COLUMN valor REAL\", () => {});\n" +
"\n" +
"  db.run(`\n" +
"    CREATE TABLE IF NOT EXISTS configuracoes (\n" +
"      chave TEXT PRIMARY KEY,";

    lines.splice(startIdx, endIdx - startIdx, correctBlock);
    
    fs.writeFileSync('server.js', lines.join('\n'), 'utf8');
    console.log("server.js repaired!");
} else {
    console.log("Could not find boundaries.");
}
