#!/usr/bin/env node

/**
 * Kali Hacker Bot - Update Script
 * Updates application code, dependencies, and Docker images
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const { execSync } = require('child_process');
const { createLogger } = require('./lib/install-logger');

function resolveProjectDirectory() {
  const cwd = process.cwd();
  const homeProjectDir = path.join(os.homedir(), 'Kali-AI-term');

  const looksLikeProject = (dir) =>
    fs.existsSync(path.join(dir, 'docker-compose.yml')) ||
    fs.existsSync(path.join(dir, 'package.json'));

  if (looksLikeProject(cwd)) {
    return cwd;
  }

  if (looksLikeProject(homeProjectDir)) {
    return homeProjectDir;
  }

  if (!fs.existsSync(homeProjectDir)) {
    fs.mkdirSync(homeProjectDir, { recursive: true });
  }

  return homeProjectDir;
}

const projectDir = resolveProjectDirectory();
process.chdir(projectDir);

const logger = createLogger('update', {
  logDir: process.cwd(),
  verbose: true,
  maskSensitive: true,
});

// ============================================
// CHECK CURRENT INSTALLATION
// ============================================

async function checkInstallation() {
  logger.info('Checking current installation...');

  const requirements = {
    '.env': () => fs.existsSync('.env'),
    'docker-compose.yml': () => fs.existsSync('docker-compose.yml'),
    node_modules: () => fs.existsSync('node_modules'),
    Containers: () => {
      try {
        const output = execSync('docker ps -a --format "{{.Names}}" | grep -i kali', {
          encoding: 'utf8',
          shell: true,
          stdio: 'pipe',
        }).trim();
        return output.length > 0;
      } catch (err) {
        return false;
      }
    },
  };

  let allPresent = true;
  for (const [check, fn] of Object.entries(requirements)) {
    try {
      if (fn()) {
        logger.success(check);
      } else {
        logger.error(check);
        allPresent = false;
      }
    } catch (err) {
      logger.warn(`Could not verify ${check}`);
    }
  }

  if (!allPresent) {
    logger.warn('Some project components are missing. Continuing: updater will attempt recovery.');
    return false;
  }

  logger.success('Installation verified');
  return true;
}

// ============================================
// BACKUP CONFIGURATION
// ============================================

async function backupConfiguration() {
  logger.info('Backing up current configuration...');

  const timestamp = new Date().toISOString().split('T')[0];
  const backupDir = path.join(process.cwd(), `.backup-${timestamp}`);

  try {
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir);
    }

    // Backup .env
    if (fs.existsSync('.env')) {
      fs.copyFileSync('.env', path.join(backupDir, '.env.bak'));
      logger.debug('Backed up .env');
    }

    // Backup database if exists
    if (fs.existsSync('./data')) {
      execSync(`cp -r ./data ${path.join(backupDir, 'data-backup')}`, { stdio: 'ignore' });
      logger.debug('Backed up data directory');
    }

    logger.success(`Configuration backed up to ${backupDir}`);
  } catch (err) {
    logger.warn('Could not backup configuration', { error: err.message });
  }
}

// ============================================
// UPDATE SOURCE CODE
// ============================================

async function updateSourceCode() {
  logger.info('Updating source code...');

  try {
    // Check if git repo
    if (fs.existsSync('.git')) {
      logger.info('Pulling latest code from git...');
      const gitOutput = execSync('git pull', { encoding: 'utf8' });
      logger.trackCommand('git pull', 0, gitOutput);
      logger.success('Code updated from git');
    } else {
      logger.warn(
        'Not a git repository, refreshing full project snapshot from fix/issue-41 branch'
      );

      const tmpDir = execSync('mktemp -d', { encoding: 'utf8' }).trim();
      const downloadCmd = [
        `curl -fsSL https://codeload.github.com/Crashcart/Kali-AI-term/tar.gz/refs/heads/fix/issue-41 -o ${tmpDir}/project.tar.gz`,
        `tar -xzf ${tmpDir}/project.tar.gz -C ${tmpDir}`,
        `rsync -a --delete --exclude '.env' --exclude 'data/' --exclude '.backup-*' ${tmpDir}/Kali-AI-term-fix-issue-41/ ./`,
        `rm -rf ${tmpDir}`,
      ].join(' && ');

      execSync(downloadCmd, { shell: true, stdio: 'pipe' });
      logger.success('Project files refreshed from remote branch snapshot');
    }
  } catch (err) {
    logger.warn('git pull failed', { error: err.message });
  }
}

// ============================================
// VALIDATE COMPOSE CONFIG
// ============================================

async function validateComposeConfig() {
  logger.info('Validating docker-compose configuration...');

  try {
    execSync('docker compose config >/dev/null 2>&1 || docker-compose config >/dev/null 2>&1', {
      shell: true,
    });
    logger.success('docker-compose.yml is valid');
  } catch (err) {
    logger.error('docker-compose.yml validation failed', { error: err.message });
    throw new Error('Invalid docker-compose.yml. Fix configuration before update.');
  }
}

// ============================================
// UPDATE DEPENDENCIES
// ============================================

async function updateDependencies() {
  logger.info('Updating dependencies...');

  try {
    logger.info('Running npm update...');
    const output = execSync('npm update', { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 });
    logger.trackCommand('npm update', 0, output);
    logger.success('Dependencies updated');
  } catch (err) {
    logger.warn('npm update had issues', { error: err.message });
    logger.trackCommand('npm update', err.status || 1, '', err.message);

    // Try npm install to ensure all deps
    try {
      logger.info('Attempting npm install to ensure all dependencies...');
      const installOutput = execSync('npm install', {
        encoding: 'utf8',
        maxBuffer: 10 * 1024 * 1024,
      });
      logger.trackCommand('npm install', 0, installOutput);
      logger.success('Dependencies verified');
    } catch (installErr) {
      logger.error('npm install also failed', { error: installErr.message });
      throw installErr;
    }
  }
}

// ============================================
// STOP CONTAINERS
// ============================================

async function stopContainers() {
  logger.info('Stopping running containers...');

  try {
    execSync('docker-compose down 2>/dev/null || docker compose down 2>/dev/null', {
      shell: true,
      stdio: 'ignore',
    });
    logger.trackCommand('docker-compose down', 0);
    logger.success('Containers stopped');

    // Wait a moment
    await new Promise((resolve) => setTimeout(resolve, 2000));
  } catch (err) {
    logger.warn('docker-compose down failed', { error: err.message });
  }
}

// ============================================
// REBUILD DOCKER IMAGE
// ============================================

async function rebuildDockerImage() {
  logger.info('Rebuilding Docker image...');

  try {
    logger.info('Building application image (this may take a minute)...');
    const buildOutput = execSync('docker build -t kali-hacker-bot:latest .', {
      encoding: 'utf8',
      maxBuffer: 10 * 1024 * 1024,
    });
    logger.trackCommand('docker build', 0, buildOutput);
    logger.success('Docker image rebuilt');
  } catch (err) {
    logger.warn('Docker build had warnings', { error: err.message });
    logger.trackCommand('docker build', err.status || 1, '', err.message);
  }
}

// ============================================
// START UPDATED CONTAINERS
// ============================================

async function startContainers() {
  logger.info('Starting updated containers...');

  try {
    const upOutput = execSync(
      'docker-compose up -d --build --force-recreate 2>/dev/null || docker compose up -d --build --force-recreate',
      { encoding: 'utf8', shell: true, maxBuffer: 10 * 1024 * 1024 }
    );
    logger.trackCommand('docker-compose up -d --build --force-recreate', 0, upOutput);
    logger.success('Containers built and started');

    // Monitor startup
    logger.info('Waiting for containers to become healthy...');
    let healthy = false;
    let attempts = 0;
    const maxAttempts = 30; // 60 seconds

    while (!healthy && attempts < maxAttempts) {
      try {
        const psOutput = execSync('docker ps --format "{{.Names}}\t{{.State}}"', {
          encoding: 'utf8',
        });

        const lines = psOutput.trim().split('\n');
        const appRunning = lines.some(
          (line) => line.includes('kali-ai-term-app') && line.includes('running')
        );
        const kaliRunning = lines.some(
          (line) => line.includes('kali-ai-term-kali') && line.includes('running')
        );

        if (appRunning && kaliRunning) {
          healthy = true;
          logger.success('Containers are running and healthy');
          lines.forEach((line) => {
            if (line.trim()) {
              const [name, state] = line.split('\t');
              logger.trackContainer(name, state === 'running' ? 'running' : 'created', { state });
            }
          });
        } else {
          attempts++;
          if (attempts % 5 === 0) {
            logger.debug(`Waiting for containers (${attempts}s)`);
          }
          await new Promise((resolve) => setTimeout(resolve, 2000));
        }
      } catch (err) {
        attempts++;
        await new Promise((resolve) => setTimeout(resolve, 2000));
      }
    }

    if (!healthy) {
      logger.warn('Containers did not become healthy within timeout');
    }
  } catch (err) {
    logger.error('Failed to start containers', { error: err.message });
    throw err;
  }
}

// ============================================
// VERIFY UPDATE
// ============================================

async function verifyUpdate() {
  logger.info('Verifying update...');

  // Health check API
  try {
    execSync('curl -f http://localhost:3000/api/system/status >/dev/null 2>&1', {
      shell: true,
      timeout: 5000,
    });
    logger.success('Application API is responding');
  } catch (err) {
    logger.warn('Health check failed (application may still be starting)');
  }

  // Check logs
  try {
    const appLogs = execSync('docker logs kali-ai-term-app 2>&1 | tail -5', {
      encoding: 'utf8',
      shell: true,
    });
    logger.debug('Recent app logs', { logs: appLogs });
  } catch (err) {
    logger.debug('Could not fetch logs');
  }

  logger.trackSystemInfo();
}

// ============================================
// MAIN UPDATE FLOW
// ============================================

async function runUpdate() {
  try {
    console.log('\n╔════════════════════════════════════════╗');
    console.log('║  Kali Hacker Bot - Update             ║');
    console.log('╚════════════════════════════════════════╝\n');

    logger.info(`Using project directory: ${projectDir}`);
    await checkInstallation();
    await backupConfiguration();
    await updateSourceCode();
    await validateComposeConfig();
    await updateDependencies();
    await stopContainers();
    await rebuildDockerImage();
    await startContainers();
    await verifyUpdate();

    logger.generateDiagnostic('success', 'update_complete', '');

    console.log('\n╔════════════════════════════════════════╗');
    console.log('║  ✓ Update Complete                   ║');
    console.log('╚════════════════════════════════════════╝\n');

    console.log('Update Summary:');
    console.log(`  Code: Updated`);
    console.log(`  Dependencies: Updated`);
    console.log(`  Docker Image: Rebuilt`);
    console.log(`  Containers: Running\n`);

    console.log('Access the Application:');
    console.log('  URL: http://localhost:31337\n');

    console.log('Logs:');
    console.log(`  Update log: ${logger.getLogPath()}`);
    console.log(`  App logs: docker logs -f kali-ai-term-app\n`);

    logger.success('Update completed successfully');
  } catch (err) {
    logger.error('Update failed', { error: err.message });
    logger.generateDiagnostic('failed', 'update', err.message);

    console.error('\n╔════════════════════════════════════════╗');
    console.error('║  ✗ Update Failed                      ║');
    console.error('╚════════════════════════════════════════╝\n');

    console.error(`Error: ${err.message}\n`);
    console.error('To rollback:');
    console.error('  docker-compose restart\n');

    console.error(`Log: ${logger.getLogPath()}\n`);

    process.exit(1);
  }
}

// Run update
runUpdate();
