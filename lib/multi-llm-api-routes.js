/**
 * Multi-LLM API Routes
 * RESTful endpoints for orchestrated LLM operations
 */

const express = require('express');

function createMultiLLMRoutes(orchestrator, logger) {
  const router = express.Router();

  /**
   * GET /api/llm/providers
   * List all available LLM providers
   */
  router.get('/api/llm/providers', async (req, res) => {
    try {
      const health = await orchestrator.healthCheck();
      const models = await orchestrator.getAllModels();

      const providers = Array.from(orchestrator.getAllProviders()).map(provider => ({
        name: provider.name,
        status: health[provider.name],
        models: models[provider.name] || []
      }));

      res.json({
        success: true,
        providers: providers,
        count: providers.length,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      logger?.error(`/api/llm/providers error: ${error.message}`);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  /**
   * GET /api/llm/providers/:name
   * Get details of a specific provider
   */
  router.get('/api/llm/providers/:name', async (req, res) => {
    try {
      const { name } = req.params;
      const provider = orchestrator.getProvider(name);

      if (!provider) {
        return res.status(404).json({
          success: false,
          error: `Provider not found: ${name}`
        });
      }

      const status = await provider.getStatus();
      const models = await provider.getModels();

      res.json({
        success: true,
        provider: {
          name: name,
          status: status,
          models: models
        }
      });
    } catch (error) {
      logger?.error(`/api/llm/providers/:name error: ${error.message}`);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  /**
   * POST /api/llm/generate
   * Generate response with intelligent provider routing
   */
  router.post('/api/llm/generate', async (req, res) => {
    try {
      const {
        prompt,
        taskType = 'default',
        preferredProvider = null,
        temperature = 0.7,
        systemPrompt = ''
      } = req.body;

      if (!prompt) {
        return res.status(400).json({
          success: false,
          error: 'prompt is required'
        });
      }

      logger?.debug(`LLM Generate: taskType=${taskType}, provider=${preferredProvider}`);

      const result = await orchestrator.generate(prompt, {
        taskType,
        preferredProvider,
        temperature,
        systemPrompt
      });

      res.json({
        success: true,
        response: result,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      logger?.error(`/api/llm/generate error: ${error.message}`);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  /**
   * POST /api/llm/stream
   * Stream response with intelligent provider routing
   */
  router.post('/api/llm/stream', async (req, res) => {
    try {
      const {
        prompt,
        taskType = 'default',
        preferredProvider = null,
        temperature = 0.7,
        systemPrompt = ''
      } = req.body;

      if (!prompt) {
        return res.status(400).json({
          success: false,
          error: 'prompt is required'
        });
      }

      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');

      logger?.debug(`LLM Stream: taskType=${taskType}, provider=${preferredProvider}`);

      let tokenCount = 0;

      for await (const chunk of orchestrator.streamGenerate(prompt, {
        taskType,
        preferredProvider,
        temperature,
        systemPrompt
      })) {
        if (chunk.done) {
          res.write(`data: ${JSON.stringify({
            done: true,
            tokenCount: tokenCount,
            provider: chunk.provider
          })}\n\n`);
        } else {
          tokenCount++;
          res.write(`data: ${JSON.stringify({
            token: chunk.token,
            provider: chunk.provider,
            tokenCount: tokenCount
          })}\n\n`);
        }
      }

      res.end();
    } catch (error) {
      logger?.error(`/api/llm/stream error: ${error.message}`);
      res.write(`data: ${JSON.stringify({ error: error.message })}\n\n`);
      res.end();
    }
  });

  /**
   * POST /api/llm/synthesize
   * Consult multiple providers and synthesize responses
   */
  router.post('/api/llm/synthesize', async (req, res) => {
    try {
      const {
        prompt,
        providers = ['gemini', 'ollama'],
        temperature = 0.7,
        systemPrompt = ''
      } = req.body;

      if (!prompt) {
        return res.status(400).json({
          success: false,
          error: 'prompt is required'
        });
      }

      logger?.debug(`LLM Synthesize: providers=${providers.join(',')}`);

      const result = await orchestrator.synthesizeResponses(prompt, {
        providers,
        temperature,
        systemPrompt
      });

      res.json({
        success: true,
        synthesis: result,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      logger?.error(`/api/llm/synthesize error: ${error.message}`);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  /**
   * GET /api/llm/models
   * Get all available models across providers
   */
  router.get('/api/llm/models', async (req, res) => {
    try {
      const models = await orchestrator.getAllModels();

      res.json({
        success: true,
        models: models,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      logger?.error(`/api/llm/models error: ${error.message}`);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  /**
   * GET /api/llm/health
   * Health check all providers
   */
  router.get('/api/llm/health', async (req, res) => {
    try {
      const health = await orchestrator.healthCheck();

      const allHealthy = Object.values(health).some(h => h.available);

      res.json({
        success: true,
        health: health,
        allHealthy: allHealthy,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      logger?.error(`/api/llm/health error: ${error.message}`);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  /**
   * GET /api/llm/stats
   * Get orchestrator statistics
   */
  router.get('/api/llm/stats', (req, res) => {
    try {
      const stats = orchestrator.getStats();

      res.json({
        success: true,
        stats: stats,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      logger?.error(`/api/llm/stats error: ${error.message}`);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  /**
   * POST /api/llm/routing
   * Set routing strategy for task types
   */
  router.post('/api/llm/routing', (req, res) => {
    try {
      const { taskType, strategy } = req.body;

      if (!taskType || !strategy) {
        return res.status(400).json({
          success: false,
          error: 'taskType and strategy are required'
        });
      }

      orchestrator.setRoutingStrategy(taskType, strategy);

      res.json({
        success: true,
        message: `Routing strategy set for ${taskType}`,
        strategy: strategy,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      logger?.error(`/api/llm/routing error: ${error.message}`);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  /**
   * POST /api/llm/reset-stats
   * Reset statistics
   */
  router.post('/api/llm/reset-stats', (req, res) => {
    try {
      orchestrator.resetStats();

      res.json({
        success: true,
        message: 'Statistics reset',
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      logger?.error(`/api/llm/reset-stats error: ${error.message}`);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  return router;
}

module.exports = createMultiLLMRoutes;
