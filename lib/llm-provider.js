/**
 * LLM Provider Interface
 * Abstracts different LLM providers (Ollama, Gemini, etc.)
 */

class LLMProvider {
  constructor(name, config, logger) {
    this.name = name;
    this.config = config;
    this.logger = logger;
  }

  /**
   * Health check - verify provider is available
   */
  async healthCheck() {
    throw new Error('healthCheck() not implemented');
  }

  /**
   * Get available models from provider
   */
  async getModels() {
    throw new Error('getModels() not implemented');
  }

  /**
   * Generate response from prompt
   */
  async generate(prompt, options = {}) {
    throw new Error('generate() not implemented');
  }

  /**
   * Stream response from prompt
   */
  async *streamGenerate(prompt, options = {}) {
    throw new Error('streamGenerate() not implemented');
  }

  /**
   * Get provider status and metrics
   */
  async getStatus() {
    return {
      name: this.name,
      available: false,
      models: []
    };
  }
}

module.exports = LLMProvider;
