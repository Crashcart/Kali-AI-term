#!/bin/bash

# PROJECT MANAGER COMMAND CENTER
# Central hub for all project management, team tracking, and performance monitoring
# PM runs this to stay on top of everything without being slammed

set -e

COMMAND="${1:-help}"

# Colors
BLUE='\033[0;34m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

log_info() { echo -e "${BLUE}ℹ${NC}  $1"; }
log_success() { echo -e "${GREEN}✓${NC}  $1"; }
log_warn() { echo -e "${YELLOW}⚠${NC}  $1"; }
log_error() { echo -e "${RED}✗${NC}  $1"; }

show_help() {
  cat << 'EOF'

╔════════════════════════════════════════════════════════════════╗
║           PROJECT MANAGER COMMAND CENTER (pm)                 ║
║   Central hub for projects, teams, and performance tracking   ║
╚════════════════════════════════════════════════════════════════╝

QUICK START (3-5 min per project):
  pm status [project]           Show current project health
  pm report [project]           Generate performance report
  pm team [project]             Check team composition
  pm bugs [project]             Review bug fixes and issues
  pm hire [project]             Request hiring candidates

PROJECT SETUP:
  pm init <project-path>        Set up new project infrastructure
  pm scan <path>                Find and assess repositories

ONGOING MANAGEMENT:
  pm checkin [project]          Quick health check (2-3 min)
  pm track [project]            Update tracking metrics
  pm suggest [project]          Get improvement suggestions

REPORTING (PM USE):
  pm report [project]           Generate markdown report
  pm export [project]           Export for sharing with team

TEAM MANAGEMENT:
  pm team add <project> <role>  Add team member
  pm team remove <project> <role> Remove team member
  pm hire <project>             Get hiring recommendations

CONFIGURATION:
  pm config                     Show configuration
  pm config set <key> <value>   Update settings

OTHER:
  pm help                       This help message
  pm version                    Show version
  pm about                      About PM Center

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

TYPICAL PM WORKFLOW (per project, 3-5 min):

  1. START: pm status <project>
     ↓ Get quick overview of health

  2. IF ISSUES: pm bugs <project>
     ↓ Review what was fixed, what's broken

  3. IF HIRING NEEDED: pm hire <project>
     ↓ Get candidates to send to management

  4. MONTHLY: pm report <project>
     ↓ Share findings with team and stakeholders

  5. END: Done. Next project.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

KEY PRINCIPLE:
  PM should spend 3-5 minutes per project per checkin.
  Use 'pm checkin' for quick health checks.
  Use 'pm report' only when needed (share with team).
  Don't generate reports obsessively - focus on action.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

PROJECTS CONFIGURED:
  kali-ai-term    Status: Active    Team: 3+    Health: Good
  [Add more with: pm init <path>]

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

For specific help on any command:
  pm help <command>

Examples:
  pm help status
  pm help team
  pm help report

EOF
}

