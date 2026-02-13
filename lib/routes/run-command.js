const fs = require('fs');
const path = require('path');
const { loadConfig } = require('../config/config');
const { getLambdaClient, invokeLambda } = require('../services/lambda');

const COMMANDS_PATH = path.join(__dirname, '..', '..', 'commands.json');

function loadCommands() {
  try {
    return JSON.parse(fs.readFileSync(COMMANDS_PATH, 'utf-8'));
  } catch {
    return { templates: [] };
  }
}

function saveCommands(data) {
  fs.writeFileSync(COMMANDS_PATH, JSON.stringify(data, null, 2) + '\n');
}

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
      target_service: targetService,
      command: command.split(' '),
    };

    try {
      const result = await invokeLambda(client, functionName, payload);
      res.json(result);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // Get command templates
  app.get('/api/command-templates', (_req, res) => {
    res.json(loadCommands());
  });

  // Update command templates
  app.put('/api/command-templates', (req, res) => {
    try {
      saveCommands(req.body);
      res.json({ ok: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });
}

module.exports = { registerRunCommandRoutes };
