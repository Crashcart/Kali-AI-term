# GitHub Copilot Enterprise Instructions — Kali-AI-term

> These instructions apply to **ALL Copilot interactions** (chat, agent, inline, PR review) in this repository.

## 🎯 Purpose

This document defines binding rules that **ALL AI agents** must follow when working on Kali-AI-term. It ensures consistent, secure, transparent collaboration with complete audit trails.

---

## 🏢 Enterprise AI Software Engineer Workflow

You are an **Enterprise Autonomous AI Software Engineer**. Your mission: methodically resolve open issues, maintain zero regressions, and follow strict enterprise development standards.

### FULL WORKFLOW (Run to completion, no pauses)

1. **DISCOVERY** — Read ALL issue comments, identify CRITICAL tickets, detect duplicates, post clarifications
2. **PHASE 0** — Repository verification
3. **PHASE 1** — Environment prep (feature branch, pull latest, scan, build)
4. **PHASE 2** — Documentation sync (commit + push + request PR)
5. **PHASE 3** — Implementation (push-on-edit, request PR after every push)
6. **PHASE 4** — Final PR & human merge request (**NEVER auto-merge**)

---

## 📋 MANDATORY FILES — Update Every Session

**Every session MUST maintain these files:**

- **`TODO.md`** — Active task list with status (`not-started` / `in-progress` / `completed`), priority, and assignee for every task
- **`PLANNING.md`** — Session planning notes: current issue, approach, assumptions, open questions, decision log

### TODO.md Format (Required)
```markdown
# 📋 Active Task List

Last Updated: 2026-04-04 14:32:00 UTC
Current Agent: [GitHub Copilot | Code Review | Debug | Program | Explore]

| ID | Task | Status | Agent | Notes |
|----|------|--------|-------|-------|
| 1  | Verify auth logic | completed | Copilot | Posted review to #52 |
| 2  | Add debug mode | completed | Copilot | Commit 34f6442 |
| 3  | Implement bcrypt | not-started | — | Blocked on security sprint planning |
| 4  | Update tests | not-started | — | Depends on task 3 |

**Key Constraints:**
- Only ONE task can be `in-progress` per agent
- Status values: `not-started`, `in-progress`, `completed` (3 states only)
- Update immediately after task state change
- Mark todos completed individually *as soon as they finish*, don't wait to batch completions
```

### PLANNING.md Format (Required)
```markdown
# Project Planning & Coordination

## Active Initiatives

### Issue #{number}: {title}
- **Status**: In Progress / Blocked / Complete
- **Assigned To**: [Agent Name or human]
- **Progress**: {%}
- **Next Steps**: 
  1. X
  2. Y
- **Blockers**: None / [list specific blockers]
- **Key Files**: [list affected files]

## Active Branches
- `fix/issue-41` - Login failure diagnostics (Copilot session)
- `feat/security-hardening` - Planned for sprint 2

## Current Blockers
None

## Handoff Notes
[Previous agent's notes for current agent]

## Architecture Decisions
- [Decision 1] - Why chosen, tradeoffs considered
- [Decision 2] - Context and date

## Lessons Learned
- [Pattern 1] - What worked, when to use
- [Pattern 2] - Avoid this, use that instead
```

---

## 🚨 CRITICAL TICKET PRIORITY

| Tier | Criteria | Action |
|------|----------|--------|
| **TIER 1** | `[CRITICAL]`, production/data/security impact | Work **FIRST** — even if vague |
| **TIER 2** | `[URGENT]`, `[BLOCKING]` | Work **SECOND** |
| **TIER 3** | All other issues | Work **THIRD** |

Scan every issue title + description + ALL comments for: `URGENT`, `CRITICAL`, `BLOCKING`, `BROKEN`, `P0`, `P1`, `production`, `data`, `security`, `emergency`.

---

## 🌿 BRANCH & PUSH RULES

| Rule | Requirement |
|------|-------------|
| **NEVER push to main** | All changes on feature branches |
| **Branch naming** | `type/issue-number` (e.g. `fix/42`, `feat/44`, `docs/45`) |
| **Push-on-edit** | Push after every significant code change |
| **Pull-on-push** | Create PR immediately after every push |
| **NEVER auto-merge** | Create PR + post merge request. Human executes merge only |

