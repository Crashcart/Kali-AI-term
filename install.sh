#!/bin/bash
command -v docker &>/dev/null || { echo "❌ Docker required"; exit 1; }; command -v node &>/dev/null || { echo "❌ Node.js required"; exit 1; }; [ -f .env ] || { AUTH_SECRET=$(node -e "console.log(require('crypto').randomUUID())"); ADMIN_PASSWORD=$(node -e "console.log(require('crypto').randomBytes(8).toString('hex'))"); cat > .env << ENVEOF
NODE_ENV=production
PORT=31337
OLLAMA_URL=http://host.docker.internal:11434
KALI_CONTAINER=kali-linux
ADMIN_PASSWORD=$ADMIN_PASSWORD
AUTH_SECRET=$AUTH_SECRET
LOG_LEVEL=info
ENVEOF
}; [ -d node_modules ] || npm install >/dev/null 2>&1; docker compose down 2>/dev/null || docker-compose down 2>/dev/null || true; docker compose up -d 2>/dev/null || docker-compose up -d 2>/dev/null; sleep 3; echo "✅ http://localhost:31337 | 🔐 $(grep ADMIN_PASSWORD .env | cut -d= -f2)"
