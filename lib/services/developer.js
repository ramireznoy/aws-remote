const os = require('os');
const { execSync } = require('child_process');

function detectDeveloper() {
  // Try git user.name first, fall back to OS username
  try {
    return execSync('git config user.name', { encoding: 'utf-8' }).trim();
  } catch {
    return os.userInfo().username;
  }
}

module.exports = { detectDeveloper };
