require('dotenv').config();

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const fs = require('fs');
const path = require('path');
const net = require('net');
const os = require('os');
const { v4: uuidv4 } = require('uuid');
const Docker = require('dockerode');
const axios = require('axios');
const expressStaticGzip = require('express-static-gzip');
const reportPlugin = require('./plugins/report-plugin');
const db = require('./db/init');
const { InstallLogger } = require('./lib/install-logger');
const SandboxDetector = require('./lib/sandbox-detector');
const SandboxConfig = require('./lib/sandbox-config');
const SandboxManager = require('./lib/sandbox-manager');
const createSandboxRoutes = require('./lib/sandbox-api-routes');
const LLMOrchestrator = require('./lib/llm-orchestrator');
const OllamaProvider = require('./lib/ollama-provider');
const GeminiProvider = require('./lib/gemini-provider');
const createMultiLLMRoutes = require('./lib/multi-llm-api-routes');

const app = express();
const PORT = process.env.PORT || 31337;
const BIND_HOST = process.env.BIND_HOST || '0.0.0.0';
let OLLAMA_URL = process.env.OLLAMA_URL || 'http://localhost:11434';
const KALI_CONTAINER = process.env.KALI_CONTAINER || 'kali-ai-term-kali';
// Lightweight model default — dolphin-mixtral requires 24.8 GiB and OOMs on systems with <24.8 GiB.
// phi3:mini (~2.2 GiB) runs on any system with 4+ GiB RAM.  Override via OLLAMA_MODEL env var.
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'phi3:mini';
// Network scan for Ollama instances: disable by default (opt-in)
let ollamaNetworkScanEnabled = (process.env.OLLAMA_NETWORK_SCAN || 'false').toLowerCase() === 'true';

// Initialize application logger
const appLogger = new InstallLogger({
  scriptName: 'app',
  verbose: process.env.LOG_LEVEL !== 'error',
  maskSensitive: true
});

appLogger.info(`Starting Kali Hacker Bot`);
appLogger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
appLogger.info(`Port: ${PORT}`);
appLogger.info(`Ollama URL: ${OLLAMA_URL}`);
appLogger.info(`Kali Container: ${KALI_CONTAINER}`);

// Load LLM frozen state from config file (set frozen:true to disable LLM calls without crashing)
let llmState = { frozen: false, model: OLLAMA_MODEL, reason: '' };
try {
  const llmStateFile = path.join(__dirname, 'config', 'llm-state.json');
  if (fs.existsSync(llmStateFile)) {
    llmState = { ...llmState, ...JSON.parse(fs.readFileSync(llmStateFile, 'utf8')) };
  }
} catch (e) {
  appLogger.warn(`Could not load config/llm-state.json: ${e.message}`);
}
const LLM_FROZEN = (process.env.LLM_FROZEN || String(llmState.frozen)).toLowerCase() === 'true';
const DEFAULT_MODEL = process.env.OLLAMA_MODEL || llmState.model || OLLAMA_MODEL;
if (LLM_FROZEN) {
  appLogger.warn(`LLM processing is FROZEN. Model calls are disabled. Reason: ${llmState.reason}`);
  appLogger.warn(`Scheduled unfreeze check: ${llmState.nextUnfreezeCheck || 'see .github/workflows/unfreeze-llm.yml'}`);
} else {
  appLogger.info(`LLM model: ${DEFAULT_MODEL}`);
}

// Pentesting system prompt for Ollama
const SYSTEM_PROMPT = `You are an elite penetration testing AI assistant embedded in a Kali Linux terminal. You have deep expertise in:
- Network reconnaissance (Nmap, Masscan, Netdiscover)
- Web application testing (Burp Suite, SQLMap, Nikto, DirBuster, Gobuster)
- Exploitation frameworks (Metasploit, SearchSploit)
- Password attacks (Hydra, John the Ripper, Hashcat)
- Wireless attacks (Aircrack-ng, Bettercap)
- Privilege escalation (LinPEAS, WinPEAS, GTFOBins)
- Post-exploitation and lateral movement
- Social engineering and OSINT
- Reverse engineering and binary exploitation
- Active Directory attacks (BloodHound, Impacket, CrackMapExec)

When analyzing tool output:
1. Identify vulnerabilities and misconfigurations
2. Suggest the next logical attack vector
3. Provide exact commands ready to execute
4. Rate findings by severity (CRITICAL/HIGH/MEDIUM/LOW/INFO)
5. Reference relevant CVEs when applicable

Always provide commands with variable placeholders like $TARGET_IP, $LOCAL_IP, $LPORT that the user can substitute. Be concise and tactical.`;

// Security middleware
app.use(helmet({
  contentSecurityPolicy: false,
}));
app.use(cors());

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 500,
  standardHeaders: true,
  legacyHeaders: false,
});
app.use(limiter);

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

// Serve static files
app.use(expressStaticGzip(path.join(__dirname, 'public'), {
  enableBrotli: true,
  orderPreference: ['br', 'gz'],
}));

