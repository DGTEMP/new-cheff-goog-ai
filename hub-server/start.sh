#!/usr/bin/env bash
# Inicia o servidor do HUB em primeiro plano (para testes ou uso manual).
# Para uso como serviço automático, use:  sudo bash install.sh  (instala o systemd)
cd "$(dirname "$0")"
exec node server-hub.js
