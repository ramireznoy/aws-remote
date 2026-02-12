const { loadConfig, getClient } = require('../config/config');
const { triggerPipeline, stopPipeline } = require('../services/aws-pipeline');

function registerActionRoutes(app) {
  // Trigger (release) a single pipeline without changing branch
  app.post('/api/trigger', async (req, res) => {
    const { pipelineName } = req.body;
    if (!pipelineName) return res.status(400).json({ error: 'pipelineName is required' });

    const config = loadConfig();
    const client = getClient(config.awsProfile, config.awsRegion);

    try {
      const { pipelineExecutionId } = await triggerPipeline(client, pipelineName);
      res.json({ status: 'triggered', executionId: pipelineExecutionId });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // Stop a pipeline execution
  app.post('/api/stop', async (req, res) => {
    const { pipelineName, executionId } = req.body;
    if (!pipelineName || !executionId) {
      return res.status(400).json({ error: 'pipelineName and executionId are required' });
    }

    const config = loadConfig();
    const client = getClient(config.awsProfile, config.awsRegion);

    try {
      await stopPipeline(client, pipelineName, executionId);
      res.json({ status: 'stopped' });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });
}

module.exports = { registerActionRoutes };
