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

# Functions
log_info() {
    echo -e "${BLUE}ℹ${NC}  $1"
}

log_success() {
    echo -e "${GREEN}✓${NC}  $1"
}

log_error() {
    echo -e "${RED}✗${NC}  $1"
}

log_warn() {
    echo -e "${YELLOW}⚠${NC}  $1"
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

# Check Ollama (optional - can be configured later in web UI)
if check_command ollama; then
    OLLAMA_VERSION=$(ollama --version 2>/dev/null || echo "unknown")
    log_success "Ollama installed: $OLLAMA_VERSION"

    # Check if Ollama is running
    if timeout 2 bash -c 'echo > /dev/tcp/localhost/11434' 2>/dev/null; then
        log_success "Ollama is running on port 11434"
    else
        log_warn "Ollama is not running on port 11434"
        echo "    Run: ollama serve"
    fi
else
    log_warn "Ollama not found (optional)"
    echo "    Install from: https://ollama.ai/"
    echo "    You can configure Ollama URL later in Settings → OLLAMA tab"
fi

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
KALI_CONTAINER=Kali-AI-linux

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
    npm install
    log_success "Dependencies installed"
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
sleep 5

# Check if containers are running
if docker ps | grep -q "Kali-AI-app" && docker ps | grep -q "Kali-AI-linux"; then
    log_success "All containers are running"
else
    log_warn "Containers may still be starting, checking logs..."
    $COMPOSE_CMD logs --tail=10
fi

# ============================================
# 5. ZeroTier iptables (optional)
# ============================================

echo ""
log_info "Checking for ZeroTier..."

if command -v zerotier-cli &>/dev/null; then
    log_success "ZeroTier detected — configuring iptables for Docker forwarding..."

    # DOCKER-USER chain is the correct insertion point (Docker 17.06+)
    if iptables -L DOCKER-USER >/dev/null 2>&1; then
        iptables -I DOCKER-USER -i zt+ -j ACCEPT 2>/dev/null && \
            log_success "iptables: ZeroTier (zt+) → DOCKER-USER ACCEPT rule added" || \
            log_warn "Could not add iptables rule (try running as root)"
    else
        iptables -I FORWARD -i zt+ -j ACCEPT 2>/dev/null && \
            log_success "iptables: ZeroTier (zt+) → FORWARD ACCEPT rule added" || \
            log_warn "Could not add iptables rule (try running as root)"
    fi

    ZT_IP=$(zerotier-cli listnetworks 2>/dev/null | awk 'NR>1 {print $NF}' | grep -v '-' | head -1)
    if [ -n "$ZT_IP" ]; then
        log_success "ZeroTier access: http://${ZT_IP%/*}:31337"
    fi

    echo ""
    log_info "To persist iptables rules across reboots:"
    echo "     sudo apt-get install -y iptables-persistent"
    echo "     sudo netfilter-persistent save"
else
    log_info "ZeroTier not detected. See README.md § 'Remote Access via ZeroTier' to enable later."
fi

# ============================================
# 6. Display Success Message
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

log_success "Ready to go!"
