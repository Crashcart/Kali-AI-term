#!/bin/bash

set -e
export PS4='+ [${BASH_SOURCE##*/}:${LINENO}] '
set -x

# Stabilize execution context so deleted/invalid cwd does not break install flow.
if ! pwd >/dev/null 2>&1; then
  cd "$HOME" 2>/dev/null || cd /tmp
fi

SOURCE_PATH="${BASH_SOURCE[0]}"
if [[ "$SOURCE_PATH" == /dev/fd/* || "$SOURCE_PATH" == /proc/*/fd/* ]]; then
  REPO_DIR="${KALI_AI_TERM_DIR:-$HOME/Kali-AI-term}"
  REPO_URL="https://github.com/Crashcart/Kali-AI-term.git"

  echo "✓ Streamed installer detected; bootstrapping repository checkout..."
  command -v git >/dev/null 2>&1 || { echo "  ❌ git is required for streamed install"; exit 1; }

  if [[ -d "$REPO_DIR/.git" ]]; then
    git -C "$REPO_DIR" pull --ff-only >/dev/null 2>&1 || true
  else
    git clone "$REPO_URL" "$REPO_DIR" >/dev/null 2>&1
  fi

  exec bash "$REPO_DIR/install-full.sh" "$@"
fi

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)"
cd "$SCRIPT_DIR"

for required in docker-compose.yml package.json server.js; do
  if [[ ! -e "$required" ]]; then
    echo "  ❌ Installer must run from a Kali-AI-term repository checkout"
    echo "  Missing required file: $required"
    exit 1
  fi
done

echo "💉 ═══════════════════════════════════════════════════════════════════ 💉"
echo "    Kali Hacker Bot - Installation"
echo "💉 ═══════════════════════════════════════════════════════════════════ 💉"
echo ""

# Check Docker
echo "✓ Checking Docker..."
command -v docker &>/dev/null && echo "  ✓ Docker found: $(docker --version)" || { echo "  ❌ Docker required"; exit 1; }

# Check Node.js
echo "✓ Checking Node.js..."
command -v node &>/dev/null && echo "  ✓ Node.js found: $(node --version)" || { echo "  ❌ Node.js required"; exit 1; }

# Interactive password prompt
echo ""
echo "✓ Configuration:"
while true; do
  read -p "  Enter admin password: " ADMIN_PASSWORD
  if [[ -n "$ADMIN_PASSWORD" ]]; then
    break
  fi
  echo "  ⚠ Password cannot be empty"
done
echo ""

# Generate .env
echo "✓ Creating .env..."
AUTH_SECRET=$(node -e "console.log(require('crypto').randomUUID())")
cat > .env << ENVEOF
NODE_ENV=production
PORT=3000
BIND_HOST=0.0.0.0
OLLAMA_URL=http://host.docker.internal:11434
KALI_CONTAINER=kali-ai-term-kali
ADMIN_PASSWORD=$ADMIN_PASSWORD
AUTH_SECRET=$AUTH_SECRET
LOG_LEVEL=info
ENVEOF
echo "  ✓ .env created with secure secrets"

# Install dependencies
echo "✓ Installing dependencies..."
[ -d node_modules ] || npm install >/dev/null 2>&1
echo "  ✓ Dependencies installed"

# Docker setup
echo "✓ Setting up Docker containers..."
docker compose down 2>/dev/null || docker-compose down 2>/dev/null || true
echo "  ✓ Stopped existing containers"
docker compose up -d 2>/dev/null || docker-compose up -d 2>/dev/null
echo "  ✓ Started containers"

# ZeroTier iptables (optional — only runs if ZeroTier is installed)
echo "✓ Checking for ZeroTier..."
if command -v zerotier-cli &>/dev/null; then
  echo "  ✓ ZeroTier detected — configuring iptables to allow Docker forwarding..."
  # Docker's DOCKER-USER chain is the correct place to allow ZeroTier traffic
  if iptables -L DOCKER-USER >/dev/null 2>&1; then
    iptables -I DOCKER-USER -i zt+ -j ACCEPT 2>/dev/null && \
      echo "  ✓ iptables: ZeroTier (zt+) → DOCKER-USER ACCEPT rule added" || \
      echo "  ⚠ Could not add iptables rule (try running as root)"
  else
    # Fallback for systems without DOCKER-USER chain
    iptables -I FORWARD -i zt+ -j ACCEPT 2>/dev/null && \
      echo "  ✓ iptables: ZeroTier (zt+) → FORWARD ACCEPT rule added" || \
      echo "  ⚠ Could not add iptables rule (try running as root)"
  fi
  echo ""
  echo "  ℹ  To persist iptables rules across reboots:"
  echo "     sudo apt-get install -y iptables-persistent"
  echo "     sudo netfilter-persistent save"
  echo ""
  echo "  ℹ  Then access via your ZeroTier IP: http://<zerotier-ip>:31337"
else
  echo "  ℹ  ZeroTier not found. See README.md for ZeroTier access setup."
fi

# Wait for startup
echo "✓ Waiting for startup..."
sleep 3
echo "  ✓ Ready"

# Success
echo ""
echo "💉 ═══════════════════════════════════════════════════════════════════ 💉"
echo "    🎉 Installation Complete!"
echo "💉 ═══════════════════════════════════════════════════════════════════ 💉"
echo ""
echo "✓ Access the application:"
echo "    Local:      http://localhost:31337"
echo "    Network:    http://$(hostname -I | awk '{print $1}'):31337"
echo "    Password:   $ADMIN_PASSWORD"
echo ""
echo "✓ Next steps:"
echo "    1. Open http://localhost:31337 in your browser"
echo "    2. Login with password above"
echo "    3. Configure APIs in Settings"
echo ""
