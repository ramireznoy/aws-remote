const { ListPipelinesCommand } = require('@aws-sdk/client-codepipeline');
const { loadConfig, getClient } = require('../config/config');

function registerCredentialsRoutes(app) {
  // Validate AWS credentials
  app.get('/api/validate-credentials', async (_req, res) => {
    try {
      const config = loadConfig();
      const client = getClient(config.awsProfile, config.awsRegion);

      // Try a lightweight AWS API call to verify credentials work
      await client.send(new ListPipelinesCommand({ maxResults: 1 }));

      res.json({ valid: true, profile: config.awsProfile || 'default' });
    } catch (err) {
      res.status(401).json({
        valid: false,
        error: err.message,
        profile: loadConfig().awsProfile || 'default'
      });
    }
  });
}

module.exports = { registerCredentialsRoutes };
