#!/bin/bash
# Kali-AI-term — Synology DSM 7 installer
# Requires: Container Manager (Docker), SSH access
# ZeroTier moon setup: https://github.com/Crashcart/Zerotierone-moon

set -e

INSTALL_DIR="/volume1/docker/kali-ai-term"
DATA_DIR="${INSTALL_DIR}/data"
COMPOSE_FILE="docker-compose.synology.yml"
ZT_CONTAINER="zerotierone-moon"

echo "💉 ═══════════════════════════════════════════════════════════════════ 💉"
echo "    Kali-AI-term — Synology DSM 7 Installer"
echo "💉 ═══════════════════════════════════════════════════════════════════ 💉"
echo ""

# ── Prerequisites ─────────────────────────────────────────────────────────────
echo "✓ Checking prerequisites..."

command -v docker >/dev/null 2>&1 || {
  echo "  ❌ Docker (Container Manager) is required. Install it from Package Center."
  exit 1
}
echo "  ✓ Docker found: $(docker --version 2>/dev/null | head -1)"

# Confirm ZeroTier moon is running (Crashcart/Zerotierone-moon)
if ! docker inspect "$ZT_CONTAINER" >/dev/null 2>&1; then
  echo ""
  echo "  ❌ ZeroTier moon container '${ZT_CONTAINER}' not found."
  echo "     Set it up first: https://github.com/Crashcart/Zerotierone-moon"
  echo "     Then re-run this installer."
  exit 1
fi

if ! docker exec "$ZT_CONTAINER" zerotier-cli info >/dev/null 2>&1; then
  echo "  ❌ ZeroTier daemon in '${ZT_CONTAINER}' is not responding."
  echo "     Check: docker logs ${ZT_CONTAINER}"
  exit 1
fi
echo "  ✓ ZeroTier moon container running."

# Confirm compose file is present
SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)"
if [[ -f "${SCRIPT_DIR}/${COMPOSE_FILE}" ]]; then
  COMPOSE_PATH="${SCRIPT_DIR}/${COMPOSE_FILE}"
elif [[ -f "${INSTALL_DIR}/${COMPOSE_FILE}" ]]; then
  COMPOSE_PATH="${INSTALL_DIR}/${COMPOSE_FILE}"
else
  echo "  ❌ ${COMPOSE_FILE} not found."
  echo "     Run this script from the Kali-AI-term checkout directory."
  exit 1
fi

# ── Gather configuration ───────────────────────────────────────────────────────
echo ""
echo "✓ Configuration:"

while true; do
  read -rp "  Admin password for the web UI: " ADMIN_PASSWORD
  [[ -n "$ADMIN_PASSWORD" ]] && break
  echo "  ⚠  Password cannot be empty."
done

