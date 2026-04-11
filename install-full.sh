#!/bin/bash

# ============================================
# Kali Hacker Bot - Easy Install Script
# ============================================

set -e
export PS4='+ [${BASH_SOURCE##*/}:${LINENO}] '
set -x

# Stabilize execution context so deleted/invalid cwd does not break install flow.
if ! pwd >/dev/null 2>&1; then
    cd "$HOME" 2>/dev/null || cd /tmp
fi

SOURCE_PATH="${BASH_SOURCE[0]}"
if [[ "$SOURCE_PATH" == /dev/fd/* || "$SOURCE_PATH" == /proc/*/fd/* ]]; then
    log_error() { echo "$1"; }
    log_error "ERROR: install-full.sh should run from a real repository checkout"
    log_error "Run: git clone https://github.com/Crashcart/Kali-AI-term.git && cd Kali-AI-term && bash install-full.sh"
    exit 1
fi

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)"
cd "$SCRIPT_DIR"

for required in docker-compose.yml package.json server.js; do
    if [[ ! -e "$required" ]]; then
        echo "ERROR: Installer must run from a Kali-AI-term repository checkout"
        echo "Missing required file: $required"
        exit 1
    fi
done

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

can_prompt_user() {
    [ -r /dev/tty ] && [ -w /dev/tty ]
}

prompt_line() {
    local prompt_message="$1"
    local result_var="$2"
    local input_value=""

    if can_prompt_user; then
        read -r -p "$prompt_message" input_value < /dev/tty
    fi

    printf -v "$result_var" '%s' "$input_value"
}

prompt_confirm() {
    local prompt_message="$1"
    local response=""

    if can_prompt_user; then
        read -r -p "$prompt_message" -n 1 response < /dev/tty
        echo
        [[ "$response" =~ ^[Yy]$ ]]
        return
    fi

    return 1
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

CREATE_ENV=1
if [ -f .env ]; then
    log_warn ".env file already exists"
    if ! prompt_confirm "    Overwrite? (y/n) "; then
        log_info "Keeping existing .env"
        CREATE_ENV=0
    else
        cp .env .env.backup
        log_success "Backed up to .env.backup"
    fi
fi

if [ "$CREATE_ENV" -eq 1 ]; then
    # Generate secure random values
    AUTH_SECRET=$(node -e "console.log(require('crypto').randomUUID())")
    GENERATED_ADMIN_PASSWORD=$(node -e "console.log(require('crypto').randomBytes(8).toString('hex'))")
    ADMIN_PASSWORD="$GENERATED_ADMIN_PASSWORD"

    # Ask for password from the controlling terminal so streamed installs can still prompt.
    if can_prompt_user; then
        prompt_line "    Enter admin password (press Enter to auto-generate): " USER_ADMIN_PASSWORD
        if [ -n "$USER_ADMIN_PASSWORD" ]; then
            prompt_line "    Confirm admin password: " CONFIRM_ADMIN_PASSWORD
            if [ "$USER_ADMIN_PASSWORD" = "$CONFIRM_ADMIN_PASSWORD" ]; then
                ADMIN_PASSWORD="$USER_ADMIN_PASSWORD"
                log_success "Using custom admin password"
            else
                log_warn "Password confirmation did not match; using generated admin password"
                log_info "Using generated admin password"
            fi
        else
            log_info "Using generated admin password"
        fi
    else
        log_info "Using generated admin password (non-interactive mode)"
    fi

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
    echo -e "${YELLOW}╔════════════════════════════════════════╗${NC}"
    echo -e "${YELLOW}║  SAVE THESE CREDENTIALS NOW           ║${NC}"
    echo -e "${YELLOW}╚════════════════════════════════════════╝${NC}"
    echo -e "${YELLOW}Admin Password:${NC} ${GREEN}$ADMIN_PASSWORD${NC}"
    echo -e "${YELLOW}This password will be required to log in.${NC}"
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
if docker ps | grep -q "kali-ai-term-app" && docker ps | grep -q "kali-ai-term-kali"; then
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
# 6. Auto-pull lightweight default model
# ============================================

OLLAMA_INSTALL_URL=$(grep OLLAMA_URL .env 2>/dev/null | cut -d'=' -f2 || echo "http://localhost:11434")
DEFAULT_LLM="phi3:mini"
log_info "Checking Ollama for installed models..."
OLLAMA_MODELS=$(curl -sf "${OLLAMA_INSTALL_URL}/api/tags" 2>/dev/null || echo "")
if [ -n "$OLLAMA_MODELS" ]; then
  MODEL_COUNT=$(echo "$OLLAMA_MODELS" | node -e "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{try{console.log((JSON.parse(d).models||[]).length)}catch(e){console.log(0)}})" 2>/dev/null || echo "0")
  if [ "$MODEL_COUNT" = "0" ]; then
    log_info "No models found — pulling default lightweight model: $DEFAULT_LLM"
    echo "    This may take a few minutes depending on your connection..."
    if curl -sf "${OLLAMA_INSTALL_URL}/api/pull" -d "{\"name\":\"${DEFAULT_LLM}\",\"stream\":false}" -H "Content-Type: application/json" --max-time 600 >/dev/null 2>&1; then
      log_success "Model $DEFAULT_LLM pulled successfully"
    else
      log_warn "Could not pull model (Ollama may not be running). Pull manually: ollama pull $DEFAULT_LLM"
    fi
  else
    log_success "Ollama already has $MODEL_COUNT model(s) installed"
  fi
else
  log_warn "Ollama not reachable at $OLLAMA_INSTALL_URL — skipping model pull"
  echo "    After starting Ollama, pull a model: ollama pull $DEFAULT_LLM"
fi

# ============================================
# 7. Display Success Message
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
