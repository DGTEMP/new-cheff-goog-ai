/**
 * plugin-client.js — Client-side plugin loader
 *
 * Convention:
 *   public/plugins/<plugin-name>/
 *     index.js       — required: window.ChefPlugin = function({ socket, options })
 *     styles.css     — optional: auto-injected
 *     manifest.json  — optional: { "name": "...", "description": "...", "order": 0, "pages": ["cardapio","caixa"] }
 *
 * Each plugin receives:
 *   socket   — Socket.IO client instance
 *   options  — { restaurante_id, mesaNome, currentPage, ... }
 *
 * Usage in main.js or HTML:
 *   <script src="/plugin-client.js"></script>
 *   <script>window.ChefPluginLoader.init(socket);</script>
 */

'use strict';

window.ChefPluginLoader = (function() {
  var _plugins = [];
  var _socket = null;
  var _options = {};
  var _initialized = false;

  /**
   * Load a single plugin by name (fetch manifest.json + index.js)
   */
  function loadPlugin(name) {
    return new Promise(function(resolve, reject) {
      var basePath = '/plugins/' + name;

      // Load manifest (optional)
      var manifest = { name: name, order: 999, pages: [] };
      fetch(basePath + '/manifest.json')
        .then(function(r) { return r.ok ? r.json() : {}; })
        .catch(function() { return {}; })
        .then(function(m) {
          manifest = Object.assign(manifest, m);

          // Inject CSS if exists
          var link = document.createElement('link');
          link.rel = 'stylesheet';
          link.href = basePath + '/styles.css';
          link.onerror = function() { link.remove(); };
          document.head.appendChild(link);

          // Load index.js
          var script = document.createElement('script');
          script.src = basePath + '/index.js';
          script.onload = function() {
            var pluginFn = window.ChefPlugin;
            if (typeof pluginFn === 'function') {
              _plugins.push({ name: name, fn: pluginFn, manifest: manifest });
              delete window.ChefPlugin;
              resolve({ name: name, manifest: manifest });
            } else {
              resolve({ name: name, manifest: manifest, skipped: true });
            }
          };
          script.onerror = function() {
            resolve({ name: name, skipped: true, error: 'Failed to load' });
          };
          document.body.appendChild(script);
        });
    });
  }

  /**
   * Discover available plugins by fetching a directory listing from the server
   * Falls back to a known list if directory listing is not available
   */
  function discoverPlugins() {
    return fetch('/api/plugins/list')
      .then(function(r) { return r.ok ? r.json() : { plugins: [] }; })
      .catch(function() { return { plugins: [] }; })
      .then(function(data) {
        return (data.plugins || []).map(function(p) {
          return typeof p === 'string' ? p : p.name;
        });
      });
  }

  /**
   * Initialize all plugins
   */
  function init(socket, options) {
    if (_initialized) return;
    _initialized = true;
    _socket = socket;
    _options = options || {};

    discoverPlugins().then(function(pluginNames) {
      if (!pluginNames.length) return;

      // Sort by manifest order (after loading)
      var promises = pluginNames.map(function(name) {
        return loadPlugin(name);
      });

      Promise.all(promises).then(function(results) {
        // Sort by order
        _plugins.sort(function(a, b) {
          return (a.manifest.order || 999) - (b.manifest.order || 999);
        });

        // Filter by current page if specified
        var currentPage = _options.currentPage || '';
        var toInit = _plugins.filter(function(p) {
          if (!p.manifest.pages || !p.manifest.pages.length) return true;
          return p.manifest.pages.indexOf(currentPage) !== -1;
        });

        // Initialize each plugin
        toInit.forEach(function(p) {
          try {
            p.fn({ socket: _socket, options: _options });
            console.log('[plugin-client] ✓ ' + p.name);
          } catch (err) {
            console.error('[plugin-client] ✗ ' + p.name + ':', err);
          }
        });

        console.log('[plugin-client] ' + toInit.length + '/' + pluginNames.length + ' plugins initialized');
      });
    });
  }

  /**
   * Get loaded plugins info
   */
  function getPlugins() {
    return _plugins.map(function(p) {
      return { name: p.name, manifest: p.manifest };
    });
  }

  return { init: init, getPlugins: getPlugins };
})();
