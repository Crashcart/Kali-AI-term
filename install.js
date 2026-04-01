#!/usr/bin/env node

/**
 * Kali Hacker Bot - Installation Script with Logging
 * Integrates with InstallLogger for comprehensive diagnostics
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { createLogger } = require('./lib/install-logger');

const logger = createLogger('install', {
  logDir: process.cwd(),
  verbose: true,
  maskSensitive: true
});

const COMPOSE_SCRIPT = process.platform === 'win32' ? 'docker-compose.cmd' : 'docker-compose';

// ============================================
// 1. Check Prerequisites
// ============================================

async function checkPrerequisites() {
  logger.info('Checking prerequisites...');

  let missingDeps = [];

  // Check Docker
  try {
    const dockerVersion = execSync('docker --version', { encoding: 'utf8' }).trim();
    logger.success(`Docker installed: ${dockerVersion}`);
  } catch (err) {
    logger.error('Docker not found', { url: 'https://docs.docker.com/get-docker/' });
    missingDeps.push('docker');
  }

  // Check Docker Compose
  let hasCompose = false;
  try {
    const composeVersion = execSync('docker-compose --version', { encoding: 'utf8' }).trim();
    logger.success(`Docker Compose installed: ${composeVersion}`);
    hasCompose = true;
  } catch (err) {
    try {
      const composeVersion = execSync('docker compose version', { encoding: 'utf8' }).trim();
      logger.success(`Docker Compose installed (via docker): ${composeVersion}`);
      hasCompose = true;
    } catch (err2) {
      logger.error('Docker Compose not found', { url: 'https://docs.docker.com/compose/install/' });
      missingDeps.push('docker-compose');
    }
  }

  // Check Node.js
  try {
    const nodeVersion = execSync('node --version', { encoding: 'utf8' }).trim();
    logger.success(`Node.js installed: ${nodeVersion}`);
  } catch (err) {
    logger.error('Node.js not found', { url: 'https://nodejs.org/ (v18 or higher)' });
    missingDeps.push('nodejs');
  }

  // Check Ollama (optional)
  try {
    const ollamaVersion = execSync('ollama --version', { encoding: 'utf8' }).trim();
    logger.success(`Ollama installed: ${ollamaVersion}`);

    // Check if running
    try {
      execSync('curl -s http://localhost:11434/api/tags > /dev/null', { stdio: 'ignore' });
      logger.success('Ollama is running on port 11434');
    } catch (err) {
      logger.warn('Ollama is installed but not running on port 11434');
    }
  } catch (err) {
    logger.warn('Ollama not found (optional) - can be configured in Settings');
  }

  if (missingDeps.length > 0) {
    logger.error(`Missing critical dependencies: ${missingDeps.join(', ')}`);
    return false;
  }

  return true;
}

// ============================================
// 2. Create .env Configuration
// ============================================

async function configureEnvironment() {
  logger.info('Configuring environment...');

  const envPath = path.join(process.cwd(), '.env');

  if (fs.existsSync(envPath)) {
    logger.warn('.env file already exists, keeping existing configuration');
    return;
  }

  // Generate secure random values
  const crypto = require('crypto');
  const authSecret = crypto.randomUUID();
  const adminPassword = crypto.randomBytes(8).toString('hex');

  const envContent = `# Kali Hacker Bot Configuration
NODE_ENV=production
PORT=3000
BIND_HOST=0.0.0.0

# Ollama (running on host)
OLLAMA_URL=http://host.docker.internal:11434

# Docker
KALI_CONTAINER=kali-ai-term-kali

# Security
ADMIN_PASSWORD=${adminPassword}
AUTH_SECRET=${authSecret}

# Logging
LOG_LEVEL=info
`;

  fs.writeFileSync(envPath, envContent, 'utf8');
  logger.success('Generated .env with secure secrets');
  logger.info(`Admin Password: ${adminPassword}`, { sensitive: true });
  logger.info(`Auth Secret: ${authSecret}`, { sensitive: true });
}

// ============================================
// 3. Install Dependencies
// ============================================

async function installDependencies() {
  logger.info('Installing Node.js dependencies...');

  const nodeModulesPath = path.join(process.cwd(), 'node_modules');

  if (fs.existsSync(nodeModulesPath)) {
    logger.info('node_modules already exists, skipping npm install');
    return;
  }

  try {
    const output = execSync('npm install', { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 });
    logger.trackCommand('npm install', 0, output);
    logger.success('Dependencies installed');
  } catch (err) {
    logger.trackCommand('npm install', err.status || 1, err.stdout || '', err.stderr || err.message);
    logger.error('npm install failed', { exitCode: err.status, error: err.message });
    throw err;
  }
}

// ============================================
// 4. Start Docker Containers
// ============================================

async function startContainers() {
  logger.info('Starting Docker containers...');

  try {
    // Stop existing containers
    try {
      const downOutput = execSync('docker-compose down 2>/dev/null || docker compose down 2>/dev/null',
        { encoding: 'utf8', shell: true });
      logger.trackCommand('docker-compose down', 0);
    } catch (err) {
      // Ignore down errors if containers don't exist
      logger.debug('docker-compose down (no prior containers)');
    }

    // Start containers
    const upOutput = execSync('docker-compose up -d 2>/dev/null || docker compose up -d',
      { encoding: 'utf8', shell: true, maxBuffer: 10 * 1024 * 1024 });
    logger.trackCommand('docker-compose up -d', 0, upOutput);
    logger.success('Docker containers started');

    // Wait for containers with health checks
    logger.info('Waiting for containers to be healthy (max 60 seconds)...');
    let healthy = false;
    let attempts = 0;
    const maxAttempts = 30; // 30 * 2 seconds = 60 seconds

    while (!healthy && attempts < maxAttempts) {
      try {
        const psOutput = execSync('docker ps --format "{{.Names}}\t{{.Status}}"',
          { encoding: 'utf8' });

        const lines = psOutput.trim().split('\n');
        const appRunning = lines.some(line =>
          line.includes('kali-ai-term-app') && line.includes('Up'));
        const kaliRunning = lines.some(line =>
          line.includes('kali-ai-term-kali') && line.includes('Up'));

        if (appRunning && kaliRunning) {
          healthy = true;
          logger.success('All containers are running and healthy');

          // Track container states
          lines.forEach(line => {
            if (line.trim()) {
              const [name, status] = line.split('\t');
              const action = status.includes('Up') ? 'running' : 'created';
              logger.trackContainer(name, action, { status });
            }
          });
        } else {
          attempts++;
          if (attempts % 5 === 0) {
            logger.debug(`Waiting for containers (attempt ${attempts}/${maxAttempts})`);
          }
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      } catch (err) {
        attempts++;
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }

    if (!healthy) {
      logger.warn('Containers did not become healthy within timeout');
      logger.info('Checking container logs...');
      try {
        const appLogs = execSync('docker logs kali-ai-term-app 2>&1 | tail -20',
          { encoding: 'utf8', shell: true });
        logger.debug('App container logs', { logs: appLogs });
      } catch (err) {
        // Ignore log fetch errors
      }
    }

  } catch (err) {
    logger.error('Failed to start containers', { error: err.message });
    throw err;
  }
}

// ============================================
// 5. Verify Installation
// ============================================

async function verifyInstallation() {
  logger.info('Verifying installation...');

  try {
    // Check if app is responding
    execSync('curl -f http://localhost:3000/api/system/status >/dev/null 2>&1',
      { shell: true, timeout: 5000 });
    logger.success('Application is responding on port 3000');
  } catch (err) {
    logger.warn('Application health check failed (containers may still be starting)');
  }

  // Track system information
  logger.trackSystemInfo();
  logger.trackEnvironment(process.env);
}

// ============================================
// Main Installation Flow
// ============================================

async function runInstallation() {
  try {
    console.log('\n╔════════════════════════════════════════╗');
    console.log('║  Kali Hacker Bot - Installation       ║');
    console.log('╚════════════════════════════════════════╝\n');

    const prereqsOk = await checkPrerequisites();
    if (!prereqsOk) {
      logger.error('Prerequisites check failed');
      const diagnostic = logger.generateDiagnostic('failed', 'prerequisites', 'Missing critical dependencies');
      console.error('\nPlease install missing dependencies and try again.');
      process.exit(1);
    }

    await configureEnvironment();
    await installDependencies();
    await startContainers();
    await verifyInstallation();

    // Generate success diagnostic
    logger.generateDiagnostic('success', 'complete', '');

    console.log('\n╔════════════════════════════════════════╗');
    console.log('║  🎉 Installation Complete!            ║');
    console.log('╚════════════════════════════════════════╝\n');

    const envContent = fs.readFileSync('.env', 'utf8');
    const adminPassword = envContent.match(/ADMIN_PASSWORD=(.+)/)?.[1] || 'kalibot';

    console.log('Access the application:');
    console.log(`  URL: http://localhost:31337`);
    console.log(`  Password: ${adminPassword}\n`);

    console.log('Documentation:');
    console.log('  Architecture: see TDR.md');
    console.log('  Usage Guide: see README.md\n');

    console.log('Next steps:');
    console.log('  1. Open http://localhost:31337 in your browser');
    console.log('  2. Login with the password above');
    console.log('  3. Configure Ollama URL in Settings → OLLAMA');
    console.log('  4. Set target IP in Settings → TARGET');
    console.log('  5. Start pentesting!\n');

    console.log('Logs:');
    console.log(`  Install log: ${logger.getLogPath()}`);
    console.log(`  Diagnostic: ${logger.getDiagnosticPath()}`);
    console.log(`  View diagnostic: node lib/diagnostic-analyzer.js ${path.basename(logger.getDiagnosticPath())}\n`);

    logger.success('Ready to go!');

  } catch (err) {
    logger.error('Installation failed', { error: err.message, stack: err.stack });
    logger.generateDiagnostic('failed', 'installation', err.message);

    console.error('\n╔════════════════════════════════════════╗');
    console.error('║  ✗ Installation Failed                ║');
    console.error('╚════════════════════════════════════════╝\n');

    console.error(`Error: ${err.message}\n`);
    console.error('For detailed troubleshooting:');
    console.error(`  cat ${logger.getLogPath()}`);
    console.error(`  node lib/diagnostic-analyzer.js ${path.basename(logger.getDiagnosticPath())}\n`);

    process.exit(1);
  }
}

// Run installation
runInstallation();