// Docker client
const dockerOptions = {};
if (process.env.DOCKER_HOST) {
  const host = process.env.DOCKER_HOST.replace(/^unix:\/\//, '');
  if (process.env.DOCKER_HOST.startsWith('unix://')) {
    dockerOptions.socketPath = host;
  } else {
    // Supports tcp://host:port URLs
    const parsed = new URL(process.env.DOCKER_HOST);
    dockerOptions.host = parsed.hostname;
    dockerOptions.port = parsed.port;
  }
} else {
  dockerOptions.socketPath = process.env.DOCKER_SOCKET || '/var/run/docker.sock';
}
const docker = new Docker(dockerOptions);

// Initialize database
db.initializeDatabase();

// Active exec processes (for kill switch)
const activeProcesses = new Map();

// ============================================
// SANDBOX INFRASTRUCTURE (Issue #44)
// ============================================

const sandboxDetector = new SandboxDetector(appLogger);
const sandboxConfig = new SandboxConfig(appLogger);
const sandboxManager = new SandboxManager(sandboxConfig, docker, appLogger);

// Load previously persisted sandbox configurations
sandboxConfig.loadPersistedConfigs();

// Initialize sandbox routes
const sandboxRoutes = createSandboxRoutes(sandboxDetector, sandboxConfig, sandboxManager, appLogger);
app.use(sandboxRoutes);

// Log sandbox initialization
(async () => {
  const detection = await sandboxDetector.detect();
  if (detection.available) {
    appLogger.info(`✓ Docker Sandboxes available: ${detection.version}`);
  } else {
    appLogger.warn(`⚠ Docker Sandboxes not available on this system`);
    if (detection.installCommand) {
      appLogger.info(`  Install with: ${detection.installCommand}`);
    }
  }
})();

// ============================================
// MULTI-LLM ORCHESTRATION (Issue #45)
// ============================================

const orchestrator = new LLMOrchestrator(appLogger);

// ---- Multi-Ollama instance registry ----
// Map<providerId, { url }>  — the primary instance always uses id 'ollama'
const ollamaInstances = new Map();

/**
 * Register a new Ollama instance with the orchestrator.
 * Returns the assigned provider id, or null on validation failure.
 * If the URL is already registered the existing id is returned.
 */
function registerOllamaInstance(url, id) {
  // Validate URL
  let parsed;
  try {
    parsed = new URL(url);
  } catch (_) {
    appLogger.warn(`registerOllamaInstance: invalid URL "${url}"`);
    return null;
  }
  if (!['http:', 'https:'].includes(parsed.protocol)) {
    appLogger.warn(`registerOllamaInstance: URL must use http/https`);
    return null;
  }

  // Prevent duplicate URLs
  for (const [existingId, instance] of ollamaInstances) {
    if (instance.url === url) return existingId;
  }

  // Auto-assign id when not provided
  if (!id) {
    const count = ollamaInstances.size;
    id = count === 0 ? 'ollama' : `ollama-${count + 1}`;
  }

  const provider = new OllamaProvider(url, appLogger);
  orchestrator.registerProvider(id, provider);
  ollamaInstances.set(id, { url });
  appLogger.info(`✓ Ollama instance registered: ${id} -> ${url}`);
  return id;
}

/**
 * Unregister an Ollama instance.  The primary 'ollama' instance cannot be
 * removed — its URL can only be updated via /api/ollama/config.
 */
function unregisterOllamaInstance(id) {
  if (id === 'ollama') {
    appLogger.warn('Cannot remove the primary Ollama instance');
    return false;
  }
  if (!ollamaInstances.has(id)) return false;
  orchestrator.providers.delete(id);
  delete orchestrator.stats.requestsByProvider[id];
  delete orchestrator.stats.errorsByProvider[id];
  ollamaInstances.delete(id);
  appLogger.info(`Ollama instance removed: ${id}`);
  return true;
}

// Initialise instances from environment.
// OLLAMA_URLS is a comma-separated list; it takes precedence over OLLAMA_URL.
const _initialUrls = process.env.OLLAMA_URLS
  ? process.env.OLLAMA_URLS.split(',').map(u => u.trim()).filter(Boolean)
  : [OLLAMA_URL];

_initialUrls.forEach((url, idx) => {
  const id = idx === 0 ? 'ollama' : `ollama-${idx + 1}`;
  registerOllamaInstance(url, id);
});

// Keep OLLAMA_URL in sync with the primary instance URL
OLLAMA_URL = ollamaInstances.get('ollama')?.url || OLLAMA_URL;

// Register Gemini provider (if API key is configured)
const geminiApiKey = process.env.GEMINI_API_KEY;
if (geminiApiKey) {
  const geminiProvider = new GeminiProvider(geminiApiKey, appLogger);
  orchestrator.registerProvider('gemini', geminiProvider);
  appLogger.info(`✓ Gemini API provider registered`);
} else {
  appLogger.warn(`⚠ GEMINI_API_KEY not set. Gemini provider unavailable. Set it to enable hybrid reasoning.`);
}

// Set up routing strategies for different task types
orchestrator.setRoutingStrategy('reasoning', {
  primary: 'gemini',      // Use Gemini for complex reasoning
  fallback: 'ollama',
  timeout: 60000,
  retries: 1
});

orchestrator.setRoutingStrategy('speed', {
  primary: 'ollama',      // Use Ollama for speed
  fallback: 'gemini',
  timeout: 30000,
  retries: 0
});

orchestrator.setRoutingStrategy('quality', {
  primary: 'gemini',      // Use Gemini for quality
  fallback: 'ollama',
  timeout: 120000,
  retries: 2
});

// Initialize multi-LLM routes
const multiLLMRoutes = createMultiLLMRoutes(orchestrator, appLogger);
app.use(multiLLMRoutes);

appLogger.info(`✓ Multi-LLM Orchestrator initialized with ${orchestrator.getAllProviders().length} provider(s)`);

// ============================================
// PLUGIN SYSTEM
// ============================================

class PluginManager {
  constructor() {
    this.plugins = new Map();
    this.hooks = new Map();
    this.initializeDefaultPlugins();
  }

  initializeDefaultPlugins() {
    const defaultPlugins = [
      {
        name: 'cve-plugin',
        enabled: true,
        version: '1.0',
        description: 'CVE lookup and vulnerability enrichment'
      },
      {
        name: 'threat-intel-plugin',
        enabled: true,
        version: '1.0',
        description: 'Threat intelligence and IOC detection'
      },
      {
        name: 'report-plugin',
        enabled: false,
        version: '1.0',
        description: 'Generate pentesting reports'
      },
      {
        name: 'export-plugin',
        enabled: false,
        version: '1.0',
        description: 'Export session data in multiple formats'
      }
    ];

    defaultPlugins.forEach(plugin => {
      this.register(plugin.name, plugin);
    });
  }

  register(name, plugin) {
    if (this.plugins.has(name)) {
      console.warn(`Plugin ${name} already registered`);
      return false;
    }
    this.plugins.set(name, plugin);
    return true;
  }

  enable(name) {
    const plugin = this.plugins.get(name);
    if (plugin) {
      plugin.enabled = true;
      return true;
    }
    return false;
  }

  disable(name) {
    const plugin = this.plugins.get(name);
    if (plugin) {
      plugin.enabled = false;
      return true;
    }
    return false;
  }

  async execute(hookName, data) {
    const hooks = this.hooks.get(hookName) || [];
    let result = data;

    for (const hook of hooks) {
      try {
        if (hook.enabled) {
          result = await hook.execute(result);
        }
      } catch (err) {
        console.error(`Hook error in ${hookName}:`, err.message);
        // Continue execution even if hook fails
      }
    }

    return result;
  }

  registerHook(hookName, plugin, execute) {
    if (!this.hooks.has(hookName)) {
      this.hooks.set(hookName, []);
    }
    this.hooks.get(hookName).push({
      plugin,
      execute,
      enabled: true
    });
  }

  getPlugins() {
    return Array.from(this.plugins.values());
  }
}

const pluginManager = new PluginManager();

// ============================================
// AUTHENTICATION
// ============================================

const AUTH_SECRET_FILE = path.join(__dirname, 'data', 'auth-secret');
let AUTH_SECRET;
if (process.env.AUTH_SECRET) {
  AUTH_SECRET = process.env.AUTH_SECRET;
} else {
  try {
    AUTH_SECRET = fs.readFileSync(AUTH_SECRET_FILE, 'utf8').trim();
  } catch (_) {
    AUTH_SECRET = 'kali-' + uuidv4();
    try {
      const dataDir = path.join(__dirname, 'data');
      if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
      fs.writeFileSync(AUTH_SECRET_FILE, AUTH_SECRET, { mode: 0o600 });
    } catch (writeErr) {
      appLogger.warn('Could not persist AUTH_SECRET; tokens will be invalidated on restart', { error: writeErr.message });
    }
  }
}
const LOGIN_REPORT_DIR = path.join(__dirname, 'data', 'login-error-reports');

function truncateString(value, maxLength = 512) {
  if (typeof value !== 'string') {
    return '';
  }
  return value.slice(0, maxLength);
}

function createLoginErrorReport(req, details = {}) {
  try {
    if (!fs.existsSync(LOGIN_REPORT_DIR)) {
      fs.mkdirSync(LOGIN_REPORT_DIR, { recursive: true });
    }

    const reportId = uuidv4();
    const report = {
      reportId,
      timestamp: new Date().toISOString(),
      route: req.originalUrl,
      method: req.method,
      remoteIp: truncateString(req.ip || req.socket?.remoteAddress || 'unknown', 128),
      userAgent: truncateString(req.get('user-agent') || 'unknown', 512),
      authConfig: {
        adminPasswordSource: process.env.ADMIN_PASSWORD ? 'env' : 'default',
        authSecretSource: process.env.AUTH_SECRET ? 'env' : 'generated-fallback',
      },
      details,
    };

    const filePath = path.join(LOGIN_REPORT_DIR, `login-error-${reportId}.json`);
    fs.writeFileSync(filePath, JSON.stringify(report, null, 2), 'utf8');

    appLogger.warn('Login error report created', {
      reportId,
      route: req.originalUrl,
      remoteIp: report.remoteIp,
    });

    return reportId;
  } catch (err) {
    appLogger.error('Failed to create login error report', { error: err.message });
    return null;
  }
}

app.post('/api/auth/login', (req, res) => {
  const { password } = req.body;
  const expectedPassword = process.env.ADMIN_PASSWORD || 'kalibot';

  if (typeof password !== 'string' || password.length === 0) {
    const reportId = createLoginErrorReport(req, { reason: 'missing-password' });
    return res.status(400).json({
      error: 'Password required',
      reportId,
      hint: 'Run ./collect-logs.sh and include this reportId in the issue.',
    });
  }

  if (password !== expectedPassword) {
    const reportId = createLoginErrorReport(req, { reason: 'password-mismatch' });
    return res.status(401).json({
      error: 'Unauthorized',
      reportId,
      hint: 'Run ./collect-logs.sh and include this reportId in the issue.',
    });
  }

  const sessionId = uuidv4();
  const token = Buffer.from(`${sessionId}:${AUTH_SECRET}`).toString('base64');
  const expiresAt = new Date(Date.now() + (24 * 60 * 60 * 1000));

  // Save session to database
  db.createSession(sessionId, token, AUTH_SECRET, expiresAt.toISOString());

  res.json({ token, sessionId });
});

app.post('/api/auth/login/error-report', (req, res) => {
  const payload = req.body || {};
  const reportId = createLoginErrorReport(req, {
    reason: 'client-login-error',
    message: truncateString(payload.message || '', 1024),
    status: Number(payload.status) || null,
    location: truncateString(payload.location || '', 1024),
    clientTimestamp: truncateString(payload.timestamp || '', 128),
    serverReportId: truncateString(payload.serverReportId || '', 128),
  });

  if (!reportId) {
    return res.status(500).json({ error: 'Failed to create login error report' });
  }

  return res.status(201).json({
    success: true,
    reportId,
  });
});

function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing token' });
  }

  const token = authHeader.slice(7);
  try {
    const decoded = Buffer.from(token, 'base64').toString();
    const colonIdx = decoded.indexOf(':');
    const sessionId = decoded.substring(0, colonIdx);
    const secret = decoded.substring(colonIdx + 1);

    // Get session from database
    const session = db.getSession(sessionId);

    if (!session || secret !== AUTH_SECRET) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    // Update last activity
    db.updateSessionActivity(sessionId);

    req.sessionId = sessionId;
    next();
  } catch (e) {
    res.status(401).json({ error: 'Invalid token' });
  }
}

