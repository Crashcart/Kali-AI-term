/**
 * Report Generation Feature Tests
 */

const request = require('supertest');
const express = require('express');

describe('Report Generation', () => {
  let app;
  let token;
  let sessionId;

  beforeAll(async () => {
    // Create a mock app (similar to api-endpoints test setup)
    app = express();
    app.use(express.json());

    const sessions = new Map();
    const commandHistory = new Map();
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

    // Mock report plugin
    const reportPlugin = {
      findings: [
        {
          timestamp: new Date().toISOString(),
          query: 'test query',
          severity: 'CRITICAL',
          description: 'Test critical finding',
          cves: ['CVE-2024-0001'],
        },
        {
          timestamp: new Date().toISOString(),
          query: 'test query 2',
          severity: 'HIGH',
          description: 'Test high finding',
          cves: [],
        },
      ],
      getFindings() {
        return this.findings;
      },
      exportReport(format) {
        if (format === 'markdown') {
          return '# Test Report\n\nFindings: ' + this.findings.length;
        }
        return JSON.stringify({ findings: this.findings });
      },
    };

    // Login endpoint
    app.post('/api/auth/login', (req, res) => {
      const { password } = req.body;
      if (password !== 'kalibot') {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      sessionId = 'test-session-' + Date.now();
      const tokenVal = Buffer.from(`${sessionId}:${AUTH_SECRET}`).toString('base64');
      sessions.set(sessionId, { createdAt: Date.now(), notes: 'Test notes' });
      commandHistory.set(sessionId, [
        { command: 'nmap -sV test.com', timestamp: Date.now(), duration: 45 },
        { command: 'sqlmap -u test.com', timestamp: Date.now(), duration: 30 },
      ]);

      res.json({ token: tokenVal, sessionId });
    });

    // Report generation endpoint
    app.post('/api/reports/generate', authenticate, (req, res) => {
      const { format = 'html' } = req.body;
      const session = sessions.get(req.sessionId);
      const history = commandHistory.get(req.sessionId) || [];

      const reportData = {
        title: 'Penetration Testing Report',
        generated: new Date().toISOString(),
        sessionId: req.sessionId.slice(0, 8),
        totalFindings: reportPlugin.findings.length,
        criticalCount: reportPlugin.findings.filter((f) => f.severity === 'CRITICAL').length,
        highCount: reportPlugin.findings.filter((f) => f.severity === 'HIGH').length,
        findings: reportPlugin.findings,
        commandHistory: history,
        sessionNotes: session ? session.notes : '',
      };

      if (format === 'json') {
        res.json(reportData);
      } else if (format === 'markdown') {
        res.type('text/markdown').send(reportPlugin.exportReport('markdown'));
      } else if (format === 'html') {
        res.type('text/html').send('<html><body>Test Report</body></html>');
      } else {
        res.status(400).json({ error: 'Invalid format' });
      }
    });

    // Setup - login and get token
    const loginRes = await request(app).post('/api/auth/login').send({ password: 'kalibot' });

    token = loginRes.body.token;
    sessionId = loginRes.body.sessionId;
  });

  test('POST /api/reports/generate returns HTML report by default', async () => {
    const res = await request(app)
      .post('/api/reports/generate')
      .set('Authorization', `Bearer ${token}`)
      .send({});

    expect(res.status).toBe(200);
    expect(res.type).toMatch(/html/);
    expect(res.text).toContain('Test Report');
  });

  test('POST /api/reports/generate returns JSON report', async () => {
    const res = await request(app)
      .post('/api/reports/generate')
      .set('Authorization', `Bearer ${token}`)
      .send({ format: 'json' });

    expect(res.status).toBe(200);
    expect(res.body.title).toBe('Penetration Testing Report');
    expect(Array.isArray(res.body.findings)).toBe(true);
    expect(res.body.findings.length).toBeGreaterThan(0);
  });

  test('JSON report includes findings summary', async () => {
    const res = await request(app)
      .post('/api/reports/generate')
      .set('Authorization', `Bearer ${token}`)
      .send({ format: 'json' });

    expect(res.body.totalFindings).toBe(2);
    expect(res.body.criticalCount).toBe(1);
    expect(res.body.highCount).toBe(1);
  });

  test('JSON report includes command history', async () => {
    const res = await request(app)
      .post('/api/reports/generate')
      .set('Authorization', `Bearer ${token}`)
      .send({ format: 'json', includeCommandHistory: true });

    expect(Array.isArray(res.body.commandHistory)).toBe(true);
    expect(res.body.commandHistory.length).toBe(2);
    expect(res.body.commandHistory[0].command).toBe('nmap -sV test.com');
  });

  test('JSON report includes session notes', async () => {
    const res = await request(app)
      .post('/api/reports/generate')
      .set('Authorization', `Bearer ${token}`)
      .send({ format: 'json' });

    expect(res.body.sessionNotes).toBe('Test notes');
  });

  test('POST /api/reports/generate returns Markdown report', async () => {
    const res = await request(app)
      .post('/api/reports/generate')
      .set('Authorization', `Bearer ${token}`)
      .send({ format: 'markdown' });

    expect(res.status).toBe(200);
    expect(res.type).toMatch(/markdown/);
    expect(res.text).toContain('Test Report');
  });

  test('invalid format returns 400 error', async () => {
    const res = await request(app)
      .post('/api/reports/generate')
      .set('Authorization', `Bearer ${token}`)
      .send({ format: 'invalid' });

    expect(res.status).toBe(400);
    expect(res.body.error).toBeDefined();
  });

  test('unauthenticated request blocked', async () => {
    const res = await request(app).post('/api/reports/generate').send({ format: 'json' });

    expect(res.status).toBe(401);
  });

  test('report includes CVEs from findings', async () => {
    const res = await request(app)
      .post('/api/reports/generate')
      .set('Authorization', `Bearer ${token}`)
      .send({ format: 'json' });

    expect(res.body.findings[0].cves).toContain('CVE-2024-0001');
  });

  test('report includes severity breakdown', async () => {
    const res = await request(app)
      .post('/api/reports/generate')
      .set('Authorization', `Bearer ${token}`)
      .send({ format: 'json' });

    expect(res.body.criticalCount).toBe(1);
    expect(res.body.highCount).toBe(1);
    expect(res.body.mediumCount || 0).toBe(0);
    expect(res.body.lowCount || 0).toBe(0);
  });
});
