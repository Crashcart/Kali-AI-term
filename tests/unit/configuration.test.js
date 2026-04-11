const fs = require('fs');
const path = require('path');
const os = require('os');

describe('Configuration wiring', () => {
  it('passes auth settings into the app container', () => {
    const composePath = path.join(__dirname, '..', '..', 'docker-compose.yml');
    const compose = fs.readFileSync(composePath, 'utf8');

    expect(compose).toContain('ADMIN_PASSWORD=${ADMIN_PASSWORD:-kalibot}');
    expect(compose).toContain('AUTH_SECRET=${AUTH_SECRET:-changeme-local-dev}');
  });

  it('loads .env before reading runtime configuration', () => {
    const serverPath = path.join(__dirname, '..', '..', 'server.js');
    const serverSource = fs.readFileSync(serverPath, 'utf8');

    expect(serverSource).toContain("require('dotenv').config();");
  });

  it('exposes login error report endpoint and report IDs', () => {
    const serverPath = path.join(__dirname, '..', '..', 'server.js');
    const serverSource = fs.readFileSync(serverPath, 'utf8');

    expect(serverSource).toContain("app.post('/api/auth/login/error-report'");
    expect(serverSource).toContain('reportId');
    expect(serverSource).toContain('createLoginErrorReport');
  });

  it('submits login failure diagnostics from the frontend', () => {
    const appPath = path.join(__dirname, '..', '..', 'public', 'app.js');
    const appSource = fs.readFileSync(appPath, 'utf8');

    expect(appSource).toContain('submitLoginErrorReport');
    expect(appSource).toContain('/api/auth/login/error-report');
    expect(appSource).toContain('Login error report captured');
  });
});

// ── DiagnosticAnalyzer ────────────────────────────────────────────────────────

const DiagnosticAnalyzer = require('../../lib/diagnostic-analyzer');