// ============================================
// DOCKER API ENDPOINTS
// ============================================

app.post('/api/docker/exec', authenticate, async (req, res) => {
  const { command } = req.body;
  let { timeout = 30000 } = req.body;

  if (!command) {
    return res.status(400).json({ error: 'Command required' });
  }

  // Validate timeout: must be a positive integer, capped at 5 minutes
  timeout = parseInt(timeout, 10);
  if (!Number.isFinite(timeout) || timeout < 1000 || timeout > 300000) {
    timeout = 30000;
  }

  try {
    const container = docker.getContainer(KALI_CONTAINER);
    const startTime = Date.now();

    const exec = await container.exec({
      Cmd: ['bash', '-c', command],
      AttachStdout: true,
      AttachStderr: true,
      Tty: true,
    });

    const execId = exec.id;
    const stream = await exec.start({ Detach: false, Tty: true });
    let output = '';
    let timedOut = false;

    activeProcesses.set(execId, exec);

    const timer = setTimeout(() => {
      timedOut = true;
      stream.destroy();
    }, timeout);

    stream.on('data', (chunk) => {
      output += chunk.toString();
    });

    stream.on('end', () => {
      clearTimeout(timer);
      activeProcesses.delete(execId);

      const durationSeconds = Math.round((Date.now() - startTime) / 1000);

      // Store command in database
      db.addCommand(req.sessionId, command, durationSeconds, output, '', !timedOut);

      res.json({
        success: true,
        output: output,
        command: command,
        timedOut: timedOut,
        timestamp: new Date().toISOString(),
      });
    });

    stream.on('error', (err) => {
      clearTimeout(timer);
      activeProcesses.delete(execId);
      res.status(500).json({ error: err.message });
    });

  } catch (err) {
    console.error('Docker exec error:', err);
    res.status(500).json({ error: 'Command execution failed', details: err.message });
  }
});

