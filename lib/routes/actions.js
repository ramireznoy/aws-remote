const { loadConfig, getClient, getEnvObject } = require('../config/config');
const { triggerPipeline, stopPipeline } = require('../services/aws-pipeline');

function registerActionRoutes(app) {
  // Trigger (release) a single pipeline without changing branch
  app.post('/api/trigger', async (req, res) => {
    const { pipelineName, environment } = req.body;
    if (!pipelineName || !environment) return res.status(400).json({ error: 'pipelineName and environment are required' });

    const config = loadConfig();
    const env = getEnvObject(config, environment);
    const client = getClient(env.awsProfile, env.awsRegion);

    try {
      const { pipelineExecutionId } = await triggerPipeline(client, pipelineName);
      res.json({ status: 'triggered', executionId: pipelineExecutionId });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // Stop a pipeline execution
  app.post('/api/stop', async (req, res) => {
    const { pipelineName, executionId, environment } = req.body;
    if (!pipelineName || !executionId || !environment) {
      return res.status(400).json({ error: 'pipelineName, executionId, and environment are required' });
    }

    const config = loadConfig();
    const env = getEnvObject(config, environment);
    const client = getClient(env.awsProfile, env.awsRegion);

    try {
      await stopPipeline(client, pipelineName, executionId);
      res.json({ status: 'stopped' });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });
}

module.exports = { registerActionRoutes };
