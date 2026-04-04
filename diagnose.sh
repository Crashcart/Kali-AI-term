#!/bin/bash

# Comprehensive Diagnostic Script for Kali Hacker Bot
# Collects all system and Docker information for troubleshooting

PROJECT_DIR="${KALI_AI_TERM_DIR:-$HOME/Kali-AI-term}"
if [ -d "$PROJECT_DIR" ]; then
    cd "$PROJECT_DIR"
fi

export PS4='+ [${BASH_SOURCE##*/}:${LINENO}] '
set -x

DIAGNOSTIC_FILE="diagnostic-report-$(date +%Y-%m-%d-%H-%M-%S).txt"

echo "🔍 Collecting diagnostic information..."
echo "Report will be saved to: $DIAGNOSTIC_FILE"
echo ""

{
    echo "╔════════════════════════════════════════════════════════════╗"
    echo "║  Kali Hacker Bot - Diagnostic Report                      ║"
    echo "╚════════════════════════════════════════════════════════════╝"
    echo ""
    echo "Generated: $(date)"
    echo ""

    # ============================================
    # SYSTEM INFORMATION
    # ============================================
    echo "═══ SYSTEM INFORMATION ═══"
    echo "OS: $(uname -s)"
    echo "Kernel: $(uname -r)"
    echo "Architecture: $(uname -m)"
    echo "Hostname: $(hostname)"
    echo "Current User: $(whoami)"
    echo "User Groups: $(groups)"
    echo "Current Directory: $(pwd)"
    echo ""

    # ============================================
    # DOCKER INSTALLATION
    # ============================================
    echo "═══ DOCKER INSTALLATION ═══"
    if command -v docker &>/dev/null; then
        echo "✓ Docker installed"
        docker --version
        which docker
    else
        echo "✗ Docker NOT found in PATH"
    fi
    echo ""

    # ============================================
    # DOCKER DAEMON STATUS
    # ============================================
    echo "═══ DOCKER DAEMON STATUS ═══"
    if docker ps &>/dev/null 2>&1; then
        echo "✓ Docker daemon is RUNNING"
        docker info | head -20
    else
        echo "✗ Docker daemon is NOT responding"
        echo "Error: $(docker ps 2>&1)"
    fi
    echo ""

    # ============================================
    # DOCKER SOCKET
    # ============================================
    echo "═══ DOCKER SOCKET ═══"
    if [ -S /var/run/docker.sock ]; then
        echo "✓ Docker socket exists: /var/run/docker.sock"
        ls -lah /var/run/docker.sock
    else
        echo "✗ Docker socket NOT found at /var/run/docker.sock"
        echo "Checking alternative locations..."
        find / -name "docker.sock" 2>/dev/null || echo "  Not found"
    fi
    echo ""

    # ============================================
    # DOCKER COMPOSE
    # ============================================
    echo "═══ DOCKER COMPOSE ═══"
    if command -v docker-compose &>/dev/null; then
        echo "✓ docker-compose command available"
        docker-compose --version
    else
        echo "✗ docker-compose command NOT found"
    fi

    if docker compose version &>/dev/null 2>&1; then
        echo "✓ docker compose (v2) available"
        docker compose version
    else
        echo "✗ docker compose (v2) NOT available"
    fi
    echo ""

    # ============================================
    # NODE.JS & NPM
    # ============================================
    echo "═══ NODE.JS & NPM ═══"
    if command -v node &>/dev/null; then
        echo "✓ Node.js installed"
        node --version
    else
        echo "✗ Node.js NOT found"
    fi

    if command -v npm &>/dev/null; then
        echo "✓ npm installed"
        npm --version
    else
        echo "✗ npm NOT found"
    fi
    echo ""

    # ============================================
    # PROJECT FILES
    # ============================================
    echo "═══ PROJECT FILES ═══"
    echo "Checking required files:"
    [ -f docker-compose.yml ] && echo "✓ docker-compose.yml" || echo "✗ docker-compose.yml MISSING"
    [ -f .env ] && echo "✓ .env exists" || echo "✗ .env MISSING"
    [ -f Dockerfile ] && echo "✓ Dockerfile" || echo "✗ Dockerfile MISSING"
    [ -d lib ] && echo "✓ lib/ directory" || echo "✗ lib/ MISSING"
    [ -d node_modules ] && echo "✓ node_modules/" || echo "✗ node_modules/ MISSING"
    [ -f package.json ] && echo "✓ package.json" || echo "✗ package.json MISSING"
    echo ""

    # ============================================
    # DOCKER-COMPOSE CONFIG
    # ============================================
    echo "═══ DOCKER-COMPOSE VALIDATION ═══"
    if command -v docker-compose &>/dev/null || docker compose version &>/dev/null 2>&1; then
        echo "Validating docker-compose.yml..."
        (docker-compose config 2>/dev/null || docker compose config 2>/dev/null) | head -50
    else
        echo "Cannot validate - docker-compose not available"
    fi
    echo ""

    # ============================================
    # .ENV CONFIGURATION
    # ============================================
    echo "═══ CONFIGURATION (.env) ═══"
    if [ -f .env ]; then
        echo "✓ .env file found:"
        cat .env | grep -v "^#" | grep -v "^$"
    else
        echo "✗ .env file NOT found"
    fi
    echo ""

    # ============================================
    # EXISTING CONTAINERS
    # ============================================
    echo "═══ DOCKER CONTAINERS ═══"
    if docker ps -a &>/dev/null 2>&1; then
        echo "All containers (running and stopped):"
        docker ps -a --format "table {{.Names}}\t{{.Status}}\t{{.Image}}\t{{.Ports}}"
    else
        echo "Cannot list containers - Docker not responding"
    fi
    echo ""

    # ============================================
    # DOCKER IMAGES
    # ============================================
    echo "═══ DOCKER IMAGES ═══"
    if docker images &>/dev/null 2>&1; then
        echo "Available images:"
        docker images --format "table {{.Repository}}\t{{.Tag}}\t{{.Size}}"
    else
        echo "Cannot list images - Docker not responding"
    fi
    echo ""

    # ============================================
    # PORT AVAILABILITY
    # ============================================
    echo "═══ PORT AVAILABILITY ═══"
    for port in 3000 31337 11434; do
        echo "Port $port:"
        if command -v nc &>/dev/null; then
            nc -zv 127.0.0.1 $port 2>&1 || echo "  (port available)"
        elif command -v netstat &>/dev/null; then
            netstat -tulpn 2>/dev/null | grep ":$port " || echo "  (port available)"
        else
            echo "  (cannot check - nc/netstat not available)"
        fi
    done
    echo ""

    # ============================================
    # INSTALLATION LOGS
    # ============================================
    echo "═══ INSTALLATION LOGS ═══"
    if [ -f install.log ]; then
        echo "Last 50 lines of install.log:"
        tail -50 install.log
    else
        echo "No install.log found"
    fi
    echo ""

    # ============================================
    # DIAGNOSTIC JSON
    # ============================================
    echo "═══ DIAGNOSTIC JSON ═══"
    if [ -f install.diagnostic ]; then
        echo "install.diagnostic contents:"
        cat install.diagnostic
    else
        echo "No install.diagnostic found"
    fi
    echo ""

    # ============================================
    # DOCKER DAEMON LOGS (if available)
    # ============================================
    echo "═══ DOCKER DAEMON LOGS ═══"
    if command -v journalctl &>/dev/null; then
        echo "Last 30 lines of Docker daemon logs:"
        journalctl -u docker --no-pager -n 30 2>/dev/null || echo "  (could not read logs)"
    elif [ -f /var/log/docker.log ]; then
        echo "Last 30 lines of /var/log/docker.log:"
        tail -30 /var/log/docker.log
    else
        echo "Docker daemon logs not accessible"
    fi
    echo ""

    # ============================================
    # NETWORK INFORMATION
    # ============================================
    echo "═══ NETWORK INFORMATION ═══"
    echo "Network interfaces:"
    ip addr show 2>/dev/null || ifconfig 2>/dev/null || echo "  (could not determine)"
    echo ""
    echo "DNS resolution:"
    cat /etc/resolv.conf 2>/dev/null | grep nameserver || echo "  (could not determine)"
    echo ""

    # ============================================
    # DISK SPACE
    # ============================================
    echo "═══ DISK SPACE ═══"
    df -h . 2>/dev/null || du -sh . 2>/dev/null || echo "  (could not determine)"
    echo ""

    # ============================================
    # MEMORY & CPU
    # ============================================
    echo "═══ SYSTEM RESOURCES ═══"
    echo "Memory:"
    free -h 2>/dev/null || vm_stat 2>/dev/null || echo "  (could not determine)"
    echo ""
    echo "CPU:"
    nproc 2>/dev/null && echo "  cores available"
    echo ""

    # ============================================
    # ENVIRONMENT VARIABLES
    # ============================================
    echo "═══ RELEVANT ENVIRONMENT VARIABLES ═══"
    echo "PATH: $PATH"
    echo "DOCKER_HOST: ${DOCKER_HOST:-not set}"
    echo "DOCKER_SOCKET: ${DOCKER_SOCKET:-not set}"
    echo "HOME: $HOME"
    echo ""

    echo "═══ END OF DIAGNOSTIC REPORT ═══"
    echo "Generated: $(date)"

} 2>&1 | tee "$DIAGNOSTIC_FILE"

echo ""
echo "✓ Diagnostic report saved to: $DIAGNOSTIC_FILE"
echo ""
echo "Share this file with support to help diagnose the issue:"
echo "  cat $DIAGNOSTIC_FILE"
echo ""
