import sys

fpath = r'c:\Users\computer\Desktop\chef cozinha\cardapio.html'
with open(fpath, 'r', encoding='utf-8') as f:
    text = f.read()

start_mark = '<link rel="apple-touch-icon" href="/icons/icon-192.svg">'
end_mark = '<div class="categories-container" id="categories-tabs">'

s_idx = text.find(start_mark)
e_idx = text.find(end_mark)

print('s_idx:', s_idx, 'e_idx:', e_idx)

replacement = """<link rel="apple-touch-icon" href="/icons/icon-192.svg">
</head>
<body>

  <header>
    <div class="header-info">
      <h1 id="restaurant-name-header">Chef Cozinha</h1>
      <p id="welcome-user-crm">Cardápio Digital</p>
    </div>
    <div style="display: flex; align-items: center; gap: 6px;">
      <button class="tour-toggle" id="btn-tour-toggle" onclick="window.toggleTour()" title="Tour Guiado">
        <i class="ph ph-compass"></i> Tour
      </button>
      <div id="btn-edit-profile-header" onclick="window.editarPerfilCrm()" style="cursor: pointer; display: none; align-items: center; justify-content: center; width: 34px; height: 34px; border-radius: 50%; background: #f1f5f9; color: #475569; font-size: 18px; border: 1px solid #cbd5e1;" title="Editar Perfil">
        <i class="ph ph-user"></i>
      </div>
      <div class="table-badge" id="mesa-badge">Mesa</div>
    </div>
  </header>

  <main id="main-menu-area">
    <!-- BANNER FILA DE ESPERA -->
    <div id="banner-fila-espera" style="display: none; background: linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%); border: 1.5px solid #f59e0b; border-radius: var(--radius-md); padding: 16px; margin-bottom: 16px; box-shadow: 0 4px 12px rgba(245, 158, 11, 0.15);">
      <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 10px;">
        <div>
          <h3 style="margin: 0; color: #92400e; font-size: 16px; display: flex; align-items: center; gap: 6px;">
            <i class="ph ph-hourglass-high" style="color: #d97706;"></i> <span id="text-fila-status-titulo">Você está na Fila de Espera</span>
          </h3>
          <p style="margin: 4px 0 0 0; font-size: 13px; color: #b45309;" id="text-fila-status-sub">Aguardando mesa... Peça porções e bebidas enquanto aguarda!</p>
        </div>
        <span style="background: #d97706; color: white; padding: 4px 10px; border-radius: 20px; font-weight: 800; font-size: 12px;" id="badge-fila-posicao">Posição: --</span>
      </div>

      <!-- BOTÃO GRANDE PARA CHAMAR GARÇOM NA FILA DE ESPERA -->
      <button id="btn-big-chamar-garcom-fila" onclick="window.chamarGarcomFilaGrande()" style="width: 100%; padding: 14px; background: linear-gradient(135deg, #d97706 0%, #b45309 100%); color: white; border: none; border-radius: 12px; font-weight: 800; font-size: 15px; cursor: pointer; display: flex; justify-content: center; align-items: center; gap: 8px; box-shadow: 0 4px 14px rgba(217, 119, 6, 0.35); transition: transform 0.2s;" onmouseover="this.style.transform='scale(1.02)'" onmouseout="this.style.transform='scale(1)'">
        <i class="ph ph-bell-ringing" style="font-size: 20px;"></i> 🔔 CHAMAR GARÇOM NA ESPERA
      </button>
    </div>

    <div class="search-container">
      <i class="ph ph-magnifying-glass"></i>
      <input type="text" class="search-input" id="search-input" placeholder="Buscar produtos no cardápio...">
    </div>

    <!-- Tour Banner -->
    <div class="tour-banner" id="tour-banner">
      <div class="tour-step" id="tour-step-label">Bem-vindo</div>
      <h2 id="tour-banner-title">Conheça Nossa História</h2>
      <p id="tour-banner-text">Explore o cardápio e descubra os sabores que preparamos com carinho para você.</p>
    </div>

    <div class="tour-progress" id="tour-progress">
      <div class="tour-progress-bar">
        <div class="tour-progress-fill" id="tour-progress-fill" style="width: 0%;"></div>
      </div>
      <span class="tour-progress-text" id="tour-progress-text">0%</span>
    </div>

"""

if s_idx != -1 and e_idx != -1:
    new_text = text[:s_idx] + replacement + text[e_idx:]
    with open(fpath, 'w', encoding='utf-8') as f:
        f.write(new_text)
    print("SUCCESS: Fixed cardapio.html HTML structure!")
else:
    print("ERROR: Indexes not found.")
