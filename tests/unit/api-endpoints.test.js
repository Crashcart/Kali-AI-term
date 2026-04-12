/**
 * Plugin API Endpoints Tests
 */

const request = require('supertest');
const express = require('express');

// Mock a simple version of the app with plugin endpoints
function createMockApp() {
  const app = express();
  app.use(express.json());

  const sessions = new Map();
  const AUTH_SECRET = 'test-secret';

  // Mock authentication middleware
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
      const session = sessions.get(sessionId);

      if (!session || secret !== AUTH_SECRET) {
        return res.status(401).json({ error: 'Invalid token' });
      }

      req.sessionId = sessionId;
      next();
    } catch (e) {
      res.status(401).json({ error: 'Invalid token' });
    }
  };

  // Mock PluginManager
  class PluginManager {
    constructor() {
      this.plugins = new Map();
      this.initializeDefaultPlugins();
    }

    initializeDefaultPlugins() {
      const defaultPlugins = [
        { name: 'cve-plugin', enabled: true, version: '1.0', description: 'CVE lookup' },
        { name: 'threat-intel-plugin', enabled: true, version: '1.0', description: 'Threat intel' },
      ];

      defaultPlugins.forEach((plugin) => {
        this.plugins.set(plugin.name, plugin);
      });
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

    getPlugins() {
      return Array.from(this.plugins.values());
    }
  }

  const pluginManager = new PluginManager();

  // Authentication endpoint
  app.post('/api/auth/login', (req, res) => {
    const { password } = req.body;
    const expectedPassword = 'kalibot';

    if (password !== expectedPassword) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const sessionId = 'test-session-' + Date.now();
    const token = Buffer.from(`${sessionId}:${AUTH_SECRET}`).toString('base64');

    sessions.set(sessionId, { createdAt: Date.now() });

    res.json({ token, sessionId });
  });

  // Plugin endpoints
  app.get('/api/plugins', authenticate, (req, res) => {
    const plugins = pluginManager.getPlugins();
    res.json({
      success: true,
      plugins: plugins.map((p) => ({
        name: p.name,
        version: p.version,
        description: p.description,
        enabled: p.enabled,
      })),
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
          description: plugin.description,
        },
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
          description: plugin.description,
        },
      });
    } else {
      res.status(404).json({ error: `Plugin ${name} not found` });
    }
  });

  return app;
}

describe('Plugin API Endpoints', () => {
  let app;
  let token;
  let sessionId;

  beforeAll(async () => {
    app = createMockApp();

    const res = await request(app).post('/api/auth/login').send({ password: 'kalibot' });

    token = res.body.token;
    sessionId = res.body.sessionId;
  });

  test('GET /api/plugins returns plugin list', async () => {
    const res = await request(app).get('/api/plugins').set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.plugins)).toBe(true);
    expect(res.body.plugins.length).toBeGreaterThan(0);
    expect(res.body.plugins[0]).toHaveProperty('name');
    expect(res.body.plugins[0]).toHaveProperty('enabled');
  });

  test('POST /api/plugins/enable/:name enables plugin', async () => {
    const res = await request(app)
      .post('/api/plugins/enable/cve-plugin')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.name).toBe('cve-plugin');
    expect(res.body.enabled).toBe(true);
  });

  test('POST /api/plugins/disable/:name disables plugin', async () => {
    const res = await request(app)
      .post('/api/plugins/disable/threat-intel-plugin')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.enabled).toBe(false);
  });

  test('enable non-existent plugin returns 404', async () => {
    const res = await request(app)
      .post('/api/plugins/enable/nonexistent-plugin')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(404);
    expect(res.body.error).toBeDefined();
  });

  test('unauthenticated GET /api/plugins blocked', async () => {
    const res = await request(app).get('/api/plugins');

    expect(res.status).toBe(401);
    expect(res.body.error).toBeDefined();
  });

  test('unauthenticated POST /api/plugins/enable blocked', async () => {
    const res = await request(app).post('/api/plugins/enable/cve-plugin');

    expect(res.status).toBe(401);
    expect(res.body.error).toBeDefined();
  });

  test('invalid token rejected', async () => {
    const res = await request(app).get('/api/plugins').set('Authorization', 'Bearer invalid-token');

    expect(res.status).toBe(401);
    expect(res.body.error).toBeDefined();
  });

  test('login with wrong password fails', async () => {
    const res = await request(app).post('/api/auth/login').send({ password: 'wrongpassword' });

    expect(res.status).toBe(401);
    expect(res.body.error).toBeDefined();
  });

  test('successful login returns token and sessionId', async () => {
    const res = await request(app).post('/api/auth/login').send({ password: 'kalibot' });

    expect(res.status).toBe(200);
    expect(res.body.token).toBeDefined();
    expect(res.body.sessionId).toBeDefined();
  });
});
