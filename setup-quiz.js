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
  bgGreen: "\x1b[42m\x1b[30m"
};

const envPath = path.join(__dirname, '.env');
const portTxtPath = path.join(__dirname, 'port.txt');

// Utilitário para ler arquivo .env como objeto
function getEnvConfig() {
  const config = {
    PORT: '3114',
    DEPLOY_MODE: 'cloud',
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

// Salvar novos valores no .env e port.txt
function saveEnvConfig(newConfig) {
  try {
    if (newConfig.PORT) {
      fs.writeFileSync(portTxtPath, newConfig.PORT.trim(), 'utf8');
    }

    let envContent = '';
    if (fs.existsSync(envPath)) {
      envContent = fs.readFileSync(envPath, 'utf8');
    } else {
      envContent = `# CHEF COZINHA - SERVIDOR CONFIGURADO VIA SETUP INTERATIVO\n`;
    }

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
    console.log(`\n${ANSI.green}✅ Configurações salvas com sucesso no arquivo .env e port.txt!${ANSI.reset}\n`);
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
  ${ANSI.dim}Responda às perguntas abaixo para personalizar seu servidor local ou nuvem.${ANSI.reset}
`);

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  const current = getEnvConfig();
  const questions = [
    {
      key: 'PORT',
      text: `1. Qual porta HTTP o backend deve utilizar? [Atual: ${current.PORT}]: `,
      default: current.PORT
    },
    {
      key: 'DEPLOY_MODE',
      text: `2. Modo de Operação [cloud / on-premise] (cloud = Multi-Tenant Cloud, on-premise = Local com Sync) [Atual: ${current.DEPLOY_MODE}]: `,
      default: current.DEPLOY_MODE
    },
    {
      key: 'CORS_ORIGIN',
      text: `3. Domínio CORS Autorizado (Deixe em branco para permitir todos) [Atual: ${current.CORS_ORIGIN || '*'}] : `,
      default: current.CORS_ORIGIN || ''
    },
    {
      key: 'AUTO_START_INTEGRATIONS',
      text: `4. Ativar Integrações Externas (iFood, NF-e) On-Demand? [true / false] [Atual: ${current.AUTO_START_INTEGRATIONS || 'true'}]: `,
      default: current.AUTO_START_INTEGRATIONS || 'true'
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
      const val = ans.trim() || q.default;
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
  console.clear();
  console.log(`
${ANSI.cyan}${ANSI.bright}  ╔════════════════════════════════════════════════════════════════════╗
  ║                                                                    ║
  ║         ⚡ CHEF COZINHA HIGH PERFORMANCE SaaS - STACK BOOT         ║
  ║                                                                    ║
  ╚════════════════════════════════════════════════════════════════════╝${ANSI.reset}

  ${ANSI.bright}Escolha como deseja iniciar o sistema:${ANSI.reset}

  ${ANSI.green} [1] 🚀 Iniciar Servidor Diretamente (Modo Rápido)${ANSI.reset}
  ${ANSI.yellow} [2] ⚙️  Configurar Servidor Manualmente (Setup Guiado / Quiz Interativo)${ANSI.reset}
  ${ANSI.red} [3] ❌ Sair${ANSI.reset}
`);

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  rl.question(`${ANSI.cyan}${ANSI.bright}👉 Digite sua opção [1, 2 ou 3] (Padrão: 1 em 5 segs): ${ANSI.reset}`, (choice) => {
    rl.close();
    const cleanChoice = choice.trim();
    if (cleanChoice === '2') {
      runInteractiveSetup();
    } else if (cleanChoice === '3') {
      console.log('Encerrado pelo usuário.');
      process.exit(0);
    } else {
      startServices();
    }
  });

  // Timeout automático de 5 segundos se o usuário apenas der Enter ou não responder rápido
  setTimeout(() => {
    try {
      rl.close();
    } catch (e) {}
  }, 5000);
}

main();
