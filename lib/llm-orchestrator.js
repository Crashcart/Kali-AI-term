/**
 * Multi-LLM Orchestrator
 * Manages multiple LLM providers with routing, fallback, and cost optimization
 */

const EventEmitter = require('events');

class LLMOrchestrator extends EventEmitter {
  constructor(logger) {
    super();
    this.logger = logger;
    this.providers = new Map(); // name -> provider instance
    this.routing = new Map(); // task -> provider strategy
    this.stats = {
      totalRequests: 0,
      requestsByProvider: {},
      errorsByProvider: {},
      lastUpdated: null
    };
  }

  /**
   * Register a provider
   */
  registerProvider(name, provider) {
    this.providers.set(name, provider);
    this.stats.requestsByProvider[name] = 0;
    this.stats.errorsByProvider[name] = 0;
    this.logger?.info(`Registered LLM provider: ${name}`);
    this.emit('provider-registered', { name });
  }

  /**
   * Get a provider by name
   */
  getProvider(name) {
    return this.providers.get(name);
  }

  /**
   * Get all providers
   */
  getAllProviders() {
    return Array.from(this.providers.values());
  }

  /**
   * Set routing strategy for a task type
   * Examples: 'reasoning', 'speed', 'cost', 'quality'
   */
  setRoutingStrategy(taskType, strategy) {
    this.routing.set(taskType, strategy);
    this.logger?.debug(`Set routing strategy for ${taskType}: ${JSON.stringify(strategy)}`);
  }

  /**
   * Get routing strategy for a task
   */
  getRoutingStrategy(taskType) {
    return this.routing.get(taskType) || this.getDefaultRoutingStrategy();
  }

  /**
   * Get default routing strategy
   */
  getDefaultRoutingStrategy() {
    return {
      primary: 'gemini',      // Try Gemini first for quality
      fallback: 'ollama',     // Fall back to Ollama if Gemini fails
      timeout: 30000,
      retries: 1
    };
  }

  /**
   * Generate response with intelligent routing
   */
  async generate(prompt, options = {}) {
    const {
      taskType = 'default',
      preferredProvider = null,
      temperature = 0.7,
      systemPrompt = '',
      model = null
    } = options;

    const strategy = this.getRoutingStrategy(taskType);
    const providers = preferredProvider
      ? [preferredProvider, ...this._getFallbackProviders(preferredProvider)]
      : [strategy.primary, ...(strategy.fallback ? [strategy.fallback] : [])];

    let lastError = null;

    for (let attempt = 0; attempt <= strategy.retries; attempt++) {
      for (const providerName of providers) {
        try {
          const provider = this.getProvider(providerName);
          if (!provider) {
            this.logger?.warn(`Provider not found: ${providerName}`);
            continue;
          }

          this.logger?.debug(`Generating with ${providerName} (taskType: ${taskType})`);

          const result = await provider.generate(prompt, {
            temperature,
            systemPrompt,
            timeout: strategy.timeout,
            ...(model ? { model } : {})
          });

          this.stats.totalRequests++;
          this.stats.requestsByProvider[providerName]++;
          this.stats.lastUpdated = new Date().toISOString();

          this.emit('generation-success', {
            provider: providerName,
            taskType: taskType,
            timestamp: new Date().toISOString()
          });

          return result;
        } catch (error) {
          lastError = error;
          this.stats.errorsByProvider[providerName] = (this.stats.errorsByProvider[providerName] || 0) + 1;
          this.logger?.warn(`${providerName} failed: ${error.message}`);
          this.emit('provider-error', { provider: providerName, error: error.message });
        }
      }
    }

    // All providers failed
    this.emit('generation-failed', {
      taskType: taskType,
      error: lastError?.message
    });

    throw new Error(`All providers failed. Last error: ${lastError?.message}`);
  }

