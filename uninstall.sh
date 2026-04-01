#!/bin/bash

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
docker compose down 2>/dev/null || docker-compose down 2>/dev/null || true
echo "  ✓ Containers removed"

echo "✓ Removing configuration..."
[ -f .env ] && rm -f .env && echo "  ✓ .env removed" || echo "  ✓ .env not found"
[ -f .env.backup ] && rm -f .env.backup && echo "  ✓ .env.backup removed" || echo "  ✓ .env.backup not found"

echo "✓ Removing dependencies..."
[ -d node_modules ] && rm -rf node_modules && echo "  ✓ node_modules removed" || echo "  ✓ node_modules not found"

echo "✓ Removing data..."
[ -d data ] && rm -rf data && echo "  ✓ data directory removed" || echo "  ✓ data directory not found"
[ -d logs ] && rm -rf logs && echo "  ✓ logs directory removed" || echo "  ✓ logs directory not found"

echo ""
echo "💉 ═══════════════════════════════════════════════════════════════════ 💉"
echo "    ✓ Uninstall Complete!"
echo "💉 ═══════════════════════════════════════════════════════════════════ 💉"
echo ""
echo "✓ All data has been removed"
echo "✓ Docker containers stopped and removed"
echo "✓ Configuration and dependencies deleted"
echo ""
echo "To reinstall:"
echo "    bash <(curl -fsSL https://raw.githubusercontent.com/Crashcart/Kali-AI-term/main/install.sh)"
echo ""
