# 🎯 Kali Hacker Bot

Elite browser-based penetration testing terminal that bridges a local Ollama instance (for AI reasoning) with a Kali Linux Docker container (for live execution).

## Features

### 🖥️ Interface Architecture
- **Dual-Stream View**: Separate intelligenced streams for AI reasoning (cyan/green) and live Docker output (grey/white)
- **Professional Terminal Aesthetics**: Dark mode, glowing LEDs, cyberpunk styling
- **Persistent HUD**: Real-time display of `$TARGET_IP`, `$LOCAL_IP`, `$LISTENING_PORT`
- **Command Bar**: Unified input for natural language queries and direct system commands
- **Status Indicators**: Live connectivity LEDs for Docker, Ollama, and Target

### ⚡ Core Capabilities
- **Natural Language Processing**: Send natural language queries processed by Ollama LLM
- **Docker Integration**: Execute commands directly in Kali Linux container
- **Auto-Pilot Mode**: AI suggests next logical command based on previous output
- **Live-Pipe Mode**: Direct command execution without confirmation
- **Kill Switch**: Emergency termination of all active processes
- **Session Burn**: One-touch purge of cache, context, and Docker state

### 🔐 Security
- Token-based authentication with session management
- Rate limiting on API endpoints
- Helmet.js security headers
- CORS configuration for localhost
- Command confirmation layer (when Live-Pipe disabled)

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│  Browser (React Terminal UI)                            │
│  ├─ Intelligence Stream (AI Output)                     │
│  ├─ Live Wire Stream (Docker Output)                    │
│  ├─ Command Bar (Natural Language + System Commands)    │
│  └─ Status LEDs & HUD                                   │
└─────────────────────────────────────────────────────────┘
           ↓
┌─────────────────────────────────────────────────────────┐
│  Backend (Node.js/Express)                              │
│  ├─ Docker Socket API (Kali Container Control)          │
│  ├─ Ollama API (LLM Reasoning)                           │
│  ├─ Authentication & Session Management                 │
│  └─ System Status Monitoring                            │
└─────────────────────────────────────────────────────────┘
           ↓
┌─────────────────────────────────────────────────────────┐
│  Docker Containers                                      │
│  ├─ Kali Linux (Execution Environment)                  │
│  └─ Bridge Network (Inter-container communication)      │
│                                                         │
│  Host Services                                          │
│  └─ Ollama (LLM Service, port 11434)                    │
└─────────────────────────────────────────────────────────┘
```

## Technical Design Reference

**For detailed architecture, security model, and design decisions**, see [TDR.md](TDR.md)

Key topics covered:
- Docker Socket API & Kali access mechanism
- Ollama integration & model management
- Plugin system architecture
- Safety & isolation guardrails (attack targets, protect host)
- Container isolation details
- Authorization responsibility model
- Command audit trail & logging

## Quick Start

### Easy Install (Recommended)

**One-command installation with automatic setup:**

```bash
git clone https://github.com/Crashcart/Kali-AI-term.git
cd Kali-AI-term
./install.sh
```

The script will:
- ✓ Check all prerequisites (Docker, Node.js, Ollama)
- ✓ Generate secure `.env` configuration
- ✓ Install dependencies
- ✓ Start Docker containers
- ✓ Display access credentials

Then open `http://localhost:31337` and start pentesting!

### Manual Installation

**Prerequisites**
- Docker & Docker Compose installed
- Port 31337 available (Web UI)
- Ollama already installed and running on host (port 11434)

### Installation & Deployment

1. **Clone and navigate to repository**
   ```bash
   cd tipistore
   ```

2. **Configure environment (optional)**
   ```bash
   cp .env.example .env
   # Edit .env with your settings (optional)
   ```

3. **Start the system**
   ```bash
   docker-compose up -d
   ```

4. **Access the terminal**
   ```
   Open browser: http://localhost:31337
   Default password: kalibot
   ```

### Stopping the System
```bash
docker-compose down
```

## Usage Guide

### Authentication
1. Navigate to `http://localhost:31337`
2. Enter the admin password (default: `kalibot`)
3. You're logged in for 24 hours

