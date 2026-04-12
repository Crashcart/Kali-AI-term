# CI/CD Implementation - Setup Instructions

This document provides step-by-step instructions to complete the GitHub Actions CI/CD workflow setup for the Kali Hacker Bot repository.

## What Has Been Done

✅ **GitHub Actions Workflows Created:**
- `.github/workflows/test.yml` - Automated testing
- `.github/workflows/lint.yml` - Code quality checks
- `.github/workflows/build.yml` - Docker build validation
- `.github/workflows/merge-test-to-main.yml` - Auto-merge on approval

✅ **PR and Issue Templates Created:**
- `.github/pull_request_template.md` - Standardized PR format
- `.github/ISSUE_TEMPLATE/bug_report.md` - Bug reporting template
- `.github/ISSUE_TEMPLATE/feature_request.md` - Feature request template

✅ **Git Hooks Created:**
- `.githooks/pre-commit` - Validate formatting and linting locally
- `.githooks/commit-msg` - Enforce conventional commit format

✅ **Documentation Created:**
- `.github/WORKFLOWS.md` - Complete workflow documentation
- `.github/BRANCH_PROTECTION_SETUP.md` - Branch protection configuration guide

✅ **Commits Pushed:**
- All workflow files committed and pushed to `test` and `main` branches

## What You Need To Do

### Phase 1: Enable Git Hooks Locally

Run this command to enable git hooks on your local machine:

```bash
git config core.hooksPath .githooks
```

Verify it worked:
```bash
git config core.hooksPath
# Should output: .githooks
```

Now git hooks will run automatically on commit and push.

### Phase 2: Configure Branch Protection Rules

1. **Read the guide:**
   - Open `.github/BRANCH_PROTECTION_SETUP.md`
   - Follow the step-by-step instructions

2. **Quick overview:**
   - Go to GitHub repo Settings → Branches
   - Add protection rule for `main` branch
   - Add protection rule for `test` branch
   - Configure required status checks and approvals

3. **Required status checks:**
   - `Tests` (from test.yml)
   - `Lint & Format` (from lint.yml)
   - `Docker Build` (from build.yml)

4. **Minimum approvals:** 1 reviewer

5. **Enable auto-merge** for both branches (squash strategy)

### Phase 3: Test the Workflow

#### Test 1: Feature branch PR
```bash
# Create a test feature branch
git checkout -b feat/test-workflow
echo "# Test" >> README.md
git add README.md
git commit -m "feat: test workflow"
git push -u origin feat/test-workflow
```

Then:
1. Go to GitHub → Create PR to `test` branch
2. Verify all checks run and pass:
   - ✅ Tests
   - ✅ Lint & Format
   - ✅ Docker Build
3. Get approval from a team member
4. Merge to test

#### Test 2: test→main PR
```bash
# On GitHub, create PR from test → main
# Or use CLI:
gh pr create --base main --head test --title "Release: test to main"
```

Then:
1. Request review
2. Once approved, workflow should auto-merge within 60 seconds
3. Verify GitHub Release was created

### Phase 4: Update README (Optional)

Add a CI/CD section to `README.md`:

```markdown
## CI/CD Pipeline

This project uses GitHub Actions for automated testing, linting, and deployment.

### Workflow Overview
- **Tests** run on all PRs (unit + integration)
- **Linting & Formatting** checked on all PRs
- **Docker Build** verified on all PRs
- **test→main** auto-merges on approval

### Branch Protection
- `main` branch: Requires PR review + passing checks
- `test` branch: Requires PR review + passing checks

### Local Setup
Enable git hooks for pre-commit validation:
```bash
git config core.hooksPath .githooks
```

For detailed workflow information, see [WORKFLOWS.md](.github/WORKFLOWS.md).
```

## Verification Checklist

After completing the setup, verify:

### Git Hooks
- [ ] Run `git config core.hooksPath` → should output `.githooks`
- [ ] Make a test commit → hooks should validate formatting
- [ ] Try committing bad code → hooks should prevent commit

