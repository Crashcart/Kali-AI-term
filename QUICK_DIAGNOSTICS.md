# Quick Diagnostics via curl

Run diagnostic scripts directly from GitHub without cloning the entire repository.

## One-Line Diagnostics

### Quick Status Check (Fastest)

```bash
bash <(curl -fsSL https://raw.githubusercontent.com/Crashcart/Kali-AI-term/claude/logging-diagnostic-system/diagnose-quick.sh)
```

**Output:**

- Docker daemon status
- Docker Compose availability
- Node.js installation
- Configuration (.env) status
- Running containers

**Time:** ~10 seconds

### Full Diagnostic Report (Comprehensive)

```bash
bash <(curl -fsSL https://raw.githubusercontent.com/Crashcart/Kali-AI-term/claude/logging-diagnostic-system/diagnose.sh)
```

**Output:**

- Complete system information
- Docker daemon logs
- Configuration validation
- Port availability
- Installation logs
- Network diagnostics
- Memory and disk space

**Saves:** `diagnostic-report-YYYY-MM-DD-HH-MM-SS.txt`

**Time:** ~2-5 minutes

### Comprehensive Log Collection (For Support)

```bash
bash <(curl -fsSL https://raw.githubusercontent.com/Crashcart/Kali-AI-term/claude/logging-diagnostic-system/collect-logs.sh)
```

**Output:**

- Docker daemon logs
- All container logs
- Application logs
- System information
- Network diagnostics

**Creates:** `diagnostic-logs-YYYY-MM-DD-HH-MM-SS.tar.gz` (or .zip)

**Time:** ~2-3 minutes

---

## Troubleshooting Workflow

### 1. Check Docker Status

```bash
bash <(curl -fsSL https://raw.githubusercontent.com/Crashcart/Kali-AI-term/claude/logging-diagnostic-system/diagnose-quick.sh)
```

**If Docker daemon is not running:**

**Linux (systemd):**

```bash
sudo systemctl start docker
sudo systemctl enable docker    # Auto-start on reboot
```

**Linux (service):**

```bash
sudo service docker start
```

**macOS/Windows:**

- Open Docker Desktop application

### 2. Run Full Diagnostic

```bash
bash <(curl -fsSL https://raw.githubusercontent.com/Crashcart/Kali-AI-term/claude/logging-diagnostic-system/diagnose.sh)
```

Review the output for any ✗ (errors) or ⚠ (warnings).

### 3. Collect Logs for Support

```bash
bash <(curl -fsSL https://raw.githubusercontent.com/Crashcart/Kali-AI-term/claude/logging-diagnostic-system/collect-logs.sh)
```

Share the generated `.tar.gz` or `.zip` file with the development team.

---

## What Each Diagnostic Checks

| Component            | Quick | Full | Collect |
| -------------------- | ----- | ---- | ------- |
| Docker daemon        | ✓     | ✓    | ✓       |
| Docker socket        | ✓     | ✓    | ✓       |
| Docker Compose       | ✓     | ✓    | ✓       |
| Node.js/npm          | ✓     | ✓    | ✓       |
| Configuration (.env) | ✓     | ✓    | ✓       |
| Containers           | ✓     | ✓    | ✓       |
| System info          | -     | ✓    | ✓       |
| Docker logs          | -     | ✓    | ✓       |
| Port status          | -     | ✓    | ✓       |
| Network info         | -     | ✓    | ✓       |
| Container logs       | -     | -    | ✓       |
| Installation logs    | -     | -    | ✓       |

---

## Understanding Diagnostic Output

### Status Symbols

- **✓** = Working correctly
- **✗** = Error, not working
- **⚠** = Warning, needs attention
- **→** = Progress indicator

### Common Issues & Solutions

#### "Docker daemon: NOT RESPONDING"

```bash
# Start Docker (Linux)
sudo systemctl start docker

# Check status
sudo systemctl status docker

# View logs
sudo journalctl -u docker -n 50
```

#### "Docker socket: NOT found"

Docker daemon is not running or installed:

```bash
# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Start Docker
sudo systemctl start docker
```

#### "node_modules: MISSING"

Install Node.js dependencies:

```bash
npm install
```

#### ".env: MISSING"

Configuration not created:

```bash
# Run installation script
bash install.sh
# or
node install-full.js
```

---

## Privacy & Security

All diagnostic scripts:

- ✓ **Mask passwords** in .env files
- ✓ **Sanitize sensitive data** (API keys, tokens)
- ✓ **Safe to share** with developers
- ✓ **Read-only** operations (no changes to system)

Safe to run and share the output publicly.

---

## Download & Run Locally

If you prefer to download scripts first:

```bash
# Download quick diagnostic
curl -fsSL https://raw.githubusercontent.com/Crashcart/Kali-AI-term/claude/logging-diagnostic-system/diagnose-quick.sh -o diagnose-quick.sh
chmod +x diagnose-quick.sh
./diagnose-quick.sh

# Download full diagnostic
curl -fsSL https://raw.githubusercontent.com/Crashcart/Kali-AI-term/claude/logging-diagnostic-system/diagnose.sh -o diagnose.sh
chmod +x diagnose.sh
./diagnose.sh

# Download log collector
curl -fsSL https://raw.githubusercontent.com/Crashcart/Kali-AI-term/claude/logging-diagnostic-system/collect-logs.sh -o collect-logs.sh
chmod +x collect-logs.sh
./collect-logs.sh
```

---

## Branch Note

These diagnostic scripts are available on the `claude/logging-diagnostic-system` branch. They will be merged to `main` once testing is complete.

For the main branch, use:

```bash
bash <(curl -fsSL https://raw.githubusercontent.com/Crashcart/Kali-AI-term/main/diagnose-quick.sh)
```

---

## Need Help?

1. **Quick check:** Run the quick diagnostic
2. **Detailed analysis:** Run the full diagnostic
3. **Share with support:** Run log collection
4. **View documentation:** See `DIAGNOSTICS.md`
