#!/bin/bash
set -e

# Universal update script for Kali Hacker Bot - supports any branch
# Usage: ./update.sh [branch]
# Examples:
#   ./update.sh              # Updates current branch
#   ./update.sh main         # Switches to and updates main branch
#   ./update.sh test         # Switches to and updates test branch
#   ./update.sh beta         # Switches to and updates beta branch
#   ./update.sh alpha        # Switches to and updates alpha branch
#   ./update.sh custom-branch # Switches to and updates custom-branch

TARGET_BRANCH="${1:-.}"
CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD)

log_cmd() {
  local level=$1
  local message=$2
  node -e "const {createLogger} = require('./lib/install-logger'); const l = createLogger('update'); l.log('$level', '$message');" 2>/dev/null || true
}

echo "💉 ═══════════════════════════════════════════════════════════════════ 💉"
echo "    Kali Hacker Bot - Update"
if [ "$TARGET_BRANCH" != "." ]; then
  echo "    Target Branch: $TARGET_BRANCH"
fi
echo "💉 ═══════════════════════════════════════════════════════════════════ 💉"
echo ""

log_cmd "INFO" "Starting update process..."

# Check if .env exists
if [ ! -f .env ]; then
    echo "❌ Error: .env file not found. Cannot update."
    log_cmd "ERROR" ".env file not found"
    exit 1
fi

# Track system info
node -e "const {createLogger} = require('./lib/install-logger'); const l = createLogger('update'); l.trackSystemInfo();" 2>/dev/null || true
node -e "const {createLogger} = require('./lib/install-logger'); const l = createLogger('update'); l.trackEnvironment();" 2>/dev/null || true

# Handle branch switching if needed
if [ "$TARGET_BRANCH" != "." ]; then
  echo "✓ Preparing branch switch..."

  # Fetch latest branch refs from origin
  echo "  ✓ Fetching latest refs from origin..."
  if ! git fetch origin "$TARGET_BRANCH" 2>/dev/null; then
    echo "  ⚠ Warning: Could not fetch remote branch $TARGET_BRANCH"
    log_cmd "WARN" "Could not fetch branch $TARGET_BRANCH from origin"
  fi

  # Stash any uncommitted changes
  echo "  ✓ Checking for uncommitted changes..."
  if ! git diff --quiet; then
    echo "    - Found uncommitted changes, stashing..."
    git stash push -m "Auto-stash before branch switch on $(date)" > /dev/null 2>&1
    log_cmd "INFO" "Stashed uncommitted changes before branch switch"
  fi

  # Switch to target branch
  echo "  ✓ Switching to branch $TARGET_BRANCH..."
  if git checkout "$TARGET_BRANCH" 2>/dev/null; then
    log_cmd "SUCCESS" "Switched to branch $TARGET_BRANCH"
  else
    echo "  ❌ Error: Could not switch to branch $TARGET_BRANCH"
    log_cmd "ERROR" "Failed to checkout branch $TARGET_BRANCH"
    exit 1
  fi

  # Pull latest code from origin
  echo "  ✓ Pulling latest code from origin..."
  if git pull origin "$TARGET_BRANCH" 2>/dev/null; then
    log_cmd "SUCCESS" "Pulled latest code from $TARGET_BRANCH"
    echo "    - Code updated to latest version"
  else
    echo "  ⚠ Warning: Could not pull latest code"
    log_cmd "WARN" "Could not pull from origin/$TARGET_BRANCH"
  fi
  echo ""
fi

echo "✓ Checking current installation..."
log_cmd "INFO" "Verifying existing installation"

# Check if containers exist
if docker ps -a | grep -q "kali-ai-term-kali"; then
    echo "  ✓ Kali container found"
    log_cmd "SUCCESS" "Kali container exists"
else
    echo "  ❌ Kali container not found"
    log_cmd "ERROR" "Kali container not found - cannot update"
    exit 1
fi

if docker ps -a | grep -q "kali-ai-term-app"; then
    echo "  ✓ App container found"
    log_cmd "SUCCESS" "App container exists"
else
    echo "  ❌ App container not found"
    log_cmd "ERROR" "App container not found - cannot update"
    exit 1
fi

