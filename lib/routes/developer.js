const { detectDeveloper } = require('../services/developer');

function registerDeveloperRoutes(app) {
  // Get auto-detected developer name
  app.get('/api/developer', (_req, res) => {
    res.json({ name: detectDeveloper() });
  });
}

module.exports = { registerDeveloperRoutes };
