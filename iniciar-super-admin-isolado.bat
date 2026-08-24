@echo off
REM ═══════════════════════════════════════════════════════════
REM  SUPER ADMIN ISOLADO - inicia o painel em processo Node proprio
REM  O servidor principal deve estar rodando com SUPER_ADMIN_ISOLADO=1
REM ═══════════════════════════════════════════════════════════
cd /d "%~dp0"
set SUPER_ADMIN_PORT=3457
if not defined PORT set PORT=3000
title Chef Cozinha - Super Admin (Isolado)
:loop
node super-admin-server.js
echo [super-admin-isolado] Processo encerrou. Reiniciando em 3s... (Ctrl+C para sair)
timeout /t 3 /nobreak >nul
goto loop
