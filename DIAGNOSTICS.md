# Diagnostic Scripts - Troubleshooting Guide

Three scripts are available to help diagnose installation and Docker issues:

## 1. Quick Diagnostic (Fastest)

**For immediate issue identification**

```bash
bash diagnose-quick.sh
```

**Output:**

- ✓/✗ Docker daemon status
- ✓/✗ Docker Compose availability
- ✓/✗ Node.js installation
- Configuration status
- Running containers

**Use when:** You need a quick 10-second status check

---

## 2. Full Diagnostic (Comprehensive)

**For detailed system analysis**

```bash
bash diagnose.sh
```

**Creates:** `diagnostic-report-YYYY-MM-DD-HH-MM-SS.txt`

**Collects:**

- System information (OS, kernel, architecture)
- Docker installation and daemon status
- Docker socket location and permissions
- Docker Compose availability
- Node.js and npm versions
- Project file verification
- .env configuration
- Existing containers and images
- Port availability (3000, 31337, 11434)
- Installation logs
- Docker daemon logs
- Network configuration
- Disk space and memory
- Environment variables

**Use when:** You want detailed information about your system and Docker setup

---

## 3. Log Collection (For Support)

**For sharing with developers**

```bash
bash collect-logs.sh
```

**Creates:** `diagnostic-logs-YYYY-MM-DD-HH-MM-SS/` directory + archive

**Collects:**

- Docker daemon logs (200 lines)
- Docker info, containers, images, networks, volumes
- Container logs from all running/stopped containers
- Application logs (install.log, install.diagnostic)
- Configuration files (.env - sanitized)
- System information
- Network information
- Docker health check results

**Output file:** `diagnostic-logs-YYYY-MM-DD-HH-MM-SS.tar.gz` (or .zip)

**Use when:** You're sharing logs with support or developers

---

## Quick Start Workflow

### Step 1: Check Docker Status

```bash
bash diagnose-quick.sh
```

If Docker daemon is not running:

```bash
# Linux
sudo systemctl start docker

# Mac
# Open Docker Desktop application

# Windows
# Open Docker Desktop
```

### Step 2: Run Full Diagnostic

```bash
bash diagnose.sh
```

Review the output for any issues. Look for:

- ✗ marks (failures)
- ⚠ marks (warnings)

### Step 3: Collect Logs for Support

```bash
bash collect-logs.sh
```

Share the generated `.tar.gz` or `.zip` file.

---

## Common Issues & Solutions

### "Docker daemon NOT responding"

```bash
# Start Docker (Linux with systemd)
sudo systemctl start docker
sudo systemctl enable docker    # Auto-start on reboot

# Start Docker (Mac/Windows)
# Open Docker Desktop application from Applications menu
```

### "Docker socket NOT found"

The socket should be at `/var/run/docker.sock`. If missing:

- Docker daemon is not running
- You may be running Docker in a non-standard location
- Check if running in a container or VM

### "docker-compose command not found"

Use `docker compose` (v2) instead, or install docker-compose:

```bash
# Install docker-compose (Linux)
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose
```

### "node_modules missing"

Run:

```bash
npm install
```

### ".env missing or incomplete"

The install script should create this. If missing:

```bash
bash install.sh
```

---

## Understanding the Output

### Diagnostic Report Symbols

- ✓ = OK, working correctly
- ✗ = Error, not working
- ⚠ = Warning, might need attention
- → = Progress indicator

### Key Sections to Check

1. **DOCKER DAEMON STATUS** - Must show "RUNNING"
2. **DOCKER SOCKET** - Should exist at `/var/run/docker.sock`
3. **PROJECT FILES** - All should show ✓
4. **DOCKER-COMPOSE VALIDATION** - Should show valid YAML
5. **EXISTING CONTAINERS** - May be empty initially

---

## Sharing Logs with Support

1. Run the collection script:

   ```bash
   bash collect-logs.sh
   ```

2. Upload or share the archive:

   ```bash
   # The script creates:
   # diagnostic-logs-2024-04-01-10-30-45.tar.gz
   # or
   # diagnostic-logs-2024-04-01-10-30-45.zip
   ```

3. Optionally include:
   - The full diagnostic report: `bash diagnose.sh`
   - Any error messages you see
   - Steps you took before encountering the issue

---

## Privacy & Security

All diagnostic scripts automatically:

- ✓ Mask passwords in .env files
- ✓ Use sanitized copies of config files
- ✓ Do not collect sensitive environment variables
- ✓ Only read files in the project directory

Safe to share with anyone!

---

## Need Help?

1. Run `bash diagnose-quick.sh` to identify obvious issues
2. Run `bash diagnose.sh` to get detailed information
3. Run `bash collect-logs.sh` to prepare logs for sharing
4. Share the output with support or the development team

Each script takes 10 seconds to a few minutes to complete.
