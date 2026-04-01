/**
 * Diagnostic Analyzer
 * Parses log files and diagnostic JSON to identify issues and suggest fixes
 */

const fs = require('fs');
const path = require('path');

class DiagnosticAnalyzer {
  constructor(diagnosticFile) {
    this.diagnosticFile = diagnosticFile;
    this.diagnostic = null;
    this.analysis = {
      issues: [],
      warnings: [],
      suggestions: []
    };

    this.loadDiagnostic();
  }

  /**
   * Load diagnostic JSON file
   */
  loadDiagnostic() {
    try {
      if (!fs.existsSync(this.diagnosticFile)) {
        throw new Error(`Diagnostic file not found: ${this.diagnosticFile}`);
      }

      const content = fs.readFileSync(this.diagnosticFile, 'utf8');
      this.diagnostic = JSON.parse(content);
    } catch (err) {
      console.error('Failed to load diagnostic file:', err.message);
      this.diagnostic = null;
    }
  }

  /**
   * Analyze diagnostic data and identify issues
   */
  analyze() {
    if (!this.diagnostic) {
      this.analysis.issues.push({
        severity: 'ERROR',
        message: 'Diagnostic file could not be loaded'
      });
      return this.analysis;
    }

    this.analyzeErrors();
    this.analyzeCommands();
    this.analyzeContainers();
    this.analyzeSystem();
    this.generateSuggestions();

    return this.analysis;
  }

  /**
   * Analyze errors from diagnostic
   */
  analyzeErrors() {
    if (!this.diagnostic.errors || this.diagnostic.errors.length === 0) {
      return;
    }

    this.diagnostic.errors.forEach(err => {
      const message = err.message || '';

      if (message.includes('npm') || message.includes('ERESOLVE') || message.includes('ERR!')) {
        this.analysis.issues.push({
          severity: 'ERROR',
          category: 'npm',
          message: 'npm installation failed',
          details: message,
          suggestion: 'Try running: npm cache clean --force && npm install'
        });
      }

      if (message.includes('docker') || message.includes('Docker')) {
        if (message.includes('socket') || message.includes('docker.sock')) {
          this.analysis.issues.push({
            severity: 'ERROR',
            category: 'docker',
            message: 'Docker daemon not accessible',
            details: message,
            suggestion: 'Run: sudo systemctl start docker'
          });
        } else if (message.includes('permission')) {
          this.analysis.issues.push({
            severity: 'ERROR',
            category: 'docker',
            message: 'Docker permission denied',
            details: message,
            suggestion: 'Add user to docker group: sudo usermod -aG docker $USER'
          });
        }
      }

      if (message.includes('ECONNREFUSED') || message.includes('ETIMEDOUT')) {
        this.analysis.issues.push({
          severity: 'ERROR',
          category: 'network',
          message: 'Network connection failed',
          details: message,
          suggestion: 'Check internet connection and firewall settings'
        });
      }
    });
  }

  /**
   * Analyze command execution results
   */
  analyzeCommands() {
    if (!this.diagnostic.commands || this.diagnostic.commands.length === 0) {
      return;
    }

    const failedCommands = this.diagnostic.commands.filter(cmd => cmd.exitCode !== 0);

    failedCommands.forEach(cmd => {
      const cmdName = cmd.command.split(' ')[0];

      if (cmdName === 'npm' || cmd.command.includes('npm install')) {
        if (cmd.stderr && cmd.stderr.includes('ERESOLVE')) {
          this.analysis.suggestions.push({
            command: 'npm ci --legacy-peer-deps',
            description: 'Try installing with legacy peer deps flag'
          });
        }
      }

      if (cmd.command.includes('docker')) {
        this.analysis.warnings.push({
          severity: 'WARN',
          message: `Docker command failed: ${cmd.command}`,
          exitCode: cmd.exitCode
        });
      }
    });
  }

  /**
   * Analyze container status
   */
  analyzeContainers() {
    if (!this.diagnostic.containers || this.diagnostic.containers.length === 0) {
      this.analysis.warnings.push({
        severity: 'WARN',
        message: 'No container events recorded - containers may not have started'
      });
      return;
    }

    const containerStates = {};
    this.diagnostic.containers.forEach(event => {
      if (!containerStates[event.container]) {
        containerStates[event.container] = [];
      }
      containerStates[event.container].push(event.action);
    });

    Object.entries(containerStates).forEach(([container, actions]) => {
      if (!actions.includes('running') && !actions.includes('started')) {
        this.analysis.issues.push({
          severity: 'ERROR',
          category: 'container',
          message: `Container ${container} did not start`,
          actions: actions,
          suggestion: `Check logs: docker logs ${container}`
        });
      }
    });
  }

