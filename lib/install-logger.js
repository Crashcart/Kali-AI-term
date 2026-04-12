/**
 * Installation Logger
 * Centralized logging for install, update, and uninstall scripts
 * Logs to console, file, and diagnostic JSON
 */

const fs = require('fs');
const path = require('path');

class InstallLogger {
  constructor(options = {}) {
    this.scriptName = options.scriptName || 'install';
    this.logDir = options.logDir || process.cwd();
    this.verbose = options.verbose !== false;
    this.maskSensitive = options.maskSensitive !== false;
    this.maxHistoryFiles = options.maxHistoryFiles || 5;

    this.commands = [];
    this.containerEvents = [];
    this.systemInfo = {};
    this.startTime = new Date();
    this.errors = [];

    this.initializeLogFile();
  }

  /**
   * Initialize log file with timestamp archival
   */
  initializeLogFile() {
    const timestamp = this.formatTimestamp(new Date());
    const baseLogName = `${this.scriptName}-${timestamp}.log`;
    this.logFilePath = path.join(this.logDir, baseLogName);
    this.currentLogPath = path.join(this.logDir, `${this.scriptName}.log`);

    // Clean up old log files (keep last N)
    this.pruneOldLogs();

    // Write initial log entry
    const header = `\n${'='.repeat(70)}\n${this.scriptName.toUpperCase()} LOG\nStarted: ${new Date().toISOString()}\n${'='.repeat(70)}\n`;
    fs.writeFileSync(this.logFilePath, header, 'utf8');

    // Create symlink to current log
    try {
      if (fs.existsSync(this.currentLogPath)) {
        fs.unlinkSync(this.currentLogPath);
      }
      fs.symlinkSync(path.basename(this.logFilePath), this.currentLogPath);
    } catch (err) {
      // Symlink may not work on all systems (Windows), silently fail
    }
  }

  /**
   * Format timestamp as ISO string
   */
  formatTimestamp(date) {
    return date.toISOString().replace(/[:.]/g, '-').slice(0, -5);
  }

  /**
   * Remove old log files, keeping only the most recent N
   */
  pruneOldLogs() {
    try {
      const files = fs
        .readdirSync(this.logDir)
        .filter((f) => f.startsWith(`${this.scriptName}-`) && f.endsWith('.log'))
        .map((f) => ({
          name: f,
          time: fs.statSync(path.join(this.logDir, f)).mtime.getTime(),
        }))
        .sort((a, b) => b.time - a.time);

      files.slice(this.maxHistoryFiles).forEach((f) => {
        try {
          fs.unlinkSync(path.join(this.logDir, f.name));
        } catch (err) {
          // Silently ignore deletion errors
        }
      });
    } catch (err) {
      // Silently ignore pruning errors
    }
  }