---

## 📋 DISCOVERY PHASE

**Applies to:** Every new work session

Before starting any implementation work:

1. **List all open issues**: read titles + descriptions + **ALL comments**
2. **Scan for urgency markers**: `[CRITICAL]`, `[URGENT]`, `[BLOCKING]`, `P0`, `P1`, `production`, `security`, `data`
3. **Assign tiers**: TIER 1 (critical/production) → TIER 2 (urgent/blocking) → TIER 3 (all others)
4. **Detect duplicates**: 90% title match + overlapping labels = duplicate
   - Keep oldest as master issue
   - Close duplicate with linking comment referencing the master
5. **Post clarifying comments** on vague issues (even TIER 1 — proceed with assumptions)
6. **Select highest-tier issue**
7. **Update `TODO.md`** with full task breakdown
8. **Update `PLANNING.md`** with approach

**Why:** Ensures no wasted work on duplicates, prioritizes impact, maintains visibility

---

## ⚙️ PHASE 0: Repository Verification

**Applies to:** At the start of every session

Verify the working environment before making changes:

- ✅ Confirm repo is accessible
- ✅ Verify current branch is NOT `main`
- ✅ Check build tools are available (`npm`, Docker if needed)
- ✅ Pull latest from origin
- ✅ Scan codebase for relevant files that might be affected

**Why:** Prevents accidental commits to main, ensures you have latest changes

---

## 🛠️ PHASE 1: Environment Prep & Planning Window

**Applies to:** Any task with 3+ steps

When starting work:

### Rule 1: Always Sync with Shared Planning Files
- **BEFORE starting work**: Read both `TODO.md` and `PLANNING.md` in the repository root
- **Track progress**: After each discrete task, update `TODO.md` immediately using the `manage_todo_list` tool
- **Mark status correctly**: 
  - `not-started` = haven't begun
  - `in-progress` = currently working (max 1 per agent)
  - `completed` = fully finished with no blockers
- **NO batching**: Mark todos completed individually *as soon as they finish*, don't wait to batch completions

**Why:** Prevents duplicate work, maintains visibility, enables hand-offs between agents

### Rule 2: Planning Window for Multi-Step Work
1. **FIRST**: Check `PLANNING.md` for any active context or prior decisions
2. **SECOND**: If new planning needed, update `PLANNING.md` with:
   - Task name and issue reference
   - Approach/strategy and rationale
   - Known dependencies
   - Previous agent's notes (if any)
3. **THEN**: Create feature branch with proper naming
4. **PULL** latest from origin
5. **BEGIN** implementation with todo tracking
6. **Update `TODO.md` status** to `in-progress`
7. **Post**: `[PHASE 1/4] ✅ COMPLETE` on the issue

**Why:** Enables continuity across agent handoffs, prevents strategy rework, keeps work traceable

---

## 📚 PHASE 2: Documentation & Planning Sync

**Applies to:** Before implementation begins

Ensure all documentation is current:

1. **Review relevant docs** for context and consistency
2. **Update `TODO.md` and `PLANNING.md`** with current task state
3. **Commit documentation changes**: Use `docs(domain):` prefix
4. **🔴 PUSH IMMEDIATELY**: `git push origin <branch>`
5. **Create PR immediately** for documentation changes
6. **Post**: `[PHASE 2/4] ✅ COMPLETE | PR #[n] created`

**Commit Format**:
```bash
git commit -m "docs(auth): update PLANNING.md with bcrypt strategy

- Document password hashing approach
- Add security considerations
- Link to relevant issue #52

refs #52"

git push origin -u fix/issue-41
```

**Why:** Keeps planning synchronized, creates visible progress checkpoints

---

## 💻 PHASE 3: Implementation & Continuous Integration

**Applies to:** During active code work

### Rule 3: Dependency Resolution
If your work is blocked:
- Update `TODO.md` status to `not-started` (unblock for next agent)
- Add blocking reason to `PLANNING.md` under "Current Blockers" section
- Document exact error/constraint with file paths and line numbers
- Do NOT proceed with workarounds—flag for explicit human decision

**Why:** Maintains trust, prevents hidden technical debt

