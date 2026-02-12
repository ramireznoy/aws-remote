const fs = require('fs');
const path = require('path');
const { CodePipelineClient } = require('@aws-sdk/client-codepipeline');
const { fromIni } = require('@aws-sdk/credential-providers');

const CONFIG_PATH = path.join(__dirname, '..', '..', 'config.json');

function getAvailableProfiles() {
  try {
    const credPath = path.join(process.env.HOME || process.env.USERPROFILE, '.aws', 'config');
    const content = fs.readFileSync(credPath, 'utf-8');
    const profiles = [];
    for (const line of content.split('\n')) {
      const m = line.match(/^\[profile\s+(.+)\]$/) || line.match(/^\[(.+)\]$/);
      if (m) profiles.push(m[1]);
    }
    return profiles.length ? profiles : ['default'];
  } catch {
    return ['default'];
  }
}

function validateConfigProfile() {
  const config = loadConfig();
  const profiles = getAvailableProfiles();

  if (config.awsProfile && profiles.includes(config.awsProfile)) return;

  const newProfile = profiles[0];
  console.log(
    `AWS profile "${config.awsProfile || '(none)'}" not found in available profiles [${profiles.join(', ')}]. ` +
    `Switching to "${newProfile}".`
  );
  config.awsProfile = newProfile;
  saveConfig(config);
}

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

module.exports = { loadConfig, saveConfig, getClient, getAvailableProfiles, validateConfigProfile, CONFIG_PATH };