  /**
   * Mask sensitive values in a string
   */
  maskSensitiveValues(text) {
    if (!this.maskSensitive || typeof text !== 'string') return text;

    const sensitivePatterns = [
      /ADMIN_PASSWORD=[\w\d]+/gi,
      /AUTH_SECRET=[\w\d\-]+/gi,
      /KALI_CONTAINER_PASSWORD=[\w\d]+/gi,
      /API_KEY=[\w\d\-]+/gi,
      /TOKEN=[\w\d\-]+/gi,
      /SECRET=[\w\d\-]+/gi,
      /"password"\s*:\s*"[^"]+"/gi,
      /"token"\s*:\s*"[^"]+"/gi,
      /"secret"\s*:\s*"[^"]+"/gi,
    ];

    let masked = text;
    sensitivePatterns.forEach((pattern) => {
      masked = masked.replace(pattern, (match) => {
        const key = match.split(/[=:]/)[0];
        return `${key}=***`;
      });
    });
    return masked;
  }

  /**
   * Write to log file
   */
  writeToFile(message) {
    try {
      const masked = this.maskSensitiveValues(message);
      fs.appendFileSync(this.logFilePath, masked + '\n', 'utf8');
    } catch (err) {
      console.error('[LOGGER ERROR]', err.message);
    }
  }

  /**
   * Log with severity level
   */
  log(level, message, data = {}) {
    const timestamp = new Date().toISOString();
    const dataStr = Object.keys(data).length > 0 ? ` | ${JSON.stringify(data)}` : '';
    const logEntry = `[${timestamp}] ${level.padEnd(8)} ${message}${dataStr}`;

    this.writeToFile(logEntry);

    if (this.verbose) {
      const colors = {
        DEBUG: '\x1b[36m', // cyan
        INFO: '\x1b[37m', // white
        SUCCESS: '\x1b[32m', // green
        WARN: '\x1b[33m', // yellow
        ERROR: '\x1b[31m', // red
        RESET: '\x1b[0m',
      };

      const color = colors[level] || '';
      const reset = colors.RESET;
      console.log(`${color}${logEntry}${reset}`);
    }
  }

  /**
   * Convenience methods for different log levels
   */
  debug(message, data) {
    this.log('DEBUG', message, data);
  }
  info(message, data) {
    this.log('INFO', message, data);
  }
  success(message, data) {
    this.log('SUCCESS', '✓ ' + message, data);
  }
  warn(message, data) {
    this.log('WARN', '⚠ ' + message, data);
  }
  error(message, data) {
    this.log('ERROR', '✗ ' + message, data);
    this.errors.push({ timestamp: new Date(), message, data });
  }

  /**
   * Track command execution
   */
  trackCommand(cmd, exitCode, stdout = '', stderr = '') {
    const entry = {
      timestamp: new Date().toISOString(),
      command: cmd,
      exitCode: exitCode,
      stdout: stdout ? stdout.substring(0, 500) : '', // limit output
      stderr: stderr ? stderr.substring(0, 500) : '',
    };

    this.commands.push(entry);

    const status = exitCode === 0 ? 'SUCCESS' : 'FAILED';
    const logMsg = `[${status}] Command: ${cmd}`;
    this.log(exitCode === 0 ? 'SUCCESS' : 'ERROR', logMsg, { exitCode });

    if (stdout && exitCode === 0) {
      this.debug(`  stdout: ${stdout.substring(0, 200)}`);
    }
    if (stderr) {
      this.debug(`  stderr: ${stderr.substring(0, 200)}`);
    }
  }

  /**
   * Track container state changes
   */
  trackContainer(name, action, details = {}) {
    const entry = {
      timestamp: new Date().toISOString(),
      container: name,
      action: action,
      details: details,
    };

    this.containerEvents.push(entry);
    this.info(`Container [${name}] ${action}`, details);
  }

  /**
   * Track environment variables
   */
  trackEnvironment(envVars = {}) {
    this.systemInfo.environment = {};
    const envToTrack = ['NODE_ENV', 'PORT', 'BIND_HOST', 'KALI_CONTAINER', 'LOG_LEVEL', 'PATH'];

    envToTrack.forEach((key) => {
      const value = envVars[key] || process.env[key];
      if (value) {
        const masked = this.maskSensitiveValues(`${key}=${value}`);
        this.systemInfo.environment[key] = masked.split('=')[1];
      }
    });

    this.debug('Environment variables tracked', this.systemInfo.environment);
  }

  /**
   * Track system information
   */
  trackSystemInfo() {
    const os = require('os');
    this.systemInfo.system = {
      platform: process.platform,
      arch: process.arch,
      nodeVersion: process.version,
      timestamp: new Date().toISOString(),
    };

    this.info('System information', this.systemInfo.system);
  }

  /**
   * Generate diagnostic JSON report
   */
  generateDiagnostic(status = 'unknown', stage = 'unknown', failureReason = '') {
    const duration = Math.round((new Date() - this.startTime) / 1000);

    const diagnostic = {
      timestamp: new Date().toISOString(),
      script: this.scriptName,
      status: status, // 'success', 'failed', 'partial'
      stage: stage, // which step failed
      duration: `${duration}s`,
      failureReason: failureReason,
      errorCount: this.errors.length,
      errors: this.errors,
      system: this.systemInfo,
      commands: this.commands,
      containers: this.containerEvents,
      logFile: path.basename(this.logFilePath),
    };

    const diagnosticPath = path.join(this.logDir, `${this.scriptName}.diagnostic`);
    fs.writeFileSync(diagnosticPath, JSON.stringify(diagnostic, null, 2), 'utf8');

    this.info(`Diagnostic report written to: ${diagnosticPath}`);

    return diagnostic;
  }

  /**
   * Get log file path
   */
  getLogPath() {
    return this.logFilePath;
  }

  /**
   * Get diagnostic file path
   */
  getDiagnosticPath() {
    return path.join(this.logDir, `${this.scriptName}.diagnostic`);
  }

  /**
   * Get all logged errors
   */
  getErrors() {
    return this.errors;
  }

  /**
   * Check if installation had any errors
   */
  hasErrors() {
    return this.errors.length > 0;
  }

  /**
   * Get summary
   */
  getSummary() {
    return {
      script: this.scriptName,
      startTime: this.startTime.toISOString(),
      endTime: new Date().toISOString(),
      duration: Math.round((new Date() - this.startTime) / 1000),
      commandsExecuted: this.commands.length,
      errorCount: this.errors.length,
      containerEvents: this.containerEvents.length,
      logFile: this.logFilePath,
    };
  }
}

/**
 * Factory function to create logger instance
 */
function createLogger(scriptName, options = {}) {
  return new InstallLogger({
    scriptName,
    ...options,
  });
}

module.exports = {
  InstallLogger,
  createLogger,
};