### Command Types

**Natural Language Queries** (processed by Ollama)
```
> what are the services running on the target?
> how do I scan for SQL injection vulnerabilities?
> find open ports on 192.168.1.1
```

**System Commands** (executed in Kali container)
```
> nmap -sV 192.168.1.1
> sqlmap -u http://target.com --dbs
> hydra -l admin -P /usr/share/wordlists/rockyou.txt http://target.com
```

### Modes

**Auto-Pilot Mode**
- AI analyzes command output
- Suggests next logical step
- Great for guided penetration testing

**Live-Pipe Mode**
- Commands execute immediately
- No confirmation dialog
- Use with caution on production systems

### Emergency Controls

**Kill Switch (⏹ KILL)**
- Terminates all active processes in Kali container
- Clears active connections

**Burn Session (🔥 BURN)**
- Purges browser cache
- Resets LLM context
- Reverts Docker container to base image
- Clears all session traces

## Configuration

### Environment Variables

```bash
NODE_ENV=production          # Environment
PORT=31337                   # Web server port
OLLAMA_URL=http://ollama:11434  # Ollama API endpoint
KALI_CONTAINER=kali-linux    # Container name
ADMIN_PASSWORD=kalibot       # Login password
AUTH_SECRET=<random-uuid>    # Session secret
LOG_LEVEL=info               # Logging level
```

### API Endpoints

#### Authentication
- `POST /api/auth/login` - Authenticate with password

#### Docker
- `POST /api/docker/exec` - Execute command in Kali
- `GET /api/docker/status` - Get container status
- `GET /api/docker/stream/:execId` - Stream command output

#### Ollama
- `POST /api/ollama/generate` - Generate LLM response
- `POST /api/ollama/stream` - Stream LLM response
- `GET /api/ollama/models` - List available models

#### System
- `GET /api/system/status` - Check system health

## Development

### Project Structure
```
tipistore/
├── server.js              # Express backend
├── public/
│   ├── index.html        # UI markup
│   ├── style.css         # Terminal styling
│   └── app.js            # Frontend application
├── Dockerfile            # App container
├── docker-compose.yml    # Orchestration
├── package.json          # Dependencies
├── .env.example          # Configuration template
└── README.md             # This file
```

### Building for Production

The application is fully Dockerized. To build and deploy:

```bash
# Build image
docker build -t kali-hacker-bot:latest .

# Run with custom docker-compose
docker-compose -f docker-compose.yml up -d
```

## Installation Methods

### Node.js-Based Installation Scripts

We provide modern Node.js installation scripts with comprehensive logging and diagnostics:

#### Basic Installation
```bash
node install.js
```
Quick setup with essential checks and logging. Good for experienced users.

#### Full Installation (Recommended)
```bash
node install-full.js
```
Advanced diagnostics including:
- ✓ Detailed prerequisite verification
- ✓ System information gathering
- ✓ Docker system analysis
- ✓ Port availability checking
- ✓ Dependency installation with fallbacks
- ✓ Container health monitoring
- ✓ Comprehensive diagnostics report

#### Update Installation
```bash
node update.js
```
Updates existing installation:
- Pulls latest code
- Updates dependencies
- Rebuilds Docker image
- Restarts containers with health checks
- Verifies installation

#### Uninstallation
```bash
node uninstall.js
```
Safely removes all containers and data (preserves logs for reference).

### Legacy Bash Script
```bash
bash install.sh
```
Original installation script (still works, but has less detailed logging).

## Troubleshooting & Log Files

### Installation Logs and Diagnostics

All installation, update, and uninstall operations create detailed log files:

**Log File Locations:**
```
install-TIMESTAMP.log          # Timestamped installation log
install.log                    # Symlink to latest installation log
install.diagnostic             # JSON diagnostic report with system state
update-TIMESTAMP.log           # Update operation log
uninstall-TIMESTAMP.log        # Uninstall operation log
```

### Viewing Logs

**Recent installation events:**
```bash
tail -50 install.log           # Last 50 lines
less install.log               # Full log with search (press '/' to search, 'q' to quit)
```

