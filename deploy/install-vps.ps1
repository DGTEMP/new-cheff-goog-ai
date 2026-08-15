# =============================================================================
# Instalador VPS Ubuntu — Chef Cozinha
#
# O que ele faz:
#   1) Regenera o server-prod.js a partir do server.js (fixes mais recentes).
#   2) Atualiza a pasta ubuntu-server/ (que já contém install.sh + systemd).
#   3) Gera o pacote chefcozinha-ubuntu.tar.gz para enviar ao servidor.
#
# Depois, no servidor Ubuntu (apenas 3 comandos):
#   scp chefcozinha-ubuntu.tar.gz user@IP:~
#   ssh user@IP
#   sudo bash -c "mkdir -p /opt/chefcozinha && tar -xzf ~/chefcozinha-ubuntu.tar.gz -C /opt/chefcozinha --strip-components=1 && cd /opt/chefcozinha && bash install.sh"
#
# Uso:  powershell -ExecutionPolicy Bypass -File deploy\install-vps.ps1
# =============================================================================
$ErrorActionPreference = 'Stop'
$Root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
Set-Location $Root

Write-Host "=== Instalador VPS Ubuntu - Chef Cozinha ===" -ForegroundColor Cyan

# 1) Rebuild opcional do dist (frontend) — o server-prod.js serve a pasta dist
$re = Read-Host "Rebuild do frontend (npm run build)? [s/N]"
if ($re -match '^[sSyY]') {
    Write-Host "[1/4] Rodando npm run build..." -ForegroundColor Green
    npm run build
} else {
    Write-Host "[1/4] Mantendo o dist atual (desatualizado = frontend antigo no VPS)." -ForegroundColor Yellow
}

# 2) Regenera server-prod.js com os fixes do server.js
Write-Host "[2/4] Regenerando server-prod.js (node sync-prod.js)..." -ForegroundColor Green
node sync-prod.js
if ($LASTEXITCODE -ne 0) { throw "sync-prod.js falhou" }

# 3) Copia os arquivos do servidor para a pasta ubuntu-server/
Write-Host "[3/4] Atualizando pasta ubuntu-server/..." -ForegroundColor Green
foreach ($f in @('server-prod.js','license-manager.js','nfce-service.js','ifood-integration.js','package.json','port.txt')) {
    if (Test-Path $f) { Copy-Item -Path $f -Destination 'ubuntu-server\' -Force }
}

# 4) Empacota (tar.gz) — Windows 10/11 já tem tar.exe (bsdtar)
$out = Join-Path (Split-Path $Root -Parent) 'chefcozinha-ubuntu.tar.gz'
if (Test-Path $out) { Remove-Item $out -Force }
Write-Host "[4/4] Gerando $out ..." -ForegroundColor Green
tar -czf $out -C $Root ubuntu-server
if ($LASTEXITCODE -ne 0) { throw "tar falhou (use tar nativo do Windows 10+)" }

Write-Host ""
Write-Host "=== PASSO A PASSO NO VPS ===" -ForegroundColor Cyan
Write-Host "No Windows:"
Write-Host "  scp $out usuario@IP_DO_SERVIDOR:~/"
Write-Host ""
Write-Host "No servidor (ssh usuario@IP_DO_SERVIDOR):"
Write-Host "  sudo mkdir -p /opt/chefcozinha"
Write-Host "  sudo tar -xzf ~/chefcozinha-ubuntu.tar.gz -C /opt/chefcozinha --strip-components=1"
Write-Host "  sudo bash /opt/chefcozinha/install.sh"
Write-Host ""
Write-Host "O instalador cuida de: Node.js 20, dependencias nativas (sqlite3/bcrypt),"
Write-Host "certificado TLS, servico systemd (chefcozinha) e reinicia tudo."
Write-Host "Acesse:  http://IP_DO_SERVIDOR:3000"
Write-Host "Firewall:  sudo ufw allow 3000/tcp"
Write-Host ""
Read-Host "Pressione Enter para finalizar"
