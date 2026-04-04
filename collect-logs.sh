#!/bin/bash

# Collect all Docker and application logs for debugging

PROJECT_DIR="${KALI_AI_TERM_DIR:-$HOME/Kali-AI-term}"
if [ -d "$PROJECT_DIR" ]; then
    cd "$PROJECT_DIR"
fi

export PS4='+ [${BASH_SOURCE##*/}:${LINENO}] '
set -x

REPORT_FILE="diagnostic-logs-$(date +%Y-%m-%d-%H-%M-%S).txt"

write_section() {
    local title="$1"
    echo ""
    echo "=== $title ==="
}

echo "📋 Collecting diagnostic logs..."
echo "Report: $REPORT_FILE"
echo ""

{
    echo "Diagnostic Logs Report"
    echo "Generated: $(date)"
    echo "Project Directory: $(pwd)"

    write_section "Docker Daemon Logs"
    if command -v journalctl &>/dev/null; then
        journalctl -u docker -n 200 --no-pager 2>&1 || echo "Could not read journalctl docker logs"
    elif [ -f /var/log/docker.log ]; then
        tail -200 /var/log/docker.log 2>&1 || true
    else
        echo "Docker daemon logs not accessible"
    fi

    write_section "Docker Info"
    docker info 2>&1 || true

    write_section "Docker Containers"
    docker ps -a 2>&1 || true

    write_section "Docker Images"
    docker images 2>&1 || true

    write_section "Docker Networks"
    docker network ls 2>&1 || true

    write_section "Docker Volumes"
    docker volume ls 2>&1 || true

    write_section "Container Logs"
    for container in $(docker ps -a --format "{{.Names}}" 2>/dev/null); do
        echo "--- $container ---"
        docker logs "$container" 2>&1 || true
        echo ""
    done

    write_section "Application Logs"
    [ -f install.log ] && { echo "--- install.log ---"; cat install.log; echo ""; } || echo "install.log not found"
    [ -f install.diagnostic ] && { echo "--- install.diagnostic ---"; cat install.diagnostic; echo ""; } || echo "install.diagnostic not found"
    [ -f update.log ] && { echo "--- update.log ---"; cat update.log; echo ""; } || echo "update.log not found"
    [ -f .env ] && { echo "--- .env (sanitized) ---"; sed 's/PASSWORD=.*/PASSWORD=***/' .env; echo ""; } || echo ".env not found"
    [ -f docker-compose.yml ] && { echo "--- docker-compose.yml ---"; cat docker-compose.yml; echo ""; } || echo "docker-compose.yml not found"

    write_section "System Information"
    uname -a 2>&1 || true
    docker --version 2>&1 || true
    ls -lah /var/run/docker.sock 2>&1 || true
    df -h 2>&1 || true
    free -h 2>&1 || vm_stat 2>&1 || true

    write_section "Docker Health"
    docker ps 2>&1 || true

    write_section "Network Information"
    ip addr show 2>&1 || ifconfig 2>&1 || true
    cat /etc/resolv.conf 2>&1 || true
    for port in 3000 31337 11434; do
        echo "Port $port:"
        netstat -tulpn 2>/dev/null | grep ":$port " || echo "  Available"
    done
} > "$REPORT_FILE"

echo "✓ Diagnostic logs collected successfully!"
echo "Report: $REPORT_FILE"
echo "Share this file for support."
