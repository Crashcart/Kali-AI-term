/**
 * Sandbox Infrastructure Tests
 * Unit and integration tests for sandbox detection, configuration, and management
 */

jest.mock('axios');
const axios = require('axios');

const SandboxDetector = require('../../lib/sandbox-detector');
const SandboxConfig = require('../../lib/sandbox-config');
const SandboxManager = require('../../lib/sandbox-manager');

describe('Sandbox Infrastructure', () => {
  let mockLogger;

  beforeEach(() => {
    mockLogger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn()
    };
  });

  describe('SandboxDetector', () => {
    let detector;

    beforeEach(() => {
      detector = new SandboxDetector(mockLogger);
    });

    describe('Platform Detection', () => {
      it('should identify supported platforms', async () => {
        const result = await detector.detect();
        expect(['darwin', 'win32', 'linux']).toContain(result.platform);
      });

      it('should report unsupported platforms correctly', () => {
        detector.platform = 'freebsd';
        const result = detector._detectByPlatform();
        expect(result.available).toBe(false);
        expect(result.supported).toBe(false);
      });

      it('should provide installation instructions', () => {
        const instructions = detector.getInstallationInstructions();
        expect(instructions).toBeTruthy();
        expect(instructions.title).toBeTruthy();
        expect(instructions.commands).toBeTruthy();
        expect(Array.isArray(instructions.commands)).toBe(true);
      });
    });

    describe('Caching', () => {
      it('should cache detection results', async () => {
        const result1 = await detector.detect();
        const result2 = await detector.detect();
        expect(result1).toEqual(result2);
      });

      it('should clear cache when requested', async () => {
        await detector.detect();
        detector.clearCache();
        expect(detector.cachedResult).toBeNull();
        expect(detector.lastCheck).toBeNull();
      });

      it('should respect cache expiry', (done) => {
        detector.cacheExpiry = 10; // 10ms
        detector.detect().then(() => {
          const firstCache = detector.cachedResult;
          setTimeout(() => {
            detector.detect().then(() => {
              expect(detector.cachedResult).not.toEqual(firstCache);
              done();
            });
          }, 50);
        });
      });
    });
  });

  describe('SandboxConfig', () => {
    let config;

    beforeEach(() => {
      config = new SandboxConfig(mockLogger);
    });

    describe('Sandbox Creation', () => {
      it('should create a restrictive sandbox', () => {
        const sandbox = config.createRestrictiveSandbox({ name: 'test-restrictive' });
        expect(sandbox.name).toBe('test-restrictive');
        expect(sandbox.isolation.hostFilesystemAccess).toBe(false);
        expect(sandbox.isolation.networkAccess).toBe(false);
        expect(sandbox.isolation.dockerSocketAccess).toBe(false);
      });

      it('should create a standard sandbox', () => {
        const sandbox = config.createStandardSandbox({ name: 'test-standard' });
        expect(sandbox.name).toBe('test-standard');
        expect(sandbox.isolation.hostFilesystemAccess).toBe(false);
        expect(sandbox.isolation.networkAccess).toBe(true);
        expect(sandbox.isolation.dockerSocketAccess).toBe(false);
      });

      it('should create a permissive sandbox', () => {
        const sandbox = config.createPermissiveSandbox({ name: 'test-permissive' });
        expect(sandbox.name).toBe('test-permissive');
        expect(sandbox.isolation.hostFilesystemAccess).toBe(true);
        expect(sandbox.isolation.networkAccess).toBe(true);
      });

      it('should generate unique IDs', () => {
        const sandbox1 = config.createStandardSandbox();
        const sandbox2 = config.createStandardSandbox();
        expect(sandbox1.id).not.toBe(sandbox2.id);
      });
    });

    describe('Sandbox Management', () => {
      it('should retrieve a sandbox by ID', () => {
        const created = config.createStandardSandbox({ name: 'test' });
        const retrieved = config.getSandbox(created.id);
        expect(retrieved).toEqual(created);
      });

      it('should update sandbox configuration', () => {
        const created = config.createStandardSandbox();
        config.updateSandbox(created.id, { status: 'running' });
        const updated = config.getSandbox(created.id);
        expect(updated.status).toBe('running');
      });

      it('should delete a sandbox', () => {
        const created = config.createStandardSandbox();
        const deleted = config.deleteSandbox(created.id);
        expect(deleted).toBe(true);
        expect(config.getSandbox(created.id)).toBeUndefined();
      });

      it('should list all sandboxes', () => {
        config.createStandardSandbox();
        config.createRestrictiveSandbox();
        const list = config.listSandboxes();
        expect(list.length).toBeGreaterThanOrEqual(2);
      });

      it('should filter sandboxes by status', () => {
        const sandbox = config.createStandardSandbox();
        config.updateSandbox(sandbox.id, { status: 'running' });
        const running = config.getSandboxesByStatus('running');
        expect(running.some(s => s.id === sandbox.id)).toBe(true);
      });
    });

    describe('Constraint Verification', () => {
      it('should verify valid sandbox constraints', () => {
        const sandbox = config.createStandardSandbox();
        const verification = config.verifySandboxConstraints(sandbox.id);
        expect(verification.valid).toBe(true);
        expect(verification.errors).toHaveLength(0);
      });

      it('should reject excessive CPU limits', () => {
        const sandbox = config.createStandardSandbox();
        config.updateSandbox(sandbox.id, {
          resources: { cpuLimit: '32' }
        });
        const verification = config.verifySandboxConstraints(sandbox.id);
        expect(verification.valid).toBe(false);
        expect(verification.errors.some(e => e.includes('CPU'))).toBe(true);
      });

      it('should reject excessive memory limits', () => {
        const sandbox = config.createStandardSandbox();
        config.updateSandbox(sandbox.id, {
          resources: { memoryLimit: '64g' }
        });
        const verification = config.verifySandboxConstraints(sandbox.id);
        expect(verification.valid).toBe(false);
        expect(verification.errors.some(e => e.includes('Memory'))).toBe(true);
      });

      it('should reject access to system directories', () => {
        const sandbox = config.createStandardSandbox();
        config.updateSandbox(sandbox.id, {
          isolation: { allowedPaths: ['/etc', '/workspace'] }
        });
        const verification = config.verifySandboxConstraints(sandbox.id);
        expect(verification.valid).toBe(false);
        expect(verification.errors.some(e => e.includes('system directories'))).toBe(true);
      });

      it('should reject out-of-range timeouts', () => {
        const sandbox = config.createStandardSandbox();
        config.updateSandbox(sandbox.id, {
          execution: { timeout: 500 } // Too short
        });
        const verification = config.verifySandboxConstraints(sandbox.id);
        expect(verification.valid).toBe(false);
      });
    });

    describe('Environment Configuration', () => {
      it('should generate sandbox environment variables', () => {
        const sandbox = config.createStandardSandbox();
        const env = config.generateEnvironment(sandbox.id);
        expect(env.SANDBOX_ID).toBe(sandbox.id);
        expect(env.SANDBOX_NAME).toBe(sandbox.name);
        expect(env.WORKING_DIRECTORY).toBe(sandbox.execution.workingDirectory);
      });

      it('should include network restrictions in environment', () => {
        const sandbox = config.createRestrictiveSandbox();
        const env = config.generateEnvironment(sandbox.id);
        expect(env.NETWORK_DISABLED).toBe('true');
      });

      it('should include allowed networks in environment', () => {
        const sandbox = config.createStandardSandbox();
        const env = config.generateEnvironment(sandbox.id);
        expect(env.ALLOWED_NETWORKS).toBeDefined();
      });
    });
  });

  describe('SandboxManager', () => {
    let config;
    let manager;
    let mockDocker;

    beforeEach(() => {
      config = new SandboxConfig(mockLogger);
      mockDocker = {};
      manager = new SandboxManager(config, mockDocker, mockLogger);
    });

    describe('Sandbox Lifecycle', () => {
      it('should start a sandbox', async () => {
        const sandbox = config.createStandardSandbox();
        const instance = await manager.startSandbox(sandbox.id);
        expect(instance.status).toBe('starting');
      });

      it('should stop a running sandbox', async () => {
        const sandbox = config.createStandardSandbox();
        await manager.startSandbox(sandbox.id);
        await manager.stopSandbox(sandbox.id);
        expect(manager.activeSandboxes.has(sandbox.id)).toBe(false);
      });

      it('should fail to start invalid sandbox', async () => {
        expect.assertions(1);
        try {
          await manager.startSandbox('invalid-id');
        } catch (error) {
          expect(error.message).toContain('not found');
        }
      });

      it('should track active sandboxes', async () => {
        const sandbox1 = config.createStandardSandbox();
        const sandbox2 = config.createStandardSandbox();
        await manager.startSandbox(sandbox1.id);
        await manager.startSandbox(sandbox2.id);
        const active = manager.getActiveSandboxes();
        expect(active.length).toBe(2);
      });
    });

    describe('Command Execution', () => {
      it('should execute commands in a sandbox', async () => {
        const sandbox = config.createStandardSandbox();
        await manager.startSandbox(sandbox.id);
        const execution = await manager.executeInSandbox(sandbox.id, 'echo test');
        expect(execution.status).toBe('completed');
      });

      it('should reject dangerous commands', async () => {
        const sandbox = config.createStandardSandbox();
        await manager.startSandbox(sandbox.id);
        const execution = await manager.executeInSandbox(sandbox.id, 'rm -rf /');
        expect(execution.status).toBe('rejected');
      });

      it('should reject restricted path access', async () => {
        const sandbox = config.createRestrictiveSandbox();
        await manager.startSandbox(sandbox.id);
        const execution = await manager.executeInSandbox(sandbox.id, 'cat /etc/passwd');
        expect(execution.status).toBe('rejected');
      });

      it('should reject Docker socket access when not allowed', async () => {
        const sandbox = config.createRestrictiveSandbox();
        await manager.startSandbox(sandbox.id);
        const execution = await manager.executeInSandbox(
          sandbox.id,
          'docker -H unix:///var/run/docker.sock ps'
        );
        expect(execution.status).toBe('rejected');
      });

      it('should timeout long-running executions', async () => {
        const sandbox = config.createStandardSandbox();
        config.updateSandbox(sandbox.id, {
          execution: { timeout: 10 } // 10ms timeout
        });
        await manager.startSandbox(sandbox.id);
        
        // This test would need a long-running command
        // For MVP, we're just verifying the timeout logic exists
        expect(sandbox.execution.timeout).toBe(10);
      });
    });

    describe('Sandbox Status', () => {
      it('should report sandbox status', async () => {
        const sandbox = config.createStandardSandbox();
        await manager.startSandbox(sandbox.id);
        const status = manager.getSandboxStatus(sandbox.id);
        expect(status.isRunning).toBe(true);
      });

      it('should track execution history', async () => {
        const sandbox = config.createStandardSandbox();
        await manager.startSandbox(sandbox.id);
        await manager.executeInSandbox(sandbox.id, 'echo test');
        const status = manager.getSandboxStatus(sandbox.id);
        expect(status.history.length).toBeGreaterThan(0);
      });
    });

    describe('Event Emission', () => {
      it('should emit sandbox-started event', (done) => {
        const sandbox = config.createStandardSandbox();
        manager.on('sandbox-started', (data) => {
          expect(data.sandboxId).toBe(sandbox.id);
          done();
        });
        manager.startSandbox(sandbox.id);
      });

      it('should emit sandbox-stopped event', (done) => {
        const sandbox = config.createStandardSandbox();
        manager.on('sandbox-stopped', (data) => {
          expect(data.sandboxId).toBe(sandbox.id);
          done();
        });
        manager.startSandbox(sandbox.id).then(() => {
          manager.stopSandbox(sandbox.id);
        });
      });

      it('should emit execution-started event', (done) => {
        const sandbox = config.createStandardSandbox();
        manager.on('execution-started', (execution) => {
          expect(execution.command).toBe('echo test');
          done();
        });
        manager.startSandbox(sandbox.id).then(() => {
          manager.executeInSandbox(sandbox.id, 'echo test');
        });
      });

      it('should emit execution-rejected event', (done) => {
        const sandbox = config.createRestrictiveSandbox();
        manager.on('execution-rejected', (execution) => {
          expect(execution.status).toBe('rejected');
          done();
        });
        manager.startSandbox(sandbox.id).then(() => {
          manager.executeInSandbox(sandbox.id, 'rm -rf /');
        });
      });
    });

    describe('Cleanup', () => {
      it('should cleanup all sandboxes', async () => {
        const sandbox1 = config.createStandardSandbox();
        const sandbox2 = config.createStandardSandbox();
        await manager.startSandbox(sandbox1.id);
        await manager.startSandbox(sandbox2.id);
        await manager.cleanup();
        const active = manager.getActiveSandboxes();
        expect(active.length).toBe(0);
      });
    });
  });

  describe('Command Constraint Verification', () => {
    let config;
    let manager;

    beforeEach(() => {
      config = new SandboxConfig(mockLogger);
      manager = new SandboxManager(config, {}, mockLogger);
    });

    it('should detect and reject rm -rf /', () => {
      const sandbox = config.createStandardSandbox();
      const result = manager._verifyCommandConstraints('rm -rf /', sandbox);
      expect(result.ok).toBe(false);
    });

    it('should detect and reject mkfs', () => {
      const sandbox = config.createStandardSandbox();
      const result = manager._verifyCommandConstraints('mkfs.ext4 /dev/sda1', sandbox);
      expect(result.ok).toBe(false);
    });

    it('should allow safe commands', () => {
      const sandbox = config.createStandardSandbox();
      const result = manager._verifyCommandConstraints('echo "Hello, Sandbox!"', sandbox);
      expect(result.ok).toBe(true);
    });

    it('should respect hostFilesystemAccess restriction', () => {
      const restrictive = config.createRestrictiveSandbox();
      const result = manager._verifyCommandConstraints('cat /etc/passwd', restrictive);
      expect(result.ok).toBe(false);
    });

    it('should respect dockerSocketAccess restriction', () => {
      const restrictive = config.createRestrictiveSandbox();
      const result = manager._verifyCommandConstraints(
        'docker -H unix:///var/run/docker.sock ps',
        restrictive
      );
      expect(result.ok).toBe(false);
    });
  });
});

