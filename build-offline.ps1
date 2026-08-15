# =============================================================================
# build-offline.ps1 — Gera o pacote OFFLINE do Chef Cozinha (linux-x64)
#
# Saída:   chefcozinha-offline.tar.gz  (na raiz do projeto)
#
# O pacote inclui tudo sem depender de internet na instalação:
#   - server-prod.js (ofuscado), controllers/, public/, dist/
#   - node_modules com sqlite3/bcrypt pré-compilados para linux-x64 (Node 20)
#   - Node.js 20 LTS embutido
#   - cert.pfx (TLS auto-assinado, senha chefcozinha)
#   - install.sh / chefcozinha.service / start.sh (LF, para bash/systemd)
#
# Requer (apenas na MÁQUINA DE BUILD): npm, node, openssl e conexão com a
# internet (para baixar Node.js e o binário nativo do sqlite3 do GitHub).
# =============================================================================
$ErrorActionPreference = 'Stop'

$ROOT = Split-Path -Parent $MyInvocation.MyCommand.Path
$TMP = Join-Path $env:TEMP 'opencode\chef-offline'
$STAGE = Join-Path $TMP 'stage'
$PKG = Join-Path $TMP 'package'
$NODE_VERSION = 'v20.20.2'

function Test-Deps {
  if (-not (Get-Command node -ErrorAction SilentlyContinue)) { throw 'node não encontrado no PATH' }
  if (-not (Get-Command npm -ErrorAction SilentlyContinue)) { throw 'npm não encontrado no PATH' }
  $os = @("C:\Program Files\Git\usr\bin\openssl.exe", "C:\Program Files\Git\mingw64\bin\openssl.exe") | Where-Object { Test-Path $_ } | Select-Object -First 1
  if (-not $os) { throw 'openssl não encontrado (instale Git for Windows ou adicione openssl ao PATH)' }
  return $os
}

function New-EmptyDir($p) {
  if (Test-Path $p) { Remove-Item -Recurse -Force $p }
  New-Item -ItemType Directory -Path $p -Force | Out-Null
}

Write-Host '=== build-offline: empacotando Chef Cozinha (linux-x64, offline) ==='
$openssl = Test-Deps

# 1. Frontend + servidor (mesmo pipeline do build:pkg)
Write-Host '[1/6] npm run build (dist)...'
Push-Location $ROOT
npm run build
Write-Host '[2/6] sync-prod + obfuscate...'
node sync-prod.js
node obfuscate.js
Pop-Location

# 2. node_modules para linux-x64 (sem rodar scripts do host)
Write-Host '[3/6] npm install linux-x64 (ignore-scripts)...'
New-EmptyDir $STAGE
Copy-Item -Force (Join-Path $ROOT 'package.json') $STAGE
Copy-Item -Force (Join-Path $ROOT 'package-lock.json') $STAGE
Push-Location $STAGE
npm install --omit=dev --os=linux --cpu=x64 --ignore-scripts --no-audit --no-fund
Pop-Location

# 3. Binário nativo do sqlite3 (NAPI) para linux-x64
$sqVer = node -e "console.log(require('$($ROOT -replace '\\','/')/node_modules/sqlite3/package.json').version)"
$sqNapi = node -e "const v=require('$($ROOT -replace '\\','/')/node_modules/sqlite3/package.json').binary.napi_versions; console.log('napi-v'+Math.max(...v))"
$sqUrl = "https://github.com/TryGhost/node-sqlite3/releases/download/v$sqVer/sqlite3-v$sqVer-$sqNapi-linux-x64.tar.gz"
Write-Host "[4/6] Baixando binário sqlite3 ($sqUrl)..."
$sqTar = Join-Path $TMP 'sqlite3-linux.tar.gz'
Invoke-WebRequest -Uri $sqUrl -OutFile $sqTar -TimeoutSec 180
$sqBuild = Join-Path $STAGE "node_modules\sqlite3\build\Release"
New-Item -ItemType Directory -Force -Path $sqBuild | Out-Null
tar -xzf $sqTar -C (Join-Path $STAGE 'node_modules\sqlite3') --strip-components=0

# 4. Node.js linux-x64 embutido
$nodeTar = Join-Path $TMP "node-$NODE_VERSION.tar.xz"
if (-not (Test-Path $nodeTar)) {
  Write-Host "[5/6] Baixando Node.js $NODE_VERSION linux-x64..."
  Invoke-WebRequest -Uri "https://nodejs.org/dist/$NODE_VERSION/node-$NODE_VERSION-linux-x64.tar.xz" -OutFile $nodeTar -TimeoutSec 300
} else {
  Write-Host "[5/6] Node.js já baixado (cache)"
}

# 5. Montar pacote
Write-Host '[6/6] Montando pacote + tarball...'
New-EmptyDir $PKG
foreach ($f in @('server-prod.js','license-manager.js','nfce-service.js','ifood-integration.js','package.json')) {
  Copy-Item -Force (Join-Path $ROOT $f) $PKG
}
if (Test-Path (Join-Path $ROOT 'port.txt')) { Copy-Item -Force (Join-Path $ROOT 'port.txt') $PKG }
Copy-Item -Recurse -Force (Join-Path $ROOT 'controllers') $PKG
Copy-Item -Recurse -Force (Join-Path $ROOT 'public') $PKG
Copy-Item -Recurse -Force (Join-Path $ROOT 'dist') $PKG
Copy-Item -Recurse -Force (Join-Path $STAGE 'node_modules') $PKG
New-EmptyDir (Join-Path $PKG 'node')
tar -xf $nodeTar -C (Join-Path $PKG 'node') --strip-components=1

# cert.pfx (mesmo modelo do install.sh: CN=ChefCozinha, SAN localhost, senha chefcozinha)
$key = Join-Path $TMP 'chef_key.pem'
$crt = Join-Path $TMP 'chef_cert.pem'
$pkgCert = Join-Path $PKG 'cert.pfx'
if (-not (Test-Path $pkgCert)) {
  & cmd /c "`"$openssl`" req -x509 -newkey rsa:2048 -keyout `"$key`" -out `"$crt`" -days 3650 -nodes -subj `/CN=ChefCozinha` -addext `subjectAltName=DNS:localhost,IP:127.0.0.1` 2>nul"
  & cmd /c "`"$openssl`" pkcs12 -export -out `"$pkgCert`" -inkey `"$key`" -in `"$crt`" -passout pass:chefcozinha 2>nul"
  Remove-Item $key,$crt -Force -ErrorAction SilentlyContinue
}

# scripts com LF (bash/systemd exigem LF)
foreach ($f in @('install.sh','chefcozinha.service','start.sh')) {
  $srcFile = Join-Path $ROOT "offline\$f"
  if (-not (Test-Path $srcFile)) { throw "Arquivo faltando (origem offline\): $f" }
  Copy-Item -Force $srcFile (Join-Path $PKG $f)
  $path = Join-Path $PKG $f
  if (-not (Test-Path $path)) { throw "Arquivo faltando: $f" }
  $s = [System.IO.File]::ReadAllText($path)
  $s = $s -replace "`r`n", "`n"
  [System.IO.File]::WriteAllText($path, $s)
}

# tarball final
$out = Join-Path $ROOT 'chefcozinha-offline.tar.gz'
Remove-Item $out -Force -ErrorAction SilentlyContinue
tar -czf $out -C $PKG .
$size = [Math]::Round((Get-Item $out).Length / 1MB, 1)
Write-Host "OK: $out ($size MB)"
