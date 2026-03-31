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

### Complete Uninstall

**One-command removal of all data, containers, and configurations:**

```bash
./uninstall.sh
```

The script will:
- ✓ Stop and remove Docker containers
- ✓ Delete `.env` and `.env.backup` files
- ✓ Remove `node_modules` directory
- ✓ Clean up `data` and `logs` directories
- ✓ Confirm all data has been removed

**To reinstall afterward:**
```bash
bash <(curl -fsSL https://raw.githubusercontent.com/Crashcart/Kali-AI-term/test/install.sh)
```

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
