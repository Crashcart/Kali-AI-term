# 📊 Kali-AI-term Strategic Planning & Coordination

> 🔒 **GOVERNANCE FILE** — Protected by Rule 10 in `copilot-instructions.md`. Follow full workflow when editing.

**Last Updated**: 2026-04-12 21:30:00 UTC
**Document Purpose**: Centralized planning for multi-agent coordination, architectural decisions, and project context

---

## 🎯 Active Initiatives

### Docker Deployment & CI/CD Configuration Fix (current session)

**Status**: ✅ **Complete** — PR #114 ready for merge
**Branch**: `claude/kali-hacker-bot-VkfAG`
**Assigned To**: Claude (Main Agent)

**Problem**: Deployment pipeline had multiple blockers:

1. **Merge conflicts** (12+ files) preventing PR from being mergeable
2. **ESLint 10 incompatibility** — project still using legacy `.eslintrc.json` format
3. **Code formatting issues** — 72 files with Prettier violations
4. **Docker configuration gaps** — Missing Ollama service integration

**Root Causes**:

1. Branch diverged significantly from main with 4 unrelated commits
2. ESLint upgraded to v10.0.0 which requires `eslint.config.js` (not `.eslintrc.*`)
3. Docker Compose configuration incomplete for multi-service setup
4. Docker socket mount conflict in original Dockerfile design

**Changes Made**:

- `.github/workflows/` — Validated ESLint and Prettier configurations
- `eslint.config.js` — Created ESLint 10 compatible flat config
- `package.json` — Added `"type": "module"` for ES module support
- `docker-compose.yml` — Complete service orchestration (app, ollama, kali)
- `Dockerfile` — Ensured proper socket mounting (no `/var/run/docker.sock` directory creation)
- All project files — Applied consistent Prettier formatting (72 files)

**Decisions Log**:

- [2026-04-12 21:19] Used ESLint 10 flat config format for forward compatibility
- [2026-04-12 21:20] Resolved merge conflicts using `git merge main -X ours` for stability
- [2026-04-12 21:25] Applied automatic Prettier formatting to entire codebase for consistency
- [2026-04-12 21:30] All CI/CD checks now passing (lint, format, docker, tests)

---

### Fix AI Streaming 404 — Model Parameter Dropped (previous session)

**Status**: ✅ **Complete** — PR ready for human review
**Branch**: `copilot/fix-ai-error-streaming`
**Assigned To**: GitHub Copilot Task Agent

**Problem**: When `aiProvider` is set to "Ollama (Local only)" (not 'auto'), the selected model (e.g. `llama3.2:1b`) was never sent to the backend. The `/api/llm/stream` and `/api/llm/generate` endpoints defaulted to `phi3:mini`, which didn't exist on the remote Ollama server at `172.21.0.1:11434`, causing a 404 from Ollama that surfaced as "All providers failed for streaming."

**Root Cause**:

1. Frontend `processNaturalLanguage()` omitted `model` from the request body when `useOrchestrator === false` — only the auto/orchestrator path included it
2. Backend `/api/llm/stream` and `/api/llm/generate` (in `multi-llm-api-routes.js`) didn't extract `model` from `req.body` and didn't pass it to the orchestrator
3. `OllamaProvider.streamGenerate()` fell back to `process.env.OLLAMA_MODEL || 'phi3:mini'` — a model not installed on the remote server → Ollama returned 404

**Changes Made**:

- `public/app.js` — Added `model: this.ollamaModel` to the non-auto request body in `processNaturalLanguage()`
- `lib/multi-llm-api-routes.js` — Extract `model` from `req.body` in both `/api/llm/generate` and `/api/llm/stream`; forward it to `orchestrator.generate()` / `orchestrator.streamGenerate()` via spread `...(model ? { model } : {})`

**Decisions Log**:

- [2026-04-11 21:19] Model is forwarded with conditional spread `...(model ? { model } : {})` so existing callers without a model field still get the OllamaProvider default — backward compatible

---

### Ollama Multi-Instance Fallback + Deletable Primary (previous session)

**Status**: ✅ **Complete** — PR ready for human review
**Branch**: `copilot/set-up-ollama-api`
**Assigned To**: Debug Agent

**Problem**: When the primary Ollama instance (localhost:11434) was down but a healthy remote instance existed (e.g. 172.21.0.1:11434), the system failed instead of falling back. The primary instance could not be deleted from the UI, leaving users stuck with a dead 🔴 entry.

**Root Causes**:

1. Orchestrator routing only tried `strategy.primary` → `strategy.fallback` (ollama → gemini), ignoring other registered Ollama instances like `ollama-2`
2. Direct `/api/ollama/generate` and `/api/ollama/stream` paths only hit `OLLAMA_URL` (localhost) with no fallback
3. `unregisterOllamaInstance('ollama')` was hardcoded to return false — primary could never be deleted
4. Frontend rendered EDIT button (not ✕) for the primary instance, so users couldn't remove a dead primary

