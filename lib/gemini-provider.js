/**
 * Gemini Provider
 * Integration with Google Gemini API for higher-quality reasoning
 */

const axios = require('axios');
const LLMProvider = require('./llm-provider');

class GeminiProvider extends LLMProvider {
  constructor(apiKey, logger) {
    super('gemini', { apiKey }, logger);
    this.apiKey = apiKey;
    this.baseUrl = 'https://generativelanguage.googleapis.com/v1beta/models';
    this.model = process.env.GEMINI_MODEL || 'gemini-1.5-flash';
    this.requestCount = 0;
    this.errorCount = 0;
  }

  /**
   * Health check - verify Gemini API is accessible
   */
  async healthCheck() {
    try {
      // Try to list available models
      const response = await axios.get(
        `${this.baseUrl}?key=${this.apiKey}`,
        { timeout: 5000 }
      );

      this.logger?.debug(`Gemini health check passed`);
      return { healthy: true, model: this.model };
    } catch (error) {
      this.logger?.warn(`Gemini health check failed: ${error.message}`);
      return {
        healthy: false,
        error: error.message,
        hint: 'Verify GEMINI_API_KEY environment variable is set'
      };
    }
  }

  /**
   * Get available models from Gemini
   */
  async getModels() {
    try {
      const response = await axios.get(
        `${this.baseUrl}?key=${this.apiKey}`,
        { timeout: 5000 }
      );

      const models = (response.data.models || [])
        .filter(m =>
          (m.supportedGenerationMethods || []).includes('generateContent') ||
          m.name.includes('gemini')
        )
        .map(m => ({
          name: m.displayName || m.name,
          provider: 'gemini',
          description: m.description,
          inputTokenLimit: m.inputTokenLimit,
          outputTokenLimit: m.outputTokenLimit
        }));

      this.logger?.debug(`Gemini: Fetched ${models.length} models`);
      return models;
    } catch (error) {
      this.logger?.error(`Gemini getModels failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Generate response using Gemini
   */
  async generate(prompt, options = {}) {
    try {
      const {
        model = this.model,
        systemPrompt = '',
        temperature = 0.7,
        timeout = 60000,
        maxOutputTokens = 2048
      } = options;

      const contents = [
        {
          role: 'user',
          parts: [{ text: prompt }]
        }
      ];

      const requestBody = {
        contents,
        generationConfig: {
          temperature,
          maxOutputTokens
        },
        safetySettings: [
          { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_NONE' },
          { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_NONE' },
          { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE' },
          { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' }
        ]
      };

      if (systemPrompt) {
        requestBody.systemInstruction = { parts: [{ text: systemPrompt }] };
      }

      const response = await axios.post(
        `${this.baseUrl}/${model}:generateContent?key=${this.apiKey}`,
        requestBody,
        { timeout }
      );

      this.requestCount++;

      const text = response.data.candidates?.[0]?.content?.parts?.[0]?.text || '';

      return {
        provider: 'gemini',
        model: model,
        response: text,
        tokens: {
          input: response.data.usageMetadata?.promptTokenCount || 0,
          output: response.data.usageMetadata?.candidatesTokenCount || 0
        },
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      this.errorCount++;
      this.logger?.error(`Gemini generate failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Stream response using Gemini (via polling then character emit)
   */
  async *streamGenerate(prompt, options = {}) {
    try {
      const {
        model = this.model,
        systemPrompt = '',
        temperature = 0.7,
        timeout = 120000,
        maxOutputTokens = 2048
      } = options;

      const contents = [
        {
          role: 'user',
          parts: [{ text: prompt }]
        }
      ];

      const requestBody = {
        contents,
        generationConfig: {
          temperature,
          maxOutputTokens
        },
        safetySettings: [
          { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_NONE' },
          { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_NONE' },
          { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE' },
          { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' }
        ]
      };

      if (systemPrompt) {
        requestBody.systemInstruction = { parts: [{ text: systemPrompt }] };
      }

      const response = await axios.post(
        `${this.baseUrl}/${model}:generateContent?key=${this.apiKey}`,
        requestBody,
        { timeout }
      );

      this.requestCount++;

      const text = response.data.candidates?.[0]?.content?.parts?.[0]?.text || '';

      // Emit tokens character by character to simulate streaming
      for (const char of text) {
        yield {
          provider: 'gemini',
          token: char,
          model: model
        };
      }

      yield {
        provider: 'gemini',
        done: true,
        model: model,
        tokens: response.data.usageMetadata
      };
    } catch (error) {
      this.errorCount++;
      this.logger?.error(`Gemini streamGenerate failed: ${error.message}`);
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
        name: 'gemini',
        available: health.healthy,
        model: this.model,
        models: models,
        modelCount: models.length,
        type: 'cloud',
        metrics: {
          requestCount: this.requestCount,
          errorCount: this.errorCount,
          errorRate: this.requestCount > 0 ? (this.errorCount / this.requestCount * 100).toFixed(2) + '%' : 'N/A'
        }
      };
    } catch (error) {
      return {
        name: 'gemini',
        available: false,
        error: error.message,
        type: 'cloud'
      };
    }
  }

  /**
   * Set the model to use (gemini-pro, gemini-pro-vision, etc.)
   */
  setModel(model) {
    this.model = model;
    this.logger?.debug(`Gemini: Model switched to ${model}`);
  }

  /**
   * Update the API key at runtime
   */
  setApiKey(apiKey) {
    this.apiKey = apiKey;
    this.config.apiKey = apiKey;
    this.logger?.debug(`Gemini: API key updated`);
  }
}

module.exports = GeminiProvider;
