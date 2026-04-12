/**
 * Ollama API Client
 *
 * Handles all communication with the Ollama LLM service.
 * Supports model management, chat completions, and status checks.
 */

const http = require('http');
const { URL } = require('url');

class OllamaClient {
  constructor(baseUrl = 'http://ollama:11434', defaultModel = 'smollm2:135m') {
    this.baseUrl = baseUrl;
    this.defaultModel = defaultModel;
    this.isAvailable = false;
    this.models = [];
    this.lastHealthCheck = 0;
    this.healthCheckInterval = 30000; // 30 seconds
  }

  /**
   * Check if Ollama service is available
   */
  async checkHealth() {
    try {
      const now = Date.now();
      // Cache health check for 30 seconds
      if (now - this.lastHealthCheck < this.healthCheckInterval) {
        return this.isAvailable;
      }

      const response = await this._request('GET', '/api/tags');
      this.isAvailable = true;
      this.lastHealthCheck = now;
      return true;
    } catch (error) {
      this.isAvailable = false;
      this.lastHealthCheck = Date.now();
      return false;
    }
  }

  /**
   * Get list of available models
   */
  async getModels() {
    try {
      const data = await this._request('GET', '/api/tags');
      this.models = data.models || [];
      return this.models;
    } catch (error) {
      console.error('Failed to get models:', error.message);
      return [];
    }
  }

  /**
   * Get model names only
   */
  async getModelNames() {
    const models = await this.getModels();
    return models.map((m) => m.name);
  }

  /**
   * Check if a specific model is available
   */
  async hasModel(modelName) {
    const models = await this.getModelNames();
    return models.includes(modelName);
  }

  /**
   * Pull (download) a model
   * @param {string} modelName - Model name (e.g., 'smollm2:135m')
   * @param {Function} onProgress - Optional callback for progress (chunk data)
   */
  async pullModel(modelName, onProgress = null) {
    try {
      return await this._requestStream(
        'POST',
        '/api/pull',
        {
          name: modelName,
        },
        onProgress
      );
    } catch (error) {
      console.error(`Failed to pull model ${modelName}:`, error.message);
      throw error;
    }
  }

  /**
   * Send a chat completion request
   * @param {string} prompt - User prompt
   * @param {Object} options - Additional options (model, temperature, etc.)
   */
  async chat(prompt, options = {}) {
    const model = options.model || this.defaultModel;

    try {
      const response = await this._request('POST', '/api/generate', {
        model,
        prompt,
        stream: false,
        temperature: options.temperature || 0.7,
        top_p: options.top_p || 0.9,
        top_k: options.top_k || 40,
      });

      return {
        model,
        response: response.response,
        done: response.done,
        context: response.context,
        totalDuration: response.total_duration,
        loadDuration: response.load_duration,
        promptEvalCount: response.prompt_eval_count,
        promptEvalDuration: response.prompt_eval_duration,
        evalCount: response.eval_count,
        evalDuration: response.eval_duration,
      };
    } catch (error) {
      console.error('Chat error:', error.message);
      throw error;
    }
  }

  /**
   * Stream chat responses
   * @param {string} prompt - User prompt
   * @param {Function} onChunk - Callback for each chunk
   * @param {Object} options - Additional options
   */
  async chatStream(prompt, onChunk, options = {}) {
    const model = options.model || this.defaultModel;

    try {
      return await this._requestStream(
        'POST',
        '/api/generate',
        {
          model,
          prompt,
          stream: true,
          temperature: options.temperature || 0.7,
          top_p: options.top_p || 0.9,
          top_k: options.top_k || 40,
        },
        onChunk
      );
    } catch (error) {
      console.error('Stream chat error:', error.message);
      throw error;
    }
  }

  /**
   * Get model information
   */
  async showModel(modelName) {
    try {
      return await this._request('POST', '/api/show', {
        name: modelName,
      });
    } catch (error) {
      console.error(`Failed to get info for ${modelName}:`, error.message);
      throw error;
    }
  }

  /**
   * Delete a model
   */
  async deleteModel(modelName) {
    try {
      await this._request('DELETE', `/api/delete`, {
        name: modelName,
      });
      return { success: true, message: `Model ${modelName} deleted` };
    } catch (error) {
      console.error(`Failed to delete ${modelName}:`, error.message);
      throw error;
    }
  }

  /**
   * Internal: Make HTTP request
   */
  async _request(method, path, body = null) {
    return new Promise((resolve, reject) => {
      const url = new URL(this.baseUrl);
      const options = {
        hostname: url.hostname,
        port: url.port || 11434,
        path,
        method,
        timeout: 30000,
        headers: {
          'Content-Type': 'application/json',
        },
      };

      const req = http.request(options, (res) => {
        let data = '';

        res.on('data', (chunk) => {
          data += chunk;
        });

        res.on('end', () => {
          try {
            if (res.statusCode >= 200 && res.statusCode < 300) {
              resolve(JSON.parse(data || '{}'));
            } else {
              reject(new Error(`HTTP ${res.statusCode}: ${data}`));
            }
          } catch (error) {
            reject(new Error(`Failed to parse response: ${error.message}`));
          }
        });
      });

      req.on('error', reject);
      req.on('timeout', () => {
        req.destroy();
        reject(new Error('Request timeout'));
      });

      if (body) {
        req.write(JSON.stringify(body));
      }
      req.end();
    });
  }

  /**
   * Internal: Make streaming HTTP request
   */
  async _requestStream(method, path, body = null, onChunk) {
    return new Promise((resolve, reject) => {
      const url = new URL(this.baseUrl);
      const options = {
        hostname: url.hostname,
        port: url.port || 11434,
        path,
        method,
        timeout: 300000, // 5 minute timeout for streams
        headers: {
          'Content-Type': 'application/json',
        },
      };

      const req = http.request(options, (res) => {
        let buffer = '';

        res.on('data', (chunk) => {
          buffer += chunk.toString();

          // Process complete JSON lines
          const lines = buffer.split('\n');
          buffer = lines.pop(); // Keep incomplete line in buffer

          for (const line of lines) {
            if (line.trim()) {
              try {
                const data = JSON.parse(line);
                if (onChunk) onChunk(data);
              } catch (error) {
                console.error('Failed to parse stream line:', error.message);
              }
            }
          }
        });

        res.on('end', () => {
          // Process any remaining buffer
          if (buffer.trim()) {
            try {
              const data = JSON.parse(buffer);
              if (onChunk) onChunk(data);
            } catch (error) {
              console.error('Failed to parse final stream data:', error.message);
            }
          }
          resolve();
        });
      });

      req.on('error', reject);
      req.on('timeout', () => {
        req.destroy();
        reject(new Error('Stream request timeout'));
      });

      if (body) {
        req.write(JSON.stringify(body));
      }
      req.end();
    });
  }
}

module.exports = OllamaClient;
