# 📋 Kali-AI-term Active Task List

**Last Updated**: 2026-04-11 03:34:40 UTC  
**Current Session**: GitHub Copilot Task Agent (Code Review Agent mode)  
**Repository**: Kali-AI-term (copilot/fix-conflicts-in-pr-77-again branch)

---

## PR #77 Conflict Resolution Tasks

| ID | Task Title | Status | Assigned | Priority | Notes |
|:--:|-----------|--------|----------|----------|-------|
| 0a | Fetch PR #77 branch (`git fetch origin pull/77/head:pr-77`) | 🔵 **not-started** | — | 🔴CRITICAL | Requires bash; not yet done on `copilot/fix-conflicts-in-pr-77-again` |
| 0b | Merge PR #77 into branch (`git merge pr-77`) | 🔵 **not-started** | — | 🔴CRITICAL | Depends on 0a |
| 0c | Resolve merge conflicts in conflicting files | 🔵 **not-started** | — | 🔴CRITICAL | Depends on 0b; per-file guidelines in PLANNING.md |
| 0d | Run `npm test` to verify no regressions | 🔵 **not-started** | — | 🔴CRITICAL | Depends on 0c |
| 0e | Push resolved branch (`copilot/fix-conflicts-in-pr-77-again`) | 🔵 **not-started** | — | 🔴CRITICAL | Depends on 0d |

---

## Current Tasks

| ID | Task Title | Status | Assigned | Priority | Notes |
|:--:|-----------|--------|----------|----------|-------|
| 1 | Verify password-fix auth logic | ✅ **completed** | Copilot | 🔴HIGH | Hard re-research complete; no regression detected |
| 2 | Add full debug mode to install.sh | ✅ **completed** | Copilot | 🔴HIGH | Commit 34f6442 pushed to fix/issue-41 |
| 3 | Validate auth flow end-to-end | ✅ **completed** | Copilot | 🔴HIGH | Complete tracing root→leaf verified |
| 4 | Perform comprehensive code review | ✅ **completed** | Copilot | 🔴HIGH | Review posted to issue #52, 3 CRITICAL + 4 HIGH issues identified |

---

## Upcoming Work (Prioritized)

| ID | Task Title | Status | Assigned | Priority | Dependencies | Est. Hours |
|:--:|-----------|--------|----------|----------|--------------|-----------|
| 5 | Implement bcrypt password hashing | 🔵 **not-started** | — | 🔴CRITICAL | Task 4 (code review complete) | 8 |
| 6 | Replace Base64 tokens with JWT | 🔵 **not-started** | — | 🔴CRITICAL | Task 5 | 6 |
| 7 | Minimize/protect error reports | 🔵 **not-started** | — | 🔴CRITICAL | Task 4 | 2 |
| 8 | Add environment variable validation | 🔵 **not-started** | — | 🟠HIGH | Task 4 | 2 |
| 9 | Implement login rate limiting | 🔵 **not-started** | — | 🟠HIGH | Arch decision needed | 1 |
| 10 | Remove auth_secret from DB schema | 🔵 **not-started** | — | 🟠HIGH | Task 6 (JWT complete) | 2 |
| 11 | Constant-time password comparison | 🔵 **not-started** | — | 🟡MEDIUM | Task 5 | 1 |
| 12 | Add logout function | 🔵 **not-started** | — | 🟡MEDIUM | Task 6 | 2 |
| 13 | Add CSRF protection | 🔵 **not-started** | — | 🟡MEDIUM | Arch decision | 3 |
| 14 | Expand test coverage | 🔵 **not-started** | — | 🟡MEDIUM | Tasks 5-10 | 3 |

---

## Completed Items (This Session)

### Session: GitHub Copilot - Core Review & Diagnostics
- ✅ **Task 1**: Hard re-research password-fix logic — No regression found
  - Files reviewed: server.js, install-full.sh, docker-compose.yml, install.sh
  - Trace: Password generation → .env write → docker-compose parse → server.js read → login comparison
  - Conclusion: Flow is correct; auth logic sound
  - Time: ~30 min