  /**
   * Analyze system information
   */
  analyzeSystem() {
    if (!this.diagnostic.system) {
      return;
    }

    if (!this.diagnostic.system.environment) {
      this.analysis.warnings.push({
        severity: 'WARN',
        message: 'No environment variables tracked'
      });
    }

    if (this.diagnostic.system.system && this.diagnostic.system.system.nodeVersion) {
      const nodeVer = this.diagnostic.system.system.nodeVersion;
      const majorVersion = parseInt(nodeVer.split('.')[0].replace('v', ''));
      if (majorVersion < 18) {
        this.analysis.issues.push({
          severity: 'ERROR',
          category: 'nodejs',
          message: `Node.js version ${nodeVer} is below required v18`,
          suggestion: 'Upgrade Node.js: https://nodejs.org/'
        });
      }
    }
  }

  /**
   * Generate suggestions based on analysis
   */
  generateSuggestions() {
    const issueCount = this.analysis.issues.length;
    const warningCount = this.analysis.warnings.length;

    if (issueCount === 0 && warningCount === 0) {
      this.analysis.suggestions.push({
        type: 'info',
        message: 'Installation completed successfully with no issues detected'
      });
    } else if (issueCount > 0) {
      this.analysis.suggestions.push({
        type: 'action',
        message: `${issueCount} error(s) found. Review each error above for detailed suggestions.`
      });
    }
  }

  /**
   * Format analysis for display
   */
  formatForDisplay() {
    let output = '\n╔════════════════════════════════════════════╗\n';
    output += '║         DIAGNOSTIC ANALYSIS REPORT          ║\n';
    output += '╚════════════════════════════════════════════╝\n\n';

    if (this.diagnostic) {
      output += `Script: ${this.diagnostic.script}\n`;
      output += `Status: ${this.diagnostic.status}\n`;
      output += `Duration: ${this.diagnostic.duration}\n\n`;
    }

    if (this.analysis.issues.length > 0) {
      output += '❌ ERRORS:\n';
      this.analysis.issues.forEach(issue => {
        output += `  • ${issue.message}\n`;
        if (issue.details) output += `    Details: ${issue.details.substring(0, 80)}\n`;
        if (issue.suggestion) output += `    Fix: ${issue.suggestion}\n`;
      });
      output += '\n';
    }

    if (this.analysis.warnings.length > 0) {
      output += '⚠️  WARNINGS:\n';
      this.analysis.warnings.forEach(warn => {
        output += `  • ${warn.message}\n`;
      });
      output += '\n';
    }

    if (this.analysis.suggestions.length > 0) {
      output += '💡 SUGGESTIONS:\n';
      this.analysis.suggestions.forEach(sug => {
        if (sug.command) {
          output += `  $ ${sug.command}\n`;
          if (sug.description) output += `    ${sug.description}\n`;
        } else {
          output += `  • ${sug.message}\n`;
        }
      });
      output += '\n';
    }

    if (this.diagnostic) {
      output += `Log file: ${this.diagnostic.logFile}\n`;
    }
    return output;
  }

  /**
   * Get analysis summary
   */
  getSummary() {
    return {
      script: this.diagnostic ? this.diagnostic.script : 'unknown',
      status: this.diagnostic ? this.diagnostic.status : 'unknown',
      errors: this.analysis.issues.length,
      warnings: this.analysis.warnings.length,
      suggestions: this.analysis.suggestions.length
    };
  }

  /**
   * Get full analysis object
   */
  getAnalysis() {
    return this.analysis;
  }
}

if (require.main === module) {
  const diagnosticFile = process.argv[2] || 'install.diagnostic';

  if (!fs.existsSync(diagnosticFile)) {
    console.error(`Error: Diagnostic file not found: ${diagnosticFile}`);
    console.error(`Usage: node diagnostic-analyzer.js [path-to-diagnostic.json]`);
    process.exit(1);
  }

  const analyzer = new DiagnosticAnalyzer(diagnosticFile);
  analyzer.analyze();

  console.log(analyzer.formatForDisplay());

  const summary = analyzer.getSummary();
  if (summary.errors > 0) {
    process.exit(1);
  }
}

module.exports = DiagnosticAnalyzer;