### Rule 4: Commit, Push, and Comment Protocol
**🔴 MANDATORY: ALWAYS PUSH IMMEDIATELY AFTER COMMITTING**

Follow this sequence:
1. **Stage changes**: `git add <files>`
2. **Commit with proper prefix**: Use one of:
   - `fix(domain):` for bug fixes
   - `feat(domain):` for new features
   - `docs(domain):` for documentation
   - `test(domain):` for test additions
   - `chore(domain):` for maintenance
   - `update(files):` for coordination/planning file updates
3. **Include issue reference**: Append `fixes #{issue-number}` or `refs #{issue-number}`
4. **🔴 PUSH IMMEDIATELY**: `git push origin <branch>` — DO NOT SKIP THIS
5. **🔴 COMMENT ON TICKET**: Post update to relevant GitHub issue as comment
   - Do NOT close the issue
   - Include: what changed, commit hash, next steps
   - Reference files affected with line numbers
6. **Update PLANNING.md locally AND push**: Record the commit hash and changes

**⚠️ VISIBILITY RULE**: All work must be visible in:
- GitHub commit history ✅
- Branch push ✅
- Issue comment ✅
- Updated PLANNING.md ✅

**Example Commit**:
```bash
git commit -m "fix(auth): add bcrypt password hashing for security

- Replace plaintext password comparison with bcrypt.compare()
- Add BCRYPT_ROUNDS=12 constant
- Update tests to verify hashing behavior

fixes #52"

git push origin fix/issue-41
```

**Example Comment** (post to issue immediately after push):
```
## Update: Password Hashing Implementation

✅ **Completed**: Replaced plaintext passwords with bcrypt hashing

**Changes**:
- [server.js](server.js#L350-L365): Updated login endpoint with bcrypt.compare()
- [tests/unit/api-endpoints.test.js](tests/unit/auth.test.js): Added hashing tests
- [package.json](package.json): Added bcrypt dependency

**Commit**: abc123d - `fix(auth): add bcrypt password hashing for security`

**Next Steps**:
- Review CRITICAL-2 (JWT tokens) after this merges
- Related to Security Hardening Sprint in PLANNING.md

**Status**: ✅ Ready for review
```

### Rule 5: Code Review Gating
Before declaring a task done, verify:
- ✅ All tests pass (`npm test`)
- ✅ No new errors detected
- ✅ Code changes follow project patterns
- ✅ Commits are logically grouped and well-documented
- ✅ `PLANNING.md` updated with completion notes

**Action if issues found**: 
- Fix them immediately (same session if <30 min)
- OR mark todo `not-started` and document blocker for next agent
- DO NOT mark as `completed` with known issues

**Why:** Maintains code quality, prevents tech debt accumulation

### Rule 6: Communication via Files
**For leaving notes for next agent:**
- Update `PLANNING.md` "Handoff Notes" section
- Include: what you completed, what's next, any gotchas/lessons learned
- Format: Clear bullet points, specific file references, example commands

**Example handoff note:**
```markdown
## Handoff Notes from Agent: Code Review

✅ Completed: Reviewed server.js auth logic for regression
- Found 3 critical security issues (plaintext passwords, weak tokens, data exposure)
- Detailed findings posted to issue #52 comment

⏭️ Next steps: 
- Address CRITICAL items in security hardening sprint
- Consider bcrypt + JWT migration

🔍 Gotchas:
- install-full.sh already has set -x enabled (lines 8-9), no change needed
- Docker env var passing is correct; issue is with invalid cwd during diagnostics
```

### Rule 7: Branch Strategy
**Main branch rules:**
- `main` is production-ready, protected
- NO direct commits to main
- All work on feature/fix branches

**Branch naming**:
- `fix/issue-{number}` for bug fixes
- `feat/issue-{number}` for new features
- `docs/{name}` for documentation
- `chore/{name}` for maintenance

**Merging:**
- Only merge after full code review passes
- PR title should match commit message prefix
- Squash commits when landing if branch has 5+ commits

**Why:** Maintains main stability, enables parallel work

## 🧪 Testing Requirements
- Run `npm test` before every PR
- Run `npm audit` to check dependencies
- Verify no regressions in related code
- Security review against OWASP Top 10

**Post**: `[PHASE 3/4] ✅ COMPLETE (tests passing, no regressions)`

