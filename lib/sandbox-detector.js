/**
 * Sandbox Detector
 * Detects and verifies Docker Sandboxes availability on the system
 */

const { execSync } = require('child_process');
const os = require('os');
const path = require('path');
const fs = require('fs');

class SandboxDetector {
  constructor(logger) {
    this.logger = logger;
    this.platform = os.platform();
    this.sandboxAvailable = false;
    this.sandboxVersion = null;
    this.sandboxBinPath = null;
    this.cacheExpiry = 5 * 60 * 1000; // 5 minutes
    this.lastCheck = null;
    this.cachedResult = null;
  }

  /**
   * Detect if Docker Sandboxes are available on the system
   * Supports macOS and Windows platforms
   */
  async detect() {
    // Return cached result if still valid
    if (this.cachedResult && this.lastCheck && Date.now() - this.lastCheck < this.cacheExpiry) {
      return this.cachedResult;
    }

    try {
      const result = this._detectByPlatform();
      result.detectedAt = Date.now();
      this.cachedResult = result;
      this.lastCheck = Date.now();
      return result;
    } catch (error) {
      this.logger?.warn(`Sandbox detection failed: ${error.message}`);
      return {
        available: false,
        platform: this.platform,
        error: error.message,
        supported: this._isSupported()
      };
    }
  }

  /**
   * Platform-specific detection logic
   */
  _detectByPlatform() {
    if (this.platform === 'darwin') {
      return this._detectMacOS();
    } else if (this.platform === 'win32') {
      return this._detectWindows();
    } else if (this.platform === 'linux') {
      return this._detectLinux();
    }
    
    return {
      available: false,
      platform: this.platform,
      error: `Unsupported platform: ${this.platform}`,
      supported: false
    };
  }

  /**
   * Detect Docker Sandboxes on macOS
   * Installation: brew install docker/tap/sbx
   */
  _detectMacOS() {
    try {
      // Check for Docker Sandboxes binary
      const sbxPath = '/usr/local/bin/docker-sbx';
      if (fs.existsSync(sbxPath)) {
        try {
          const version = execSync(`${sbxPath} version`, { encoding: 'utf8' }).trim();
          this.sandboxBinPath = sbxPath;
          this.sandboxVersion = version;
          this.sandboxAvailable = true;
          
          this.logger?.info(`Docker Sandboxes detected on macOS: ${version}`);
          
          return {
            available: true,
            platform: 'darwin',
            version: version,
            binPath: sbxPath,
            installCommand: 'brew install docker/tap/sbx'
          };
        } catch (error) {
          this.logger?.warn(`Found Docker Sandboxes binary but version check failed: ${error.message}`);
        }
      }

      // Fallback: Check if Homebrew formula exists
      try {
        execSync('brew list docker/tap/sbx 2>/dev/null', { encoding: 'utf8' });
        this.logger?.info(`Docker Sandboxes formula found via Homebrew on macOS`);
        
        return {
          available: true,
          platform: 'darwin',
          installCommand: 'brew install docker/tap/sbx'
        };
      } catch (error) {
        // Sandboxes not installed
      }

      return {
        available: false,
        platform: 'darwin',
        error: 'Docker Sandboxes not installed',
        supported: true,
        installCommand: 'brew install docker/tap/sbx'
      };
    } catch (error) {
      return {
        available: false,
        platform: 'darwin',
        error: error.message,
        supported: true,
        installCommand: 'brew install docker/tap/sbx'
      };
    }
  }

  /**
   * Detect Docker Sandboxes on Windows
   * Installation: winget install Docker.sbx
   */
  _detectWindows() {
    try {
      // Check Program Files
      const windowsPaths = [
        path.join(process.env.ProgramFiles, 'Docker', 'docker-sbx.exe'),
        path.join(process.env.ProgramFiles, 'Docker Desktop', 'docker-sbx.exe'),
        path.join(process.env.ProgramW6432, 'Docker', 'docker-sbx.exe')
      ];

      for (const sbxPath of windowsPaths.filter(Boolean)) {
        if (fs.existsSync(sbxPath)) {
          try {
            const version = execSync(`"${sbxPath}" version`, { encoding: 'utf8' }).trim();
            this.sandboxBinPath = sbxPath;
            this.sandboxVersion = version;
            this.sandboxAvailable = true;
            
            this.logger?.info(`Docker Sandboxes detected on Windows: ${version}`);
            
            return {
              available: true,
              platform: 'win32',
              version: version,
              binPath: sbxPath,
              installCommand: 'winget install Docker.sbx'
            };
          } catch (error) {
            this.logger?.warn(`Found Docker Sandboxes binary but version check failed: ${error.message}`);
          }
        }
      }

      return {
        available: false,
        platform: 'win32',
        error: 'Docker Sandboxes not installed',
        supported: true,
        installCommand: 'winget install Docker.sbx'
      };
    } catch (error) {
      return {
        available: false,
        platform: 'win32',
        error: error.message,
        supported: true,
        installCommand: 'winget install Docker.sbx'
      };
    }
  }

  /**
   * Detect Docker Sandboxes on Linux
   * Note: Docker Sandboxes are experimental on Linux
   */
  _detectLinux() {
    try {
      // Check if docker-sbx command exists
      try {
        const version = execSync('docker-sbx version', { encoding: 'utf8' }).trim();
        this.sandboxBinPath = 'docker-sbx';
        this.sandboxVersion = version;
        this.sandboxAvailable = true;
        
        this.logger?.info(`Docker Sandboxes detected on Linux: ${version}`);
        
        return {
          available: true,
          platform: 'linux',
          version: version,
          binPath: 'docker-sbx',
          installCommand: 'docker plugin install docker/sbx:latest'
        };
      } catch (error) {
        // Command not found
      }

      return {
        available: false,
        platform: 'linux',
        error: 'Docker Sandboxes not installed or not supported',
        supported: true,
        installCommand: 'docker plugin install docker/sbx:latest'
      };
    } catch (error) {
      return {
        available: false,
        platform: 'linux',
        error: error.message,
        supported: true
      };
    }
  }

  /**
   * Check if platform supports Docker Sandboxes
   */
  _isSupported() {
    return ['darwin', 'win32', 'linux'].includes(this.platform);
  }

  /**
   * Get installation instructions for the current platform
   */
  getInstallationInstructions() {
    const instructions = {
      darwin: {
        title: 'Install Docker Sandboxes on macOS',
        commands: [
          'brew tap docker/tap',
          'brew install docker/tap/sbx',
          'docker-sbx --version'
        ]
      },
      win32: {
        title: 'Install Docker Sandboxes on Windows',
        commands: [
          'winget install Docker.sbx',
          'docker-sbx --version'
        ]
      },
      linux: {
        title: 'Install Docker Sandboxes on Linux',
        commands: [
          'docker plugin install docker/sbx:latest',
          'docker-sbx --version'
        ]
      }
    };

    return instructions[this.platform] || null;
  }

  /**
   * Clear the detection cache
   */
  clearCache() {
    this.cachedResult = null;
    this.lastCheck = null;
  }
}

module.exports = SandboxDetector;
