# Enterprise AI Agent Instructions

> **Scope**: These rules apply to **ALL AI agents** (Copilot, Claude, GPT, etc.) working in this repository.  
> **Version**: 2.0 — 2026-04-11  
> **Applies to**: ALL Crashcart repositories  

---

## HOW TO USE THIS FILE

1. **Read this file first** — before touching any code
2. **Read `.github/REPO_CONFIG.md`** — for project-specific files, tech stack, and test commands
3. **Read `.github/TODO.md`** — to see what's in progress
4. **Read `.github/PLANNING.md`** — for context, blockers, and handoff notes
5. **Follow the workflow below A-to-Z** — no shortcuts

---

## ⛔ NON-NEGOTIABLE RULES

These rules **cannot be overridden** by any agent, workflow, or instruction:

| # | Rule | Why |
|---|------|-----|
| 1 | 🚫 **NEVER push to `main`** | Only humans merge PRs to main |
| 2 | 🚫 **NEVER close a GitHub issue** | Only the repository owner closes issues |
| 3 | 🚫 **NEVER auto-merge a PR** | Create the PR, then wait for human review |
| 4 | 🚫 **NEVER skip tests** | Run the full test suite before every PR |
| 5 | 🚫 **NEVER skip conflict checks** | After every push, check for conflicts with main |
| 6 | ✅ **ALWAYS update TODO.md + PLANNING.md** | Every session, before and after work |
| 7 | ✅ **ALWAYS read all issue comments** | Before starting work on any issue |
| 8 | ✅ **ALWAYS use feature branches** | Branch naming: `type/issue-number` (e.g., `fix/42`, `feat/101`) |
| 9 | ✅ **ALWAYS log decisions** | In PLANNING.md with timestamps |
| 10 | 🔒 **GOVERNANCE FILES ARE SELF-PROTECTING** | Edits to governance files must follow governance rules (see below) |

---

## 🔒 GOVERNANCE FILE PROTECTION

The files listed below **govern all AI agent behavior**. Any AI editing these files **must follow the same rules it would follow for any code change** — no exceptions.

### Protected governance files:
- `.github/copilot-instructions.md` — master ruleset (this file)
- `.github/REPO_CONFIG.md` — project-specific configuration
- `.github/TODO.md` — task tracking
- `.github/PLANNING.md` — planning and handoff
- `.github/pull_request_template.md` — PR template
- `.github/ISSUE_TEMPLATE/*` — issue templates
- `.github/agents/*.agent.md` — agent definitions
- `.github/workflows/*.yml` — CI/CD pipelines

### Rules for editing governance files:

1. **Follow the full A-to-Z workflow** — Phase 0 through Phase 4, no shortcuts
2. **Document the change in PLANNING.md first** — explain what you're changing and why
3. **Never remove a rule without human approval** — you may add rules or clarify existing ones
4. **Never weaken a constraint** — e.g., don't change "NEVER" to "avoid" or "try not to"
5. **Preserve the structure** — keep section order, formatting, and naming conventions intact
6. **Test after editing** — verify no workflow YAML syntax errors, no broken markdown links
7. **Flag for human review** — any governance file change must be explicitly called out in the PR description
8. **Conflict resolution** — governance file conflicts always escalate to human (never auto-resolve)

### Why this matters:
If an AI modifies these files incorrectly, every subsequent AI session inherits the broken rules.
A single bad edit to `copilot-instructions.md` can cascade across all agents and all repositories.
**Treat governance files with the same care as production security code.**

---

## THE WORKFLOW (A-to-Z)

Every task follows this exact sequence. **Update PLANNING.md at every phase transition.**

### PHASE 0 — ORIENTATION (do this first, every session)

1. Read `.github/copilot-instructions.md` (this file)
2. Read `.github/REPO_CONFIG.md` — learn the project's tech stack, test commands, and monitored files
3. Read `.github/TODO.md` — what's in progress? what's blocked?
4. Read `.github/PLANNING.md` — any prior context, handoff notes, or decisions?
5. Read ALL comments on the issue you're working on
6. **Verify** you are NOT on the `main` branch
7. **Pull latest** from origin