# Stop containers
echo ""
echo "✓ Stopping containers..."
docker_down=$(docker compose down 2>&1 || docker-compose down 2>&1)
docker_down_exit=$?
if [ $docker_down_exit -eq 0 ]; then
    echo "  ✓ Containers stopped"
    log_cmd "SUCCESS" "Containers stopped"
    node -e "const {createLogger} = require('./lib/install-logger'); const l = createLogger('update'); l.trackCommand('docker compose down', 0, '');" 2>/dev/null || true
else
    echo "  ⚠ Warning: docker compose down returned exit code $docker_down_exit"
    log_cmd "WARN" "docker compose down returned non-zero exit code"
fi

# Update dependencies
echo ""
echo "✓ Updating Node.js dependencies..."
npm_output=$(npm install 2>&1)
npm_exit=$?
if [ $npm_exit -eq 0 ]; then
    echo "  ✓ Dependencies updated"
    log_cmd "SUCCESS" "npm install completed"
    node -e "const {createLogger} = require('./lib/install-logger'); const l = createLogger('update'); l.trackCommand('npm install', 0, '');" 2>/dev/null || true
else
    echo "  ❌ npm install failed with exit code $npm_exit"
    log_cmd "ERROR" "npm install failed"
    node -e "const {createLogger} = require('./lib/install-logger'); const l = createLogger('update'); l.trackCommand('npm install', $npm_exit, 'Installation failed');" 2>/dev/null || true
    exit 1
fi

# Start containers
echo ""
echo "✓ Starting containers..."
docker_up=$(docker compose up -d 2>&1 || docker-compose up -d 2>&1)
docker_up_exit=$?
if [ $docker_up_exit -eq 0 ]; then
    echo "  ✓ Containers started"
    log_cmd "SUCCESS" "Containers started"
    node -e "const {createLogger} = require('./lib/install-logger'); const l = createLogger('update'); l.trackCommand('docker compose up -d', 0, '');" 2>/dev/null || true
else
    echo "  ❌ Failed to start containers"
    log_cmd "ERROR" "Docker containers failed to start"
    node -e "const {createLogger} = require('./lib/install-logger'); const l = createLogger('update'); l.trackCommand('docker compose up -d', $docker_up_exit, 'Startup failed');" 2>/dev/null || true
    exit 1
fi

# Health check
echo "✓ Verifying container health..."
KALI_READY=0
APP_READY=0
WAIT_TIME=0
MAX_WAIT=30

while [ $WAIT_TIME -lt $MAX_WAIT ]; do
  if docker ps --format "table {{.Names}}" | grep -q "kali-ai-term-kali"; then
    KALI_READY=1
  fi

  if docker ps --format "table {{.Names}}" | grep -q "kali-ai-term-app"; then
    APP_READY=1
  fi

  if [ $KALI_READY -eq 1 ] && [ $APP_READY -eq 1 ]; then
    echo "  ✓ Containers verified as running"
    log_cmd "SUCCESS" "All containers verified"
    break
  fi

  WAIT_TIME=$((WAIT_TIME + 1))
  sleep 1
done

if [ $KALI_READY -eq 0 ] || [ $APP_READY -eq 0 ]; then
  echo "  ⚠ Warning: Not all containers started within 30 seconds"
  log_cmd "WARN" "Container startup timeout"
fi

# Generate diagnostic report
INSTALL_STATUS="success"
if [ $KALI_READY -eq 0 ] || [ $APP_READY -eq 0 ]; then
  INSTALL_STATUS="partial"
fi

node -e "const {createLogger} = require('./lib/install-logger'); const l = createLogger('update'); l.generateDiagnostic('$INSTALL_STATUS', 'complete', '');" 2>/dev/null || true

echo ""
FINAL_BRANCH=$(git rev-parse --abbrev-ref HEAD)
echo "💉 ═══════════════════════════════════════════════════════════════════ 💉"
echo "    ✓ Update Complete!"
echo "    Current Branch: $FINAL_BRANCH"
echo "💉 ═══════════════════════════════════════════════════════════════════ 💉"
echo ""
echo "✓ Installation updated successfully"
echo ""
echo "Next steps:"
echo "    1. Verify application: http://localhost:31337"
echo "    2. Check container logs: docker compose logs -f app"
echo "    3. Current branch: $FINAL_BRANCH"
echo ""

log_cmd "SUCCESS" "Update completed successfully on branch $FINAL_BRANCH"
