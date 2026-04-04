#!/bin/bash

# Collect targeted Docker and application logs for debugging

PROJECT_DIR="${KALI_AI_TERM_DIR:-$HOME/Kali-AI-term}"
if [ -d "$PROJECT_DIR" ]; then
    cd "$PROJECT_DIR"
fi

export PS4='+ [${BASH_SOURCE##*/}:${LINENO}] '
set -x

REPORT_FILE="diagnostic-logs-$(date +%Y-%m-%d-%H-%M-%S).txt"
PHASE3_LINES=300

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
    echo "Mode: targeted"

    write_section "Phase 1 - Runtime Snapshot"
    docker --version 2>&1 || true
    docker compose version 2>&1 || docker-compose --version 2>&1 || true
    docker compose ps 2>&1 || docker ps -a 2>&1 || true
    docker ps -a --format "table {{.Names}}\t{{.Status}}\t{{.Image}}" 2>&1 || true

    write_section "Phase 2 - Container Status Details"
    for container in kali-ai-term-app kali-ai-term-kali; do
        echo "--- inspect: $container ---"
        docker inspect "$container" --format '{{json .State}}' 2>&1 || echo "Container not found: $container"
        echo ""
    done

    write_section "Phase 3 - Required Debug Logs"
    echo "Collecting only logs required for auth/container triage"

    echo "--- kali-ai-term-app (last ${PHASE3_LINES} lines) ---"
    docker logs --tail "$PHASE3_LINES" kali-ai-term-app 2>&1 || echo "kali-ai-term-app logs unavailable"
    echo ""

    echo "--- kali-ai-term-kali (last ${PHASE3_LINES} lines) ---"
    docker logs --tail "$PHASE3_LINES" kali-ai-term-kali 2>&1 || echo "kali-ai-term-kali logs unavailable"
    echo ""

    [ -f install.log ] && { echo "--- install.log (last ${PHASE3_LINES} lines) ---"; tail -n "$PHASE3_LINES" install.log; echo ""; } || echo "install.log not found"
    [ -f install.diagnostic ] && { echo "--- install.diagnostic ---"; cat install.diagnostic; echo ""; } || echo "install.diagnostic not found"

    if [ -d data/login-error-reports ]; then
        echo "--- data/login-error-reports (latest 5) ---"
        ls -1t data/login-error-reports/*.json 2>/dev/null | head -n 5 | while read -r report; do
            [ -f "$report" ] || continue
            echo "--- $(basename "$report") ---"
            cat "$report"
            echo ""
        done
    else
        echo "data/login-error-reports not found"
    fi

    write_section "Minimal Configuration Context"
    [ -f .env ] && { echo "--- .env (sanitized) ---"; sed -E 's/(ADMIN_PASSWORD|AUTH_SECRET)=.*/\1=***/' .env; echo ""; } || echo ".env not found"
    [ -f docker-compose.yml ] && { echo "--- docker-compose.yml ---"; cat docker-compose.yml; echo ""; } || echo "docker-compose.yml not found"
} > "$REPORT_FILE"

echo "✓ Diagnostic logs collected successfully!"
echo "Report: $REPORT_FILE"
echo "Share this file for support."
echo ""

if [ -t 0 ]; then
    read -r -p "Display report now for copy/paste? [y/N]: " SHOW_REPORT
    if [[ "$SHOW_REPORT" =~ ^[Yy]$ ]]; then
        echo ""
        echo "===== BEGIN $REPORT_FILE ====="
        cat "$REPORT_FILE"
        echo "===== END $REPORT_FILE ====="
    else
        echo "Run: cat $REPORT_FILE"
    fi
fi
