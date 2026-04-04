#!/bin/bash

set -e
export PS4='+ [${BASH_SOURCE##*/}:${LINENO}] '
set -x

PROJECT_DIR="${KALI_AI_TERM_DIR:-$HOME/Kali-AI-term}"

if [ ! -d "$PROJECT_DIR" ]; then
	mkdir -p "$PROJECT_DIR"
fi

cd "$PROJECT_DIR"

echo "💉 ═══════════════════════════════════════════════════════════════════ 💉"
echo "    Kali Hacker Bot - Update"
echo "💉 ═══════════════════════════════════════════════════════════════════ 💉"
echo ""

echo "✓ Working directory: $PROJECT_DIR"
echo ""

echo "✓ Updating source files..."
if [ -d .git ]; then
	git pull --ff-only && echo "  ✓ Code updated from git" || echo "  ⚠ Git pull failed, continuing with local files"
else
	echo "  ⚠ Not a git repository; downloading full project snapshot from branch fix/issue-41"
	TMP_DIR=$(mktemp -d)
	curl -fsSL https://codeload.github.com/Crashcart/Kali-AI-term/tar.gz/refs/heads/fix/issue-41 -o "$TMP_DIR/project.tar.gz"
	tar -xzf "$TMP_DIR/project.tar.gz" -C "$TMP_DIR"
	rsync -a --delete \
		--exclude '.env' \
		--exclude 'data/' \
		--exclude '.backup-*' \
		"$TMP_DIR/Kali-AI-term-fix-issue-41/" ./
	rm -rf "$TMP_DIR"
	echo "  ✓ Project files refreshed"
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
