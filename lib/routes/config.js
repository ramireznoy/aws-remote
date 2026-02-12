const fs = require('fs');
const path = require('path');
const { loadConfig, saveConfig } = require('../config/config');

function registerConfigRoutes(app) {
  // Get config
  app.get('/api/config', (_req, res) => {
    try {
      res.json(loadConfig());
    } catch (err) {
      res.status(500).json({ error: 'Failed to load config: ' + err.message });
    }
  });

  // Update config
  app.put('/api/config', (req, res) => {
    try {
      saveConfig(req.body);
      res.json({ ok: true });
    } catch (err) {
      res.status(500).json({ error: 'Failed to save config: ' + err.message });
    }
  });

  // List available AWS profiles
  app.get('/api/profiles', (_req, res) => {
    try {
      const credPath = path.join(process.env.HOME || process.env.USERPROFILE, '.aws', 'config');
      const content = fs.readFileSync(credPath, 'utf-8');
      const profiles = [];
      for (const line of content.split('\n')) {
        const m = line.match(/^\[profile\s+(.+)\]$/) || line.match(/^\[(.+)\]$/);
        if (m) profiles.push(m[1]);
      }
      res.json(profiles);
    } catch (err) {
      res.json(['default']);
    }
  });
}

module.exports = { registerConfigRoutes };
