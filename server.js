const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const Docker = require('dockerode');
const axios = require('axios');
const expressStaticGzip = require('express-static-gzip');

const app = express();
const PORT = process.env.PORT || 31337;
let OLLAMA_URL = process.env.OLLAMA_URL || 'http://localhost:11434';
const KALI_CONTAINER = process.env.KALI_CONTAINER || 'kali-linux';

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

// Session storage
const sessions = new Map();

// Command history per session
const commandHistory = new Map();

// Active exec processes (for kill switch)
const activeProcesses = new Map();

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

  sessions.set(sessionId, {
    createdAt: Date.now(),
    expiresAt: Date.now() + (24 * 60 * 60 * 1000),
    userId: 'admin',
    notes: '',
  });

  commandHistory.set(sessionId, []);

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
    const session = sessions.get(sessionId);

    if (!session || session.expiresAt < Date.now() || secret !== AUTH_SECRET) {
      return res.status(401).json({ error: 'Invalid token' });
    }

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

  // Store in history
  const history = commandHistory.get(req.sessionId) || [];
  history.push({ command, timestamp: new Date().toISOString() });
  if (history.length > 500) history.shift();
  commandHistory.set(req.sessionId, history);

  try {
    const container = docker.getContainer(KALI_CONTAINER);

    const exec = await container.exec({
      Cmd: ['bash', '-c', command],
      AttachStdout: true,
      AttachStderr: true,
    });

    const execId = exec.id;
    const stream = await exec.start({ Detach: false });
    let output = '';
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

app.post('/api/ollama/generate', authenticate, async (req, res) => {
  const { prompt, model = 'dolphin-mixtral', temperature = 0.7, systemPrompt } = req.body;

  if (!prompt) {
    return res.status(400).json({ error: 'Prompt required' });
  }

  try {
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
  const { prompt, model = 'dolphin-mixtral', temperature = 0.7, systemPrompt } = req.body;

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  try {
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
  const history = commandHistory.get(req.sessionId) || [];
  res.json({ history });
});

// Session notes (scratchpad)
app.get('/api/session/notes', authenticate, (req, res) => {
  const session = sessions.get(req.sessionId);
  res.json({ notes: session ? session.notes : '' });
});

app.post('/api/session/notes', authenticate, (req, res) => {
  const { notes } = req.body;
  const session = sessions.get(req.sessionId);
  if (session) {
    session.notes = notes || '';
    res.json({ success: true });
  } else {
    res.status(404).json({ error: 'Session not found' });
  }
});

// Export session data
app.get('/api/session/export', authenticate, (req, res) => {
  const session = sessions.get(req.sessionId);
  const history = commandHistory.get(req.sessionId) || [];

  const exportData = {
    sessionId: req.sessionId,
    exportedAt: new Date().toISOString(),
    session: {
      createdAt: session ? new Date(session.createdAt).toISOString() : null,
      notes: session ? session.notes : '',
    },
    commandHistory: history,
  };

  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Content-Disposition', `attachment; filename="pentest-session-${req.sessionId.slice(0, 8)}-${Date.now()}.json"`);
  res.json(exportData);
});

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

app.listen(PORT, () => {
  console.log(`\n  ╔══════════════════════════════════════════╗`);
  console.log(`  ║     KALI HACKER BOT v1.0                ║`);
  console.log(`  ╠══════════════════════════════════════════╣`);
  console.log(`  ║  Web UI:    http://localhost:${PORT}      ║`);
  console.log(`  ║  Docker:    /var/run/docker.sock         ║`);
  console.log(`  ║  Ollama:    ${OLLAMA_URL.padEnd(28)}║`);
  console.log(`  ║  Container: ${KALI_CONTAINER.padEnd(28)}║`);
  console.log(`  ╚══════════════════════════════════════════╝\n`);
});
