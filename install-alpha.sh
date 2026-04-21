#!/bin/bash
# Kali Hacker Bot Installation Script - ALPHA TIER
# Target Branch: alpha
# Raw URL: https://raw.githubusercontent.com/Crashcart/Kali-AI-term/alpha/install-alpha.sh
#
# Alpha tier: Early features, experimental code, frequent updates
# Use this for testing new functionality before beta promotion
#
set -e
export PS4='+ [${BASH_SOURCE##*/}:${LINENO}] '
set -x

echo "💉 ═══════════════════════════════════════════════════════════════════ 💉"
echo "    Kali Hacker Bot - Installation (ALPHA TIER)"
echo "💉 ═══════════════════════════════════════════════════════════════════ 💉"
echo ""

# Clone/enter repo if needed
if [ ! -f "install-alpha.sh" ] || [ ! -f "package.json" ]; then
  echo "📦 Cloning Kali-AI-term repository (alpha branch)..."
  if [ -d "Kali-AI-term" ]; then
    cd Kali-AI-term
  else
    git clone --branch alpha https://github.com/Crashcart/Kali-AI-term.git
    cd Kali-AI-term
  fi
fi

# Initialize logger using Node.js module
log_cmd() {
  local level=$1
  local message=$2
  local data=${3:-'{}'}
  node -e "const {createLogger} = require('./lib/install-logger'); const l = createLogger('install'); l.log('$level', '$message', $data);" 2>/dev/null || true
}

log_info() { log_cmd "INFO" "$1" "$2"; }
log_success() { log_cmd "SUCCESS" "$1" "$2"; }
log_error() { log_cmd "ERROR" "$1" "$2"; }
log_warn() { log_cmd "WARN" "$1" "$2"; }
log_debug() { log_cmd "DEBUG" "$1" "$2"; }

track_command() {
  local cmd=$1
  local output=$2
  local exit_code=$3
  node -e "const {createLogger} = require('./lib/install-logger'); const l = createLogger('install'); l.trackCommand('$cmd', $exit_code, \`$output\`);" 2>/dev/null || true
}

log_info "Starting installation (ALPHA tier)..."

# Check Docker
echo "✓ Checking Docker..."
if command -v docker &>/dev/null; then
  docker_version=$(docker --version)
  echo "  ✓ Docker found: $docker_version"
  log_success "Docker found" "{ version: '$docker_version' }"
else
  echo "  ❌ Docker required"
  log_error "Docker not found"
  exit 1
fi

# Check Node.js
echo "✓ Checking Node.js..."
if command -v node &>/dev/null; then
  node_version=$(node --version)
  echo "  ✓ Node.js found: $node_version"
  log_success "Node.js found" "{ version: '$node_version' }"
else
  echo "  ❌ Node.js required"
  log_error "Node.js not found"
  exit 1
fi

# Track system info
node -e "const {createLogger} = require('./lib/install-logger'); const l = createLogger('install'); l.trackSystemInfo();" 2>/dev/null || true
node -e "const {createLogger} = require('./lib/install-logger'); const l = createLogger('install'); l.trackEnvironment();" 2>/dev/null || true

# Create .env if not exists
echo "✓ Creating .env..."
if [ ! -f .env ]; then
  AUTH_SECRET=$(node -e "console.log(require('crypto').randomUUID())")
  ADMIN_PASSWORD=$(node -e "console.log(require('crypto').randomBytes(8).toString('hex'))")
  cat > .env << ENVEOF
NODE_ENV=production
PORT=31337
BIND_HOST=0.0.0.0
OLLAMA_URL=http://host.docker.internal:11434
KALI_CONTAINER=kali-ai-term-kali
ADMIN_PASSWORD=$ADMIN_PASSWORD
AUTH_SECRET=$AUTH_SECRET
LOG_LEVEL=info
ENVEOF
  echo "  ✓ .env created with secure secrets"
  log_success ".env configuration created"
else
  ADMIN_PASSWORD=$(grep ADMIN_PASSWORD .env | cut -d= -f2)
  echo "  ✓ .env already exists"
  log_info ".env already exists"
fi

# Install dependencies
echo "✓ Installing dependencies..."
if [ -d node_modules ]; then
  echo "  ✓ Dependencies already installed"
  log_info "node_modules already exists, skipping npm install"