while true; do
  read -rp "  ZeroTier Network ID (16-char hex): " ZT_NETWORK_ID
  [[ ${#ZT_NETWORK_ID} -eq 16 ]] && break
  echo "  ⚠  Network ID must be exactly 16 hex characters."
done

echo ""

# ── Directory setup ────────────────────────────────────────────────────────────
echo "✓ Creating directories..."
mkdir -p "$DATA_DIR"
echo "  ✓ ${DATA_DIR}"

# ── Copy compose file to install dir if needed ────────────────────────────────
if [[ "$COMPOSE_PATH" != "${INSTALL_DIR}/${COMPOSE_FILE}" ]]; then
  cp "$COMPOSE_PATH" "${INSTALL_DIR}/${COMPOSE_FILE}"
  echo "  ✓ Copied ${COMPOSE_FILE} to ${INSTALL_DIR}/"
fi

# ── Generate .env ──────────────────────────────────────────────────────────────
echo "✓ Generating .env..."
AUTH_SECRET=$(openssl rand -hex 32)
cat > "${INSTALL_DIR}/.env" << ENVEOF
NODE_ENV=production
PORT=3000
BIND_HOST=0.0.0.0
OLLAMA_URL=http://ollama:11434
KALI_CONTAINER=kali-ai-term-kali
ADMIN_PASSWORD=${ADMIN_PASSWORD}
AUTH_SECRET=${AUTH_SECRET}
LOG_LEVEL=info
ENVEOF
echo "  ✓ .env written to ${INSTALL_DIR}/.env"

# ── Join ZeroTier network ──────────────────────────────────────────────────────
echo "✓ Joining ZeroTier network via moon..."
docker exec "$ZT_CONTAINER" zerotier-cli join "$ZT_NETWORK_ID" \
  && echo "  ✓ Join request sent for network ${ZT_NETWORK_ID}." \
  || { echo "  ❌ Failed to join network."; exit 1; }

echo "  ℹ  Waiting for IP assignment (authorize this node in your network admin if needed)..."
ZT_IP=""
for i in $(seq 1 30); do
  ZT_IP=$(docker exec "$ZT_CONTAINER" zerotier-cli listnetworks 2>/dev/null \
    | awk -v net="$ZT_NETWORK_ID" '$3 == net {print $NF}' \
    | grep -oE '[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+' | head -1)
  [[ -n "$ZT_IP" ]] && break
  sleep 3
done

if [[ -z "$ZT_IP" ]]; then
  echo "  ⚠  No ZeroTier IP assigned yet."
  echo "     Node ID: $(docker exec ${ZT_CONTAINER} zerotier-cli info | awk '{print $3}')"
  echo "     Authorize this device in your ZeroTier network admin, then find the IP with:"
  echo "       docker exec ${ZT_CONTAINER} zerotier-cli listnetworks"
  ZT_IP="<zerotier-ip>"
fi

# ── iptables — allow ZeroTier traffic into Docker ──────────────────────────────
echo "✓ Configuring iptables for ZeroTier..."
if iptables -L DOCKER-USER >/dev/null 2>&1; then
  iptables -I DOCKER-USER -i zt+ -j ACCEPT 2>/dev/null \
    && echo "  ✓ iptables: ZeroTier (zt+) → DOCKER-USER ACCEPT rule added" \
    || echo "  ⚠  Could not add iptables rule (try running as root)"
else
  iptables -I FORWARD -i zt+ -j ACCEPT 2>/dev/null \
    && echo "  ✓ iptables: ZeroTier (zt+) → FORWARD ACCEPT rule added" \
    || echo "  ⚠  Could not add iptables rule (try running as root)"
fi
echo "  ℹ  To persist across reboots: DSM Control Panel → Task Scheduler → Create Triggered Task (Boot-up)"

# ── Start Kali-AI-term ─────────────────────────────────────────────────────────
echo "✓ Starting Kali-AI-term containers..."
cd "$INSTALL_DIR"
docker compose -f "$COMPOSE_FILE" down 2>/dev/null || docker-compose -f "$COMPOSE_FILE" down 2>/dev/null || true
docker compose -f "$COMPOSE_FILE" up -d 2>/dev/null || docker-compose -f "$COMPOSE_FILE" up -d 2>/dev/null
echo "  ✓ Containers started."

# ── Done ───────────────────────────────────────────────────────────────────────
echo ""
echo "💉 ═══════════════════════════════════════════════════════════════════ 💉"
echo "    🎉 Installation Complete!"
echo "💉 ═══════════════════════════════════════════════════════════════════ 💉"
echo ""
echo "✓ Access via ZeroTier:"
echo "    URL:      http://${ZT_IP}:31337"
echo "    Password: ${ADMIN_PASSWORD}"
echo ""
echo "✓ ZeroTier Node ID:"
echo "    $(docker exec ${ZT_CONTAINER} zerotier-cli info 2>/dev/null | awk '{print $3}' || echo '<run: docker exec zerotierone-moon zerotier-cli info>')"
echo ""
echo "✓ Next steps:"
echo "    1. If the IP above shows <zerotier-ip>, authorize this node in your network admin"
echo "    2. Open http://${ZT_IP}:31337 from any device orbiting your moon"
echo "    3. Login with the password above"
echo ""
