/**
 * Plugin Manager Unit Tests
 */

class PluginManager {
  constructor() {
    this.plugins = new Map();
    this.hooks = new Map();
  }

  register(name, plugin) {
    if (this.plugins.has(name)) {
      console.warn(`Plugin ${name} already registered`);
      return false;
    }
    this.plugins.set(name, plugin);
    return true;
  }

  enable(name) {
    const plugin = this.plugins.get(name);
    if (plugin) {
      plugin.enabled = true;
      return true;
    }
    return false;
  }

  disable(name) {
    const plugin = this.plugins.get(name);
    if (plugin) {
      plugin.enabled = false;
      return true;
    }
    return false;
  }

  async execute(hookName, data) {
    const hooks = this.hooks.get(hookName) || [];
    let result = data;

    for (const hook of hooks) {
      try {
        if (hook.enabled) {
          result = await hook.execute(result);
        }
      } catch (err) {
        console.error(`Hook error in ${hookName}:`, err.message);
      }
    }

    return result;
  }

  registerHook(hookName, plugin, execute) {
    if (!this.hooks.has(hookName)) {
      this.hooks.set(hookName, []);
    }
    this.hooks.get(hookName).push({
      plugin,
      execute,
      enabled: true
    });
  }

  getPlugins() {
    return Array.from(this.plugins.values());
  }
}

describe('Plugin Manager', () => {
  let pluginManager;

  beforeEach(() => {
    pluginManager = new PluginManager();
  });

  test('register plugin correctly', () => {
    const testPlugin = { name: 'test', version: '1.0', enabled: false, hooks: {} };
    const result = pluginManager.register('test', testPlugin);

    expect(result).toBe(true);
    expect(pluginManager.plugins.has('test')).toBe(true);
    expect(pluginManager.plugins.get('test').name).toBe('test');
  });

  test('prevent duplicate plugin registration', () => {
    const plugin = { name: 'test', version: '1.0', enabled: false };
    pluginManager.register('test', plugin);
    const result = pluginManager.register('test', plugin);

    expect(result).toBe(false);
    expect(pluginManager.plugins.size).toBe(1);
  });

  test('enable plugin', () => {
    const plugin = { name: 'test', version: '1.0', enabled: false };
    pluginManager.register('test', plugin);
    pluginManager.enable('test');

    expect(pluginManager.plugins.get('test').enabled).toBe(true);
  });

  test('disable plugin', () => {
    const plugin = { name: 'test', version: '1.0', enabled: true };
    pluginManager.register('test', plugin);
    pluginManager.disable('test');

    expect(pluginManager.plugins.get('test').enabled).toBe(false);
  });

  test('execute hooks in sequence', async () => {
    const hook1 = jest.fn(async (data) => ({ ...data, hook1: true }));
    const hook2 = jest.fn(async (data) => ({ ...data, hook2: true }));

    pluginManager.registerHook('test:hook', 'plugin1', hook1);
    pluginManager.registerHook('test:hook', 'plugin2', hook2);

    const result = await pluginManager.execute('test:hook', { original: true });

    expect(hook1).toHaveBeenCalled();
    expect(hook2).toHaveBeenCalled();
    expect(result.original).toBe(true);
    expect(result.hook1).toBe(true);
    expect(result.hook2).toBe(true);
  });

  test('hook error handling does not crash', async () => {
    const badHook = jest.fn(async () => { throw new Error('hook failed'); });
    const goodHook = jest.fn(async (data) => ({ ...data, good: true }));

    pluginManager.registerHook('test:hook', 'bad', badHook);
    pluginManager.registerHook('test:hook', 'good', goodHook);

    const result = await pluginManager.execute('test:hook', { data: 'test' });

    expect(badHook).toHaveBeenCalled();
    expect(goodHook).toHaveBeenCalled();
    expect(result.good).toBe(true);
  });

  test('skip disabled hooks', async () => {
    const hook1 = jest.fn(async (data) => ({ ...data, hook1: true }));
    const hook2 = jest.fn(async (data) => ({ ...data, hook2: true }));

    pluginManager.registerHook('test:hook', 'plugin1', hook1);
    const hookObj = { plugin: 'plugin2', execute: hook2, enabled: false };
    pluginManager.hooks.set('test:hook', [
      pluginManager.hooks.get('test:hook')[0],
      hookObj
    ]);

    const result = await pluginManager.execute('test:hook', { data: 'test' });

    expect(hook1).toHaveBeenCalled();
    expect(hook2).not.toHaveBeenCalled();
    expect(result.hook1).toBe(true);
    expect(result.hook2).toBeUndefined();
  });

  test('getPlugins returns all registered plugins', () => {
    pluginManager.register('plugin1', { name: 'plugin1', version: '1.0' });
    pluginManager.register('plugin2', { name: 'plugin2', version: '2.0' });
    pluginManager.register('plugin3', { name: 'plugin3', version: '1.5' });

    const plugins = pluginManager.getPlugins();

    expect(plugins.length).toBe(3);
    expect(plugins.map(p => p.name)).toEqual(['plugin1', 'plugin2', 'plugin3']);
  });

  test('enable non-existent plugin returns false', () => {
    const result = pluginManager.enable('nonexistent');
    expect(result).toBe(false);
  });

  test('disable non-existent plugin returns false', () => {
    const result = pluginManager.disable('nonexistent');
    expect(result).toBe(false);
  });
});

