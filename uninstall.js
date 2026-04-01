#!/usr/bin/env node

/**
 * Kali Hacker Bot - Uninstallation Script
 * Safely removes containers, volumes, and configuration
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const readline = require('readline');
const { createLogger } = require('./lib/install-logger');

const logger = createLogger('uninstall', {
  logDir: process.cwd(),
  verbose: true,
  maskSensitive: true
});

// ============================================
// CONFIRMATION PROMPT
// ============================================

function promptConfirmation() {
  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    console.log('\n╔════════════════════════════════════════╗');
    console.log('║  Kali Hacker Bot - Uninstallation    ║');
    console.log('╚════════════════════════════════════════╝\n');

    console.log('⚠️  WARNING: This will:');
    console.log('  • Stop and remove Docker containers');
    console.log('  • Remove volume data');
    console.log('  • Delete .env configuration');
    console.log('  • Preserve logs for review\n');

    rl.question('Type "uninstall" to confirm: ', (answer) => {
      rl.close();
      resolve(answer.toLowerCase() === 'uninstall');
    });
  });
}

// ============================================
// STOP CONTAINERS
// ============================================

async function stopContainers() {
  logger.info('Stopping Docker containers...');

  try {
    execSync('docker-compose down 2>/dev/null || docker compose down 2>/dev/null',
      { shell: true, stdio: 'ignore' });
    logger.trackCommand('docker-compose down', 0);
    logger.success('Containers stopped');
  } catch (err) {
    logger.warn('docker-compose down failed (containers may not exist)', { error: err.message });
  }

  // Check if containers still exist
  try {
    const psOutput = execSync('docker ps -a --format "{{.Names}}" | grep -i kali',
      { encoding: 'utf8', shell: true }).trim();

    if (psOutput) {
      logger.warn('Found remaining containers, forcing removal...');
      psOutput.split('\n').forEach(container => {
        if (container) {
          try {
            execSync(`docker rm -f ${container}`, { stdio: 'ignore' });
            logger.debug(`Removed container: ${container}`);
          } catch (err) {
            logger.warn(`Could not remove container: ${container}`);
          }
        }
      });
    }
  } catch (err) {
    logger.debug('No containers found');
  }

  logger.success('All containers removed');
}

// ============================================
// REMOVE VOLUMES
// ============================================

async function removeVolumes() {
  logger.info('Removing Docker volumes...');

  try {
    const volumesOutput = execSync('docker volume ls --format "{{.Name}}" | grep -i kali',
      { encoding: 'utf8', shell: true }).trim();

    if (volumesOutput) {
      volumesOutput.split('\n').forEach(volume => {
        if (volume) {
          try {
            execSync(`docker volume rm ${volume}`, { stdio: 'ignore' });
            logger.debug(`Removed volume: ${volume}`);
          } catch (err) {
            logger.warn(`Could not remove volume: ${volume}`);
          }
        }
      });
      logger.success('Volumes removed');
    } else {
      logger.info('No volumes to remove');
    }
  } catch (err) {
    logger.debug('Could not list volumes');
  }
}

// ============================================
// REMOVE DATA DIRECTORIES
// ============================================

async function removeDataDirectories() {
  logger.info('Removing application data...');

  const dirs = ['./data', './node_modules', './.env'];

  for (const dir of dirs) {
    if (fs.existsSync(dir)) {
      try {
        if (fs.statSync(dir).isDirectory()) {
          execSync(`rm -rf ${dir}`);
          logger.debug(`Removed directory: ${dir}`);
        } else {
          fs.unlinkSync(dir);
          logger.debug(`Removed file: ${dir}`);
        }
      } catch (err) {
        logger.warn(`Could not remove ${dir}`, { error: err.message });
      }
    }
  }

  logger.success('Data directories removed');
}

// ============================================
// VERIFY CLEANUP
// ============================================

async function verifyCleanup() {
  logger.info('Verifying cleanup...');

  const verification = {
    'Containers removed': () => {
      try {
        const output = execSync('docker ps -a --format "{{.Names}}" | grep -i kali',
          { encoding: 'utf8', shell: true, stdio: 'pipe' }).trim();
        return !output;
      } catch (err) {
        return true;
      }
    },
    'Volumes removed': () => {
      try {
        const output = execSync('docker volume ls --format "{{.Name}}" | grep -i kali',
          { encoding: 'utf8', shell: true, stdio: 'pipe' }).trim();
        return !output;
      } catch (err) {
        return true;
      }
    },
    '.env removed': () => !fs.existsSync('.env'),
    'data directory removed': () => !fs.existsSync('./data'),
  };

  let allClean = true;
  for (const [check, fn] of Object.entries(verification)) {
    try {
      const result = fn();
      if (result) {
        logger.success(check);
      } else {
        logger.warn(`${check} (some remains found)`);
        allClean = false;
      }
    } catch (err) {
      logger.warn(`Could not verify ${check}`);
    }
  }

  return allClean;
}

// ============================================
// MAIN UNINSTALLATION FLOW
// ============================================

async function runUninstallation() {
  try {
    const confirmed = await promptConfirmation();

    if (!confirmed) {
      logger.info('Uninstallation cancelled');
      console.log('\nUninstallation cancelled.\n');
      process.exit(0);
    }

    logger.info('Starting uninstallation process');
    console.log('\nUninstalling...\n');

    await stopContainers();
    await removeVolumes();
    await removeDataDirectories();
    const isClean = await verifyCleanup();

    logger.generateDiagnostic('success', 'uninstalled', 'Clean uninstall completed');

    console.log('\n╔════════════════════════════════════════╗');
    console.log('║  ✓ Uninstallation Complete           ║');
    console.log('╚════════════════════════════════════════╝\n');

    console.log('Removed:');
    console.log('  • Docker containers');
    console.log('  • Docker volumes');
    console.log('  • Application data');
    console.log('  • Environment configuration\n');

    console.log('Preserved:');
    console.log('  • Installation logs (for reference)');
    console.log('  • Source code files\n');

    if (!isClean) {
      console.log('⚠️  Some files may remain (permission issues)');
      console.log('  Review with: ls -la\n');
    }

    console.log('To reinstall:');
    console.log('  node install.js (basic) or');
    console.log('  node install-full.js (comprehensive)\n');

    logger.success('System cleaned');

  } catch (err) {
    logger.error('Uninstallation failed', { error: err.message });
    logger.generateDiagnostic('failed', 'uninstallation', err.message);

    console.error('\n╔════════════════════════════════════════╗');
    console.error('║  ✗ Uninstallation Failed             ║');
    console.error('╚════════════════════════════════════════╝\n');

    console.error(`Error: ${err.message}\n`);
    console.error(`Log: ${logger.getLogPath()}\n`);

    process.exit(1);
  }
}

// Run uninstallation
runUninstallation();
