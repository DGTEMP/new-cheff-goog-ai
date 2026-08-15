import glob
import re
import os

js_files = glob.glob('*.js')

for f in js_files:
    if f in ['server.js', 'migrate.js', 'patch_db.py', 'auth-sentinel.js', 'test-cert.js', 'vite.config.js']:
        continue
        
    with open(f, 'r', encoding='utf-8') as file:
        content = file.read()
        
    original = content
    
    # Substituir chamadas vazias: io() -> io({ query: { token: localStorage.getItem('chef_token') } })
    content = re.sub(r'io\(\)', r"io({ query: { token: localStorage.getItem('chef_token') } })", content)
    
    # Substituir chamadas com URL (ex: io('http://...')) 
    # Cuidado para não mexer onde já tem query (vamos assumir que não tem)
    content = re.sub(r'io\(([`\'"][^`\'"]+[`\'"])\)', r"io(\1, { query: { token: localStorage.getItem('chef_token') } })", content)
    
    # A mesma coisa para window.io()
    content = re.sub(r'window\.io\(\)', r"window.io({ query: { token: localStorage.getItem('chef_token') } })", content)
    
    if content != original:
        with open(f, 'w', encoding='utf-8') as file:
            file.write(content)
        print(f"Frontend JS patched: {f}")

# Patch area-cliente.html, ativacao.html, cardapio.html where io() is in the HTML
html_files = glob.glob('*.html')
for f in html_files:
    with open(f, 'r', encoding='utf-8') as file:
        content = file.read()
    
    original = content
    content = re.sub(r'io\(\)', r"io({ query: { token: localStorage.getItem('chef_token') } })", content)
    
    if content != original:
        with open(f, 'w', encoding='utf-8') as file:
            file.write(content)
        print(f"Frontend HTML patched: {f}")
