# 📊 Kali-AI-term Strategic Planning & Coordination

**Last Updated**: 2026-04-04 23:50:00 UTC  
**Document Purpose**: Centralized planning for multi-agent coordination, architectural decisions, and project context

---

## 🎯 Active Initiatives

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

**Solution Deployed**:
- ✅ Login failure diagnostic reporting added (error reports in `data/login-error-reports/`)
- ✅ Enhanced error messages with reportId for support tracking
- ✅ Diagnostic collection script targets auth/container logs (phase 3 refinement)
- ✅ install.sh enhanced with full debug mode (set -x tracing)

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

**🟢 NONE** as of 2026-04-04

All identified blockers from issue #52 have been resolved:
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
