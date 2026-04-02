const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');
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
const KALI_CONTAINER = process.env.KALI_CONTAINER || 'Kali-AI-linux';

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
const docker = new Docker({ socketPath: '/var/run/docker.sock' });

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

// Register Ollama provider (always available locally)
const ollamaProvider = new OllamaProvider(OLLAMA_URL, appLogger);
orchestrator.registerProvider('ollama', ollamaProvider);

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

const AUTH_SECRET = process.env.AUTH_SECRET || 'changeme-' + uuidv4();

app.post('/api/auth/login', (req, res) => {
  const { password } = req.body;
  const expectedPassword = process.env.ADMIN_PASSWORD || 'kalibot';

  if (password !== expectedPassword) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const sessionId = uuidv4();
  const token = Buffer.from(`${sessionId}:${AUTH_SECRET}`).toString('base64');
  const expiresAt = new Date(Date.now() + (24 * 60 * 60 * 1000));

  // Save session to database
  db.createSession(sessionId, token, AUTH_SECRET, expiresAt.toISOString());

  res.json({ token, sessionId });
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
  const { command, timeout = 30000 } = req.body;

  if (!command) {
    return res.status(400).json({ error: 'Command required' });
  }

  try {
    const container = docker.getContainer(KALI_CONTAINER);
    const startTime = Date.now();

    const exec = await container.exec({
      Cmd: ['bash', '-c', command],
      AttachStdout: true,
      AttachStderr: true,
    });

    const execId = exec.id;
    const stream = await exec.start({ Detach: false });
    let output = '';
    let errorOutput = '';
    let timedOut = false;

    activeProcesses.set(execId, exec);

    const timer = setTimeout(() => {
      timedOut = true;
      stream.destroy();
    }, timeout);

    stream.on('data', (chunk) => {
      // Docker stream has 8-byte header per frame; strip it
      const raw = chunk.toString();
      output += raw;
    });

    stream.on('end', () => {
      clearTimeout(timer);
      activeProcesses.delete(execId);

      const durationSeconds = Math.round((Date.now() - startTime) / 1000);

      // Store command in database
      db.addCommand(req.sessionId, command, durationSeconds, output, errorOutput, !timedOut);

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
    });

    const stream = await exec.start({ Detach: false });
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
    });

    const stream = await exec.start({ Detach: false });
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
  if (url) {
    OLLAMA_URL = url;
    res.json({ success: true, url: OLLAMA_URL });
  } else {
    res.status(400).json({ error: 'URL required' });
  }
});

app.get('/api/ollama/config', authenticate, (req, res) => {
  res.json({ url: OLLAMA_URL });
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
  const { prompt, model = 'dolphin-mixtral', temperature = 0.7, systemPrompt, useOrchestrator = false, taskType = 'default' } = req.body;

  if (!prompt) {
    return res.status(400).json({ error: 'Prompt required' });
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
  const { prompt, model = 'dolphin-mixtral', temperature = 0.7, systemPrompt, useOrchestrator = false, taskType = 'default' } = req.body;

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

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
  try {
    const response = await axios.get(`${OLLAMA_URL}/api/tags`);
    res.json({ models: response.data.models || [] });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch models', details: err.message });
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
  try {
    const response = await axios.get(`${OLLAMA_URL}/api/tags`, { timeout: 3000 });
    return {
      connected: true,
      url: OLLAMA_URL,
      modelCount: (response.data.models || []).length,
    };
  } catch (err) {
    return { connected: false, url: OLLAMA_URL, error: err.message };
  }
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

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