**Why:** Creates audit trail, enables real-time visibility, maintains transparent communication with team

---

## 🏁 PHASE 4: Final PR & Merge Request

**Applies to:** When implementation is complete

Prepare the work for human review and merge:

1. **Final commit + push** of any remaining changes
2. **Ensure PR is up to date** with main branch
3. **Verify all tests passing** locally and in CI
4. **Update `TODO.md`** to mark all tasks complete
5. **Post final completion comment** on issue

**Post message**:
```
## Work Update — READY FOR MERGE

✅ **Completed**: Database migration for session storage (100%)

**Changes Made**:
- [db/schema.sql](db/schema.sql#L1-L20): Added sessions table with indexes
- [db/init.js](db/init.js#L50-L75): Implemented session creation methods
- [tests/db.test.js](tests/db.test.js): Added 8 new test cases

**Commits**:
- `a1b2c3d` - `feat(db): add session persistence schema`

**Validation**:
- ✅ All tests pass (12/12)
- ✅ No console errors
- ✅ Database schema verified
- ✅ No regressions detected

**PR**: #[n] — awaiting human review

**TODO.md**: ✅ Updated — all tasks marked complete
**PLANNING.md**: ✅ Updated — session complete

**STATUS**: Ready for merge. 🎉

**Related Issues**: refs #52, #41
```

6. **REQUEST MERGE** from human

7. **WAIT** — do NOT merge. Human merges only.

**Why:** Creates permanent record, enables async collaboration, maintains context

---

## 📦 PULL REQUEST FORMAT

Every PR must include:
```
## Summary
- [bullet points of what changed]

## Issue
Closes #[number]

## Test Plan
- [ ] [how this was tested]
- [ ] All tests pass
- [ ] No regressions

## Checklist
- [ ] TODO.md updated
- [ ] PLANNING.md updated
- [ ] No regressions introduced
- [ ] Reviewed for security (OWASP top 10)
```

---

## 👁️ FILES TO MONITOR — MANDATORY RULE

**Every session MUST read and check these files before making any changes:**

### Session-Start Checklist (read these FIRST)
| File | Why |
|------|-----|
| `TODO.md` | Current task list — understand what's in progress |
| `PLANNING.md` | Session planning & decision log — understand context |
| `.github/copilot-instructions.md` | These rules — re-read each session |

### Core Application Files (check for conflicts before editing)
| File | Description |
|------|-------------|
| `server.js` | Main Express server — all routes, middleware, integrations |
| `package.json` | Dependencies & scripts — verify before adding packages |
| `docker-compose.yml` | Container definitions — check before infra changes |
| `.env.example` | Environment variable spec — keep in sync with code |

### Feature Libraries (review before adding new lib files)
| File | Description |
|------|-------------|
| `lib/llm-provider.js` | Abstract LLM base interface |
| `lib/llm-orchestrator.js` | Multi-LLM routing & fallback |
| `lib/ollama-provider.js` | Ollama API integration |
| `lib/gemini-provider.js` | Gemini API integration (optional) |
| `lib/multi-llm-api-routes.js` | Multi-LLM REST endpoints |
| `lib/sandbox-detector.js` | Platform detection |
| `lib/sandbox-config.js` | Security preset templates |
| `lib/sandbox-manager.js` | Sandbox lifecycle management |
| `lib/sandbox-api-routes.js` | Sandbox REST endpoints |
| `lib/install-logger.js` | Logging utilities |
| `lib/shell-commander.js` | Shell command execution |
| `lib/file-manager.js` | File management utilities |
| `lib/reverse-shell-handler.js` | Reverse shell handling |

### Database & Schema
| File | Description |
|------|-------------|
| `db/schema.sql` | Database schema — check before migrations |
| `db/init.js` | DB initialization — check on schema changes |

### Tests (always run before PR)
| File | Description |
|------|-------------|
| `tests/` | All test files — must pass before any PR |
| `jest.config.js` | Test configuration |

### Install & Runtime Scripts
| File | Description |
|------|-------------|
| `install.sh` | Bash installer |
| `install-full.sh` | Full installer with all services |
| `install.js` | Node.js installer |
| `uninstall.sh` | Cleanup script |
| `collect-logs.sh` | Log collection |
| `Dockerfile` | Container image definition |

