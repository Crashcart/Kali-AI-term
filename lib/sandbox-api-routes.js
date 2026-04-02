/**
 * Sandbox API Routes
 * Endpoints for sandbox management and execution
 */

const express = require('express');

function createSandboxRoutes(sandboxDetector, sandboxConfig, sandboxManager, logger) {
  const router = express.Router();

  /**
   * GET /api/sandbox/status
   * Get sandbox system status and availability
   */
  router.get('/api/sandbox/status', async (req, res) => {
    try {
      const detection = await sandboxDetector.detect();
      const activeSandboxes = sandboxManager.getActiveSandboxes();
      
      res.json({
        success: true,
        sandbox: {
          available: detection.available,
          platform: detection.platform,
          version: detection.version || null,
          installCommand: detection.installCommand || null,
          activeSandboxCount: activeSandboxes.length,
          totalSandboxes: sandboxConfig.listSandboxes().length
        },
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      logger?.error(`/api/sandbox/status error: ${error.message}`);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  /**
   * GET /api/sandbox/install-instructions
   * Get installation instructions for the current platform
   */
  router.get('/api/sandbox/install-instructions', (req, res) => {
    try {
      const instructions = sandboxDetector.getInstallationInstructions();
      
      res.json({
        success: true,
        instructions: instructions,
        platform: sandboxDetector.platform
      });
    } catch (error) {
      logger?.error(`/api/sandbox/install-instructions error: ${error.message}`);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  /**
   * POST /api/sandbox/create
   * Create a new sandbox configuration
   */
  router.post('/api/sandbox/create', (req, res) => {
    try {
      const { type = 'standard', name, options = {} } = req.body;

      let sandbox;
      switch (type) {
        case 'restrictive':
          sandbox = sandboxConfig.createRestrictiveSandbox({ name, ...options });
          break;
        case 'standard':
          sandbox = sandboxConfig.createStandardSandbox({ name, ...options });
          break;
        case 'permissive':
          sandbox = sandboxConfig.createPermissiveSandbox({ name, ...options });
          break;
        default:
          return res.status(400).json({
            success: false,
            error: `Unknown sandbox type: ${type}`
          });
      }

      res.json({
        success: true,
        sandbox: sandbox,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      logger?.error(`/api/sandbox/create error: ${error.message}`);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  /**
   * GET /api/sandbox/:sandboxId
   * Get sandbox configuration details
   */
  router.get('/api/sandbox/:sandboxId', (req, res) => {
    try {
      const { sandboxId } = req.params;
      const config = sandboxConfig.getSandbox(sandboxId);
      const status = sandboxManager.getSandboxStatus(sandboxId);

      if (!config) {
        return res.status(404).json({
          success: false,
          error: `Sandbox not found: ${sandboxId}`
        });
      }

      res.json({
        success: true,
        config: config,
        status: status
      });
    } catch (error) {
      logger?.error(`/api/sandbox/:sandboxId error: ${error.message}`);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  /**
   * POST /api/sandbox/:sandboxId/start
   * Start a sandbox
   */
  router.post('/api/sandbox/:sandboxId/start', async (req, res) => {
    try {
      const { sandboxId } = req.params;
      const instance = await sandboxManager.startSandbox(sandboxId);

      res.json({
        success: true,
        instance: instance,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      logger?.error(`/api/sandbox/:sandboxId/start error: ${error.message}`);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  /**
   * POST /api/sandbox/:sandboxId/stop
   * Stop a running sandbox
   */
  router.post('/api/sandbox/:sandboxId/stop', async (req, res) => {
    try {
      const { sandboxId } = req.params;
      await sandboxManager.stopSandbox(sandboxId);

      res.json({
        success: true,
        message: `Sandbox stopped: ${sandboxId}`,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      logger?.error(`/api/sandbox/:sandboxId/stop error: ${error.message}`);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  /**
   * POST /api/sandbox/:sandboxId/execute
   * Execute a command within a sandbox
   */
  router.post('/api/sandbox/:sandboxId/execute', async (req, res) => {
    try {
      const { sandboxId } = req.params;
      const { command, options = {} } = req.body;

      if (!command) {
        return res.status(400).json({
          success: false,
          error: 'Command is required'
        });
      }

      const execution = await sandboxManager.executeInSandbox(sandboxId, command, options);

      res.json({
        success: true,
        execution: execution,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      logger?.error(`/api/sandbox/:sandboxId/execute error: ${error.message}`);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  /**
   * DELETE /api/sandbox/:sandboxId
   * Delete a sandbox configuration
   */
  router.delete('/api/sandbox/:sandboxId', (req, res) => {
    try {
      const { sandboxId } = req.params;
      const deleted = sandboxConfig.deleteSandbox(sandboxId);

      if (!deleted) {
        return res.status(404).json({
          success: false,
          error: `Sandbox not found: ${sandboxId}`
        });
      }

      res.json({
        success: true,
        message: `Sandbox deleted: ${sandboxId}`,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      logger?.error(`/api/sandbox/:sandboxId (DELETE) error: ${error.message}`);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  /**
   * GET /api/sandbox
   * List all sandboxes
   */
  router.get('/api/sandbox', (req, res) => {
    try {
      const { status } = req.query;
      const sandboxes = status
        ? sandboxConfig.getSandboxesByStatus(status)
        : sandboxConfig.listSandboxes();

      res.json({
        success: true,
        sandboxes: sandboxes,
        count: sandboxes.length,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      logger?.error(`/api/sandbox (list) error: ${error.message}`);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  /**
   * POST /api/sandbox/verify
   * Verify sandbox constraints
   */
  router.post('/api/sandbox/verify', (req, res) => {
    try {
      const { sandboxId } = req.body;

      if (!sandboxId) {
        return res.status(400).json({
          success: false,
          error: 'sandboxId is required'
        });
      }

      const verification = sandboxConfig.verifySandboxConstraints(sandboxId);

      res.json({
        success: true,
        verification: verification,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      logger?.error(`/api/sandbox/verify error: ${error.message}`);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  return router;
}

module.exports = createSandboxRoutes;
