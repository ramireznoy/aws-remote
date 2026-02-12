const { loadConfig, saveConfig, getAvailableProfiles } = require('../config/config');

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
    res.json(getAvailableProfiles());
  });
}

module.exports = { registerConfigRoutes };
