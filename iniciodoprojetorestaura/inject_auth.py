import os
import re

files = ['index.html', 'configuracoes.html', 'dashboard.html', 'garcom.html', 'fila-pedidos.html']
for file in files:
    if os.path.exists(file):
        with open(file, 'r', encoding='utf-8') as f:
            content = f.read()
        if 'auth.js' not in content:
            content = re.sub(r'<head>', '<head>\n  <script src="auth.js"></script>', content, count=1)
            with open(file, 'w', encoding='utf-8') as f:
                f.write(content)
