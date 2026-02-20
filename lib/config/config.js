const fs = require('fs');
const path = require('path');
const { CodePipelineClient } = require('@aws-sdk/client-codepipeline');
const { fromSSO } = require('@aws-sdk/credential-providers');

const CONFIG_PATH = path.join(__dirname, '..', '..', 'config.json');

function getAvailableProfiles() {
  try {
    const credPath = path.join(process.env.HOME || process.env.USERPROFILE, '.aws', 'config');
    const content = fs.readFileSync(credPath, 'utf-8');
    const profiles = [];
    let current = null;
    for (const rawLine of content.split('\n')) {
      const line = rawLine.trimEnd();
      const header = line.match(/^\[profile\s+(.+)\]$/) || line.match(/^\[(default)\]$/);
      if (header) {
        current = { name: header[1], region: null };
        profiles.push(current);
        continue;
      }
      if (current) {
        const regionMatch = line.match(/^region\s*=\s*(.+)$/);
        if (regionMatch) current.region = regionMatch[1].trim();
      }
    }
    return profiles.length ? profiles : [{ name: 'default', region: null }];
  } catch {
    return [{ name: 'default', region: null }];
  }
}

function validateConfigProfile() {
  const config = loadConfig();
  const profiles = getAvailableProfiles();

  if (config.awsProfile && profiles.some((p) => p.name === config.awsProfile)) return;

  const newProfile = profiles[0].name;
  console.log(
    `AWS profile "${config.awsProfile || '(none)'}" not found in available profiles [${profiles.map((p) => p.name).join(', ')}]. ` +
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
    opts.credentials = fromSSO({ profile });
  }
  return new CodePipelineClient(opts);
}

module.exports = { loadConfig, saveConfig, getClient, getAvailableProfiles, validateConfigProfile, CONFIG_PATH };