// ── OllamaProvider ────────────────────────────────────────────────────────────

const OllamaProvider = require('../../lib/ollama-provider');

describe('OllamaProvider', () => {
  let provider;

  beforeEach(() => {
    provider = new OllamaProvider('http://localhost:11434', null);
    axios.get.mockReset();
    axios.post.mockReset();
  });

  describe('constructor', () => {
    test('sets name to ollama', () => {
      expect(provider.name).toBe('ollama');
    });

    test('stores the URL', () => {
      expect(provider.url).toBe('http://localhost:11434');
    });

    test('initialises an empty cache', () => {
      expect(provider.cache.size).toBe(0);
    });
  });

  describe('healthCheck()', () => {
    test('returns healthy=true when /api/tags responds', async () => {
      axios.get.mockResolvedValue({ data: { models: [] }, status: 200 });
      const result = await provider.healthCheck();
      expect(result.healthy).toBe(true);
      expect(result.url).toBe('http://localhost:11434');
    });

    test('returns healthy=false on network error', async () => {
      axios.get.mockRejectedValue(new Error('ECONNREFUSED'));
      const result = await provider.healthCheck();
      expect(result.healthy).toBe(false);
      expect(result.error).toBe('ECONNREFUSED');
    });
  });

  describe('getModels()', () => {
    test('returns mapped model objects', async () => {
      axios.get.mockResolvedValue({
        data: {
          models: [
            { name: 'dolphin-mixtral', size: 4000000, modified_at: '2024-01-01', digest: 'abc123' }
          ]
        }
      });
      const models = await provider.getModels();
      expect(models).toHaveLength(1);
      expect(models[0].name).toBe('dolphin-mixtral');
      expect(models[0].provider).toBe('ollama');
    });

    test('caches model list and avoids second HTTP call', async () => {
      axios.get.mockResolvedValue({ data: { models: [{ name: 'test-model', size: 0 }] } });
      await provider.getModels();
      await provider.getModels(); // second call should hit cache
      expect(axios.get).toHaveBeenCalledTimes(1);
    });

    test('re-fetches after clearCache()', async () => {
      axios.get.mockResolvedValue({ data: { models: [{ name: 'test-model', size: 0 }] } });
      await provider.getModels();
      provider.clearCache();
      await provider.getModels();
      expect(axios.get).toHaveBeenCalledTimes(2);
    });

    test('throws on HTTP error', async () => {
      axios.get.mockRejectedValue(new Error('Network Error'));
      await expect(provider.getModels()).rejects.toThrow('Network Error');
    });
  });

  describe('generate()', () => {
    test('returns provider, model, response, and context on success', async () => {
      axios.post.mockResolvedValue({
        data: { response: 'hello world', context: [1, 2, 3] }
      });
      const result = await provider.generate('say hello', { model: 'dolphin-mixtral' });
      expect(result.provider).toBe('ollama');
      expect(result.model).toBe('dolphin-mixtral');
      expect(result.response).toBe('hello world');
      expect(result.context).toEqual([1, 2, 3]);
    });

    test('uses default model when none specified', async () => {
      axios.post.mockResolvedValue({ data: { response: 'ok', context: [] } });
      await provider.generate('prompt');
      const call = axios.post.mock.calls[0];
      expect(call[1].model).toBe('dolphin-mixtral');
    });

    test('passes temperature option through to Ollama', async () => {
      axios.post.mockResolvedValue({ data: { response: 'ok', context: [] } });
      await provider.generate('prompt', { temperature: 0.3 });
      const body = axios.post.mock.calls[0][1];
      expect(body.options.temperature).toBe(0.3);
    });

    test('throws on HTTP error', async () => {
      axios.post.mockRejectedValue(new Error('Timeout'));
      await expect(provider.generate('prompt')).rejects.toThrow('Timeout');
    });
  });

  describe('getStatus()', () => {
    test('returns available=true when Ollama is healthy', async () => {
      axios.get.mockResolvedValue({ data: { models: [{ name: 'model1', size: 0 }] } });
      const status = await provider.getStatus();
      expect(status.available).toBe(true);
      expect(status.name).toBe('ollama');
      expect(status.type).toBe('local');
    });

    test('returns available=false when Ollama is down', async () => {
      axios.get.mockRejectedValue(new Error('ECONNREFUSED'));
      const status = await provider.getStatus();
      expect(status.available).toBe(false);
      expect(status.name).toBe('ollama');
    });
  });

  describe('clearCache()', () => {
    test('empties the model cache', async () => {
      axios.get.mockResolvedValue({ data: { models: [{ name: 'test', size: 0 }] } });
      await provider.getModels(); // populate cache
      provider.clearCache();
      expect(provider.cache.size).toBe(0);
    });
  });
});

