/**
 * Database Persistence Tests
 */

const db = require('../../db/init');
const path = require('path');
const fs = require('fs');

// Use a test database
const testDbPath = path.join(__dirname, '../../data/test-kalibot.db');

describe('Database Persistence', () => {
  let testDb;

  beforeAll(() => {
    process.env.DB_PATH = testDbPath;
    testDb = db.initializeDatabase();
  });

  afterAll(() => {
    db.closeDatabase();
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }
  });

  describe('Session Management', () => {
    let sessionId, token, authSecret;

    beforeEach(() => {
      sessionId = 'test-session-' + Date.now();
      token = 'test-token-' + Date.now();
      authSecret = 'test-secret';
    });

    test('create and retrieve session', () => {
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
      db.createSession(sessionId, token, authSecret, expiresAt);

      const session = db.getSession(sessionId);
      expect(session).toBeTruthy();
      expect(session.id).toBe(sessionId);
      expect(session.auth_secret).toBe(authSecret);
    });

    test('expired session not returned', () => {
      const expiredSessionId = 'expired-' + Date.now();
      const expiredExpiresAt = new Date(Date.now() - 1000).toISOString();
      db.createSession(expiredSessionId, 'token', authSecret, expiredExpiresAt);

      const session = db.getSession(expiredSessionId);
      expect(session).toBeFalsy();
    });

    test('update session activity', () => {
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
      db.createSession(sessionId, token, authSecret, expiresAt);

      const beforeActivity = new Date().toISOString();
      db.updateSessionActivity(sessionId);
      const afterActivity = new Date().toISOString();

      const session = db.getSession(sessionId);
      const activity = new Date(session.last_activity);
      expect(activity.getTime()).toBeGreaterThanOrEqual(new Date(beforeActivity).getTime());
      expect(activity.getTime()).toBeLessThanOrEqual(new Date(afterActivity).getTime());
    });

    test('update and retrieve session notes', () => {
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
      db.createSession(sessionId, token, authSecret, expiresAt);

      const notes = 'Test notes for this session';
      db.updateSessionNotes(sessionId, notes);

      const retrievedNotes = db.getSessionNotes(sessionId);
      expect(retrievedNotes).toBe(notes);
    });
  });

  describe('Command History', () => {
    let sessionId;

    beforeAll(() => {
      sessionId = 'cmd-test-' + Date.now();
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
      db.createSession(sessionId, 'token-' + sessionId, 'secret', expiresAt);
    });

    test('add and retrieve commands', () => {
      db.addCommand(sessionId, 'nmap -sV localhost', 45, 'Starting Nmap...', '', true);
      db.addCommand(sessionId, 'sqlmap -u http://test.com', 30, 'SQL Injection found', '', true);

      const history = db.getCommandHistory(sessionId);
      expect(history.length).toBe(2);
      expect(history[0].command).toMatch(/nmap|sqlmap/);
    });

    test('command history ordered by timestamp', () => {
      db.addCommand(sessionId, 'command1', 10, 'output', '', true);
      db.addCommand(sessionId, 'command2', 20, 'output', '', true);

      const history = db.getCommandHistory(sessionId);
      expect(history[0].command).toBe('command2'); // Most recent first
      expect(history[1].command).toBe('command1');
    });

    test('retrieve full command output', () => {
      const result = db.addCommand(sessionId, 'test-cmd', 5, 'Full output content', 'Error output', true);
      const commandId = result.lastInsertRowid;

      const output = db.getFullCommandOutput(commandId);
      expect(output.output).toBe('Full output content');
      expect(output.error_output).toBe('Error output');
    });
  });

  describe('Findings Management', () => {
    let sessionId;

    beforeAll(() => {
      sessionId = 'finding-test-' + Date.now();
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
      db.createSession(sessionId, 'token-' + sessionId, 'secret', expiresAt);
    });

    test('add and retrieve findings', () => {
      db.addFinding(sessionId, 'CRITICAL', 'SQL Injection found', 'sqlmap query', 'raw data');
      db.addFinding(sessionId, 'HIGH', 'Weak credentials', 'hydra query', 'raw data');
      db.addFinding(sessionId, 'MEDIUM', 'Outdated software', 'nmap query', 'raw data');

      const findings = db.getFindings(sessionId);
      expect(findings.length).toBe(3);
    });

    test('filter findings by severity', () => {
      const criticalFindings = db.getFindings(sessionId, 'CRITICAL');
      expect(criticalFindings.length).toBe(1);
      expect(criticalFindings[0].severity).toBe('CRITICAL');
    });

    test('add CVE to finding', () => {
      const result = db.addFinding(sessionId, 'HIGH', 'Test finding', 'query', 'raw');
      const findingId = result.lastInsertRowid;

      db.addCVEToFinding(findingId, 'CVE-2024-0001');
      db.addCVEToFinding(findingId, 'CVE-2024-0002');

      const findings = db.getFindingsWithCVEs(sessionId);
      const testFinding = findings.find(f => f.id === findingId);
      expect(testFinding.cves).toContain('CVE-2024-0001');
      expect(testFinding.cves).toContain('CVE-2024-0002');
    });

    test('get severity counts', () => {
      const counts = db.getSeverityCounts(sessionId);
      expect(counts.CRITICAL).toBeGreaterThan(0);
      expect(counts.HIGH).toBeGreaterThan(0);
      expect(counts.MEDIUM).toBeGreaterThan(0);
      expect(counts.LOW).toBe(0);
      expect(counts.INFO).toBe(0);
    });
  });

  describe('CVE Cache', () => {
    test('cache and retrieve CVE', () => {
      db.cacheCVE('CVE-2024-1234', 9.8, 'CRITICAL', 'Test CVE', 30);

      const cached = db.getCVEFromCache('CVE-2024-1234');
      expect(cached).toBeTruthy();
      expect(cached.cvss_score).toBe(9.8);
      expect(cached.severity).toBe('CRITICAL');
    });

    test('expired CVE cache not returned', () => {
      db.cacheCVE('CVE-2020-0001', 5.5, 'MEDIUM', 'Old CVE', -1); // -1 = expired yesterday
      const cached = db.getCVEFromCache('CVE-2020-0001');
      expect(cached).toBeFalsy();
    });
  });

  describe('IOC Management', () => {
    let sessionId;

    beforeAll(() => {
      sessionId = 'ioc-test-' + Date.now();
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
      db.createSession(sessionId, 'token-' + sessionId, 'secret', expiresAt);
    });

    test('add and retrieve IOCs', () => {
      db.addIOC(sessionId, 'IP', '192.168.1.100', null, 'Malware C2');
      db.addIOC(sessionId, 'DOMAIN', 'malware.com', null, 'Command & Control');
      db.addIOC(sessionId, 'EMAIL', 'attacker@evil.com', null, 'Phishing');
      db.addIOC(sessionId, 'HASH', 'abc123def456', null, 'Malware hash');

      const iocs = db.getIOCs(sessionId);
      expect(iocs.length).toBe(4);
    });

    test('filter IOCs by type', () => {
      const ipIOCs = db.getIOCs(sessionId, 'IP');
      expect(ipIOCs.every(ioc => ioc.ioc_type === 'IP')).toBe(true);
    });
  });

  describe('Session Statistics', () => {
    let sessionId;

    beforeAll(() => {
      sessionId = 'stats-test-' + Date.now();
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
      db.createSession(sessionId, 'token-' + sessionId, 'secret', expiresAt);

      // Add some data
      db.addCommand(sessionId, 'test command', 10, 'output', '', true);
      db.addFinding(sessionId, 'HIGH', 'Test finding', 'query', 'raw');
    });

    test('get session statistics', () => {
      const stats = db.getSessionStats(sessionId);
      expect(stats.sessionId).toBe(sessionId);
      expect(stats.commandsExecuted).toBeGreaterThan(0);
      expect(stats.findingsDiscovered).toBeGreaterThan(0);
      expect(stats.severityBreakdown).toBeTruthy();
    });
  });

  describe('Data Export', () => {
    let sessionId;

    beforeAll(() => {
      sessionId = 'export-test-' + Date.now();
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
      db.createSession(sessionId, 'token-' + sessionId, 'secret', expiresAt);
      db.updateSessionNotes(sessionId, 'Test notes');

      db.addCommand(sessionId, 'nmap test', 15, 'Nmap output', '', true);
      db.addFinding(sessionId, 'CRITICAL', 'Critical issue', 'query', 'raw');
      db.addIOC(sessionId, 'IP', '10.0.0.1', null, 'Suspicious');
    });

    test('export session data', () => {
      const exported = db.exportSessionData(sessionId);

      expect(exported.session).toBeTruthy();
      expect(exported.session.notes).toBe('Test notes');
      expect(Array.isArray(exported.commands)).toBe(true);
      expect(exported.commands.length).toBeGreaterThan(0);
      expect(Array.isArray(exported.findings)).toBe(true);
      expect(exported.findings.length).toBeGreaterThan(0);
      expect(Array.isArray(exported.iocs)).toBe(true);
      expect(exported.iocs.length).toBeGreaterThan(0);
    });
  });

  describe('Health Check', () => {
    test('database health check', () => {
      const health = db.healthCheck();
      expect(health.status).toBe('ok');
      expect(health.location).toBeTruthy();
    });
  });
});