app.get('/api/docker/status', authenticate, async (req, res) => {
  try {
    const container = docker.getContainer(KALI_CONTAINER);
    const info = await container.inspect();

    res.json({
      container: KALI_CONTAINER,
      state: info.State.Status,
      running: info.State.Running,
      pid: info.State.Pid,
      uptime: info.State.StartedAt,
      image: info.Config.Image,
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to get container status', details: err.message });
  }
});

// Restart Kali container
app.post('/api/docker/restart', authenticate, async (req, res) => {
  try {
    const container = docker.getContainer(KALI_CONTAINER);
    await container.restart();
    res.json({ success: true, message: 'Container restarting' });
  } catch (err) {
    res.status(500).json({ error: 'Restart failed', details: err.message });
  }
});

// Install tools in Kali
app.post('/api/docker/install', authenticate, async (req, res) => {
  const { packages } = req.body;

  if (!packages || !Array.isArray(packages) || packages.length === 0) {
    return res.status(400).json({ error: 'Packages array required' });
  }

  // Validate package names (only allow alphanumeric, hyphens, dots)
  const validPkg = /^[a-zA-Z0-9._-]+$/;
  for (const pkg of packages) {
    if (!validPkg.test(pkg)) {
      return res.status(400).json({ error: `Invalid package name: ${pkg}` });
    }
  }

  const pkgList = packages.join(' ');

  try {
    const container = docker.getContainer(KALI_CONTAINER);
    const exec = await container.exec({
      Cmd: ['bash', '-c', `apt-get update -qq && apt-get install -y -qq ${pkgList} 2>&1`],
      AttachStdout: true,
      AttachStderr: true,
      Tty: true,
    });

    const stream = await exec.start({ Detach: false, Tty: true });
    let output = '';

    stream.on('data', (chunk) => { output += chunk.toString(); });
    stream.on('end', () => {
      res.json({ success: true, output, packages });
    });
  } catch (err) {
    res.status(500).json({ error: 'Install failed', details: err.message });
  }
});

// Kill all processes in container
app.post('/api/docker/killall', authenticate, async (req, res) => {
  try {
    const container = docker.getContainer(KALI_CONTAINER);

    // Kill all user processes except PID 1
    const exec = await container.exec({
      Cmd: ['bash', '-c', 'kill -9 $(ps aux | grep -v PID | awk \'{print $2}\' | grep -v "^1$") 2>/dev/null; echo "All processes killed"'],
      AttachStdout: true,
      AttachStderr: true,
      Tty: true,
    });

    const stream = await exec.start({ Detach: false, Tty: true });
    let output = '';

    stream.on('data', (chunk) => { output += chunk.toString(); });
    stream.on('end', () => {
      // Clear active processes tracker
      activeProcesses.clear();
      res.json({ success: true, output });
    });
  } catch (err) {
    res.status(500).json({ error: 'Kill failed', details: err.message });
  }
});

// Reset container to clean state
app.post('/api/docker/reset', authenticate, async (req, res) => {
  try {
    const container = docker.getContainer(KALI_CONTAINER);
    const info = await container.inspect();

    // Stop, remove, and recreate
    await container.stop().catch(() => {});
    await container.remove();

    const newContainer = await docker.createContainer({
      Image: info.Config.Image,
      name: KALI_CONTAINER,
      Tty: true,
      OpenStdin: true,
      Cmd: ['/bin/bash'],
      NetworkingConfig: {
        EndpointsConfig: info.NetworkSettings.Networks,
      },
    });

    await newContainer.start();
    res.json({ success: true, message: 'Container reset to clean state' });
  } catch (err) {
    res.status(500).json({ error: 'Reset failed', details: err.message });
  }
});

// ============================================
// OLLAMA API ENDPOINTS
// ============================================

// Proxy configuration
let PROXY_CONFIG = {
  enabled: false,
  protocol: 'http',
  host: '',
  port: 8080,
  username: '',
  password: '',
  bypass: ''
};

// Allow frontend to update Ollama URL
app.post('/api/ollama/config', authenticate, (req, res) => {
  const { url } = req.body;
  if (!url) {
    return res.status(400).json({ error: 'URL required' });
  }

  // Basic URL validation
  try {
    const parsed = new URL(url);
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return res.status(400).json({ error: 'URL must use http or https protocol' });
    }
  } catch (e) {
    return res.status(400).json({ error: 'Invalid URL format' });
  }

  OLLAMA_URL = url;
  // Keep the primary provider in sync so health checks and model fetches use the new URL
  const primaryProvider = orchestrator.getProvider('ollama');
  if (primaryProvider) {
    primaryProvider.url = url;
    primaryProvider.clearCache();
  }
  // Also update the instances registry
  if (ollamaInstances.has('ollama')) {
    ollamaInstances.get('ollama').url = url;
  }

  res.json({ success: true, url: OLLAMA_URL });
});

app.get('/api/ollama/config', authenticate, (req, res) => {
  res.json({ url: OLLAMA_URL });
});

// ---- Ollama multi-instance management ----

/**
 * GET /api/ollama/instances
 * List all registered Ollama instances with their health status.
 */
app.get('/api/ollama/instances', authenticate, async (req, res) => {
  const results = [];
  for (const [id, instance] of ollamaInstances) {
    const provider = orchestrator.getProvider(id);
    let available = false;
    let models = [];
    try {
      if (provider) {
        const status = await provider.getStatus();
        available = status.available;
        models = (status.models || []).map(m => m.name || m);
      }
    } catch (_) {}
    results.push({ id, url: instance.url, available, models });
  }
  res.json({ success: true, instances: results });
});

/**
 * POST /api/ollama/instances
 * Add a new Ollama instance.  Body: { url }
 */
app.post('/api/ollama/instances', authenticate, (req, res) => {
  const { url } = req.body;
  if (!url) {
    return res.status(400).json({ error: 'url is required' });
  }

  const id = registerOllamaInstance(url);
  if (!id) {
    return res.status(400).json({ error: 'Invalid URL or unsupported protocol' });
  }

  res.json({ success: true, id, url });
});

/**
 * DELETE /api/ollama/instances/:id
 * Remove a non-primary Ollama instance.
 */
app.delete('/api/ollama/instances/:id', authenticate, (req, res) => {
  const { id } = req.params;
  if (id === 'ollama') {
    return res.status(400).json({ error: 'Cannot remove the primary Ollama instance. Update its URL via /api/ollama/config instead.' });
  }
  if (!unregisterOllamaInstance(id)) {
    return res.status(404).json({ error: `Instance "${id}" not found` });
  }
  res.json({ success: true, removed: id });
});

// ---- Network scan settings ----

/**
 * GET /api/ollama/scan/settings
 * Return whether network scanning is enabled.
 */
app.get('/api/ollama/scan/settings', authenticate, (req, res) => {
  res.json({ success: true, enabled: ollamaNetworkScanEnabled });
});

/**
 * POST /api/ollama/scan/settings
 * Enable or disable network scanning.  Body: { enabled: true|false }
 */
app.post('/api/ollama/scan/settings', authenticate, (req, res) => {
  const { enabled } = req.body;
  if (typeof enabled !== 'boolean') {
    return res.status(400).json({ error: 'enabled (boolean) is required' });
  }
  ollamaNetworkScanEnabled = enabled;
  appLogger.info(`Ollama network scan ${enabled ? 'enabled' : 'disabled'}`);
  res.json({ success: true, enabled: ollamaNetworkScanEnabled });
});

/**
 * POST /api/ollama/scan
 * Scan the local network for Ollama instances on the given port.
 * Body (optional): { subnet: '192.168.1', port: 11434 }
 * The scan probes all 254 hosts in the /24 block.
 */
app.post('/api/ollama/scan', authenticate, async (req, res) => {
  if (!ollamaNetworkScanEnabled) {
    return res.status(403).json({ success: false, error: 'Network scanning is disabled. Enable it in Settings → AI/LLM → Network Discovery.' });
  }

  // Detect the best local subnet if none provided
  let subnet = typeof req.body.subnet === 'string' ? req.body.subnet.trim() : null;
  const port = Number.isInteger(req.body.port) ? req.body.port : 11434;

  if (port < 1 || port > 65535) {
    return res.status(400).json({ error: 'port must be 1-65535' });
  }

  if (!subnet) {
    // Auto-detect from the first non-loopback IPv4 interface
    const ifaces = os.networkInterfaces();
    outer: for (const name of Object.keys(ifaces)) {
      for (const iface of ifaces[name]) {
        if (iface.family === 'IPv4' && !iface.internal) {
          const parts = iface.address.split('.');
          if (parts.length === 4) {
            subnet = `${parts[0]}.${parts[1]}.${parts[2]}`;
            break outer;
          }
        }
      }
    }
  }

  if (!subnet || !/^\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(subnet)) {
    return res.status(400).json({ error: 'Could not determine subnet. Provide subnet in body, e.g. { "subnet": "192.168.1" }' });
  }

  appLogger.info(`Ollama network scan starting on ${subnet}.0/24 port ${port}`);

  const CONCURRENCY = 30;
  const PROBE_TIMEOUT_MS = 1200;
  const hosts = Array.from({ length: 254 }, (_, i) => `${subnet}.${i + 1}`);
  const discovered = [];

  // TCP probe helper
  function tcpProbe(ip, p) {
    return new Promise(resolve => {
      const socket = new net.Socket();
      let done = false;
      const finish = (result) => {
        if (done) return;
        done = true;
        socket.destroy();
        resolve(result);
      };
      socket.setTimeout(PROBE_TIMEOUT_MS);
      socket.once('connect', () => finish(true));
      socket.once('error', () => finish(false));
      socket.once('timeout', () => finish(false));
      socket.connect(p, ip);
    });
  }

  for (let i = 0; i < hosts.length; i += CONCURRENCY) {
    const batch = hosts.slice(i, i + CONCURRENCY);
    const batchResults = await Promise.all(
      batch.map(async (ip) => {
        const open = await tcpProbe(ip, port);
        if (!open) return null;
        // Verify it's actually Ollama
        try {
          const resp = await axios.get(`http://${ip}:${port}/api/tags`, { timeout: 2000 });
          const models = (resp.data.models || []).map(m => m.name);
          return { ip, port, url: `http://${ip}:${port}`, models };
        } catch (_) {
          return null;
        }
      })
    );
    discovered.push(...batchResults.filter(Boolean));
  }

  appLogger.info(`Ollama network scan complete. Found ${discovered.length} instance(s)`);
  res.json({ success: true, subnet, port, discovered });
});

// Proxy configuration endpoints
app.post('/api/proxy/config', authenticate, (req, res) => {
  const { enabled, protocol, host, port, username, password, bypass } = req.body;

  // Validate proxy settings
  if (enabled && (!host || !port)) {
    return res.status(400).json({ error: 'Host and port required when proxy is enabled' });
  }

  if (port && (port < 1 || port > 65535)) {
    return res.status(400).json({ error: 'Port must be between 1 and 65535' });
  }

  // Update proxy config
  PROXY_CONFIG = {
    enabled: enabled || false,
    protocol: protocol || 'http',
    host: host || '',
    port: parseInt(port) || 8080,
    username: username || '',
    password: password || '',
    bypass: bypass || ''
  };

  // Store in database
  if (req.sessionId) {
    db.updateSessionNotes(req.sessionId, `Proxy: ${enabled ? 'Enabled' : 'Disabled'}`);
  }

  res.json({ success: true, proxy: PROXY_CONFIG });
});

app.get('/api/proxy/config', authenticate, (req, res) => {
  // Don't return password in response
  const safeConfig = { ...PROXY_CONFIG };
  safeConfig.password = safeConfig.password ? '••••••••' : '';
  res.json(safeConfig);
});

app.post('/api/proxy/test', authenticate, async (req, res) => {
  if (!PROXY_CONFIG.enabled) {
    return res.json({ success: true, message: 'Proxy is disabled', status: 'disabled' });
  }

  try {
    // Create axios instance with proxy config
    const httpAgent = PROXY_CONFIG.protocol === 'socks5' ?
      { host: PROXY_CONFIG.host, port: PROXY_CONFIG.port } :
      { host: PROXY_CONFIG.host, port: PROXY_CONFIG.port };

    // Test by connecting to httpbin.org echo service
    const testUrl = 'http://httpbin.org/delay/1';
    const startTime = Date.now();

    const response = await axios.get(testUrl, {
      timeout: 10000,
      httpAgent: PROXY_CONFIG.protocol === 'http' ? new (require('http').Agent)(httpAgent) : undefined,
      httpsAgent: PROXY_CONFIG.protocol === 'https' ? new (require('https').Agent)(httpAgent) : undefined
    }).catch(err => {
      // If httpbin fails, just verify connectivity to proxy host
      return new Promise((resolve) => {
        const socket = require('net').createConnection(
          PROXY_CONFIG.port,
          PROXY_CONFIG.host,
          () => {
            socket.destroy();
            resolve({ data: { status: 'connected' } });
          }
        ).on('error', () => {
          throw new Error('Cannot reach proxy server');
        });
      });
    });

    const duration = Date.now() - startTime;
    res.json({
      success: true,
      status: 'working',
      message: 'Proxy is reachable and responding',
      latency: duration
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      status: 'failed',
      error: err.message,
      message: 'Cannot reach proxy server or test URL'
    });
  }
});

// Bind host configuration
app.get('/api/settings/bind-host', authenticate, (req, res) => {
  res.json({
    current: BIND_HOST,
    default: '0.0.0.0',
    message: 'Current bind address (0.0.0.0 = all interfaces, localhost = loopback only)'
  });
});

app.post('/api/settings/bind-host', authenticate, (req, res) => {
  const { bindHost } = req.body;

  if (!bindHost) {
    return res.status(400).json({ error: 'bindHost required' });
  }

  // Note: This is informational only - actual restart required to apply
  res.json({
    success: true,
    message: `To change bind address from ${BIND_HOST} to ${bindHost}, restart the server with: BIND_HOST=${bindHost} npm start`,
    instructions: [
      `1. Stop the server: docker-compose down`,
      `2. Update .env with: BIND_HOST=${bindHost}`,
      `3. Restart: docker-compose up -d`,
      `4. Access at: http://${bindHost === '0.0.0.0' ? 'localhost' : bindHost}:${PORT}`
    ]
  });
});

app.post('/api/ollama/generate', authenticate, async (req, res) => {
  const { prompt, model = DEFAULT_MODEL, temperature = 0.7, systemPrompt, useOrchestrator = false, taskType = 'default' } = req.body;

  if (!prompt) {
    return res.status(400).json({ error: 'Prompt required' });
  }

  if (LLM_FROZEN) {
    return res.status(503).json({
      error: 'LLM processing is currently frozen',
      reason: llmState.reason,
      model: DEFAULT_MODEL,
      nextUnfreezeCheck: llmState.nextUnfreezeCheck || 'see .github/workflows/unfreeze-llm.yml'
    });
  }

  try {
    // If useOrchestrator is true, route through the multi-LLM orchestrator
    if (useOrchestrator) {
      const response = await orchestrator.generate(prompt, {
        taskType: taskType,
        temperature: temperature,
        systemPrompt: systemPrompt || SYSTEM_PROMPT
      });

      return res.json({
        success: true,
        response: response,
        timestamp: new Date().toISOString(),
      });
    }

    // Otherwise, use direct Ollama (backward compatibility)
    const response = await axios.post(`${OLLAMA_URL}/api/generate`, {
      model: model,
      system: systemPrompt || SYSTEM_PROMPT,
      prompt: prompt,
      stream: false,
      options: { temperature },
    });

    res.json({
      success: true,
      model: model,
      response: response.data.response,
      context: response.data.context,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    console.error('Ollama error:', err.message);
    res.status(500).json({ error: 'LLM generation failed', details: err.message });
  }
});

app.post('/api/ollama/stream', authenticate, async (req, res) => {
  const { prompt, model = DEFAULT_MODEL, temperature = 0.7, systemPrompt, useOrchestrator = false, taskType = 'default' } = req.body;

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  if (LLM_FROZEN) {
    res.write(`data: ${JSON.stringify({ done: true, frozen: true, reason: llmState.reason, nextUnfreezeCheck: llmState.nextUnfreezeCheck })}\n\n`);
    return res.end();
  }

  try {
    // If useOrchestrator is true, route through the multi-LLM orchestrator
    if (useOrchestrator) {
      for await (const chunk of orchestrator.streamGenerate(prompt, {
        taskType: taskType,
        temperature: temperature,
        systemPrompt: systemPrompt || SYSTEM_PROMPT
      })) {
        if (chunk.done) {
          res.write(`data: ${JSON.stringify({ done: true, provider: chunk.provider })}\n\n`);
        } else {
          res.write(`data: ${JSON.stringify({ token: chunk.token, provider: chunk.provider })}\n\n`);
        }
      }
      res.end();
      return;
    }

    // Otherwise, use direct Ollama (backward compatibility)
    const response = await axios.post(`${OLLAMA_URL}/api/generate`, {
      model: model,
      system: systemPrompt || SYSTEM_PROMPT,
      prompt: prompt,
      stream: true,
      options: { temperature },
    }, {
      responseType: 'stream',
    });

    response.data.on('data', (chunk) => {
      try {
        const lines = chunk.toString().split('\n').filter(l => l.trim());
        lines.forEach(line => {
          const json = JSON.parse(line);
          if (json.done) {
            res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
          } else {
            res.write(`data: ${JSON.stringify({ token: json.response })}\n\n`);
          }
        });
      } catch (e) {
        // ignore parse errors on partial chunks
      }
    });

    response.data.on('end', () => {
      res.write('data: {"done": true}\n\n');
      res.end();
    });

    response.data.on('error', (err) => {
      res.write(`data: ${JSON.stringify({ error: err.message })}\n\n`);
      res.end();
    });

    req.on('close', () => {
      response.data.destroy();
    });

  } catch (err) {
    res.write(`data: ${JSON.stringify({ error: err.message })}\n\n`);
    res.end();
  }
});

app.get('/api/ollama/models', authenticate, async (req, res) => {
  // Allow callers to specify a URL so the Settings panel can list models from the
  // URL currently shown in the input field (even before it has been saved).
  const targetUrl = (req.query.url && typeof req.query.url === 'string')
    ? req.query.url.trim()
    : OLLAMA_URL;

  // Validate URL to prevent SSRF against non-HTTP targets
  try {
    const parsed = new URL(targetUrl);
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return res.status(400).json({ error: 'URL must use http or https' });
    }
  } catch (_) {
    return res.status(400).json({ error: 'Invalid URL provided' });
  }

  try {
    const response = await axios.get(`${targetUrl}/api/tags`);
    res.json({ models: response.data.models || [] });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch models', details: err.message });
  }
});

// Detailed Ollama connectivity status with actionable diagnostics
app.get('/api/ollama/status', authenticate, async (req, res) => {
  const testUrl = (req.query.url && typeof req.query.url === 'string')
    ? req.query.url.trim()
    : OLLAMA_URL;

  // Basic URL validation to prevent SSRF against non-HTTP targets
  let parsedUrl;
  try {
    parsedUrl = new URL(testUrl);
  } catch (_) {
    return res.status(400).json({ error: 'Invalid URL provided' });
  }
  if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
    return res.status(400).json({ error: 'URL must use http or https' });
  }

  try {
    const response = await axios.get(`${testUrl}/api/tags`, { timeout: 5000 });
    const models = response.data.models || [];
    return res.json({
      connected: true,
      url: testUrl,
      httpStatus: response.status,
      modelCount: models.length,
      models: models.map(m => m.name)
    });
  } catch (err) {
    const isLocalhost = ['localhost', '127.0.0.1', '::1'].includes(parsedUrl.hostname);
    const httpStatus = err.response ? err.response.status : null;
    let errorType = 'unknown';
    let suggestion = '';

    if (err.code === 'ECONNREFUSED') {
      errorType = 'connection_refused';
      suggestion = isLocalhost
        ? 'Ollama is not running on this machine. Start it with: ollama serve'
        : 'Ollama refused the connection. It is likely running but bound to localhost only. ' +
          'To allow remote access, restart Ollama with: OLLAMA_HOST=0.0.0.0 ollama serve';
    } else if (err.code === 'ENOTFOUND' || err.code === 'EAI_AGAIN') {
      errorType = 'dns_error';
      suggestion = 'Hostname could not be resolved. Try using the IP address directly instead of a hostname.';
    } else if (err.code === 'ETIMEDOUT' || (err.message && err.message.includes('timeout'))) {
      errorType = 'timeout';
      suggestion = isLocalhost
        ? 'Connection timed out reaching localhost. Ollama may be starting up or unresponsive.'
        : 'Connection timed out. Check that port 11434 is open in any firewall between this server and the Ollama host. ' +
          'Also ensure Ollama is bound to 0.0.0.0: OLLAMA_HOST=0.0.0.0 ollama serve';
    } else if (httpStatus) {
      errorType = 'http_error';
      suggestion = `Ollama returned HTTP ${httpStatus}. Check Ollama logs for details.`;
    } else if (err.code === 'ECONNRESET' || err.code === 'EPIPE') {
      errorType = 'connection_reset';
      suggestion = 'Connection was reset. Ollama may have rejected the request or restarted.';
    } else if (err.code === 'EHOSTUNREACH' || err.code === 'ENETUNREACH') {
      errorType = 'network_unreachable';
      suggestion = 'Network path to the Ollama host does not exist. Verify the IP address and that the host is on a reachable network segment.';
    }

    return res.json({
      connected: false,
      url: testUrl,
      error: err.message,
      errorCode: err.code || null,
      errorType,
      httpStatus,
      suggestion
    });
  }
});

// Pull a new model
app.post('/api/ollama/pull', authenticate, async (req, res) => {
  const { model } = req.body;

  if (!model) {
    return res.status(400).json({ error: 'Model name required' });
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  try {
    const response = await axios.post(`${OLLAMA_URL}/api/pull`, {
      name: model,
      stream: true,
    }, {
      responseType: 'stream',
    });

    response.data.on('data', (chunk) => {
      try {
        const lines = chunk.toString().split('\n').filter(l => l.trim());
        lines.forEach(line => {
          const json = JSON.parse(line);
          res.write(`data: ${JSON.stringify(json)}\n\n`);
        });
      } catch (e) {
        // ignore
      }
    });

    response.data.on('end', () => {
      res.write('data: {"status":"success"}\n\n');
      res.end();
    });

  } catch (err) {
    res.write(`data: ${JSON.stringify({ error: err.message })}\n\n`);
    res.end();
  }
});

// ============================================
// CVE LOOKUP
// ============================================

app.get('/api/cve/:cveId', authenticate, async (req, res) => {
  const { cveId } = req.params;

  // Validate CVE format
  if (!/^CVE-\d{4}-\d{4,}$/i.test(cveId)) {
    return res.status(400).json({ error: 'Invalid CVE format. Use CVE-YYYY-NNNNN' });
  }

  try {
    const response = await axios.get(
      `https://cveawg.mitre.org/api/cve/${cveId.toUpperCase()}`,
      { timeout: 10000 }
    );
    res.json({ success: true, cve: response.data });
  } catch (err) {
    // Fallback to NVD
    try {
      const nvd = await axios.get(
        `https://services.nvd.nist.gov/rest/json/cves/2.0?cveId=${cveId.toUpperCase()}`,
        { timeout: 10000 }
      );
      res.json({ success: true, cve: nvd.data });
    } catch (e) {
      res.status(500).json({ error: 'CVE lookup failed', details: e.message });
    }
  }
});

// ============================================
// SESSION MANAGEMENT
// ============================================

// Get command history
app.get('/api/session/history', authenticate, (req, res) => {
  const history = db.getCommandHistory(req.sessionId, 100);
  res.json({ history });
});

// Session notes (scratchpad)
app.get('/api/session/notes', authenticate, (req, res) => {
  const notes = db.getSessionNotes(req.sessionId);
  res.json({ notes });
});

app.post('/api/session/notes', authenticate, (req, res) => {
  const { notes } = req.body;
  try {
    db.updateSessionNotes(req.sessionId, notes || '');
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to save notes' });
  }
});

// Export session data
app.get('/api/session/export', authenticate, (req, res) => {
  const exportData = db.exportSessionData(req.sessionId);

  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Content-Disposition', `attachment; filename="pentest-session-${req.sessionId.slice(0, 8)}-${Date.now()}.json"`);
  res.json(exportData);
});

// Generate pentesting report
app.post('/api/reports/generate', authenticate, (req, res) => {
  try {
    const { format = 'html', includeCommandHistory = true, includeCVEs = true } = req.body;
    const session = db.getSession(req.sessionId);
    const history = db.getCommandHistory(req.sessionId, 100);

    // Collect findings from database
    const findings = db.getFindingsWithCVEs(req.sessionId);
    const sessionNotes = db.getSessionNotes(req.sessionId);

    // Calculate session duration
    let sessionDuration = 0;
    if (session && session.created_at) {
      const createdAt = new Date(session.created_at).getTime();
      sessionDuration = Math.round((Date.now() - createdAt) / 1000);
    }

    // Generate base report data
    const reportData = {
      title: 'Penetration Testing Report',
      generated: new Date().toISOString(),
      sessionId: req.sessionId.slice(0, 8),
      sessionDuration: sessionDuration,
      totalFindings: findings.length,
      criticalCount: findings.filter(f => f.severity === 'CRITICAL').length,
      highCount: findings.filter(f => f.severity === 'HIGH').length,
      mediumCount: findings.filter(f => f.severity === 'MEDIUM').length,
      lowCount: findings.filter(f => f.severity === 'LOW').length,
      infoCount: findings.filter(f => f.severity === 'INFO').length,
      findings: findings,
      commandHistory: includeCommandHistory ? history : [],
      sessionNotes: sessionNotes,
    };

    if (format === 'json') {
      // Return JSON format
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename="pentest-report-${req.sessionId.slice(0, 8)}-${Date.now()}.json"`);
      res.json(reportData);
    } else if (format === 'html') {
      // Generate HTML report
      const htmlReport = generateHTMLReport(reportData);
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="pentest-report-${req.sessionId.slice(0, 8)}-${Date.now()}.html"`);
      res.send(htmlReport);
    } else if (format === 'markdown') {
      // Generate Markdown report
      const mdReport = reportPlugin.exportReport('markdown');
      res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="pentest-report-${req.sessionId.slice(0, 8)}-${Date.now()}.md"`);
      res.send(mdReport);
    } else {
      res.status(400).json({ error: 'Invalid format. Use: json, html, or markdown' });
    }
  } catch (err) {
    console.error('Report generation error:', err);
    res.status(500).json({ error: 'Failed to generate report', details: err.message });
  }
});

// Helper function to generate HTML report
function generateHTMLReport(reportData) {
  const bySeverity = {};
  reportData.findings.forEach(f => {
    if (!bySeverity[f.severity]) bySeverity[f.severity] = [];
    bySeverity[f.severity].push(f);
  });

  const severityColors = {
    CRITICAL: '#ff0000',
    HIGH: '#ff6600',
    MEDIUM: '#ffaa00',
    LOW: '#ffff00',
    INFO: '#00ff00'
  };

  const severityOrder = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'INFO'];

  let findingsHTML = '';
  severityOrder.forEach(severity => {
    if (bySeverity[severity]) {
      findingsHTML += `
        <h3 style="color: ${severityColors[severity]}; border-bottom: 2px solid ${severityColors[severity]}; padding: 10px 0;">
          ${severity} Severity (${bySeverity[severity].length} findings)
        </h3>
      `;
      bySeverity[severity].forEach((finding, idx) => {
        findingsHTML += `
          <div style="border-left: 4px solid ${severityColors[severity]}; padding: 10px; margin: 10px 0; background: rgba(0, 0, 0, 0.1);">
            <h4 style="margin: 0 0 5px 0;">Finding ${idx + 1}</h4>
            <p><strong>Timestamp:</strong> ${finding.timestamp}</p>
            <p><strong>Query:</strong> ${finding.query}</p>
            <p><strong>Description:</strong> ${finding.description}</p>
            ${finding.cves && finding.cves.length > 0 ? `<p><strong>Related CVEs:</strong> ${finding.cves.join(', ')}</p>` : ''}
          </div>
        `;
      });
    }
  });

  const commandHistoryHTML = reportData.commandHistory.length > 0 ? `
    <section>
      <h2>Command Execution History</h2>
      <table style="width: 100%; border-collapse: collapse;">
        <thead style="background: #222; border: 1px solid #0f0;">
          <tr>
            <th style="border: 1px solid #0f0; padding: 8px; text-align: left;">Timestamp</th>
            <th style="border: 1px solid #0f0; padding: 8px; text-align: left;">Command</th>
            <th style="border: 1px solid #0f0; padding: 8px; text-align: left;">Duration (s)</th>
          </tr>
        </thead>
        <tbody>
          ${reportData.commandHistory.map(cmd => `
            <tr style="border: 1px solid #0f0;">
              <td style="border: 1px solid #0f0; padding: 8px;">${new Date(cmd.timestamp).toLocaleString()}</td>
              <td style="border: 1px solid #0f0; padding: 8px; font-family: monospace;">${cmd.command}</td>
              <td style="border: 1px solid #0f0; padding: 8px;">${cmd.duration || 'N/A'}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </section>
  ` : '';

  const notesSection = reportData.sessionNotes ? `
    <section>
      <h2>Session Notes</h2>
      <div style="background: rgba(0, 255, 0, 0.05); border: 1px dashed #0f0; padding: 10px; border-radius: 4px;">
        ${reportData.sessionNotes.split('\n').map(line => `<p>${line || '<br>'}</p>`).join('')}
      </div>
    </section>
  ` : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Penetration Testing Report</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'Courier New', monospace;
      background: #0a0a0a;
      color: #0f0;
      line-height: 1.6;
      padding: 20px;
    }
    .container { max-width: 1000px; margin: 0 auto; }
    header {
      text-align: center;
      border-bottom: 2px solid #0f0;
      padding: 20px 0;
      margin-bottom: 30px;
    }
    h1 {
      font-size: 2em;
      text-shadow: 0 0 10px #0f0;
      margin-bottom: 10px;
    }
    h2 {
      color: #0f0;
      border-bottom: 1px solid #0f0;
      padding: 10px 0;
      margin: 20px 0 10px 0;
      text-shadow: 0 0 5px #0f0;
    }
    h3 { margin: 15px 0 10px 0; font-weight: bold; }
    h4 { color: #0f0; }
    p { margin: 8px 0; }
    section { margin: 20px 0; padding: 10px; border: 1px solid #0f0; border-radius: 4px; }
    table { background: #111; }
    th, td { text-align: left; padding: 12px; border: 1px solid #0f0; }
    .stats {
      display: grid;
      grid-template-columns: repeat(5, 1fr);
      gap: 10px;
      margin: 20px 0;
    }
    .stat-box {
      background: #111;
      border: 1px solid #0f0;
      padding: 15px;
      text-align: center;
      border-radius: 4px;
    }
    .stat-number {
      font-size: 2em;
      font-weight: bold;
      color: #0f0;
      text-shadow: 0 0 10px #0f0;
    }
    .stat-label { font-size: 0.9em; color: #0a0; margin-top: 5px; }
    .metadata { font-size: 0.9em; color: #0a0; }
  </style>
</head>
<body>
  <div class="container">
    <header>
      <h1>⚔️ Penetration Testing Report</h1>
      <p class="metadata">Generated: ${new Date(reportData.generated).toLocaleString()}</p>
      <p class="metadata">Session ID: ${reportData.sessionId}</p>
      <p class="metadata">Duration: ${reportData.sessionDuration} seconds</p>
    </header>

    <section>
      <h2>Executive Summary</h2>
      <div class="stats">
        <div class="stat-box">
          <div class="stat-number">${reportData.totalFindings}</div>
          <div class="stat-label">Total Findings</div>
        </div>
        <div class="stat-box" style="border-color: #ff0000;">
          <div class="stat-number" style="color: #ff0000; text-shadow: 0 0 10px #ff0000;">${reportData.criticalCount}</div>
          <div class="stat-label">Critical</div>
        </div>
        <div class="stat-box" style="border-color: #ff6600;">
          <div class="stat-number" style="color: #ff6600; text-shadow: 0 0 10px #ff6600;">${reportData.highCount}</div>
          <div class="stat-label">High</div>
        </div>
        <div class="stat-box" style="border-color: #ffaa00;">
          <div class="stat-number" style="color: #ffaa00; text-shadow: 0 0 10px #ffaa00;">${reportData.mediumCount}</div>
          <div class="stat-label">Medium</div>
        </div>
        <div class="stat-box" style="border-color: #ffff00;">
          <div class="stat-number" style="color: #ffff00; text-shadow: 0 0 10px #ffff00;">${reportData.lowCount}</div>
          <div class="stat-label">Low</div>
        </div>
      </div>
    </section>

    ${reportData.totalFindings > 0 ? `
      <section>
        <h2>Detailed Findings</h2>
        ${findingsHTML}
      </section>
    ` : '<section><h2>No Findings</h2><p>No vulnerabilities or findings were recorded during this session.</p></section>'}

    ${commandHistoryHTML}
    ${notesSection}

    <section style="margin-top: 30px; border-top: 2px solid #0f0; padding-top: 20px;">
      <h2>Recommendations</h2>
      <ol>
        <li>Prioritize remediation of CRITICAL and HIGH severity findings</li>
        <li>Cross-reference all identified CVEs with available patches</li>
        <li>Implement controls to prevent identified vulnerabilities</li>
        <li>Re-test systems after remediation efforts</li>
        <li>Document all changes and maintain audit logs for compliance</li>
        <li>Conduct regular security assessments to identify new risks</li>
      </ol>
    </section>

    <footer style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #0f0; text-align: center; font-size: 0.9em; color: #0a0;">
      <p>Report generated by Kali Hacker Bot v1.0 - ${new Date().toLocaleString()}</p>
      <p style="margin-top: 10px;">Classified as: PENETRATION TEST FINDINGS</p>
    </footer>
  </div>
</body>
</html>`;
}

// ============================================
// PLUGIN MANAGEMENT
// ============================================

app.get('/api/plugins', authenticate, (req, res) => {
  const plugins = pluginManager.getPlugins();
  res.json({
    success: true,
    plugins: plugins.map(p => ({
      name: p.name,
      version: p.version,
      description: p.description,
      enabled: p.enabled
    }))
  });
});

app.post('/api/plugins/enable/:name', authenticate, (req, res) => {
  const { name } = req.params;

  if (pluginManager.enable(name)) {
    const plugin = pluginManager.plugins.get(name);
    res.json({
      success: true,
      name: name,
      enabled: true,
      plugin: {
        name: plugin.name,
        version: plugin.version,
        description: plugin.description
      }
    });
  } else {
    res.status(404).json({ error: `Plugin ${name} not found` });
  }
});

app.post('/api/plugins/disable/:name', authenticate, (req, res) => {
  const { name } = req.params;

  if (pluginManager.disable(name)) {
    const plugin = pluginManager.plugins.get(name);
    res.json({
      success: true,
      name: name,
      enabled: false,
      plugin: {
        name: plugin.name,
        version: plugin.version,
        description: plugin.description
      }
    });
  } else {
    res.status(404).json({ error: `Plugin ${name} not found` });
  }
});

// ============================================
// SYSTEM ENDPOINTS
// ============================================

// Health check endpoint (no auth required)
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.get('/api/system/status', authenticate, async (req, res) => {
  try {
    const [dockerStatus, ollamaStatus] = await Promise.all([
      checkDockerHealth(),
      checkOllamaHealth(),
    ]);

    res.json({
      docker: dockerStatus,
      ollama: ollamaStatus,
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to check system status' });
  }
});

async function checkDockerHealth() {
  try {
    const container = docker.getContainer(KALI_CONTAINER);
    const info = await container.inspect();
    return {
      connected: true,
      containerRunning: info.State.Running,
      container: KALI_CONTAINER,
      image: info.Config.Image,
    };
  } catch (err) {
    return { connected: false, error: err.message };
  }
}

async function checkOllamaHealth() {
  const results = {};
  for (const [id, instance] of ollamaInstances) {
    try {
      const response = await axios.get(`${instance.url}/api/tags`, { timeout: 3000 });
      results[id] = {
        connected: true,
        url: instance.url,
        modelCount: (response.data.models || []).length,
      };
    } catch (err) {
      results[id] = { connected: false, url: instance.url, error: err.message };
    }
  }
  // Return the primary instance status for backward compat, plus all instances
  return {
    ...(results['ollama'] || { connected: false, url: OLLAMA_URL }),
    instances: results,
  };
}

// ============================================
// START SERVER
// ============================================

const server = app.listen(PORT, BIND_HOST, () => {
  const HOST_DISPLAY = BIND_HOST === '0.0.0.0' ? 'localhost' : BIND_HOST;
  console.log(`\n  ╔══════════════════════════════════════════╗`);
  console.log(`  ║     KALI HACKER BOT v1.0                ║`);
  console.log(`  ╠══════════════════════════════════════════╣`);
  console.log(`  ║  Web UI:    http://${HOST_DISPLAY}:${PORT}`.padEnd(44) + `║`);
  console.log(`  ║  Bind:      ${BIND_HOST}`.padEnd(44) + `║`);
  console.log(`  ║  Docker:    /var/run/docker.sock         ║`);
  console.log(`  ║  Ollama:    ${OLLAMA_URL.padEnd(28)}║`);
  console.log(`  ║  Container: ${KALI_CONTAINER.padEnd(28)}║`);
  console.log(`  ╚══════════════════════════════════════════╝\n`);
});

// ============================================
// GRACEFUL SHUTDOWN
// ============================================

// Handle graceful shutdown for sandbox cleanup
async function gracefulShutdown(signal) {
  console.log(`\n🛑 Received ${signal}, shutting down gracefully...`);
  
  try {
    // Clean up active sandboxes
    if (sandboxManager) {
      console.log('⏳ Cleaning up sandboxes...');
      await sandboxManager.cleanup();
      console.log('✓ Sandboxes cleaned up');
    }

    // Close server
    console.log('⏳ Closing server...');
    server.close(() => {
      console.log('✓ Server closed');
      process.exit(0);
    });

    // Force exit after 10 seconds
    setTimeout(() => {
      console.error('✗ Forced shutdown (timeout)');
      process.exit(1);
    }, 10000);
  } catch (error) {
    console.error('✗ Error during shutdown:', error.message);
    process.exit(1);
  }
}

// Handle uncaught exceptions and unhandled promise rejections
process.on('uncaughtException', (error) => {
  console.error('💥 Uncaught Exception:', error);
  gracefulShutdown('uncaughtException');
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('💥 Unhandled Rejection at:', promise, 'reason:', reason);
  gracefulShutdown('unhandledRejection');
});

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
