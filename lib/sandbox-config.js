/**
 * Sandbox Configuration Manager
 * Manages isolated execution environments for autonomous AI agent operations
 */

const { v4: uuidv4 } = require('uuid');
const fs = require('fs');
const path = require('path');
const os = require('os');

class SandboxConfig {
  constructor(logger) {
    this.logger = logger;
    this.sandboxes = new Map();
    this.configDir = path.join(os.homedir(), '.kali-ai-term', 'sandboxes');
    this._ensureConfigDir();
  }

  /**
   * Create a new isolated sandbox configuration
   */
  createSandbox(options = {}) {
    const sandboxId = uuidv4();
    const config = {
      id: sandboxId,
      name: options.name || `sandbox-${sandboxId.substring(0, 8)}`,
      createdAt: new Date().toISOString(),
      status: 'created',
      
      // Isolation settings
      isolation: {
        hostFilesystemAccess: options.hostFilesystemAccess || false,
        allowedPaths: options.allowedPaths || [],
        networkAccess: options.networkAccess !== false, // true by default
        allowedNetworks: options.allowedNetworks || ['127.0.0.1'],
        dockerSocketAccess: options.dockerSocketAccess || false,
        environmentVariables: options.environmentVariables || {}
      },

      // Resource limits
      resources: {
        cpuLimit: options.cpuLimit || '2',
        memoryLimit: options.memoryLimit || '2g',
        diskLimit: options.diskLimit || '10g',
        processLimit: options.processLimit || 100
      },

      // Security constraints
      security: {
        readOnlyFilesystem: options.readOnlyFilesystem || false,
        dropCapabilities: options.dropCapabilities || [
          'SYS_ADMIN',
          'SYS_PTRACE',
          'NET_ADMIN',
          'SYS_MODULE'
        ],
        seccompProfile: options.seccompProfile || 'default',
        noNewPrivileges: options.noNewPrivileges !== false // true by default
      },

      // Execution context
      execution: {
        workingDirectory: options.workingDirectory || '/workspace',
        user: options.user || 'agent',
        timeout: options.timeout || 3600000, // 1 hour
        autoCleanup: options.autoCleanup !== false // true by default
      },

      // Logging and observability
      observability: {
        enableLogging: options.enableLogging !== false,
        logLevel: options.logLevel || 'info',
        captureOutput: options.captureOutput !== false,
        metricsCollection: options.metricsCollection !== false
      }
    };

    this.sandboxes.set(sandboxId, config);
    this._persistConfig(sandboxId, config);
    
    this.logger?.info(`Created sandbox: ${sandboxId} (${config.name})`);
    
    return config;
  }

  /**
   * Get a sandbox configuration by ID
   */
  getSandbox(sandboxId) {
    return this.sandboxes.get(sandboxId);
  }

  /**
   * Update sandbox configuration
   */
  updateSandbox(sandboxId, updates) {
    const config = this.sandboxes.get(sandboxId);
    if (!config) {
      throw new Error(`Sandbox not found: ${sandboxId}`);
    }

    const updatedConfig = {
      ...config,
      ...updates,
      isolation: {
        ...config.isolation,
        ...(updates.isolation || {})
      },
      resources: {
        ...config.resources,
        ...(updates.resources || {})
      },
      security: {
        ...config.security,
        ...(updates.security || {})
      },
      execution: {
        ...config.execution,
        ...(updates.execution || {})
      },
      observability: {
        ...config.observability,
        ...(updates.observability || {})
      }
    };
    this.sandboxes.set(sandboxId, updatedConfig);
    this._persistConfig(sandboxId, updatedConfig);
    
    this.logger?.info(`Updated sandbox: ${sandboxId}`);
    
    return updatedConfig;
  }

  /**
   * Delete a sandbox configuration
   */
  deleteSandbox(sandboxId) {
    const config = this.sandboxes.get(sandboxId);
    if (!config) {
      return false;
    }

    this.sandboxes.delete(sandboxId);
    this._deletePersistedConfig(sandboxId);
    
    this.logger?.info(`Deleted sandbox: ${sandboxId}`);
    
    return true;
  }

  /**
   * List all sandboxes
   */
  listSandboxes() {
    return Array.from(this.sandboxes.values());
  }

  /**
   * Get sandboxes filtered by status
   */
  getSandboxesByStatus(status) {
    return Array.from(this.sandboxes.values()).filter(s => s.status === status);
  }

  /**
   * Create a restrictive sandbox for untrusted operations
   * This is the most secure preset
   */
  createRestrictiveSandbox(options = {}) {
    return this.createSandbox({
      name: options.name || 'restrictive-sandbox',
      hostFilesystemAccess: false,
      allowedPaths: ['/workspace'], // Only workspace directory
      networkAccess: false, // No network access
      dockerSocketAccess: false,
      readOnlyFilesystem: false,
      processLimit: 50,
      cpuLimit: '1',
      memoryLimit: '1g',
      ...options
    });
  }

