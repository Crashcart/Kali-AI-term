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
- ✓ Auto-configure ZeroTier iptables rules (if ZeroTier is installed)
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
bash <(curl -fsSL https://raw.githubusercontent.com/Crashcart/Kali-AI-term/main/install.sh)
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
BIND_HOST=0.0.0.0            # Bind address (0.0.0.0 = all interfaces)
OLLAMA_URL=http://ollama:11434  # Ollama API endpoint
KALI_CONTAINER=Kali-AI-linux # Container name
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

## Remote Access via ZeroTier

If you get `ERR_CONNECTION_REFUSED` when accessing the bot from a ZeroTier network, follow these steps.

### Why This Happens

Docker uses `iptables` rules (via the `DOCKER-USER` chain) to manage port forwarding. By default, Docker's forwarding rules apply to traffic arriving on the host's primary network interface. ZeroTier creates a virtual `zt*` interface, and traffic from it may be dropped by the FORWARD chain before Docker can process it.

### Fix: Allow ZeroTier Traffic Through Docker's iptables

Run these commands on the **host machine** running Docker:

```bash
# For Docker 17.06+ (recommended — uses DOCKER-USER chain)
sudo iptables -I DOCKER-USER -i zt+ -j ACCEPT

# For older Docker versions (fallback)
sudo iptables -I FORWARD -i zt+ -j ACCEPT
```

The `zt+` wildcard matches all ZeroTier interfaces (e.g., `ztabcd1234`).

### Make the Rule Persistent Across Reboots

```bash
sudo apt-get install -y iptables-persistent
sudo netfilter-persistent save
```

On systemd systems without `iptables-persistent`, create a service:

```bash
cat > /etc/systemd/system/zerotier-docker.service << 'EOF'
[Unit]
Description=Allow ZeroTier traffic through Docker iptables
After=docker.service zerotier-one.service
Wants=docker.service zerotier-one.service

[Service]
Type=oneshot
RemainAfterExit=yes
ExecStart=/sbin/iptables -I DOCKER-USER -i zt+ -j ACCEPT
ExecStop=/sbin/iptables -D DOCKER-USER -i zt+ -j ACCEPT

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl enable --now zerotier-docker.service
```

### Verify It Works

```bash
# Check the rule is present
sudo iptables -L DOCKER-USER -n -v | grep zt

# From any ZeroTier-connected machine, test connectivity
curl -I http://<zerotier-ip>:31337
```

### Automated Setup

The install scripts (`install.sh` and `install-full.sh`) automatically detect ZeroTier and apply the iptables rule during installation when run as root.

### Quick Diagnostics Checklist

| Check | Command |
|-------|---------|
| Container running? | `docker ps \| grep Kali-AI-app` |
| Port bound to all interfaces? | `ss -tlnp \| grep 31337` |
| ZeroTier connected? | `zerotier-cli listnetworks` |
| iptables rule present? | `iptables -L DOCKER-USER -n \| grep zt` |
| Firewall blocking? | `ufw status` or `firewall-cmd --list-all` |

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
docker build -t Kali-AI:latest .

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
- ZeroTier network access (auto-configured)
