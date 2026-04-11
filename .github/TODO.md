# 📋 Kali-AI-term Active Task List

**Last Updated**: 2026-04-11 10:15:00 UTC
**Current Session**: GitHub Copilot Task Agent (Dual-input + LLM log)
**Repository**: Kali-AI-term

---

## Current Session Tasks

| ID | Task Title | Status | Assigned | Priority | Notes |
|:--:|-----------|--------|----------|----------|-------|
| B1 | Split command bar into dedicated CHAT + CMD rows | ✅ **completed** | Copilot | 🔴 CRITICAL | CHAT → always AI; CMD → always shell |
| B2 | Add in-memory LLM interaction log to server.js | ✅ **completed** | Copilot | 🔴 CRITICAL | Ring buffer 500 entries; hooks into /api/ollama/generate + /api/ollama/stream |
| B3 | Add GET /api/llm/log + DELETE /api/llm/log endpoints | ✅ **completed** | Copilot | 🔴 CRITICAL | Authenticated; returns last 100 entries by default |
| B4 | Add LLM Debug Log viewer modal (🪵 button) | ✅ **completed** | Copilot | 🟠 HIGH | Auto-refresh every 4 s; shows prompt, response snippet, error, duration |
| B5 | Add Ctrl+G shortcut to open log | ✅ **completed** | Copilot | 🟡 MEDIUM | Maps to openLLMLog() |

---

## Upcoming Work (Prioritized)

| ID | Task Title | Status | Assigned | Priority | Dependencies | Est. Hours |
|:--:|-----------|--------|----------|----------|--------------|-----------|
| 5  | Implement bcrypt password hashing | 🔵 **not-started** | — | 🔴CRITICAL | Code review complete | 8 |
| 6  | Replace Base64 tokens with JWT | 🔵 **not-started** | — | 🔴CRITICAL | Task 5 | 6 |
| 7  | Minimize/protect error reports | 🔵 **not-started** | — | 🔴CRITICAL | — | 2 |
| 8  | Add environment variable validation | 🔵 **not-started** | — | 🟠HIGH | — | 2 |
| 9  | Implement login rate limiting | 🔵 **not-started** | — | 🟠HIGH | Arch decision needed | 1 |
| 10 | Remove auth_secret from DB schema | 🔵 **not-started** | — | 🟠HIGH | Task 6 (JWT complete) | 2 |
| 11 | Constant-time password comparison | 🔵 **not-started** | — | 🟡MEDIUM | Task 5 | 1 |
| 12 | Add logout function | 🔵 **not-started** | — | 🟡MEDIUM | Task 6 | 2 |
| 13 | Add CSRF protection | 🔵 **not-started** | — | 🟡MEDIUM | Arch decision | 3 |
| 14 | Expand test coverage | 🔵 **not-started** | — | 🟡MEDIUM | Tasks 5-10 | 3 |

---

## Status / Priority Legend

| Symbol | Status | | Symbol | Priority |
|--------|--------|-|--------|----------|
| ✅ | completed | | 🔴 | CRITICAL — must fix before merge |
| 🟠 | in-progress | | 🟠 | HIGH — should fix before merge |
| 🔵 | not-started | | 🟡 | MEDIUM — next sprint |
| ⏸️ | blocked | | 🟢 | LOW — nice to have |

---

## 🧊 Frozen Feature Backlog

> **FREEZE NOTICE**: Items below are frozen by owner request. Do NOT implement until freeze is lifted.

| # | Feature | Notes | Status |
|---|---------|-------|--------|
| F-1 | Metasploit RPC integration | Connect to MSGRPC for exploit staging | ❄️ FROZEN |
| F-2 | CVE database enrichment | Auto-lookup CVEs for discovered services | ❄️ FROZEN |
| F-3 | Model-on-demand hot-swapping | Switch Ollama model mid-session | ❄️ FROZEN |
| F-4 | Persistent session storage (Redis) | Replace in-memory store with Redis | ❄️ FROZEN |
| F-5 | Advanced logging and audit trail | Structured tamper-evident command logs | ❄️ FROZEN |
| F-6 | Multi-user support with RBAC | Admin / operator / viewer roles | ❄️ FROZEN |
| F-7 | Custom payload generation | msfvenom UI integration | ❄️ FROZEN |
| F-8 | Vulnerability scanning integration | Nuclei / OpenVAS feed into AI context | ❄️ FROZEN |

