/**
 * Ollama Provider
 * Integration with local Ollama LLM service
 */

const axios = require('axios');
const LLMProvider = require('./llm-provider');

class OllamaProvider extends LLMProvider {
  constructor(url, logger) {
    super('ollama', { url }, logger);
    this.url = url;
    this.cache = new Map();
    this.cacheExpiry = 5 * 60 * 1000; // 5 minutes
  }

  /**
   * Health check - verify Ollama is running
   */
  async healthCheck() {
    try {
      const response = await axios.get(`${this.url}/api/tags`, { timeout: 3000 });
      this.logger?.debug(`Ollama health check passed`);
      return { healthy: true, url: this.url };
    } catch (error) {
      this.logger?.warn(`Ollama health check failed: ${error.message}`);
      return { healthy: false, url: this.url, error: error.message };
    }
  }

  /**
   * Get available models from Ollama
   */
  async getModels() {
    try {
      // Check cache first
      const cacheKey = 'ollama_models';
      const cached = this.cache.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < this.cacheExpiry) {
        return cached.models;
      }

      const response = await axios.get(`${this.url}/api/tags`, { timeout: 5000 });
      const models = (response.data.models || []).map(m => ({
        name: m.name,
        provider: 'ollama',
        size: m.size,
        modified: m.modified_at,
        digest: m.digest
      }));

      // Cache the result
      this.cache.set(cacheKey, { models, timestamp: Date.now() });

      this.logger?.debug(`Ollama: Fetched ${models.length} models`);
      return models;
    } catch (error) {
      this.logger?.error(`Ollama getModels failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Generate response using Ollama
   */
  async generate(prompt, options = {}) {
    try {
      const {
        model = 'dolphin-mixtral',
        systemPrompt = '',
        temperature = 0.7,
        timeout = 60000
      } = options;

      const response = await axios.post(
        `${this.url}/api/generate`,
        {
          model: model,
          prompt: prompt,
          system: systemPrompt,
          stream: false,
          options: { temperature }
        },
        { timeout }
      );

      return {
        provider: 'ollama',
        model: model,
        response: response.data.response,
        context: response.data.context,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      this.logger?.error(`Ollama generate failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Stream response using Ollama
   */
  async *streamGenerate(prompt, options = {}) {
    try {
      const {
        model = 'dolphin-mixtral',
        systemPrompt = '',
        temperature = 0.7,
        timeout = 120000
      } = options;

      const response = await axios.post(
        `${this.url}/api/generate`,
        {
          model: model,
          prompt: prompt,
          system: systemPrompt,
          stream: true,
          options: { temperature }
        },
        { responseType: 'stream', timeout }
      );

      for await (const chunk of response.data) {
        try {
          const lines = chunk.toString().split('\n').filter(l => l.trim());
          for (const line of lines) {
            const json = JSON.parse(line);
            if (!json.done) {
              yield {
                provider: 'ollama',
                token: json.response,
                model: model
              };
            } else {
              yield {
                provider: 'ollama',
                done: true,
                model: model,
                context: json.context
              };
            }
          }
        } catch (e) {
          // Ignore JSON parse errors on partial chunks
        }
      }
    } catch (error) {
      this.logger?.error(`Ollama streamGenerate failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get provider status and metrics
   */
  async getStatus() {
    try {
      const health = await this.healthCheck();
      const models = health.healthy ? await this.getModels() : [];

      return {
        name: 'ollama',
        available: health.healthy,
        url: this.url,
        models: models,
        modelCount: models.length,
        type: 'local'
      };
    } catch (error) {
      return {
        name: 'ollama',
        available: false,
        error: error.message,
        type: 'local'
      };
    }
  }

  /**
   * Clear cache
   */
  clearCache() {
    this.cache.clear();
  }
}

module.exports = OllamaProvider;