- ✅ **Task 2**: Add full debug mode to install.sh  
  - Added `set -e`, `export PS4`, `set -x` to match install-full.sh
  - Syntactically validated with `bash -n`
  - Commit: `34f6442` - `fix(install): enable full debug mode with set -x tracing`
  - Pushed to: `fix/issue-41`
  - Time: ~10 min

- ✅ **Task 3**: Validate auth flow end-to-end
  - Verified each component: credential generation, env-var passing, container startup, runtime reading
  - No timing issues identified
  - Password comparison uses basic `===` (acceptable for this scope)
  - Time: ~15 min

- ✅ **Task 4**: Comprehensive code review
  - Scope: fix/issue-41 branch, all auth-related and diagnostic changes
  - Method: Code Review subagent with detailed security focus
  - Findings: 3 CRITICAL + 4 HIGH + 5 MEDIUM + 3 LOW + 1 INFO
  - Output: 26KB detailed review posted to issue #52 comment
  - Key Finding: No regression in password logic; security concerns are pre-existing
  - Time: ~45 min

---

## Active Session Context

**Session Started**: 2026-04-04 ~13:00 UTC  
**Current Branch**: fix/issue-41  
**Files Modified This Session**:
- `/install.sh` - Added debug tracing (4 lines added)
- `.github/copilot-instructions.md` - New file (coordination rules)
- `TODO.md` - New file (this file)
- `PLANNING.md` - Will create shortly

**Commits This Session**:
- `34f6442` - `fix(install): enable full debug mode with set -x tracing`

**Issue References**:
- #52 - Login failures after install (primary issue)
- #41 - Original issue context (reference in branch name)

---

## Current Blockers / Decisions Needed

**🟢 None** - All current work is complete. Upcoming work has architectural decisions captured in PLANNING.md.

---

## Status Legend

| Symbol | Status | Meaning |
|--------|--------|---------|
| ✅ | completed | Task fully finished, all acceptance criteria met |
| 🟠 | in-progress | Agent actively working on this task |
| 🔵 | not-started | Task ready to begin, no dependencies blocking |
| ⏸️ | blocked | Task cannot proceed; blocking reason documented in PLANNING.md |

## Priority Legend

| Symbol | Level | Action |
|--------|-------|--------|
| 🔴 | CRITICAL | Must complete before merge/release |
| 🟠 | HIGH | Should complete before merge/release |
| 🟡 | MEDIUM | Can schedule for next sprint |
| 🟢 | LOW | Nice-to-have enhancement |

---

## Instructions for Next Agent

**When you begin work:**

1. **Read this file** - Understand what's completed and what's next
2. **Check PLANNING.md** - Review blockers, decisions, and context
3. **Pick the highest-priority `not-started` task** - Update its status to `in-progress`
4. **Contact human if** - You need architectural decision (CSRF, rate-limiting approach, etc.)
5. **Update this file** - After completing each discrete task
6. **Leave handoff notes** - In PLANNING.md "Handoff Notes" section when you finish

---

## Quick Stats

| Metric | Value |
|--------|-------|
| Total Tasks | 14 |
| Completed | 4 ✅ |
| Remaining | 10 🔵 |
| In Progress | 0 |
| Blocked | 0 |
| Total Est. Hours | ~35 hours |
| Est. Sprint Size | 3 sprints (2-week each) |

---

## File Locations Reference

- **This file**: `/workspaces/Kali-AI-term/TODO.md`
- **Planning file**: `/workspaces/Kali-AI-term/PLANNING.md`
- **Agent rules**: `/workspaces/Kali-AI-term/.github/copilot-instructions.md`
- **Main code**: `/workspaces/Kali-AI-term/server.js`
- **Auth logic**: `/workspaces/Kali-AI-term/server.js#L348-L365`
- **Tests**: `/workspaces/Kali-AI-term/tests/unit/`
- **Docker config**: `/workspaces/Kali-AI-term/docker-compose.yml`