---

## File Locations Reference

- **This file**: `.github/TODO.md`
- **Planning file**: `.github/PLANNING.md`
- **Agent rules**: `.github/copilot-instructions.md`
- **Main code**: `server.js`
- **Frontend**: `public/app.js`, `public/index.html`, `public/style.css`
- **Tests**: `tests/unit/`


---

## Upcoming Work (Prioritized)

| ID | Task Title | Status | Assigned | Priority | Dependencies | Est. Hours |
|:--:|-----------|--------|----------|----------|--------------|-----------|
| 5  | Implement bcrypt password hashing | 🔵 **not-started** | — | 🔴CRITICAL | Code review complete | 8 |
| 6  | Replace Base64 tokens with JWT | 🔵 **not-started** | — | 🔴CRITICAL | Task 5 | 6 |
| 7  | Minimize/protect error reports | 🔵 **not-started** | — | 🔴CRITICAL | — | 2 |
| 8  | Add environment variable validation | 🔵 **not-started** | — | 🟠HIGH | — | 2 |
| 9  | Implement login rate limiting | 🔵 **not-started** | — | 🟠HIGH | Arch decision needed | 1 |
| 10 | Remove auth_secret from DB schema | 🔵 **not-started** | — | 🟠HIGH | Task 6 (JWT complete) | 2 |
| 11 | Constant-time password comparison | 🔵 **not-started** | — | 🟡MEDIUM | Task 5 | 1 |
| 12 | Add logout function | 🔵 **not-started** | — | 🟡MEDIUM | Task 6 | 2 |
| 13 | Add CSRF protection | 🔵 **not-started** | — | 🟡MEDIUM | Arch decision | 3 |
| 14 | Expand test coverage | 🔵 **not-started** | — | 🟡MEDIUM | Tasks 5-10 | 3 |

---

## Status / Priority Legend

| Symbol | Status | | Symbol | Priority |
|--------|--------|-|--------|----------|
| ✅ | completed | | 🔴 | CRITICAL — must fix before merge |
| 🟠 | in-progress | | 🟠 | HIGH — should fix before merge |
| 🔵 | not-started | | 🟡 | MEDIUM — next sprint |
| ⏸️ | blocked | | 🟢 | LOW — nice to have |

---

## 🧊 Frozen Feature Backlog

> **FREEZE NOTICE**: Items below are frozen by owner request. Do NOT implement until freeze is lifted.
> To lift: change status to `🔵 not-started`, open a GitHub issue, and add to the active table above.

| # | Feature | Notes | Status |
|---|---------|-------|--------|
| F-1 | Metasploit RPC integration | Connect to MSGRPC for exploit staging | ❄️ FROZEN |
| F-2 | CVE database enrichment | Auto-lookup CVEs for discovered services | ❄️ FROZEN |
| F-3 | Model-on-demand hot-swapping | Switch Ollama model mid-session | ❄️ FROZEN |
| F-4 | Persistent session storage (Redis) | Replace in-memory store with Redis | ❄️ FROZEN |
| F-5 | Advanced logging and audit trail | Structured tamper-evident command logs | ❄️ FROZEN |
| F-6 | Multi-user support with RBAC | Admin / operator / viewer roles | ❄️ FROZEN |
| F-7 | Custom payload generation | msfvenom UI integration | ❄️ FROZEN |
| F-8 | Vulnerability scanning integration | Nuclei / OpenVAS feed into AI context | ❄️ FROZEN |

---

## File Locations Reference

- **This file**: `.github/TODO.md`
- **Planning file**: `.github/PLANNING.md`
- **Agent rules**: `.github/copilot-instructions.md`
- **Main code**: `server.js`
- **Frontend**: `public/app.js`
- **Tests**: `tests/unit/`
