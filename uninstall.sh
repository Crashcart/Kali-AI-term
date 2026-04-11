#!/bin/bash

PROJECT_DIR="${KALI_AI_TERM_DIR:-$HOME/Kali-AI-term}"
if [ -d "$PROJECT_DIR" ]; then
    cd "$PROJECT_DIR"
fi

SCRIPT_ROOT="$(pwd)"

set -e
export PS4='+ [${BASH_SOURCE##*/}:${LINENO}] '
set -x

echo "💉 ═══════════════════════════════════════════════════════════════════ 💉"
echo "    Kali Hacker Bot - Uninstall"
echo "💉 ═══════════════════════════════════════════════════════════════════ 💉"
echo ""

read -p "⚠️  This will completely remove Kali Hacker Bot. Continue? (y/N) " -n 1 -r
echo ""
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Cancelled."
    exit 0
fi

echo ""
echo "✓ Removing containers..."
COMPOSE_PROJECT="$(basename "$SCRIPT_ROOT" | tr '[:upper:]' '[:lower:]' | tr -cs 'a-z0-9' '-')"

docker compose down --volumes --remove-orphans 2>/dev/null || docker-compose down --volumes --remove-orphans 2>/dev/null || true

# Remove known legacy/current container names and compose-name patterns.
CONTAINER_IDS="$(docker ps -aq \
    --filter "name=^/kali-ai-term-app$" \
    --filter "name=^/kali-ai-term-kali$" \
    --filter "name=^/Kali-AI-app$" \
    --filter "name=^/Kali-AI-linux$" \
    --filter "name=^/${COMPOSE_PROJECT}-app-" \
    --filter "name=^/${COMPOSE_PROJECT}-kali-" \
    --filter "name=^/${COMPOSE_PROJECT}_app_" \
    --filter "name=^/${COMPOSE_PROJECT}_kali_" | tr '\n' ' ')"

if [ -n "$CONTAINER_IDS" ]; then
        docker rm -f $CONTAINER_IDS >/dev/null 2>&1 || true
fi

# Remove known compose networks if left behind.
docker network rm "${COMPOSE_PROJECT}-net" "${COMPOSE_PROJECT}_default" "kali-ai-term-net" >/dev/null 2>&1 || true

echo "  ✓ Containers and networks removed"

echo "✓ Removing configuration..."
[ -f .env ] && rm -f .env && echo "  ✓ .env removed" || echo "  ✓ .env not found"
[ -f .env.backup ] && rm -f .env.backup && echo "  ✓ .env.backup removed" || echo "  ✓ .env.backup not found"

echo "✓ Removing dependencies..."
[ -d node_modules ] && rm -rf node_modules && echo "  ✓ node_modules removed" || echo "  ✓ node_modules not found"

echo "✓ Removing data..."
[ -d data ] && rm -rf data && echo "  ✓ data directory removed" || echo "  ✓ data directory not found"
[ -d logs ] && rm -rf logs && echo "  ✓ logs directory removed" || echo "  ✓ logs directory not found"
find . -maxdepth 1 -type d -name 'diagnostic-logs-*' -exec rm -rf {} + && echo "  ✓ diagnostic log directories removed" || true
find . -maxdepth 1 -type f -name 'diagnostic-*.txt' -delete && echo "  ✓ diagnostic report files removed" || true
find . -maxdepth 1 -type f -name 'install-*.log' -delete && echo "  ✓ install log files removed" || true
find . -maxdepth 1 -type f -name 'update-*.log' -delete && echo "  ✓ update log files removed" || true
find . -maxdepth 1 -type d -name '.backup-*' -exec rm -rf {} + && echo "  ✓ backup directories removed" || true
[ -f install.diagnostic ] && rm -f install.diagnostic && echo "  ✓ install.diagnostic removed" || true
[ -f install-full.diagnostic ] && rm -f install-full.diagnostic && echo "  ✓ install-full.diagnostic removed" || true
[ -f update.diagnostic ] && rm -f update.diagnostic && echo "  ✓ update.diagnostic removed" || true
[ -d .cache ] && rm -rf .cache && echo "  ✓ .cache removed" || true

echo ""
echo "💉 ═══════════════════════════════════════════════════════════════════ 💉"
echo "    ✓ Uninstall Complete!"
echo "💉 ═══════════════════════════════════════════════════════════════════ 💉"
echo ""
echo "✓ All data has been removed"
echo "✓ Docker containers stopped and removed"
echo "✓ Configuration and dependencies deleted"

read -p "🗑️  Remove project directory too (including .git)? (y/N) " -n 1 -r
echo ""
if [[ $REPLY =~ ^[Yy]$ ]]; then
    PARENT_DIR="$(dirname "$SCRIPT_ROOT")"
    cd "$PARENT_DIR"
    rm -rf "$SCRIPT_ROOT"
    echo "✓ Project directory removed: $SCRIPT_ROOT"
else
    echo "✓ Project directory preserved: $SCRIPT_ROOT"
fi

echo ""
echo "To reinstall:"
echo "    bash <(curl -fsSL https://raw.githubusercontent.com/Crashcart/Kali-AI-term/main/install.sh)"
echo ""
