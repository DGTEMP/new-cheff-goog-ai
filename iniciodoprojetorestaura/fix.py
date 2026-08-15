import sys
import re

with open('server.js', 'r', encoding='utf-8') as f:
    content = f.read()

target = r"socket\.on\('cancelar_nfce', async \(\{ id, motivo \}, ack\) => \{\n\s*db\.all\(`SELECT id, pedido_id, localName"
replacement = "socket.on('cancelar_nfce', async ({ id, motivo }, ack) => {\n      const res = await nfceService.cancelarNFCe(db, id, motivo);\n      if (typeof ack === 'function') ack(res);\n      db.all(`SELECT id, pedido_id, localName"

content = re.sub(target, replacement, content)

with open('server.js', 'w', encoding='utf-8') as f:
    f.write(content)
