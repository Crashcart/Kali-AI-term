const fs = require('fs');
const path = require('path');
const os = require('os');
const { getDockerSocketPath } = require('../../install');

describe('Installation helper: docker socket path', () => {
  afterEach(() => {
    delete process.env.DOCKER_SOCKET;
  });

  it('returns default socket path when DOCKER_SOCKET is not set', () => {
    expect(getDockerSocketPath()).toBe('/var/run/docker.sock');
  });

  it('respects DOCKER_SOCKET environment variable', () => {
    process.env.DOCKER_SOCKET = '/tmp/docker.sock';
    expect(getDockerSocketPath()).toBe('/tmp/docker.sock');
  });
});

// ── ShellCommander ────────────────────────────────────────────────────────────

const ShellCommander = require('../../lib/shell-commander');

describe('ShellCommander', () => {
  const IP = '10.10.10.10';
  const PORT = 4444;

  describe('payload generation', () => {
    test('bashReverse embeds IP, port and /dev/tcp', () => {
      const p = ShellCommander.bashReverse(IP, PORT);
      expect(p).toContain(IP);
      expect(p).toContain(String(PORT));
      expect(p).toContain('/dev/tcp');
    });

    test('pythonReverse contains import socket', () => {
      const p = ShellCommander.pythonReverse(IP, PORT);
      expect(p).toContain(IP);
      expect(p).toContain(String(PORT));
      expect(p).toContain('import socket');
    });

    test('python3Reverse starts with python3', () => {
      const p = ShellCommander.python3Reverse(IP, PORT);
      expect(p).toContain('python3');
      expect(p).toContain(IP);
      expect(p).toContain(String(PORT));
    });

    test('powershellReverse contains TcpClient', () => {
      const p = ShellCommander.powershellReverse(IP, PORT);
      expect(p).toContain('TcpClient');
      expect(p).toContain(IP);
      expect(p).toContain(String(PORT));
    });

    test('netcatReverse uses nc', () => {
      const p = ShellCommander.netcatReverse(IP, PORT);
      expect(p).toContain('nc');
      expect(p).toContain(IP);
      expect(p).toContain(String(PORT));
    });

    test('netcatBashReverse uses bash and /dev/tcp', () => {
      const p = ShellCommander.netcatBashReverse(IP, PORT);
      expect(p).toContain('/dev/tcp');
      expect(p).toContain(IP);
      expect(p).toContain(String(PORT));
    });

    test('perlReverse uses perl and Socket', () => {
      const p = ShellCommander.perlReverse(IP, PORT);
      expect(p).toContain('perl');
      expect(p).toContain('Socket');
      expect(p).toContain(IP);
      expect(p).toContain(String(PORT));
    });

    test('rubyReverse uses TCPSocket', () => {
      const p = ShellCommander.rubyReverse(IP, PORT);
      expect(p).toContain('ruby');
      expect(p).toContain('TCPSocket');
      expect(p).toContain(IP);
      expect(p).toContain(String(PORT));
    });

    test('javaReverse embeds IP and port', () => {
      const p = ShellCommander.javaReverse(IP, PORT);
      expect(p).toContain(IP);
      expect(p).toContain(String(PORT));
    });
  });

  describe('generateListener', () => {
    test('returns netcat, socat, bash, and python variants', () => {
      const l = ShellCommander.generateListener(4444);
      expect(l.netcat).toContain('4444');
      expect(l.socat).toContain('4444');
      expect(l.bash).toContain('4444');
      expect(l.python).toContain('4444');
    });
  });

  describe('generateAllPayloads', () => {
    test('returns all nine shell types', () => {
      const payloads = ShellCommander.generateAllPayloads('192.168.1.1', 1234);
      ['bash', 'python', 'python3', 'powershell', 'netcat', 'netcatBash', 'perl', 'ruby', 'java'].forEach(k => {
        expect(payloads).toHaveProperty(k);
      });
    });

    test('every payload contains the target IP', () => {
      const ip = '172.16.0.1';
      const payloads = ShellCommander.generateAllPayloads(ip, 9001);
      Object.values(payloads).forEach(p => expect(p).toContain(ip));
    });
  });

  describe('encoding helpers', () => {
    test('urlEncode encodes spaces and slashes', () => {
      const encoded = ShellCommander.urlEncode('bash -i >& /dev/tcp/');
      expect(encoded).not.toContain(' ');
      expect(encoded).not.toContain('/');
    });

    test('base64Encode produces decodable output', () => {
      const input = 'echo hello world';
      const encoded = ShellCommander.base64Encode(input);
      expect(Buffer.from(encoded, 'base64').toString('utf8')).toBe(input);
    });
  });

  describe('metasploitHandler', () => {
    test('contains LHOST, LPORT, and handler module', () => {
      const cmd = ShellCommander.metasploitHandler('192.168.1.1', 4444);
      expect(cmd).toContain('192.168.1.1');
      expect(cmd).toContain('4444');
      expect(cmd).toContain('exploit/multi/handler');
    });
  });

  describe('validateIp', () => {
    test.each([
      ['0.0.0.0', true],
      ['192.168.1.1', true],
      ['255.255.255.255', true],
      ['10.0.0.1', true],
      ['256.0.0.1', false],
      ['192.168.1.300', false],
      ['not-an-ip', false],
      ['localhost', false],
      ['', false],
      ['::1', false],
      ['192.168.1.0/24', false],
    ])('validateIp(%s) === %s', (ip, expected) => {
      expect(ShellCommander.validateIp(ip)).toBe(expected);
    });
  });

  describe('validatePort', () => {
    test.each([
      [1, true],
      [4444, true],
      [65535, true],
      [0, false],
      [65536, false],
      [99999, false],
      ['4444', true],
      ['0', false],
    ])('validatePort(%s) === %s', (port, expected) => {
      expect(ShellCommander.validatePort(port)).toBe(expected);
    });
  });

  describe('getPayloadInfo', () => {
    test('returns description and OS array for known shell type', () => {
      const info = ShellCommander.getPayloadInfo('bash');
      expect(info.type).toBe('bash');
      expect(typeof info.description).toBe('string');
      expect(info.description.length).toBeGreaterThan(0);
      expect(Array.isArray(info.os)).toBe(true);
    });

    test('returns "Unknown" description for unrecognised type', () => {
      const info = ShellCommander.getPayloadInfo('unknown-shell');
      expect(info.description).toMatch(/Unknown/i);
      expect(info.os).toEqual([]);
    });
  });

  describe('getPayloadsByCategory', () => {
    test('returns Unix/Linux and Windows categories', () => {
      const cats = ShellCommander.getPayloadsByCategory();
      expect(cats).toHaveProperty('Unix/Linux');
      expect(cats).toHaveProperty('Windows');
      expect(Array.isArray(cats['Unix/Linux'])).toBe(true);
      expect(cats['Windows']).toContain('powershell');
    });
  });
});

