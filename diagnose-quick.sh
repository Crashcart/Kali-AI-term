#!/bin/bash

# Quick Diagnostic - Fast checks for immediate issues

PROJECT_DIR="${KALI_AI_TERM_DIR:-$HOME/Kali-AI-term}"
if [ -d "$PROJECT_DIR" ]; then
    cd "$PROJECT_DIR"
fi

REPORT_FILE="diagnostic-quick-$(date +%Y-%m-%d-%H-%M-%S).txt"
exec > >(tee "$REPORT_FILE")
exec 2>&1

echo "🔍 Quick Diagnostic Check"
echo "════════════════════════════════════════"
echo ""

# Docker daemon
if docker ps &>/dev/null 2>&1; then
    echo "✓ Docker daemon: RUNNING"
else
    echo "✗ Docker daemon: NOT RESPONDING"
    echo "  Error: $(docker ps 2>&1 | head -1)"
    echo ""
    echo "Troubleshooting:"
    echo "  1. Check if Docker daemon is running"
    echo "  2. Linux: sudo systemctl start docker"
    echo "  3. Mac: Open Docker Desktop application"
    echo "  4. Windows: Open Docker Desktop"
    exit 1
fi
echo ""

# Docker socket
if [ -S /var/run/docker.sock ]; then
    echo "✓ Docker socket: OK"
else
    echo "⚠ Docker socket: Not found at /var/run/docker.sock"
fi
echo ""

# Node.js
if command -v node &>/dev/null; then
    echo "✓ Node.js: $(node --version)"
else
    echo "✗ Node.js: NOT FOUND"
fi
echo ""

# Docker Compose
if docker compose version &>/dev/null 2>&1; then
    echo "✓ Docker Compose (v2): OK"
elif command -v docker-compose &>/dev/null; then
    echo "✓ Docker Compose: OK (legacy)"
else
    echo "✗ Docker Compose: NOT FOUND"
fi
echo ""

# .env file
if [ -f .env ]; then
    echo "✓ Configuration (.env): EXISTS"
    echo "  KALI_CONTAINER=$(grep KALI_CONTAINER .env | cut -d= -f2)"
    echo "  PORT=$(grep '^PORT=' .env | cut -d= -f2)"
else
    echo "⚠ Configuration (.env): MISSING"
fi
echo ""

# Containers
echo "Containers:"
docker ps -a --format "table {{.Names}}\t{{.Status}}" 2>/dev/null || echo "  (cannot list)"
echo ""

echo "════════════════════════════════════════"
echo "Status: OK - Ready to install" || echo "Status: Issues found - see above"
echo ""
echo "Report saved to: $REPORT_FILE"