  /**
   * Create a standard sandbox for agent execution
   * Balanced security and functionality
   */
  createStandardSandbox(options = {}) {
    return this.createSandbox({
      name: options.name || 'standard-sandbox',
      hostFilesystemAccess: false,
      allowedPaths: ['/workspace', '/tmp'],
      networkAccess: true,
      allowedNetworks: ['127.0.0.1', '::1'], // Only localhost
      dockerSocketAccess: false,
      processLimit: 100,
      cpuLimit: '2',
      memoryLimit: '2g',
      ...options
    });
  }

  /**
   * Create a permissive sandbox for development
   * Higher functionality, lower security
   */
  createPermissiveSandbox(options = {}) {
    return this.createSandbox({
      name: options.name || 'permissive-sandbox',
      hostFilesystemAccess: true, // Allow host filesystem (but restricted)
      allowedPaths: ['/workspace', '/tmp', '/home', '/var/tmp'],
      networkAccess: true,
      allowedNetworks: ['0.0.0.0/0'], // All networks
      dockerSocketAccess: false,
      processLimit: 200,
      cpuLimit: '4',
      memoryLimit: '4g',
      readOnlyFilesystem: false,
      ...options
    });
  }

  /**
   * Verify security constraints before sandbox execution
   */
  verifySandboxConstraints(sandboxId) {
    const config = this.getSandbox(sandboxId);
    if (!config) {
      return { valid: false, errors: ['Sandbox not found'] };
    }

    const errors = [];

    // Verify resource limits are reasonable
    const cpuMatch = config.resources.cpuLimit.match(/^(\d+)$/);
    if (!cpuMatch || parseInt(cpuMatch[1]) > 16) {
      errors.push('CPU limit exceeded (max 16)');
    }

    const memMatch = config.resources.memoryLimit.match(/^(\d+)([gmk])$/i);
    if (!memMatch || (memMatch[2].toLowerCase() === 'g' && parseInt(memMatch[1]) > 32)) {
      errors.push('Memory limit exceeded (max 32g)');
    }

    // Verify allowed paths don't include system directories
    const restrictedPaths = ['/etc', '/root', '/sys', '/proc', '/dev', '/boot'];
    const conflictingPaths = config.isolation.allowedPaths.filter(p =>
      restrictedPaths.some(rp => p.startsWith(rp))
    );
    if (conflictingPaths.length > 0) {
      errors.push(`Allowed paths include restricted system directories: ${conflictingPaths.join(', ')}`);
    }

    // Verify timeout is reasonable
    if (config.execution.timeout < 1 || config.execution.timeout > 86400000) {
      errors.push('Execution timeout out of range (1ms - 24h)');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Generate environment variables for sandbox execution
   */
  generateEnvironment(sandboxId) {
    const config = this.getSandbox(sandboxId);
    if (!config) {
      return {};
    }

    const env = {
      ...config.isolation.environmentVariables,
      SANDBOX_ID: sandboxId,
      SANDBOX_NAME: config.name,
      WORKING_DIRECTORY: config.execution.workingDirectory,
      LOG_LEVEL: config.observability.logLevel
    };

    // Add network restrictions if applicable
    if (!config.isolation.networkAccess) {
      env.NETWORK_DISABLED = 'true';
      env.ALLOWED_NETWORKS = '';
    } else if (config.isolation.allowedNetworks.length > 0) {
      env.ALLOWED_NETWORKS = config.isolation.allowedNetworks.join(',');
    }

    return env;
  }

  /**
   * Ensure configuration directory exists
   */
  _ensureConfigDir() {
    if (!fs.existsSync(this.configDir)) {
      fs.mkdirSync(this.configDir, { recursive: true });
      this.logger?.debug(`Created sandbox config directory: ${this.configDir}`);
    }
  }

  /**
   * Persist sandbox configuration to file
   */
  _persistConfig(sandboxId, config) {
    try {
      const configPath = path.join(this.configDir, `${sandboxId}.json`);
      fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
    } catch (error) {
      this.logger?.warn(`Failed to persist sandbox config: ${error.message}`);
    }
  }

  /**
   * Delete persisted sandbox configuration
   */
  _deletePersistedConfig(sandboxId) {
    try {
      const configPath = path.join(this.configDir, `${sandboxId}.json`);
      if (fs.existsSync(configPath)) {
        fs.unlinkSync(configPath);
      }
    } catch (error) {
      this.logger?.warn(`Failed to delete persisted sandbox config: ${error.message}`);
    }
  }

  /**
   * Load all persisted configurations from disk
   */
  loadPersistedConfigs() {
    try {
      if (!fs.existsSync(this.configDir)) {
        return;
      }

      const files = fs.readdirSync(this.configDir).filter(f => f.endsWith('.json'));
      for (const file of files) {
        try {
          const configPath = path.join(this.configDir, file);
          const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
          this.sandboxes.set(config.id, config);
        } catch (error) {
          this.logger?.warn(`Failed to load sandbox config ${file}: ${error.message}`);
        }
      }
    } catch (error) {
      this.logger?.warn(`Failed to load persisted configs: ${error.message}`);
    }
  }
}

module.exports = SandboxConfig;
