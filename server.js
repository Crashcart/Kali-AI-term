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

// ============================================
// LLM INTERACTION LOG
// In-memory ring buffer (max 500 entries). Accessible via GET /api/llm/log.
// ============================================
const LLM_LOG_MAX = 500;
const llmLog = [];

function addLLMLogEntry(entry) {
  llmLog.push({ id: llmLog.length + 1, ts: new Date().toISOString(), ...entry });
  if (llmLog.length > LLM_LOG_MAX) llmLog.shift();
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

// Run 3-day retention cleanup on startup, then every 6 hours
db.cleanupStaleHosts();
db.cleanupExpiredSessions();
setInterval(() => { db.cleanupStaleHosts(); db.cleanupExpiredSessions(); }, 6 * 60 * 60 * 1000);

// Active exec processes (for kill switch)
const activeProcesses = new Map();

// ============================================
// HOST DB API ENDPOINTS (core feature)
// ============================================

// GET /api/hosts — list all saved hosts
app.get('/api/hosts', authenticate, (req, res) => {
  try {
    const hosts = db.getAllHosts();
    res.json({ success: true, hosts });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/hosts/:ip — full host details + ports
app.get('/api/hosts/:ip', authenticate, (req, res) => {
  const ip = req.params.ip;
  if (!/^[a-zA-Z0-9.\-_]+$/.test(ip) || ip.length > 253) {
    return res.status(400).json({ error: 'Invalid IP/hostname' });
  }
  try {
    const host = db.getHost(ip);
    if (!host) return res.status(404).json({ error: 'Host not found' });
    res.json({ success: true, host });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/hosts — manually add/update a host
app.post('/api/hosts', authenticate, (req, res) => {
  const { ip, hostname, os, status, notes } = req.body;
  if (!ip || typeof ip !== 'string' || !/^[a-zA-Z0-9.\-_]+$/.test(ip) || ip.length > 253) {
    return res.status(400).json({ error: 'Valid IP or hostname required' });
  }
  try {
    db.upsertHost(ip, { hostname, os, status: status || 'up' });
    if (notes !== undefined) db.updateHostNotes(ip, notes);
    res.json({ success: true, host: db.getHost(ip) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/hosts/:ip — update notes for a host
app.put('/api/hosts/:ip', authenticate, (req, res) => {
  const ip = req.params.ip;
  if (!/^[a-zA-Z0-9.\-_]+$/.test(ip) || ip.length > 253) {
    return res.status(400).json({ error: 'Invalid IP/hostname' });
  }
  const { notes, hostname, os, status } = req.body;
  try {
    db.upsertHost(ip, { hostname, os, status });
    if (notes !== undefined) db.updateHostNotes(ip, notes);
    const host = db.getHost(ip);
    if (!host) return res.status(404).json({ error: 'Host not found' });
    res.json({ success: true, host });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/hosts/:ip — delete a host record
app.delete('/api/hosts/:ip', authenticate, (req, res) => {
  const ip = req.params.ip;
  if (!/^[a-zA-Z0-9.\-_]+$/.test(ip) || ip.length > 253) {
    return res.status(400).json({ error: 'Invalid IP/hostname' });
  }
  try {
    const result = db.deleteHost(ip);
    if (result.changes === 0) return res.status(404).json({ error: 'Host not found' });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/hosts/parse-nmap — parse raw nmap output and auto-save hosts
app.post('/api/hosts/parse-nmap', authenticate, (req, res) => {
  const { output } = req.body;
  if (!output || typeof output !== 'string') {
    return res.status(400).json({ error: 'output required' });
  }
  try {
    const saved = db.parseAndSaveNmapOutput(output);
    res.json({ success: true, saved });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

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

// Register Gemini provider — env var takes precedence; fall back to persisted config file
const GEMINI_CONFIG_FILE = path.join(__dirname, 'config', 'gemini-config.json');
let _geminiStartupKey = process.env.GEMINI_API_KEY || null;
let _geminiStartupModel = process.env.GEMINI_MODEL || null;
if (!_geminiStartupKey) {
  try {
    if (fs.existsSync(GEMINI_CONFIG_FILE)) {
      const saved = JSON.parse(fs.readFileSync(GEMINI_CONFIG_FILE, 'utf8'));
      _geminiStartupKey = saved.apiKey || null;
      _geminiStartupModel = saved.model || _geminiStartupModel;
      if (_geminiStartupKey) appLogger.info('Gemini API key loaded from config/gemini-config.json');
    }
  } catch (e) {
    appLogger.warn(`Could not load config/gemini-config.json: ${e.message}`);
  }
}
if (_geminiStartupKey) {
  const geminiProvider = new GeminiProvider(_geminiStartupKey, appLogger);
  if (_geminiStartupModel) geminiProvider.setModel(_geminiStartupModel);
  orchestrator.registerProvider('gemini', geminiProvider);
  appLogger.info(`✓ Gemini API provider registered`);
} else {
  appLogger.warn(`⚠ GEMINI_API_KEY not set. Gemini provider unavailable. Set it via Settings → AI/LLM → Gemini API Key.`);
}

// Set up routing strategies for different task types
orchestrator.setRoutingStrategy('reasoning', {
  primary: 'ollama',      // Use local Ollama for reasoning
  fallback: 'gemini',
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
  primary: 'ollama',      // Use local Ollama; fall back to Gemini for quality
  fallback: 'gemini',
  timeout: 120000,
  retries: 2
});

// Initialize multi-LLM routes
const multiLLMRoutes = createMultiLLMRoutes(orchestrator, appLogger);
app.use(multiLLMRoutes);

appLogger.info(`✓ Multi-LLM Orchestrator initialized with ${orchestrator.getAllProviders().length} provider(s)`);

// ============================================
// AUTO-PULL DEFAULT MODEL ON FIRST RUN
// If Ollama is reachable but has zero models, pull the default lightweight model.
// This runs in the background and does not block server startup.
// ============================================
(async () => {
  if (LLM_FROZEN) return;
  try {
    const tagsRes = await axios.get(`${OLLAMA_URL}/api/tags`, { timeout: 5000 });
    const models = tagsRes.data.models || [];
    if (models.length === 0) {
      const modelToPull = DEFAULT_MODEL || 'phi3:mini';
      appLogger.info(`No models found in Ollama — auto-pulling default model: ${modelToPull}`);
      const pullRes = await axios.post(`${OLLAMA_URL}/api/pull`, { name: modelToPull, stream: false }, { timeout: 600000 });
      if (pullRes.data && pullRes.data.status === 'success') {
        appLogger.info(`✓ Auto-pull complete: ${modelToPull} is now available`);
      } else {
        appLogger.info(`Auto-pull finished for ${modelToPull}: ${JSON.stringify(pullRes.data)}`);
      }
    } else {
      appLogger.debug(`Ollama already has ${models.length} model(s) — skipping auto-pull`);
    }
  } catch (err) {
    appLogger.debug(`Auto-pull check skipped (Ollama not reachable or pull failed): ${err.message}`);
  }
})();

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
  const expiresAt = new Date(Date.now() + (3 * 24 * 60 * 60 * 1000)); // 3-day rule

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
      User: 'root',
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

      // Auto-save discovered hosts if this looks like an nmap command
      if (/^\s*nmap\b/i.test(command) && output.includes('Nmap scan report')) {
        try { db.parseAndSaveNmapOutput(output); } catch (_) {}
      }

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

// ============================================
// GEMINI API SETTINGS ENDPOINTS
// ============================================

/**
 * GET /api/gemini/config
 * Return current Gemini provider configuration.
 * The API key value is never returned; only whether one is set.
 */
app.get('/api/gemini/config', authenticate, (req, res) => {
  const geminiProvider = orchestrator.getProvider('gemini');
  const configured = !!geminiProvider;
  const model = geminiProvider ? geminiProvider.model : null;
  const apiKeySet = configured ? !!geminiProvider.apiKey : false;

  res.json({
    success: true,
    configured,
    apiKeySet,
    model: model || null
  });
});

/**
 * POST /api/gemini/config
 * Update Gemini API key and/or model at runtime.
 * Body: { apiKey?: string, model?: string }
 */
app.post('/api/gemini/config', authenticate, (req, res) => {
  const { apiKey, model } = req.body;

  if (apiKey !== undefined && (typeof apiKey !== 'string' || apiKey.trim() === '')) {
    return res.status(400).json({ error: 'apiKey must be a non-empty string' });
  }

  if (model !== undefined && (typeof model !== 'string' || model.trim() === '')) {
    return res.status(400).json({ error: 'model must be a non-empty string' });
  }

  if (!apiKey && !model) {
    return res.status(400).json({ error: 'apiKey or model is required' });
  }

  let geminiProvider = orchestrator.getProvider('gemini');

  if (!geminiProvider) {
    // Create the provider if it doesn't exist yet (e.g. no GEMINI_API_KEY at startup)
    if (!apiKey) {
      return res.status(400).json({ error: 'apiKey is required to initialise the Gemini provider' });
    }
    geminiProvider = new GeminiProvider(apiKey.trim(), appLogger);
    orchestrator.registerProvider('gemini', geminiProvider);
    appLogger.info('Gemini provider created via /api/gemini/config');
  } else {
    if (apiKey) {
      geminiProvider.setApiKey(apiKey.trim());
      appLogger.info('Gemini API key updated via /api/gemini/config');
    }
  }

  if (model) {
    geminiProvider.setModel(model.trim());
    appLogger.info(`Gemini model updated to ${model.trim()} via /api/gemini/config`);
  }

  // Persist key + model to config file so they survive server restarts
  try {
    const configDir = path.join(__dirname, 'config');
    if (!fs.existsSync(configDir)) fs.mkdirSync(configDir, { recursive: true });
    const existing = fs.existsSync(GEMINI_CONFIG_FILE)
      ? JSON.parse(fs.readFileSync(GEMINI_CONFIG_FILE, 'utf8'))
      : {};
    const toWrite = {
      apiKey: apiKey ? apiKey.trim() : (existing.apiKey || geminiProvider.apiKey),
      model: geminiProvider.model,
    };
    fs.writeFileSync(GEMINI_CONFIG_FILE, JSON.stringify(toWrite, null, 2), { mode: 0o600 });
    appLogger.info('Gemini config persisted to config/gemini-config.json');
  } catch (writeErr) {
    appLogger.warn(`Could not persist Gemini config: ${writeErr.message}`);
  }

  res.json({
    success: true,
    configured: true,
    apiKeySet: !!geminiProvider.apiKey,
    model: geminiProvider.model
  });
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
  const { prompt, model = DEFAULT_MODEL, temperature = 0.7, systemPrompt, useOrchestrator = false, taskType = 'default', preferredProvider = null } = req.body;

  if (!prompt) {
    return res.status(400).json({ error: 'Prompt required' });
  }

  // LLM_FROZEN was set for a specific heavy model (dolphin-mixtral). The current
  // model (phi3:mini) is lightweight — don't block, just log a warning and proceed.
  if (LLM_FROZEN) {
    appLogger.warn(`LLM frozen state active but proceeding with model ${DEFAULT_MODEL}. Reason: ${llmState.reason}`);
  }

  const logEntry = { type: 'generate', provider: useOrchestrator ? 'orchestrator' : 'ollama', model, prompt: prompt.slice(0, 500), taskType, status: 'pending', durationMs: null };
  const t0 = Date.now();

  try {
    // If useOrchestrator is true, route through the multi-LLM orchestrator
    if (useOrchestrator) {
      const response = await orchestrator.generate(prompt, {
        taskType: taskType,
        preferredProvider: preferredProvider,
        temperature: temperature,
        systemPrompt: systemPrompt || SYSTEM_PROMPT
      });

      logEntry.status = 'ok';
      logEntry.durationMs = Date.now() - t0;
      logEntry.responseSnippet = String(response).slice(0, 300);
      addLLMLogEntry(logEntry);

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

    logEntry.status = 'ok';
    logEntry.durationMs = Date.now() - t0;
    logEntry.responseSnippet = String(response.data.response || '').slice(0, 300);
    addLLMLogEntry(logEntry);

    res.json({
      success: true,
      model: model,
      response: response.data.response,
      context: response.data.context,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    logEntry.status = 'error';
    logEntry.durationMs = Date.now() - t0;
    logEntry.error = err.message;
    addLLMLogEntry(logEntry);
    console.error('Ollama error:', err.message);
    res.status(500).json({ error: 'LLM generation failed', details: err.message });
  }
});

app.post('/api/ollama/stream', authenticate, async (req, res) => {
  const { prompt, model = DEFAULT_MODEL, temperature = 0.7, systemPrompt, useOrchestrator = false, taskType = 'default', preferredProvider = null } = req.body;

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  // LLM_FROZEN was set for a specific heavy model (dolphin-mixtral). The current
  // model (phi3:mini) is lightweight — don't block streaming, just log a warning.
  if (LLM_FROZEN) {
    appLogger.warn(`LLM frozen state active but proceeding with model ${DEFAULT_MODEL} for stream. Reason: ${llmState.reason}`);
  }

  const logEntry = { type: 'stream', provider: useOrchestrator ? 'orchestrator' : 'ollama', model, prompt: prompt ? prompt.slice(0, 500) : '', taskType, status: 'pending', durationMs: null };
  const t0 = Date.now();

  try {
    // If useOrchestrator is true, route through the multi-LLM orchestrator
    if (useOrchestrator) {
      let tokenCount = 0;
      let lastProvider = null;
      for await (const chunk of orchestrator.streamGenerate(prompt, {
        taskType: taskType,
        preferredProvider: preferredProvider,
        temperature: temperature,
        systemPrompt: systemPrompt || SYSTEM_PROMPT
      })) {
        if (chunk.done) {
          res.write(`data: ${JSON.stringify({ done: true, provider: chunk.provider })}\n\n`);
          lastProvider = chunk.provider;
        } else {
          tokenCount++;
          res.write(`data: ${JSON.stringify({ token: chunk.token, provider: chunk.provider })}\n\n`);
        }
      }
      logEntry.status = 'ok';
      logEntry.durationMs = Date.now() - t0;
      logEntry.tokenCount = tokenCount;
      if (lastProvider) logEntry.provider = lastProvider;
      addLLMLogEntry(logEntry);
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

    let tokenCount = 0;
    response.data.on('data', (chunk) => {
      try {
        const lines = chunk.toString().split('\n').filter(l => l.trim());
        lines.forEach(line => {
          const json = JSON.parse(line);
          if (json.done) {
            res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
          } else {
            tokenCount++;
            res.write(`data: ${JSON.stringify({ token: json.response })}\n\n`);
          }
        });
      } catch (e) {
        // ignore parse errors on partial chunks
      }
    });

    response.data.on('end', () => {
      logEntry.status = 'ok';
      logEntry.durationMs = Date.now() - t0;
      logEntry.tokenCount = tokenCount;
      addLLMLogEntry(logEntry);
      res.write('data: {"done": true}\n\n');
      res.end();
    });

    response.data.on('error', (err) => {
      logEntry.status = 'error';
      logEntry.durationMs = Date.now() - t0;
      logEntry.error = err.message;
      addLLMLogEntry(logEntry);
      res.write(`data: ${JSON.stringify({ error: err.message })}\n\n`);
      res.end();
    });

    req.on('close', () => {
      response.data.destroy();
    });

  } catch (err) {
    logEntry.status = 'error';
    logEntry.durationMs = Date.now() - t0;
    logEntry.error = err.message;
    addLLMLogEntry(logEntry);
    res.write(`data: ${JSON.stringify({ error: err.message })}\n\n`);
    res.end();
  }
});

// ============================================
// LLM LOG ENDPOINTS
// ============================================

// GET /api/llm/log — return recent LLM interaction log entries
app.get('/api/llm/log', authenticate, (req, res) => {
  const limit = Math.min(parseInt(req.query.limit, 10) || 100, LLM_LOG_MAX);
  const entries = llmLog.slice(-limit).reverse();
  res.json({ count: entries.length, total: llmLog.length, entries });
});

// DELETE /api/llm/log — clear the log
app.delete('/api/llm/log', authenticate, (req, res) => {
  llmLog.length = 0;
  res.json({ success: true, message: 'LLM log cleared' });
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

// Escape user-controlled strings before embedding them in HTML output
function escapeHtml(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
}

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
            <p><strong>Timestamp:</strong> ${escapeHtml(finding.timestamp)}</p>
            <p><strong>Query:</strong> ${escapeHtml(finding.query)}</p>
            <p><strong>Description:</strong> ${escapeHtml(finding.description)}</p>
            ${finding.cves && finding.cves.length > 0 ? `<p><strong>Related CVEs:</strong> ${finding.cves.map(escapeHtml).join(', ')}</p>` : ''}
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
              <td style="border: 1px solid #0f0; padding: 8px; font-family: monospace;">${escapeHtml(cmd.command)}</td>
              <td style="border: 1px solid #0f0; padding: 8px;">${escapeHtml(cmd.duration) || 'N/A'}</td>
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
        ${reportData.sessionNotes.split('\n').map(line => `<p>${escapeHtml(line) || '<br>'}</p>`).join('')}
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
// AUTONOMOUS ATTACK PLANNING
// ============================================

app.post('/api/autonomous/plan', authenticate, async (req, res) => {
  const { target, model } = req.body;

  if (!target || typeof target !== 'string') {
    return res.status(400).json({ error: 'Target required' });
  }

  // Allow IPs, hostnames, and CIDR ranges only
  if (!/^[a-zA-Z0-9.\-_/]+$/.test(target) || target.length > 253) {
    return res.status(400).json({ error: 'Invalid target format' });
  }

  if (LLM_FROZEN) {
    appLogger.warn(`LLM frozen state detected for /api/autonomous/plan — attempting with fallback model ${DEFAULT_MODEL}`);
  }

  const planPrompt = `You are an elite penetration testing mentor teaching a student. Generate a comprehensive, methodical attack plan for target: ${target}

Respond with ONLY valid JSON (no markdown fences, no text outside the JSON object). Use exactly this structure:
{
  "target": "${target}",
  "phases": [
    {
      "name": "Passive Reconnaissance",
      "command": "whois ${target} && dig ${target} ANY +noall +answer 2>/dev/null || echo 'DNS lookup complete'",
      "purpose": "Gather public information before touching the target",
      "bestPractice": "Passive recon leaves no trace on the target. Whois reveals registrar, owner, and name servers. DNS ANY queries can expose subdomains, mail servers, and TXT records such as SPF/DMARC that reveal cloud providers in use.",
      "continueOnFail": true
    }
  ]
}

Include exactly these 12 phases in order (substitute the real target IP/host for every occurrence of the placeholder):
1.  Passive Reconnaissance      — whois + dig DNS enumeration (no packets to target)
2.  Host Discovery              — nmap -sn ping sweep to confirm liveness
3.  Fast TCP Port Scan          — nmap -T4 --top-ports 1000 for quick surface mapping
4.  Full TCP Port Scan          — nmap -p- --min-rate 5000 to catch every open port
5.  Service & Version Detection — nmap -sV -sC on all discovered open ports
6.  OS & Aggressive Fingerprint — nmap -O -A for OS, traceroute, and deep scripts
7.  UDP Top-Port Scan           — nmap -sU --top-ports 100 for DNS/SNMP/TFTP exposure
8.  Vulnerability Scan          — nmap --script vuln combined with nikto -h on port 80/443
9.  Web Enumeration             — wafw00f to detect WAF, then gobuster dir with dirb wordlist
10. SMB & NetBIOS Enumeration   — nbtscan + enum4linux for Windows/Samba targets
11. Exploit Research            — searchsploit on each discovered service and version string
12. Credential Brute Force      — hydra against discovered SSH/FTP/HTTP services using rockyou

For each bestPractice write 2-3 sentences explaining WHY the technique is used, what to look for in the output, and one pitfall to avoid. Speak as an experienced mentor. Replace every placeholder in commands with the real target value.`;

  // Template plan used when AI generation fails or no provider is available
  const templatePlan = {
    target,
    phases: [
      {
        name: 'Passive Reconnaissance',
        command: `whois ${target} 2>/dev/null; dig ${target} ANY +noall +answer 2>/dev/null; dig ${target} MX +noall +answer 2>/dev/null; dig ${target} NS +noall +answer 2>/dev/null`,
        purpose: 'Gather public information without sending packets to the target',
        bestPractice: 'Passive recon is completely silent — no packets reach the target. Whois reveals registrar, owner contacts, and name servers. DNS lookups expose mail servers, subdomains, and TXT records (SPF/DMARC) that hint at cloud providers and infrastructure.',
        continueOnFail: true
      },
      {
        name: 'Host Discovery',
        command: `nmap -sn ${target}`,
        purpose: 'Confirm the target is alive before investing time in deeper scans',
        bestPractice: 'Always begin with a ping sweep. The -sn flag skips port scanning and checks only reachability, keeping noise low. If the host does not respond it may be blocking ICMP — follow up with nmap -PS80,443 or -PA80 for TCP-based liveness checks.',
        continueOnFail: true
      },
      {
        name: 'Fast TCP Port Scan',
        command: `nmap -T4 --top-ports 1000 -oN /tmp/fast_scan_${target.replace(/[^a-zA-Z0-9]/g, '_')}.txt ${target}`,
        purpose: 'Quickly map the most common open TCP ports to guide further work',
        bestPractice: 'The top 1000 ports cover ~95% of real-world services and complete in seconds. Save results with -oN so later phases can reference discovered ports. Use -T3 instead of -T4 on slow or IDS-monitored links.',
        continueOnFail: false
      },
      {
        name: 'Full TCP Port Scan',
        command: `nmap -p- --min-rate 5000 -oN /tmp/full_scan_${target.replace(/[^a-zA-Z0-9]/g, '_')}.txt ${target}`,
        purpose: 'Discover services running on non-standard ports that fast scans miss',
        bestPractice: 'Scanning all 65535 ports uncovers hidden admin panels, development servers, and backdoors on non-standard ports. --min-rate 5000 speeds it up significantly; reduce this on production networks to avoid packet loss causing false negatives.',
        continueOnFail: false
      },
      {
        name: 'Service & Version Detection',
        command: `nmap -sV -sC -p- --open -oN /tmp/svc_scan_${target.replace(/[^a-zA-Z0-9]/g, '_')}.txt ${target}`,
        purpose: 'Identify exact software names and versions running on every open port',
        bestPractice: 'Exact version strings are the key to CVE lookup. -sC layers default NSE scripts on top of version detection — they check for anonymous FTP, SSL cert details, HTTP titles, and dozens more misconfigurations in a single pass. Look for end-of-life software versions.',
        continueOnFail: false
      },
      {
        name: 'OS & Aggressive Fingerprint',
        command: `nmap -O -A --osscan-guess ${target}`,
        purpose: 'Fingerprint the operating system and gather traceroute + deep script output',
        bestPractice: 'The -A flag combines OS detection, version detection, script scanning, and traceroute into one sweep. OS detection requires raw sockets (run as root). A match confidence below 90% is only a hint — use service banner strings to confirm. Aggressive scanning generates more noise.',
        continueOnFail: true
      },
      {
        name: 'UDP Top-Port Scan',
        command: `nmap -sU --top-ports 100 -T4 ${target}`,
        purpose: 'Discover UDP services such as DNS, SNMP, TFTP, and NTP that TCP scans miss entirely',
        bestPractice: 'UDP services are frequently overlooked and often less hardened. SNMP (161) exposes system info with default community strings; TFTP (69) may allow unauthenticated file read/write. UDP scanning is slow because closed ports only reply with ICMP unreachable — be patient.',
        continueOnFail: true
      },
      {
        name: 'Vulnerability Scan',
        command: `nmap --script vuln -p 21,22,23,25,53,80,110,139,143,443,445,3389 ${target} 2>/dev/null; nikto -h http://${target} -maxtime 120s 2>/dev/null || nikto -h https://${target} -maxtime 120s 2>/dev/null || echo "Nikto scan complete"`,
        purpose: 'Run automated vulnerability checks across network services and web applications',
        bestPractice: 'Nmap vuln scripts check for known CVEs, EternalBlue (MS17-010), Shellshock, and other critical vulnerabilities with low false-positive rates. Nikto covers 6700+ web checks including outdated software, dangerous files, and insecure configurations. Both are noisy — expect IDS alerts.',
        continueOnFail: true
      },
      {
        name: 'Web Enumeration',
        command: `wafw00f http://${target} 2>/dev/null; gobuster dir -u http://${target} -w /usr/share/wordlists/dirb/common.txt -t 30 -q 2>/dev/null || gobuster dir -u https://${target} -w /usr/share/wordlists/dirb/common.txt -t 30 -q 2>/dev/null || echo "Web enumeration complete"`,
        purpose: 'Detect web application firewalls and brute-force hidden directories and endpoints',
        bestPractice: 'Always run wafw00f first — a WAF will block or alert on directory brute-force, so you need to know before launching gobuster. The dirb/common.txt wordlist hits admin panels, backup files, config files, and .git directories that are often left exposed by accident.',
        continueOnFail: true
      },
      {
        name: 'SMB & NetBIOS Enumeration',
        command: `nbtscan ${target} 2>/dev/null; enum4linux -a ${target} 2>/dev/null || echo "SMB/NetBIOS enumeration complete"`,
        purpose: 'Extract shares, users, groups, and policies from Windows and Samba targets',
        bestPractice: 'Enum4linux wraps smbclient, rpcclient, and net commands into one tool. Null sessions (unauthenticated SMB) often reveal usernames, share names, and password policies that enable targeted brute-force. Even if null sessions are blocked, share listings can indicate OS type and domain membership.',
        continueOnFail: true
      },
      {
        name: 'Exploit Research',
        command: `searchsploit --colour $(nmap -sV --open -p 21,22,23,25,80,110,139,443,445,3389,8080 ${target} 2>/dev/null | grep -oP '(?<=open  )\\S+.*' | tr '\\n' ' ') 2>/dev/null || searchsploit ${target} 2>/dev/null || echo "Searchsploit complete — check /usr/share/exploitdb manually"`,
        purpose: 'Cross-reference discovered service versions against the Exploit-DB offline database',
        bestPractice: 'Searchsploit queries the local copy of Exploit-DB — no internet required and no target interaction. Match the exact version string from nmap output for highest accuracy. Prefer ranked Metasploit modules over raw exploits; they handle offsets, bad chars, and reliability automatically.',
        continueOnFail: true
      },
      {
        name: 'Credential Brute Force',
        command: `hydra -L /usr/share/wordlists/metasploit/unix_users.txt -P /usr/share/wordlists/rockyou.txt -t 4 -f ssh://${target} 2>/dev/null || hydra -L /usr/share/wordlists/metasploit/unix_users.txt -P /usr/share/wordlists/rockyou.txt -t 4 -f ftp://${target} 2>/dev/null || echo "Credential brute force complete"`,
        purpose: 'Test common credentials against discovered authentication services',
        bestPractice: 'Use -f to stop after the first valid credential pair to reduce lockout risk. Limit threads (-t 4) on services with account lockout policies. Always test default credentials (admin/admin, root/root, anonymous/anonymous) before launching a full dictionary — they hit more often than expected.',
        continueOnFail: true
      }
    ]
  };

  let aiPlanUsed = false;

  try {
    const result = await orchestrator.generate(planPrompt, {
      systemPrompt: SYSTEM_PROMPT,
      temperature: 0.2,
      model: (typeof model === 'string' && model.trim()) ? model.trim() : DEFAULT_MODEL,
    });

    const raw = (result && result.response) || '';

    // Extract the first JSON object — models sometimes wrap in markdown
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        const parsed = JSON.parse(jsonMatch[0]);
        if (parsed.phases && Array.isArray(parsed.phases) && parsed.phases.length > 0) {
          parsed.phases = parsed.phases.slice(0, 15);
          aiPlanUsed = true;
          return res.json({ success: true, plan: parsed });
        }
      } catch (_) {
        // JSON parse failed — fall through to template
      }
    }
  } catch (err) {
    appLogger.warn(`Autonomous plan AI generation failed (using template): ${err.message}`);
  }

  // AI unavailable or returned unusable output — use the deterministic template plan
  appLogger.info(`Autonomous plan: using template plan for target ${target} (aiPlanUsed=${aiPlanUsed})`);
  res.json({ success: true, plan: templatePlan, template: true });
});

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