describe('DiagnosticAnalyzer', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'diag-test-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  function writeDiagnostic(data, filename = 'test.diagnostic') {
    const filePath = path.join(tmpDir, filename);
    fs.writeFileSync(filePath, JSON.stringify(data), 'utf8');
    return filePath;
  }

  function baseDiagnostic(overrides = {}) {
    return {
      script: 'install',
      status: 'success',
      stage: 'complete',
      duration: '10s',
      failureReason: '',
      errorCount: 0,
      errors: [],
      system: {},
      commands: [],
      containers: [],
      logFile: 'install.log',
      ...overrides,
    };
  }

  describe('constructor and loadDiagnostic()', () => {
    test('loads a valid diagnostic file', () => {
      const filePath = writeDiagnostic(baseDiagnostic());
      const analyzer = new DiagnosticAnalyzer(filePath);
      expect(analyzer.diagnostic).not.toBeNull();
      expect(analyzer.diagnostic.script).toBe('install');
    });

    test('sets diagnostic to null for a missing file', () => {
      const analyzer = new DiagnosticAnalyzer('/nonexistent/path.diagnostic');
      expect(analyzer.diagnostic).toBeNull();
    });

    test('sets diagnostic to null for malformed JSON', () => {
      const filePath = path.join(tmpDir, 'bad.diagnostic');
      fs.writeFileSync(filePath, '{ invalid json }', 'utf8');
      const analyzer = new DiagnosticAnalyzer(filePath);
      expect(analyzer.diagnostic).toBeNull();
    });
  });

  describe('analyze()', () => {
    test('returns an ERROR issue when diagnostic file is missing', () => {
      const analyzer = new DiagnosticAnalyzer('/nonexistent/path.diagnostic');
      const analysis = analyzer.analyze();
      expect(analysis.issues).toHaveLength(1);
      expect(analysis.issues[0].severity).toBe('ERROR');
    });

    test('clean diagnostic produces no issues or warnings', () => {
      const filePath = writeDiagnostic(baseDiagnostic({
        containers: [{ container: 'app', action: 'started' }],
        system: { environment: { NODE_ENV: 'test' }, system: { nodeVersion: 'v20.0.0' } }
      }));
      const analyzer = new DiagnosticAnalyzer(filePath);
      const analysis = analyzer.analyze();
      expect(analysis.issues).toHaveLength(0);
      expect(analysis.warnings).toHaveLength(0);
      expect(analysis.suggestions.length).toBeGreaterThan(0);
    });

    test('npm error in errors array produces npm issue', () => {
      const filePath = writeDiagnostic(baseDiagnostic({
        errors: [{ message: 'npm ERR! ERESOLVE unable to resolve dependency' }],
        errorCount: 1,
      }));
      const analyzer = new DiagnosticAnalyzer(filePath);
      const analysis = analyzer.analyze();
      const npmIssue = analysis.issues.find(i => i.category === 'npm');
      expect(npmIssue).toBeDefined();
      expect(npmIssue.severity).toBe('ERROR');
    });

    test('docker socket error produces docker issue', () => {
      const filePath = writeDiagnostic(baseDiagnostic({
        errors: [{ message: 'docker.sock connection refused' }],
        errorCount: 1,
      }));
      const analyzer = new DiagnosticAnalyzer(filePath);
      const analysis = analyzer.analyze();
      const dockerIssue = analysis.issues.find(i => i.category === 'docker');
      expect(dockerIssue).toBeDefined();
      expect(dockerIssue.suggestion).toContain('systemctl');
    });

    test('docker permission error produces docker permission issue', () => {
      const filePath = writeDiagnostic(baseDiagnostic({
        errors: [{ message: 'docker permission denied' }],
        errorCount: 1,
      }));
      const analyzer = new DiagnosticAnalyzer(filePath);
      const analysis = analyzer.analyze();
      const dockerIssue = analysis.issues.find(i => i.category === 'docker');
      expect(dockerIssue).toBeDefined();
      expect(dockerIssue.suggestion).toContain('usermod');
    });

    test('network error in errors array produces network issue', () => {
      const filePath = writeDiagnostic(baseDiagnostic({
        errors: [{ message: 'ECONNREFUSED to remote server' }],
        errorCount: 1,
      }));
      const analyzer = new DiagnosticAnalyzer(filePath);
      const analysis = analyzer.analyze();
      expect(analysis.issues.find(i => i.category === 'network')).toBeDefined();
    });

    test('failed docker command produces a warning', () => {
      const filePath = writeDiagnostic(baseDiagnostic({
        commands: [{ command: 'docker ps', exitCode: 1, stderr: 'Cannot connect' }],
        containers: [{ container: 'app', action: 'started' }],
      }));
      const analyzer = new DiagnosticAnalyzer(filePath);
      const analysis = analyzer.analyze();
      expect(analysis.warnings.length).toBeGreaterThan(0);
    });

    test('npm ERESOLVE in command stderr adds legacy-peer-deps suggestion', () => {
      const filePath = writeDiagnostic(baseDiagnostic({
        commands: [{ command: 'npm install', exitCode: 1, stderr: 'ERESOLVE conflict' }],
        containers: [{ container: 'app', action: 'started' }],
      }));
      const analyzer = new DiagnosticAnalyzer(filePath);
      const analysis = analyzer.analyze();
      const suggestion = analysis.suggestions.find(s => s.command && s.command.includes('legacy-peer-deps'));
      expect(suggestion).toBeDefined();
    });

    test('no container events produces a warning', () => {
      const filePath = writeDiagnostic(baseDiagnostic({ containers: [] }));
      const analyzer = new DiagnosticAnalyzer(filePath);
      const analysis = analyzer.analyze();
      expect(analysis.warnings.some(w => w.message.includes('No container events'))).toBe(true);
    });

    test('container without started/running action produces an issue', () => {
      const filePath = writeDiagnostic(baseDiagnostic({
        containers: [{ container: 'kali', action: 'creating' }],
      }));
      const analyzer = new DiagnosticAnalyzer(filePath);
      const analysis = analyzer.analyze();
      expect(analysis.issues.find(i => i.category === 'container')).toBeDefined();
    });

    test('Node.js version below v18 produces a nodejs issue', () => {
      const filePath = writeDiagnostic(baseDiagnostic({
        system: { system: { nodeVersion: 'v16.0.0' } },
        containers: [{ container: 'app', action: 'started' }],
      }));
      const analyzer = new DiagnosticAnalyzer(filePath);
      const analysis = analyzer.analyze();
      expect(analysis.issues.find(i => i.category === 'nodejs')).toBeDefined();
    });

    test('Node.js v18+ does not produce a nodejs issue', () => {
      const filePath = writeDiagnostic(baseDiagnostic({
        system: { system: { nodeVersion: 'v20.11.0' } },
        containers: [{ container: 'app', action: 'started' }],
      }));
      const analyzer = new DiagnosticAnalyzer(filePath);
      const analysis = analyzer.analyze();
      expect(analysis.issues.find(i => i.category === 'nodejs')).toBeUndefined();
    });

    test('missing environment in system produces a warning', () => {
      const filePath = writeDiagnostic(baseDiagnostic({
        system: { system: { nodeVersion: 'v20.0.0' } },
        containers: [{ container: 'app', action: 'started' }],
      }));
      const analyzer = new DiagnosticAnalyzer(filePath);
      const analysis = analyzer.analyze();
      expect(analysis.warnings.some(w => w.message.includes('environment variables'))).toBe(true);
    });
  });

  describe('getSummary()', () => {
    test('returns script, status, and zero counts for clean diagnostic', () => {
      const filePath = writeDiagnostic(baseDiagnostic({
        containers: [{ container: 'app', action: 'started' }],
        system: { environment: {}, system: { nodeVersion: 'v20.0.0' } },
      }));
      const analyzer = new DiagnosticAnalyzer(filePath);
      analyzer.analyze();
      const summary = analyzer.getSummary();
      expect(summary.script).toBe('install');
      expect(summary.status).toBe('success');
      expect(summary.errors).toBe(0);
    });

    test('returns "unknown" for missing diagnostic', () => {
      const analyzer = new DiagnosticAnalyzer('/nonexistent/path.diagnostic');
      analyzer.analyze();
      const summary = analyzer.getSummary();
      expect(summary.script).toBe('unknown');
      expect(summary.status).toBe('unknown');
    });
  });

  describe('formatForDisplay()', () => {
    test('returns a non-empty string containing the script name', () => {
      const filePath = writeDiagnostic(baseDiagnostic({
        containers: [{ container: 'app', action: 'started' }],
      }));
      const analyzer = new DiagnosticAnalyzer(filePath);
      analyzer.analyze();
      const output = analyzer.formatForDisplay();
      expect(typeof output).toBe('string');
      expect(output.length).toBeGreaterThan(0);
      expect(output).toContain('install');
    });

    test('shows ERRORS section when issues exist', () => {
      const filePath = writeDiagnostic(baseDiagnostic({
        errors: [{ message: 'npm ERR!' }],
        errorCount: 1,
        containers: [{ container: 'app', action: 'started' }],
      }));
      const analyzer = new DiagnosticAnalyzer(filePath);
      analyzer.analyze();
      expect(analyzer.formatForDisplay()).toContain('ERRORS');
    });
  });

  describe('getAnalysis()', () => {
    test('returns the full analysis object with issues, warnings, suggestions', () => {
      const filePath = writeDiagnostic(baseDiagnostic());
      const analyzer = new DiagnosticAnalyzer(filePath);
      analyzer.analyze();
      const analysis = analyzer.getAnalysis();
      expect(analysis).toHaveProperty('issues');
      expect(analysis).toHaveProperty('warnings');
      expect(analysis).toHaveProperty('suggestions');
    });
  });
});
