# Deploying the Enterprise AI Governance Framework to Other Repos

> **Purpose**: Step-by-step instructions for deploying the `.github` governance framework from Kali-AI-term to your other repositories.  
> **Target repos**: `ollama-intelgpu`, `rpg-bot`, `discord-chromecast`  
> **Last Updated**: 2026-04-11

---

## What Gets Copied

### Universal files (copy as-is):
- `.github/copilot-instructions.md` — master ruleset (identical across all repos)
- `.github/pull_request_template.md` — PR template
- `.github/ISSUE_TEMPLATE/bug_report.md` — bug report template
- `.github/ISSUE_TEMPLATE/feature_request.md` — feature request template

### Files that need per-repo customization:
- `.github/REPO_CONFIG.md` — **must be customized** per project (tech stack, files to monitor, test commands)
- `.github/TODO.md` — start fresh for each repo
- `.github/PLANNING.md` — start fresh for each repo

### Files that are Kali-AI-term specific (do NOT copy):
- `.github/ATTACK-PLAN-DEBUG.md`
- `.github/ENTERPRISE-AGENT-SCHEDULE.md`
- `.github/SCHEDULE-AGENT-PROMPT.txt`
- `.github/SCHEDULE-AGENT-PROMPT-COMPACT.txt`
- `.github/WORKFLOWS.md`
- `.github/BRANCH_PROTECTION_SETUP.md`
- `.github/docker-optimization.md`
- `.github/feature-queue.json`
- `.github/agents/*.agent.md` — copy only if the repo needs custom agents

---

## Step-by-Step: Deploy to a New Repo

### 1. Copy universal files

```bash
# From the Kali-AI-term root directory
TARGET_REPO="/path/to/target-repo"

# Create .github directory structure
mkdir -p "$TARGET_REPO/.github/ISSUE_TEMPLATE"

# Copy universal files
cp .github/copilot-instructions.md "$TARGET_REPO/.github/"
cp .github/pull_request_template.md "$TARGET_REPO/.github/"
cp .github/ISSUE_TEMPLATE/bug_report.md "$TARGET_REPO/.github/ISSUE_TEMPLATE/"
cp .github/ISSUE_TEMPLATE/feature_request.md "$TARGET_REPO/.github/ISSUE_TEMPLATE/"
```

### 2. Create REPO_CONFIG.md for the target project

Use this template and fill in project-specific details:

```markdown
# Repository Configuration — [REPO NAME]

> **Purpose**: Project-specific settings for AI agents. Read this alongside `copilot-instructions.md`.
> **Last Updated**: [DATE]
> 🔒 **GOVERNANCE FILE** — Protected by Rule 10 in `copilot-instructions.md`.

---

## PROJECT OVERVIEW

**Name**: [repo name]
**Type**: [Node.js / Python / Go / etc.]
**Description**: [one-line description]

---

## COMMANDS

| Action | Command |
|--------|---------|
| **Run tests** | [e.g., `npm test`, `pytest`, `go test ./...`] |
| **Lint** | [e.g., `npm run lint`, `flake8`] |
| **Build** | [e.g., `npm run build`, `docker build .`] |

---

## FILES TO MONITOR

### Governance (read first every session)
| File | Purpose |
|------|---------|
| `.github/copilot-instructions.md` | Universal agent rules |
| `.github/REPO_CONFIG.md` | This file |
| `.github/TODO.md` | Active task list |
| `.github/PLANNING.md` | Planning and handoff notes |

### Core Application
| File | Description | Conflict Risk |
|------|-------------|:------------:|
| [main entry point] | [description] | 🟡 MEDIUM |
| [config file] | [description] | 🟢 LOW |

---

## PROJECT CONVENTIONS

- [convention 1]
- [convention 2]
```

### 3. Create fresh TODO.md

```markdown
# 📋 [REPO NAME] Active Task List

> 🔒 **GOVERNANCE FILE** — Protected by Rule 10 in `copilot-instructions.md`.

**Last Updated**: [DATE]
**Current Session**: —
**Repository**: [repo name]

---

## Active Tasks

| ID | Task | Status | Priority | Notes |
|:--:|------|--------|----------|-------|
| — | No active tasks | — | — | — |

---

## Status / Priority Legend

| Symbol | Status | | Symbol | Priority |
|--------|--------|-|--------|----------|
| ✅ | completed | | 🔴 | CRITICAL |
| 🟠 | in-progress | | 🟠 | HIGH |
| 🔵 | not-started | | 🟡 | MEDIUM |
```

### 4. Create fresh PLANNING.md

```markdown
# 🗺️ [REPO NAME] Planning & Coordination

> 🔒 **GOVERNANCE FILE** — Protected by Rule 10 in `copilot-instructions.md`.

**Last Updated**: [DATE]

---

## Current Work

No active initiatives.

## Handoff Notes

No prior sessions.

## Blockers

None.

## Lessons Learned

(none yet)
```

### 5. Commit and push

```bash
cd "$TARGET_REPO"
git checkout -b chore/add-governance-framework
git add .github/
git commit -m "chore(governance): add enterprise AI agent framework

- Add copilot-instructions.md (universal agent rules)
- Add REPO_CONFIG.md (project-specific config)
- Add TODO.md + PLANNING.md (task tracking)
- Add PR + issue templates"
git push origin chore/add-governance-framework
```

Then create a PR and wait for human review.

---

## Quick Reference: What Each Repo Needs

| File | kali-ai-term | ollama-intelgpu | rpg-bot | discord-chromecast |
|------|:---:|:---:|:---:|:---:|
| `copilot-instructions.md` | ✅ done | ⚠️ needs update | ❌ missing | ❌ missing |
| `REPO_CONFIG.md` | ✅ done | ❌ needs creation | ❌ needs creation | ❌ needs creation |
| `TODO.md` | ✅ done | ❌ needs creation | ❌ needs creation | ❌ needs creation |
| `PLANNING.md` | ✅ done | ❌ needs creation | ❌ needs creation | ❌ needs creation |
| `pull_request_template.md` | ✅ done | ❌ missing | ❌ missing | ❌ missing |
| `ISSUE_TEMPLATE/*` | ✅ done | ❌ missing | ❌ missing | ❌ missing |

**Note**: `ollama-intelgpu` already has a `copilot-instructions.md` but it's an older, shorter version. Replace it with the new universal one.