**JSON diagnostic data:**
```bash
cat install.diagnostic         # View complete diagnostic JSON
```

### Analyzing Installation Issues

**1. Automated Diagnostic Analysis:**

If installation fails or containers don't start properly:

```bash
node lib/diagnostic-analyzer.js install.diagnostic
```

This will:
- ✓ Identify all errors and categorize them
- ✓ Suggest specific fixes for common issues
- ✓ Display container state
- ✓ Show system requirements vs. actual

**2. Interactive Diagnostic Menu:**

Explore issues interactively:

```bash
node lib/install-menu.js install.diagnostic install.log
```

Menu provides:
1. View error details
2. View Docker container status
3. View system information
4. View diagnostic summary
5. Exit

### Common Installation Issues

**"npm install failed with ERESOLVE error"**

Dependency conflict detected. Solution:
```bash
npm ci --legacy-peer-deps
# or
rm package-lock.json && npm install
```

**"Docker containers created but not running"**

Check container logs:
```bash
# View app container logs
docker logs kali-ai-term-app

# View Kali container logs
docker logs kali-ai-term-kali

# View detailed error output
docker logs kali-ai-term-app | tail -50
```

**"Port 31337 already in use"**

Check what's using the port:
```bash
lsof -i :31337                 # macOS/Linux
netstat -tulpn | grep 31337    # Linux
```

Kill existing process or use different port in `.env`:
```bash
PORT=3001  # Change to different port
```

**"Ollama connection failed"**

Verify Ollama is running on host:
```bash
# Check if Ollama is running
curl http://localhost:11434/api/tags

# If not running, start Ollama
ollama serve
```

Verify OLLAMA_URL in `.env` matches your setup:
```bash
# For Docker Desktop (default)
OLLAMA_URL=http://host.docker.internal:11434

# For remote Ollama instance
OLLAMA_URL=http://192.168.1.100:11434
```

**"Permission denied: docker.sock"**

Docker socket access issue. Solution:
```bash
# Add user to docker group
sudo usermod -aG docker $USER
newgrp docker

# Then reinstall
node install-full.js
```

### Understanding Sensitive Data Masking

Log files automatically mask sensitive values for security:
```
ADMIN_PASSWORD=*** (instead of actual password)
AUTH_SECRET=*** (instead of actual UUID)
API_KEY=*** (instead of actual key)
```

This allows safe sharing of logs with support without exposing secrets.

### Log Rotation

Installation logs are automatically managed:
- **Keep:** Last 5 installation runs
- **Delete:** Older logs automatically
- **Format:** `install-2024-03-15-10-30-45.log`

### Runtime Application Logs

View application logs after startup:
```bash
# View app container logs (real-time)
docker logs -f kali-ai-term-app

# View Kali container logs
docker logs -f kali-ai-term-kali

# Set verbosity with LOG_LEVEL in .env
LOG_LEVEL=debug  # Very verbose
LOG_LEVEL=info   # Standard (recommended)
LOG_LEVEL=warn   # Warnings only
LOG_LEVEL=error  # Errors only
```

## Security Considerations

⚠️ **WARNING**: This tool is designed for authorized penetration testing only.

- Always ensure you have explicit written permission to test target systems
- Use in isolated networks or authorized lab environments
- This tool can be destructive - use the Kill Switch and Burn features carefully
- Session authentication is basic - use strong passwords in production
- Never expose to untrusted networks

## Future Enhancements

- [ ] Metasploit RPC integration for exploit staging
- [ ] CVE database enrichment for identified services
- [ ] Model-on-demand hot-swapping
- [ ] Persistent session storage (Redis)
- [ ] Advanced logging and audit trail
- [ ] Multi-user support with role-based access
- [ ] Custom payload generation
- [ ] Vulnerability scanning integration

## License

Proprietary - Internal Use Only

## Support

For issues, questions, or feature requests, contact the development team.

## CI/CD Status

Workflows Active: ✅
Branch Protection: ✅
Auto-merge: ✅

✅ Install script now supports:
- Modern 'docker compose' format
- Custom Ollama installations
- Configuration via web UI