### GitHub Workflows
- [ ] Go to **Actions** tab → see all 4 workflows
- [ ] Each workflow shows recent runs
- [ ] Failed runs show proper error messages
- [ ] Coverage reports appear on PRs

### Branch Protection
- [ ] Go to Settings → Branches
- [ ] `main` branch has protection rule
- [ ] `test` branch has protection rule
- [ ] Required status checks are set
- [ ] PR approval is required

### Workflow Process
- [ ] Create PR to test → checks run automatically
- [ ] PR shows status checks at bottom
- [ ] Can't merge without passing checks
- [ ] Can't merge without approval
- [ ] Can't merge if out of date with base

### Auto-merge test→main
- [ ] Create PR from test→main
- [ ] Get approval
- [ ] Workflow auto-merges within 60 seconds
- [ ] GitHub Release is created automatically

## Troubleshooting

### Workflows Not Running

**Problem:** Workflows not showing in Actions tab

**Solutions:**
1. Ensure workflow files are in `.github/workflows/`
2. Workflows need proper YAML syntax - check GitHub Actions logs
3. Try triggering manually: go to Actions → Select workflow → "Run workflow"

### Status Checks Not Found

**Problem:** Can't add required status checks in branch protection

**Solutions:**
1. The workflow must have run at least once
2. Create a test PR to trigger workflows
3. Status checks will appear after first run

### Pre-commit Hooks Not Running

**Problem:** `git commit` doesn't run hooks

**Solutions:**
```bash
# Verify hooks are enabled
git config core.hooksPath

# If empty, enable them
git config core.hooksPath .githooks

# Make hooks executable
chmod +x .githooks/pre-commit .githooks/commit-msg

# Test hooks
.githooks/pre-commit
```

### Auto-merge Not Working

**Problem:** PR to main isn't auto-merging

**Solutions:**
1. Verify all status checks are passing
2. Verify at least 1 approval exists
3. Verify no "Changes requested" reviews
4. Check `merge-test-to-main.yml` logs in Actions tab

### Merge Conflicts

**Problem:** Can't merge due to conflicts

**Solutions:**
```bash
git checkout test
git pull origin test
git fetch origin main
git rebase origin/main
# Resolve conflicts
git push -f origin test
```

## Next Steps

1. ✅ **Setup:** Follow Phase 1-4 above
2. ✅ **Test:** Run the workflow tests
3. ✅ **Train Team:** Share `.github/WORKFLOWS.md` with team
4. ✅ **Document:** Update project README with CI/CD info
5. 🔄 **Monitor:** Watch Actions tab for workflow health

## Files to Review

| File | Purpose |
|------|---------|
| `.github/workflows/test.yml` | Test automation |
| `.github/workflows/lint.yml` | Code quality |
| `.github/workflows/build.yml` | Docker validation |
| `.github/workflows/merge-test-to-main.yml` | Auto-merge |
| `.github/WORKFLOWS.md` | Detailed documentation |
| `.github/BRANCH_PROTECTION_SETUP.md` | Branch protection guide |
| `.githooks/pre-commit` | Local validation |
| `.githooks/commit-msg` | Commit format enforcement |

## Quick Commands

```bash
# Clone repo (if needed)
git clone https://github.com/Crashcart/tipistore.git
cd tipistore

# Enable git hooks
git config core.hooksPath .githooks

# Create feature branch and test
git checkout -b feat/my-feature
# ... make changes ...
git add .
git commit -m "feat: my feature"
git push -u origin feat/my-feature

# Create PR on GitHub (then get approval to auto-merge)
```

## Getting Help

- **Workflow Issues:** Check `.github/WORKFLOWS.md`
- **Branch Protection:** Check `.github/BRANCH_PROTECTION_SETUP.md`
- **GitHub Actions:** Check [GitHub Actions Docs](https://docs.github.com/en/actions)
- **Pre-commit Hooks:** Run `.githooks/pre-commit --help`

---

**Status:** Ready for implementation ✓

**Est. Setup Time:** 15-30 minutes

**Dependencies:** GitHub account with repo access

**Questions?** Check the documentation files or GitHub Actions logs