else
  npm_output=$(npm install 2>&1)
  npm_exit=$?
  if [ $npm_exit -eq 0 ]; then
    echo "  ✓ Dependencies installed"
    log_success "npm install completed"
    track_command "npm install" "$npm_output" 0
  else
    echo "  ❌ npm install failed with exit code $npm_exit"
    echo "  Output: $(echo "$npm_output" | head -5)"
    log_error "npm install failed"
    track_command "npm install" "$npm_output" $npm_exit
    exit 1
  fi
fi

# Docker setup
echo "✓ Setting up Docker containers..."

# Clean up old containers
echo "  Cleaning up old containers..."
docker ps -a --filter "name=kali-ai-term" --format "{{.ID}}" 2>/dev/null | xargs -r docker rm -f >/dev/null 2>&1 || true

# Stop and remove
docker_down=$(docker compose down -v 2>&1 || docker-compose down -v 2>&1 || echo "")
echo "  ✓ Stopped and removed old containers"
log_info "Docker compose down completed"
track_command "docker compose down" "$docker_down" 0

# Start app and kali containers (Ollama is external)
echo "  Starting Kali bot containers..."
docker_up=$(docker compose up -d 2>&1 || docker-compose up -d 2>&1)
docker_up_exit=$?

if [ $docker_up_exit -eq 0 ]; then
  echo "  ✓ Started containers"
  log_success "Docker containers started"
  track_command "docker compose up -d" "$docker_up" 0
else
  echo "  ❌ Failed to start containers"
  log_error "Docker containers failed to start"
  track_command "docker compose up -d" "$docker_up" $docker_up_exit
  exit 1
fi

# Health check
echo "✓ Verifying container health..."
KALI_READY=0
APP_READY=0
WAIT_TIME=0
MAX_WAIT=30

while [ $WAIT_TIME -lt $MAX_WAIT ]; do
  if docker ps --format "table {{.Names}}" | grep -q "kali-ai-term-kali"; then
    KALI_READY=1
  fi

  if docker ps --format "table {{.Names}}" | grep -q "kali-ai-term-app"; then
    APP_READY=1
  fi

  if [ $KALI_READY -eq 1 ] && [ $APP_READY -eq 1 ]; then
    echo "  ✓ Containers verified as running"
    log_success "All containers healthy"
    break
  fi

  WAIT_TIME=$((WAIT_TIME + 1))
  sleep 1
done

if [ $KALI_READY -eq 0 ] || [ $APP_READY -eq 0 ]; then
  echo "  ⚠ Warning: Not all containers started within 30 seconds"
  log_warn "Container startup timeout"
fi

# ZeroTier iptables (optional)
echo "✓ Checking for ZeroTier..."
if command -v zerotier-cli &>/dev/null; then
  echo "  ✓ ZeroTier detected — configuring iptables..."
  log_info "ZeroTier detected, configuring iptables"

  if iptables -L DOCKER-USER >/dev/null 2>&1; then
    iptables -I DOCKER-USER -i zt+ -j ACCEPT 2>/dev/null && \
      echo "  ✓ iptables rule added" || \
      echo "  ⚠ Could not add iptables rule (try running as root)"
  else
    iptables -I FORWARD -i zt+ -j ACCEPT 2>/dev/null && \
      echo "  ✓ iptables rule added (FORWARD)" || \
      echo "  ⚠ Could not add iptables rule (try running as root)"
  fi

  echo ""
  echo "  ℹ  To persist iptables rules across reboots:"
  echo "     sudo apt-get install -y iptables-persistent"
  echo "     sudo netfilter-persistent save"
else
  echo "  ℹ  ZeroTier not found. See README.md for setup."
  log_debug "ZeroTier not found"
fi

# Generate diagnostic
INSTALL_STATUS="success"
if [ $KALI_READY -eq 0 ] || [ $APP_READY -eq 0 ]; then
  INSTALL_STATUS="partial"
fi

node -e "const {createLogger} = require('./lib/install-logger'); const l = createLogger('install'); l.generateDiagnostic('$INSTALL_STATUS', 'complete', '');" 2>/dev/null || true

# Success message
echo ""
echo "💉 ═══════════════════════════════════════════════════════════════════ 💉"
echo "    🎉 Installation Complete (ALPHA TIER)!"
echo "💉 ═══════════════════════════════════════════════════════════════════ 💉"
echo ""
echo "⚠️  ALPHA TIER WARNING: This is early/experimental code for testing new features"
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
echo "    4. Test new features and report issues"
echo ""

log_success "Installation completed successfully (ALPHA tier)"
