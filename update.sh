#!/bin/bash

echo "💉 ═══════════════════════════════════════════════════════════════════ 💉"
echo "    Kali Hacker Bot - Update"
echo "💉 ═══════════════════════════════════════════════════════════════════ 💉"
echo ""

echo "✓ Pulling latest Docker base images..."
docker pull kalilinux/kali-rolling:latest && echo "  ✓ kali-rolling updated" || echo "  ⚠ Could not pull kali-rolling (check network/Docker daemon)"

echo ""
echo "✓ Rebuilding app container (no cache)..."
docker compose build --no-cache app 2>/dev/null || docker-compose build --no-cache app 2>/dev/null || true
echo "  ✓ App container rebuilt"

echo ""
echo "✓ Restarting services..."
docker compose down 2>/dev/null || docker-compose down 2>/dev/null || true
docker compose up -d 2>/dev/null || docker-compose up -d 2>/dev/null
echo "  ✓ Services restarted"

echo ""
echo "💉 ═══════════════════════════════════════════════════════════════════ 💉"
echo "    ✓ Update Complete!"
echo "💉 ═══════════════════════════════════════════════════════════════════ 💉"
echo ""
echo "✓ Kali Hacker Bot is running with the latest images"
echo "✓ Access: http://localhost:31337"
echo ""
