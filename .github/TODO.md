# 📋 Kali-AI-term Active Task List

> 🔒 **GOVERNANCE FILE** — Protected by Rule 10 in `copilot-instructions.md`. Follow full workflow when editing.

**Last Updated**: 2026-04-12 21:30:00 UTC
**Current Session**: Docker deployment & CI/CD configuration fix — resolve merge conflicts and ESLint 10 compatibility
**Repository**: Kali-AI-term

---

## Current Session Tasks

| ID  | Task Title                                                | Status           | Assigned | Priority    | Notes                                                            |
| :-: | --------------------------------------------------------- | ---------------- | -------- | ----------- | ---------------------------------------------------------------- |
| D1  | Resolve 12+ merge conflicts with main branch              | ✅ **completed** | Claude   | 🔴 CRITICAL | Used `git merge main -X ours` for stable resolution             |
| D2  | Add ESLint 10 flat config (`eslint.config.js`)            | ✅ **completed** | Claude   | 🔴 CRITICAL | Legacy `.eslintrc.json` incompatible with ESLint 10.0.0          |
| D3  | Add ES module support (`"type": "module"` in package.json)| ✅ **completed** | Claude   | 🔴 CRITICAL | Fixes ESLint loader warnings                                     |
| D4  | Apply Prettier formatting to all files (72 files)        | ✅ **completed** | Claude   | 🟠 HIGH     | Automated `npm run format` to ensure consistency                 |
| D5  | Validate docker-compose.yml for multi-service setup      | ✅ **completed** | Claude   | 🔴 CRITICAL | Added ollama + kali services; configurable ports                 |
| D6  | Push all fixes to `claude/kali-hacker-bot-VkfAG` branch  | ✅ **completed** | Claude   | 🔴 CRITICAL | All 239 commits ready; PR #114 updated with resolved conflicts   |

## Previous Session Tasks

| ID  | Task Title                                               | Status           | Assigned | Priority    | Notes                                                                                       |
| :-: | -------------------------------------------------------- | ---------------- | -------- | ----------- | ------------------------------------------------------------------------------------------- |
| O1  | Orchestrator tries ALL registered providers as fallbacks | ✅ **completed** | Copilot  | 🔴 CRITICAL | `_buildProviderList` includes every registered provider, not just strategy primary+fallback |
| O2  | Direct Ollama endpoints fall back across instances       | ✅ **completed** | Copilot  | 🔴 CRITICAL | `/api/ollama/generate` + `/api/ollama/stream` iterate all instances                         |
| O3  | Allow deleting the primary Ollama instance               | ✅ **completed** | Copilot  | 🔴 CRITICAL | Next instance auto-promotes; UX shows ✕ on all rows                                         |
| O4  | Frontend UX — delete button on all instances             | ✅ **completed** | Copilot  | 🟠 HIGH     | Primary shows EDIT + ✕; secondary shows ✕; promotion feedback in chat                       |
| O5  | Health check reports first healthy instance              | ✅ **completed** | Copilot  | 🟠 HIGH     | `checkOllamaHealth` falls back to first connected when primary missing                      |

## Previous Session Tasks

| ID  | Task Title                                                 | Status           | Assigned | Priority    | Notes                                                                         |
| :-: | ---------------------------------------------------------- | ---------------- | -------- | ----------- | ----------------------------------------------------------------------------- |
| B1  | Split command bar into dedicated CHAT + CMD rows           | ✅ **completed** | Copilot  | 🔴 CRITICAL | CHAT → always AI; CMD → always shell                                          |
| B2  | Add in-memory LLM interaction log to server.js             | ✅ **completed** | Copilot  | 🔴 CRITICAL | Ring buffer 500 entries; hooks into /api/ollama/generate + /api/ollama/stream |
| B3  | Add GET /api/llm/log + DELETE /api/llm/log endpoints       | ✅ **completed** | Copilot  | 🔴 CRITICAL | Authenticated; returns last 100 entries by default                            |
| B4  | Add LLM Debug Log viewer modal (🪵 button)                 | ✅ **completed** | Copilot  | 🟠 HIGH     | Auto-refresh every 4 s; shows prompt, response snippet, error, duration       |
| B5  | Add Ctrl+G shortcut to open log                            | ✅ **completed** | Copilot  | 🟡 MEDIUM   | Maps to openLLMLog()                                                          |
| L1  | Replace large-model defaults with lightweight curated list | ✅ **completed** | Copilot  | 🟠 HIGH     | Remove dolphin-mixtral/neural-chat; add phi4-mini, gemma3:4b, qwen2.5:3b etc. |
| L2  | Add Ollama Intel GPU quick-connect to settings UI          | ✅ **completed** | Copilot  | 🟠 HIGH     | Links to Crashcart/Ollama-intelgpu                                            |
| L3  | Update .env.example with curated models + Intel GPU notes  | ✅ **completed** | Copilot  | 🟡 MEDIUM   | Low-end system optimisation                                                   |
| L4  | Auto-pull default model after install completes            | ✅ **completed** | Copilot  | 🟠 HIGH     | install.sh + install-full.sh pull phi3:mini if Ollama has zero models         |

