# 📊 Kali-AI-term Strategic Planning & Coordination

**Last Updated**: 2026-04-11 06:10:00 UTC  
**Document Purpose**: Centralized planning for multi-agent coordination, architectural decisions, and project context

---

## 🎯 Active Initiatives

### Multi-Agent File Coordination System (copilot/resolve-conflicts-multi-agent)

**Status**: ✅ **Complete** — PR ready for human review  
**Branch**: `copilot/resolve-conflicts-multi-agent`  
**Assigned To**: Debug Agent  
**Issue**: PR #90 — Resolve conflicts and prevent multi-agent code conflicts

**Summary**: Created a proactive file-locking coordination system to prevent merge conflicts between parallel agents. The commit history (PRs #82, #84, #88) showed a recurring pattern of conflicts from agents editing the same files simultaneously. Rule 4a (Conflict Review) detects conflicts *after* they happen; this new Rule 8 (File Coordination) prevents them *before* they happen.

**Changes Made**:
- `.github/agent-work-state.md` — New shared lock file: tracks which files are being edited by which agent/branch
- `.github/agents/coordination.agent.md` — New agent: manages file claim/release lifecycle, stale lock detection, conflict resolution
- `.github/workflows/agent-coordination-check.yml` — New CI workflow: validates lock state, detects stale/orphaned locks on PRs
- `.github/copilot-instructions.md` — Added Rule 8 (File Coordination Protocol), updated agent invocation order, strict constraints, violation handling, quick reference checklist, session-start checklist, and related documents
- `TODO.md` / `PLANNING.md` — Updated with session state

**Decisions Log**:
- [2026-04-11 06:02] Chose markdown-based lock file over JSON for human readability and easy Git diffing
- [2026-04-11 06:02] 24-hour stale lock policy balances safety (no permanent orphans) with flexibility (long-running sessions)
- [2026-04-11 06:02] Priority-based conflict resolution (TIER 1 > TIER 2 > TIER 3) aligns with existing issue prioritization scheme
- [2026-04-11 06:02] CI workflow triggers only on `agent-work-state.md` changes to avoid unnecessary runs
- [2026-04-11 06:02] Coordination Agent placed first in agent invocation order (before Program/Debug) since it must run before any file edits

**Architecture Decision**:
- **ADR: Proactive vs Reactive Conflict Prevention**
  - **Context**: Rule 4a (conflict-review) is reactive — it detects conflicts after code is pushed. This leads to costly resolution loops.
  - **Decision**: Add a proactive layer (Rule 8) that prevents conflicts by coordinating file access before editing begins.
  - **Tradeoff**: Small overhead per edit (check + claim + release) but eliminates the much larger overhead of conflict resolution.
  - **Alternatives Considered**: Git-based advisory locks, GitHub branch protection rules, separate coordination repo. All rejected as too complex or not visible to agents.

---

### Conflict Review Agent (copilot/add-review-conflicts-to-github)

**Status**: ✅ **Complete** — Merged  
**Branch**: `copilot/add-review-conflicts-to-github`  
**Assigned To**: GitHub Copilot Task Agent  

**Summary**: Added a dedicated Conflict Review Agent to `.github/agents/` to codify the mandatory post-push conflict detection (Rule 4a) as a first-class, invocable agent. Updated `copilot-instructions.md` to reference the new agent in the agent invocation order and Quick Reference Checklist.

**Changes Made**:
- `.github/agents/conflict-review.agent.md` — New agent: post-push conflict detection and full A→B→C→D resolution loop
- `.github/copilot-instructions.md` — Added Conflict Review Agent to agent invocation order, Quick Reference Checklist, and Related Documents

**Decisions Log**:
- [2026-04-11 05:39] Created `conflict-review.agent.md` consistent with existing agent format (frontmatter + structured markdown)
- [2026-04-11 05:39] Agent references Rule 4a from copilot-instructions.md to avoid content duplication
- [2026-04-11 05:39] copilot-instructions.md Quick Reference Checklist updated to require running the Conflict Review Agent after every push

---

### Planning Agent + Code Review Gate (copilot/add-planning-agent-to-github)

**Status**: ✅ **Complete** — PR ready for human review  
**Branch**: `copilot/add-planning-agent-to-github`  
**Assigned To**: GitHub Copilot Task Agent  

**Summary**: Added a well-rounded Planning Agent and an automated Code Review Gate workflow to make planning and end-of-code review a structured part of every development session.

**Changes Made**:
- `.github/agents/planning.agent.md` — New Planning Agent: triage, decomposition, risk assessment, conflict pre-detection, handoff packages
- `.github/workflows/code-review-gate.yml` — New 4-job CI workflow: conflict detection, static code review (ESLint + Prettier + audit + secrets), test suite, planning docs check
- `.github/pull_request_template.md` — Added Planning Agent sign-off + End-of-Code Review sections
- `.github/copilot-instructions.md` — Added `🗺️ PLANNING PHASE` section; updated FULL WORKFLOW to include step 0 (Planning) and step 7 (End-of-Code Review)
- `TODO.md` / `PLANNING.md` — Updated this session

**Decisions Log**:
- [2026-04-11 05:30] Planning Agent created as a dedicated `.github/agents/` file (consistent with existing agent pattern: enterprise-workflow, program, debug, code-review)
- [2026-04-11 05:30] `code-review-gate.yml` uses 4 jobs (conflict-check → static-review + test-suite + planning-docs-check) so conflict check gates the other jobs via `needs:`
- [2026-04-11 05:30] Conflict detection uses `git worktree` dry-run merge to avoid polluting the working checkout
- [2026-04-11 05:30] ESLint failure is a hard gate; Prettier and audit failures post warnings but static-review job fails on ESLint only (matching existing project stance in lint.yml)
- [2026-04-11 05:30] Planning docs check is a warning (not a hard gate) to avoid blocking pure hotfix PRs that don't need planning updates



**Background**:
- PR #77 has merge conflicts with `main` (https://github.com/Crashcart/Kali-AI-term/pull/77/conflicts)
- Branch `copilot/resolve-pull-request-conflicts` is at `main`'s HEAD — push resolved state here
- Prior branches: `copilot/fix-conflicts-in-pr-77` and `copilot/fix-conflicts-in-pr-77-again` — all blocked at same step
- The conflict resolution requires fetching the PR #77 branch and merging it with main
- The `.git/config` already has PR fetch refspecs added (fetch `refs/pull/*/head:refs/remotes/origin/pr/*`)

**Resolution Steps** (requires bash):
```bash
# Step 1. Unshallow the clone to get full history
git fetch --unshallow origin

# Step 2. Fetch the PR #77 branch
git fetch origin pull/77/head:pr-77

# Step 3. Attempt merge to expose conflicts
git merge pr-77 --no-commit || true

# Step 4. If conflicts arise, resolve each file:
#    - For .github/copilot-instructions.md: KEEP MAIN'S VERSION ENTIRELY
#      (main has the authoritative ~40KB comprehensive version; PR #77 has
#       the older ~2.3KB initial version — main supersedes it)
#    - For any other conflicting files: follow the per-file guidelines below
#
# Quick resolution for copilot-instructions.md conflict:
#    git checkout --ours .github/copilot-instructions.md
#    git add .github/copilot-instructions.md
#
# For other files, inspect and resolve manually

# Step 5. Commit and push resolved state
git add .
git commit -m "fix: resolve merge conflicts between PR #77 and main

- Keep main's comprehensive .github/copilot-instructions.md (40KB)
  over PR #77's original 2.3KB version
- Preserve all enterprise workflow rules and agent instructions
- No regression in application code

refs #77"
git push origin copilot/resolve-pull-request-conflicts
```

**WHY main's copilot-instructions.md wins**:
The file started at ~2.3KB in commit `34f6442` (2026-04-04) and has grown to ~40KB through multiple agent sessions that added enterprise workflow rules, conflict detection protocols, multi-repo scanning, etc. PR #77 was likely opened from a branch that predates these additions. Main's version contains ALL of those additions — it is the superset. The conflict resolution is: keep main's version entirely.

**ALTERNATIVE if PR #77 has unique additions**: Run `git diff pr-77 HEAD -- .github/copilot-instructions.md` to see what PR #77 adds that main doesn't have. If there are unique sections, append them to the end of main's version before committing.

**High-Risk Conflict Files** (based on project history):
| File | Risk | Why |
|------|------|-----|
| `.github/copilot-instructions.md` | 🔴 HIGH | Multiple agents update this |
| `server.js` | 🟡 MEDIUM | Route/middleware changes common |
| `install.sh` | 🟡 MEDIUM | Installer frequently updated |
| `install-full.sh` | 🟡 MEDIUM | Installer frequently updated |
| `package.json` | 🟡 MEDIUM | Dependency conflicts possible |

**Conflict Resolution Guidelines per File**:

*`.github/copilot-instructions.md`*: Merge both versions. This file has been added by multiple agents. Keep all rules from both versions. Main's version takes precedence for policy rules; PR's additions should be appended in new sections if they don't overlap.

*`server.js`*: Follow these priorities when resolving conflicts:
  - Preserve the `createLoginErrorReport()` function and error report infrastructure added in main
  - Preserve authentication middleware that validates tokens via DB sessions
  - If the PR adds security features (bcrypt, JWT), keep them but also keep the error reporting added by main
  - The auth login route at `app.post('/api/auth/login', ...)` is critical — both sides' changes should be preserved

*`install.sh`*: Keep these features from main:
  - `set -e`, `export PS4`, `set -x` debug mode (lines 3-5)
  - Streamed install detection and bootstrapping (lines 12-27)
  - CWD stabilization block (lines 8-10)

*`install-full.sh`*: Keep these features from main:
  - `set -e`, `export PS4`, `set -x` debug mode (lines 7-9)
  - CWD stabilization block (lines 11-14)
  - `/dev/fd` transient path detection (lines 16-22)
  - `/dev/tty`-based password prompting via `can_prompt_user()` and `prompt_line()` (lines 59-73)
  - Password confirmation logic (lines 217-228)

*`package.json`*: Keep the existing dependency versions unless PR adds new required packages. If both sides modified the same dependency version, use the newer version.

*`TODO.md` / `PLANNING.md`*: Merge both versions. Keep all existing task entries from main; add new entries from the PR as additional rows.

**Next Agent Actions**:
1. Run the bash commands above to fetch and merge the PR branch
2. Resolve any conflicts using the guidelines above and project conventions in copilot-instructions.md
3. Run `npm test` to verify no regressions
4. Push the resolved branch

---

### Issue #52: Login Failures After Installation

**Status**: 🟡 **In Progress** (diagnostics complete, security review complete)  
**Assigned To**: GitHub Copilot (diagnostics), Code Review (security analysis)  
**Progress**: 30% - Diagnostics complete; pending security hardening  
**Branch**: `fix/issue-41`

**Background**:
- Users report login failures after fresh installation
- Password mismatch detected → suspected auth flow regression
- Investigation revealed: auth flow is sound, issue is invalid CWD during diagnostics

**Root Cause Identified**:
- **Primary**: Diagnostic scripts run from deleted/invalid working directory
- **Secondary**: Error reporting infrastructure missing (now added)
- **Tertiary**: Security concerns with plaintext passwords + weak tokens (pre-existing)
- **New blocker (2026-04-05)**: Streamed quick install (`bash <(curl .../install.sh)`) resolved to transient `/dev/fd` path and failed before repo checks
- **Current blocker refinement (2026-04-05)**: streamed install now boots correctly, but password prompt still skips because `install-full.sh` checks `[ -t 0 ]` after handoff from process-substitution stdin

**Solution Deployed**:
- ✅ Login failure diagnostic reporting added (error reports in `data/login-error-reports/`)
- ✅ Enhanced error messages with reportId for support tracking
- ✅ Diagnostic collection script targets auth/container logs (phase 3 refinement)
- ✅ install.sh enhanced with full debug mode (set -x tracing)
- ✅ install.sh now detects streamed execution and bootstraps repo checkout, then hands off to install-full.sh
- ✅ install-full.sh now hard-fails with explicit guidance when invoked from transient `/dev/fd` path
- ✅ install-full.sh now prompts for admin password during interactive installs (uses generated secure fallback when left blank)
- ✅ install-full.sh now confirms custom password entry and prints stronger save-your-credentials messaging
- ✅ README now documents interactive prompt behavior and removes outdated default-password guidance

**Implementation In Progress**:
- Replace stdin terminal detection with explicit `/dev/tty`-based prompting so streamed interactive installs can still ask for password
- Apply same tty-safe behavior to overwrite confirmation path for existing `.env`

**Next Steps**:
1. User should run install/diagnostics from valid repo directory (~/Kali-AI-term)
2. If login still fails, run `./collect-logs.sh` and cross-reference reportId in logs
3. Proceed to security hardening sprint (CRITICAL issues from code review)

**Key Files**:
- [server.js](server.js#L348-L365) - Auth login endpoint
- [docker-compose.yml](docker-compose.yml#L13-L14) - Env var passing
- [install-full.sh](install-full.sh#L156-L176) - Credential generation
- [collect-logs.sh](collect-logs.sh) - Diagnostic collection
- [public/app.js](public/app.js) - Frontend auth submission

**Code Review Commit**: See issue comment with full security analysis

---

### Security Hardening Sprint (Planned)

**Status**: 🔵 **Not Started** (prerequisite to production deployment)  
**Assigned To**: TBD (follow-up sprint)  
**Priority**: 🔴 **CRITICAL** for production use  
**Est. Effort**: ~35 hours across 3 sprints

**CRITICAL Issues** (must fix before prod):
1. **Plaintext Password Comparison** (no bcrypt)
   - Impact: Passwords stored/compared as plaintext
   - Risk: Database breach = instant compromise
   - Fix: Implement bcrypt hashing (BCRYPT_ROUNDS=12)
   - Effort: 8 hours
   - Files: server.js, install scripts, tests

2. **Weak Token Encoding** (Base64 instead of JWT)
   - Impact: Tokens can be forged by anyone with AUTH_SECRET
   - Risk: Token forgery attacks
   - Fix: Migrate to JWT with HS256 signature
   - Effort: 6 hours
   - Files: server.js, db/init.js, tests

3. **Sensitive Data Exposed in Error Reports**
   - Impact: Config details leaked to filesystem
   - Risk: Attacker can enumerate system configuration
   - Fix: Minimize report data, protect directory
   - Effort: 2 hours
   - Files: server.js, nginx/reverse proxy config

**HIGH Issues** (should fix before prod):
1. Weak default credentials ('kalibot' is guessable)
2. Missing login-specific rate limiting
3. No environment variable validation on startup
4. auth_secret stored plaintext in SQLite

**Effort Breakdown**:
- Sprint 1 (security core): 16 hours → Tasks 5-8 (password hashing, JWT, env validation)
- Sprint 2 (defense): 12 hours → Tasks 9-10, 11-13 (rate limiting, CSRF, constant-time)
- Sprint 3 (validation): 7 hours → Tasks 14 (comprehensive test coverage)

---

## 🌳 Architecture Decisions

### ADR-001: Plain Passwords vs Bcrypt Hashing
**Decision**: Migrate to bcrypt when addressing CRITICAL security issues  
**Rationale**: Current auth is for internal pentesting tool, not prod SaaS; plaintext acceptable for dev with strong external auth  
**When**: Must complete before any public/multi-user deployment  
**Tradeoff**: Hashing adds ~100ms per login; acceptable for 24-hour session lifetime  
**Related**: Task 5 in TODO.md  

### ADR-002: Base64 Tokens vs JWT
**Decision**: Current Base64 approach acceptable short-term; migrate to JWT for signature verification  
**Rationale**: Current implementation relies on session DB for validation; JWT adds cryptographic integrity  
**When**: Must complete before removing session DB requirement  
**Tradeoff**: JWT adds 5KB to response; DB queries no longer needed for token verification  
**Related**: Task 6 in TODO.md  

### ADR-003: Error Report Data Collection
**Decision**: Keep detailed reports in filesystem; restrict directory access via headers/nginx  
**Rationale**: Detailed logs critical for support triage; minimize web accessibility  
**When**: Must complete before production  
**Tradeoff**: Filesystem access = security concern; mitigated by Linux file permissions  
**Related**: Task 7 in TODO.md  

### ADR-004: Container Naming
**Decision**: LOCKED - Use `kali-ai-term-app` and `kali-ai-term-kali` consistently  
**Rationale**: Commit c2a34fe normalized all references; breaking change to revert  
**Status**: ✅ Implemented and verified  
**Related**: Completed commit c2a34fe  

### ADR-005: Debug Mode in Install Scripts
**Decision**: LOCKED - Install.sh has `set -x` enabled  
**Rationale**: Full command tracing aids troubleshooting; minimal performance impact  
**Status**: ✅ Implemented in commit 34f6442  
**Related**: Completed todo task 2  

---

## 🚧 Current Blockers

**🔴 BLOCKED**: PR #77 Conflict Resolution (as of 2026-04-11 04:30 UTC, confirmed this session — 3rd agent attempt)

Active working branch is `copilot/resolve-pull-request-conflicts` at main's HEAD. The PR #77 branch has never been fetched into this working copy — no conflict markers exist in any file. A bash-capable agent must complete the actual merge.

**Commands to unblock** (already in `.git/config` — just run these):
```bash
git fetch --unshallow origin
git fetch origin pull/77/head:pr-77
git merge pr-77 --no-commit || true
git checkout --ours .github/copilot-instructions.md
git add .github/copilot-instructions.md
# Resolve any other conflicted files manually
git commit -m "fix: resolve merge conflicts between PR #77 and main"
git push origin copilot/resolve-pull-request-conflicts
```

**Key context for resolution**:
- `.github/copilot-instructions.md` will almost certainly conflict — use `git checkout --ours` to keep main's version
- Main's version (~40KB) is the authoritative superset of PR #77's original ~2.3KB version
- After merge, run `npm test` to verify no regressions before pushing

Other blockers from previous sessions:
- ✅ Invalid CWD issue → documented (user guidance to run from repo directory)
- ✅ Missing debug output → fixed (set -x added to install.sh)
- ✅ No error reporting → fixed (login error reports implemented)
- ✅ Auth flow regression → verified as non-existent
- ✅ Container naming inconsistency → fixed (c2a34fe)

**Pending Architecture Decisions** (not blockers, but needed for next sprint):
- [ ] Rate limiting strategy for login endpoint (10 req/15min? custom)?
- [ ] CSRF implementation approach (depends on security sprint priority)
- [ ] Redis vs in-memory for rate limit store?

---

## 📝 Handoff Notes (For Next Agent)

### From: GitHub Copilot Task Agent — Code Review Mode (Session 2026-04-11 04:30 UTC)
**Task**: Resolve merge conflicts in PR #77 `.github` files  
**Branch**: `copilot/resolve-pull-request-conflicts`  
**Session Duration**: ~30 min  
**Progress This Session**: Documentation update, git config updated with PR fetch refspecs

**✅ What I Completed**:
1. Confirmed branch `copilot/resolve-pull-request-conflicts` is at main's HEAD
2. Read all monitored files (server.js, install.sh, install-full.sh, package.json, copilot-instructions.md, TODO.md, PLANNING.md)
3. Updated `.git/config` with additional fetch refspecs for all branches and PRs
4. Updated PLANNING.md with improved resolution strategy and commands (3rd agent session)
5. Updated TODO.md to reflect current branch name and session

**⛔ What I Could NOT Complete** (bash access required — same blocker as previous 2 sessions):
1. `git fetch --unshallow origin`
2. `git fetch origin pull/77/head:pr-77`
3. `git merge pr-77`
4. Actual conflict resolution

**⏭️ What's Next** (for bash-capable agent):
1. Run the bash commands in "Current Blockers" section (updated this session)
2. For `.github/copilot-instructions.md`: `git checkout --ours` (keep main's version)
3. For other files: inspect with `git diff pr-77 HEAD -- <file>` to see differences
4. Run `npm test` after resolving
5. Push to `copilot/resolve-pull-request-conflicts`

**🔍 Key Facts This Session**:
- `.git/config` now has `+refs/pull/*/head:refs/remotes/origin/pr/*` fetch refspec
- No conflict markers exist in any current file (clean main state)
- `copilot-instructions.md` growth: 2.3KB (original) → ~40KB (current) — main wins
- Previous attempts: `copilot/fix-conflicts-in-pr-77` and `copilot/fix-conflicts-in-pr-77-again`

---

### From: GitHub Copilot Task Agent — Code Review Agent (Session 2026-04-11 03:34 UTC)
**Task**: Resolve merge conflicts in PR #77 (follow .github enterprise workflow)  
**Branch**: `copilot/fix-conflicts-in-pr-77-again`  
**Session Duration**: ~20 min  
**Progress This Session**: PHASE 0 + PHASE 2 (documentation sync) — git fetch/merge still requires bash

**✅ What I Completed**:
1. Executed PHASE 0: Verified repo state — on `copilot/fix-conflicts-in-pr-77-again` at `bf61e848`
2. Confirmed no active merge state (no MERGE_HEAD, no conflict markers in any file)
3. Confirmed shallow clone exists (`.git/shallow` present, FETCH_HEAD only has `main` at `bf61e848`)
4. Read all monitored files: server.js, install.sh, install-full.sh, package.json, PLANNING.md, TODO.md, copilot-instructions.md
5. Updated PLANNING.md with corrected branch name and confirmed blocker details
6. Updated TODO.md task 0a–0e status notes

**⛔ What I Could NOT Complete** (bash access required):
1. `git fetch --unshallow origin` — shallow clone must be unshallowed first
2. `git fetch origin pull/77/head:pr-77` — PR branch not yet in local working copy
3. `git merge pr-77` — cannot be run without the above
4. Conflict resolution (no conflict markers exist yet)

**⏭️ What's Next** (for bash-capable agent):
1. Run the 5 bash commands in "Current Blockers" section
2. If conflicts appear, follow per-file guidelines documented in the PR #77 section above
3. Run `npm test` after resolving to verify no regressions
4. Push to `copilot/fix-conflicts-in-pr-77-again`

**🔍 Key Facts Confirmed This Session**:
- `.git/config` fetch spec only covers this branch — no PR fetch refspec configured
- No prior merge attempt was made on this branch
- All source files (server.js, install.sh, install-full.sh, etc.) are clean — identical to main

---

### From: GitHub Copilot Code Review Agent (Session 2026-04-11 03:13 UTC)
**Task**: Resolve merge conflicts in PR #77  
**Session Duration**: ~1 hour  
**Progress This Session**: Documentation only — git fetch/merge requires bash

**✅ What I Completed**:
1. Thoroughly reviewed the entire repository codebase (server.js, install.sh, install-full.sh, db/init.js, all lib/ modules, tests, docs, config)
2. Identified the PR #77 conflict resolution plan and documented it in PLANNING.md
3. Added detailed per-file conflict resolution guidance for the most likely conflict-prone files
4. Updated TODO.md with PR #77 resolution tasks (IDs 0a-0e)
5. Updated `.git/config` to add a PR fetch refspec for convenience

**⛔ What I Could NOT Complete** (bash access required):
1. `git fetch --unshallow origin` — shallow clone must be unshallowed
2. `git fetch origin pull/77/head:pr-77` — need to fetch the PR branch
3. `git merge pr-77` — merge to expose and resolve conflicts
4. Actually resolving conflict markers (can't see what the PR changed)

**⏭️ What's Next** (for next agent with bash):
1. Run the bash commands in the "Current Blockers" section above
2. If conflicts appear, follow the per-file resolution guidelines in the PR #77 section
3. Run `npm test` after resolving to verify no regressions
4. Push the resolved branch

**🔍 Gotchas & Lessons**:
- The Code Review Agent intentionally has no bash access (it's a static analysis agent)
- The task was designed for the main Copilot Task Agent which has bash
- The `.git/config` has been updated with a PR fetch refspec: `+refs/pull/77/head:refs/remotes/origin/pr-77`
- The most likely conflict file based on project history: `.github/copilot-instructions.md`

---

### From: GitHub Copilot (Session 2026-04-04)
**Session Duration**: ~2 hours  
**Progress This Session**: 100% of assigned diagnostics/review

**✅ What I Completed**:
1. Hard re-researched password-fix logic across 4 files → verified no regression
2. Added full debug mode to install.sh (commit 34f6442)
3. Validated complete auth flow end-to-end
4. Executed comprehensive security code review via Code Review subagent
5. Created coordination system (this file + TODO.md + rules)
6. Updated instruction policy: agents must re-check ticket comments after each new user update before continuing
7. Hardened install scripts to auto-stabilize working directory and fail fast if run outside repo checkout
8. Hardened quick installer password prompt to reject empty input (prevents login password mismatch)

**⏭️ What's Next**:
1. **Immediate user action**: Run install/diagnostics from `~/Kali-AI-term` directory
2. **If login still fails**: Collect logs with `./collect-logs.sh`, cross-reference reportId
3. **Next developer**: Pick task 5 from TODO.md (bcrypt password hashing)

**🔍 Gotchas & Lessons**:
- install-full.sh already had `set -x` enabled (lines 8-9) → only install.sh needed it
- Docker env var passing IS correct in docker-compose.yml
- Response: All getcwd errors in diagnostic output trace to **invalid CWD**, not auth bugs
- install.sh only needed 4 lines added (set -e, PS4, set -x) for consistency
- Code Review agent provided exceptionally detailed security findings (26KB report)

**🎯 Key Insights**:
1. **No password-fix regression** — thoroughly verified
2. **Security is pre-existing concern** — not introduced by this PR
3. **Error reporting works** — diagnostics infrastructure is solid
4. **Production deployment** — should NOT proceed without bcrypt + JWT (CRITICAL security issue)

**📋 Files Modified**:
- `/install.sh` - 4 lines added
- `/.github/copilot-instructions.md` - new file (2.3KB rules)
- `/TODO.md` - new file (tracking system)
- `/PLANNING.md` - new file (this file)
- `/install-full.sh` - runtime cwd stabilization + repo sanity checks

**Commits Pushed**:
- `34f6442` - `fix(install): enable full debug mode with set -x tracing`

**Branches**:
- Working on: `fix/issue-41`
- Should merge to: `main` (after human review of security analysis)

**🚀 Resume Instructions for Next Agent**:

1. Read this PLANNING.md section first (you're already here ✓)
2. Read TODO.md to see prioritized work list
3. **If continuing diagnostics**: Check if user ran install from ~/Kali-AI-term yet
4. **If starting security work**: Read the full Code Review comment on issue #52
5. **Pick next task**: Task 5 (bcrypt password hashing) is highest priority
6. Mark as `in-progress` in TODO.md before starting
7. Update PLANNING.md with your approach before coding

**Contact Protocol**:
- Questions about auth logic? → See issue #52 comment (detailed analysis)
- Questions about architecture? → Check "Architecture Decisions" section above
- Questions about rules? → See `.github/copilot-instructions.md`
- Blocked on decision? → Document in PLANNING.md "Current Blockers" and escalate

---

## 🗂️ Related Documents

| Document | Purpose | Location |
|----------|---------|----------|
| **TODO.md** | Task tracking (immediate reference) | `/TODO.md` |
| **copilot-instructions.md** | Rules for all agents | `/.github/copilot-instructions.md` |
| **Issue #52** | Original issue context + code review | GitHub issue #52 |
| **Code Review Report** | Detailed security analysis | GitHub #52 comment |
| **TDR.md** | Technical design reference | `/TDR.md` |
| **IMPLEMENTATION_COMPLETION_REPORT.md** | Project history | `/IMPLEMENTATION_COMPLETION_REPORT.md` |

---

## 📊 Project Metrics

| Metric | Value | Status |
|--------|-------|--------|
| **Issues Resolved** | 1 of 1 (#52) | 🟡 Partial (diagnostics done, security pending) |
| **CRITICAL Security Issues** | 3 identified | 🔴 Open |
| **HIGH Priority Issues** | 4 identified | 🔴 Open |
| **Code Review Status** | Complete | ✅ Done |
| **Test Coverage** | 13/13 passing | ✅ Good |
| **Coordination System** | New | ✅ Created (this session) |
| **Estimated Remaining Work** | ~35 hours | 📊 3 sprints |

---

## 🔐 Security Status

| Area | Status | Notes |
|------|--------|-------|
| **Authentication** | ⚠️ Weak | Plaintext passwords, weak tokens (CRITICAL) |
| **Authorization** | ⚠️ Adequate | Session management works but architecture weak |
| **Data Protection** | ⚠️ Weak | Auth secrets in plaintext DB + filesystem |
| **Rate Limiting** | ⚠️ Inadequate | Generic only, no login-specific limits |
| **Error Handling** | ✅ Good | Structured error reports with supportID |
| **Container Isolation** | ✅ Good | Naming consistent, Docker socket protected |
| **Logging** | ✅ Good | Comprehensive with sensitive data masking |

**Recommendation**: Not production-ready until CRITICAL security issues resolved (Task 5-7).

---

## 📅 Timeline & Milestones

| Milestone | Target Date | Status | Owner |
|-----------|-------------|--------|-------|
| **Issue #52 Diagnostics** | 2026-04-04 | ✅ Done | Copilot + Code Review |
| **Security Hardening Sprint** | 2026-04-18 | 🔵 Planned | TBD |
| **Production Deployment** | 2026-05-02 | 🔵 Blocked | Requires security fixes |
| **Multi-user Support** | 2026-06-01 | 🔵 Future | TBD |

---

## Version Control

| Version | Date | Author | Change |
|---------|------|--------|--------|
| 1.0 | 2026-04-04 | Copilot | Initial creation with coordination system |
| — | — | — | — |

---

## 💡 How to Use This File

**For agents working on tasks:**
- ✅ Check "Current Blockers" before starting (resolve first if present)
- ✅ Read relevant "Architecture Decisions" for context
- ✅ Look at "Handoff Notes" to understand prior work
- ✅ Update "Current Blockers" if you get stuck
- ✅ Update "Handoff Notes" section when you finish

**For human reviewers:**
- ✅ See "Active Initiatives" for project context
- ✅ Check "Architecture Decisions" for why choices were made
- ✅ Review security status before approving PRs

**For new agents joining:**
- ✅ Start with Issue #52 context (linked above)
- ✅ Read this entire file
- ✅ Read TODO.md for task list
- ✅ Read copilot-instructions.md for rules
- ✅ Then pick a task and begin
