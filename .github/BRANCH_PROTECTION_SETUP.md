# Branch Protection Setup Guide

This guide explains how to configure branch protection rules on the GitHub repository to enforce the CI/CD workflow.

## Overview

Branch protection rules ensure:
- All code goes through PR review
- All automated checks pass before merge
- The test→main workflow is enforced
- Production code maintains quality standards

## Setup Instructions

### Step 1: Go to Repository Settings

1. Go to your GitHub repository: `https://github.com/Crashcart/Kali-AI-term`
2. Click **Settings** tab
3. Click **Branches** in the left sidebar (under "Code and automation")

### Step 2: Configure "main" Branch Protection

#### Add Protection Rule
1. Click **Add rule** under "Branch protection rules"
2. In **Branch name pattern**, enter: `main`
3. Click **Create**

#### Configure Settings

**Require a pull request before merging:**
- ✅ Check: "Require a pull request before merging"
- ✅ Check: "Require approvals" (set to 1)
- ✅ Check: "Require review from Code Owners" (optional, if CODEOWNERS file exists)
- ✅ Check: "Dismiss stale pull request approvals when new commits are pushed"
- ✅ Check: "Require conversation resolution before merging"

**Require status checks to pass before merging:**
- ✅ Check: "Require branches to be up to date before merging"
- ✅ Check: "Require status checks to pass before merging"

**Select status checks that must pass:**
Add the following required status checks:
- [ ] `Tests` (from test.yml)
- [ ] `Lint & Format` (from lint.yml)
- [ ] `Docker Build` (from build.yml)

**Require pull request reviews:**
- Minimum: 1 approving review
- ✅ Check: "Require code owner review" (optional)
- ✅ Check: "Dismiss stale pull request approvals when new commits are pushed"

**Require branches to be up to date before merging:**
- ✅ Check this option

**Allow auto-merge:**
- ✅ Check: "Allow auto-merge" (for test→main automation)
  - Select merge method: "Squash and merge"

**Restrict who can push to matching branches:**
- ✅ Check: "Restrict who can push to matching branches"
- Add: `@Crashcart/tipistore-maintainers` (or your team)

**Bypass rules:**
- Keep default (only admins can bypass)

### Step 3: Configure "test" Branch Protection

Repeat Step 2 for the `test` branch with these differences:

**Branch name pattern:** `test`

**Settings:** Same as main, except:
- Minimum approvals: 1
- Same status checks required
- ✅ Allow auto-merge (squash)
- Less restrictive on push restrictions (allow team members)

### Step 4: Verify Workflows are Active

1. Go to **Actions** tab
2. Confirm you see:
   - ✅ Tests
   - ✅ Lint & Format
   - ✅ Docker Build
   - ✅ Auto-merge test→main

All workflows should show recent runs (even if they failed during setup).

## Testing the Setup

### Test PR to test branch

1. Create a test branch: `git checkout -b test/workflow-test`
2. Make a small change
3. Push and create PR to `test`
4. Verify all checks run:
   - Tests should run and pass
   - Linting should run and pass
   - Docker build should run and pass
5. Once approved, PR should merge automatically

### Test PR to main from test

1. Create PR from `test` → `main`
2. Request approval
3. Once approved, workflow should auto-merge within seconds
4. Verify GitHub Release was created

## GitHub CLI Setup (Optional)

If you prefer command-line configuration:

```bash
# Install GitHub CLI
brew install gh  # macOS
# or apt install gh  # Linux

# Authenticate
gh auth login

# Add branch protection for main
gh api repos/Crashcart/tipistore/branches/main/protection \
  -X PUT \
  -F required_status_checks='{"strict": true, "contexts": ["Tests", "Lint & Format", "Docker Build"]}' \
  -F required_pull_request_reviews='{"required_approving_review_count": 1}' \
  -F enforce_admins=true \
  -F allow_auto_merge=true

# Add branch protection for test
gh api repos/Crashcart/tipistore/branches/test/protection \
  -X PUT \
  -F required_status_checks='{"strict": true, "contexts": ["Tests", "Lint & Format", "Docker Build"]}' \
  -F required_pull_request_reviews='{"required_approving_review_count": 1}' \
  -F allow_auto_merge=true
```

## Troubleshooting

### Status Check Not Found

If a workflow status check is missing:
1. Ensure the workflow file exists in `.github/workflows/`
2. Commit and push the workflow file
3. Create a PR or push to trigger the workflow
4. Status check will appear in protection rule settings after first run

### Can't Auto-Merge

Check:
- [ ] "Allow auto-merge" is enabled on branch protection
- [ ] All required status checks are passing
- [ ] PR has at least 1 approval
- [ ] No "Changes requested" reviews

### Tests Not Running

1. Go to **Actions** tab
2. Check if workflow has permissions to run
3. Verify workflow file syntax with: `gh workflow validate .github/workflows/test.yml`
4. Check workflow logs for errors

## Automating Merge from test to main

The `merge-test-to-main.yml` workflow will:
1. Automatically detect PR from test→main
2. Wait for all status checks to pass
3. Wait for at least 1 approval
4. Auto-merge using squash strategy
5. Create a GitHub Release
6. Post success comment

This happens automatically when:
- PR is created from `test` to `main`
- All checks pass (Tests, Lint, Build, Security)
- At least 1 review is approved
- No reviews have "Changes requested"

## Required Permissions

For auto-merge to work, ensure the GitHub Actions bot has:
- `pull-requests: write` - Create/merge PRs
- `contents: write` - Create releases and tags
- `issues: write` - Post comments

These are configured in the workflow files.

## Disabling a Workflow Temporarily

If you need to disable a workflow temporarily:

1. Go to **Actions** → **All workflows**
2. Click the workflow name
3. Click **...** menu
4. Select **Disable workflow**

To re-enable:
1. Go to **Actions** → **All workflows**
2. Click the disabled workflow
3. Click **Enable workflow**

## Further Reading

- [GitHub Branch Protection Documentation](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/about-protected-branches)
- [Workflow YAML Syntax](https://docs.github.com/en/actions/using-workflows/workflow-syntax-for-github-actions)
- [GitHub CLI Documentation](https://cli.github.com/manual/)

## Quick Reference

| Aspect | main | test |
|--------|------|------|
| PR Required | ✅ Yes | ✅ Yes |
| Approvals | 1+ | 1+ |
| Status Checks | All | All |
| Auto-merge | ✅ Yes | ✅ Yes |
| Merge Strategy | Squash | Squash |
| Admin Override | ✅ Yes | ✅ Yes |

## Support

If you encounter issues:
1. Check workflow logs in **Actions** tab
2. Review this guide's troubleshooting section
3. Check [GitHub Actions documentation](https://docs.github.com/en/actions)
4. Create an issue with workflow logs attached
