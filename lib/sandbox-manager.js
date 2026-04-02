/**
 * Sandbox Manager
 * Orchestrates sandbox lifecycle, execution, and constraint enforcement
 */

const { EventEmitter } = require('events');
const { v4: uuidv4 } = require('uuid');

class SandboxManager extends EventEmitter {
  constructor(sandboxConfig, docker, logger) {
    super();
    this.config = sandboxConfig;
    this.docker = docker;
    this.logger = logger;
    
    this.activeSandboxes = new Map(); // Track running sandbox instances
    this.executionHistory = new Map(); // Track execution attempts
  }

  /**
   * Start a sandbox and prepare it for execution
   */
  async startSandbox(sandboxId) {
    const sandboxConfig = this.config.getSandbox(sandboxId);
    if (!sandboxConfig) {
      throw new Error(`Sandbox configuration not found: ${sandboxId}`);
    }

    // Verify constraints before starting
    const verification = this.config.verifySandboxConstraints(sandboxId);
    if (!verification.valid) {
      throw new Error(`Sandbox constraints invalid: ${verification.errors.join('; ')}`);
    }

    try {
      const sandboxInstance = {
        id: sandboxId,
        configId: sandboxConfig.id,
        startedAt: new Date().toISOString(),
        status: 'starting',
        processId: null,
        container: null,
        executions: [],
        metrics: {
          cpuUsage: 0,
          memoryUsage: 0,
          networkBytesIn: 0,
          networkBytesOut: 0
        }
      };

      this.activeSandboxes.set(sandboxId, sandboxInstance);
      
      // Update sandbox status
      this.config.updateSandbox(sandboxId, { status: 'running' });
      
      this.logger?.info(`Started sandbox: ${sandboxId}`);
      this.emit('sandbox-started', { sandboxId, timestamp: new Date().toISOString() });

      return sandboxInstance;
    } catch (error) {
      this.logger?.error(`Failed to start sandbox ${sandboxId}: ${error.message}`);
      this.config.updateSandbox(sandboxId, { status: 'error' });
      throw error;
    }
  }

  /**
   * Stop and tear down a sandbox
   */
  async stopSandbox(sandboxId) {
    const sandboxInstance = this.activeSandboxes.get(sandboxId);
    if (!sandboxInstance) {
      this.logger?.warn(`Sandbox not running: ${sandboxId}`);
      return false;
    }

    try {
      sandboxInstance.status = 'stopping';
      
      // Clean up any running processes
      if (sandboxInstance.executions && sandboxInstance.executions.length > 0) {
        for (const execution of sandboxInstance.executions) {
          await this._terminateExecution(execution);
        }
      }

      // Remove sandbox from active tracking
      this.activeSandboxes.delete(sandboxId);
      
      // Update sandbox status
      this.config.updateSandbox(sandboxId, {
        status: 'stopped',
        stoppedAt: new Date().toISOString()
      });

      this.logger?.info(`Stopped sandbox: ${sandboxId}`);
      this.emit('sandbox-stopped', { sandboxId, timestamp: new Date().toISOString() });

      return true;
    } catch (error) {
      this.logger?.error(`Failed to stop sandbox ${sandboxId}: ${error.message}`);
      throw error;
    }
  }

  /**
   * Execute a command within a sandbox safely
   */
  async executeInSandbox(sandboxId, command, options = {}) {
    const sandboxInstance = this.activeSandboxes.get(sandboxId);
    if (!sandboxInstance) {
      throw new Error(`Sandbox not running: ${sandboxId}`);
    }

    const sandboxConfig = this.config.getSandbox(sandboxId);
    const executionId = uuidv4();
    const execution = {
      id: executionId,
      sandboxId,
      command,
      startedAt: new Date().toISOString(),
      status: 'pending',
      output: '',
      error: '',
      exitCode: null,
      timeoutHandle: null
    };

    try {
      // Verify command against sandbox constraints
      const allowed = this._verifyCommandConstraints(command, sandboxConfig);
      if (!allowed.ok) {
        execution.status = 'rejected';
        execution.error = allowed.reason;
        this.logger?.warn(`Command rejected for sandbox ${sandboxId}: ${allowed.reason}`);
        this.emit('execution-rejected', execution);
        return execution;
      }

      execution.status = 'running';
      sandboxInstance.executions.push(executionId);
      this.emit('execution-started', execution);

      // Execute with timeout
      const timeout = sandboxConfig.execution.timeout;
      const result = await this._executeWithTimeout(command, execution, timeout);

      execution.status = 'completed';
      execution.exitCode = result.exitCode;
      execution.output = result.output;
      execution.completedAt = new Date().toISOString();

      // Update metrics
      sandboxInstance.metrics.executionsCompleted = (sandboxInstance.metrics.executionsCompleted || 0) + 1;

      this.logger?.info(`Execution completed in sandbox ${sandboxId}: ${executionId}`);
      this.emit('execution-completed', execution);

      return execution;
    } catch (error) {
      execution.status = 'error';
      execution.error = error.message;
      execution.completedAt = new Date().toISOString();

      this.logger?.error(`Execution failed in sandbox ${sandboxId}: ${error.message}`);
      this.emit('execution-error', execution);

      return execution;
    } finally {
      // Clean up timeout
      if (execution.timeoutHandle) {
        clearTimeout(execution.timeoutHandle);
      }

      // Remove from active executions
      const index = sandboxInstance.executions.indexOf(executionId);
      if (index > -1) {
        sandboxInstance.executions.splice(index, 1);
      }

      // Store in history
      const history = this.executionHistory.get(sandboxId) || [];
      history.push(execution);
      this.executionHistory.set(sandboxId, history.slice(-1000)); // Keep last 1000 executions
    }
  }