  /**
   * Stream response with intelligent routing
   */
  async *streamGenerate(prompt, options = {}) {
    const {
      taskType = 'default',
      preferredProvider = null,
      temperature = 0.7,
      systemPrompt = '',
      model = null
    } = options;

    const strategy = this.getRoutingStrategy(taskType);
    const providers = preferredProvider
      ? [preferredProvider, ...this._getFallbackProviders(preferredProvider)]
      : [strategy.primary, ...(strategy.fallback ? [strategy.fallback] : [])];

    let lastError = null;

    for (let attempt = 0; attempt <= strategy.retries; attempt++) {
      for (const providerName of providers) {
        try {
          const provider = this.getProvider(providerName);
          if (!provider) {
            this.logger?.warn(`Provider not found: ${providerName}`);
            continue;
          }

          this.logger?.debug(`Stream-generating with ${providerName} (taskType: ${taskType})`);

          for await (const chunk of provider.streamGenerate(prompt, {
            temperature,
            systemPrompt,
            timeout: strategy.timeout,
            ...(model ? { model } : {})
          })) {
            yield chunk;
          }

          this.stats.totalRequests++;
          this.stats.requestsByProvider[providerName]++;
          this.stats.lastUpdated = new Date().toISOString();

          this.emit('stream-success', {
            provider: providerName,
            taskType: taskType
          });

          return; // Success, exit
        } catch (error) {
          lastError = error;
          this.stats.errorsByProvider[providerName] = (this.stats.errorsByProvider[providerName] || 0) + 1;
          this.logger?.warn(`${providerName} stream failed: ${error.message}`);
          this.emit('provider-error', { provider: providerName, error: error.message });
        }
      }
    }

    // All providers failed
    this.emit('stream-failed', {
      taskType: taskType,
      error: lastError?.message
    });

    throw new Error(`All providers failed for streaming. Last error: ${lastError?.message}`);
  }

  /**
   * Consult multiple providers and synthesize responses
   * Used for complex reasoning tasks
   */
  async synthesizeResponses(prompt, options = {}) {
    const {
      providers = ['gemini', 'ollama'],
      systemPrompt = '',
      temperature = 0.7
    } = options;

    const responses = [];

    for (const providerName of providers) {
      try {
        const provider = this.getProvider(providerName);
        if (!provider) {
          this.logger?.warn(`Provider not found: ${providerName}`);
          continue;
        }

        this.logger?.debug(`Synthesizing: consulting ${providerName}`);

        const result = await provider.generate(prompt, {
          temperature,
          systemPrompt
        });

        responses.push({
          provider: providerName,
          response: result.response,
          tokens: result.tokens || {}
        });

        this.stats.requestsByProvider[providerName]++;
      } catch (error) {
        this.logger?.warn(`${providerName} consultation failed: ${error.message}`);
        this.stats.errorsByProvider[providerName]++;
      }
    }

    if (responses.length === 0) {
      throw new Error('No providers available for synthesis');
    }

    this.stats.totalRequests++;
    this.stats.lastUpdated = new Date().toISOString();

    this.emit('synthesis-complete', {
      providerCount: responses.length,
      timestamp: new Date().toISOString()
    });

    return {
      responses: responses,
      synthesisType: 'multi-provider',
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Health check all providers
   */
  async healthCheck() {
    const health = {};

    for (const [name, provider] of this.providers) {
      try {
        const status = await provider.getStatus();
        health[name] = {
          available: status.available,
          type: status.type || 'unknown',
          models: status.models || []
        };
      } catch (error) {
        health[name] = {
          available: false,
          error: error.message
        };
      }
    }

    this.logger?.info(`Health check complete: ${JSON.stringify(health)}`);
    this.emit('health-check', health);

    return health;
  }

  /**
   * Get all available models across providers
   */
  async getAllModels() {
    const models = {};

    for (const [name, provider] of this.providers) {
      try {
        const providerModels = await provider.getModels();
        models[name] = providerModels;
      } catch (error) {
        this.logger?.warn(`Failed to fetch models from ${name}: ${error.message}`);
        models[name] = [];
      }
    }

    return models;
  }

  /**
   * Get statistics
   */
  getStats() {
    return {
      ...this.stats,
      providers: Array.from(this.providers.keys()),
      strategies: Array.from(this.routing.keys())
    };
  }

  /**
   * Get fallback providers (all except primary)
   */
  _getFallbackProviders(primaryProvider) {
    return Array.from(this.providers.keys()).filter(p => p !== primaryProvider);
  }

  /**
   * Reset statistics
   */
  resetStats() {
    this.stats = {
      totalRequests: 0,
      requestsByProvider: {},
      errorsByProvider: {},
      lastUpdated: null
    };

    for (const name of this.providers.keys()) {
      this.stats.requestsByProvider[name] = 0;
      this.stats.errorsByProvider[name] = 0;
    }

    this.logger?.info('Statistics reset');
  }
}

module.exports = LLMOrchestrator;
