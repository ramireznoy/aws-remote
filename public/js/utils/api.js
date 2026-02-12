// API helper — plain JS, no JSX
var api = (function () {
  async function request(method, url, body) {
    const opts = {
      method,
      headers: { 'Content-Type': 'application/json' },
    };
    if (body) opts.body = JSON.stringify(body);
    const res = await fetch(url, opts);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Request failed');
    return data;
  }

  return {
    getConfig: () => request('GET', '/api/config'),
    saveConfig: (config) => request('PUT', '/api/config', config),
    getProfiles: () => request('GET', '/api/profiles'),
    validateCredentials: () => request('GET', '/api/validate-credentials'),
    getPipelines: (env) => request('GET', '/api/pipelines/' + encodeURIComponent(env)),
    getDeveloper: () => request('GET', '/api/developer'),
    deploy: (payload) => request('POST', '/api/deploy', payload),
    getNotifyMessage: (payload) => request('POST', '/api/notify-message', payload),
    trigger: (pipelineName) => request('POST', '/api/trigger', { pipelineName }),
    stopPipeline: (pipelineName, executionId) => request('POST', '/api/stop', { pipelineName, executionId }),
    getStatus: (pipelineNames) =>
      request('GET', '/api/status?pipelines=' + pipelineNames.map(encodeURIComponent).join(',')),
  };
})();
