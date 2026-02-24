function EnvVarsPage({ environment, config, addToast }) {
  const [selectedRepo, setSelectedRepo] = React.useState('');
  const [search, setSearch] = React.useState('');
  const [dropdownOpen, setDropdownOpen] = React.useState(false);
  const [selectedContainer, setSelectedContainer] = React.useState(0);
  const [result, setResult] = React.useState(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState(null);

  const repos = (config?.repos || []).map(r => r.name);
  const filteredRepos = search
    ? repos.filter(r => r.toLowerCase().includes(search.toLowerCase()))
    : repos;

  function selectRepo(name) {
    setSelectedRepo(name);
    setSearch(name);
    setDropdownOpen(false);
  }

  function toDotEnv(vars) {
    return Object.entries(vars)
      .map(([k, v]) => `${k}=${v}`)
      .join('\n');
  }

  async function fetchEnvVars() {
    if (!selectedRepo) return;
    setLoading(true);
    setError(null);
    setResult(null);
    setSelectedContainer(0);
    try {
      const data = await api.getEnvVars(environment, selectedRepo);
      setResult(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  function copyToClipboard(text) {
    navigator.clipboard.writeText(text)
      .then(() => addToast('Copied to clipboard!', 'success'))
      .catch(() => addToast('Failed to copy', 'error'));
  }

  const container = result?.containers?.[selectedContainer];
  const dotEnvContent = container ? toDotEnv(container.vars) : '';
  const varCount = container ? Object.keys(container.vars).length : 0;

  return (
    <div className="container-xl py-4">
      <PageHeader
        icon="key"
        title="Env Variables"
        subtitle={`Pull .env from ECS task definitions — ${environment?.toUpperCase()}`}
      />

      {/* Controls */}
      <div className="card mb-4">
        <div className="card-body">
          <div className="row g-3 align-items-end">
            <div className="col">
              <label className="form-label">Repository</label>
              <div className="position-relative">
                <div className="input-icon">
                  <span className="input-icon-addon">
                    <i className="ti ti-search" />
                  </span>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="Search repository..."
                    value={search}
                    onChange={e => { setSearch(e.target.value); setSelectedRepo(''); }}
                    onFocus={() => setDropdownOpen(true)}
                    onBlur={() => setTimeout(() => setDropdownOpen(false), 150)}
                  />
                </div>
                {dropdownOpen && filteredRepos.length > 0 && (
                  <div className="dropdown-menu show w-100 repo-dropdown">
                    {filteredRepos.map(r => (
                      <a
                        key={r}
                        className={`dropdown-item ${r === selectedRepo ? 'active' : ''}`}
                        onMouseDown={() => selectRepo(r)}
                      >
                        {r}
                      </a>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <div className="col-auto">
              <button
                className="btn btn-primary"
                onClick={fetchEnvVars}
                disabled={!selectedRepo || loading}
              >
                {loading
                  ? <><span className="spinner-border spinner-border-sm me-2"></span>Fetching...</>
                  : <><i className="ti ti-download me-2"></i>Fetch .env</>
                }
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="alert alert-danger">
          <i className="ti ti-alert-circle me-2"></i>
          {error}
        </div>
      )}

      {/* Result */}
      {result && (
        <div className="card">
          <div className="card-header">
            <div className="d-flex align-items-center gap-3 flex-wrap w-100">
              <div>
                <span className="text-muted me-2">Task:</span>
                <code>{result.taskName}</code>
              </div>

              {/* Container tabs (if multiple) */}
              {result.containers.length > 1 && (
                <div className="ms-auto">
                  <div className="btn-group">
                    {result.containers.map((c, i) => (
                      <button
                        key={c.name}
                        className={`btn btn-sm ${selectedContainer === i ? 'btn-primary' : 'btn-outline-secondary'}`}
                        onClick={() => setSelectedContainer(i)}
                      >
                        {c.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className={result.containers.length > 1 ? '' : 'ms-auto'}>
                <span className="badge bg-blue-lt me-3">{varCount} variables</span>
                <button
                  className="btn btn-sm btn-outline-primary"
                  onClick={() => copyToClipboard(dotEnvContent)}
                >
                  <i className="ti ti-copy me-1"></i>Copy .env
                </button>
              </div>
            </div>
          </div>

          <div className="card-body p-0">
            <pre
              className="m-0 p-3"
              style={{
                fontFamily: 'monospace',
                fontSize: '0.8rem',
                maxHeight: '60vh',
                overflowY: 'auto',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-all',
              }}
            >
              {dotEnvContent}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}
