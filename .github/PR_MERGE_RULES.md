# 🚀 PR Merge Rules & Standards

> **MANDATORY** — All PRs must follow this checklist before merge

**Last Updated**: 2026-04-12 21:45:00 UTC  
**Enforced By**: code-review-gate.yml  
**Status**: ✅ ACTIVE

---

## Rule 1: Test Completion Protocol (MANDATORY)

Every PR must execute the full test completion protocol:

```
PHASE 1: Push & wait 15 seconds (GitHub registration)
PHASE 2: Wait 30 seconds (Workflow trigger)
PHASE 3: Wait 120 seconds (Test execution)
PHASE 4: Wait 20 seconds (PR status update)
PHASE 5: Document results in .github
PHASE 6: Wait 10 seconds (Final verification)
TOTAL: ~195 seconds minimum
```

**Violation**: Do NOT declare PR ready before all phases complete.

---

## Rule 2: Green Status (MANDATORY)

ALL of the following must show ✅ GREEN before merge:

```
✅ Conflict Detection — Zero conflicts
✅ Static Code Review — Zero blockers
✅ Tests (unit + integration) — 100% passing
✅ Linting & formatting — Zero errors
✅ Security audit — Zero vulnerabilities
✅ Docker build — Successful
```

**Violation**: Any red/yellow status = STOP, do not merge.

---

## Rule 3: Documentation (MANDATORY)

Before declaring PR ready, update:

```
.github/TODO.md
  - Add task entries for completed work
  - Record test results (test count, suites, time)
  - Update "Last Updated" timestamp

.github/PLANNING.md
  - Document initiative status
  - Record decisions made
  - Link to PR number

.github/TEST_COMPLETION_PROTOCOL.md
  - Log execution details
  - Timestamp each phase completion
```

**Violation**: Incomplete .github docs = PR not ready.

---

## Rule 4: No Premature Declarations

❌ DO NOT say:

- "PR ready" before protocol completes
- "All tests passing" before waiting
- "Ready for merge" without green verification

✅ DO say (only after ALL phases):

- "Protocol complete - all green"
- "145/145 tests passing, 0 failures"
- "All .github documentation updated"
- "PR #XXX ready for merge"

**Violation**: Premature declarations = must repeat protocol.

---

## Rule 5: .github as Source of Truth

All PR status is documented in `.github/`:

- Test results in TODO.md
- Decisions in PLANNING.md
- Protocol logs in TEST_COMPLETION_PROTOCOL.md
- Rules in this file (PR_MERGE_RULES.md)

**Violation**: Status not in .github = not official.

---

## Enforcement

These rules are enforced by:

1. **code-review-gate.yml** — Automated checks
2. **PR Template** — Manual checklist
3. **Branch Protection** — Required status checks
4. **This File** — Human accountability

---

## Checklist for Every PR

Before clicking "Merge":

- [ ] Protocol fully executed (all 6 phases)
- [ ] All checks show ✅ GREEN
- [ ] .github/TODO.md updated with test results
- [ ] .github/PLANNING.md updated with decisions
- [ ] .github/TEST_COMPLETION_PROTOCOL.md has execution log
- [ ] No files modified in violation of these rules
- [ ] Ready declaration made ONLY after verification

---

## Example: Compliant PR Closure

```
✅ Protocol Complete
  Phase 1: Push registered (15s)
  Phase 2: Workflows triggered (30s)
  Phase 3: Tests passed (120s) — 145/145 passing
  Phase 4: PR status updated (20s) — All green
  Phase 5: Documentation updated (.github files)
  Phase 6: Final verification (10s) — Confirmed green

✅ All Checks Passing
  ✓ Conflict Detection
  ✓ Static Code Review
  ✓ Tests (unit + integration)
  ✓ Linting & formatting
  ✓ Security audit
  ✓ Docker build

✅ .github Documentation
  ✓ TODO.md: Test results recorded
  ✓ PLANNING.md: Initiative status updated
  ✓ TEST_COMPLETION_PROTOCOL.md: Execution log added
  ✓ PR_MERGE_RULES.md: This rule followed

RESULT: PR #114 Ready for Merge ✅
```

---

## Violation Consequences

If rules violated:

1. PR returned to "Needs Work"
2. Must restart from Rule 1 (Protocol)
3. Cannot merge until FULL protocol re-executed
4. Violation documented in .github

---

**Rule Status**: ACTIVE ✅  
**Applies To**: All PRs, all contributors  
**No Exceptions**: None
