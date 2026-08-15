# =============================================================================
# build-hub.ps1 — Monta o pacote do HUB (hub-server/) com o Super Admin.
#
# Pré-requisito: `npm run build` já deve ter gerado o dist/ (frontend completo).
#
# Fluxo:
#   1. Ofusca o server.js COMPLETO (com /api/super/*) -> hub-server/server-hub.js
#   2. Copia o dist/ cheio (COM super-admin.html)     -> hub-server/dist
#   3. Copia runtime (license-manager, nfce-service, controllers, public)
#
# O pacote do HUB NÃO é stripado: é a única versão com Super Admin.
# =============================================================================
$ErrorActionPreference = 'Stop'
$root = $PSScriptRoot
$hub  = Join-Path $root 'hub-server'
$dist = Join-Path $root 'dist'

if (-not (Test-Path $dist)) { throw "dist/ nao encontrado. Rode 'npm run build' antes." }

Write-Host '=== [1/3] Ofuscando servidor completo (--hub) ==='
Push-Location $root
try { node obfuscate.js --hub } finally { Pop-Location }
if ($LASTEXITCODE -ne 0) { throw 'obfuscate.js --hub falhou.' }

Write-Host '=== [2/3] Copiando dist completo (com super admin) ==='
if (Test-Path (Join-Path $hub 'dist')) { Remove-Item -Recurse -Force (Join-Path $hub 'dist') }
Copy-Item -Recurse -Force $dist (Join-Path $hub 'dist')

Write-Host '=== [3/3] Copiando runtime ==='
foreach ($f in @('license-manager.js', 'nfce-service.js')) {
  if (Test-Path (Join-Path $root $f)) { Copy-Item -Force (Join-Path $root $f) $hub }
}
foreach ($d in @('controllers', 'public')) {
  $src = Join-Path $root $d
  if (Test-Path $src) {
    if (Test-Path (Join-Path $hub $d)) { Remove-Item -Recurse -Force (Join-Path $hub $d) }
    Copy-Item -Recurse -Force $src $hub
  }
}
if (Test-Path (Join-Path $root 'port.txt')) { Copy-Item -Force (Join-Path $root 'port.txt') $hub }

Write-Host ''
Write-Host 'Pacote HUB pronto em:' $hub
Write-Host '  - deploy Linux :' (Join-Path $hub 'install.sh') '(sudo bash install.sh)'
Write-Host '  - teste local  :' (Join-Path $hub 'start.sh')
Write-Host '  - Super Admin  : http://<ip>:3000/super-admin'
