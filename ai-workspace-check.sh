#!/bin/bash

# AI Workspace Maintenance Script
# Periodic check to keep .ai-workspace free and unfettered by rules
# No rules enforced, just maintenance

set -e

# Colors
BLUE='\033[0;34m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

# Functions
log_info() { echo -e "${BLUE}ℹ${NC}  $1"; }
log_success() { echo -e "${GREEN}✓${NC}  $1"; }
log_warn() { echo -e "${YELLOW}⚠${NC}  $1"; }
log_error() { echo -e "${RED}✗${NC}  $1"; }

echo ""
echo -e "${BLUE}╔════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║${NC}  AI Workspace Maintenance"
echo -e "${BLUE}║${NC}  Keep it free. No rules enforcement."
echo -e "${BLUE}╚════════════════════════════════════════════════════════╝${NC}"
echo ""

# 1. Check workspace exists
if [ ! -d .ai-workspace ]; then
  log_error ".ai-workspace not found"
  exit 1
fi

log_success "AI workspace found"

# 2. Check for rule creep (people trying to enforce structure)
echo ""
log_info "Scanning for rule creep..."

# Look for files that look like rules or restrictions
if find .ai-workspace -name "*RULES*" -o -name "*GUIDELINES*" -o -name "*STANDARDS*" 2>/dev/null | grep -q .; then
  log_warn "Rule files detected - consider if they're necessary"
fi

# Look for excessive folder structure (more than 10 subdirs = rule creep)
SUBDIR_COUNT=$(find .ai-workspace -maxdepth 1 -type d | wc -l)
if [ "$SUBDIR_COUNT" -gt 12 ]; then
  log_warn "Many subdirectories detected ($SUBDIR_COUNT) - consider consolidating if structure is creeping"
fi

# 3. Check git stashes
echo ""
log_info "Checking git stashes..."

STASH_COUNT=$(git stash list | wc -l)
if [ "$STASH_COUNT" -gt 0 ]; then
  echo "Found $STASH_COUNT stash(es):"
  git stash list | sed 's/^/  - /'
  echo ""
  log_warn "Stashed work available - consider if it should be processed or committed"
else
  log_success "No git stashes (workspace clean)"
fi

# 4. Check workspace file sizes
echo ""
log_info "Workspace content summary..."

TOTAL_SIZE=$(du -sh .ai-workspace 2>/dev/null | cut -f1)
FILE_COUNT=$(find .ai-workspace -type f | wc -l)
OLDEST_FILE=$(find .ai-workspace -type f -printf '%T@ %p\n' 2>/dev/null | sort -n | head -1 | cut -d' ' -f2-)
NEWEST_FILE=$(find .ai-workspace -type f -printf '%T@ %p\n' 2>/dev/null | sort -nr | head -1 | cut -d' ' -f2-)

echo "  Total size: $TOTAL_SIZE"
echo "  Files: $FILE_COUNT"
if [ -n "$OLDEST_FILE" ]; then
  echo "  Oldest: $(basename $OLDEST_FILE)"
fi
if [ -n "$NEWEST_FILE" ]; then
  echo "  Newest: $(basename $NEWEST_FILE)"
fi

# 5. Check for dead files (no modifications in 30 days)
echo ""
log_info "Looking for old/inactive files..."

CUTOFF_DATE=$(date -d "30 days ago" +%s 2>/dev/null || date -v-30d +%s 2>/dev/null || echo 0)
OLD_FILES=0

if [ "$CUTOFF_DATE" != "0" ]; then
  while IFS= read -r file; do
    MOD_TIME=$(stat -f%m "$file" 2>/dev/null || stat -c%Y "$file" 2>/dev/null || echo 0)
    if [ "$MOD_TIME" -lt "$CUTOFF_DATE" ]; then
      OLD_FILES=$((OLD_FILES + 1))
    fi
  done < <(find .ai-workspace -type f 2>/dev/null)

  if [ "$OLD_FILES" -gt 0 ]; then
    log_warn "Found $OLD_FILES files not modified in 30+ days"
  fi
fi

# 6. Check for uncommitted workspace changes
echo ""
log_info "Checking git status..."

if [ -d .git ]; then
  UNCOMMITTED=$(git status --porcelain .ai-workspace 2>/dev/null | wc -l)
  if [ "$UNCOMMITTED" -gt 0 ]; then
    log_warn "Found $UNCOMMITTED uncommitted changes in .ai-workspace"
    echo "  Hint: git add .ai-workspace && git commit -m 'ai-workspace: update notes'"
  else
    log_success "All workspace changes committed"
  fi
fi

# 7. Check AI_RESEARCH_NOTES.md
echo ""
log_info "Main notes file status..."

if [ -f AI_RESEARCH_NOTES.md ]; then
  NOTES_SIZE=$(wc -l < AI_RESEARCH_NOTES.md)
  NOTES_LINES=$(grep -c "^###" AI_RESEARCH_NOTES.md || echo "0")
  echo "  Lines: $NOTES_SIZE"
  echo "  Sections: $NOTES_LINES"
  log_success "Main notes file accessible"
else
  log_warn "AI_RESEARCH_NOTES.md not found"
fi

# 8. Recommendations
echo ""
echo -e "${BLUE}Maintenance Recommendations:${NC}"
echo ""

if [ "$STASH_COUNT" -gt 0 ]; then
  echo "  1. Review stashed work:"
  echo "     git stash show -p stash@{0}    # View changes"
  echo "     git stash pop                  # Apply to working tree"
  echo "     git stash drop                 # Remove if not needed"
  echo ""
fi

echo "  2. Commit workspace updates regularly:"
echo "     git add .ai-workspace AI_RESEARCH_NOTES.md"
echo "     git commit -m 'ai-workspace: [brief description]'"
echo ""

echo "  3. Keep the space free:"
echo "     - No hierarchy enforcement"
echo "     - No strict categories"
echo "     - Just helpful organization"
echo ""

echo "  4. For next AI to pick up work:"
echo "     - Check .ai-workspace/ for notes"
echo "     - Check git stash for in-progress work"
echo "     - Read AI_RESEARCH_NOTES.md for context"
echo ""

# 9. Summary
echo ""
echo -e "${BLUE}Workspace Status:${NC}"
echo -e "  ${GREEN}✓${NC} Location: .ai-workspace/"
echo -e "  ${GREEN}✓${NC} Notes: AI_RESEARCH_NOTES.md"
echo -e "  ${GREEN}✓${NC} Size: $TOTAL_SIZE ($FILE_COUNT files)"
if [ "$STASH_COUNT" -gt 0 ]; then
  echo -e "  ${YELLOW}⚠${NC} Stashes: $STASH_COUNT pending"
else
  echo -e "  ${GREEN}✓${NC} Stashes: Clean"
fi

echo ""
echo -e "${BLUE}Next AI should:${NC}"
echo "  1. Read .ai-workspace/ and AI_RESEARCH_NOTES.md"
echo "  2. Check git stash for in-progress work"
echo "  3. Leave clear notes for the next AI"
echo "  4. Commit before stopping"
echo ""

# 10. Show recent activity
echo ""
log_info "Recent workspace activity (last 5 commits):"
git log --oneline --all -5 -- .ai-workspace AI_RESEARCH_NOTES.md 2>/dev/null | sed 's/^/  /' || echo "  (no workspace commits yet)"

echo ""
echo -e "${GREEN}✓ Maintenance check complete${NC}"
echo ""