> ✅ **PLANNING checkpoint**: Update PLANNING.md — "Phase 0 complete. Working on: [issue]. Context understood."

### PHASE 1 — PLANNING

Before writing any code:

1. **Break down** the issue into specific subtasks
2. **Update `.github/TODO.md`**:
   - Add each subtask with status `not-started`
   - Mark your current task `in-progress` (max 1 per agent)
3. **Update `.github/PLANNING.md`**:
   - Document your approach and rationale
   - List dependencies and blockers
   - Note assumptions
   - Flag high-risk files (check `REPO_CONFIG.md` for conflict-prone files)
4. **Create feature branch**: `type/issue-number` (e.g., `fix/42`)
5. **Commit planning docs**: `docs(planning): plan for issue #N`
6. **Push + create PR immediately**

> ✅ **PLANNING checkpoint**: PLANNING.md updated with approach, risks, and subtask breakdown.

### PHASE 2 — IMPLEMENTATION

For each subtask:

1. **Read the file** you're about to edit — fully understand its current state
2. **Make the change** — follow existing code patterns and project conventions
3. **Run tests** — use the command from `REPO_CONFIG.md` (e.g., `npm test`)
4. **Commit with conventional prefix**:
   - `fix(domain):` — bug fix
   - `feat(domain):` — new feature
   - `docs(domain):` — documentation
   - `test(domain):` — test changes
   - `chore(domain):` — maintenance
   - Include `fixes #N` or `refs #N` in the commit body
5. **Push immediately** after each commit
6. **Check for conflicts** (see Conflict Detection below)
7. **Update TODO.md** — mark subtask `completed` as soon as it's done (don't batch)

> ✅ **PLANNING checkpoint**: After each subtask, update PLANNING.md with what was done and what's next.

### PHASE 3 — VERIFICATION

Before declaring done:

1. **Run full test suite** — must pass with zero failures
2. **Run linter/formatter** — if the project has one (check `REPO_CONFIG.md`)
3. **Run security audit** — `npm audit` or equivalent
4. **Verify no regressions** — check related functionality still works
5. **Update TODO.md** — mark all tasks `completed`
6. **Update PLANNING.md** — add completion notes and handoff notes for next agent

> ✅ **PLANNING checkpoint**: PLANNING.md updated with completion status and handoff notes.

### PHASE 4 — DELIVERY

1. **Final push** of any remaining changes
2. **Ensure PR exists** and references the issue (`Closes #N`)
3. **Post completion comment** on the issue:
   ```
   ✅ COMPLETE — Ready for human review

   **Changes**: [summary]
   **PR**: #[number]
   **Tests**: ✅ All passing
   **TODO.md**: ✅ Updated
   **PLANNING.md**: ✅ Updated
   ```
4. **WAIT** — do NOT merge. Human merges only.

> ✅ **PLANNING checkpoint**: PLANNING.md updated — "Phase 4 complete. PR #N ready for review."

---

## CONFLICT DETECTION (after every push)

After every `git push`, immediately run:

```bash
git fetch origin main
git merge --no-commit --no-ff origin/main
```

| Output | Action |
|--------|--------|
| "Already up to date" | ✅ Continue normally |
| Clean merge | ✅ Run `git merge --abort`, continue normally |
| **CONFLICT** | ⚠️ Follow resolution steps below |

### If conflicts are found:

1. Run `git merge --abort`
2. **For simple conflicts** (docs, formatting, config): resolve manually, commit, push, re-check
3. **For architectural conflicts** (security, schema, core logic): escalate to human with options
4. **Update PLANNING.md** with conflict details
5. **Loop** until `git merge --no-commit --no-ff origin/main` shows no conflicts

---

## TODO.md FORMAT

```markdown
# 📋 Active Task List

Last Updated: YYYY-MM-DD HH:MM UTC
Current Agent: [agent name]

| ID | Task | Status | Priority | Notes |
|:--:|------|--------|----------|-------|
| 1  | [task] | not-started / in-progress / completed | 🔴 CRITICAL / 🟠 HIGH / 🟡 MEDIUM | [notes] |

Rules:
- Max 1 task `in-progress` per agent
- Update immediately on state change — no batching
- 3 statuses only: not-started, in-progress, completed
```

