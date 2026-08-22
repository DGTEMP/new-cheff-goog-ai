const { spawn } = require('child_process');
const net = require('net');
const path = require('path');

const PORT = process.env.PORT || 3114;
let restartCount = 0;
let isShuttingDown = false;
let currentChild = null;

// Função para checar e encerrar processo que porventura esteja segurando a porta
function killPortOwner(port) {
  return new Promise((resolve) => {
    if (process.platform !== 'win32') {
      return resolve();
    }
    const cmd = `Get-Process -Id (Get-NetTCPConnection -LocalPort ${port} -ErrorAction SilentlyContinue).OwningProcess -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue`;
    const ps = spawn('powershell', ['-NoProfile', '-Command', cmd], { windowsHide: true });
    ps.on('close', () => setTimeout(resolve, 1000));
  });
}

async function startServer() {
  if (isShuttingDown) return;

  await killPortOwner(PORT);

  restartCount++;
  console.log(`\n==================================================`);
  console.log(`🚀 [Auto-Restart Manager] Iniciando sistema (Tentativa #${restartCount})`);
  console.log(`⏰ [Horário]: ${new Date().toLocaleTimeString()}`);
  console.log(`==================================================\n`);

  // Executa backend Node e servidor Vite em paralelo com autorestart
  currentChild = spawn(process.execPath, ['server.js'], { stdio: 'inherit', cwd: __dirname });
  const viteCmd = process.platform === 'win32' ? 'npx.cmd' : 'npx';
  const viteChild = spawn(viteCmd, ['vite', '--host'], { stdio: 'inherit', cwd: __dirname, shell: true });

  viteChild.on('exit', () => {
    if (!isShuttingDown && currentChild) currentChild.kill();
  });

  currentChild.on('exit', async (code, signal) => {
    if (isShuttingDown) {
      console.log('🛑 [Auto-Restart Manager] Encerrado pelo usuário.');
      process.exit(0);
    }

    console.warn(`\n⚠️ [Auto-Restart Manager] Sistema caiu ou foi encerrado! (Código: ${code}, Sinal: ${signal})`);
    console.log(`🔄 Reiniciando automaticamente em 3 segundos...\n`);

    setTimeout(() => {
      startServer();
    }, 3000);
  });
}

// Captura interrupções do usuário (Ctrl+C)
['SIGINT', 'SIGTERM', 'SIGQUIT'].forEach(sig => {
  process.on(sig, () => {
    isShuttingDown = true;
    console.log('\n🛑 [Auto-Restart Manager] Encerrando processos com segurança...');
    if (currentChild) {
      currentChild.kill('SIGINT');
    }
    setTimeout(() => process.exit(0), 1500);
  });
});

startServer();
