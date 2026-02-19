const { loadConfig } = require('../config/config');
const { getLambdaClient, invokeLambda } = require('../services/lambda');

function registerRunCommandRoutes(app) {
  // Run a command via Lambda
  app.post('/api/run-command', async (req, res) => {
    const { environment, targetService, command } = req.body;

    if (!environment || !targetService || !command) {
      return res.status(400).json({ error: 'environment, targetService, and command are required' });
    }

    const config = loadConfig();
    const client = getLambdaClient(config.awsProfile, config.awsRegion);
    const functionName = `${environment}-run-command`;
    const payload = {
      task_definition: `${environment}-${targetService}`,
      command: command.split(' '),
    };

    try {
      const result = await invokeLambda(client, functionName, payload);
      res.json(result);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });
}

module.exports = { registerRunCommandRoutes };
