#!/usr/bin/env node

/**
 * Kali Hacker Bot - Full Installation Script with Advanced Diagnostics
 * Comprehensive checks, detailed logging, and system analysis
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const { execSync } = require('child_process');
const { createLogger } = require('./lib/install-logger');

const logger = createLogger('install-full', {
  logDir: process.cwd(),
  verbose: true,
  maskSensitive: true
});

const REQUIRED_CONTAINERS = ['kali-ai-term-app', 'kali-ai-term-kali'];

function getContainerStates() {
  const psOutput = execSync('docker ps -a --format "{{.Names}}\t{{.State}}\t{{.Status}}"', {
    encoding: 'utf8',
    shell: true
  });

  const containerStates = new Map();
  psOutput
    .trim()
    .split('\n')
    .filter(Boolean)
    .forEach((line) => {
      const [name, state, status] = line.split('\t');
      if (name) {
        containerStates.set(name, {
          state: state || 'unknown',
          status: status || ''
        });
      }
    });

  return containerStates;
}

function verifyRequiredContainersRunning() {
  const containerStates = getContainerStates();
  const failures = [];

  REQUIRED_CONTAINERS.forEach((name) => {
    const info = containerStates.get(name);
    if (!info) {
      failures.push(`${name}: not found`);
      return;
    }

    if (info.state !== 'running') {
      failures.push(`${name}: state=${info.state} status=${info.status}`);
      return;
    }

    logger.trackContainer(name, 'running', { status: info.status, state: info.state });
  });

  if (failures.length > 0) {
    throw new Error(`Required containers are not running: ${failures.join('; ')}`);
  }

  logger.success('Required containers verified as running');
}

// ============================================
// DETAILED PREREQUISITE CHECKING
// ============================================

async function detailedPrerequisiteCheck() {
  logger.info('Running detailed prerequisite checks...\n');

  const checks = {
    docker: {
      command: 'docker --version',
      description: 'Docker container runtime',
      critical: true
    },
    docker_compose: {
      command: 'docker-compose --version || docker compose version',
      description: 'Docker Compose orchestration',
      critical: true
    },
    node: {
      command: 'node --version',
      description: 'Node.js runtime',
      critical: true
    },
    npm: {
      command: 'npm --version',
      description: 'Node Package Manager',
      critical: true
    },
    git: {
      command: 'git --version',
      description: 'Git version control',
      critical: false
    },
    curl: {
      command: 'curl --version | head -1',
      description: 'cURL HTTP client',
      critical: false
    }
  };

  const results = {};

  for (const [name, check] of Object.entries(checks)) {
    try {
      const output = execSync(check.command, {
        encoding: 'utf8',
        shell: true,
        stdio: ['pipe', 'pipe', 'ignore']
      }).trim();

      results[name] = { found: true, version: output };
      const severity = check.critical ? 'SUCCESS' : 'DEBUG';
      logger[severity === 'SUCCESS' ? 'success' : 'debug'](
        `${check.description}: ${output.split('\n')[0]}`
      );
    } catch (err) {
      results[name] = { found: false };
      const severity = check.critical ? 'ERROR' : 'WARN';
      logger[severity === 'ERROR' ? 'error' : 'warn'](
        `${check.description} not found`,
        { required: check.critical }
      );
    }
  }

  // Check for critical failures
  const criticalMissing = Object.entries(checks)
    .filter(([name, check]) => check.critical && !results[name].found)
    .map(([name]) => name);

  if (criticalMissing.length > 0) {
    logger.error(`Missing critical tools: ${criticalMissing.join(', ')}`);
    return false;
  }

  logger.info('All critical prerequisites available\n');
  return true;
}

// ============================================
// SYSTEM INFORMATION GATHERING
// ============================================

async function gatherSystemInfo() {
  logger.info('Gathering system information...');

  const systemInfo = {
    platform: process.platform,
    arch: process.arch,
    nodeVersion: process.version,
    memory: {
      total: Math.round(os.totalmem() / 1024 / 1024 / 1024) + 'GB',
      free: Math.round(os.freemem() / 1024 / 1024 / 1024) + 'GB'
    },
    cpus: os.cpus().length,
    uptime: Math.round(os.uptime() / 3600) + 'h'
  };

  logger.debug('System info', systemInfo);
  logger.info(`Platform: ${systemInfo.platform} (${systemInfo.arch})`);
  logger.info(`Memory: ${systemInfo.memory.total} total, ${systemInfo.memory.free} free`);
  logger.info(`CPUs: ${systemInfo.cpus}, Uptime: ${systemInfo.uptime}`);

  // Check disk space
  try {
    const diskOutput = execSync('df -h . | tail -1', { encoding: 'utf8', shell: true }).trim();
    const parts = diskOutput.split(/\s+/);
    if (parts.length >= 4) {
      logger.info(`Disk: ${parts[1]} total, ${parts[3]} available`);
    }
  } catch (err) {
    logger.debug('Could not determine disk space');
  }

  logger.trackSystemInfo();
}

// ============================================
// DOCKER SYSTEM ANALYSIS
// ============================================

async function analyzeDockerSystem() {
  logger.info('Analyzing Docker system...');

  try {
    // Docker info
    const dockerInfo = execSync('docker info --format "{{.Containers}} containers, {{.Images}} images"',
      { encoding: 'utf8' }).trim();
    logger.info(`Docker: ${dockerInfo}`);

    // Check docker.sock access
    if (process.env.DOCKER_HOST) {
      logger.info(`DOCKER_HOST is set (${process.env.DOCKER_HOST}); Docker socket path check skipped`);
    } else {
      const socketPath = process.env.DOCKER_SOCKET || '/var/run/docker.sock';
      if (fs.existsSync(socketPath)) {
        try {
          const sockStat = fs.statSync(socketPath);
          if (sockStat.isSocket()) {
            logger.success(`Docker socket accessible at ${socketPath}`);
          } else {
            logger.error(`${socketPath} exists but is not a socket file`);
          }
        } catch (err) {
          logger.error(`Failed to stat ${socketPath} — ${err.message}`);
        }
      } else {
        logger.warn(`Docker socket not found at ${socketPath}`);
      }
    }

    // Check docker network
    try {
      const networks = execSync('docker network ls --format "{{.Name}}" | grep -E "pentest|kali"',
        { encoding: 'utf8', shell: true }).trim();
      if (networks) {
        logger.info(`Found existing Docker networks: ${networks}`);
      }
    } catch (err) {
      logger.debug('No existing pentest/kali networks');
    }

  } catch (err) {
    logger.error('Docker analysis failed', { error: err.message });
  }
}

// ============================================
// PORT AVAILABILITY CHECK
// ============================================

async function checkPorts() {
  logger.info('Checking required ports...');

  const ports = {
    3000: 'Application server',
    31337: 'Web UI',
    11434: 'Ollama (optional)'
  };

  for (const [port, service] of Object.entries(ports)) {
    try {
      execSync(`nc -z -w1 127.0.0.1 ${port} 2>/dev/null || true`,
        { shell: true, stdio: 'ignore' });

      // If command succeeds without error, port is in use
      try {
        const proc = execSync(`lsof -i :${port} 2>/dev/null || netstat -tulpn 2>/dev/null | grep :${port}`,
          { encoding: 'utf8', shell: true }).trim();
        if (proc) {
          logger.warn(`Port ${port} (${service}) is already in use`, { port, service });
        } else {
          logger.info(`Port ${port} (${service}) is available`);
        }
      } catch (err) {
        logger.info(`Port ${port} (${service}) is available`);
      }
    } catch (err) {
      logger.info(`Port ${port} (${service}) is available`);
    }
  }
}

// ============================================
// ENVIRONMENT CONFIGURATION
// ============================================

async function setupEnvironment() {
  logger.info('Setting up environment...');

  const envPath = path.join(process.cwd(), '.env');

  if (fs.existsSync(envPath)) {
    logger.warn('.env file already exists');
    const content = fs.readFileSync(envPath, 'utf8');
    const lines = content.split('\n').filter(l => !l.startsWith('#') && l.includes('='));
    logger.info(`Loaded ${lines.length} configuration values from .env`);
    return;
  }

  const crypto = require('crypto');
  const authSecret = crypto.randomUUID();
  const adminPassword = crypto.randomBytes(8).toString('hex');
  const bindHost = process.platform === 'win32' ? 'localhost' : '0.0.0.0';

  const envContent = `# Kali Hacker Bot Configuration
# Generated: ${new Date().toISOString()}

NODE_ENV=production
PORT=3000
BIND_HOST=${bindHost}

# Ollama API (running on host machine)
OLLAMA_URL=http://host.docker.internal:11434

# Docker Configuration
KALI_CONTAINER=kali-ai-term-kali

# Security
ADMIN_PASSWORD=${adminPassword}
AUTH_SECRET=${authSecret}

# Logging (debug, info, warn, error)
LOG_LEVEL=info

# Database (will be auto-initialized)
DB_PATH=./data/kali.db
`;

  fs.writeFileSync(envPath, envContent, 'utf8');
  logger.success('Generated .env configuration');
  logger.info(`Admin Password: ${adminPassword}`, { sensitive: true });
  logger.info(`Auth Secret: ${authSecret}`, { sensitive: true });
}

// ============================================
// DEPENDENCY INSTALLATION
// ============================================

async function installDependencies() {
  logger.info('Installing Node.js dependencies...');

  const nodeModulesPath = path.join(process.cwd(), 'node_modules');
  const packageLockPath = path.join(process.cwd(), 'package-lock.json');

  if (fs.existsSync(nodeModulesPath)) {
    logger.info('node_modules already exists, performing npm ci instead of npm install');
    try {
      const ciOutput = execSync('npm ci', { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 });
      logger.trackCommand('npm ci', 0, ciOutput);
      logger.success('Dependencies verified with npm ci');
    } catch (err) {
      logger.warn('npm ci failed, falling back to npm install');
      try {
        const installOutput = execSync('npm install', { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 });
        logger.trackCommand('npm install', 0, installOutput);
        logger.success('Dependencies installed');
      } catch (installErr) {
        logger.error('npm install failed', { exitCode: installErr.status });
        logger.trackCommand('npm install', installErr.status, '', installErr.message);
        throw installErr;
      }
    }
  } else {
    logger.info('Installing fresh Node.js dependencies...');
    try {
      const output = execSync('npm install', { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 });
      logger.trackCommand('npm install', 0, output);
      logger.success('Dependencies installed');
    } catch (err) {
      logger.error('npm install failed', { exitCode: err.status });
      logger.trackCommand('npm install', err.status, '', err.message);

      // Suggest fixes
      if (err.message.includes('ERESOLVE')) {
        logger.warn('Dependency conflict detected. Trying with --legacy-peer-deps...');
        try {
          const legacyOutput = execSync('npm install --legacy-peer-deps',
            { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 });
          logger.trackCommand('npm install --legacy-peer-deps', 0, legacyOutput);
          logger.success('Dependencies installed with legacy peer deps flag');
        } catch (legacyErr) {
          logger.error('Failed even with --legacy-peer-deps', { exitCode: legacyErr.status });
          throw legacyErr;
        }
      } else {
        throw err;
      }
    }
  }
}

// ============================================
// DOCKER CONTAINER STARTUP
// ============================================

async function startContainers() {
  logger.info('Starting Docker containers...');

  try {
    // Clean up old containers
    try {
      logger.debug('Stopping existing containers...');
      execSync('docker-compose down 2>/dev/null || docker compose down 2>/dev/null',
        { encoding: 'utf8', shell: true, stdio: 'ignore' });
    } catch (err) {
      logger.debug('No existing containers to stop');
    }

    // Start new containers
    logger.info('Building and starting containers (this may take a minute)...');
    const upOutput = execSync('docker-compose up -d 2>/dev/null || docker compose up -d',
      { encoding: 'utf8', shell: true, maxBuffer: 10 * 1024 * 1024 });
    logger.trackCommand('docker-compose up -d', 0, upOutput);
    logger.success('Containers started');

    // Monitor startup with detailed logging
    logger.info('Monitoring container startup...');
    let allHealthy = false;
    let attempts = 0;
    const maxAttempts = 60; // 2 minutes

    while (!allHealthy && attempts < maxAttempts) {
      try {
        const psOutput = execSync('docker ps -a --format "{{.Names}}\t{{.Status}}\t{{.State}}"',
          { encoding: 'utf8' });

        const lines = psOutput.trim().split('\n').filter(l => l.includes('kali'));

        let appReady = false;
        let kaliReady = false;

        lines.forEach(line => {
          const [name, status, state] = line.split('\t');
          const isRunning = state === 'running' || status.includes('Up');

          if (name.includes('app')) {
            appReady = isRunning;
            logger.debug(`App container: ${state} (${status})`);
            if (isRunning) {
              logger.trackContainer(name, 'running', { status, state });
            }
          } else if (name.includes('kali')) {
            kaliReady = isRunning;
            logger.debug(`Kali container: ${state} (${status})`);
            if (isRunning) {
              logger.trackContainer(name, 'running', { status, state });
            }
          }
        });

        if (appReady && kaliReady) {
          allHealthy = true;
          logger.success('All containers are running');
          verifyRequiredContainersRunning();
        } else {
          attempts++;
          if (attempts % 10 === 0) {
            logger.debug(`Waiting for containers... (${attempts}s elapsed)`);
          }
          await new Promise(resolve => setTimeout(resolve, 2000));
        }

      } catch (err) {
        attempts++;
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }

    if (!allHealthy) {
      logger.warn('Containers did not start within timeout');
      try {
        const appLogs = execSync('docker logs kali-ai-term-app 2>&1 | tail -30',
          { encoding: 'utf8', shell: true });
        logger.debug('App logs', { logs: appLogs });
      } catch (err) {
        logger.debug('Could not fetch container logs');
      }
      throw new Error('Container startup timeout');
    }

  } catch (err) {
    logger.error('Failed to start containers', { error: err.message });
    throw err;
  }
}

// ============================================
// VERIFICATION & TESTING
// ============================================

async function verifyInstallation() {
  logger.info('Verifying installation completeness...');

  const checks = {
    'node_modules exists': () => fs.existsSync('node_modules'),
    '.env configured': () => fs.existsSync('.env'),
    'Dockerfile present': () => fs.existsSync('Dockerfile'),
    'docker-compose.yml present': () => fs.existsSync('docker-compose.yml'),
    'server.js present': () => fs.existsSync('server.js'),
    'public directory exists': () => fs.existsSync('public'),
  };

  let allPassed = true;
  for (const [check, fn] of Object.entries(checks)) {
    if (fn()) {
      logger.success(check);
    } else {
      logger.error(check);
      allPassed = false;
    }
  }

  // Health check API
  verifyRequiredContainersRunning();

  logger.info('Checking application health...');
  try {
    execSync('curl -f http://localhost:3000/api/system/status 2>/dev/null',
      { stdio: 'ignore', timeout: 5000, shell: true });
    logger.success('Application API is responding');
  } catch (err) {
    logger.warn('Application health check failed (may still be starting)');
  }

  return allPassed;
}

// ============================================
// MAIN INSTALLATION FLOW
// ============================================

async function runFullInstallation() {
  try {
    console.log('\n╔════════════════════════════════════════════════╗');
    console.log('║  Kali Hacker Bot - Full Installation         ║');
    console.log('║  Advanced Diagnostics & System Integration    ║');
    console.log('╚════════════════════════════════════════════════╝\n');

    const prereqsOk = await detailedPrerequisiteCheck();
    if (!prereqsOk) {
      throw new Error('Prerequisites check failed');
    }

    await gatherSystemInfo();
    await analyzeDockerSystem();
    await checkPorts();
    await setupEnvironment();
    await installDependencies();
    await startContainers();
    const verified = await verifyInstallation();

    logger.generateDiagnostic('success', 'complete', '');

    console.log('\n╔════════════════════════════════════════════════╗');
    console.log('║  ✓ Full Installation Complete!               ║');
    console.log('╚════════════════════════════════════════════════╝\n');

    const envContent = fs.readFileSync('.env', 'utf8');
    const adminPassword = envContent.match(/ADMIN_PASSWORD=(.+)/)?.[1] || 'default';

    console.log('Installation Summary:');
    console.log(`  Status: ${verified ? 'COMPLETE' : 'PARTIAL'}`);
    console.log(`  Log File: ${logger.getLogPath()}`);
    console.log(`  Diagnostic: ${logger.getDiagnosticPath()}\n`);

    console.log('Access the Application:');
    console.log(`  URL: http://localhost:31337`);
    console.log(`  Password: ${adminPassword}\n`);

    console.log('Troubleshooting:');
    console.log(`  View logs: cat ${logger.getLogPath()}`);
    console.log(`  Run analyzer: node lib/diagnostic-analyzer.js ${path.basename(logger.getDiagnosticPath())}`);
    console.log(`  Interactive menu: node lib/install-menu.js ${path.basename(logger.getDiagnosticPath())}\n`);

    logger.success('Installation complete!');

  } catch (err) {
    logger.error('Installation failed', { error: err.message });
    logger.generateDiagnostic('failed', 'installation', err.message);

    console.error('\n╔════════════════════════════════════════════════╗');
    console.error('║  ✗ Installation Failed                        ║');
    console.error('╚════════════════════════════════════════════════╝\n');

    console.error(`Error: ${err.message}\n`);
    console.error('Diagnostics:');
    console.error(`  Log: ${logger.getLogPath()}`);
    console.error(`  Diagnostic: ${logger.getDiagnosticPath()}`);
    console.error(`  Analyzer: node lib/diagnostic-analyzer.js ${path.basename(logger.getDiagnosticPath())}\n`);

    process.exit(1);
  }
}

// Run full installation
runFullInstallation();
