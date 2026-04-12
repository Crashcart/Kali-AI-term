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
      enabled: true,
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
    const badHook = jest.fn(async () => {
      throw new Error('hook failed');
    });
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
    pluginManager.hooks.set('test:hook', [pluginManager.hooks.get('test:hook')[0], hookObj]);

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
    expect(plugins.map((p) => p.name)).toEqual(['plugin1', 'plugin2', 'plugin3']);
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
