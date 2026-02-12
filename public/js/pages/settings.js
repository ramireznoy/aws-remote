// Settings Page — Full page for configuration

function SettingsPage({ config, profiles, onSave, onSelectProfile, addToast, credentialStatus }) {
  const [editConfig, setEditConfig] = React.useState(null);
  const [newRepoName, setNewRepoName] = React.useState('');
  const [newRepoPattern, setNewRepoPattern] = React.useState('');
  const [saving, setSaving] = React.useState(false);
  const [editingIndex, setEditingIndex] = React.useState(null);

  React.useEffect(() => {
    if (config) {
      setEditConfig(JSON.parse(JSON.stringify(config)));
    }
  }, [config]);

  if (!editConfig) return null;

  function addRepo() {
    if (!newRepoName.trim() || !newRepoPattern.trim()) return;
    const updated = {
      ...editConfig,
      repos: [...editConfig.repos, { name: newRepoName.trim(), pipelineName: newRepoPattern.trim() }],
    };
    setEditConfig(updated);
    setNewRepoName('');
    setNewRepoPattern('');
    onSave(updated);
  }

  function removeRepo(index) {
    const updated = {
      ...editConfig,
      repos: editConfig.repos.filter((_, i) => i !== index),
    };
    setEditConfig(updated);
    if (editingIndex === index) setEditingIndex(null);
    onSave(updated);
  }

  function updateRepo(index, field, value) {
    setEditConfig((prev) => ({
      ...prev,
      repos: prev.repos.map((r, i) => i === index ? { ...r, [field]: value } : r),
    }));
  }

  function finishEditing() {
    setEditingIndex(null);
    onSave(editConfig);
  }

  function cancelEditing() {
    setEditConfig(JSON.parse(JSON.stringify(config)));
    setEditingIndex(null);
  }

  async function handleSave() {
    setSaving(true);
    try {
      await onSave(editConfig);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="container-xl py-4">
      <div className="page-header mb-4">
        <div className="row align-items-center">
          <div className="col">
            <h2 className="page-title">
              <i className="ti ti-settings me-2" />
              Settings
            </h2>
            <div className="text-muted mt-1">Configure your pipelines, AWS connection, and notifications.</div>
          </div>
          <div className="col-auto">
            <button
              className="btn btn-primary"
              onClick={handleSave}
              disabled={saving}
            >
              {saving ? (
                <React.Fragment>
                  <span className="spinner-border spinner-border-sm me-2" />
                  Saving...
                </React.Fragment>
              ) : (
                <React.Fragment>
                  <i className="ti ti-device-floppy me-1" />
                  Save Changes
                </React.Fragment>
              )}
            </button>
          </div>
        </div>
      </div>

      <div className="row g-4">
        {/* Left column — AWS & Notifications */}
        <div className="col-md-5">
          {/* AWS Configuration */}
          <div className="card mb-4">
            <div className="card-header">
              <h3 className="card-title">
                <i className="ti ti-cloud me-2" />
                AWS Configuration
              </h3>
            </div>
            <div className="card-body">
              <div className="mb-3">
                <label className="form-label">AWS Profile</label>
                <select
                  className={`form-select ${credentialStatus?.status === 'invalid' ? 'is-invalid' : ''}`}
                  value={editConfig.awsProfile}
                  onChange={(e) => {
                    setEditConfig((prev) => ({ ...prev, awsProfile: e.target.value }));
                    onSelectProfile(e.target.value);
                  }}
                >
                  {profiles.map((p) => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </select>
                {credentialStatus?.status === 'invalid' && (
                  <div className="invalid-feedback d-block">
                    {credentialStatus.error}
                  </div>
                )}
              </div>
              <div className="mb-3">
                <label className="form-label">AWS Region</label>
                <input
                  type="text"
                  className="form-control"
                  value={editConfig.awsRegion}
                  onChange={(e) => setEditConfig((prev) => ({ ...prev, awsRegion: e.target.value }))}
                />
              </div>
              <div>
                <label className="form-label">Poll Interval (ms)</label>
                <input
                  type="number"
                  className="form-control"
                  value={editConfig.pollIntervalMs}
                  onChange={(e) => setEditConfig((prev) => ({ ...prev, pollIntervalMs: parseInt(e.target.value) || 5000 }))}
                />
                <div className="form-hint mt-1">How often to check pipeline status during deployments.</div>
              </div>
            </div>
          </div>

          {/* Teams Notifications */}
          <div className="card">
            <div className="card-header">
              <h3 className="card-title">
                <i className="ti ti-brand-teams me-2" />
                Teams Notifications
              </h3>
            </div>
            <div className="card-body">
              <div>
                <label className="form-label">Webhook URL</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="https://..."
                  value={editConfig.teamsWebhookUrl || ''}
                  onChange={(e) => setEditConfig((prev) => ({ ...prev, teamsWebhookUrl: e.target.value }))}
                />
                <div className="form-hint mt-1">
                  Workflow webhook URL for your Teams channel. Leave empty to disable notifications.
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right column — Repositories */}
        <div className="col-md-7">
          <div className="card">
            <div className="card-header d-flex justify-content-between align-items-center">
              <h3 className="card-title">
                <i className="ti ti-git-fork me-2" />
                Repositories & Pipeline Patterns
              </h3>
              <span className="badge bg-secondary-lt">{editConfig.repos.length} repos</span>
            </div>
            <div className="card-body p-0">
              <div className="table-responsive">
                <table className="table table-vcenter card-table">
                  <thead>
                    <tr>
                      <th>Repo Name</th>
                      <th>Pipeline Pattern</th>
                      <th style={{ width: 80 }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {editConfig.repos.map((repo, i) => (
                      <tr key={i}>
                        {editingIndex === i ? (
                          <React.Fragment>
                            <td>
                              <input
                                type="text"
                                className="form-control"
                                value={repo.name}
                                onChange={(e) => updateRepo(i, 'name', e.target.value)}
                                autoFocus
                              />
                            </td>
                            <td>
                              <input
                                type="text"
                                className="form-control"
                                value={repo.pipelineName}
                                onChange={(e) => updateRepo(i, 'pipelineName', e.target.value)}
                              />
                            </td>
                            <td>
                              <div className="d-flex gap-1">
                                <button
                                  className="btn btn-ghost-success btn-sm btn-icon"
                                  onClick={finishEditing}
                                  title="Save changes"
                                >
                                  <i className="ti ti-check" />
                                </button>
                                <button
                                  className="btn btn-ghost-danger btn-sm btn-icon"
                                  onClick={cancelEditing}
                                  title="Cancel editing"
                                >
                                  <i className="ti ti-x" />
                                </button>
                              </div>
                            </td>
                          </React.Fragment>
                        ) : (
                          <React.Fragment>
                            <td className="fw-bold">{repo.name}</td>
                            <td><code>{repo.pipelineName}</code></td>
                            <td>
                              <div className="d-flex gap-1">
                                <button
                                  className="btn btn-ghost-secondary btn-sm btn-icon"
                                  onClick={() => setEditingIndex(i)}
                                  title="Edit repo"
                                >
                                  <i className="ti ti-pencil" />
                                </button>
                                <button
                                  className="btn btn-ghost-danger btn-sm btn-icon"
                                  onClick={() => removeRepo(i)}
                                  title="Remove repo"
                                >
                                  <i className="ti ti-trash" />
                                </button>
                              </div>
                            </td>
                          </React.Fragment>
                        )}
                      </tr>
                    ))}
                    <tr>
                      <td>
                        <input
                          type="text"
                          className="form-control"
                          placeholder="repo-name"
                          value={newRepoName}
                          onChange={(e) => setNewRepoName(e.target.value)}
                          onKeyDown={(e) => e.key === 'Enter' && addRepo()}
                        />
                      </td>
                      <td>
                        <input
                          type="text"
                          className="form-control"
                          placeholder="{env}-repo-name"
                          value={newRepoPattern}
                          onChange={(e) => setNewRepoPattern(e.target.value)}
                          onKeyDown={(e) => e.key === 'Enter' && addRepo()}
                        />
                      </td>
                      <td>
                        <button
                          className="btn btn-ghost-success btn-sm btn-icon"
                          onClick={addRepo}
                          disabled={!newRepoName.trim() || !newRepoPattern.trim()}
                          title="Add repo"
                        >
                          <i className="ti ti-plus" />
                        </button>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
            <div className="card-footer">
              <div className="text-muted">
                Use <code>{'{env}'}</code> in pipeline patterns — it gets replaced with the environment name (e.g., uat1, uat2).
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
