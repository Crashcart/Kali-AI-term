# 🗂️ Kali-AI-term Feature Backlog

> **⚠️ FREEZE NOTICE**: All items in this file are **FROZEN** by owner request.
> **Do NOT implement, prototype, or begin work on any item below until the freeze is explicitly lifted.**
> When the freeze is lifted, move the relevant item(s) to the root `TODO.md` as a tracked task.

---

## 🧊 Frozen Features

These features were previously listed as "Future Enhancements" in the README.
They have been moved here for planning purposes while implementation is on hold.

| # | Feature | Notes | Status |
|---|---------|-------|--------|
| F-1 | **Metasploit RPC integration for exploit staging** | Connect to Metasploit's MSGRPC interface to stage and manage exploits from the terminal UI | ❄️ FROZEN |
| F-2 | **CVE database enrichment for identified services** | Automatically look up CVEs for services discovered during scans and annotate output | ❄️ FROZEN |
| F-3 | **Model-on-demand hot-swapping** | Allow switching the active Ollama model mid-session without restarting the server | ❄️ FROZEN |
| F-4 | **Persistent session storage (Redis)** | Replace in-memory session store with Redis for durability across server restarts | ❄️ FROZEN |
| F-5 | **Advanced logging and audit trail** | Structured, tamper-evident command/response logging with export and search support | ❄️ FROZEN |
| F-6 | **Multi-user support with role-based access** | Support multiple concurrent users with distinct roles (admin, operator, viewer) | ❄️ FROZEN |
| F-7 | **Custom payload generation** | In-terminal generation and management of custom payloads (shellcode, scripts, etc.) | ❄️ FROZEN |
| F-8 | **Vulnerability scanning integration** | Integrate with scanners (e.g. OpenVAS, Nuclei) to feed scan results into the AI context | ❄️ FROZEN |

---

## 📋 Planning Notes

### F-1 — Metasploit RPC integration
- Metasploit exposes an MSGRPC interface (default port 55553) that can be used to start listeners, run modules, and retrieve session data.
- Integration point: new `lib/msf-provider.js`, new REST routes in server, UI panel for session/module management.
- Security concern: RPC credentials must never be logged; restrict to loopback only.
- Dependency: Metasploit must be installed in the Kali container.

### F-2 — CVE database enrichment
- Could use NVD REST API (`https://services.nvd.nist.gov/rest/json/cves/2.0`) or a local mirror.
- Trigger: parse service/version strings from nmap/tool output, query for matching CVEs, inject into AI context.
- Rate-limit awareness: NVD public API allows ~5 requests/30 s without an API key.

### F-3 — Model-on-demand hot-swapping
- Ollama supports `/api/tags` and `/api/pull`; a hot-swap endpoint can call `unload` then `pull`/`load`.
- UI needs a model selector dropdown and streaming progress indicator.
- Must handle in-flight requests gracefully (queue or reject during swap).

### F-4 — Persistent session storage (Redis)
- Replace `express-session` in-memory store with `connect-redis`.
- Redis can run as an additional Docker service in `docker-compose.yml`.
- Requires new env vars: `REDIS_HOST`, `REDIS_PORT`, `REDIS_PASSWORD`.
- Migration path: in-memory store remains default; Redis is opt-in via env.

### F-5 — Advanced logging and audit trail
- Structured JSON logs per command/response pair with timestamp, user, session ID.
- Output targets: rotating file (winston + winston-daily-rotate-file), optional syslog.
- Tamper-evidence: HMAC each log entry, sign batches periodically.
- Export: API endpoint to download logs as JSONL or CSV.

### F-6 — Multi-user support with RBAC
- Roles: `admin` (full access), `operator` (run commands, no config), `viewer` (read-only history).
- Auth layer: extend current token model or migrate to JWT with role claims.
- DB schema: add `users` table with role column; sessions reference user ID.
- UI: user management panel (admin only), per-session username display.

### F-7 — Custom payload generation
- Expose `msfvenom` (already in Kali container) via a structured UI: platform, arch, format, LHOST/LPORT.
- Store generated payloads with metadata in DB; allow download and re-use.
- Security: payloads are only generated, never auto-executed; require explicit confirmation to deploy.

### F-8 — Vulnerability scanning integration
- Candidates: Nuclei (fast, template-based), OpenVAS/GVM (comprehensive), nmap NSE scripts.
- Integration point: scan job runner in backend, results parsed and stored in DB, fed into AI context window.
- UI: scan configuration form, live output stream, findings panel with severity badges.

---

## How to Lift the Freeze

1. Owner removes the freeze notice from this file for the specific feature(s).
2. The feature row status changes from `❄️ FROZEN` to `🔵 not-started`.
3. A corresponding task is added to the root `TODO.md` with full detail.
4. A GitHub issue is opened to track implementation.
5. Normal enterprise workflow applies from that point forward.
