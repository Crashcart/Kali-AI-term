/**
 * Gemini Settings API Endpoints Tests
 * Covers GET /api/gemini/config and POST /api/gemini/config
 */

const request = require('supertest');
const express = require('express');

// Minimal mock of GeminiProvider
class MockGeminiProvider {
  constructor(apiKey) {
    this.name = 'gemini';
    this.apiKey = apiKey;
    this.model = 'gemini-pro';
  }

  setApiKey(apiKey) {
    this.apiKey = apiKey;
  }

  setModel(model) {
    this.model = model;
  }
}

// Minimal mock of LLMOrchestrator
class MockOrchestrator {
  constructor() {
    this.providers = new Map();
  }

  registerProvider(name, provider) {
    this.providers.set(name, provider);
  }

  getProvider(name) {
    return this.providers.get(name) || null;
  }
}

function createTestApp({ withGeminiProvider = true } = {}) {
  const app = express();
  app.use(express.json());

  const sessions = new Map();
  const AUTH_SECRET = 'test-secret';

  const authenticate = (req, res, next) => {
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
      if (!sessions.has(sessionId) || secret !== AUTH_SECRET) {
        return res.status(401).json({ error: 'Invalid token' });
      }
      req.sessionId = sessionId;
      next();
    } catch (_) {
      res.status(401).json({ error: 'Invalid token' });
    }
  };

  app.post('/api/auth/login', (req, res) => {
    const { password } = req.body;
    if (password !== 'kalibot') {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    const sessionId = 'session-' + Date.now();
    const token = Buffer.from(`${sessionId}:${AUTH_SECRET}`).toString('base64');
    sessions.set(sessionId, { createdAt: Date.now() });
    res.json({ token, sessionId });
  });

  const orchestrator = new MockOrchestrator();
  let GeminiProviderClass = MockGeminiProvider;

  if (withGeminiProvider) {
    orchestrator.registerProvider('gemini', new MockGeminiProvider('initial-key'));
  }

  app.get('/api/gemini/config', authenticate, (req, res) => {
    const geminiProvider = orchestrator.getProvider('gemini');
    const configured = !!geminiProvider;
    const model = geminiProvider ? geminiProvider.model : null;
    const apiKeySet = configured ? !!geminiProvider.apiKey : false;

    res.json({ success: true, configured, apiKeySet, model: model || null });
  });

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
      if (!apiKey) {
        return res
          .status(400)
          .json({ error: 'apiKey is required to initialise the Gemini provider' });
      }
      geminiProvider = new GeminiProviderClass(apiKey.trim());
      orchestrator.registerProvider('gemini', geminiProvider);
    } else {
      if (apiKey) {
        geminiProvider.setApiKey(apiKey.trim());
      }
    }

    if (model) {
      geminiProvider.setModel(model.trim());
    }

    res.json({
      success: true,
      configured: true,
      apiKeySet: !!geminiProvider.apiKey,
      model: geminiProvider.model,
    });
  });

  return app;
}

describe('Gemini Settings API', () => {
  let app;
  let appNoProvider;
  let token;
  let tokenNoProvider;

  beforeAll(async () => {
    app = createTestApp({ withGeminiProvider: true });
    appNoProvider = createTestApp({ withGeminiProvider: false });

    const res = await request(app).post('/api/auth/login').send({ password: 'kalibot' });
    token = res.body.token;

    const res2 = await request(appNoProvider).post('/api/auth/login').send({ password: 'kalibot' });
    tokenNoProvider = res2.body.token;
  });

  describe('GET /api/gemini/config', () => {
    test('returns config when Gemini provider is registered', async () => {
      const res = await request(app)
        .get('/api/gemini/config')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.configured).toBe(true);
      expect(res.body.apiKeySet).toBe(true);
      expect(res.body.model).toBe('gemini-pro');
    });

    test('returns unconfigured state when no provider is registered', async () => {
      const res = await request(appNoProvider)
        .get('/api/gemini/config')
        .set('Authorization', `Bearer ${tokenNoProvider}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.configured).toBe(false);
      expect(res.body.apiKeySet).toBe(false);
      expect(res.body.model).toBeNull();
    });

    test('rejects unauthenticated request', async () => {
      const res = await request(app).get('/api/gemini/config');
      expect(res.status).toBe(401);
    });
  });

  describe('POST /api/gemini/config', () => {
    test('updates API key on existing provider', async () => {
      const res = await request(app)
        .post('/api/gemini/config')
        .set('Authorization', `Bearer ${token}`)
        .send({ apiKey: 'new-api-key-123' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.configured).toBe(true);
      expect(res.body.apiKeySet).toBe(true);
    });

    test('updates model on existing provider', async () => {
      const res = await request(app)
        .post('/api/gemini/config')
        .set('Authorization', `Bearer ${token}`)
        .send({ model: 'gemini-1.5-pro' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.model).toBe('gemini-1.5-pro');
    });

    test('updates both apiKey and model together', async () => {
      const res = await request(app)
        .post('/api/gemini/config')
        .set('Authorization', `Bearer ${token}`)
        .send({ apiKey: 'combo-key', model: 'gemini-1.5-flash' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.model).toBe('gemini-1.5-flash');
      expect(res.body.apiKeySet).toBe(true);
    });

    test('creates provider when none exists and apiKey is supplied', async () => {
      const res = await request(appNoProvider)
        .post('/api/gemini/config')
        .set('Authorization', `Bearer ${tokenNoProvider}`)
        .send({ apiKey: 'brand-new-key' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.configured).toBe(true);
      expect(res.body.apiKeySet).toBe(true);
    });

    test('returns 400 when no apiKey supplied and provider does not exist', async () => {
      const freshApp = createTestApp({ withGeminiProvider: false });
      const loginRes = await request(freshApp)
        .post('/api/auth/login')
        .send({ password: 'kalibot' });
      const freshToken = loginRes.body.token;

      const res = await request(freshApp)
        .post('/api/gemini/config')
        .set('Authorization', `Bearer ${freshToken}`)
        .send({ model: 'gemini-1.5-pro' });

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/apiKey is required/);
    });

    test('returns 400 when body is empty', async () => {
      const res = await request(app)
        .post('/api/gemini/config')
        .set('Authorization', `Bearer ${token}`)
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.error).toBeDefined();
    });

    test('returns 400 for empty-string apiKey', async () => {
      const res = await request(app)
        .post('/api/gemini/config')
        .set('Authorization', `Bearer ${token}`)
        .send({ apiKey: '   ' });

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/apiKey must be a non-empty string/);
    });

    test('returns 400 for empty-string model', async () => {
      const res = await request(app)
        .post('/api/gemini/config')
        .set('Authorization', `Bearer ${token}`)
        .send({ model: '' });

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/model must be a non-empty string/);
    });

    test('rejects unauthenticated request', async () => {
      const res = await request(app).post('/api/gemini/config').send({ apiKey: 'test-key' });

      expect(res.status).toBe(401);
    });
  });
});
