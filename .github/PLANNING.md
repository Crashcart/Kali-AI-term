# 📊 Kali-AI-term Strategic Planning & Coordination

**Last Updated**: 2026-04-11 09:37:00 UTC
**Document Purpose**: Centralized planning for multi-agent coordination, architectural decisions, and project context

---

## 🎯 Active Initiatives

### Attack Plan Overhaul + Gemini Persistence (current session)

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

| # | Issue | Severity | Notes |
|---|-------|----------|-------|
| S-1 | bcrypt password hashing | 🔴 CRITICAL | Replace plaintext comparison |
| S-2 | JWT tokens (replace Base64) | 🔴 CRITICAL | Requires S-1 first |
| S-3 | Minimize error messages | 🔴 CRITICAL | No stack traces to client |
| S-4 | Env var validation at startup | 🟠 HIGH | Fail fast on missing config |
| S-5 | Login rate limiting | 🟠 HIGH | Prevent brute-force on `/api/login` |
| S-6 | Remove auth_secret from DB | 🟠 HIGH | Requires S-2 (JWT) first |
| S-7 | Constant-time password compare | 🟡 MEDIUM | Timing attack prevention |
| S-8 | Logout endpoint | 🟡 MEDIUM | Token invalidation |
| S-9 | CSRF protection | 🟡 MEDIUM | Architecture decision needed |

---

## 🏗️ Architecture Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Gemini config storage | `config/gemini-config.json` (0o600) | Matches `data/auth-secret` pattern already in codebase |
| Attack plan template | 12 phases, all Kali tools | Covers full PTES methodology with tools already in Dockerfile.kali |
| AI phase cap | 15 (was 10) | Allows AI to add extra phases beyond the 12-phase template |
| livePipe default | `false` (confirmation required) | Safer default; explicit opt-in for direct execution |
| Tty mode for exec | `true` | Eliminates docker multiplexed binary frame headers in stream output |

---

## 🤝 Handoff Notes

**For next agent**:
- All three current-session fixes are committed and ready for review
- Security backlog (S-1 through S-9) is the highest-value next work; S-1 (bcrypt) blocks S-2 and S-6
- `config/gemini-config.json` is gitignored-equivalent (created at runtime with 0o600); do NOT commit it
- The frozen feature backlog lives in `.github/TODO.md` — do not start those without owner approval

---

## 📁 Key File Reference

| File | Purpose |
|------|---------|
| `server.js` | Express backend — all routes, auth, AI orchestration |
| `public/app.js` | React-free frontend — terminal UI, attack mode, settings |
| `lib/gemini-provider.js` | Google Gemini API integration |
| `lib/llm-orchestrator.js` | Multi-provider routing with fallback |
| `config/gemini-config.json` | Runtime-generated Gemini key persistence (never commit) |
| `config/llm-state.json` | LLM freeze/unfreeze state |
| `Dockerfile.kali` | Kali container — all pentest tools installed here |
| `.github/copilot-instructions.md` | Enterprise agent rules |
| `.github/TODO.md` | Active + frozen task tracking |
| `.github/PLANNING.md` | This file |
