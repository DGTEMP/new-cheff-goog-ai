@echo off
REM ═══════════════════════════════════════════════════════════
REM  SERVIDOR PRINCIPAL SEM O PAINEL SUPER ADMIN (modo isolado)
REM  Use junto com iniciar-super-admin-isolado.bat
REM ═══════════════════════════════════════════════════════════
cd /d "%~dp0"
set SUPER_ADMIN_ISOLADO=1
title Chef Cozinha - Servidor Principal (sem painel super admin)
node server.js
pause
