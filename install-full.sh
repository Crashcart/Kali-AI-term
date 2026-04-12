#!/bin/bash

# ============================================
# Kali Hacker Bot - Easy Install Script
# ============================================

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Helper function to log via Node.js logger
file_log() {
  local level=$1
  local message=$2
  node -e "const {createLogger} = require('./lib/install-logger'); const l = createLogger('install'); l.log('$level', '$message');" 2>/dev/null || true
}

# Functions
log_info() {
    echo -e "${BLUE}ℹ${NC}  $1"
    file_log "INFO" "$1"
}

log_success() {
    echo -e "${GREEN}✓${NC}  $1"
    file_log "SUCCESS" "$1"
}

log_error() {
    echo -e "${RED}✗${NC}  $1"
    file_log "ERROR" "$1"
}

log_warn() {
    echo -e "${YELLOW}⚠${NC}  $1"
    file_log "WARN" "$1"
}

check_command() {
    if ! command -v $1 &> /dev/null; then
        return 1
    fi
    return 0
}

get_version() {
    $1 --version 2>/dev/null | head -n1 || echo "unknown"
}

# ============================================
# 1. Check Prerequisites
# ============================================

echo ""
echo -e "${BLUE}╔════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║  Kali Hacker Bot - Installation      ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════╝${NC}"
echo ""

# Track system info
node -e "const {createLogger} = require('./lib/install-logger'); const l = createLogger('install'); l.trackSystemInfo();" 2>/dev/null || true
node -e "const {createLogger} = require('./lib/install-logger'); const l = createLogger('install'); l.trackEnvironment();" 2>/dev/null || true

log_info "Checking prerequisites..."
echo ""

MISSING_DEPS=0

# Check Docker
if check_command docker; then
    DOCKER_VERSION=$(docker --version)
    log_success "Docker installed: $DOCKER_VERSION"
else
    log_error "Docker not found"
    echo "    Install from: https://docs.docker.com/get-docker/"
    MISSING_DEPS=1
fi

# Check Docker Compose (support both docker-compose and docker compose)
if check_command docker-compose; then
    COMPOSE_VERSION=$(docker-compose --version)
    log_success "Docker Compose installed (docker-compose): $COMPOSE_VERSION"
    DOCKER_COMPOSE_CMD="docker-compose"
elif docker compose version &> /dev/null 2>&1; then
    COMPOSE_VERSION=$(docker compose version)
    log_success "Docker Compose installed (docker compose): $COMPOSE_VERSION"
    DOCKER_COMPOSE_CMD="docker compose"
else
    log_error "Docker Compose not found"
    echo "    Install from: https://docs.docker.com/compose/install/"
    MISSING_DEPS=1
fi

# Check Node.js
if check_command node; then
    NODE_VERSION=$(node --version)
    log_success "Node.js installed: $NODE_VERSION"
else
    log_error "Node.js not found"
    echo "    Install from: https://nodejs.org/ (v18 or higher)"
    MISSING_DEPS=1
fi

# Note: Ollama is run separately, not bundled with Kali bot
log_info "Note: Ollama must be run separately (see .env for OLLAMA_URL configuration)"

# Check for missing critical dependencies
if [ $MISSING_DEPS -eq 1 ]; then
    echo ""
    log_error "Critical dependencies are missing. Please install them first."
    echo ""

    # Check if user wants to skip checks
    if [[ "$*" == *"--skip-checks"* ]] || [[ "$*" == *"--force"* ]]; then
        log_warn "Skipping dependency checks as requested"
    else
        read -p "    Continue anyway? (y/n) " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            exit 1
        fi
        log_info "Proceeding with installation..."
    fi
fi

# ============================================
# 2. Create .env Configuration
# ============================================

echo ""
log_info "Configuring environment..."
echo ""

if [ -f .env ]; then
    log_warn ".env file already exists"
    read -p "    Overwrite? (y/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        log_info "Keeping existing .env"
    else
        cp .env .env.backup
        log_success "Backed up to .env.backup"
    fi
else
    # Generate secure random values
    AUTH_SECRET=$(node -e "console.log(require('crypto').randomUUID())")
    ADMIN_PASSWORD=$(node -e "console.log(require('crypto').randomBytes(8).toString('hex'))")

    cat > .env << EOF
# Kali Hacker Bot Configuration
NODE_ENV=production
PORT=31337
BIND_HOST=0.0.0.0

# Ollama (running on host)
OLLAMA_URL=http://host.docker.internal:11434

# Docker
KALI_CONTAINER=kali-ai-term-kali

# Security
ADMIN_PASSWORD=$ADMIN_PASSWORD
AUTH_SECRET=$AUTH_SECRET

# Logging
LOG_LEVEL=info
EOF

    log_success "Generated .env with secure secrets"
    echo ""
    echo -e "${YELLOW}⚠  Save your credentials:${NC}"
    echo "    Admin Password: ${GREEN}$ADMIN_PASSWORD${NC}"
    echo ""
fi

# ============================================
# 3. Install Dependencies
# ============================================

echo ""
log_info "Installing Node.js dependencies..."
echo ""

if [ -d node_modules ]; then
    log_info "node_modules already exists, skipping npm install"