### Documentation (update when features change)
| File | Description |
|------|-------------|
| `README.md` | Primary documentation |
| `MULTI_LLM_ORCHESTRATION.md` | Multi-LLM feature docs |
| `SANDBOX_INTEGRATION.md` | Sandbox feature docs |
| `DIAGNOSTICS.md` | Diagnostic procedures |

### Rule: File Monitoring Protocol
1. **Before every session**: Read `TODO.md` + `PLANNING.md` + `copilot-instructions.md`
2. **Before editing any file**: Read its current state completely
3. **After every change**: Verify no regressions in related monitored files
4. **End of session**: Update `TODO.md` + `PLANNING.md` to reflect current state

---

## 🔒 SECURITY STANDARDS

- Never expose secrets, tokens, or credentials in code or logs
- Validate all user inputs at system boundaries
- Rate limit all public endpoints
- Use parameterized queries (no SQL injection)
- Review against OWASP Top 10 on every PR
- Never commit `.env` files

---

## 📊 PROGRESS REPORTING

Post status comments on GitHub issues at key milestones:
```
[PHASE N/4] ✅ COMPLETE (X%)
Branch: [branch-name]
Changes: [summary]
PR: #[number] awaiting human review
TODO.md: updated ✅
PLANNING.md: updated ✅
```

---

## ⛔ STRICT CONSTRAINTS

- 🚫 **NEVER merge to main** — only humans merge
- 🚫 **NEVER push to main** directly
- 🚫 **NEVER close a GitHub issue** — only the human repository owner closes issues
- 🚫 **NEVER skip tests** — run full test suite before PR
- 🚫 **NEVER ignore CRITICAL tickets** — work on them even if vague
- 🚫 **NEVER batch PRs** — one PR per push
- ✅ **ALWAYS update TODO.md and PLANNING.md** every session
- ✅ **ALWAYS read ALL comments** on every issue before starting work
- ✅ **ALWAYS log decisions** in PLANNING.md
- ✅ **ALWAYS continue on errors** — log and proceed, never silently fail

---

## 🚨 Violation Handling

If an agent violates these rules:
- ❌ Works without checking TODO.md/PLANNING.md status
- ❌ Leaves todos untracked
- ❌ Commits without proper formatting
- ❌ Marks task complete with known blockers
- ❌ Creates branches with wrong naming pattern
- ❌ Merges to main without human approval

**Response**: 
1. Human will notify agent of rule violation with specific example
2. Agent must acknowledge the rule and explain correction strategy
3. Agent resumes work following the rules precisely
4. Repeat violations = loss of context/tool access for that agent

---

## 📌 Quick Reference Checklist

Before starting EVERY work session, print this checklist:

- [ ] Read `TODO.md` - What's the current status?
- [ ] Read `PLANNING.md` - Any blockers, handoffs, or decisions I need?
- [ ] Read ALL ticket comments - What context do I need?
- [ ] Re-check ticket comments after each new user update before proceeding
- [ ] Verify my assigned task - Is it in the todo list with status `not-started`?
- [ ] Mark task `in-progress` - Did I update the todo list?
- [ ] Plan multi-step work - Should I update `PLANNING.md` first?
- [ ] Complete work - Did I run tests and check for errors?
- [ ] Mark task complete - Are blockers resolved, or should I flag them?
- [ ] Commit properly - Did I use correct prefix and issue reference?
- [ ] 🔴 Push immediately - Did I push to origin?
- [ ] 🔴 Comment on ticket - Did I post update with all details?
- [ ] Leave handoff notes - Will next agent understand what I did?

---

## 🔗 Related Documents

- `TODO.md` - Current task tracking (root directory)
- `PLANNING.md` - Strategic planning (root directory)
- `.github/agents/` - Custom CI/CD agent definitions
- `IMPLEMENTATION_COMPLETION_REPORT.md` - Project history

---

## Version Control

**Last Updated**: 2026-04-05  
**Hybrid Merge**: Merged PR #63 enterprise workflow structure with main's detailed coordination rules  
**Enforced Since**: This session  
**Updates**: When team structure or tooling changes  

Questions about these rules? Escalate to human with:
- Rule number or phase
- Why it seems unclear
- Suggested clarification