// ── LLMProvider ───────────────────────────────────────────────────────────────

const LLMProvider = require('../../lib/llm-provider');

describe('LLMProvider', () => {
  let provider;

  beforeEach(() => {
    provider = new LLMProvider('test-provider', { url: 'http://localhost' }, null);
  });

  test('constructor stores name, config, and logger', () => {
    expect(provider.name).toBe('test-provider');
    expect(provider.config).toEqual({ url: 'http://localhost' });
    expect(provider.logger).toBeNull();
  });

  test('accepts a logger instance', () => {
    const mockLogger = { info: jest.fn() };
    const p = new LLMProvider('prov', {}, mockLogger);
    expect(p.logger).toBe(mockLogger);
  });

  test('healthCheck() rejects with not-implemented error', async () => {
    await expect(provider.healthCheck()).rejects.toThrow('not implemented');
  });

  test('getModels() rejects with not-implemented error', async () => {
    await expect(provider.getModels()).rejects.toThrow('not implemented');
  });

  test('generate() rejects with not-implemented error', async () => {
    await expect(provider.generate('prompt')).rejects.toThrow('not implemented');
  });

  test('streamGenerate() throws not-implemented on first iteration', async () => {
    const gen = provider.streamGenerate('prompt');
    await expect(gen.next()).rejects.toThrow('not implemented');
  });

  test('getStatus() returns name and available=false by default', async () => {
    const status = await provider.getStatus();
    expect(status.name).toBe('test-provider');
    expect(status.available).toBe(false);
    expect(Array.isArray(status.models)).toBe(true);
    expect(status.models).toHaveLength(0);
  });
});

// ── LLMOrchestrator ───────────────────────────────────────────────────────────

const LLMOrchestrator = require('../../lib/llm-orchestrator');

