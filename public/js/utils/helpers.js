// Shared utility functions

function timeAgo(dateStr) {
  if (!dateStr) return '';
  const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return minutes + 'm ago';
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return hours + 'h ago';
  const days = Math.floor(hours / 24);
  return days + 'd ago';
}

var execColorMap = {
  Succeeded: 'success',
  Failed: 'danger',
  InProgress: 'info',
  Stopped: 'warning',
  Superseded: 'secondary',
  Stopping: 'warning',
};

function resolveName(pattern, envName, repoName) {
  return (pattern || '').replace('{env}', envName).replace('{repo}', repoName || '');
}

function getEnvObject(config, envName) {
  return (config.environments || []).find(function(e) { return e.name === envName; });
}
