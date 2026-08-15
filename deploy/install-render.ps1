# =============================================================================
# Instalador Render — Chef Cozinha
#
# O que ele faz:
#   1) Verifica que server.js respeita process.env.PORT (obrigatório no Render).
#   2) Gera o render.yaml na raiz do repositório (Blueprint p/ deploy 1-clique).
#   3) Monta o "pacote" mínimo (opcional) e mostra o passo a passo.
#
# Uso:  powershell -ExecutionPolicy Bypass -File deploy\install-render.ps1
# =============================================================================
$ErrorActionPreference = 'Stop'
$Root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
Set-Location $Root

Write-Host "=== Instalador Render - Chef Cozinha ===" -ForegroundColor Cyan

# 1) Porta = process.env.PORT (Render/Railway/Fly injetam PORT)
if (Select-String -Path 'server.js' -Pattern 'process\.env\.PORT' -Quiet) {
    Write-Host "[OK] server.js ja respeita process.env.PORT" -ForegroundColor Green
} else {
    Write-Host "[ATENCAO] server.js ainda usa so port.txt/3000." -ForegroundColor Yellow
    Write-Host "  O Render injeta a porta pela variavel PORT - sem isso o servidor nao responde."
    Write-Host "  Ajuste:  let PORT = parseInt(process.env.PORT, 10) || 3000;"
    Read-Host "  Corrija manualmente e pressione Enter para continuar"
}

# 2) render.yaml na raiz (Blueprint)
$bp = @'
services:
  - type: web
    name: chef-cozinha
    runtime: node
    plan: free
    buildCommand: npm install --omit=dev
    startCommand: node server.js
    autoDeploy: true
    envVars:
      - key: NODE_ENV
        value: production
      - key: JWT_SECRET
        generateValue: true
      - key: CORS_ORIGIN
        sync: false
        value: ""
'@
Set-Content -Path 'render.yaml' -Value $bp -Encoding utf8
Write-Host "[OK] render.yaml gerado na raiz do repositorio" -ForegroundColor Green

# 3) Pacote opcional (sem node_modules/backups/dist)
$zip = "$Root\..\chefcozinha-render.zip"
if (Test-Path $zip) { Remove-Item $zip -Force }
Write-Host "Empacotando o projeto (sem node_modules, backups, dist)..."

# Lista de arquivos a empacotar
$exclude = @('node_modules','backups','dist','scratch','uploads','.git','installer','offline','pendrive','versao-win','ChefCozinha-Nativo','ubuntu-server','hub-server')
$files = Get-ChildItem -Recurse -File | Where-Object {
    $rel = $_.FullName.Substring($Root.Length + 1)
    $excluded = $false
    foreach ($e in $exclude) { if ($rel.StartsWith($e + '\') -or $rel -eq $e) { $excluded = $true; break } }
    -not $excluded
}
if (Get-Command Compress-Archive -ErrorAction SilentlyContinue) {
    $files | Compress-Archive -DestinationPath $zip -CompressionLevel Optimal
    Write-Host "[OK] Pacote: $zip" -ForegroundColor Green
} else {
    Write-Host "[OK] Pacote nao gerado (Compress-Archive indisponivel). Suba via git." -ForegroundColor Yellow
}

Write-Host ""
Write-Host "=== COMO SUBIR NO RENDER (passo a passo) ===" -ForegroundColor Cyan
Write-Host "1. Crie um repositorio no GitHub/GitLab e suba este projeto (git push)."
Write-Host "2. Entre em https://render.com  ->  New  ->  Blueprint."
Write-Host "3. Conecte o repositorio. O Render le o render.yaml e cria o servico."
Write-Host "4. Deploy finalizado -> abra a URL https://<seu-app>.onrender.com"
Write-Host "   O caixa/POV/PDV funcionam normalmente (Socket.IO + SQLite)."
Write-Host ""
Write-Host "AVISO (plano Free): o SQLite fica no disco efemero e some a cada redeploy."
Write-Host "  - Para testes: ok. Para dados permanentes: suba plano pago e monte um"
Write-Host "    disk (/opt/data) + faca o server.js gravar em CHEF_DATA_DIR."
Write-Host ""
Read-Host "Pressione Enter para finalizar"