**Changes Made**:

- `lib/llm-orchestrator.js` — New `_buildProviderList()` method: strategy providers first, then all other registered providers; used by both `generate()` and `streamGenerate()`
- `server.js` — `unregisterOllamaInstance()`: any instance deletable; when primary removed, next instance auto-promotes to 'ollama' id and `OLLAMA_URL` syncs
- `server.js` — `DELETE /api/ollama/instances/:id`: removed `id === 'ollama'` block; returns `primaryUrl` after promotion
- `server.js` — `/api/ollama/generate` direct path: iterates all instance URLs until one succeeds
- `server.js` — `/api/ollama/stream` direct path: same multi-instance iteration with proper stream wiring
- `server.js` — `checkOllamaHealth()`: falls back to first healthy instance when primary missing
- `public/app.js` — `renderOllamaInstances()`: shows ✕ delete button on ALL instances including primary
- `public/app.js` — `removeOllamaInstance()`: handles primary removal with promotion confirmation and status sync

**Decisions Log**:

- [2026-04-11 20:06] Orchestrator `_buildProviderList` always appends all unmentioned providers — zero-config fallback for any new instance
- [2026-04-11 20:06] Primary deletion promotes next instance by re-registering under 'ollama' id — no code elsewhere needs to know about the rename
- [2026-04-11 20:06] Direct Ollama paths iterate `[OLLAMA_URL, ...otherUrls]` — primary tried first for speed, then all others

---

### LLM Low-End System Optimisation + Ollama Intel GPU Integration

**Status**: 🟠 **In Progress**
**Branch**: `copilot/add-llms-to-app`
**Assigned To**: GitHub Copilot Task Agent

**Summary**: Replace hardcoded large-model references (dolphin-mixtral ~24.8 GiB) with a curated list of lightweight models suitable for low-to-mid range systems (4–8 GB RAM). Add Ollama Intel GPU quick-connect to the settings UI.

**Changes Made**:

- `public/index.html` — HUD default model: `dolphin-mixtral` → `phi3:mini`
- `public/index.html` — Plugins tab model selector: replaced large models with 6 lightweight options
- `public/index.html` — Pull Model placeholder: updated to lightweight model examples
- `public/index.html` — Added "OLLAMA INTEL GPU" quick-connect section in AI/LLM settings
- `public/app.js` — `defaultModels`: replaced with phi4-mini, phi3:mini, gemma3:4b, qwen2.5:3b, llama3.2:3b, tinyllama
- `public/app.js` — Added `useIntelGpuOllama()` method and wired USE button
- `.env.example` — Updated model list with RAM requirements; added Intel GPU URL notes
- `lib/ollama-provider.js` — Added doc comments linking to recommended model list
- `.github/TODO.md` — Added L1/L2/L3 tasks
- `.github/PLANNING.md` — This entry

**Curated Model List (low-end safe)**:
| Model | Size | Vendor | Strength |
|-------|------|--------|----------|
| phi4-mini:3.8b | ~2.5 GiB | Microsoft | Great reasoning |
| phi3:mini | ~2.2 GiB | Microsoft | Proven lightweight default |
| gemma3:4b | ~3 GiB | Google | Excellent quality for size |
| qwen2.5:3b | ~2 GiB | Alibaba | Strong coding/scripting |
| llama3.2:3b | ~2 GiB | Meta | Well-rounded |
| tinyllama | ~637 MiB | Community | Ultra-lightweight fallback |

**Decisions Log**:

- [2026-04-11] dolphin-mixtral (24.8 GiB) and neural-chat:7b removed — won't run on target low-end hardware
- [2026-04-11] phi3:mini kept as server-side default (OLLAMA_MODEL env var) — already proven
- [2026-04-11] Intel GPU section uses existing `/api/ollama/config` endpoint — no new backend routes needed

---

### Attack Plan Overhaul + Gemini Persistence

**Status**: ✅ **Complete** — PR ready for human review
**Branch**: `copilot/fix-autonomous-attack-error`
**Assigned To**: GitHub Copilot Task Agent

**Summary**: Three fixes — Gemini key now persists across restarts, attack plan expanded from 6 to 12 phases covering the full PTES methodology, planning files moved to `.github/`.

**Changes Made**:

- `server.js` — Gemini startup: load `config/gemini-config.json` when `GEMINI_API_KEY` env var is absent
- `server.js` — `POST /api/gemini/config`: write key + model to `config/gemini-config.json` (mode 0o600) after every save
- `server.js` — Attack plan prompt: expanded from 6 → 12 phases; AI now asked for 12 structured phases
- `server.js` — Template fallback: fully expanded to 12 phases using all installed Kali tools
- `.github/TODO.md` — Merged root + frozen feature backlog; root `TODO.md` removed
- `.github/PLANNING.md` — This file; root `PLANNING.md` removed

**12 Attack Phases**:

