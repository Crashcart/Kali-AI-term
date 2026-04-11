# Repository Configuration — Kali-AI-term

> **Purpose**: Project-specific settings for AI agents. Read this alongside `copilot-instructions.md`.  
> **Last Updated**: 2026-04-11  
> 🔒 **GOVERNANCE FILE** — This file is protected by Rule 10 in `copilot-instructions.md`.  
> Any AI editing this file must follow the full A-to-Z workflow, document the change in PLANNING.md,  
> and flag it for human review. Never remove or weaken entries without human approval.

---

## PROJECT OVERVIEW

**Name**: Kali-AI-term  
**Type**: Node.js web application (Express backend + vanilla JS frontend)  
**Description**: AI-powered penetration testing terminal with Docker-based Kali Linux container, multi-LLM orchestration (Ollama + Gemini), and cyberpunk UI  
**Target Hardware**: Low-to-mid range systems (4–8 GB RAM)  
**Default AI Model**: `phi3:mini` (~2.2 GiB)

---

## COMMANDS

| Action | Command |
|--------|---------|
| **Run tests** | `npm test` |
| **Run unit tests** | `npm run test:unit` |
| **Run integration tests** | `npm run test:integration` |
| **Lint (check)** | `npm run lint:check` |
| **Lint (fix)** | `npm run lint` |
| **Format (check)** | `npm run format:check` |
| **Format (fix)** | `npm run format` |
| **Security audit** | `npm audit` |
| **Build Docker** | `docker build .` |
| **Validate compose** | `docker-compose config` |
| **Start dev** | `docker-compose up` |

---

## FILES TO MONITOR

Read these before editing anything in the project.

### Governance (read first every session)
| File | Purpose |
|------|---------|
| `.github/copilot-instructions.md` | Universal agent rules |
| `.github/REPO_CONFIG.md` | This file — project-specific config |
| `.github/TODO.md` | Active task list |
| `.github/PLANNING.md` | Planning, context, and handoff notes |

### Core Application
| File | Description | Conflict Risk |
|------|-------------|:------------:|
| `server.js` | Express backend — all routes, middleware, AI orchestration | 🟡 MEDIUM |
| `public/app.js` | Frontend — terminal UI, attack mode, settings | 🟡 MEDIUM |
| `public/index.html` | Frontend HTML — layout, modals, HUD | 🟡 MEDIUM |
| `package.json` | Dependencies & scripts | 🟡 MEDIUM |
| `docker-compose.yml` | Container definitions | 🟡 MEDIUM |
| `.env.example` | Environment variable spec | 🟢 LOW |

### Feature Libraries
| File | Description |
|------|-------------|
| `lib/llm-provider.js` | Abstract LLM base interface |
| `lib/llm-orchestrator.js` | Multi-LLM routing & fallback |
| `lib/ollama-provider.js` | Ollama API integration |
| `lib/gemini-provider.js` | Gemini API integration |
| `lib/multi-llm-api-routes.js` | Multi-LLM REST endpoints |
| `lib/sandbox-detector.js` | Platform detection |
| `lib/sandbox-config.js` | Security preset templates |
| `lib/sandbox-manager.js` | Sandbox lifecycle management |
| `lib/sandbox-api-routes.js` | Sandbox REST endpoints |
| `lib/install-logger.js` | Logging utilities |
| `lib/shell-commander.js` | Shell command execution |
| `lib/file-manager.js` | File management utilities |
| `lib/reverse-shell-handler.js` | Reverse shell handling |

### Database & Schema
| File | Description |
|------|-------------|
| `db/schema.sql` | Database schema — check before migrations |
| `db/init.js` | DB initialization — check on schema changes |

### Tests
| File | Description |
|------|-------------|
| `tests/` | All test files — must pass before any PR |
| `jest.config.js` | Test configuration |

### Install & Runtime Scripts
| File | Description |
|------|-------------|
| `install.sh` | Bash installer |
| `install-full.sh` | Full installer with all services |
| `install.js` | Node.js installer |
| `uninstall.sh` | Cleanup script |
| `collect-logs.sh` | Log collection |
| `Dockerfile` | App container image |
| `Dockerfile.kali` | Kali Linux container — all pentest tools |

### Documentation
| File | Description |
|------|-------------|
| `README.md` | Primary documentation |
| `MULTI_LLM_ORCHESTRATION.md` | Multi-LLM feature docs |
| `SANDBOX_INTEGRATION.md` | Sandbox feature docs |
| `DIAGNOSTICS.md` | Diagnostic procedures |

---

## HIGH-CONFLICT FILES

These files are frequently edited by multiple agents. Check `PLANNING.md` before modifying.

| File | Risk | Why |
|------|:----:|-----|
| `.github/copilot-instructions.md` | 🔴 HIGH | Multiple agents update rules |
| `server.js` | 🟡 MEDIUM | Routes, middleware, and integrations all live here |
| `package.json` | 🟡 MEDIUM | Dependency version conflicts |
| `install.sh` / `install-full.sh` | 🟡 MEDIUM | Feature and safety changes overlap |
| `docker-compose.yml` | 🟡 MEDIUM | Service configs updated in parallel |

---

## PROJECT CONVENTIONS

- **No large AI models as defaults** — target hardware is 4–8 GB RAM
- **Curated model list**: phi4-mini, phi3:mini, gemma3:4b, qwen2.5:3b, llama3.2:3b, tinyllama
- **Install scripts auto-pull** `phi3:mini` if Ollama has zero models
- **Intel GPU Ollama** integration via Settings → AI/LLM quick-connect
- **Gemini config** stored at `config/gemini-config.json` (mode 0o600, never committed)
- **LLM state** stored at `config/llm-state.json` (runtime, never committed)
- **Attack plan** follows 12-phase PTES methodology
- **Git hooks**: `.githooks/pre-commit` (ESLint, Prettier), `.githooks/commit-msg` (conventional commits)

---

## CI/CD WORKFLOWS

| Workflow | Trigger | Purpose |
|----------|---------|---------|
| `test.yml` | Push/PR | Unit + integration tests, security audit |
| `lint.yml` | Push/PR | ESLint + Prettier validation |
| `build.yml` | Push/PR to main/test | Docker image build + compose validation |
| `code-review-gate.yml` | PR to main/test | Conflict detection, static review, planning docs check |
| `merge-test-to-main.yml` | PR from test→main | Auto-merge after approval |
| `process-features.yml` | Feature queue processing | Feature freeze management |

---

## BRANCH STRATEGY

| Branch | Purpose |
|--------|---------|
| `main` | Production-ready, protected |
| `test` | Pre-production staging |
| `fix/issue-N` | Bug fix branches |
| `feat/issue-N` | Feature branches |
| `docs/name` | Documentation branches |
| `chore/name` | Maintenance branches |

---

## SECURITY BACKLOG

| ID | Issue | Severity | Dependencies |
|----|-------|----------|-------------|
| S-1 | bcrypt password hashing | 🔴 CRITICAL | — |
| S-2 | JWT tokens (replace Base64) | 🔴 CRITICAL | S-1 |
| S-3 | Minimize error messages | 🔴 CRITICAL | — |
| S-4 | Env var validation at startup | 🟠 HIGH | — |
| S-5 | Login rate limiting | 🟠 HIGH | — |
| S-6 | Remove auth_secret from DB | 🟠 HIGH | S-2 |
| S-7 | Constant-time password compare | 🟡 MEDIUM | S-1 |
| S-8 | Logout endpoint | 🟡 MEDIUM | S-2 |
| S-9 | CSRF protection | 🟡 MEDIUM | — |
