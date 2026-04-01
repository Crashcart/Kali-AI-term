/**
 * Installation Diagnostic Menu
 * Interactive menu for post-installation diagnostics and troubleshooting
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const DiagnosticAnalyzer = require('./diagnostic-analyzer');

class InstallMenu {
  constructor(diagnosticFile, logFile) {
    this.diagnosticFile = diagnosticFile;
    this.logFile = logFile;
    this.analyzer = new DiagnosticAnalyzer(diagnosticFile);
  }

  displayMainMenu() {
    console.log('\n╔════════════════════════════════════════════╗');
    console.log('║    Installation Diagnostic Menu            ║');
    console.log('╚════════════════════════════════════════════╝\n');

    const summary = this.analyzer.getSummary();
    const statusColor = summary.errors === 0 ? '✅' : '⚠️ ';

    console.log(`${statusColor} Status: ${summary.status.toUpperCase()}`);
    console.log(`  Errors: ${summary.errors}, Warnings: ${summary.warnings}, Suggestions: ${summary.suggestions}\n`);

    console.log('Options:');
    console.log('  1) View error details');
    console.log('  2) View Docker container status');
    console.log('  3) View system information');
    console.log('  4) View diagnostic summary');
    console.log('  5) Exit\n');
  }

  viewErrorDetails() {
    console.log('\n═══════════════════════════════════════════');
    console.log('Error Details');
    console.log('═══════════════════════════════════════════\n');

    const analysis = this.analyzer.getAnalysis();

    if (analysis.issues.length === 0) {
      console.log('✅ No errors found!\n');
      return;
    }

    analysis.issues.forEach((issue, index) => {
      console.log(`${index + 1}. ${issue.message}`);
      if (issue.category) console.log(`   Category: ${issue.category}`);
      if (issue.details) console.log(`   Details: ${issue.details}`);
      if (issue.suggestion) console.log(`   Fix: ${issue.suggestion}`);
      console.log();
    });
  }

  viewDockerStatus() {
    console.log('\n═══════════════════════════════════════════');
    console.log('Docker Container Status');
    console.log('═══════════════════════════════════════════\n');

    try {
      const output = execSync('docker ps -a --format "table {{.Names}}\t{{.Status}}\t{{.Image}}"', { encoding: 'utf8' });
      console.log(output);
    } catch (err) {
      console.log('⚠️  Could not retrieve Docker status. Is Docker running?');
    }
  }

  viewSystemInfo() {
    console.log('\n═══════════════════════════════════════════');
    console.log('System Information');
    console.log('═══════════════════════════════════════════\n');

    if (!this.analyzer.diagnostic || !this.analyzer.diagnostic.system) {
      console.log('System information not available.\n');
      return;
    }

    const sys = this.analyzer.diagnostic.system;

    if (sys.system) {
      console.log('System:');
      console.log(`  Platform: ${sys.system.platform}`);
      console.log(`  Architecture: ${sys.system.arch}`);
      console.log(`  Node.js: ${sys.system.nodeVersion}`);
      console.log();
    }
  }

  viewDiagnosticSummary() {
    console.log('\n═══════════════════════════════════════════');
    console.log('Diagnostic Summary');
    console.log('═══════════════════════════════════════════\n');

    const summary = this.analyzer.getSummary();

    console.log(`Script: ${summary.script}`);
    console.log(`Status: ${summary.status}`);
    console.log(`Errors: ${summary.errors}`);
    console.log(`Warnings: ${summary.warnings}`);
    console.log(`Suggestions: ${summary.suggestions}`);
    console.log();
  }

  async run() {
    const readline = require('readline');
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    const promptMenu = () => {
      this.displayMainMenu();
      rl.question('Select option (1-5): ', (choice) => {
        console.log('\x1Bc');

        switch (choice) {
          case '1':
            this.viewErrorDetails();
            promptMenu();
            break;
          case '2':
            this.viewDockerStatus();
            promptMenu();
            break;
          case '3':
            this.viewSystemInfo();
            promptMenu();
            break;
          case '4':
            this.viewDiagnosticSummary();
            promptMenu();
            break;
          case '5':
            console.log('Exiting...\n');
            rl.close();
            break;
          default:
            console.log('Invalid option. Please select 1-5.\n');
            promptMenu();
        }
      });
    };

    promptMenu();
  }
}

if (require.main === module) {
  const diagnosticFile = process.argv[2] || 'install.diagnostic';
  const logFile = process.argv[3] || 'install.log';

  if (!fs.existsSync(diagnosticFile)) {
    console.error(`Error: Diagnostic file not found: ${diagnosticFile}`);
    process.exit(1);
  }

  const menu = new InstallMenu(diagnosticFile, logFile);
  menu.run().catch(err => {
    console.error('Menu error:', err.message);
    process.exit(1);
  });
}

module.exports = InstallMenu;