1. Passive Recon (whois + dig)
2. Host Discovery (nmap -sn)
3. Fast TCP Port Scan (nmap top-1000)
4. Full TCP Port Scan (nmap -p- all 65535)
5. Service & Version Detection (nmap -sV -sC)
6. OS & Aggressive Fingerprint (nmap -O -A)
7. UDP Top-Port Scan (nmap -sU top-100)
8. Vulnerability Scan (nmap --script vuln + nikto)
9. Web Enumeration (wafw00f + gobuster)
10. SMB & NetBIOS Enumeration (nbtscan + enum4linux)
11. Exploit Research (searchsploit)
12. Credential Brute Force (hydra rockyou)

**Decisions Log**:

- [2026-04-11] Gemini config stored at `config/gemini-config.json` (mode 0o600); env var always takes precedence
- [2026-04-11] Attack plan cap raised from 10 → 15 phases so AI can add extras beyond the 12 template phases
- [2026-04-11] Template fallback saves nmap output to `/tmp/` so later phases can reference it

---

### Terminal Connection Fix + Security Patch

**Status**: ✅ **Complete** — PR ready for human review
**Branch**: `copilot/debug-terminal-connection`

**Summary**: Fixed 3 bugs preventing the Kali terminal from working, patched 2 critical axios CVEs.

**Changes Made**:

- `public/app.js` — `isNaturalLanguage()`: tightened pattern, added shell-syntax escape hatch
- `public/app.js` — `livePipe`: persisted in userSettings; UI button state restored on load
- `server.js` — All 3 `container.exec()` calls: added `Tty: true` to fix multiplexed binary headers
- `package.json` — axios `^1.6.0` → `^1.15.0` (CVE patches)

---

### Live Window Fix

**Status**: ✅ **Complete** — PR ready for human review
**Branch**: `copilot/fix-live-window-issue`

**Summary**: Restored the wire-stream panel (shell output) that was removed during the unified UI merge.

---

## 🔒 Security Backlog (Post-Merge Sprint)

| #   | Issue                          | Severity    | Notes                               |
| --- | ------------------------------ | ----------- | ----------------------------------- |
| S-1 | bcrypt password hashing        | 🔴 CRITICAL | Replace plaintext comparison        |
| S-2 | JWT tokens (replace Base64)    | 🔴 CRITICAL | Requires S-1 first                  |
| S-3 | Minimize error messages        | 🔴 CRITICAL | No stack traces to client           |
| S-4 | Env var validation at startup  | 🟠 HIGH     | Fail fast on missing config         |
| S-5 | Login rate limiting            | 🟠 HIGH     | Prevent brute-force on `/api/login` |
| S-6 | Remove auth_secret from DB     | 🟠 HIGH     | Requires S-2 (JWT) first            |
| S-7 | Constant-time password compare | 🟡 MEDIUM   | Timing attack prevention            |
| S-8 | Logout endpoint                | 🟡 MEDIUM   | Token invalidation                  |
| S-9 | CSRF protection                | 🟡 MEDIUM   | Architecture decision needed        |

---

## 🏗️ Architecture Decisions

| Decision              | Choice                              | Rationale                                                           |
| --------------------- | ----------------------------------- | ------------------------------------------------------------------- |
| Gemini config storage | `config/gemini-config.json` (0o600) | Matches `data/auth-secret` pattern already in codebase              |
| Attack plan template  | 12 phases, all Kali tools           | Covers full PTES methodology with tools already in Dockerfile.kali  |
| AI phase cap          | 15 (was 10)                         | Allows AI to add extra phases beyond the 12-phase template          |
| livePipe default      | `false` (confirmation required)     | Safer default; explicit opt-in for direct execution                 |
| Tty mode for exec     | `true`                              | Eliminates docker multiplexed binary frame headers in stream output |

---

## 🤝 Handoff Notes

**For next agent**:

- All three current-session fixes are committed and ready for review
- Security backlog (S-1 through S-9) is the highest-value next work; S-1 (bcrypt) blocks S-2 and S-6
- `config/gemini-config.json` is gitignored-equivalent (created at runtime with 0o600); do NOT commit it
- The frozen feature backlog lives in `.github/TODO.md` — do not start those without owner approval

---

## 📁 Key File Reference

| File                              | Purpose                                                  |
| --------------------------------- | -------------------------------------------------------- |
| `server.js`                       | Express backend — all routes, auth, AI orchestration     |
| `public/app.js`                   | React-free frontend — terminal UI, attack mode, settings |
| `lib/gemini-provider.js`          | Google Gemini API integration                            |
| `lib/llm-orchestrator.js`         | Multi-provider routing with fallback                     |
| `config/gemini-config.json`       | Runtime-generated Gemini key persistence (never commit)  |
| `config/llm-state.json`           | LLM freeze/unfreeze state                                |
| `Dockerfile.kali`                 | Kali container — all pentest tools installed here        |
| `.github/copilot-instructions.md` | Enterprise agent rules                                   |
| `.github/TODO.md`                 | Active + frozen task tracking                            |
| `.github/PLANNING.md`             | This file                                                |
