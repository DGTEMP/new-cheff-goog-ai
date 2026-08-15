import glob
import re

js_files = glob.glob('*.js')

for f in js_files:
    if f in ['server.js', 'migrate.js', 'patch_db.py', 'auth-sentinel.js', 'test-cert.js', 'vite.config.js']:
        continue
        
    with open(f, 'r', encoding='utf-8') as file:
        content = file.read()
        
    original = content
    
    # 1. Update main.js fazerLogout
    if 'window.fazerLogout =' in content:
        content = re.sub(
            r"window\.fazerLogout = function\(\) \{[\s\S]*?\};",
            """window.fazerLogout = function() {
  if (confirm('Deseja realmente encerrar a sessão e fazer logout do SaaS?')) {
    localStorage.removeItem('logged_user');
    localStorage.removeItem('chef_token');
    localStorage.removeItem('restaurante_id');
    localStorage.removeItem('chef_app_creds');
    localStorage.removeItem('chef_credentials');
    window.location.href = '/login.html';
  }
};""",
            content
        )
        
    # 2. Update garcom.js and painel-funcionario.js btn-logout
    if "document.getElementById('btn-logout').onclick =" in content:
        content = re.sub(
            r"document\.getElementById\('btn-logout'\)\.onclick = \(\) => \{([\s\S]*?)localStorage\.removeItem\('chef_credentials'\);([\s\S]*?)\};",
            r"document.getElementById('btn-logout').onclick = () => {\1localStorage.removeItem('chef_credentials');\n  localStorage.removeItem('chef_token');\n  localStorage.removeItem('restaurante_id');\n  localStorage.removeItem('chef_app_creds');\n  window.location.href = '/login.html';\2};",
            content
        )
        
    if content != original:
        with open(f, 'w', encoding='utf-8') as file:
            file.write(content)
        print(f"Patched logout logic in: {f}")