// ── InstallLogger ─────────────────────────────────────────────────────────────

const { InstallLogger, createLogger } = require('../../lib/install-logger');

describe('InstallLogger', () => {
  let tmpDir;
  let logger;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'logger-test-'));
    logger = new InstallLogger({ scriptName: 'test-install', logDir: tmpDir, verbose: false });
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  describe('construction', () => {
    test('creates a timestamped log file on construction', () => {
      const files = fs.readdirSync(tmpDir).filter(f => f.endsWith('.log'));
      expect(files.length).toBeGreaterThan(0);
    });

    test('log file name starts with the script name', () => {
      const files = fs.readdirSync(tmpDir).filter(f => f.endsWith('.log'));
      expect(files[0]).toMatch(/^test-install-/);
    });

    test('getLogPath() returns path to an existing file', () => {
      expect(fs.existsSync(logger.getLogPath())).toBe(true);
    });
  });

  describe('logging methods', () => {
    test('info() appends message to log file', () => {
      logger.info('info message here');
      const content = fs.readFileSync(logger.getLogPath(), 'utf8');
      expect(content).toContain('info message here');
    });

    test('error() pushes entry into the errors array', () => {
      logger.error('something broke');
      expect(logger.getErrors()).toHaveLength(1);
      expect(logger.getErrors()[0].message).toBe('something broke');
    });

    test('warn() does not push to errors array', () => {
      logger.warn('just a warning');
      expect(logger.getErrors()).toHaveLength(0);
    });

    test('hasErrors() returns false when no errors logged', () => {
      expect(logger.hasErrors()).toBe(false);
    });

    test('hasErrors() returns true after error()', () => {
      logger.error('oops');
      expect(logger.hasErrors()).toBe(true);
    });

    test('success() appends to log file', () => {
      logger.success('step done');
      const content = fs.readFileSync(logger.getLogPath(), 'utf8');
      expect(content).toContain('step done');
    });
  });

  describe('maskSensitiveValues', () => {
    test('masks ADMIN_PASSWORD value', () => {
      const result = logger.maskSensitiveValues('ADMIN_PASSWORD=supersecret123');
      expect(result).not.toContain('supersecret123');
      expect(result).toContain('***');
    });

    test('masks AUTH_SECRET value', () => {
      const result = logger.maskSensitiveValues('AUTH_SECRET=my-secret');
      expect(result).not.toContain('my-secret');
      expect(result).toContain('***');
    });

    test('masks JSON "token" field', () => {
      const result = logger.maskSensitiveValues('"token": "abc123xyz"');
      expect(result).not.toContain('abc123xyz');
    });

    test('returns non-string inputs unchanged', () => {
      expect(logger.maskSensitiveValues(42)).toBe(42);
      expect(logger.maskSensitiveValues(null)).toBe(null);
    });
  });

  describe('trackCommand', () => {
    test('increments commandsExecuted in summary', () => {
      logger.trackCommand('npm install', 0, 'added 10 packages', '');
      expect(logger.getSummary().commandsExecuted).toBe(1);
    });

    test('tracks failed commands too', () => {
      logger.trackCommand('npm install', 1, '', 'Error: module not found');
      expect(logger.getSummary().commandsExecuted).toBe(1);
    });

    test('multiple commands are all counted', () => {
      logger.trackCommand('cmd1', 0, '', '');
      logger.trackCommand('cmd2', 0, '', '');
      logger.trackCommand('cmd3', 1, '', 'err');
      expect(logger.getSummary().commandsExecuted).toBe(3);
    });
  });

  describe('trackContainer', () => {
    test('records container events and counts them in summary', () => {
      logger.trackContainer('kali-ai-term-app', 'started');
      logger.trackContainer('kali-ai-term-kali', 'running');
      expect(logger.getSummary().containerEvents).toBe(2);
    });
  });

  describe('trackSystemInfo', () => {
    test('stores platform and nodeVersion', () => {
      logger.trackSystemInfo();
      expect(logger.systemInfo.system).toBeDefined();
      expect(logger.systemInfo.system.platform).toBe(process.platform);
      expect(logger.systemInfo.system.nodeVersion).toBe(process.version);
    });
  });

  describe('trackEnvironment', () => {
    test('captures tracked env vars', () => {
      logger.trackEnvironment({ NODE_ENV: 'test', PORT: '3000' });
      expect(logger.systemInfo.environment).toBeDefined();
    });
  });

  describe('generateDiagnostic', () => {
    test('writes a .diagnostic JSON file to logDir', () => {
      logger.generateDiagnostic('success', 'complete');
      const diagPath = logger.getDiagnosticPath();
      expect(fs.existsSync(diagPath)).toBe(true);
      const content = JSON.parse(fs.readFileSync(diagPath, 'utf8'));
      expect(content.status).toBe('success');
      expect(content.script).toBe('test-install');
    });

    test('diagnostic includes command and container history', () => {
      logger.trackCommand('test-cmd', 0, 'ok', '');
      logger.trackContainer('test-container', 'started');
      const diag = logger.generateDiagnostic('success', 'complete');
      expect(diag.commands).toHaveLength(1);
      expect(diag.containers).toHaveLength(1);
    });

    test('diagnostic includes error count', () => {
      logger.error('boom');
      const diag = logger.generateDiagnostic('failed', 'install');
      expect(diag.errorCount).toBe(1);
    });
  });

  describe('getSummary', () => {
    test('returns script name, duration, and zero counts initially', () => {
      const summary = logger.getSummary();
      expect(summary.script).toBe('test-install');
      expect(typeof summary.duration).toBe('number');
      expect(summary.commandsExecuted).toBe(0);
      expect(summary.errorCount).toBe(0);
    });
  });

  describe('createLogger factory', () => {
    test('creates an InstallLogger instance with correct scriptName', () => {
      const l = createLogger('factory-test', { logDir: tmpDir, verbose: false });
      expect(l).toBeInstanceOf(InstallLogger);
      expect(l.scriptName).toBe('factory-test');
    });
  });
});