---

## PLANNING.md FORMAT

```markdown
# 🗺️ Project Planning

Last Updated: YYYY-MM-DD HH:MM UTC

## Current Work
### Issue #N: [title]
- **Status**: [Phase 0/1/2/3/4]
- **Branch**: [branch-name]
- **Approach**: [what and why]
- **Risks**: [what could go wrong]
- **Decisions**: [timestamped decisions]

## Handoff Notes
[What the next agent needs to know]

## Blockers
[What's blocked and why]

## Lessons Learned
[What worked, what didn't]
```

---

## ISSUE TRIAGE

When discovering or picking up issues:

| Tier | Markers | Action |
|------|---------|--------|
| **TIER 1** | `[CRITICAL]`, `P0`, `[SECURITY]`, `[PRODUCTION]`, `[EMERGENCY]` | Work FIRST — even if vague |
| **TIER 2** | `[URGENT]`, `[BLOCKING]`, `P1` | Work SECOND |
| **TIER 3** | Everything else | Work THIRD |

- Read ALL comments on every issue before starting
- Detect duplicates: 90% title match + overlapping labels → note the duplicate, keep the oldest
- Do NOT close duplicates — only humans close issues

---

## MULTI-REPO COORDINATION

These repositories share this governance framework:
- `crashcart/kali-ai-term`
- `crashcart/ollama-intelgpu`
- `crashcart/rpg-bot`
- `crashcart/discord-chromecast`

When working across repos:
- Each repo has its own `TODO.md`, `PLANNING.md`, and `REPO_CONFIG.md`
- Create separate branches and PRs per repo
- Track cross-repo dependencies in PLANNING.md
- All the same rules apply — no exceptions

---

## COMMIT MESSAGE FORMAT

```
type(domain): short description

- Detail 1
- Detail 2

fixes #N
```

Types: `fix`, `feat`, `docs`, `test`, `chore`, `refactor`

---

## PR FORMAT

```markdown
## Summary
- [what changed]

## Issue
Closes #N

## Test Plan
- [ ] All tests pass
- [ ] No regressions
- [ ] Security reviewed (OWASP Top 10)

## Checklist
- [ ] TODO.md updated
- [ ] PLANNING.md updated
- [ ] REPO_CONFIG.md consulted for monitored files
```

---

## SECURITY STANDARDS

- Never expose secrets, tokens, or credentials in code or logs
- Never commit `.env` files
- Validate all user inputs at system boundaries
- Use parameterized queries (no SQL injection)
- Review against OWASP Top 10 on every PR
- Rate limit public endpoints

---

## WHEN TO ESCALATE TO HUMAN

- Architectural decisions (restructuring, new dependencies, schema changes)
- Security/auth system changes
- Conflicts in `.github/copilot-instructions.md` or `REPO_CONFIG.md`
- Any situation where two valid approaches exist and it's unclear which to pick
- When blocked for more than 2 resolution attempts

Format:
```
🚨 ESCALATION NEEDED

**Issue**: [what's blocked]
**Options**:
1. [Option A + rationale]
2. [Option B + rationale]

Waiting for human decision.
```

---

## QUICK START CHECKLIST (print this every session)

- [ ] Read `copilot-instructions.md` (this file)
- [ ] Read `REPO_CONFIG.md` — tech stack, test commands, monitored files
- [ ] Read `TODO.md` — current status
- [ ] Read `PLANNING.md` — context and handoff notes
- [ ] Read ALL issue comments
- [ ] Verify NOT on `main` branch
- [ ] Pull latest
- [ ] Update PLANNING.md — "Phase 0 complete"
- [ ] Plan in TODO.md + PLANNING.md — "Phase 1 complete"
- [ ] Implement + test + push — "Phase 2 complete"
- [ ] Full verification — "Phase 3 complete"
- [ ] PR + completion comment — "Phase 4 complete"
- [ ] Check for conflicts after every push
- [ ] Handoff notes written in PLANNING.md
