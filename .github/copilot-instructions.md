# 🤖 Kali-AI-term: Multi-Agent Coordination Rules

## Purpose
This file defines binding rules that **ALL AI agents** (GitHub Copilot, Code Review, Debug, Program, Explore agents) must follow when working on Kali-AI-term.

---

## 📋 MANDATORY RULES FOR ALL AGENTS

### Rule 1: Always Sync with Shared Planning Files
**Applies to:** All agents, every session

- **BEFORE starting work**: Read both `TODO.md` and `PLANNING.md` in the repository root
- **Track progress**: After each discrete task, update `TODO.md` immediately using the `manage_todo_list` tool
- **Mark status correctly**: 
  - `not-started` = haven't begun
  - `in-progress` = currently working (max 1 per agent)
  - `completed` = fully finished with no blockers
- **NO batching**: Mark todos completed individually *as soon as they finish*, don't wait to batch completions

**Why:** Prevents duplicate work, maintains visibility, enables hand-offs between agents

---

### Rule 2: Planning Window for Multi-Step Work
**Applies to:** Any task with 3+ steps

When a task involves multiple steps:
1. **FIRST**: Check `PLANNING.md` for any active context or prior decisions
2. **SECOND**: If new planning needed, update `PLANNING.md` with:
   - Task name
   - Approach/strategy
   - Known dependencies
   - Previous agent's notes (if any)
3. **THEN**: Begin implementation with todo tracking

**Why:** Enables continuity across agent handoffs, prevents strategy rework

---

### Rule 3: Dependency Resolution
**Applies to:** When discovering blocker conditions

If your work is blocked:
- Update `TODO.md` status to `not-started` (unblock for next agent)
- Add blocking reason to `PLANNING.md` under "Current Blockers" section
- Document exact error/constraint with file paths and line numbers
- Do NOT proceed with workarounds—flag for explicit human decision

**Why:** Maintains trust, prevents hidden technical debt

---

### Rule 4: Commit, Push, and Comment Protocol
**Applies to:** After EVERY change (even small updates)

🔴 **MANDATORY: ALWAYS PUSH IMMEDIATELY AFTER COMMITTING**

Follow this sequence:
1. **Stage changes**: `git add <files>`
2. **Commit with prefix**: Use one of:
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

**Why:** Creates audit trail, enables real-time visibility, maintains transparent communication with team

---

### Rule 5: Code Review Gating
**Applies to:** Before marking work as `completed`

Before declaring a task done, verify:
- ✅ All tests pass (`npm test`)
- ✅ No new `get_errors` results
- ✅ Code changes follow project patterns
- ✅ Commits are logically grouped and well-documented
- ✅ `PLANNING.md` updated with completion notes

**Action if issues found**: 
- Fix them immediately (same session if <30 min)
- OR mark todo `not-started` and document blocker for next agent
- DO NOT mark as `completed` with known issues

**Why:** Maintains code quality, prevents tech debt accumulation

---

### Rule 6: Communication via Files
**Applies to:** All inter-agent communication

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

---

### Rule 7: Branch Strategy
**Applies to:** All work assignments

**Main branch rules:**
- `main` is production-ready, protected
- NO direct commits to main
- All work on feature/fix branches

**Branch naming**:
- `fix/issue-{number}` for bug fixes
- `feat/issue-{number}` for new features
- `docs/{name}` for documentation
- `chore/{name}` for maintenance

**Merging**:
- Only merge after full code review passes
- PR title should match commit message prefix
- Squash commits when landing if branch has 5+ commits

**Why:** Maintains main stability, enables parallel work

---

### Rule 9: Ticket Management & Visibility
**Applies to:** All work on GitHub issues

**NEVER close a ticket.** Always comment instead.

**When the user posts a new update/comment, agents MUST re-check comments before continuing work.**

When working on an issue:
1. **Read ALL existing comments** on the ticket first
2. **On every new user update**: re-read latest ticket comments before making code or planning decisions
2. **Always post a comment** when you make changes
3. **Post comment AFTER pushing** changes to GitHub
4. **Never click "Close issue"** - let humans make that decision
5. **Link related commits** in comments using commit hash format
6. **Reference file changes** with markdown links: `[file.js](file.js#L10)`
7. **Update issue description** if context has changed (use edit button, don't close)

**Comment Requirements**:
- What changed (code, docs, config)
- Why it changed (reference to ADR, blocker resolution, etc.)
- What commit(s) implement the change
- What files were affected
- What still needs to be done
- Next steps or blockers

**Example format**:
```markdown
## Work Update

✅ **Completed**: Database migration for session storage

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

**Next Steps**:
- Task 6 in TODO.md: Implement JWT token signing (blocked on this)
- Security review pending (issue #52 comment)

**Related Issues**: refs #52, #41
```

**Why:** Creates permanent record, enables async collaboration, maintains context
**Applies to:** When an agent's session ends

At the end of every session:
1. Save `PLANNING.md` with current state
2. Update all in-progress todos with best-effort %-complete estimate
3. Leave a clear "Resume here on next session" note
4. Push any uncommitted changes with `[WIP]` prefix if incomplete
5. **Post final session summary comment on primary ticket**
6. **Push all changes immediately**

**Format**:
```markdown
## Session Summary - Start here on next session

This session's progress: 45% complete
- ✅ Completed: X, Y, Z (commits: abc123, def456)
- ⏳ In-progress: A (needs B done first)
- ⏳ Blocked: C (waiting for architecture decision)

Next agent should:
1. Read PLANNING.md "Current Blockers" section
2. Complete A by doing steps 1-3 documented at [file#L23]
3. Then unblock C by making decision noted in issue comment

Files modified: auth-logic.js, tests/unit/api-endpoints.test.js
All changes pushed to branch. See PLANNING.md for handoff details.
```

---

## 📊 TODO.md Format (Sacred Structure)

All agents MUST use this exact structure for `manage_todo_list` tool:

```markdown
# Active Task List

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
```

---

## 📄 PLANNING.md Format (Living Document)

Structure that agents update and reference:

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

## 🚨 Violation Handling

If an agent violates these rules:
- ❌ Works without checking TODO.md/PLANNING.md status
- ❌ Leaves todos untracked
- ❌ Commits without proper formatting
- ❌ Marks task complete with known blockers
- ❌ Creates branches with wrong naming pattern

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
- `.github/agents/` - Custom CI/CD agent definitions (if needed)
- `IMPLEMENTATION_COMPLETION_REPORT.md` - Project history

---

## Version Control

**Last Updated**: 2026-04-04  
**Enforced Since**: This session  
**Updates**: When team structure or tooling changes  

Questions about these rules? Escalate to human with:
- Rule number
- Why it seems unclear
- Suggested clarification