describe('LLMOrchestrator', () => {
  let orchestrator;
  let mockLogger;

  function makeMockProvider(name, shouldFail = false) {
    return {
      name,
      generate: jest.fn(async () => {
        if (shouldFail) throw new Error(`${name} failed`);
        return { provider: name, response: `response from ${name}`, tokens: {} };
      }),
      streamGenerate: jest.fn(async function* () {
        if (shouldFail) throw new Error(`${name} stream failed`);
        yield { provider: name, token: 'hello' };
        yield { provider: name, done: true };
      }),
      getStatus: jest.fn(async () => ({ available: true, type: 'mock', models: [] })),
      getModels: jest.fn(async () => [{ name: `${name}-model` }]),
    };
  }

  beforeEach(() => {
    mockLogger = { info: jest.fn(), warn: jest.fn(), debug: jest.fn(), error: jest.fn() };
    orchestrator = new LLMOrchestrator(mockLogger);
  });

  describe('provider registration', () => {
    test('registerProvider stores provider and initialises stats', () => {
      const p = makeMockProvider('test');
      orchestrator.registerProvider('test', p);
      expect(orchestrator.getProvider('test')).toBe(p);
      expect(orchestrator.getStats().providers).toContain('test');
    });

    test('getAllProviders returns all registered providers', () => {
      orchestrator.registerProvider('a', makeMockProvider('a'));
      orchestrator.registerProvider('b', makeMockProvider('b'));
      expect(orchestrator.getAllProviders()).toHaveLength(2);
    });

    test('getProvider returns undefined for unknown provider', () => {
      expect(orchestrator.getProvider('nonexistent')).toBeUndefined();
    });

    test('registerProvider emits provider-registered event', done => {
      orchestrator.on('provider-registered', ({ name }) => {
        expect(name).toBe('emitted-prov');
        done();
      });
      orchestrator.registerProvider('emitted-prov', makeMockProvider('emitted-prov'));
    });
  });

  describe('routing strategies', () => {
    test('setRoutingStrategy stores and getRoutingStrategy retrieves it', () => {
      orchestrator.setRoutingStrategy('fast', { primary: 'ollama', timeout: 5000 });
      expect(orchestrator.getRoutingStrategy('fast').primary).toBe('ollama');
    });

    test('getRoutingStrategy returns default strategy for unknown task type', () => {
      const strategy = orchestrator.getRoutingStrategy('unknown-task');
      expect(strategy).toHaveProperty('primary');
      expect(strategy).toHaveProperty('fallback');
    });

    test('getDefaultRoutingStrategy has numeric retries and timeout', () => {
      const s = orchestrator.getDefaultRoutingStrategy();
      expect(typeof s.timeout).toBe('number');
      expect(typeof s.retries).toBe('number');
    });
  });

  describe('generate()', () => {
    const STRATEGY = { primary: 'ollama', fallback: null, retries: 0, timeout: 5000 };

    test('uses the preferred provider when specified', async () => {
      const p = makeMockProvider('ollama');
      orchestrator.registerProvider('ollama', p);
      const result = await orchestrator.generate('hello', { preferredProvider: 'ollama' });
      expect(result.provider).toBe('ollama');
      expect(p.generate).toHaveBeenCalled();
    });

    test('falls back to secondary provider when primary fails', async () => {
      orchestrator.registerProvider('gemini', makeMockProvider('gemini', true));
      orchestrator.registerProvider('ollama', makeMockProvider('ollama', false));
      orchestrator.setRoutingStrategy('default', { primary: 'gemini', fallback: 'ollama', retries: 0, timeout: 5000 });
      const result = await orchestrator.generate('hello', { taskType: 'default' });
      expect(result.provider).toBe('ollama');
    });

    test('throws when all providers fail', async () => {
      orchestrator.registerProvider('gemini', makeMockProvider('gemini', true));
      orchestrator.setRoutingStrategy('default', { primary: 'gemini', fallback: null, retries: 0, timeout: 5000 });
      await expect(orchestrator.generate('hello', { taskType: 'default' })).rejects.toThrow('All providers failed');
    });

    test('increments totalRequests on success', async () => {
      orchestrator.registerProvider('ollama', makeMockProvider('ollama'));
      orchestrator.setRoutingStrategy('default', STRATEGY);
      await orchestrator.generate('hello', { taskType: 'default' });
      expect(orchestrator.getStats().totalRequests).toBe(1);
    });

    test('increments errorsByProvider on provider failure', async () => {
      orchestrator.registerProvider('gemini', makeMockProvider('gemini', true));
      orchestrator.registerProvider('ollama', makeMockProvider('ollama'));
      orchestrator.setRoutingStrategy('default', { primary: 'gemini', fallback: 'ollama', retries: 0, timeout: 5000 });
      await orchestrator.generate('hello', { taskType: 'default' });
      expect(orchestrator.getStats().errorsByProvider.gemini).toBeGreaterThan(0);
    });

    test('emits generation-success on success', async () => {
      const spy = jest.fn();
      orchestrator.on('generation-success', spy);
      orchestrator.registerProvider('ollama', makeMockProvider('ollama'));
      orchestrator.setRoutingStrategy('default', STRATEGY);
      await orchestrator.generate('hello', { taskType: 'default' });
      expect(spy).toHaveBeenCalled();
    });

    test('emits generation-failed when all providers fail', async () => {
      const spy = jest.fn();
      orchestrator.on('generation-failed', spy);
      orchestrator.registerProvider('gemini', makeMockProvider('gemini', true));
      orchestrator.setRoutingStrategy('default', { primary: 'gemini', fallback: null, retries: 0, timeout: 5000 });
      await orchestrator.generate('hello', { taskType: 'default' }).catch(() => {});
      expect(spy).toHaveBeenCalled();
    });

    test('emits provider-error for each failing provider', async () => {
      const spy = jest.fn();
      orchestrator.on('provider-error', spy);
      orchestrator.registerProvider('gemini', makeMockProvider('gemini', true));
      orchestrator.registerProvider('ollama', makeMockProvider('ollama'));
      orchestrator.setRoutingStrategy('default', { primary: 'gemini', fallback: 'ollama', retries: 0, timeout: 5000 });
      await orchestrator.generate('hello', { taskType: 'default' });
      expect(spy).toHaveBeenCalledWith(expect.objectContaining({ provider: 'gemini' }));
    });

    test('skips providers not found in the registry', async () => {
      orchestrator.registerProvider('ollama', makeMockProvider('ollama'));
      orchestrator.setRoutingStrategy('default', { primary: 'nonexistent', fallback: 'ollama', retries: 0, timeout: 5000 });
      const result = await orchestrator.generate('hello', { taskType: 'default' });
      expect(result.provider).toBe('ollama');
    });
  });

  describe('synthesizeResponses()', () => {
    test('collects responses from multiple providers', async () => {
      orchestrator.registerProvider('gemini', makeMockProvider('gemini'));
      orchestrator.registerProvider('ollama', makeMockProvider('ollama'));
      const result = await orchestrator.synthesizeResponses('analyze this', { providers: ['gemini', 'ollama'] });
      expect(result.responses).toHaveLength(2);
      expect(result.synthesisType).toBe('multi-provider');
      expect(result.timestamp).toBeDefined();
    });

    test('throws when no providers available for synthesis', async () => {
      await expect(
        orchestrator.synthesizeResponses('test', { providers: ['nonexistent'] })
      ).rejects.toThrow('No providers available');
    });

    test('emits synthesis-complete event', async () => {
      const spy = jest.fn();
      orchestrator.on('synthesis-complete', spy);
      orchestrator.registerProvider('ollama', makeMockProvider('ollama'));
      await orchestrator.synthesizeResponses('test', { providers: ['ollama'] });
      expect(spy).toHaveBeenCalledWith(expect.objectContaining({ providerCount: 1 }));
    });

    test('skips failed providers during synthesis (partial result)', async () => {
      orchestrator.registerProvider('gemini', makeMockProvider('gemini', true));
      orchestrator.registerProvider('ollama', makeMockProvider('ollama'));
      const result = await orchestrator.synthesizeResponses('test', { providers: ['gemini', 'ollama'] });
      expect(result.responses).toHaveLength(1);
      expect(result.responses[0].provider).toBe('ollama');
    });
  });

  describe('healthCheck()', () => {
    test('returns health for all registered providers', async () => {
      orchestrator.registerProvider('ollama', makeMockProvider('ollama'));
      const health = await orchestrator.healthCheck();
      expect(health.ollama).toBeDefined();
      expect(health.ollama.available).toBe(true);
    });

    test('marks provider as unavailable when getStatus throws', async () => {
      const p = makeMockProvider('broken');
      p.getStatus.mockRejectedValue(new Error('connection refused'));
      orchestrator.registerProvider('broken', p);
      const health = await orchestrator.healthCheck();
      expect(health.broken.available).toBe(false);
      expect(health.broken.error).toBeDefined();
    });

    test('emits health-check event', async () => {
      const spy = jest.fn();
      orchestrator.on('health-check', spy);
      orchestrator.registerProvider('ollama', makeMockProvider('ollama'));
      await orchestrator.healthCheck();
      expect(spy).toHaveBeenCalled();
    });
  });

  describe('getAllModels()', () => {
    test('aggregates models from all providers', async () => {
      orchestrator.registerProvider('ollama', makeMockProvider('ollama'));
      const models = await orchestrator.getAllModels();
      expect(models.ollama).toHaveLength(1);
    });

    test('returns empty array for a provider whose getModels throws', async () => {
      const p = makeMockProvider('bad');
      p.getModels.mockRejectedValue(new Error('failed'));
      orchestrator.registerProvider('bad', p);
      const models = await orchestrator.getAllModels();
      expect(models.bad).toEqual([]);
    });
  });

  describe('getStats() and resetStats()', () => {
    test('getStats includes providers and strategies lists', () => {
      orchestrator.registerProvider('ollama', makeMockProvider('ollama'));
      orchestrator.setRoutingStrategy('fast', { primary: 'ollama' });
      const stats = orchestrator.getStats();
      expect(stats.providers).toContain('ollama');
      expect(stats.strategies).toContain('fast');
    });

    test('resetStats zeroes all counters', async () => {
      const p = makeMockProvider('ollama');
      orchestrator.registerProvider('ollama', p);
      orchestrator.setRoutingStrategy('default', { primary: 'ollama', fallback: null, retries: 0, timeout: 5000 });
      await orchestrator.generate('hello', { taskType: 'default' });
      orchestrator.resetStats();
      const stats = orchestrator.getStats();
      expect(stats.totalRequests).toBe(0);
      expect(stats.requestsByProvider.ollama).toBe(0);
    });
  });

  describe('_getFallbackProviders()', () => {
    test('returns all registered providers except the named primary', () => {
      orchestrator.registerProvider('a', makeMockProvider('a'));
      orchestrator.registerProvider('b', makeMockProvider('b'));
      orchestrator.registerProvider('c', makeMockProvider('c'));
      const fallbacks = orchestrator._getFallbackProviders('a');
      expect(fallbacks).toContain('b');
      expect(fallbacks).toContain('c');
      expect(fallbacks).not.toContain('a');
    });
  });
});