---

## Upcoming Work (Prioritized)

| ID  | Task Title                          | Status             | Assigned | Priority   | Dependencies          | Est. Hours |
| :-: | ----------------------------------- | ------------------ | -------- | ---------- | --------------------- | ---------- |
|  5  | Implement bcrypt password hashing   | 🔵 **not-started** | —        | 🔴CRITICAL | Code review complete  | 8          |
|  6  | Replace Base64 tokens with JWT      | 🔵 **not-started** | —        | 🔴CRITICAL | Task 5                | 6          |
|  7  | Minimize/protect error reports      | 🔵 **not-started** | —        | 🔴CRITICAL | —                     | 2          |
|  8  | Add environment variable validation | 🔵 **not-started** | —        | 🟠HIGH     | —                     | 2          |
|  9  | Implement login rate limiting       | 🔵 **not-started** | —        | 🟠HIGH     | Arch decision needed  | 1          |
| 10  | Remove auth_secret from DB schema   | 🔵 **not-started** | —        | 🟠HIGH     | Task 6 (JWT complete) | 2          |
| 11  | Constant-time password comparison   | 🔵 **not-started** | —        | 🟡MEDIUM   | Task 5                | 1          |
| 12  | Add logout function                 | 🔵 **not-started** | —        | 🟡MEDIUM   | Task 6                | 2          |
| 13  | Add CSRF protection                 | 🔵 **not-started** | —        | 🟡MEDIUM   | Arch decision         | 3          |
| 14  | Expand test coverage                | 🔵 **not-started** | —        | 🟡MEDIUM   | Tasks 5-10            | 3          |

---

## Status / Priority Legend

| Symbol | Status      |     | Symbol | Priority                         |
| ------ | ----------- | --- | ------ | -------------------------------- |
| ✅     | completed   |     | 🔴     | CRITICAL — must fix before merge |
| 🟠     | in-progress |     | 🟠     | HIGH — should fix before merge   |
| 🔵     | not-started |     | 🟡     | MEDIUM — next sprint             |
| ⏸️     | blocked     |     | 🟢     | LOW — nice to have               |

---

## 🧊 Frozen Feature Backlog

> **FREEZE NOTICE**: Items below are frozen by owner request. Do NOT implement until freeze is lifted.

| #   | Feature                            | Notes                                    | Status    |
| --- | ---------------------------------- | ---------------------------------------- | --------- |
| F-1 | Metasploit RPC integration         | Connect to MSGRPC for exploit staging    | ❄️ FROZEN |
| F-2 | CVE database enrichment            | Auto-lookup CVEs for discovered services | ❄️ FROZEN |
| F-3 | Model-on-demand hot-swapping       | Switch Ollama model mid-session          | ❄️ FROZEN |
| F-4 | Persistent session storage (Redis) | Replace in-memory store with Redis       | ❄️ FROZEN |
| F-5 | Advanced logging and audit trail   | Structured tamper-evident command logs   | ❄️ FROZEN |
| F-6 | Multi-user support with RBAC       | Admin / operator / viewer roles          | ❄️ FROZEN |
| F-7 | Custom payload generation          | msfvenom UI integration                  | ❄️ FROZEN |
| F-8 | Vulnerability scanning integration | Nuclei / OpenVAS feed into AI context    | ❄️ FROZEN |

---

## File Locations Reference

- **This file**: `.github/TODO.md`
- **Planning file**: `.github/PLANNING.md`
- **Repo config**: `.github/REPO_CONFIG.md`
- **Agent rules**: `.github/copilot-instructions.md`
- **Main code**: `server.js`
- **Frontend**: `public/app.js`, `public/index.html`, `public/style.css`
- **Tests**: `tests/unit/`
