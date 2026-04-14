#!/bin/bash
# Kali-AI-term — Synology DSM 7 installer (ZeroTier moon access)
# Requires: Container Manager (Docker), SSH access, ZeroTier network

set -e

INSTALL_DIR="/volume1/docker/kali-ai-term"
DATA_DIR="${INSTALL_DIR}/data"
COMPOSE_FILE="docker-compose.synology.yml"
ZT_CONTAINER="zerotier-one"
ZT_IMAGE="zerotier/zerotier-synology:latest"
ZT_DATA_DIR="/volume1/docker/zerotier-one/data"

echo "💉 ═══════════════════════════════════════════════════════════════════ 💉"
echo "    Kali-AI-term — Synology DSM 7 / ZeroTier Installer"
echo "💉 ═══════════════════════════════════════════════════════════════════ 💉"
echo ""

# ── Prerequisites ─────────────────────────────────────────────────────────────
echo "✓ Checking prerequisites..."

command -v docker >/dev/null 2>&1 || { echo "  ❌ Docker (Container Manager) is required. Install it from Package Center."; exit 1; }
echo "  ✓ Docker found: $(docker --version 2>/dev/null | head -1)"

if [[ ! -f "$COMPOSE_FILE" ]] && [[ ! -f "${INSTALL_DIR}/${COMPOSE_FILE}" ]]; then
  echo "  ❌ ${COMPOSE_FILE} not found."
  echo "     Run this script from the Kali-AI-term checkout, or place it alongside the compose file."
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

read -rp "  ZeroTier Moon World ID (leave blank to skip): " ZT_MOON_WORLD_ID
if [[ -n "$ZT_MOON_WORLD_ID" ]]; then
  while true; do
    read -rp "  ZeroTier Moon Seed ID: " ZT_MOON_SEED_ID
    [[ -n "$ZT_MOON_SEED_ID" ]] && break
    echo "  ⚠  Seed ID is required when a Moon World ID is provided."
  done
fi

echo ""

# ── Directory setup ────────────────────────────────────────────────────────────
echo "✓ Creating directories..."
mkdir -p "$DATA_DIR"
mkdir -p "$ZT_DATA_DIR"
echo "  ✓ ${DATA_DIR}"
echo "  ✓ ${ZT_DATA_DIR}"

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

# ── ZeroTier container ─────────────────────────────────────────────────────────
echo "✓ Setting up ZeroTier..."

if docker inspect "$ZT_CONTAINER" >/dev/null 2>&1; then
  echo "  ✓ ZeroTier container already exists — skipping creation."
else
  echo "  ℹ  Starting ZeroTier container (${ZT_IMAGE})..."
  docker run -d \
    --name "$ZT_CONTAINER" \
    --restart unless-stopped \
    --network host \
    --device /dev/net/tun \
    --cap-add NET_ADMIN \
    --cap-add SYS_ADMIN \
    -v "${ZT_DATA_DIR}:/var/lib/zerotier-one" \
    "$ZT_IMAGE"
  echo "  ✓ ZeroTier container started."
fi

# Wait for ZeroTier daemon to be ready
echo "  ℹ  Waiting for ZeroTier daemon..."
for i in $(seq 1 30); do
  if docker exec "$ZT_CONTAINER" zerotier-cli info >/dev/null 2>&1; then
    break
  fi
  sleep 2
done
docker exec "$ZT_CONTAINER" zerotier-cli info && echo "" || { echo "  ❌ ZeroTier daemon did not start. Check: docker logs ${ZT_CONTAINER}"; exit 1; }

# ── Orbit moon (optional) ──────────────────────────────────────────────────────
if [[ -n "$ZT_MOON_WORLD_ID" ]]; then
  echo "  ℹ  Orbiting moon ${ZT_MOON_WORLD_ID}..."
  docker exec "$ZT_CONTAINER" zerotier-cli orbit "$ZT_MOON_WORLD_ID" "$ZT_MOON_SEED_ID" \
    && echo "  ✓ Orbiting moon ${ZT_MOON_WORLD_ID}" \
    || echo "  ⚠  Could not orbit moon — verify the world/seed IDs and try: docker exec ${ZT_CONTAINER} zerotier-cli orbit <worldID> <seedID>"
fi

# ── Join network ───────────────────────────────────────────────────────────────
echo "  ℹ  Joining ZeroTier network ${ZT_NETWORK_ID}..."
docker exec "$ZT_CONTAINER" zerotier-cli join "$ZT_NETWORK_ID" \
  && echo "  ✓ Join request sent." \
  || { echo "  ❌ Failed to join network."; exit 1; }

echo "  ℹ  Waiting for IP assignment (authorize the device in ZeroTier Central if needed)..."
ZT_IP=""
for i in $(seq 1 30); do
  ZT_IP=$(docker exec "$ZT_CONTAINER" zerotier-cli listnetworks 2>/dev/null \
    | awk -v net="$ZT_NETWORK_ID" '$3 == net {print $NF}' \
    | grep -oE '[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+' | head -1)
  [[ -n "$ZT_IP" ]] && break
  sleep 3
done

if [[ -z "$ZT_IP" ]]; then
  echo "  ⚠  No ZeroTier IP assigned yet. Authorize this device in ZeroTier Central or your moon."
  echo "     Node ID: $(docker exec ${ZT_CONTAINER} zerotier-cli info | awk '{print $3}')"
  echo "     After authorization, the app will still be accessible — just find the IP with:"
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
echo "  ℹ  To persist iptables rules across reboots, add the rule to DSM Control Panel → Task Scheduler (Triggered Task, Boot-up)."

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
echo "    $(docker exec ${ZT_CONTAINER} zerotier-cli info 2>/dev/null | awk '{print $3}' || echo '<run: docker exec zerotier-one zerotier-cli info>')"
echo ""
echo "✓ Next steps:"
echo "    1. If prompted, authorize this device in ZeroTier Central / your moon admin"
echo "    2. Open http://${ZT_IP}:31337 in your browser"
echo "    3. Login with the password above"
echo ""
