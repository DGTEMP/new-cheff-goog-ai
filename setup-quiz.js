const readline = require('readline');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const ANSI = {
  reset: "\x1b[0m",
  bright: "\x1b[1m",
  dim: "\x1b[2m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  cyan: "\x1b[36m",
  magenta: "\x1b[35m",
  red: "\x1b[31m",
  blue: "\x1b[34m",
  bgBlue: "\x1b[44m\x1b[37m",
  bgMagenta: "\x1b[45m\x1b[37m",
  bgCyan: "\x1b[46m\x1b[30m",
  bgGreen: "\x1b[42m\x1b[30m"
};

const envPath = path.join(__dirname, '.env');
const portTxtPath = path.join(__dirname, 'port.txt');

function getEnvConfig() {
  const config = {
    PORT: '3114',
    DEPLOY_MODE: 'cloud',
    APP_URL: 'https://appchef.up.railway.app',
    CORS_ORIGIN: '',
    JWT_SECRET: '',
    AUTO_START_INTEGRATIONS: 'true'
  };
  try {
    if (fs.existsSync(portTxtPath)) {
      config.PORT = fs.readFileSync(portTxtPath, 'utf8').trim() || '3114';
    }
  } catch (e) {}

  if (fs.existsSync(envPath)) {
    const lines = fs.readFileSync(envPath, 'utf8').split(/\r?\n/);
    lines.forEach(line => {
      const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
      if (m) {
        config[m[1]] = m[2].replace(/^["']|["']$/g, '');
      }
    });
  }
  return config;
}

function saveEnvConfig(newConfig) {
  try {
    if (newConfig.PORT) {
      fs.writeFileSync(portTxtPath, String(newConfig.PORT).trim(), 'utf8');
    }

    let envContent = fs.existsSync(envPath) ? fs.readFileSync(envPath, 'utf8') : `# CHEF COZINHA - SERVIDOR CONFIGURADO VIA SETUP INTERATIVO\n`;

    Object.keys(newConfig).forEach(key => {
      if (key === 'PORT') return;
      const regex = new RegExp(`^\\s*${key}\\s*=.*$`, 'm');
      if (regex.test(envContent)) {
        envContent = envContent.replace(regex, `${key}=${newConfig[key]}`);
      } else {
        envContent += `\n${key}=${newConfig[key]}`;
      }
    });

    fs.writeFileSync(envPath, envContent, 'utf8');
    console.log(`\n${ANSI.green}✅ Configurações salvas no arquivo .env e port.txt! Rotas configuradas para: ${newConfig.APP_URL || 'Local'}${ANSI.reset}\n`);
  } catch (e) {
    console.error(`${ANSI.red}❌ Erro ao salvar configurações: ${e.message}${ANSI.reset}`);
  }
}

function runInteractiveSetup() {
  console.clear();
  console.log(`
${ANSI.cyan}${ANSI.bright}  ┌──────────────────────────────────────────────────────────────────┐
  │                                                                  │
  │     ⚙️   CHEF COZINHA SaaS - SETUP & QUIZ DE CONFIGURAÇÃO        │
  │                                                                  │
  └──────────────────────────────────────────────────────────────────┘${ANSI.reset}
  ${ANSI.dim}Responda às perguntas abaixo para personalizar a URL pública e rotas do seu servidor.${ANSI.reset}
`);

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  const current = getEnvConfig();
  const questions = [
    {
      key: 'APP_URL',
      text: `1. Domínio/URL Pública da Aplicação (ex: https://appchef.up.railway.app ou https://pizzaria.com.br) [Atual: ${current.APP_URL || 'https://appchef.up.railway.app'}]: `,
      default: current.APP_URL || 'https://appchef.up.railway.app'
    },
    {
      key: 'PORT',
      text: `2. Qual porta HTTP o backend deve utilizar? [Atual: ${current.PORT}]: `,
      default: current.PORT
    },
    {
      key: 'DEPLOY_MODE',
      text: `3. Modo de Operação [cloud / on-premise] (cloud = SaaS Nuvem Multi-Tenant, on-premise = Local) [Atual: ${current.DEPLOY_MODE}]: `,
      default: current.DEPLOY_MODE
    },
    {
      key: 'CORS_ORIGIN',
      text: `4. Origem CORS Autorizada (Deixe em branco para aceitar a URL da aplicação e locais) [Atual: ${current.CORS_ORIGIN || '*'}] : `,
      default: current.CORS_ORIGIN || ''
    }
  ];

  const answers = {};
  let qIdx = 0;

  function askNext() {
    if (qIdx >= questions.length) {
      rl.close();
      saveEnvConfig(answers);
      startServices();
      return;
    }

    const q = questions[qIdx];
    rl.question(`${ANSI.yellow}${q.text}${ANSI.reset}`, (ans) => {
      let val = ans.trim() || q.default;
      if (q.key === 'APP_URL' && val && !/^https?:\/\//i.test(val)) {
        val = 'https://' + val;
      }
      answers[q.key] = val;
      qIdx++;
      askNext();
    });
  }

  askNext();
}

function startServices() {
  console.log(`${ANSI.bright}${ANSI.green}🚀 Iniciando Servidor Backend e Servidor Frontend Vite...${ANSI.reset}\n`);
  const child = spawn('npx', ['concurrently', '"node server.js"', '"vite --host"'], {
    stdio: 'inherit',
    shell: true
  });

  child.on('exit', (code) => {
    process.exit(code || 0);
  });
}

function main() {
  const options = [
    { label: "🚀 Iniciar Servidor Diretamente (Modo Rápido)", action: startServices },
    { label: "⚙️  Configurar Servidor & Domínio (Setup Guiado / Quiz Interativo)", action: runInteractiveSetup },
    { label: "❌ Sair", action: () => { console.log("Encerrado pelo usuário."); process.exit(0); } }
  ];

  let selectedIndex = 0;
  let countdown = 5;
  let timer = null;

  function renderMenu() {
    console.clear();
    console.log(`
${ANSI.cyan}${ANSI.bright}  ╔════════════════════════════════════════════════════════════════════╗
  ║                                                                    ║
  ║         ⚡ CHEF COZINHA HIGH PERFORMANCE SaaS - STACK BOOT         ║
  ║                                                                    ║
  ╚════════════════════════════════════════════════════════════════════╝${ANSI.reset}

  ${ANSI.bright}Escolha como deseja iniciar o sistema usando as setas [↑ / ↓] e [ENTER]:${ANSI.reset}\n`);

    options.forEach((opt, idx) => {
      if (idx === selectedIndex) {
        console.log(`  ${ANSI.bgCyan}${ANSI.bright} ➔ ${idx + 1}. ${opt.label} ${ANSI.reset}`);
      } else {
        console.log(`     ${ANSI.dim}${idx + 1}. ${opt.label}${ANSI.reset}`);
      }
    });

    console.log(`\n  ${ANSI.yellow}⏱️  Iniciando automaticamente o modo selecionado em ${countdown}s... (Pressione uma tecla para pausar)${ANSI.reset}\n`);
  }

  readline.emitKeypressEvents(process.stdin);
  if (process.stdin.isTTY) {
    process.stdin.setRawMode(true);
  }

  renderMenu();

  timer = setInterval(() => {
    countdown--;
    if (countdown <= 0) {
      clearInterval(timer);
      cleanupAndRun(options[selectedIndex].action);
    } else {
      renderMenu();
    }
  }, 1000);

  function cleanupAndRun(action) {
    clearInterval(timer);
    if (process.stdin.isTTY) {
      process.stdin.setRawMode(false);
    }
    process.stdin.removeAllListeners('keypress');
    action();
  }

  process.stdin.on('keypress', (str, key) => {
    if (timer) {
      clearInterval(timer);
      timer = null;
    }

    if (key.name === 'up') {
      selectedIndex = (selectedIndex - 1 + options.length) % options.length;
      renderMenu();
    } else if (key.name === 'down') {
      selectedIndex = (selectedIndex + 1) % options.length;
      renderMenu();
    } else if (key.name === 'return' || key.name === 'enter') {
      cleanupAndRun(options[selectedIndex].action);
    } else if (str === '1' || str === '2' || str === '3') {
      const idx = parseInt(str, 10) - 1;
      if (idx >= 0 && idx < options.length) {
        selectedIndex = idx;
        cleanupAndRun(options[selectedIndex].action);
      }
    } else if (key.ctrl && key.name === 'c') {
      process.exit(0);
    }
  });
}

main();
