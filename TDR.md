# Kali Hacker Bot - Technical Design Reference (TDR)

## System Architecture Overview

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     User's Web Browser                       │
│  ┌──────────────────────────────────────────────────────┐   │
│  │   Frontend (HTML/CSS/JS)                             │   │
│  │  - Command input & execution UI                      │   │
│  │  - Dual stream display (Intelligence, Live Wire)     │   │
│  │  - Settings modal with plugin management             │   │
│  │  - LLM model selector                                │   │
│  └────────────────────┬─────────────────────────────────┘   │
└───────────────────────┼─────────────────────────────────────┘
                        │ HTTP/WebSocket
                        │ (Port 31337)
        ┌───────────────▼──────────────────┐
        │   Node.js Express Backend        │
        │   (Docker Container: app)        │
        │                                   │
        │  ┌──────────────────────────────┐│
        │  │ Authentication Layer          ││
        │  │ - Session management (Map)    ││
        │  │ - Token validation            ││
        │  └──────────────────────────────┘│
        │  ┌──────────────────────────────┐│
        │  │ API Endpoints                 ││
        │  │ - /api/docker/exec            ││
        │  │ - /api/ollama/generate        ││
        │  │ - /api/plugins/*              ││
        │  │ - /api/session/*              ││
        │  └────┬──────────────┬───────┬──┘│
        │       │              │       │    │
        └───────┼──────────────┼───────┼────┘
                │              │       │
    ┌───────────▼──────┐   │   │   ┌───▼──────────────┐
    │  Docker Socket   │   │   │   │ Ollama Instance  │
    │  (/var/run/      │   │   │   │ (http://         │
    │   docker.sock)   │   │   │   │  host.docker     │
    │                  │   │   │   │  .internal:      │
    └───────────┬──────┘   │   │   │  11434)          │
                │          │   │   └────▲─────────────┘
    ┌───────────▼──────────▼───▼───────┐│
    │   Kali Linux Container           ││
    │  (container: kali-linux)         ││
    │                                   ││
    │  /bin/bash  ◄─ Docker Exec API   ││
    │  (Running tools: nmap,           ││
    │   sqlmap, metasploit, etc)       ││
    │                                   ││
    └─────────────────────────────────┘│
                                        │
                    ┌───────────────────┘
                    │ HTTP/REST
                    │ (Port 11434)
                    ▼
           ┌──────────────────┐
           │  Ollama Instance │
           │  (Host Machine)  │
           │  - dolphin-mix   │
           │  - neural-chat   │
           └──────────────────┘
```

---

## Docker Architecture & Kali Access

### 1. Container Communication Model

**Node.js App Container** → **Kali Container** communication:

- **Method**: Docker Socket API (`/var/run/docker.sock`)
- **Library**: `dockerode` npm package
- **What it does**: Allows Node.js to execute commands inside Kali container without SSH/networking
- **Security**: Docker socket is mounted as a volume from host; restricted by container capabilities

**How Command Execution Works:**

```
User Input (Browser)
    ↓
Node.js Backend (/api/docker/exec)
    ↓
Dockerode Library (Docker Socket)
    ↓
Docker Daemon on Host
    ↓
Kali Container (bash -c "command")
    ↓
Command Output → Streaming Response
    ↓
Browser (Live Wire Stream)
```

### 2. Docker Compose Services

**Service: app**

- Image: Built from ./Dockerfile (Node.js 18 Alpine)
- Port mapping: 31337 → 3000
- Volume: `/var/run/docker.sock` (Docker socket for control)
- Depends on: kali service
- Network: pentest-net (internal bridge)
- Environment:
  - `OLLAMA_URL=http://host.docker.internal:11434` (routes to host Ollama)
  - `KALI_CONTAINER=kali-linux` (container name to target)

**Service: kali**

- Image: `kalilinux/kali-rolling:latest`
- Container name: `kali-linux` (must match KALI_CONTAINER env var)
- TTY + stdin: Enabled for interactive shell
- Network: pentest-net
- Command: `/bin/bash` (keeps container running)
- Restart: unless-stopped

### 3. Accessing Kali from Node.js

```javascript
// Current implementation in server.js
const docker = new Docker({ socketPath: '/var/run/docker.sock' });

// In /api/docker/exec endpoint:
const container = docker.getContainer(KALI_CONTAINER); // 'kali-linux'

const exec = await container.exec({
  Cmd: ['bash', '-c', command], // Execute bash command
  AttachStdout: true, // Capture output
  AttachStderr: true, // Capture errors
});

const stream = await exec.start({ Detach: false });

// Handle streaming output
stream.on('data', (chunk) => {
  output += chunk.toString();
});

// Send back to client
res.json({ success: true, output, command });
```

**Command Flow Example:**

```
User: "!nmap -sV 192.168.1.100"
↓
Backend receives via /api/docker/exec
↓
Creates Docker exec: bash -c "nmap -sV 192.168.1.100"
↓
Streams output in real-time
↓
Frontend displays in "Live Wire Stream" (grey text)
```

---

## Ollama Integration

### 1. External Ollama Setup

**Why External?**

- Ollama is resource-intensive (GPU acceleration, model weights)
- Better to run on host machine outside Docker
- Can use GPU hardware directly
- Multiple containers can share one Ollama instance

**Connection Method:**

- URL: `http://host.docker.internal:11434`
- Special Docker DNS name that routes back to host machine
- Works on Docker Desktop (Mac/Windows) and Docker on Linux

### 2. Model Management

**Available Models:**

```javascript
// Default models (pre-configured)
- dolphin-mixtral: 70B parameters, excellent for reasoning
- neural-chat:7b: 7B parameters, faster, good for quick queries

// Custom models: Users can pull via /api/ollama/pull endpoint
```

**System Prompt:**

- Pentesting-optimized system prompt in server.js
- Users can override with custom prompt in settings
- Passed to Ollama with each generation request

### 3. API Communication

```javascript
// POST /api/ollama/generate (non-streaming)
POST http://host.docker.internal:11434/api/generate
{
  model: "dolphin-mixtral",
  prompt: "What is SQL injection?",
  system: "You are a pentesting AI...",
  temperature: 0.7
}

// POST /api/ollama/stream (streaming)
// Same endpoint, but with stream: true
// Streams tokens back as SSE (Server-Sent Events)
```

---

## Plugin System Architecture

### 1. Plugin Registration Flow

```
Server Startup
↓
PluginManager.initializeDefaultPlugins()
  - cve-plugin (enabled)
  - threat-intel-plugin (enabled)
  - report-plugin (disabled)
  - export-plugin (disabled)
↓
Plugins stored in Map<name, plugin>
↓
Ready to receive hooks from commands
```

### 2. Hook System & Execution Flow

**Hook Types:**

1. `before:llm-call` - Modify prompt before sending to Ollama
2. `after:llm-response` - Analyze/enhance LLM response
3. `output:analyze` - Process Docker command output

**Execution Flow Example (CVE Plugin):**

```
User executes: "?What vulnerabilities did nmap find?"
↓
Backend: /api/ollama/generate
↓
Plugins execute: before:llm-call hooks
  (e.g., format prompt, add context)
↓
Call Ollama with modified prompt
↓
Get response back
↓
Plugins execute: after:llm-response hooks
  CVE Plugin scans for "CVE-XXXX-XXXXX" patterns
  ↓
  If CVEs found, fetch CVSS scores from NVD API
  ↓
  Append enriched data to response
↓
Send enhanced response to browser
↓
Frontend displays in "Intelligence Stream" (cyan/green)
```

---

## Safety & Guardrails: Attack Targets, Protect Host

### Core Principle

**Bot follows YOUR commands to attack TARGETS while protecting YOUR HOST SYSTEM from accidental self-destruction.**

### The Threat Model

**YES - Attack External Targets:**

```
You command: "!nmap -sV 192.168.1.100"
    ↓
Kali container executes nmap
    ↓
Scans target 192.168.1.100 (YOUR target)
    ↓
YOU fully responsible for legality/authorization
```

**YES - Aggressive Attacks:**

```
You command: "!sqlmap -u http://target.com --batch --dbs"
    ↓
Kali runs SQLi attacks against target.com
    ↓
YOU authorized this attack
    ↓
Output: Databases dumped (if vulnerable)
```

**YES - Destroy Kali Container:**

```
You command: "!rm -rf /"
    ↓
Kali filesystem destroyed (intentionally)
    ↓
Container still recoverable
    ↓
Click "FACTORY RESET" button to recover
```

**NO - Affect Host Machine:**

```
Kali tries: "!ls /../../etc/passwd" (escape container)
    ↓
Docker isolation PREVENTS this
    ↓
Cannot access host /etc
    ↓
Container cannot affect host OS
```

**NO - Other Systems:**

```
Kali tries: "!docker rm other-container"
    ↓
Docker socket is READ-ONLY
    ↓
Cannot delete other containers
    ↓
Socket prevents Docker API write operations
```

### Dangerous Command Detection

**Designed for SELF-PROTECTION (host machine), not TARGET-PROTECTION:**

Commands that trigger warnings (you can still execute):

- `rm -rf /` - Destroys Kali filesystem
- `shutdown`, `poweroff` - Shuts down Kali
- Fork bombs - Rate limited
- Network blocks in Kali

Commands with NO warning (attack tools):

- `nmap -sS -sV 192.168.1.0/24` - OK, it's a scan
- `sqlmap -u http://vulnerable.app` - OK, it's an attack
- `msfvenom -p windows/meterpreter...` - OK, payload generation
- `aircrack-ng -w rockyou.txt wpa.cap` - OK, password cracking

### Recovery Mechanisms

**If you accidentally destroy Kali:**

1. **Kill Processes** - Stops running processes, keeps container running
2. **Restart Container** - Container restarts, filesystem preserved
3. **Factory Reset** - Fresh Kali from image (~30 seconds)

### Container Isolation (HOST PROTECTION)

**Docker provides these namespaces:**

```
Kali container ≠ Host OS
├── Filesystem namespace: /var (container) ≠ /var (host)
├── Process namespace: ps shows only Kali processes
├── Network namespace: eth0 (container) isolated from host network
├── User namespace: root (UID 0 in container) ≠ root (host)
├── IPC namespace: Message queues isolated
└── UTS namespace: Hostname isolated

Even if you become root in Kali:
✗ Cannot see host processes
✗ Cannot modify host files
✗ Cannot access host network
✗ Cannot escalate to host root
```

### Authorization Responsibility

**IMPORTANT: You are responsible for authorization**

This tool helps you attack systems YOU OWN or have PERMISSION to test:

- Your own infrastructure (test lab)
- Client systems under signed pentest agreement
- CTF competitions (authorized)
- Bug bounty programs (within scope)
- Your own study environment

**YOU WILL NOT use this to:**

- Attack systems you don't own/aren't authorized
- Attack 3rd party infrastructure without permission
- Commit crimes

The tool provides:

- ✓ Powerful attack capabilities (intentional)
- ✓ Full audit trail (your actions logged)
- ✓ No restrictions on tools (you control scope)
- ✗ Legal protection (you alone are responsible)

### Audit & Logging (Evidence Trail)

**Every attack command logged:**

```javascript
commandHistory stores:
[
  {
    command: "nmap -sV 192.168.1.100",
    timestamp: "2024-03-29T10:30:00Z",
    output: "Starting Nmap 7.92...",
    duration: "45s"
  },
  {
    command: "sqlmap -u http://target.com?id=1",
    timestamp: "2024-03-29T10:45:00Z",
    output: "Database detected: MySQL..."
  }
]

// Export for:
// - Pentest report documentation
// - Client evidence
// - Timeline of testing
// - Bug bounty submission proof
```

---

## Summary: Attack Targets, Protect Host

| Target               | Commands             | Restrictions            | Recovery                   |
| -------------------- | -------------------- | ----------------------- | -------------------------- |
| **External Systems** | All pentesting tools | None (except auth)      | Your responsibility        |
| **Kali Container**   | Destructive commands | Warnings on rm -rf      | Kill/Restart/Reset buttons |
| **Host Machine**     | None (isolated)      | Docker socket read-only | Auto-protected by Docker   |
| **Other Containers** | None (isolated)      | Socket prevents access  | Auto-protected by Docker   |

---

## Key Technical Decisions

### 1. Why Dockerode instead of SSH?

- ✓ No SSH server needed in Kali container
- ✓ Direct Docker API = more reliable
- ✓ Automatic stdio handling
- ✓ Better error handling

### 2. Why external Ollama?

- ✓ Can use GPU on host machine
- ✓ Models loaded once, shared by all containers
- ✓ Resource management easier
- ✓ host.docker.internal routing is standard

### 3. Why Map-based storage instead of database?

- ✓ In-memory = fast
- ✓ Sessions don't need persistence between restarts
- ✓ Simpler, no database dependencies
- ✓ OK for single-user tool

### 4. Why localStorage for settings instead of backend database?

- ✓ Avoids database dependency
- ✓ Settings are user-specific, not shared
- ✓ API calls provide fallback to server state
- ✓ Works offline-ish (cached data)

---

## Verification Checklist

Before deployment, verify:

- [ ] Docker daemon accessible on host
- [ ] `/var/run/docker.sock` mounted in app container (read-only)
- [ ] Kali container named exactly `kali-linux`
- [ ] Ollama running on host at `http://host.docker.internal:11434`
- [ ] Models `dolphin-mixtral` and `neural-chat:7b` available
- [ ] Node.js 18+ with npm
- [ ] Port 31337 available on host
- [ ] Auth secret can be randomized in .env
- [ ] Docker socket prevents privilege escalation to host
- [ ] Kali container isolation is confirmed (cannot access host filesystem)
- [ ] Dangerous command patterns are detected before execution
- [ ] Command confirmation modal appears for all commands
- [ ] Recovery mechanisms (kill/restart/reset) work reliably
