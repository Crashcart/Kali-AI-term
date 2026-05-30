#!/bin/bash

# Multi-Repository Audit Report Generator
# Scan multiple repos and generate a comprehensive quality report

REPORT_FILE="REPO_AUDIT_REPORT.md"
TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')

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

# Create report header
cat > "$REPORT_FILE" << EOF
# Repository Audit Report

**Generated**: $TIMESTAMP
**Repositories Scanned**: $(echo "$@" | wc -w)

---

## Overview

This report provides a quick health check across all specified repositories.

### Quick Summary
| Repo | Status | Issues | Last Commit | Size |
|------|--------|--------|-------------|------|
EOF

echo ""
echo -e "${BLUE}╔════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║${NC}  Multi-Repository Audit Report"
echo -e "${BLUE}║${NC}  Scanning repositories for health and status"
echo -e "${BLUE}╚════════════════════════════════════════════════════════╝${NC}"
echo ""

# Check if repos provided
if [ $# -eq 0 ]; then
  log_error "No repositories provided"
  echo ""
  echo "Usage: $0 <repo1> <repo2> <repo3> ..."
  echo ""
  echo "Examples:"
  echo "  $0 /path/to/repo1 /path/to/repo2"
  echo "  $0 ~/projects/kali-ai-term ~/projects/other-project"
  echo ""
  echo "Or set REPOS environment variable:"
  echo "  REPOS='/repo1 /repo2' $0"
  echo ""
  exit 1
fi

# Audit each repo
REPO_COUNT=0
TOTAL_ISSUES=0

for REPO in "$@"; do
  if [ ! -d "$REPO" ]; then
    log_warn "Repository not found: $REPO"
    continue
  fi

  REPO_COUNT=$((REPO_COUNT + 1))
  REPO_NAME=$(basename "$REPO")

  echo ""
  log_info "Auditing: $REPO_NAME"

  # Get repo info
  cd "$REPO"

  # Check if git repo
  if [ ! -d .git ]; then
    log_error "$REPO_NAME is not a git repository"
    continue
  fi

  # Get basic info
  CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "unknown")
  LAST_COMMIT=$(git log -1 --pretty=format:"%h %s" 2>/dev/null || echo "N/A")
  LAST_COMMIT_DATE=$(git log -1 --pretty=format:"%ai" 2>/dev/null || echo "N/A")
  COMMIT_COUNT=$(git rev-list --count HEAD 2>/dev/null || echo "0")
  REPO_SIZE=$(du -sh . 2>/dev/null | cut -f1)

  # Check status
  UNCOMMITTED=$(git status --porcelain 2>/dev/null | wc -l)
  STASHES=$(git stash list 2>/dev/null | wc -l)
  BRANCHES=$(git branch -a 2>/dev/null | wc -l)
  TAGS=$(git tag -l 2>/dev/null | wc -l)

  # Check for common quality files
  ISSUES=0
  QUALITY_FILES=0

  [ -f README.md ] && QUALITY_FILES=$((QUALITY_FILES + 1))
  [ -f .gitignore ] && QUALITY_FILES=$((QUALITY_FILES + 1))
  [ -f package.json ] && QUALITY_FILES=$((QUALITY_FILES + 1))
  [ -f Dockerfile ] && QUALITY_FILES=$((QUALITY_FILES + 1))
  [ -d tests ] && QUALITY_FILES=$((QUALITY_FILES + 1))
  [ -d .github/workflows ] && QUALITY_FILES=$((QUALITY_FILES + 1))

  # Check for potential issues
  if [ "$UNCOMMITTED" -gt 0 ]; then
    ISSUES=$((ISSUES + 1))
    log_warn "Uncommitted changes: $UNCOMMITTED files"
  fi

  if [ "$STASHES" -gt 0 ]; then
    ISSUES=$((ISSUES + 1))
    log_warn "Git stashes pending: $STASHES"
  fi

  if [ ! -f README.md ]; then
    ISSUES=$((ISSUES + 1))
    log_warn "Missing README.md"
  fi

  if [ ! -f .gitignore ]; then
    ISSUES=$((ISSUES + 1))
    log_warn "Missing .gitignore"
  fi

  # Check for ESLint/Jest (Node projects)
  if [ -f package.json ]; then
    if ! grep -q "eslint" package.json 2>/dev/null; then
      log_warn "No ESLint configured"
    fi
    if ! grep -q "jest\|mocha\|vitest" package.json 2>/dev/null; then
      ISSUES=$((ISSUES + 1))
      log_warn "No test framework configured"
    fi
  fi

  # Check branch health
  if [ "$CURRENT_BRANCH" = "master" ] || [ "$CURRENT_BRANCH" = "main" ]; then
    log_warn "Working on main/master branch (consider feature branches)"
    ISSUES=$((ISSUES + 1))
  fi

  TOTAL_ISSUES=$((TOTAL_ISSUES + ISSUES))

  # Add to report
  HEALTH_STATUS="✓ Healthy"
  if [ "$ISSUES" -gt 3 ]; then
    HEALTH_STATUS="✗ Needs Work"
  elif [ "$ISSUES" -gt 0 ]; then
    HEALTH_STATUS="⚠ Some Issues"
  fi

  COMMIT_DATE=$(echo "$LAST_COMMIT_DATE" | cut -d' ' -f1)
  cat >> "$REPORT_FILE" << EOF
