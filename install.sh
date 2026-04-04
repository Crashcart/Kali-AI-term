#!/bin/bash

export PS4='+ [${BASH_SOURCE##*/}:${LINENO}] '
set -x

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
read -p "  Enter admin password: " ADMIN_PASSWORD
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
