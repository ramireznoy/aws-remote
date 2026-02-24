const { loadConfig, getEnvObject, resolveName } = require('../config/config');
const { getTaskEnvVars } = require('../services/aws-ecs');

function registerEnvVarsRoutes(app) {
  app.get('/api/env-vars/:env/:repo', async (req, res) => {
    const { env, repo } = req.params;
    if (!env || !repo) {
      return res.status(400).json({ error: 'env and repo are required' });
    }
    try {
      const config = loadConfig();
      const envObj = getEnvObject(config, env);
      const taskName = resolveName(envObj.taskPattern, env, repo);
      const result = await getTaskEnvVars(envObj.awsProfile, envObj.awsRegion, taskName);
      res.json(result);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });
}

module.exports = { registerEnvVarsRoutes };
