# 🔒 Agent Work-State Tracker

> **Purpose**: Prevent merge conflicts by tracking which files are actively being modified by which agent/branch.
> Every agent **MUST** check this file before editing any file and update it when claiming or releasing files.

**Last Updated**: 2026-04-11 06:00:00 UTC

---

## How This Works

1. **Before editing any file**: Check the "Active Locks" table below
2. **If the file is listed**: Do NOT edit it — coordinate with the owning agent first
3. **If the file is NOT listed**: Add a row to claim it, then proceed
4. **When done with a file**: Remove your row from the table
5. **On session end**: Remove ALL your rows (release all locks)

---

## Active Locks

<!-- 
  FORMAT: One row per file being actively edited.
  Agents MUST update this table atomically (claim before editing, release after pushing).
  If a lock is older than 24 hours, it is considered stale and can be overridden.
-->

| File | Branch | Agent | Claimed At (UTC) | Issue/PR | Expected Release |
|------|--------|-------|-------------------|----------|-----------------|
| _none_ | — | — | — | — | — |

---

## Stale Lock Policy

- Locks older than **24 hours** are considered **stale** and may be overridden
- Before overriding a stale lock, check if the branch still exists and has recent commits
- If the branch has recent commits, post a comment on the issue asking the agent to release
- If the branch is deleted or abandoned, remove the stale lock and proceed

---

## Lock Conflict Resolution

When two agents need the same file:

1. **Check priority**: TIER 1 work takes precedence over TIER 2/3
2. **Check timing**: First lock wins (earliest `Claimed At` timestamp)
3. **Coordinate**: If both are TIER 1, the agents must coordinate via PLANNING.md
4. **Split the work**: If possible, split changes to avoid overlapping sections
5. **Sequential**: If splitting isn't possible, queue the lower-priority work

---

## Reserved Files (Always High-Risk)

These files are frequently edited by multiple agents. Extra caution required:

| File | Risk Level | Coordination Notes |
|------|-----------|-------------------|
| `.github/copilot-instructions.md` | 🔴 CRITICAL | Only one agent at a time. Always lock. |
| `server.js` | 🔴 HIGH | Lock the specific route/section being edited |
| `package.json` | 🟡 MEDIUM | Lock when adding/removing dependencies |
| `docker-compose.yml` | 🟡 MEDIUM | Lock when changing services or config |
| `install.sh` / `install-full.sh` | 🟡 MEDIUM | Lock when modifying install steps |
| `TODO.md` | 🟡 MEDIUM | Append-only edits preferred; lock for restructuring |
| `PLANNING.md` | 🟡 MEDIUM | Append-only edits preferred; lock for restructuring |
| `db/schema.sql` | 🟡 MEDIUM | Always lock — schema changes are non-commutative |

---

## History Log

<!-- Append completed lock cycles here for audit trail -->

| File | Branch | Agent | Claimed | Released | Outcome |
|------|--------|-------|---------|----------|---------|
| _initial setup_ | copilot/resolve-conflicts-multi-agent | Debug Agent | 2026-04-11 | 2026-04-11 | Created coordination system |
