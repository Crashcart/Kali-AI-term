#!/bin/bash

set -e

echo "💉 ═══════════════════════════════════════════════════════════════════ 💉"
echo "    Kali Hacker Bot - Update"
echo "💉 ═══════════════════════════════════════════════════════════════════ 💉"
echo ""

echo "✓ Updating source files..."
if [ -d .git ]; then
	git pull --ff-only && echo "  ✓ Code updated from git" || echo "  ⚠ Git pull failed, continuing with local files"
else
	echo "  ⚠ Not a git repository; pulling core files from branch fix/issue-41"
	curl -fsSL https://raw.githubusercontent.com/Crashcart/Kali-AI-term/fix/issue-41/docker-compose.yml -o docker-compose.yml
	curl -fsSL https://raw.githubusercontent.com/Crashcart/Kali-AI-term/fix/issue-41/Dockerfile -o Dockerfile
	curl -fsSL https://raw.githubusercontent.com/Crashcart/Kali-AI-term/fix/issue-41/server.js -o server.js
	echo "  ✓ Core files refreshed"
fi

echo ""
echo "✓ Pulling latest Docker base images..."
docker pull kalilinux/kali-rolling:latest && echo "  ✓ kali-rolling updated" || echo "  ⚠ Could not pull kali-rolling (check network/Docker daemon)"

echo ""
echo "✓ Validating docker-compose configuration..."
docker compose config >/dev/null 2>&1 || docker-compose config >/dev/null 2>&1
echo "  ✓ docker-compose.yml is valid"

echo ""
echo "✓ Rebuilding app container (no cache)..."
docker compose build --no-cache app 2>/dev/null || docker-compose build --no-cache app 2>/dev/null
echo "  ✓ App container rebuilt"

echo ""
echo "✓ Restarting services..."
docker compose down --remove-orphans 2>/dev/null || docker-compose down --remove-orphans 2>/dev/null || true
docker compose up -d --build --force-recreate 2>/dev/null || docker-compose up -d --build --force-recreate 2>/dev/null
echo "  ✓ Services restarted"

echo ""
echo "💉 ═══════════════════════════════════════════════════════════════════ 💉"
echo "    ✓ Update Complete!"
echo "💉 ═══════════════════════════════════════════════════════════════════ 💉"
echo ""
echo "✓ Kali Hacker Bot is running with the latest images"
echo "✓ Access: http://localhost:31337"
echo ""
