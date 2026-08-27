/**
 * create-module.js — Gerador de Módulos Plug-and-Play para o Chef Cozinha
 * 
 * Uso:
 *   node scripts/create-module.js <nome-do-modulo> [titulo] [icone] [categoria]
 * 
 * Exemplo:
 *   node scripts/create-module.js balanca "Balança Comercial" ph-scales hardware
 *   node scripts/create-module.js fidelidade "Clube de Fidelidade" ph-gift marketing
 */

'use strict';

const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);
if (args.length === 0) {
  console.log(`
Uso: node scripts/create-module.js <id-do-modulo> [Nome Visual] [Ícone Phosphor] [Categoria]

Exemplos:
  node scripts/create-module.js buffet "Controle de Buffet" ph-scales operacao
  node scripts/create-module.js cupons "Cupons de Desconto" ph-ticket-percent marketing
  node scripts/create-module.js whatsapp "Notificações WhatsApp" ph-whatsapp integracao
`);
  process.exit(1);
}

const rawId = args[0].toLowerCase().replace(/[^a-z0-9_-]/g, '-');
const moduleName = args[1] || rawId.replace(/[-_]/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
const moduleIcon = args[2] || 'ph-puzzle-piece';
const moduleCategory = args[3] || 'geral';

const targetDir = path.join(__dirname, '..', 'plugins', rawId);

if (fs.existsSync(targetDir)) {
  console.error(`❌ O módulo "plugins/${rawId}" já existe! Escolha outro nome.`);
  process.exit(1);
}

fs.mkdirSync(targetDir, { recursive: true });

// 1. module.json
const manifest = {
  id: rawId,
  name: moduleName,
  version: "1.0.0",
  author: "Chef Cozinha Dev Team",
  description: `Módulo plug-and-play de ${moduleName} para o ecossistema Chef Cozinha.`,
  category: moduleCategory,
  icon: moduleIcon,
  enabled: true,
  targets: ["caixa_v11", "pdv_classico", "configuracoes"],
  hooks: {
    server: "index.js",
    client: "client.js",
    widget: "widget.js",
    style: "style.css"
  }
};
fs.writeFileSync(path.join(targetDir, 'module.json'), JSON.stringify(manifest, null, 2), 'utf8');

// 2. index.js (Backend)
const serverCode = `/**
 * Backend do Módulo: ${moduleName} (${rawId})
 */
module.exports = function ({ app, db, masterDb, io, options, log }) {
  log('Inicializando backend do módulo ${moduleName}...');

  // Rota de exemplo (automaticamente protegida por moduloGuard)
  app.get('/api/modulo/${rawId}/status', (req, res) => {
    res.json({
      modulo: '${rawId}',
      nome: '${moduleName}',
      status: 'ativo',
      timestamp: Date.now()
    });
  });

  // Socket listener de exemplo
  io.on('connection', (socket) => {
    socket.on('modulo_${rawId}_ping', (data) => {
      socket.emit('modulo_${rawId}_pong', { status: 'ok', data });
    });
  });
};
`;
fs.writeFileSync(path.join(targetDir, 'index.js'), serverCode, 'utf8');

// 3. widget.js (Caixa v1.1 Modular Grid)
const widgetCode = `/**
 * Widget do Caixa v1.1: ${moduleName}
 */
(function () {
  if (!window.ChefModules) return;

  ChefModules.register({
    id: '${rawId}',
    name: '${moduleName}',
    icon: '${moduleIcon}'
  }, ({ registerWidget }) => {
    
    registerWidget({
      id: '${rawId}_widget',
      title: '${moduleName}',
      icon: '${moduleIcon}',
      defaultSize: 'sz-m', // sz-s (pequeno), sz-m (médio), sz-l (grande)
      render(container, { socket, authHeaders }) {
        container.innerHTML = \`
          <div style="padding: 12px; display: flex; flex-direction: column; gap: 8px; height: 100%;">
            <div style="display: flex; align-items: center; gap: 8px; color: var(--v11-accent, #fc4b15); font-weight: 700;">
              <i class="ph-bold ${moduleIcon}" style="font-size: 20px;"></i>
              <span>${moduleName} Ativo</span>
            </div>
            <p style="font-size: 12px; color: var(--v11-text-sub, #64748b); margin: 0;">
              Bloco modular plug-and-play carregado dinamicamente no Caixa v1.1.
            </p>
            <button class="v11-btn" style="margin-top: auto; padding: 8px 12px; border-radius: 8px; background: var(--v11-surface, #ffffff); border: 1px solid var(--v11-border, #cbd5e1); font-weight: 700; cursor: pointer;">
              <i class="ph ${moduleIcon}"></i> Acessar Módulo
            </button>
          </div>
        \`;
      }
    });

  });
})();
`;
fs.writeFileSync(path.join(targetDir, 'widget.js'), widgetCode, 'utf8');

// 4. client.js (Frontend Core)
const clientCode = `/**
 * Frontend Core: ${moduleName}
 */
(function () {
  if (!window.ChefModules) return;

  ChefModules.register({
    id: '${rawId}',
    name: '${moduleName}',
    icon: '${moduleIcon}'
  }, ({ registerNavbarAction, on }) => {
    
    // Injeta botão na barra de navegação superior se estiver no PDV
    registerNavbarAction({
      id: '${rawId}_nav_btn',
      label: '${moduleName}',
      icon: '${moduleIcon}',
      onClick() {
        console.log('[Módulo ${moduleName}] Ação disparada!');
      }
    });

    // Ouve eventos do barramento
    on('pedido_criado', (pedido) => {
      // Reagir a novos pedidos de forma desacoplada
    });

  });
})();
`;
fs.writeFileSync(path.join(targetDir, 'client.js'), clientCode, 'utf8');

// 5. style.css
const styleCode = `/* Estilos do Módulo ${moduleName} (${rawId}) */
.modulo-${rawId}-badge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 10px;
  border-radius: 12px;
  background: rgba(252, 75, 21, 0.1);
  color: #fc4b15;
  font-weight: 700;
  font-size: 12px;
}
`;
fs.writeFileSync(path.join(targetDir, 'style.css'), styleCode, 'utf8');

console.log(`
✅ Módulo "${moduleName}" criado com sucesso em:
   📂 plugins/${rawId}/

Arquivos gerados:
   📄 module.json  (Manifesto e pontos de injeção)
   📄 index.js     (Backend Express + Socket.io)
   📄 widget.js    (Bloco modular para o Caixa v1.1)
   📄 client.js    (Injeções no frontend do PDV)
   📄 style.css    (Folha de estilos isolada)

Para testar ou criar novos recursos, basta editar os arquivos na pasta plugins/${rawId}!
`);
