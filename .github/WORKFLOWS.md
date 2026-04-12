# GitHub Actions CI/CD Workflows

This document explains the automated CI/CD pipeline for the Kali Hacker Bot repository.

## Workflow Overview

```
Feature Branch
    ↓
    └─→ [Tests] [Lint] [Build] [Security] ✓ or ✗
         All must pass for PR to main/test

test Branch (Pre-production)
    ↓
    └─→ [Tests] [Lint] [Build] [Security] ✓ or ✗
         + Requires review approval

main Branch (Production)
    ↓
    └─→ Auto-merge from test on approval
         + Creates GitHub Release
         + Deploys to production (manual trigger)
```

## Workflows

### 1. Tests (`test.yml`)

**Trigger:** Push to any branch, PR to main/test

**What it does:**

- Runs unit tests: `npm run test:unit`
- Runs integration tests: `npm run test:integration`
- Runs full test suite with coverage: `npm test`
- Uploads coverage to Codecov
- Runs security audit: `npm run test:security`
- Scans for secrets using TruffleHog

**Status Check:** Required for merge

- Must pass before PR can be merged to main/test

### 2. Lint & Format (`lint.yml`)

**Trigger:** Push to any branch, PR to main/test

**What it does:**

- Checks code style with ESLint: `npm run lint:check`
- Validates formatting with Prettier: `npm run format:check`

**Status Check:** Required for merge

- Must pass before PR can be merged to main/test

**Fix locally:**

```bash
npm run lint      # Auto-fix ESLint violations
npm run format    # Auto-fix formatting
git add .
git commit -m "style: auto-format code"
```

### 3. Docker Build (`build.yml`)

**Trigger:** Push to main/test, PR to main/test

**What it does:**

- Builds Docker image with caching
- Validates `docker-compose.yml` syntax
- Validates `Dockerfile` syntax
- Uses GitHub Actions cache for faster builds

**Status Check:** Required for merge

- Must pass before PR can be merged

### 4. Auto-merge test→main (`merge-test-to-main.yml`)

**Trigger:** PR opened/updated from test to main

**What it does:**

1. Verifies PR is from test branch
2. Checks all status checks have passed:
   - Tests passing
   - Linting passing
   - Build passing
3. Verifies at least one approval
4. Checks no changes are requested
5. Auto-merges PR using squash strategy
6. Creates GitHub Release with changelog
7. Posts success comment on PR

**Manual requirements:**

- At least 1 approval from reviewer
- No "Changes requested" reviews
- All status checks must pass

## Branch Protection Rules

### main Branch

- ✅ Require pull request reviews (minimum 1)
- ✅ Require status checks to pass:
  - `Tests` - unit + integration + security
  - `Lint & Format` - ESLint + Prettier
  - `Docker Build` - image build + validation
- ✅ Require branches to be up to date before merging
- ✅ Dismiss stale pull request approvals
- ✅ Allow auto-merge (for test→main workflow)

### test Branch

- ✅ Require pull request reviews (minimum 1)
- ✅ Require status checks to pass (same as main)
- ✅ Require branches to be up to date before merging

### Feature Branches

- No restrictions (for development)
- All workflows still run for validation

## Development Workflow

### 1. Create Feature Branch

```bash
git checkout -b feat/my-feature
```

### 2. Make Changes & Commit

```bash
git add .
git commit -m "feat(feature-area): add new feature"
# Pre-commit hooks will validate formatting and linting
```

### 3. Push & Create PR

```bash
git push -u origin feat/my-feature
```

**GitHub Actions will automatically:**

- Run tests
- Check linting/formatting
- Build Docker image
- Run security audit

### 4. Address Feedback

If any checks fail:

```bash
# Fix issues locally
npm run lint       # Fix linting
npm run format     # Fix formatting
npm run test       # Verify tests pass

# Commit and push
git add .
git commit -m "fix: address review feedback"
git push
```

### 5. Get Approval

Once all checks pass, request a review from a team member.

### 6. Merge to test

After approval, merge to test branch (via GitHub UI or CLI).

### 7. Create Release PR

When test is ready for production:

```bash
# Create PR from test → main
git checkout main
git pull origin main
git pull origin test
git push origin main
```

Or use GitHub UI to create PR from test → main.

### 8. Final Approval

Get approval on the main PR. The `merge-test-to-main.yml` workflow will:

- Verify all checks pass
- Auto-merge to main
- Create GitHub Release
- Post success comment

## Local Setup

### Enable Git Hooks

```bash
# Configure git to use local hooks
git config core.hooksPath .githooks
```

### Pre-commit Hook Features

The `.githooks/pre-commit` hook will automatically:

- Check formatting with Prettier
- Check code style with ESLint
- Detect console.log statements
- Detect hardcoded secrets

To bypass (use with caution):

```bash
git commit --no-verify
```

### Commit Message Hook

The `.githooks/commit-msg` hook enforces conventional commits:

```
feat(scope): description
fix(scope): description
docs: update readme
```

## Troubleshooting

### Tests Failing

```bash
npm ci                # Clean install dependencies
npm run test:unit     # Run unit tests locally
npm run test:integration  # Run integration tests
npm test              # Run all tests
```

### Linting/Formatting Errors

```bash
npm run lint          # Auto-fix ESLint violations
npm run format        # Auto-fix formatting
```

### Docker Build Failing

```bash
docker build .        # Build image locally
docker-compose config # Validate compose file
docker-compose up     # Test locally
```

### PR Won't Merge

Check:

1. ✓ All status checks are passing (green checkmarks)
2. ✓ At least one approval from reviewer
3. ✓ No "Changes requested" reviews
4. ✓ Branch is up to date with main

## Monitoring

### View Workflow Status

- GitHub Actions tab → All Workflows
- Each PR shows status checks at bottom
- Failed checks show error details

### View Logs

- Click on failed check
- Click "Details" link
- View full workflow logs

### Coverage Reports

- Codecov status posted on PRs
- Click "Details" to view coverage report

## Useful GitHub Links

- **Actions:** `https://github.com/Crashcart/Kali-AI-term/actions`
- **Pull Requests:** `https://github.com/Crashcart/Kali-AI-term/pulls`
- **Releases:** `https://github.com/Crashcart/Kali-AI-term/releases`
- **Issues:** `https://github.com/Crashcart/Kali-AI-term/issues`

## Need Help?

For workflow issues:

1. Check the Actions tab for error details
2. Review this document for troubleshooting
3. Check the failing workflow's logs
4. File an issue with workflow logs attached

## Further Reading

- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [Conventional Commits](https://www.conventionalcommits.org/)
- [Semantic Versioning](https://semver.org/)
