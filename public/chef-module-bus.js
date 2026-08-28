/**
 * chef-module-bus.js — Universal Plug-and-Play Module Bus for Chef Cozinha Frontend
 * 
 * Allows modules to dynamically inject:
 * - Widgets into the Modular Cashier (Caixa v1.1)
 * - Navigation buttons into topbar/sidebars
 * - Settings panels into configuracoes.html
 * - Event listeners for decoupled system events
 * 
 * If a module is removed or disabled, no code breaks.
 */

(function (window) {
  'use strict';

  const _modules = new Map();
  const _widgets = new Map();
  const _navbarActions = new Map();
  const _settingsSections = new Map();
  const _eventListeners = new Map();
  const _widgetMounts = new Map();

  const ChefModules = {
    version: '1.1.0',

    /**
     * Register a new module
     * @param {Object} manifest - Module metadata from module.json
     * @param {Function} setupFn - Callback receiving { registerWidget, registerNavbarAction, registerSettingsSection, on, emit }
     */
    register(manifest, setupFn) {
      if (!manifest || !manifest.id) {
        console.warn('[ChefModules] Module registration failed: missing manifest or id.');
        return;
      }

      const id = manifest.id;
      _modules.set(id, {
        ...manifest,
        registeredAt: Date.now()
      });

      console.log(`[ChefModules] 🚀 Módulo "${manifest.name || id}" (v${manifest.version || '1.0.0'}) registrado com sucesso!`);

      if (typeof setupFn === 'function') {
        try {
          setupFn({
            registerWidget: (w) => ChefModules.registerWidget(id, w),
            registerNavbarAction: (a) => ChefModules.registerNavbarAction(id, a),
            registerSettingsSection: (s) => ChefModules.registerSettingsSection(id, s),
            on: (event, cb) => ChefModules.on(event, cb),
            emit: (event, data) => ChefModules.emit(event, data),
            manifest: manifest
          });
        } catch (err) {
          console.error(`[ChefModules] Erro ao inicializar setup do módulo "${id}":`, err);
        }
      }

      // Notify bus that a new module was registered
      ChefModules.emit('module_registered', { id, manifest });
    },

    /**
     * Register a widget for the Caixa v1.1 Modular Grid
     * @param {string} moduleId 
     * @param {Object} widget { id, title, icon, defaultSize, render(container), onMount, onUnmount }
     */
    registerWidget(moduleId, widget) {
      if (!widget || !widget.id) return;
      const fullId = `${moduleId}:${widget.id}`;
      _widgets.set(fullId, {
        ...widget,
        fullId,
        moduleId,
        defaultSize: widget.defaultSize || 'sz-m' // sz-s, sz-m, sz-l
      });

      console.log(`[ChefModules] 📦 Widget registrado: [${fullId}] "${widget.title}"`);
      ChefModules.emit('widget_registered', { fullId, widget });
    },

    /**
     * Register an action button for the Top Menubar or Sidebar
     */
    registerNavbarAction(moduleId, action) {
      if (!action || !action.id) return;
      const fullId = `${moduleId}:${action.id}`;
      _navbarActions.set(fullId, { ...action, fullId, moduleId });
      ChefModules.emit('navbar_action_registered', { fullId, action });
    },

    /**
     * Register a settings tab / panel
     */
    registerSettingsSection(moduleId, section) {
      if (!section || !section.id) return;
      const fullId = `${moduleId}:${section.id}`;
      _settingsSections.set(fullId, { ...section, fullId, moduleId });
      ChefModules.emit('settings_section_registered', { fullId, section });
    },

    /**
     * Decoupled Event Bus Listeners
     */
    on(event, callback) {
      if (!_eventListeners.has(event)) {
        _eventListeners.set(event, new Set());
      }
      _eventListeners.get(event).add(callback);
      return () => _eventListeners.get(event)?.delete(callback);
    },

    /**
     * Decoupled Event Bus Emitter
     */
    emit(event, data) {
      if (_eventListeners.has(event)) {
        _eventListeners.get(event).forEach(cb => {
          try {
            cb(data);
          } catch (err) {
            console.error(`[ChefModules] Erro no listener do evento "${event}":`, err);
          }
        });
      }
    },

    /**
     * Get all registered widgets
     */
    getWidgets() {
      return Array.from(_widgets.values());
    },

    /**
     * Get all registered modules
     */
    getModules() {
      return Array.from(_modules.values());
    },

    /**
     * Auto-loader: Discovers active modules from backend and dynamically loads their client assets
     */
    async initAutoLoader(targetContext = 'all') {
      try {
        const token = localStorage.getItem('chef_token') || '';
        const res = await fetch('/api/modules/active', {
          headers: token ? { 'Authorization': `Bearer ${token}` } : {}
        });

        if (!res.ok) return;
        const data = await res.json();
        if (!data || !Array.isArray(data.modules)) return;

        console.log(`[ChefModules] Carregando ${data.modules.length} módulos ativos para o contexto "${targetContext}"...`);

        for (const mod of data.modules) {
          // Check targets filter
          if (targetContext !== 'all' && mod.targets && Array.isArray(mod.targets) && !mod.targets.includes(targetContext) && !mod.targets.includes('all')) {
            continue;
          }

          // Load CSS if provided
          if (mod.hooks?.style) {
            const link = document.createElement('link');
            link.rel = 'stylesheet';
            link.href = `/plugins/${mod.dirName}/${mod.hooks.style}`;
            document.head.appendChild(link);
          }

          // Load Client Script if provided
          if (mod.hooks?.client) {
            await this._loadScript(`/plugins/${mod.dirName}/${mod.hooks.client}`);
          }

          // Load Widget Script if provided (specifically for caixa_v11)
          if (mod.hooks?.widget && (targetContext === 'caixa_v11' || targetContext === 'all')) {
            await this._loadScript(`/plugins/${mod.dirName}/${mod.hooks.widget}`);
          }
        }
      } catch (err) {
        console.warn('[ChefModules] Auto-loader em modo offline ou inicial:', err);
      }
    },

    _loadScript(src) {
      return new Promise((resolve) => {
        const script = document.createElement('script');
        script.src = src;
        script.async = true;
        script.onload = () => resolve(true);
        script.onerror = (err) => {
          console.warn(`[ChefModules] Falha ao carregar script do módulo: ${src}`, err);
          resolve(false); // Do not reject so other modules continue loading smoothly
        };
        document.body.appendChild(script);
      });
    }
  };

  window.ChefModules = ChefModules;

})(window);


  /**
   * Exibe aviso amigável de manutenção ao tentar acessar módulo inativo ou em manutenção
   */
  window.exibirAvisoModuloManutencao = function (nomeModulo) {
    const modalId = 'modal-modulo-manutencao';
    let el = document.getElementById(modalId);
    if (!el) {
      el = document.createElement('div');
      el.id = modalId;
      el.style.cssText = 'position:fixed; inset:0; background:rgba(0,0,0,0.85); backdrop-filter:blur(8px); z-index:999999; display:flex; align-items:center; justify-content:center; padding:20px;';
      document.body.appendChild(el);
    }
    el.innerHTML = `
      <div style="background:#0f172a; border:2px solid #fc4b15; border-radius:18px; max-width:460px; width:100%; padding:24px; color:#f8fafc; box-shadow:0 20px 50px rgba(0,0,0,0.8); text-align:center; animation:popIn 0.3s ease;">
        <div style="width:56px; height:56px; border-radius:16px; background:rgba(252,75,21,0.15); color:#fc4b15; display:flex; align-items:center; justify-content:center; font-size:28px; margin:0 auto 14px;">
          <i class="ph-bold ph-wrench"></i>
        </div>
        <h3 style="font-size:18px; font-weight:800; margin:0 0 8px; color:#f8fafc;">Ops! Estamos em Manutenção</h3>
        <p style="color:#cbd5e1; font-size:13.5px; line-height:1.6; margin:0 0 20px;">
          Tropecei nuns fios aqui, mas já estou conectando tudo de volta e já te aviso assim que funcionar! 🔌⚡
        </p>
        <button type="button" onclick="document.getElementById('${modalId}').style.display='none'" style="background:#fc4b15; color:white; border:none; padding:12px 24px; border-radius:10px; font-weight:700; font-size:13.5px; cursor:pointer; width:100%;">
          Entendido, aguardar!
        </button>
      </div>
    `;
    el.style.display = 'flex';
  };
