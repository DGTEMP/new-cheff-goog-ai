# =============================================================================
# Instalador Vercel — Chef Cozinha
#
# AVISO IMPORTANTE:
#   O Vercel NÃO roda o backend deste projeto. Ele só serve arquivos estáticos.
#   O "caixa" depende de: Socket.IO em tempo real + banco SQLite em disco +
#   processo Node persistente — nada disso existe no Vercel (sem WebSocket,
#   filesystem read-only, sem processo contínuo). Por isso a tela abre mas o
#   caixa nunca liga.
#
# O que este instalador faz:
#   1) Explica o limite e pergunta como você quer prosseguir.
#   2) Opcional: remove o site estático do Vercel (se foi criado só para teste).
#   3) Recomenda Render (deploy/install-render.ps1) ou VPS (deploy/install-vps.ps1).
#
# Uso:  powershell -ExecutionPolicy Bypass -File deploy\install-vercel.ps1
# =============================================================================
$Root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
Set-Location $Root

Write-Host "=== Instalador Vercel - Chef Cozinha ===" -ForegroundColor Cyan
Write-Host ""
Write-Host "POR QUE NAO FUNCIONA NO VERCEL:" -ForegroundColor Red
Write-Host "  1) Socket.IO exige um processo Node persistente, e o caixa conversa"
Write-Host "     por websocket com o server.js. O Vercel e serverless/estatico."
Write-Host "  2) O SQLite grava um arquivo .sqlite em disco. No Vercel o disco"
Write-Host "     e read-only e efemero (dados nunca persistiriam)."
Write-Host "  3) A conexao io() em main.js/index.html aponta para a mesma URL,"
Write-Host "     sem o backend, o overlay 'Caixa Fechado' nunca sai."
Write-Host ""

$opt = Read-Host "O que fazer? [1] Manter so como vitrine estatica  [2] Nada (vou usar Render/VPS)"
switch ($opt) {
    '1' {
        Write-Host ""
        Write-Host "VITRINE ESTATICA (so login/demo, sem caixa):" -ForegroundColor Green
        Write-Host "  1. Suba os arquivos HTML/JS/CSS estaticos para o Vercel (como voce ja fez)."
        Write-Host "  2. Entenda que o caixa e o restante NAO funcionam nessa URL."
        Write-Host "  3. Para o sistema de verdade, use Render ou VPS."
        Write-Host ""
        Write-Host "Dica: voce pode deixar a URL estatica apontando para um aviso 'Demo'"
        Write-Host "na pagina, e o sistema real rodando no Render/VPS com a sua URL."
    }
    '2' {
        Write-Host "OK. Opcoes recomendadas:" -ForegroundColor Green
        Write-Host "  - Render :  powershell -ExecutionPolicy Bypass -File deploy\install-render.ps1"
        Write-Host "  - VPS    :  powershell -ExecutionPolicy Bypass -File deploy\install-vps.ps1"
        Write-Host "  - Se nao quiser manter a URL estatica, apague o projeto no painel do Vercel."
    }
    default {
        Write-Host "Opcao invalida. Nenhuma alteracao feita." -ForegroundColor Yellow
    }
}
Write-Host ""
Read-Host "Pressione Enter para finalizar"
