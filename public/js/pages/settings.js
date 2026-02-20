// Settings Page — Full page for configuration

function SettingsPage({ config, profiles, onSave, onSelectProfile, addToast, credentialStatus }) {
  const [editConfig, setEditConfig] = React.useState(null);
  const [saving, setSaving] = React.useState(false);
  const [expandedRepos, setExpandedRepos] = React.useState({});
  const [expandedEnvs, setExpandedEnvs] = React.useState({});
  const [confirmDelete, setConfirmDelete] = React.useState(null); // { message, onConfirm }

  // New repo form
  const [newRepoName, setNewRepoName] = React.useState('');

  // New environment form
  const [newEnvName, setNewEnvName] = React.useState('');

  React.useEffect(() => {
    if (config) {
      setEditConfig(JSON.parse(JSON.stringify(config)));
    }
  }, [config]);

  if (!editConfig) return null;

  const commandAliases = editConfig.commandAliases || [];

  // --- Save ---
  async function handleSave() {
    setSaving(true);
    try {
      await onSave(editConfig);
    } finally {
      setSaving(false);
    }
  }

  // --- Environment CRUD ---
  function addEnvironment() {
    if (!newEnvName.trim()) return;
    const updated = {
      ...editConfig,
      environments: [...editConfig.environments, {
        name: newEnvName.trim(),
        awsProfile: editConfig.awsProfile,
        awsRegion: editConfig.awsRegion,
        pipelinePattern: '{env}-{repo}-CodePipeline',
        lambdaName: '{env}-run-command',
        taskPattern: '{env}-{repo}',
      }],
    };
    setEditConfig(updated);
    setNewEnvName('');
    onSave(updated);
  }

  function confirmRemoveEnv(index) {
    const env = editConfig.environments[index];
    setConfirmDelete({
      message: `Remove environment "${env.name}"?`,
      onConfirm: () => {
        const updated = {
          ...editConfig,
          environments: editConfig.environments.filter((_, i) => i !== index),
        };
        setEditConfig(updated);
        onSave(updated);
        setConfirmDelete(null);
      },
    });
  }

  function updateEnvField(index, field, value) {
    setEditConfig((prev) => ({
      ...prev,
      environments: prev.environments.map((e, i) => i === index ? { ...e, [field]: value } : e),
    }));
  }

  function saveEnvField(updated) {
    onSave(updated || editConfig);
  }

  function toggleEnv(index) {
    setExpandedEnvs((prev) => ({ ...prev, [index]: !prev[index] }));
  }

  // --- Repo CRUD ---
  function addRepo() {
    if (!newRepoName.trim()) return;
    const updated = {
      ...editConfig,
      repos: [...editConfig.repos, { name: newRepoName.trim(), scripts: [] }],
    };
    setEditConfig(updated);
    setNewRepoName('');
    onSave(updated);
  }

  function confirmRemoveRepo(index) {
    const repo = editConfig.repos[index];
    setConfirmDelete({
      message: `Remove repository "${repo.name}" and all its scripts?`,
      onConfirm: () => {
        const updated = {
          ...editConfig,
          repos: editConfig.repos.filter((_, i) => i !== index),
        };
        setEditConfig(updated);
        onSave(updated);
        setConfirmDelete(null);
      },
    });
  }

  function updateRepoField(index, field, value) {
    setEditConfig((prev) => ({
      ...prev,
      repos: prev.repos.map((r, i) => i === index ? { ...r, [field]: value } : r),
    }));
  }

  function saveRepoField() {
    onSave(editConfig);
  }

  // --- Per-repo scripts ---
  function addScript(repoIndex, script) {
    const updated = {
      ...editConfig,
      repos: editConfig.repos.map((r, i) => {
        if (i !== repoIndex) return r;
        return { ...r, scripts: [...(r.scripts || []), script] };
      }),
    };
    setEditConfig(updated);
    onSave(updated);
  }

  function confirmRemoveScript(repoIndex, scriptIndex) {
    const script = editConfig.repos[repoIndex].scripts[scriptIndex];
    setConfirmDelete({
      message: `Remove script "${script.name}"?`,
      onConfirm: () => {
        const updated = {
          ...editConfig,
          repos: editConfig.repos.map((r, i) => {
            if (i !== repoIndex) return r;
            return { ...r, scripts: r.scripts.filter((_, si) => si !== scriptIndex) };
          }),
        };
        setEditConfig(updated);
        onSave(updated);
        setConfirmDelete(null);
      },
    });
  }

  function updateScript(repoIndex, scriptIndex, updatedScript) {
    const updated = {
      ...editConfig,
      repos: editConfig.repos.map((r, i) => {
        if (i !== repoIndex) return r;
        return { ...r, scripts: r.scripts.map((s, si) => si === scriptIndex ? updatedScript : s) };
      }),
    };
    setEditConfig(updated);
    onSave(updated);
  }

  // --- Global command aliases ---
  function addGlobalAlias(script) {
    const updated = {
      ...editConfig,
      commandAliases: [...commandAliases, script],
    };
    setEditConfig(updated);
    onSave(updated);
  }

  function confirmRemoveGlobalAlias(index) {
    const alias = commandAliases[index];
    setConfirmDelete({
      message: `Remove global command "${alias.name}"?`,
      onConfirm: () => {
        const updated = {
          ...editConfig,
          commandAliases: commandAliases.filter((_, i) => i !== index),
        };
        setEditConfig(updated);
        onSave(updated);
        setConfirmDelete(null);
      },
    });
  }

  function updateGlobalAlias(index, updatedScript) {
    const updated = {
      ...editConfig,
      commandAliases: commandAliases.map((t, i) => i === index ? updatedScript : t),
    };
    setEditConfig(updated);
    onSave(updated);
  }

  // --- Expand/collapse ---
  function toggleRepo(index) {
    setExpandedRepos((prev) => ({ ...prev, [index]: !prev[index] }));
  }

  // --- ScriptTable: reusable for global aliases and per-repo scripts ---
  function ScriptTable({ scripts, onAdd, onRemove, onEdit }) {
    const [editingIndex, setEditingIndex] = React.useState(null);
    const [editValues, setEditValues] = React.useState({});
    const [adding, setAdding] = React.useState(false);
    const [newValues, setNewValues] = React.useState({ name: '', command: '', description: '' });

    function startEditing(i) {
      setEditingIndex(i);
      setEditValues({ ...scripts[i] });
    }

    function cancelEditing() {
      setEditingIndex(null);
      setEditValues({});
    }

    function finishEditing() {
      if (!editValues.name?.trim() || !editValues.command?.trim()) return;
      onEdit(editingIndex, {
        name: editValues.name.trim(),
        command: editValues.command.trim(),
        description: (editValues.description || '').trim(),
      });
      setEditingIndex(null);
      setEditValues({});
    }

    function handleAdd() {
      if (!newValues.name.trim() || !newValues.command.trim()) return;
      onAdd({
        name: newValues.name.trim(),
        command: newValues.command.trim(),
        description: newValues.description.trim(),
      });
      setNewValues({ name: '', command: '', description: '' });
      setAdding(false);
    }

    return (
      <React.Fragment>
        {scripts.length > 0 && (
          <div className="table-responsive">
            <table className="table table-vcenter mb-0">
              <thead>
                <tr>
                  <th style={{ width: '20%' }}>Name</th>
                  <th style={{ width: '35%' }}>Command</th>
                  <th>Description</th>
                  <th style={{ width: 80 }}></th>
                </tr>
              </thead>
              <tbody>
                {scripts.map((s, i) => (
                  <tr key={i}>
                    {editingIndex === i ? (
                      <React.Fragment>
                        <td>
                          <input
                            type="text" className="form-control" value={editValues.name}
                            onChange={(e) => setEditValues((v) => ({ ...v, name: e.target.value }))}
                            onKeyDown={(e) => e.key === 'Enter' && finishEditing()}
                            autoFocus
                          />
                        </td>
                        <td>
                          <input
                            type="text" className="form-control" value={editValues.command}
                            onChange={(e) => setEditValues((v) => ({ ...v, command: e.target.value }))}
                            onKeyDown={(e) => e.key === 'Enter' && finishEditing()}
                          />
                        </td>
                        <td>
                          <input
                            type="text" className="form-control" value={editValues.description || ''}
                            onChange={(e) => setEditValues((v) => ({ ...v, description: e.target.value }))}
                            onKeyDown={(e) => e.key === 'Enter' && finishEditing()}
                          />
                        </td>
                        <td>
                          <div className="d-flex gap-1">
                            <button className="btn btn-ghost-success btn-sm btn-icon" onClick={finishEditing} title="Save">
                              <i className="ti ti-check" />
                            </button>
                            <button className="btn btn-ghost-danger btn-sm btn-icon" onClick={cancelEditing} title="Cancel">
                              <i className="ti ti-x" />
                            </button>
                          </div>
                        </td>
                      </React.Fragment>
                    ) : (
                      <React.Fragment>
                        <td><code>{s.name}</code></td>
                        <td><code>{s.command}</code></td>
                        <td className="text-muted">{s.description}</td>
                        <td>
                          <div className="d-flex gap-1">
                            <button className="btn btn-ghost-secondary btn-sm btn-icon" onClick={() => startEditing(i)} title="Edit">
                              <i className="ti ti-pencil" />
                            </button>
                            <button className="btn btn-ghost-danger btn-sm btn-icon" onClick={() => onRemove(i)} title="Remove">
                              <i className="ti ti-trash" />
                            </button>
                          </div>
                        </td>
                      </React.Fragment>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {adding ? (
          <div className="p-3 d-flex gap-2 align-items-end">
            <div style={{ flex: '1 1 20%' }}>
              <label className="form-label mb-1">Name</label>
              <input
                type="text" className="form-control" placeholder="migrate"
                value={newValues.name} onChange={(e) => setNewValues((v) => ({ ...v, name: e.target.value }))}
                onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
                autoFocus
              />
            </div>
            <div style={{ flex: '1 1 35%' }}>
              <label className="form-label mb-1">Command</label>
              <input
                type="text" className="form-control" placeholder="npm run migrate"
                value={newValues.command} onChange={(e) => setNewValues((v) => ({ ...v, command: e.target.value }))}
                onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
              />
            </div>
            <div style={{ flex: '1 1 30%' }}>
              <label className="form-label mb-1">Description</label>
              <input
                type="text" className="form-control" placeholder="Run migrations"
                value={newValues.description} onChange={(e) => setNewValues((v) => ({ ...v, description: e.target.value }))}
                onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
              />
            </div>
            <div className="d-flex gap-1">
              <button className="btn btn-success btn-icon" onClick={handleAdd} disabled={!newValues.name.trim() || !newValues.command.trim()} title="Add">
                <i className="ti ti-check" />
              </button>
              <button className="btn btn-ghost-secondary btn-icon" onClick={() => setAdding(false)} title="Cancel">
                <i className="ti ti-x" />
              </button>
            </div>
          </div>
        ) : (
          <div className="p-3">
            <button className="btn btn-ghost-primary" onClick={() => setAdding(true)}>
              <i className="ti ti-plus me-1" />
              Add script
            </button>
          </div>
        )}
      </React.Fragment>
    );
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
            <div className="text-muted mt-1">Configure your environments, repos, AWS connection, and notifications.</div>
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
                <label className="form-label">Active AWS Profile</label>
                <select
                  className={`form-select ${credentialStatus?.status === 'invalid' ? 'is-invalid' : ''}`}
                  value={editConfig.awsProfile}
                  onChange={(e) => {
                    setEditConfig((prev) => ({ ...prev, awsProfile: e.target.value }));
                    onSelectProfile(e.target.value);
                  }}
                >
                  {profiles.map((p) => (
                    <option key={p.name} value={p.name}>{p.name}</option>
                  ))}
                </select>
                {credentialStatus?.status === 'invalid' && (
                  <div className="invalid-feedback d-block">
                    {credentialStatus.error}
                  </div>
                )}
                <div className="form-hint mt-1">
                  Determines which environments are available. Only environments with a matching profile will be active.
                </div>
              </div>
              <div className="mb-3">
                <label className="form-label">Default AWS Region</label>
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

        {/* Right column — Environments, Global Aliases, Repos */}
        <div className="col-md-7">
          {/* Environments */}
          <div className="card mb-4">
            <div className="card-header d-flex justify-content-between align-items-center">
              <h3 className="card-title">
                <i className="ti ti-server me-2" />
                Environments
              </h3>
              <span className="badge bg-secondary-lt">{editConfig.environments.length} environments</span>
            </div>
            <div className="card-body p-0">
              {editConfig.environments.map((env, i) => {
                const isExpanded = expandedEnvs[i];
                const isActive = env.awsProfile === editConfig.awsProfile;

                return (
                  <div key={i} className="border-bottom">
                    <div
                      className="d-flex align-items-center px-3 py-2"
                      style={{ cursor: 'pointer' }}
                      onClick={() => toggleEnv(i)}
                    >
                      <i className={`ti ti-chevron-${isExpanded ? 'down' : 'right'} me-2 text-muted`} />
                      <span className="fw-bold flex-grow-1">{env.name}</span>
                      <span className={`badge me-2 ${isActive ? 'bg-success-lt' : 'bg-secondary-lt'}`}>
                        {env.awsProfile}
                      </span>
                      <button
                        className="btn btn-ghost-danger btn-sm btn-icon"
                        onClick={(e) => { e.stopPropagation(); confirmRemoveEnv(i); }}
                        title="Remove environment"
                      >
                        <i className="ti ti-trash" />
                      </button>
                    </div>

                    {isExpanded && (
                      <div className="px-3 pb-3" style={{ marginLeft: '1.5rem' }}>
                        <div className="row g-2 mb-2">
                          <div className="col-md-4">
                            <label className="form-label mb-1">Name</label>
                            <input
                              type="text" className="form-control"
                              value={env.name}
                              onChange={(e) => updateEnvField(i, 'name', e.target.value)}
                              onBlur={() => saveEnvField()}
                            />
                          </div>
                          <div className="col-md-4">
                            <label className="form-label mb-1">AWS Profile</label>
                            <input
                              type="text" className="form-control"
                              value={env.awsProfile}
                              onChange={(e) => updateEnvField(i, 'awsProfile', e.target.value)}
                              onBlur={() => saveEnvField()}
                            />
                          </div>
                          <div className="col-md-4">
                            <label className="form-label mb-1">AWS Region</label>
                            <input
                              type="text" className="form-control"
                              value={env.awsRegion}
                              onChange={(e) => updateEnvField(i, 'awsRegion', e.target.value)}
                              onBlur={() => saveEnvField()}
                            />
                          </div>
                        </div>
                        <div className="row g-2">
                          <div className="col-md-4">
                            <label className="form-label mb-1">Pipeline Pattern</label>
                            <input
                              type="text" className="form-control"
                              value={env.pipelinePattern}
                              onChange={(e) => updateEnvField(i, 'pipelinePattern', e.target.value)}
                              onBlur={() => saveEnvField()}
                            />
                            <div className="form-hint mt-1">Use <code>{'{env}'}</code> and <code>{'{repo}'}</code></div>
                          </div>
                          <div className="col-md-4">
                            <label className="form-label mb-1">Lambda Name</label>
                            <input
                              type="text" className="form-control"
                              value={env.lambdaName}
                              onChange={(e) => updateEnvField(i, 'lambdaName', e.target.value)}
                              onBlur={() => saveEnvField()}
                            />
                          </div>
                          <div className="col-md-4">
                            <label className="form-label mb-1">Task Pattern</label>
                            <input
                              type="text" className="form-control"
                              value={env.taskPattern}
                              onChange={(e) => updateEnvField(i, 'taskPattern', e.target.value)}
                              onBlur={() => saveEnvField()}
                            />
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}

              {/* Add environment form */}
              <div className="px-3 py-3 d-flex gap-2 align-items-end">
                <div className="flex-grow-1">
                  <input
                    type="text"
                    className="form-control"
                    placeholder="env-name"
                    value={newEnvName}
                    onChange={(e) => setNewEnvName(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && addEnvironment()}
                  />
                </div>
                <button
                  className="btn btn-ghost-success btn-icon"
                  onClick={addEnvironment}
                  disabled={!newEnvName.trim()}
                  title="Add environment"
                >
                  <i className="ti ti-plus" />
                </button>
              </div>
            </div>
            <div className="card-footer">
              <div className="text-muted">
                Use <code>{'{env}'}</code> and <code>{'{repo}'}</code> placeholders in patterns. New environments inherit the current default profile and region.
              </div>
            </div>
          </div>

          {/* Global Command Aliases */}
          <div className="card mb-4">
            <div className="card-header d-flex justify-content-between align-items-center">
              <h3 className="card-title">
                <i className="ti ti-terminal me-2" />
                Global Command Aliases
              </h3>
              <span className="badge bg-secondary-lt">{commandAliases.length} commands</span>
            </div>
            <div className="card-body p-0">
              <ScriptTable
                scripts={commandAliases}
                onAdd={(s) => addGlobalAlias(s)}
                onRemove={(i) => confirmRemoveGlobalAlias(i)}
                onEdit={(i, s) => updateGlobalAlias(i, s)}
              />
            </div>
            <div className="card-footer">
              <div className="text-muted">
                Global command aliases are available in all services via the Terminal.
              </div>
            </div>
          </div>

          {/* Repositories */}
          <div className="card">
            <div className="card-header d-flex justify-content-between align-items-center">
              <h3 className="card-title">
                <i className="ti ti-git-fork me-2" />
                Repositories
              </h3>
              <span className="badge bg-secondary-lt">{editConfig.repos.length} repos</span>
            </div>
            <div className="card-body p-0">
              {editConfig.repos.map((repo, i) => {
                const isExpanded = expandedRepos[i];
                const scriptCount = (repo.scripts || []).length;

                return (
                  <div key={i} className="border-bottom">
                    <div
                      className="d-flex align-items-center px-3 py-2"
                      style={{ cursor: 'pointer' }}
                      onClick={() => toggleRepo(i)}
                    >
                      <i className={`ti ti-chevron-${isExpanded ? 'down' : 'right'} me-2 text-muted`} />
                      <span className="fw-bold flex-grow-1">{repo.name}</span>
                      {scriptCount > 0 && (
                        <span className="badge bg-blue-lt me-2">{scriptCount} scripts</span>
                      )}
                      <button
                        className="btn btn-ghost-danger btn-sm btn-icon"
                        onClick={(e) => { e.stopPropagation(); confirmRemoveRepo(i); }}
                        title="Remove repo"
                      >
                        <i className="ti ti-trash" />
                      </button>
                    </div>

                    {isExpanded && (
                      <div className="px-3 pb-3" style={{ marginLeft: '1.5rem' }}>
                        <div className="mb-3">
                          <label className="form-label mb-1">Repo Name</label>
                          <input
                            type="text"
                            className="form-control"
                            value={repo.name}
                            onChange={(e) => updateRepoField(i, 'name', e.target.value)}
                            onBlur={saveRepoField}
                          />
                        </div>

                        <label className="form-label mb-1">Scripts</label>
                        <div className="border rounded">
                          <ScriptTable
                            scripts={repo.scripts || []}
                            onAdd={(s) => addScript(i, s)}
                            onRemove={(si) => confirmRemoveScript(i, si)}
                            onEdit={(si, s) => updateScript(i, si, s)}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}

              {/* Add repo form */}
              <div className="px-3 py-3 d-flex gap-2 align-items-end">
                <div className="flex-grow-1">
                  <input
                    type="text"
                    className="form-control"
                    placeholder="repo-name"
                    value={newRepoName}
                    onChange={(e) => setNewRepoName(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && addRepo()}
                  />
                </div>
                <button
                  className="btn btn-ghost-success btn-icon"
                  onClick={addRepo}
                  disabled={!newRepoName.trim()}
                  title="Add repo"
                >
                  <i className="ti ti-plus" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <ConfirmModal
        show={!!confirmDelete}
        title="Confirm Delete"
        message={confirmDelete ? confirmDelete.message : ''}
        confirmText="Delete"
        confirmColor="danger"
        onConfirm={confirmDelete ? confirmDelete.onConfirm : () => {}}
        onCancel={() => setConfirmDelete(null)}
      />
    </div>
  );
}
