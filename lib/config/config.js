const fs = require('fs');
const path = require('path');
const { CodePipelineClient } = require('@aws-sdk/client-codepipeline');
const { fromIni } = require('@aws-sdk/credential-providers');

const CONFIG_PATH = path.join(__dirname, '..', '..', 'config.json');

function loadConfig() {
  return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8'));
}

function saveConfig(config) {
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2) + '\n');
}

function getClient(profile, region) {
  const opts = { region };
  if (profile && profile !== 'default') {
    opts.credentials = fromIni({ profile });
  }
  return new CodePipelineClient(opts);
}

module.exports = { loadConfig, saveConfig, getClient, CONFIG_PATH };
