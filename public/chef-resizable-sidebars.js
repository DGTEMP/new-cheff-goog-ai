/**
 * chef-resizable-sidebars.js
 * Gerenciamento de redimensionamento por arraste (Splitters) e modos Oculto / Mini / Expandido
 */
(function() {
  'use strict';

  const STORAGE_LEFT_WIDTH = 'chef_sidebar_left_width';
  const STORAGE_RIGHT_WIDTH = 'chef_sidebar_right_width';
  const STORAGE_LEFT_MODE = 'chef_sidebar_left_mode'; // 'expanded' | 'mini' | 'hidden'
  const STORAGE_RIGHT_MODE = 'chef_sidebar_right_mode';

  function injectSplitterStyles() {
    if (document.getElementById('chef-splitter-styles')) return;
    const st = document.createElement('style');
    st.id = 'chef-splitter-styles';
    st.textContent = `
      .chef-sidebar-splitter {
        width: 6px;
        min-width: 6px;
        cursor: col-resize;
        z-index: 50;
        background: rgba(0, 0, 0, 0.06);
        transition: background 0.15s ease;
        position: relative;
        flex-shrink: 0;
        user-select: none;
      }
      .chef-sidebar-splitter:hover, .chef-sidebar-splitter.dragging {
        background: #fc4b15 !important;
      }
      [data-theme="dark"] .chef-sidebar-splitter {
        background: rgba(255, 255, 255, 0.08);
      }
      .chef-resizing {
        user-select: none !important;
        cursor: col-resize !important;
      }
      .chef-resizing * {
        user-select: none !important;
      }
      .sidebar-ctrl-btn:hover {
        background: rgba(0, 0, 0, 0.08) !important;
      }
      [data-theme="dark"] .sidebar-ctrl-btn:hover {
        background: rgba(255, 255, 255, 0.12) !important;
      }
    `;
    document.head.appendChild(st);
  }

  function initResizableSidebars() {
    injectSplitterStyles();

    const leftPanel = document.querySelector('.left-actions, #left-panel');
    const rightPanel = document.querySelector('.right-info, #right-panel');
    const mainPanel = document.querySelector('.main-workspace, #main-panel');
    const workspace = document.querySelector('.workspace');

    if (!workspace || !leftPanel || !rightPanel) return;

    // Recuperar larguras salvas
    const savedLeftW = localStorage.getItem(STORAGE_LEFT_WIDTH) || '220';
    const savedRightW = localStorage.getItem(STORAGE_RIGHT_WIDTH) || '280';
    const savedLeftMode = localStorage.getItem(STORAGE_LEFT_MODE) || 'expanded';
    const savedRightMode = localStorage.getItem(STORAGE_RIGHT_MODE) || 'expanded';

    // 1. Injetar controles de topo na Barra Esquerda
    if (!leftPanel.querySelector('.sidebar-header-controls')) {
      const leftHeader = document.createElement('div');
      leftHeader.className = 'sidebar-header-controls';
      leftHeader.innerHTML = `
        <div style="display:flex; align-items:center; justify-content:space-between; width:100%; padding:4px 2px 8px; border-bottom:1px solid var(--border-subtle, rgba(0,0,0,0.08)); margin-bottom:8px;">
          <span style="font-size:12px; font-weight:800; text-transform:uppercase; letter-spacing:0.5px; opacity:0.8;">Ações Rápidas</span>
          <div style="display:flex; gap:4px;">
            <button type="button" class="sidebar-ctrl-btn" onclick="window.setSidebarMode('left', 'mini')" title="Modo Mini (Ícones)" style="background:none; border:none; cursor:pointer; padding:3px 6px; border-radius:6px; font-size:13px; color:inherit;">
              <i class="ph ph-sidebar-simple"></i>
            </button>
            <button type="button" class="sidebar-ctrl-btn" onclick="window.setSidebarMode('left', 'hidden')" title="Ocultar Barra" style="background:none; border:none; cursor:pointer; padding:3px 6px; border-radius:6px; font-size:13px; color:inherit;">
              <i class="ph ph-x"></i>
            </button>
          </div>
        </div>
      `;
      leftPanel.insertBefore(leftHeader, leftPanel.firstChild);
    }

    // 2. Injetar controles de topo na Barra Direita
    if (!rightPanel.querySelector('.sidebar-header-controls')) {
      const rightHeader = document.createElement('div');
      rightHeader.className = 'sidebar-header-controls';
      rightHeader.innerHTML = `
        <div style="display:flex; align-items:center; justify-content:space-between; width:100%; padding:4px 2px 8px; border-bottom:1px solid var(--border-subtle, rgba(0,0,0,0.08)); margin-bottom:8px;">
          <span style="font-size:12px; font-weight:800; text-transform:uppercase; letter-spacing:0.5px; opacity:0.8;">Resumo da Conta</span>
          <div style="display:flex; gap:4px;">
            <button type="button" class="sidebar-ctrl-btn" onclick="window.setSidebarMode('right', 'mini')" title="Modo Compacto" style="background:none; border:none; cursor:pointer; padding:3px 6px; border-radius:6px; font-size:13px; color:inherit;">
              <i class="ph ph-arrows-in-line-horizontal"></i>
            </button>
            <button type="button" class="sidebar-ctrl-btn" onclick="window.setSidebarMode('right', 'hidden')" title="Ocultar Resumo" style="background:none; border:none; cursor:pointer; padding:3px 6px; border-radius:6px; font-size:13px; color:inherit;">
              <i class="ph ph-x"></i>
            </button>
          </div>
        </div>
      `;
      rightPanel.insertBefore(rightHeader, rightPanel.firstChild);
    }

    // 3. Injetar Splitters de Arraste (Resize Handles)
    let leftSplitter = document.getElementById('chef-left-splitter') || document.getElementById('resizer-left');
    if (!leftSplitter) {
      leftSplitter = document.createElement('div');
      leftSplitter.id = 'chef-left-splitter';
      workspace.insertBefore(leftSplitter, mainPanel);
    }
    leftSplitter.className = 'chef-sidebar-splitter left-splitter';
    leftSplitter.title = 'Arraste para redimensionar a barra esquerda';

    let rightSplitter = document.getElementById('chef-right-splitter') || document.getElementById('resizer-right');
    if (!rightSplitter) {
      rightSplitter = document.createElement('div');
      rightSplitter.id = 'chef-right-splitter';
      workspace.insertBefore(rightSplitter, rightPanel);
    }
    rightSplitter.className = 'chef-sidebar-splitter right-splitter';
    rightSplitter.title = 'Arraste para redimensionar a barra direita';

    // 4. Lógica de Arraste do Splitter Esquerdo
    let isDraggingLeft = false;
    const startDragLeft = (e) => {
      isDraggingLeft = true;
      leftSplitter.classList.add('dragging');
      document.body.classList.add('chef-resizing');
      if (e.type === 'mousedown') e.preventDefault();
    };
    leftSplitter.addEventListener('mousedown', startDragLeft);
    leftSplitter.addEventListener('touchstart', startDragLeft, { passive: true });

    // 5. Lógica de Arraste do Splitter Direito
    let isDraggingRight = false;
    const startDragRight = (e) => {
      isDraggingRight = true;
      rightSplitter.classList.add('dragging');
      document.body.classList.add('chef-resizing');
      if (e.type === 'mousedown') e.preventDefault();
    };
    rightSplitter.addEventListener('mousedown', startDragRight);
    rightSplitter.addEventListener('touchstart', startDragRight, { passive: true });

    const handleMove = (clientX) => {
      if (isDraggingLeft) {
        const newW = Math.max(140, Math.min(clientX, 550));
        leftPanel.style.width = newW + 'px';
        leftPanel.style.minWidth = newW + 'px';
        leftPanel.style.maxWidth = newW + 'px';
        localStorage.setItem(STORAGE_LEFT_WIDTH, String(newW));
      }
      if (isDraggingRight) {
        const newW = Math.max(180, Math.min(window.innerWidth - clientX, 600));
        rightPanel.style.width = newW + 'px';
        rightPanel.style.minWidth = newW + 'px';
        rightPanel.style.maxWidth = newW + 'px';
        localStorage.setItem(STORAGE_RIGHT_WIDTH, String(newW));
      }
    };

    document.addEventListener('mousemove', (e) => {
      if (isDraggingLeft || isDraggingRight) handleMove(e.clientX);
    });

    document.addEventListener('touchmove', (e) => {
      if ((isDraggingLeft || isDraggingRight) && e.touches.length === 1) {
        handleMove(e.touches[0].clientX);
      }
    }, { passive: true });

    const stopDrag = () => {
      if (isDraggingLeft || isDraggingRight) {
        isDraggingLeft = false;
        isDraggingRight = false;
        leftSplitter.classList.remove('dragging');
        rightSplitter.classList.remove('dragging');
        document.body.classList.remove('chef-resizing');
      }
    };

    document.addEventListener('mouseup', stopDrag);
    document.addEventListener('touchend', stopDrag);

    // Aplicar estados salvos
    window.setSidebarMode('left', savedLeftMode, false);
    window.setSidebarMode('right', savedRightMode, false);
  }

  // Função Global para Alternar Modos
  window.setSidebarMode = function(side, mode, persist = true) {
    const panel = (side === 'left') ? document.querySelector('.left-actions, #left-panel') : document.querySelector('.right-info, #right-panel');
    const splitter = (side === 'left') ? (document.getElementById('chef-left-splitter') || document.getElementById('resizer-left')) : (document.getElementById('chef-right-splitter') || document.getElementById('resizer-right'));
    if (!panel) return;

    panel.classList.remove('sidebar-expanded', 'sidebar-mini', 'sidebar-hidden');
    if (mode === 'hidden') {
      panel.classList.add('sidebar-hidden');
      panel.style.display = 'none';
      if (splitter) splitter.style.display = 'none';
    } else if (mode === 'mini') {
      panel.classList.add('sidebar-mini');
      panel.style.display = 'flex';
      const miniW = (side === 'left') ? '68px' : '190px';
      panel.style.width = miniW;
      panel.style.minWidth = miniW;
      panel.style.maxWidth = miniW;
      if (splitter) splitter.style.display = 'block';
    } else {
      panel.classList.add('sidebar-expanded');
      panel.style.display = 'flex';
      const defaultW = (side === 'left') ? (localStorage.getItem(STORAGE_LEFT_WIDTH) || '220') : (localStorage.getItem(STORAGE_RIGHT_WIDTH) || '280');
      panel.style.width = defaultW + 'px';
      panel.style.minWidth = defaultW + 'px';
      panel.style.maxWidth = defaultW + 'px';
      if (splitter) splitter.style.display = 'block';
    }

    if (persist) {
      localStorage.setItem(side === 'left' ? STORAGE_LEFT_MODE : STORAGE_RIGHT_MODE, mode);
    }
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initResizableSidebars);
  } else {
    initResizableSidebars();
  }
})();
