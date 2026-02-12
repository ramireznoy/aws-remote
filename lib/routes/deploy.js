const { loadConfig, getClient } = require('../config/config');
const { updatePipelineBranch, triggerPipeline } = require('../services/aws-pipeline');
const { notifyTeams, buildNotifyText } = require('../services/teams');
const { detectDeveloper } = require('../services/developer');

function registerDeployRoutes(app) {
  // Deploy: update pipeline source branches + trigger
  app.post('/api/deploy', async (req, res) => {
    const { environment, repos } = req.body;
    // repos: [{ name, pipelineName, branch }]
    const config = loadConfig();
    const client = getClient(config.awsProfile, config.awsRegion);
    const results = [];

    // Notify Teams that deployment is starting
    notifyTeams(config.teamsWebhookUrl, environment, detectDeveloper(), repos);

    for (const repo of repos) {
      const pipelineName = repo.pipelineName.replace('{env}', environment);
      try {
        // Update branch
        await updatePipelineBranch(client, pipelineName, repo.branch);

        // Trigger execution
        const { pipelineExecutionId } = await triggerPipeline(client, pipelineName);

        results.push({
          repo: repo.name,
          pipeline: pipelineName,
          status: 'triggered',
          executionId: pipelineExecutionId,
        });
      } catch (err) {
        results.push({
          repo: repo.name,
          pipeline: pipelineName,
          status: 'error',
          error: err.message,
        });
      }
    }

    // Include notification text in response (single source of truth)
    const notifyText = buildNotifyText(environment, detectDeveloper(), repos);
    res.json({ results, notifyText });
  });

  // Get notification message text (for manual copy-paste)
  app.post('/api/notify-message', (req, res) => {
    const { environment, repos } = req.body;
    if (!environment || !repos || !repos.length) {
      return res.status(400).json({ error: 'environment and repos are required' });
    }
    const developer = detectDeveloper();
    const notifyText = buildNotifyText(environment, developer, repos);
    res.json({ text: notifyText });
  });
}

module.exports = { registerDeployRoutes };
