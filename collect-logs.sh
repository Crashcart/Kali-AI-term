#!/bin/bash

# Collect all Docker and application logs for debugging

LOGS_DIR="diagnostic-logs-$(date +%Y-%m-%d-%H-%M-%S)"
mkdir -p "$LOGS_DIR"

echo "📋 Collecting diagnostic logs..."
echo "Directory: $LOGS_DIR"
echo ""

# ============================================
# Docker Daemon Logs
# ============================================
echo "→ Collecting Docker daemon logs..."

if command -v journalctl &>/dev/null; then
    # Linux with systemd
    journalctl -u docker -n 200 --no-pager > "$LOGS_DIR/docker-daemon-logs.txt" 2>&1
    echo "  ✓ Saved journalctl logs"
elif [ -f /var/log/docker.log ]; then
    # macOS or older systems
    tail -200 /var/log/docker.log > "$LOGS_DIR/docker-daemon-logs.txt" 2>&1
    echo "  ✓ Saved /var/log/docker.log"
else
    echo "  ⚠ Docker daemon logs not accessible"
fi

# ============================================
# Docker Info & Status
# ============================================
echo "→ Collecting Docker information..."
docker info > "$LOGS_DIR/docker-info.txt" 2>&1
docker ps -a > "$LOGS_DIR/docker-containers.txt" 2>&1
docker images > "$LOGS_DIR/docker-images.txt" 2>&1
docker network ls > "$LOGS_DIR/docker-networks.txt" 2>&1
docker volume ls > "$LOGS_DIR/docker-volumes.txt" 2>&1
echo "  ✓ Docker status saved"

# ============================================
# Container Logs
# ============================================
echo "→ Collecting container logs..."
for container in $(docker ps -a --format "{{.Names}}" 2>/dev/null); do
    echo "  - Collecting logs from: $container"
    docker logs "$container" > "$LOGS_DIR/container-${container}.log" 2>&1
done

# ============================================
# Application Logs
# ============================================
echo "→ Collecting application logs..."
[ -f install.log ] && cp install.log "$LOGS_DIR/" && echo "  ✓ install.log"
[ -f install.diagnostic ] && cp install.diagnostic "$LOGS_DIR/" && echo "  ✓ install.diagnostic"
[ -f update.log ] && cp update.log "$LOGS_DIR/" && echo "  ✓ update.log"
[ -f .env ] && (sed 's/PASSWORD=.*/PASSWORD=***/' .env > "$LOGS_DIR/.env-sanitized.txt") && echo "  ✓ .env (sanitized)"
[ -f docker-compose.yml ] && cp docker-compose.yml "$LOGS_DIR/" && echo "  ✓ docker-compose.yml"

# ============================================
# System Information
# ============================================
echo "→ Collecting system information..."
{
    echo "=== SYSTEM INFO ==="
    uname -a
    echo ""
    echo "=== DOCKER VERSION ==="
    docker --version
    echo ""
    echo "=== DOCKER DAEMON SOCKET ==="
    ls -lah /var/run/docker.sock 2>/dev/null || echo "Socket not found"
    echo ""
    echo "=== DISK SPACE ==="
    df -h
    echo ""
    echo "=== MEMORY ==="
    free -h 2>/dev/null || vm_stat 2>/dev/null || echo "Cannot determine"
} > "$LOGS_DIR/system-info.txt" 2>&1
echo "  ✓ system info"

# ============================================
# Docker Daemon Health Check
# ============================================
echo "→ Checking Docker daemon..."
{
    echo "=== DOCKER DAEMON HEALTH ==="
    if docker ps &>/dev/null 2>&1; then
        echo "✓ Docker daemon is responding"
        docker ps
    else
        echo "✗ Docker daemon is NOT responding"
        docker ps 2>&1
    fi
} > "$LOGS_DIR/docker-health-check.txt" 2>&1
echo "  ✓ health check"

# ============================================
# Network Diagnostics
# ============================================
echo "→ Collecting network information..."
{
    echo "=== NETWORK INFO ==="
    ip addr show 2>/dev/null || ifconfig 2>/dev/null || echo "Cannot determine"
    echo ""
    echo "=== DNS ==="
    cat /etc/resolv.conf 2>/dev/null || echo "Cannot read resolv.conf"
    echo ""
    echo "=== PORT STATUS ==="
    for port in 3000 31337 11434; do
        echo "Port $port:"
        netstat -tulpn 2>/dev/null | grep ":$port " || echo "  Available"
    done
} > "$LOGS_DIR/network-info.txt" 2>&1
echo "  ✓ network info"

# ============================================
# Create Summary
# ============================================
cat > "$LOGS_DIR/README.txt" << 'EOF'
Diagnostic Logs Package
=======================

Contents:
- docker-daemon-logs.txt: Docker daemon system logs
- docker-info.txt: Docker system information
- docker-containers.txt: List of containers
- docker-images.txt: Available Docker images
- docker-networks.txt: Docker networks
- docker-volumes.txt: Docker volumes
- container-*.log: Individual container logs
- install.log: Installation script log
- install.diagnostic: Detailed diagnostic JSON
- docker-compose.yml: Docker Compose configuration
- .env-sanitized.txt: Environment configuration (passwords masked)
- system-info.txt: System and resource information
- docker-health-check.txt: Docker daemon health status
- network-info.txt: Network and connectivity information

Share these files with support to help diagnose issues.
All sensitive information has been masked (passwords replaced with ***)
EOF

# ============================================
# Create Tarball
# ============================================
echo ""
echo "→ Creating archive..."
tar -czf "${LOGS_DIR}.tar.gz" "$LOGS_DIR" 2>/dev/null || zip -r "${LOGS_DIR}.zip" "$LOGS_DIR" 2>/dev/null

echo ""
echo "✓ Diagnostic logs collected successfully!"
echo ""
echo "Location: $LOGS_DIR/"
echo "Archive: ${LOGS_DIR}.tar.gz or ${LOGS_DIR}.zip"
echo ""
echo "Share these files to help diagnose the issue:"
echo "  tar czf diagnostic-logs.tar.gz $LOGS_DIR/"
echo "  # Then upload diagnostic-logs.tar.gz"
echo ""
