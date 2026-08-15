import re
import os

def patch_main_js():
    with open('main.js', 'r', encoding='utf-8') as f:
        content = f.read()

    # Revert fazerLogout to operator logout
    fazer_logout_pattern = r"window\.fazerLogout = function\(\) \{[\s\S]*?\};"
    fazer_logout_replacement = """window.fazerLogout = function() {
  if (confirm('Deseja realmente encerrar a sessão do Operador?')) {
    localStorage.removeItem('logged_user');
    localStorage.removeItem('chef_credentials');
    window.location.href = '/ativacao.html';
  }
};

window.desconectarSaaS = function() {
  const creds = JSON.parse(localStorage.getItem('chef_app_creds') || '{}');
  const role = (creds.cargo || '').toLowerCase();
  if (role === 'admin' || role === 'administrador' || role === 'gerente') {
    if (confirm('ATENÇÃO: Deseja desconectar este aparelho do Restaurante SaaS?')) {
      localStorage.removeItem('logged_user');
      localStorage.removeItem('chef_token');
      localStorage.removeItem('restaurante_id');
      localStorage.removeItem('chef_app_creds');
      localStorage.removeItem('chef_credentials');
      window.location.href = '/login.html';
    }
  } else {
    alert('Apenas gerentes e administradores podem desconectar o sistema.');
  }
};"""
    content = re.sub(fazer_logout_pattern, fazer_logout_replacement, content)
    
    # Show btn-desconectar-saas if admin
    admin_check_pattern = r"(const isAdmin = \['admin', 'administrador', 'gerente'\].includes\(\(creds\.cargo \|\| ''\)\.toLowerCase\(\)\);)"
    admin_check_replacement = """\\1
  if (isAdmin) {
    const btnSaas = document.getElementById('btn-desconectar-saas');
    if (btnSaas) btnSaas.style.display = 'flex';
  }"""
    if "btn-desconectar-saas" not in content:
        content = re.sub(admin_check_pattern, admin_check_replacement, content)

    with open('main.js', 'w', encoding='utf-8') as f:
        f.write(content)


def patch_index_html():
    with open('index.html', 'r', encoding='utf-8') as f:
        content = f.read()
    
    if "Desconectar Aparelho do SaaS" not in content:
        # Inject the new button after Encerrar Sessão
        encerrar_sessao_pattern = r"(<button onclick=\"window\.fazerLogout && window\.fazerLogout\(\)\"[^>]*>[\s\S]*?</button>)"
        btn_saas = """\\1
        <button id="btn-desconectar-saas" onclick="window.desconectarSaaS && window.desconectarSaaS()"
          style="display: none; width: 100%; padding: 12px; background: #fff0f0; border: 1px solid #f87171; border-radius: 10px; font-weight: 700; color: #b91c1c; cursor: pointer; align-items: center; justify-content: center; gap: 8px; font-size: 14px; transition: all 0.2s ease; margin-top: 5px;">
          <i class="ph ph-warning-circle" style="font-size: 18px;"></i> Desconectar Aparelho do SaaS
        </button>"""
        content = re.sub(encerrar_sessao_pattern, btn_saas, content)

    with open('index.html', 'w', encoding='utf-8') as f:
        f.write(content)

def patch_other_js(filename):
    with open(filename, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # Revert btn-logout to operator logout
    if "document.getElementById('btn-logout').onclick =" in content:
        content = re.sub(
            r"document\.getElementById\('btn-logout'\)\.onclick = \(\) => \{[\s\S]*?window\.location\.href = '/login\.html';[\s\S]*?\};",
            """document.getElementById('btn-logout').onclick = () => {
    localStorage.removeItem('chef_credentials');
    localStorage.removeItem('logged_user');
    window.location.href = '/ativacao.html';
  };""",
            content
        )

    with open(filename, 'w', encoding='utf-8') as f:
        f.write(content)

patch_main_js()
patch_index_html()
patch_other_js('garcom.js')
patch_other_js('painel-funcionario.js')
print("Patched operator vs saas logout successfully.")
