import glob

for ext in ['*.html', '*.js']:
    for f in glob.glob(ext):
        if f in ['server.js', 'patch_db.py', 'fix_logout.py', 'patch_frontend.py', 'auth-sentinel.js', 'test-cert.js', 'vite.config.js']:
            continue
            
        try:
            with open(f, 'r', encoding='utf-8') as file:
                content = file.read()
        except:
            continue
            
        original = content
        
        # Revert the bad trocarUsuario
        content = content.replace('trocarUsuar' + "io({ query: { token: localStorage.getItem('chef_token') } })", 'trocarUsuario()')
        content = content.replace('trocarUsuar' + 'io({ query: { token: localStorage.getItem(\\\'chef_token\\\') } })', 'trocarUsuario()')
        content = content.replace('trocarUsuar' + "io({ query: { token: localStorage.getItem(\\'chef_token\\') } })", 'trocarUsuario()')
        
        if content != original:
            with open(f, 'w', encoding='utf-8') as file:
                file.write(content)
            print(f'Fixed bad regex in: {f}')
