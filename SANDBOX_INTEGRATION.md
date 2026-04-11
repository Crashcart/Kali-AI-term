# Docker Sandboxes Integration

This document describes the implementation of Docker Sandboxes for secure autonomous AI agent execution in Kali-AI-term (Issue #44).

## Overview

Docker Sandboxes provide isolated, secure execution environments for autonomous AI agents. They allow developers to run agents safely without risking the host system or exposing sensitive data.

## Architecture

### Core Components

#### 1. **SandboxDetector** (`lib/sandbox-detector.js`)
Detects and verifies Docker Sandboxes availability on the developer's system.

**Features:**
- Cross-platform support (macOS, Windows, Linux)
- Automatic installation instruction generation
- 5-minute result caching
- Version detection

**Installation Instructions:**

| Platform | Command |
|----------|---------|
| macOS | `brew install docker/tap/sbx` |
| Windows | `winget install Docker.sbx` |
| Linux | `docker plugin install docker/sbx:latest` |

#### 2. **SandboxConfig** (`lib/sandbox-config.js`)
Manages sandbox configurations and security constraints.

**Sandbox Templates:**

- **Restrictive**: Maximum security, no host filesystem access, no network
- **Standard**: Balanced security, localhost-only network access
- **Permissive**: Developer mode, full filesystem access, unrestricted networking

**Configuration Structure:**

```javascript
{
  id: "unique-uuid",
  name: "sandbox-name",
  status: "created|running|stopped|error",
  
  // Isolation settings
  isolation: {
    hostFilesystemAccess: false,
    allowedPaths: ["/workspace"],
    networkAccess: true,
    allowedNetworks: ["127.0.0.1"],
    dockerSocketAccess: false,
    environmentVariables: {}
  },
  
  // Resource limits
  resources: {
    cpuLimit: "2",
    memoryLimit: "2g",
    diskLimit: "10g",
    processLimit: 100
  },
  
  // Security constraints
  security: {
    readOnlyFilesystem: false,
    dropCapabilities: ["SYS_ADMIN", "SYS_PTRACE", ...],
    seccompProfile: "default",
    noNewPrivileges: true
  },
  
  // Execution context
  execution: {
    workingDirectory: "/workspace",
    user: "agent",
    timeout: 3600000, // 1 hour
    autoCleanup: true
  },
  
  // Observability
  observability: {
    enableLogging: true,
    logLevel: "info",
    captureOutput: true,
    metricsCollection: true
  }
}
```

#### 3. **SandboxManager** (`lib/sandbox-manager.js`)
Orchestrates sandbox lifecycle, execution, and constraint enforcement.

**Key Operations:**
- Start/stop sandboxes
- Execute commands safely within constraints
- Monitor execution metrics
- Enforce security policies
- Track execution history

**Command Constraint Verification:**

The manager blocks dangerous operations:
- `rm -rf /` - Recursive deletion of root
- `dd if=/dev/` - Low-level disk operations
- `mkfs` - Filesystem creation
- Access to shadow password files
- Unauthorized Docker socket access
- Restricted system directories (when not allowed)

#### 4. **Sandbox API Routes** (`lib/sandbox-api-routes.js`)
RESTful endpoints for sandbox management and execution.

### API Endpoints

#### Sandbox Management

**GET `/api/sandbox/status`**
Get sandbox system status and availability.

```json
{
  "sandbox": {
    "available": true,
    "platform": "darwin",
    "version": "1.0.0",
    "activeSandboxCount": 2,
    "totalSandboxes": 5
  }
}
```

**GET `/api/sandbox/install-instructions`**
Get installation instructions for the current platform.

```json
{
  "instructions": {
    "title": "Install Docker Sandboxes on macOS",
    "commands": [
      "brew tap docker/tap",
      "brew install docker/tap/sbx",
      "docker-sbx --version"
    ]
  }
}
```

**POST `/api/sandbox/create`**
Create a new sandbox configuration.

```bash
curl -X POST http://localhost:31337/api/sandbox/create \
  -H "Content-Type: application/json" \
  -d '{
    "type": "standard",
    "name": "my-sandbox",
    "options": {}
  }'
```

**GET `/api/sandbox`**
List all sandboxes (optionally filtered by status).

```bash
curl http://localhost:31337/api/sandbox?status=running
```

#### Sandbox Operations

**GET `/api/sandbox/:sandboxId`**
Get sandbox configuration and status.

**POST `/api/sandbox/:sandboxId/start`**
Start a sandbox.

```bash
curl -X POST http://localhost:31337/api/sandbox/{sandboxId}/start
```

**POST `/api/sandbox/:sandboxId/stop`**
Stop a running sandbox.

```bash
curl -X POST http://localhost:31337/api/sandbox/{sandboxId}/stop
```

**POST `/api/sandbox/:sandboxId/execute`**
Execute a command within a sandbox.

```bash
curl -X POST http://localhost:31337/api/sandbox/{sandboxId}/execute \
  -H "Content-Type: application/json" \
  -d '{
    "command": "npm run build",
    "options": {}
  }'
```

**DELETE `/api/sandbox/:sandboxId`**
Delete a sandbox configuration.

**POST `/api/sandbox/verify`**
Verify sandbox constraints before execution.

```bash
curl -X POST http://localhost:31337/api/sandbox/verify \
  -H "Content-Type: application/json" \
  -d '{"sandboxId": "{sandboxId}"}'
```

## Usage Examples

### 1. Create and Start a Sandbox

```bash
# Create a standard sandbox
RESPONSE=$(curl -X POST http://localhost:31337/api/sandbox/create \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"type": "standard", "name": "my-agent-sandbox"}')

SANDBOX_ID=$(echo $RESPONSE | jq -r '.sandbox.id')

# Start the sandbox
curl -X POST http://localhost:31337/api/sandbox/$SANDBOX_ID/start \
  -H "Authorization: Bearer $TOKEN"
```

### 2. Execute a Command in a Sandbox

```bash
# Execute a safe command
curl -X POST http://localhost:31337/api/sandbox/$SANDBOX_ID/execute \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "command": "echo \"Hello from sandbox\"",
    "options": {}
  }'

# Try to execute a dangerous command (will be rejected)
curl -X POST http://localhost:31337/api/sandbox/$SANDBOX_ID/execute \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "command": "rm -rf /",
    "options": {}
  }'
```

**Response (rejected command):**
```json
{
  "execution": {
    "status": "rejected",
    "error": "Command contains potentially dangerous operation: rm -rf /"
  }
}
```

### 3. Monitor Sandbox Status

```bash
curl http://localhost:31337/api/sandbox/$SANDBOX_ID \
  -H "Authorization: Bearer $TOKEN" \
  | jq '.status'
```

**Sample Output:**
```json
{
  "id": "sandbox-uuid",
  "config": {...},
  "instance": {
    "status": "running",
    "startedAt": "2026-04-01T23:00:00Z",
    "executions": [...],
    "metrics": {...}
  },
  "isRunning": true,
  "history": [...]
}
```

### 4. Stop and Clean Up

```bash
curl -X POST http://localhost:31337/api/sandbox/$SANDBOX_ID/stop \
  -H "Authorization: Bearer $TOKEN"
```

## Security Model

### Constraint Enforcement

1. **File System Isolation**
   - By default, agent can only access `/workspace` directory
   - Restrictive sandboxes block access to `/etc`, `/root`, `.ssh`, etc.
   - Host filesystem access disabled unless explicitly allowed

2. **Network Isolation**
   - Restrictive: No network access
   - Standard: Localhost only (127.0.0.1)
   - Permissive: All networks allowed

3. **Docker Access**
   - Docker socket access disabled by default
   - Prevents agents from escaping sandbox via Docker API

4. **Capability Dropping**
   - `SYS_ADMIN`: Prevent KVM/namespace manipulation
   - `SYS_PTRACE`: Prevent process tracing
   - `NET_ADMIN`: Prevent network namespace changes
   - `SYS_MODULE`: Prevent kernel module loading

5. **Resource Limits**
   - CPU: Max 16 cores (default 2)
   - Memory: Max 32GB (default 2GB)
   - Disk: Max 100GB (default 10GB)
   - Processes: Max 1000 (default 100)

### Command Validation

The sandbox manager validates all commands before execution:

```javascript
// Blocked patterns
const dangerousPatterns = [
  /rm\s+-rf\s+\//,           // rm -rf /
  /dd\s+if=\/dev/,           // Low-level disk write
  /mkfs/,                    // Format filesystem
  /fdisk/,                   // Partition modification
  /etc\/shadow/,             // Shadow file
  /etc\/passwd/              // Password file
];

// Blocked restricted paths (when hostFilesystemAccess = false)
const restrictedPaths = [
  '/etc', '/root', '.ssh', 'authorized_keys'
];
```

## Compliance with Issue #44 Requirements

### Acceptance Criteria Status

- [x] Docker Sandboxes detection on developer workstations
- [x] Configuration management for sandbox environments
- [x] Isolation constraints definition and enforcement
- [x] Command execution validation and blocking
- [x] Unsafe operation prevention (host `.ssh` access, etc.)
- [x] Graceful sandbox teardown and cleanup
- [x] Event emission and observability
- [ ] Full Docker Sandboxes microVM integration (phase 2)

### MVP Scope

This MVP implementation provides:
1. ✓ Sandbox detection and auto-installation instructions
2. ✓ Three security presets (restrictive, standard, permissive)
3. ✓ Command constraint verification
4. ✓ Lifecycle management (start/stop/execute)
5. ✓ Comprehensive test suite
6. ✓ RESTful API for integration

### Future Enhancements (Phase 2)

- [ ] Physical microVM support (currently simulated)
- [ ] Network traffic monitoring/limiting
- [ ] CPU/memory metrics collection
- [ ] Integration with GitHub Copilot agents
- [ ] Multi-stage workflow orchestration
- [ ] Persistent sandbox snapshots

## Testing

### Running Tests

```bash
npm test tests/unit/sandbox-infrastructure.test.js
```

### Test Coverage

The test suite covers:
- Platform detection (macOS, Windows, Linux)
- Caching behavior and cache expiry
- Sandbox creation and management
- Configuration updates and deletion
- Constraint verification
- Environment variable generation
- Sandbox lifecycle operations
- Command execution and validation
- Dangerous command blocking
- Event emission
- Cleanup operations

## Integration with Kali-AI-term

### Server Integration

The sandbox infrastructure is integrated into `server.js`:

```javascript
// Initialize sandbox components
const sandboxDetector = new SandboxDetector(appLogger);
const sandboxConfig = new SandboxConfig(appLogger);
const sandboxManager = new SandboxManager(sandboxConfig, docker, appLogger);

// Load persisted configurations
sandboxConfig.loadPersistedConfigs();

// Register API routes
const sandboxRoutes = createSandboxRoutes(
  sandboxDetector, sandboxConfig, sandboxManager, appLogger
);
app.use(sandboxRoutes);

// Graceful shutdown with sandbox cleanup
process.on('SIGTERM', async () => {
  await sandboxManager.cleanup();
  process.exit(0);
});
```

### Environment Variables

```bash
# Optional: Configure default sandbox parameters
SANDBOX_CPU_LIMIT=4
SANDBOX_MEMORY_LIMIT=4g
SANDBOX_DEFAULT_TYPE=standard
```

### Logging

All sandbox operations are logged via the application logger:

```
INFO: Created sandbox: {sandboxId} ({name})
INFO: Started sandbox: {sandboxId}
WARN: Command rejected for sandbox {sandboxId}: {reason}
INFO: Execution completed in sandbox {sandboxId}: {executionId}
```

## Troubleshooting

### Docker Sandboxes Not Detected

**Problem:** `sandboxAvailable: false`

**Solution:**
1. Check installation status:
   ```bash
   docker-sbx version
   ```

2. Install if missing:
   ```bash
   # macOS
   brew install docker/tap/sbx
   
   # Windows
   winget install Docker.sbx
   
   # Linux
   docker plugin install docker/sbx:latest
   ```

3. Verify installation:
   ```bash
   curl http://localhost:31337/api/sandbox/status
   ```

### Commands Being Rejected

**Problem:** Command execution returns status `rejected`

**Reason:** Command violates sandbox security policy (contains dangerous pattern or accesses restricted path)

**Solution:**
1. Check the sandbox configuration:
   ```bash
   curl http://localhost:31337/api/sandbox/{sandboxId}
   ```

2. Verify command constraints:
   ```bash
   curl -X POST http://localhost:31337/api/sandbox/verify \
     -d '{"sandboxId": "{sandboxId}"}'
   ```

3. Use a less restrictive sandbox type if needed:
   ```bash
   POST /api/sandbox/create
   { "type": "permissive" }
   ```

### Sandbox Not Starting

**Problem:** `await manager.startSandbox()` fails

**Solution:**
1. Verify Docker is running
2. Check Docker socket permissions: `ls -la /var/run/docker.sock`
3. Review server logs for error details
4. Ensure sandbox configuration passes verification

## References

- [Issue #44](https://github.com/Crashcart/Kali-AI-term/issues/44) - Feature Request
- [Docker Sandboxes Documentation](https://www.docker.com/products/sandboxes)
- [MicroVM Architecture](https://en.wikipedia.org/wiki/Unikernel)

---

**Version:** 1.0.0 (MVP)  
**Status:** Ready for testing and agent integration  
**Last Updated:** 2026-04-01