show_status() {
  PROJECT="${1:-.}"

  if [ ! -d "$PROJECT/.git" ]; then
    log_error "Not a git repository: $PROJECT"
    return 1
  fi

  PROJECT_NAME=$(basename "$PROJECT")

  echo ""
  echo -e "${BLUE}╔════════════════════════════════════════════════════════╗${NC}"
  echo -e "${BLUE}║${NC}  PROJECT STATUS: $PROJECT_NAME"
  echo -e "${BLUE}╚════════════════════════════════════════════════════════╝${NC}"
  echo ""

  cd "$PROJECT"

  # Basic info
  BRANCH=$(git rev-parse --abbrev-ref HEAD 2>/dev/null)
  COMMITS=$(git rev-list --count HEAD 2>/dev/null)
  LAST_COMMIT=$(git log -1 --pretty=format:"%h %s (%ai)" 2>/dev/null)
  UNCOMMITTED=$(git status --porcelain 2>/dev/null | wc -l)
  STASHES=$(git stash list 2>/dev/null | wc -l)

  echo "Branch: $BRANCH"
  echo "Total commits: $COMMITS"
  echo "Last commit: $LAST_COMMIT"
  echo ""

  if [ "$UNCOMMITTED" -eq 0 ]; then
    log_success "No uncommitted changes"
  else
    log_warn "Uncommitted changes: $UNCOMMITTED files"
  fi

  if [ "$STASHES" -eq 0 ]; then
    log_success "No git stashes"
  else
    log_warn "Git stashes pending: $STASHES"
  fi

  # Check for quality files
  echo ""
  echo "Quality checklist:"
  [ -f README.md ] && log_success "README.md" || log_warn "README.md (MISSING)"
  [ -f package.json ] && log_success "package.json" || log_warn "package.json"
  [ -d tests ] && log_success "Tests configured" || log_warn "Tests (MISSING)"
  [ -f .github/workflows/*.yml ] && log_success "CI/CD configured" || log_warn "CI/CD (NOT FOUND)"

  echo ""
  log_info "Quick health: $(if [ "$UNCOMMITTED" -eq 0 ] && [ "$STASHES" -eq 0 ]; then echo "GOOD"; else echo "NEEDS ATTENTION"; fi)"
  echo ""
}

show_team() {
  PROJECT="${1:-.}"

  if [ ! -d "$PROJECT/.pm/team.json" ]; then
    log_warn "No team configuration found for $PROJECT"
    echo "Run: pm team add <project> <role>"
    return
  fi

  echo "Team for $PROJECT:"
  cat "$PROJECT/.pm/team.json" 2>/dev/null || echo "  (no team configured)"
}

show_bugs() {
  PROJECT="${1:-.}"

  cd "$PROJECT"

  echo ""
  echo -e "${BLUE}Bug Fixes & Issues${NC}"
  echo ""

  # Get commits with "fix:" prefix
  FIX_COMMITS=$(git log --grep="^fix:" --oneline 2>/dev/null | wc -l)
  RECENT_FIXES=$(git log --grep="^fix:" --oneline -5 2>/dev/null || true)

  echo "Total bug fixes: $FIX_COMMITS"
  echo ""

  if [ -n "$RECENT_FIXES" ]; then
    echo "Recent fixes:"
    echo "$RECENT_FIXES" | sed 's/^/  - /'
  fi

  echo ""
}

init_project() {
  PROJECT_PATH="${1:-.}"
  PROJECT_NAME=$(basename "$PROJECT_PATH")

  if [ ! -d "$PROJECT_PATH" ]; then
    log_error "Path not found: $PROJECT_PATH"
    return 1
  fi

  log_info "Initializing project: $PROJECT_NAME"

  # Create PM directory structure
  mkdir -p "$PROJECT_PATH/.pm"/{tracking,reports,team,hiring}

  # Create initial files
  cat > "$PROJECT_PATH/.pm/README.md" << 'PMEOF'
# Project Management Tracking

This directory contains PM tracking data for the project.

- **tracking/** — Metrics and performance data
- **reports/** — Generated reports
- **team/** — Team configuration
- **hiring/** — Hiring recommendations

Use `pm` commands to manage this data.
PMEOF

  cat > "$PROJECT_PATH/.pm/team.json" << 'PMEOF'
{
  "project": "PROJECT_NAME",
  "team": [],
  "roles_needed": [],
  "last_updated": "2026-05-30"
}
PMEOF

  log_success "Project infrastructure created"
  log_info "Folder structure:"
  echo "  .pm/tracking/  — metrics"
  echo "  .pm/reports/   — reports"
  echo "  .pm/team/      — team config"
  echo "  .pm/hiring/    — hiring data"
}

case "$COMMAND" in
  help)
    show_help
    ;;
  status)
    show_status "${2:-.}"
    ;;
  team)
    show_team "${2:-.}"
    ;;
  bugs)
    show_bugs "${2:-.}"
    ;;
  init)
    init_project "$2"
    ;;
  *)
    log_error "Unknown command: $COMMAND"
    echo ""
    echo "Run 'pm help' for list of commands"
    exit 1
    ;;
esac
