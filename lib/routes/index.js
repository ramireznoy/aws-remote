const { registerConfigRoutes } = require('./config');
const { registerDeveloperRoutes } = require('./developer');
const { registerCredentialsRoutes } = require('./credentials');
const { registerPipelineRoutes } = require('./pipelines');
const { registerDeployRoutes } = require('./deploy');
const { registerActionRoutes } = require('./actions');
const { registerRunCommandRoutes } = require('./run-command');
const { registerEnvVarsRoutes } = require('./env-vars');

function registerRoutes(app) {
  registerConfigRoutes(app);
  registerDeveloperRoutes(app);
  registerCredentialsRoutes(app);
  registerPipelineRoutes(app);
  registerDeployRoutes(app);
  registerActionRoutes(app);
  registerRunCommandRoutes(app);
  registerEnvVarsRoutes(app);
}

module.exports = { registerRoutes };
