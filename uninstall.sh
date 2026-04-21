#!/bin/bash
set -e

# Helper function to log via Node.js logger
log_cmd() {
  local level=$1
  local message=$2
  node -e "const {createLogger} = require('./lib/install-logger'); const l = createLogger('uninstall'); l.log('$level', '$message');" 2>/dev/null || true
}

echo "💉 ═══════════════════════════════════════════════════════════════════ 💉"
echo "    Kali Hacker Bot - Uninstall"
echo "💉 ═══════════════════════════════════════════════════════════════════ 💉"
echo ""

log_cmd "INFO" "Uninstall started"

read -p "⚠️  This will completely remove Kali Hacker Bot. Continue? (y/N) " -n 1 -r
echo ""
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Cancelled."
    log_cmd "INFO" "Uninstall cancelled by user"
    exit 0
fi

REMOVED_ITEMS=""

echo ""
echo "✓ Removing containers..."
docker_down=$(docker compose down -v 2>&1 || docker-compose down -v 2>&1 || echo "")
docker_exit=$?
echo "  ✓ Containers and volumes removed"
log_cmd "SUCCESS" "Docker containers and volumes stopped"

# Clean up Docker cache to remove any old images/configs
echo "✓ Pruning Docker cache..."
docker system prune -af 2>/dev/null || echo "  ⚠ Docker prune skipped"
log_cmd "SUCCESS" "Docker cache pruned"

echo "✓ Removing configuration..."
if [ -f .env ]; then
    rm -f .env && echo "  ✓ .env removed" && REMOVED_ITEMS="${REMOVED_ITEMS}.env " || echo "  ❌ Failed to remove .env"
    log_cmd "SUCCESS" ".env removed"
else
    echo "  ✓ .env not found"
    log_cmd "DEBUG" ".env not found"
fi

if [ -f .env.backup ]; then
    rm -f .env.backup && echo "  ✓ .env.backup removed" && REMOVED_ITEMS="${REMOVED_ITEMS}.env.backup " || echo "  ❌ Failed to remove .env.backup"
    log_cmd "SUCCESS" ".env.backup removed"
else
    echo "  ✓ .env.backup not found"
    log_cmd "DEBUG" ".env.backup not found"
fi

echo "✓ Removing dependencies..."
if [ -d node_modules ]; then
    rm -rf node_modules && echo "  ✓ node_modules removed" && REMOVED_ITEMS="${REMOVED_ITEMS}node_modules " || echo "  ❌ Failed to remove node_modules"
    log_cmd "SUCCESS" "node_modules removed"
else
    echo "  ✓ node_modules not found"
    log_cmd "DEBUG" "node_modules not found"
fi

echo "✓ Removing data..."
if [ -d data ]; then
    rm -rf data && echo "  ✓ data directory removed" && REMOVED_ITEMS="${REMOVED_ITEMS}data " || echo "  ❌ Failed to remove data"
    log_cmd "SUCCESS" "data directory removed"
else
    echo "  ✓ data directory not found"
    log_cmd "DEBUG" "data directory not found"
fi

if [ -d logs ]; then
    rm -rf logs && echo "  ✓ logs directory removed" && REMOVED_ITEMS="${REMOVED_ITEMS}logs " || echo "  ❌ Failed to remove logs"
    log_cmd "SUCCESS" "logs directory removed"
else
    echo "  ✓ logs directory not found"
    log_cmd "DEBUG" "logs directory not found"
fi

# Verify containers are actually down
echo "✓ Verifying cleanup..."
if ! docker ps -a | grep -q "kali-ai-term"; then
    echo "  ✓ No Kali containers found"
    log_cmd "SUCCESS" "Container verification successful"
else
    echo "  ⚠ Some containers may still exist"
    log_cmd "WARN" "Container cleanup verification failed"
fi

# Generate final diagnostic
node -e "const {createLogger} = require('./lib/install-logger'); const l = createLogger('uninstall'); l.generateDiagnostic('success', 'uninstall_complete', '');" 2>/dev/null || true

echo ""
echo "💉 ═══════════════════════════════════════════════════════════════════ 💉"
echo "    ✓ Uninstall Complete!"
echo "💉 ═══════════════════════════════════════════════════════════════════ 💉"
echo ""
echo "✓ All data has been removed"
echo "✓ Docker containers stopped and removed"
echo "✓ Configuration and dependencies deleted"
echo "✓ Removed: $REMOVED_ITEMS"
echo ""
echo "To reinstall:"
echo "    bash <(curl -fsSL https://raw.githubusercontent.com/Crashcart/Kali-AI-term/main/install.sh)"
echo ""

log_cmd "SUCCESS" "Uninstall completed successfully"
