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
const OLLAMA_URL = process.env.OLLAMA_URL || 'http://localhost:11434';
const KALI_CONTAINER = process.env.KALI_CONTAINER || 'kali-linux';

// Security middleware
app.use(helmet());
app.use(cors({ origin: 'localhost' }));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
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

// Session storage (in-memory, in production use Redis)
const sessions = new Map();

// ============================================
// AUTHENTICATION
// ============================================

// Simple token-based auth (in production use proper JWT)
const AUTH_SECRET = process.env.AUTH_SECRET || 'changeme-' + uuidv4();

app.post('/api/auth/login', (req, res) => {
  const { password } = req.body;

  // In production, verify against proper credentials
  const expectedPassword = process.env.ADMIN_PASSWORD || 'kalibot';

  if (password !== expectedPassword) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const sessionId = uuidv4();
  const token = Buffer.from(`${sessionId}:${AUTH_SECRET}`).toString('base64');

  sessions.set(sessionId, {
    createdAt: Date.now(),
    expiresAt: Date.now() + (24 * 60 * 60 * 1000), // 24 hours
    userId: 'admin'
  });

  res.json({ token, sessionId });
});

// Auth middleware
function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing token' });
  }

  const token = authHeader.slice(7);
  try {
    const [sessionId, secret] = Buffer.from(token, 'base64').toString().split(':');
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
  const { command } = req.body;

  if (!command) {
    return res.status(400).json({ error: 'Command required' });
  }

  try {
    const container = docker.getContainer(KALI_CONTAINER);

    const exec = await container.exec({
      Cmd: ['bash', '-c', command],
      AttachStdout: true,
      AttachStderr: true,
    });

    const stream = await exec.start({ Detach: false });
    let output = '';

    stream.on('data', (chunk) => {
      output += chunk.toString();
    });

    stream.on('end', () => {
      res.json({
        success: true,
        output: output,
        command: command,
        timestamp: new Date().toISOString()
      });
    });

  } catch (err) {
    console.error('Docker exec error:', err);
    res.status(500).json({ error: 'Command execution failed', details: err.message });
  }
});

// Stream command output via Server-Sent Events
app.get('/api/docker/stream/:execId', authenticate, async (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  // This is a placeholder for streaming infrastructure
  // In production, would need proper stream management
  res.write('data: {"status":"Stream initialized"}\n\n');

  const interval = setInterval(() => {
    res.write('data: {"status":"waiting"}\n\n');
  }, 30000); // Keep-alive every 30s

  req.on('close', () => {
    clearInterval(interval);
    res.end();
  });
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
      uptime: new Date(info.State.StartedAt)
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to get container status', details: err.message });
  }
});

// ============================================
// OLLAMA API ENDPOINTS
// ============================================

app.post('/api/ollama/generate', authenticate, async (req, res) => {
  const { prompt, model = 'dolphin-mixtral' } = req.body;

  if (!prompt) {
    return res.status(400).json({ error: 'Prompt required' });
  }

  try {
    const response = await axios.post(`${OLLAMA_URL}/api/generate`, {
      model: model,
      prompt: prompt,
      stream: false,
      temperature: 0.7,
    });

    res.json({
      success: true,
      model: model,
      response: response.data.response,
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    console.error('Ollama error:', err.message);
    res.status(500).json({ error: 'LLM generation failed', details: err.message });
  }
});

// Stream ollama response via SSE
app.post('/api/ollama/stream', authenticate, async (req, res) => {
  const { prompt, model = 'dolphin-mixtral' } = req.body;

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  try {
    const response = await axios.post(`${OLLAMA_URL}/api/generate`, {
      model: model,
      prompt: prompt,
      stream: true,
      temperature: 0.7,
    }, {
      responseType: 'stream'
    });

    response.data.on('data', (chunk) => {
      try {
        const lines = chunk.toString().split('\n').filter(l => l.trim());
        lines.forEach(line => {
          const json = JSON.parse(line);
          res.write(`data: ${JSON.stringify({ token: json.response })}\n\n`);
        });
      } catch (e) {
        console.error('Parse error:', e);
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

  } catch (err) {
    res.write(`data: ${JSON.stringify({ error: err.message })}\n\n`);
    res.end();
  }
});

app.get('/api/ollama/models', authenticate, async (req, res) => {
  try {
    const response = await axios.get(`${OLLAMA_URL}/api/tags`);
    res.json({
      models: response.data.models || []
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch models', details: err.message });
  }
});

// ============================================
// SYSTEM ENDPOINTS
// ============================================

app.get('/api/system/status', authenticate, async (req, res) => {
  try {
    const dockerStatus = await checkDockerHealth();
    const ollamaStatus = await checkOllamaHealth();

    res.json({
      docker: dockerStatus,
      ollama: ollamaStatus,
      timestamp: new Date().toISOString()
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
      container: KALI_CONTAINER
    };
  } catch (err) {
    return {
      connected: false,
      error: err.message
    };
  }
}

async function checkOllamaHealth() {
  try {
    await axios.get(`${OLLAMA_URL}/api/tags`);
    return {
      connected: true,
      url: OLLAMA_URL
    };
  } catch (err) {
    return {
      connected: false,
      error: err.message
    };
  }
}

// ============================================
// START SERVER
// ============================================

app.listen(PORT, () => {
  console.log(`🎯 Kali Hacker Bot running on http://localhost:${PORT}`);
  console.log(`🐳 Docker Socket: /var/run/docker.sock`);
  console.log(`🦙 Ollama API: ${OLLAMA_URL}`);
  console.log(`⚙️  Kali Container: ${KALI_CONTAINER}`);
});
