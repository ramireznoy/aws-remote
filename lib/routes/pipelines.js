const { loadConfig, getClient } = require('../config/config');
const { getPipelineStatuses, listPipelines } = require('../services/aws-pipeline');

function registerPipelineRoutes(app) {
  // List pipelines for an environment
  app.get('/api/pipelines/:env', async (req, res) => {
    try {
      const config = loadConfig();
      const client = getClient(config.awsProfile, config.awsRegion);
      const matching = await listPipelines(client, req.params.env);
      res.json(matching);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // Get pipeline execution status
  app.get('/api/status', async (req, res) => {
    const pipelineNames = (req.query.pipelines || '').split(',').filter(Boolean);
    if (!pipelineNames.length) return res.json([]);

    const config = loadConfig();
    const client = getClient(config.awsProfile, config.awsRegion);
    const statuses = await getPipelineStatuses(client, pipelineNames);
    res.json(statuses);
  });
}

module.exports = { registerPipelineRoutes };
