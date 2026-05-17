#!/bin/bash

# Kali-AI-term Quality Assurance Checker
# Validates that the application meets all quality standards
# Usage: ./qa-check.sh

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Counters
CHECKS_PASSED=0
CHECKS_FAILED=0
CHECKS_WARNED=0

# Log functions
log_info() {
  echo -e "${BLUE}ℹ ${1}${NC}"
}

log_success() {
  echo -e "${GREEN}✓ ${1}${NC}"
  ((CHECKS_PASSED++))
}

log_error() {
  echo -e "${RED}✗ ${1}${NC}"
  ((CHECKS_FAILED++))
}

log_warn() {
  echo -e "${YELLOW}⚠ ${1}${NC}"
  ((CHECKS_WARNED++))
}

log_section() {
  echo ""
  echo -e "${BLUE}╔════════════════════════════════════════════════════════╗${NC}"
  echo -e "${BLUE}║${NC} ${1}"
  echo -e "${BLUE}╚════════════════════════════════════════════════════════╝${NC}"
}

# Start QA checks
clear
echo ""
echo -e "${BLUE}╔════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║${NC}  Kali-AI-term Quality Assurance Check"
echo -e "${BLUE}║${NC}  Validating application quality standards"
echo -e "${BLUE}╚════════════════════════════════════════════════════════╝${NC}"
echo ""

# 1. ENVIRONMENT CHECKS
log_section "1. Environment Validation"

# Check Node.js version
if command -v node &> /dev/null; then
  NODE_VERSION=$(node --version)
  REQUIRED_VERSION="v18.0.0"
  if [[ "$(printf '%s\n' "$REQUIRED_VERSION" "$NODE_VERSION" | sort -V | head -n1)" == "$REQUIRED_VERSION" ]]; then
    log_success "Node.js version: $NODE_VERSION"
  else
    log_error "Node.js version $NODE_VERSION is below required $REQUIRED_VERSION"
  fi
else
  log_error "Node.js not installed"
fi

# Check npm
if command -v npm &> /dev/null; then
  log_success "npm installed ($(npm --version))"
else
  log_error "npm not found"
fi

# Check Docker
if command -v docker &> /dev/null; then
  log_success "Docker installed ($(docker --version | cut -d' ' -f3))"
else
  log_warn "Docker not installed (needed for full integration tests)"
fi

# Check if .env exists
if [ -f .env ]; then
  log_success ".env configuration file exists"
else
  log_warn ".env file not found (create from .env.example)"
fi

# 2. DEPENDENCY CHECKS
log_section "2. Dependency Management"

# Check if node_modules exists
if [ -d node_modules ]; then
  log_success "Dependencies installed"
  # Count packages
  PACKAGE_COUNT=$(find node_modules -maxdepth 1 -type d | wc -l)
  log_info "Total packages: $((PACKAGE_COUNT - 1))"
else
  log_warn "node_modules not found (run: npm install)"
fi

# Security audit
log_info "Running security audit..."
AUDIT_RESULT=$(npm audit --audit-level=moderate 2>&1 || true)
if echo "$AUDIT_RESULT" | grep -q "no vulnerabilities"; then
  log_success "Security audit: No vulnerabilities"
elif echo "$AUDIT_RESULT" | grep -q "vulnerabilities"; then
  log_error "Security vulnerabilities found: $AUDIT_RESULT"
else
  log_warn "Could not run security audit (npm dependencies may not be installed)"
fi

# 3. CODE QUALITY CHECKS
log_section "3. Code Quality"

# Check ESLint configuration
if [ -f .eslintrc.json ]; then
  log_success "ESLint configuration found"

  # Run linting check
  log_info "Running ESLint..."
  if npm run lint:check > /tmp/eslint-report.txt 2>&1; then
    log_success "ESLint: 0 errors"
    ESLINT_WARNINGS=$(grep -c "warning" /tmp/eslint-report.txt || echo "0")
    log_info "ESLint warnings: $ESLINT_WARNINGS"
  else
    ESLINT_ERRORS=$(grep -c "error" /tmp/eslint-report.txt || echo "?")
    log_error "ESLint errors found: $ESLINT_ERRORS"
    grep "error" /tmp/eslint-report.txt | head -5
  fi
else
  log_warn "ESLint configuration not found"
fi

# Check Prettier configuration
if [ -f .prettierrc.json ]; then
  log_success "Prettier configuration found"

  # Check format compliance
  if npm run format:check > /tmp/prettier-report.txt 2>&1; then
    log_success "Code formatting: All files compliant"
  else
    log_warn "Some files need formatting (run: npm run format)"
  fi
else
  log_warn "Prettier configuration not found"
fi

# 4. TEST SUITE CHECKS
log_section "4. Test Suite"

if [ -f jest.config.cjs ]; then
  log_success "Jest configuration found"

  if [ -d tests ]; then
    TEST_COUNT=$(find tests -name "*.test.js" | wc -l)
    log_success "Found $TEST_COUNT test files"

    log_info "Attempting to run tests..."
    if npm test 2>&1 | head -100; then
      log_success "Tests executable (full run requires npm install)"
    else
      log_warn "Could not run tests (dependencies may be missing)"
    fi
  else
    log_error "tests directory not found"
  fi