| $REPO_NAME | $HEALTH_STATUS | $ISSUES | $COMMIT_DATE | $REPO_SIZE |
EOF

  # Add detailed section
  cat >> "$REPORT_FILE" << EOF

### $REPO_NAME

**Location**: $REPO

**Status**: $CURRENT_BRANCH ($(if [ "$UNCOMMITTED" -eq 0 ]; then echo "clean"; else echo "$UNCOMMITTED uncommitted"; fi))

**Stats**:
- Commits: $COMMIT_COUNT
- Branches: $BRANCHES
- Tags: $TAGS
- Size: $REPO_SIZE
- Last commit: $LAST_COMMIT ($LAST_COMMIT_DATE)

**Quality**:
- Quality files: $QUALITY_FILES/6
- Issues found: $ISSUES

**Stashes**: $STASHES pending

**Files to Check**:
EOF

  # List key files
  [ -f README.md ] && echo "- ✓ README.md" >> "$REPORT_FILE" || echo "- ✗ README.md (MISSING)" >> "$REPORT_FILE"
  [ -f package.json ] && echo "- ✓ package.json" >> "$REPORT_FILE" || echo "- ○ package.json" >> "$REPORT_FILE"
  [ -f Dockerfile ] && echo "- ✓ Dockerfile" >> "$REPORT_FILE" || echo "- ○ Dockerfile" >> "$REPORT_FILE"
  [ -d tests ] && echo "- ✓ tests/" >> "$REPORT_FILE" || echo "- ✗ tests/ (MISSING)" >> "$REPORT_FILE"
  [ -f .github/workflows ] && echo "- ✓ GitHub workflows" >> "$REPORT_FILE" || echo "- ○ GitHub workflows" >> "$REPORT_FILE"

  echo "" >> "$REPORT_FILE"

  log_success "$REPO_NAME audited (Issues: $ISSUES)"
done

# Add summary and recommendations
cat >> "$REPORT_FILE" << EOF

---

## Summary

**Total Repositories**: $REPO_COUNT
**Total Issues Found**: $TOTAL_ISSUES
**Average Issues/Repo**: $(echo "scale=1; $TOTAL_ISSUES / $REPO_COUNT" | bc 2>/dev/null || echo "N/A")

---

## Recommendations

### Priority 1 (Critical)
- Add missing README.md files (crucial for documentation)
- Ensure all uncommitted work is committed
- Set up test frameworks for Node.js projects
- Configure .gitignore properly

### Priority 2 (Important)
- Set up CI/CD pipelines (GitHub Actions)
- Add linting (ESLint for JS/Node)
- Process pending git stashes
- Create proper branch strategies

### Priority 3 (Nice to Have)
- Add code formatting (Prettier)
- Set up code coverage reporting
- Add Docker support where applicable
- Implement pre-commit hooks

### For All Repos
- Keep main/master branch clean
- Regular commits with clear messages
- Review and update dependencies
- Document setup and installation
- Keep README.md current

---

## Next Steps

1. **Review this report** and identify quick wins
2. **Address Priority 1 items** in each repo
3. **Set up automation** (GitHub Actions, pre-commit hooks)
4. **Document** each project clearly
5. **Track improvements** over time

---

**Report Generated**: $TIMESTAMP
**By**: Multi-Repository Audit Script

EOF

# Print report path and summary
echo ""
echo -e "${GREEN}✓ Report generated: $REPORT_FILE${NC}"
echo ""
echo "Summary:"
echo "  Repositories scanned: $REPO_COUNT"
echo "  Total issues found: $TOTAL_ISSUES"
echo ""
echo "View report:"
echo "  cat $REPORT_FILE"
echo ""