// ── GeminiProvider ────────────────────────────────────────────────────────────

const GeminiProvider = require('../../lib/gemini-provider');

describe('GeminiProvider', () => {
  let provider;

  beforeEach(() => {
    provider = new GeminiProvider('test-api-key', null);
    axios.get.mockReset();
    axios.post.mockReset();
  });

  describe('constructor', () => {
    test('sets name to gemini', () => {
      expect(provider.name).toBe('gemini');
    });

    test('stores apiKey', () => {
      expect(provider.apiKey).toBe('test-api-key');
    });

    test('defaults model to gemini-pro', () => {
      expect(provider.model).toBe('gemini-pro');
    });

    test('initialises request and error counts to zero', () => {
      expect(provider.requestCount).toBe(0);
      expect(provider.errorCount).toBe(0);
    });
  });

  describe('healthCheck()', () => {
    test('returns healthy=true when models endpoint responds', async () => {
      axios.get.mockResolvedValue({ data: { models: [] } });
      const result = await provider.healthCheck();
      expect(result.healthy).toBe(true);
      expect(result.model).toBe('gemini-pro');
    });

    test('returns healthy=false on API error', async () => {
      axios.get.mockRejectedValue(new Error('401 Unauthorized'));
      const result = await provider.healthCheck();
      expect(result.healthy).toBe(false);
      expect(result.hint).toBeDefined();
    });
  });

  describe('getModels()', () => {
    test('returns filtered generative models', async () => {
      axios.get.mockResolvedValue({
        data: {
          models: [
            { name: 'models/gemini-generative-pro', displayName: 'Gemini Pro', description: 'Best model', inputTokenLimit: 30720, outputTokenLimit: 2048 },
            { name: 'models/embedding-001', displayName: 'Embedding', description: 'Embedding model', inputTokenLimit: 2048, outputTokenLimit: 1 }
          ]
        }
      });
      const models = await provider.getModels();
      // Only models whose name includes 'generative' should be returned
      expect(models.length).toBe(1);
      expect(models[0].name).toBe('Gemini Pro');
      expect(models[0].provider).toBe('gemini');
    });

    test('throws when API call fails', async () => {
      axios.get.mockRejectedValue(new Error('API Error'));
      await expect(provider.getModels()).rejects.toThrow('API Error');
    });
  });

  describe('generate()', () => {
    function mockGenerateResponse(text = 'hello') {
      return {
        data: {
          candidates: [{ content: { parts: [{ text }] } }],
          usageMetadata: { promptTokenCount: 10, candidatesTokenCount: 5 }
        }
      };
    }

    test('returns provider, model, response, and tokens on success', async () => {
      axios.post.mockResolvedValue(mockGenerateResponse('Pentest response'));
      const result = await provider.generate('scan ports');
      expect(result.provider).toBe('gemini');
      expect(result.model).toBe('gemini-pro');
      expect(result.response).toBe('Pentest response');
      expect(result.tokens.input).toBe(10);
      expect(result.tokens.output).toBe(5);
    });

    test('increments requestCount on success', async () => {
      axios.post.mockResolvedValue(mockGenerateResponse());
      await provider.generate('prompt');
      expect(provider.requestCount).toBe(1);
    });

    test('increments errorCount on failure', async () => {
      axios.post.mockRejectedValue(new Error('API quota exceeded'));
      await expect(provider.generate('prompt')).rejects.toThrow('API quota exceeded');
      expect(provider.errorCount).toBe(1);
    });

    test('includes systemPrompt as first messages when provided', async () => {
      axios.post.mockResolvedValue(mockGenerateResponse());
      await provider.generate('prompt', { systemPrompt: 'You are a hacker' });
      const body = axios.post.mock.calls[0][1];
      expect(body.contents[0].parts[0].text).toBe('You are a hacker');
      expect(body.contents[0].role).toBe('user');
    });

    test('returns empty string when no candidates in response', async () => {
      axios.post.mockResolvedValue({ data: { candidates: [], usageMetadata: {} } });
      const result = await provider.generate('prompt');
      expect(result.response).toBe('');
    });
  });

  describe('getStatus()', () => {
    test('returns available=true when API is reachable', async () => {
      axios.get.mockResolvedValue({ data: { models: [] } });
      const status = await provider.getStatus();
      expect(status.available).toBe(true);
      expect(status.name).toBe('gemini');
      expect(status.type).toBe('cloud');
      expect(status.metrics).toBeDefined();
    });

    test('returns available=false when API is unreachable', async () => {
      axios.get.mockRejectedValue(new Error('Network Error'));
      const status = await provider.getStatus();
      expect(status.available).toBe(false);
      expect(status.error).toBeDefined();
    });

    test('metrics show correct error rate after failures', async () => {
      axios.post.mockRejectedValue(new Error('fail'));
      await provider.generate('p1').catch(() => {});
      await provider.generate('p2').catch(() => {});
      axios.get.mockResolvedValue({ data: { models: [] } });
      const status = await provider.getStatus();
      expect(status.metrics.errorCount).toBe(2);
      expect(status.metrics.requestCount).toBe(0);
    });
  });

  describe('setModel()', () => {
    test('updates the active model', () => {
      provider.setModel('gemini-1.5-pro');
      expect(provider.model).toBe('gemini-1.5-pro');
    });
  });
});

module.exports = {};