else
    npm_output=$(npm install 2>&1)
    npm_exit=$?
    if [ $npm_exit -eq 0 ]; then
        log_success "Dependencies installed"
        node -e "const {createLogger} = require('./lib/install-logger'); const l = createLogger('install'); l.trackCommand('npm install', 0, '');" 2>/dev/null || true
    else
        log_error "npm install failed with exit code $npm_exit"
        echo "$npm_output" | head -10
        node -e "const {createLogger} = require('./lib/install-logger'); const l = createLogger('install'); l.trackCommand('npm install', $npm_exit, 'Installation failed');" 2>/dev/null || true
        exit 1
    fi
fi

# ============================================
# 4. Start Docker Containers
# ============================================

echo ""
log_info "Starting Docker containers..."
echo ""

# Use appropriate docker compose command
COMPOSE_CMD="${DOCKER_COMPOSE_CMD:-docker-compose}"
$COMPOSE_CMD down 2>/dev/null || true
$COMPOSE_CMD up -d

log_info "Waiting for containers to be healthy..."

# Real health check - wait for containers to be ready (max 30 seconds)
KALI_READY=0
APP_READY=0
WAIT_TIME=0
MAX_WAIT=30

while [ $WAIT_TIME -lt $MAX_WAIT ]; do
  # Check if containers are running
  if docker ps --format "table {{.Names}}" | grep -q "kali-ai-term-kali"; then
    KALI_READY=1
    node -e "const {createLogger} = require('./lib/install-logger'); const l = createLogger('install'); l.trackContainer('kali-ai-term-kali', 'running', {});" 2>/dev/null || true
  fi

  if docker ps --format "table {{.Names}}" | grep -q "kali-ai-term-app"; then
    APP_READY=1
    node -e "const {createLogger} = require('./lib/install-logger'); const l = createLogger('install'); l.trackContainer('kali-ai-term-app', 'running', {});" 2>/dev/null || true
  fi

  if [ $KALI_READY -eq 1 ] && [ $APP_READY -eq 1 ]; then
    log_success "All containers are running"
    node -e "const {createLogger} = require('./lib/install-logger'); const l = createLogger('install'); l.success('Containers verified as running after ${WAIT_TIME}s');" 2>/dev/null || true
    break
  fi

  WAIT_TIME=$((WAIT_TIME + 1))
  sleep 1
done

if [ $KALI_READY -eq 0 ] || [ $APP_READY -eq 0 ]; then
  log_warn "Containers may still be starting, checking logs..."
  $COMPOSE_CMD logs --tail=10
  node -e "const {createLogger} = require('./lib/install-logger'); const l = createLogger('install'); l.warn('Container startup incomplete after 30s timeout');" 2>/dev/null || true
fi

# ============================================
# 5. Display Success Message
# ============================================

echo ""
echo -e "${GREEN}╔════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║  🎉 Installation Complete!            ║${NC}"
echo -e "${GREEN}╚════════════════════════════════════════╝${NC}"
echo ""

ADMIN_PASSWORD=$(grep ADMIN_PASSWORD .env | cut -d'=' -f2)

echo -e "${BLUE}Access the application:${NC}"
echo "    Local URL:   ${GREEN}http://localhost:31337${NC}"
echo "    Network URL: ${GREEN}http://$(hostname -I | awk '{print $1}'):31337${NC}"
echo "    Password:    ${GREEN}$ADMIN_PASSWORD${NC}"
echo ""

echo -e "${BLUE}Documentation:${NC}"
echo "    Architecture: ${GREEN}see TDR.md${NC}"
echo "    Usage Guide: ${GREEN}see README.md${NC}"
echo ""

echo -e "${BLUE}Next steps:${NC}"
echo "    1. Open http://localhost:31337 in your browser"
echo "    2. Login with the password above"
echo "    3. Configure Ollama URL in Settings → OLLAMA (if using external Ollama)"
echo "    4. Configure target IP in Settings → TARGET"
echo "    5. Start pentesting!"
echo ""

echo -e "${BLUE}First-time configuration:${NC}"
echo "    • Settings → OLLAMA: Configure Ollama URL and model"
echo "    • Settings → TARGET: Set target IP and listening port"
echo "    • Settings → PROXY: Configure proxy if needed (optional)"
echo ""

echo -e "${BLUE}Useful commands:${NC}"
echo "    View logs:        docker-compose logs -f app"
echo "    Stop containers:  docker-compose down"
echo "    Restart services: docker-compose restart"
echo ""

# Generate diagnostic report
INSTALL_STATUS="success"
if [ $KALI_READY -eq 0 ] || [ $APP_READY -eq 0 ]; then
    INSTALL_STATUS="partial"
fi

node -e "const {createLogger} = require('./lib/install-logger'); const l = createLogger('install'); l.generateDiagnostic('$INSTALL_STATUS', 'complete', '');" 2>/dev/null || true

# Get log paths for display
LOG_PATH=$(node -e "const {createLogger} = require('./lib/install-logger'); const l = createLogger('install'); console.log(l.getLogPath());" 2>/dev/null || echo "install.log")
DIAGNOSTIC_PATH=$(node -e "const {createLogger} = require('./lib/install-logger'); const l = createLogger('install'); console.log(l.getDiagnosticPath());" 2>/dev/null || echo "install.diagnostic")

echo -e "${BLUE}Log files:${NC}"
echo "    Log file:        ${GREEN}$LOG_PATH${NC}"
echo "    Diagnostic:      ${GREEN}$DIAGNOSTIC_PATH${NC}"
echo ""

log_success "Ready to go!"
