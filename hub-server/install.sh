#!/usr/bin/env bash
# =============================================================================
# Chef Cozinha HUB - instalador Ubuntu (Super Admin + gestão de restaurantes)
#
# Uso:   sudo bash install.sh
#
# Instala em:   /opt/chefcozinha-hub
# Executa como: o usuário que rodou o sudo ($SUDO_USER)
# Dados em:     /opt/chefcozinha-hub  (master.sqlite, estabelecimentos/, uploads/)
# Porta:        lida de /opt/chefcozinha-hub/port.txt se existir; senão 3000
# Acesso:       http://<IP-do-servidor>:<porta>
#               /super-admin   -> painel de gestão (Super Admin)
#               /registro.html -> registro de novos restaurantes (SaaS trial)
#
# IMPORTANTE: este pacote contém o Super Admin e as rotas /api/super/*. Deve ser
# instalado SOMENTE no servidor do dono (com internet). Os pacotes entregues aos
# clientes NÃO possuem super admin.
# =============================================================================
set -euo pipefail

APP="ChefCozinha-Hub"
INSTALL_DIR="/opt/chefcozinha-hub"
CERT_PASS="chefcozinha"
ENV_FILE="/etc/chefcozinha-hub.env"

if [ "$(id -u)" -ne 0 ]; then
  echo "Rode como root: sudo bash install.sh"
  exit 1
fi

RUN_USER="${SUDO_USER:-root}"
RUN_GROUP="$(id -gn "$RUN_USER" 2>/dev/null || echo "$RUN_USER")"
SRC_DIR="$(cd "$(dirname "$0")" && pwd)"

echo "=== $APP - instalador Ubuntu (HUB / Super Admin) ==="
echo "Instalando em:    $INSTALL_DIR"
echo "Usuário de exec:  $RUN_USER"

# -----------------------------------------------------------------------------
# 1/6 Node.js 18+ (instala NodeSource 20 LTS se ausente/antigo)
# -----------------------------------------------------------------------------
NODE_MAJOR=0
if command -v node >/dev/null 2>&1; then
  NODE_MAJOR="$(node -p 'Number(process.versions.node.split(".")[0])' 2>/dev/null || echo 0)"
fi

if [ "$NODE_MAJOR" -ge 18 ]; then
  echo "[1/6] Node.js $(node -v) já instalado. Garantindo ferramentas de build..."
  apt-get update >/dev/null
  apt-get install -y build-essential python3 make g++ openssl >/dev/null
else
  echo "[1/6] Instalando Node.js 20 LTS + ferramentas de build..."
  apt-get update
  apt-get install -y ca-certificates curl gnupg build-essential python3 make g++ openssl
  mkdir -p /etc/apt/keyrings
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt-get install -y nodejs
fi

# -----------------------------------------------------------------------------
# 2/6 Copiar arquivos do pacote (servidor COMPLETO, com Super Admin)
# -----------------------------------------------------------------------------
echo "[2/6] Copiando arquivos para $INSTALL_DIR..."
mkdir -p "$INSTALL_DIR"

for f in server-hub.js license-manager.js nfce-service.js package.json; do
  [ -e "$SRC_DIR/$f" ] && cp -f "$SRC_DIR/$f" "$INSTALL_DIR/"
done
[ -f "$SRC_DIR/port.txt" ] && cp -f "$SRC_DIR/port.txt" "$INSTALL_DIR/"
[ -d "$SRC_DIR/controllers" ] && cp -rf "$SRC_DIR/controllers" "$INSTALL_DIR/"
[ -d "$SRC_DIR/public" ] && cp -rf "$SRC_DIR/public" "$INSTALL_DIR/"
[ -d "$SRC_DIR/dist" ] && cp -rf "$SRC_DIR/dist" "$INSTALL_DIR/"

# -----------------------------------------------------------------------------
# 3/6 Dependências (sqlite3 e bcrypt são nativos - compilados no Ubuntu)
# -----------------------------------------------------------------------------
echo "[3/6] Instalando dependências (sqlite3/bcrypt nativos)..."
cd "$INSTALL_DIR"
npm install --omit=dev

# -----------------------------------------------------------------------------
# 4/6 Certificado TLS auto-assinado (mesmo modelo do Windows, senha fixa)
# -----------------------------------------------------------------------------
echo "[4/6] Gerando certificado TLS auto-assinado..."
if [ ! -f "$INSTALL_DIR/cert.pfx" ]; then
  openssl req -x509 -newkey rsa:2048 -keyout /tmp/chef_key.pem -out /tmp/chef_cert.pem \
    -days 3650 -nodes -subj "/CN=ChefCozinha-Hub" \
    -addext "subjectAltName=DNS:localhost,IP:127.0.0.1" >/dev/null 2>&1
  openssl pkcs12 -export -out "$INSTALL_DIR/cert.pfx" \
    -inkey /tmp/chef_key.pem -in /tmp/chef_cert.pem -passout "pass:$CERT_PASS"
  rm -f /tmp/chef_key.pem /tmp/chef_cert.pem
fi
chmod 600 "$INSTALL_DIR/cert.pfx"

# -----------------------------------------------------------------------------
# 5/6 Permissões
# -----------------------------------------------------------------------------
echo "[5/6] Ajustando permissões..."
chown -R "$RUN_USER:$RUN_GROUP" "$INSTALL_DIR"

# -----------------------------------------------------------------------------
# 6/6 Serviço systemd
# -----------------------------------------------------------------------------
echo "[6/6] Instalando serviço systemd..."
sed -e "s|__USER__|$RUN_USER|g" "$SRC_DIR/chefcozinha.service" > /etc/systemd/system/chefcozinha-hub.service
systemctl daemon-reload
systemctl enable chefcozinha-hub >/dev/null 2>&1 || true
systemctl restart chefcozinha-hub || true

# -----------------------------------------------------------------------------
IP="$(hostname -I 2>/dev/null | awk '{print $1}')"
echo ""
echo "=== Instalação concluída ==="
echo "Status:   systemctl status chefcozinha-hub"
echo "Logs:     journalctl -u chefcozinha-hub -f"
echo "SuperAdmin:  http://${IP:-<IP-do-servidor>}:3000/super-admin"
echo "Registro:    http://${IP:-<IP-do-servidor>}:3000/registro.html"
echo ""
echo "ATENÇÃO: abra a porta no firewall para receber telemetria/ativação dos clientes:"
echo "    sudo ufw allow 3000/tcp"