else
  log_warn "Jest configuration not found"
fi

# 5. CONFIGURATION CHECKS
log_section "5. Configuration Files"

# Check essential files
ESSENTIAL_FILES=(
  "package.json"
  "server.js"
  ".gitignore"
  "docker-compose.yml"
  "Dockerfile"
  "install.sh"
  "uninstall.sh"
)

for file in "${ESSENTIAL_FILES[@]}"; do
  if [ -f "$file" ]; then
    log_success "$file exists"
  else
    log_error "$file missing"
  fi
done

# 6. DOCKER & DEPLOYMENT
log_section "6. Docker & Deployment"

# Check docker-compose
if [ -f docker-compose.yml ]; then
  log_success "docker-compose.yml found"

  # Validate YAML
  if command -v python3 &> /dev/null; then
    if python3 -c "import yaml; yaml.safe_load(open('docker-compose.yml'))" 2>/dev/null; then
      log_success "docker-compose.yml is valid YAML"
    else
      log_error "docker-compose.yml has YAML syntax errors"
    fi
  fi
else
  log_error "docker-compose.yml not found"
fi

# Check Dockerfile
if [ -f Dockerfile ]; then
  log_success "Dockerfile exists"
  # Check for basic structure
  if grep -q "FROM" Dockerfile && grep -q "WORKDIR" Dockerfile; then
    log_success "Dockerfile has basic structure"
  else
    log_warn "Dockerfile may be missing essential commands"
  fi
else
  log_error "Dockerfile not found"
fi

# 7. INSTALLATION SCRIPTS
log_section "7. Installation Scripts"

INSTALL_SCRIPTS=(
  "install.sh"
  "install-alpha.sh"
  "install-beta.sh"
  "install-test.sh"
  "uninstall.sh"
  "update.sh"
)

for script in "${INSTALL_SCRIPTS[@]}"; do
  if [ -f "$script" ]; then
    if [ -x "$script" ]; then
      log_success "$script exists and is executable"
    else
      log_warn "$script exists but is not executable (chmod +x needed)"
    fi
  else
    log_info "$script not found (may be optional)"
  fi
done

# 8. DOCUMENTATION
log_section "8. Documentation"

DOCS=(
  "README.md"
  ".github/QUALITY_STANDARDS.md"
  ".github/BRANCH_AWARE_FILES.md"
  ".github/copilot-instructions.md"
)

for doc in "${DOCS[@]}"; do
  if [ -f "$doc" ]; then
    SIZE=$(wc -l < "$doc")
    log_success "$doc ($SIZE lines)"
  else
    log_warn "$doc not found"
  fi
done

# 9. GITHUB WORKFLOWS
log_section "9. CI/CD Workflows"

if [ -d .github/workflows ]; then
  WORKFLOW_COUNT=$(find .github/workflows -name "*.yml" | wc -l)
  log_success "Found $WORKFLOW_COUNT GitHub workflows"

  # Validate YAML
  for workflow in .github/workflows/*.yml; do
    if python3 -c "import yaml; yaml.safe_load(open('$workflow'))" 2>/dev/null; then
      log_success "$(basename $workflow) is valid YAML"
    else
      log_error "$(basename $workflow) has YAML errors"
    fi
  done
else
  log_warn ".github/workflows directory not found"
fi

# 10. GIT REPOSITORY
log_section "10. Git Repository"

if [ -d .git ]; then
  log_success "Git repository initialized"

  # Check current branch
  CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "unknown")
  log_info "Current branch: $CURRENT_BRANCH"

  # Check for uncommitted changes
  if git diff --quiet 2>/dev/null; then
    log_success "No uncommitted changes"
  else
    CHANGED_FILES=$(git diff --name-only | wc -l)
    log_warn "Uncommitted changes: $CHANGED_FILES files"
  fi

  # Check commit history
  COMMIT_COUNT=$(git rev-list --count HEAD 2>/dev/null || echo "0")
  log_info "Total commits: $COMMIT_COUNT"

  # List last 3 commits
  log_info "Recent commits:"
  git log --oneline -3 2>/dev/null | sed 's/^/  /'
else
  log_warn "Not a git repository"
fi

# FINAL SUMMARY
echo ""
log_section "Quality Assurance Summary"

echo ""
echo "Results:"
echo -e "  ${GREEN}Passed:${NC}  $CHECKS_PASSED"
echo -e "  ${YELLOW}Warned:${NC}  $CHECKS_WARNED"
echo -e "  ${RED}Failed:${NC}  $CHECKS_FAILED"
echo ""

if [ $CHECKS_FAILED -eq 0 ]; then
  echo -e "${GREEN}✓ All critical checks passed!${NC}"
  echo ""
  echo "Recommendations:"
  if [ $CHECKS_WARNED -gt 0 ]; then
    echo "  - Address warnings above to improve stability"
  fi
  echo "  - Run: npm install && npm test"
  echo "  - Run: npm run lint:check && npm run format:check"
  echo "  - Run: docker-compose up to start containers"
  echo ""
  exit 0
else
  echo -e "${RED}✗ Critical issues detected. Please fix before deployment.${NC}"
  echo ""
  exit 1
fi