  /**
   * Get status and metrics for a sandbox
   */
  getSandboxStatus(sandboxId) {
    const instance = this.activeSandboxes.get(sandboxId);
    const config = this.config.getSandbox(sandboxId);

    if (!instance && !config) {
      return null;
    }

    return {
      id: sandboxId,
      config: config,
      instance: instance,
      isRunning: instance !== undefined,
      history: (this.executionHistory.get(sandboxId) || []).slice(-10) // Last 10 executions
    };
  }

  /**
   * Get all active sandboxes
   */
  getActiveSandboxes() {
    return Array.from(this.activeSandboxes.values());
  }

  /**
   * Verify command against sandbox constraints
   */
  _verifyCommandConstraints(command, sandboxConfig) {
    // Reject dangerous system commands
    const dangerousPatterns = [
      /rm\s+-rf\s+\//, // rm -rf /
      /dd\s+if=\/dev/, // Low-level disk write
      /mkfs/, // Format filesystem
      /fdisk/, // Partition table modification
      /etc\/shadow/, // Shadow password file
      /etc\/passwd/ // Password file
    ];

    for (const pattern of dangerousPatterns) {
      if (pattern.test(command)) {
        return {
          ok: false,
          reason: `Command contains potentially dangerous operation: ${command.substring(0, 50)}`
        };
      }
    }

    // Reject if trying to access restricted paths
    if (!sandboxConfig.isolation.hostFilesystemAccess) {
      const restrictedPaths = ['/etc', '/root', '.ssh', 'authorized_keys'];
      for (const path of restrictedPaths) {
        if (command.includes(path)) {
          return {
            ok: false,
            reason: `Command accesses restricted path: ${path}`
          };
        }
      }
    }

    // Reject if trying to access Docker socket when not allowed
    if (!sandboxConfig.isolation.dockerSocketAccess && command.includes('/var/run/docker.sock')) {
      return {
        ok: false,
        reason: 'Docker socket access not allowed in this sandbox'
      };
    }

    return { ok: true };
  }

  /**
   * Execute command with timeout
   */
  async _executeWithTimeout(command, execution, timeout) {
    return new Promise((resolve, reject) => {
      const timeoutHandle = setTimeout(() => {
        execution.error = `Command execution timeout (>${timeout}ms)`;
        this.emit('execution-timeout', execution);
        reject(new Error(execution.error));
      }, timeout);

      execution.timeoutHandle = timeoutHandle;

      // Simulate command execution (in production, would use actual shell)
      try {
        // Placeholder: In a real implementation, execute shell command
        // For MVP, we're just validating the infrastructure
        clearTimeout(timeoutHandle);
        resolve({
          exitCode: 0,
          output: `[SANDBOX] Executed: ${command}`
        });
      } catch (error) {
        clearTimeout(timeoutHandle);
        reject(error);
      }
    });
  }

  /**
   * Terminate an ongoing execution
   */
  async _terminateExecution(execution) {
    try {
      if (execution.timeoutHandle) {
        clearTimeout(execution.timeoutHandle);
      }

      execution.status = 'terminated';
      execution.completedAt = new Date().toISOString();
      
      this.logger?.debug(`Terminated execution: ${execution.id}`);
      this.emit('execution-terminated', execution);
    } catch (error) {
      this.logger?.error(`Failed to terminate execution: ${error.message}`);
    }
  }

  /**
   * Clean up all sandboxes (graceful shutdown)
   */
  async cleanup() {
    const sandboxIds = Array.from(this.activeSandboxes.keys());
    
    for (const sandboxId of sandboxIds) {
      try {
        await this.stopSandbox(sandboxId);
      } catch (error) {
        this.logger?.error(`Error cleaning up sandbox ${sandboxId}: ${error.message}`);
      }
    }

    this.logger?.info(`Cleaned up ${sandboxIds.length} sandboxes`);
  }
}

module.exports = SandboxManager;
