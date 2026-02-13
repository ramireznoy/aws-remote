// Root App Component

function App() {
  const validTabs = ['deploy', 'multi-env', 'terminal', 'settings'];

  function parseRoute(pathname) {
    const parts = pathname.replace(/^\//, '').split('/');
    const tab = validTabs.includes(parts[0]) ? parts[0] : 'deploy';
    return { tab };
  }

  const initial = parseRoute(window.location.pathname);
  const [activeTab, setActiveTab] = React.useState(initial.tab);
  const [environment, setEnvironment] = React.useState(() => localStorage.getItem('rc-environment'));
  const [config, setConfig] = React.useState(null);
  const [profiles, setProfiles] = React.useState(['default']);
  const [toasts, setToasts] = React.useState([]);
  const [dark, setDark] = React.useState(() => localStorage.getItem('rc-theme') === 'dark');
  const [credentialStatus, setCredentialStatus] = React.useState({ status: 'loading', profile: null, error: null });

  const toastIdRef = React.useRef(0);

  // Theme
  React.useEffect(() => {
    document.documentElement.setAttribute('data-bs-theme', dark ? 'dark' : 'light');
    localStorage.setItem('rc-theme', dark ? 'dark' : 'light');
  }, [dark]);

  // Load config + profiles on mount
  React.useEffect(() => {
    api.getConfig().then(setConfig).catch(() => {});
    api.getProfiles().then(setProfiles).catch(() => {});

    // Validate AWS credentials
    setCredentialStatus({ status: 'loading', profile: null, error: null });
    api.validateCredentials()
      .then((data) => {
        setCredentialStatus({ status: 'valid', profile: data.profile, error: null });
      })
      .catch((err) => {
        setCredentialStatus({ status: 'invalid', profile: null, error: err.message });
      });

    // Request notification permission
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, []);

  // Once config loads, ensure we have a valid environment
  React.useEffect(() => {
    if (!config) return;
    if (environment && config.environments.includes(environment)) return;
    if (config.environments.length) setEnvironment(config.environments[0]);
  }, [config]);

  // Persist environment to localStorage
  React.useEffect(() => {
    if (environment) localStorage.setItem('rc-environment', environment);
  }, [environment]);

  // URL routing with pushState
  function switchTab(tab) {
    setActiveTab(tab);
    window.history.pushState(null, '', '/' + tab);
  }

  React.useEffect(() => {
    function onPopState() {
      const route = parseRoute(window.location.pathname);
      setActiveTab(route.tab);
    }
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  function addToast(message, type) {
    const id = ++toastIdRef.current;
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => removeToast(id), 4000);
  }

  function removeToast(id) {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }

  async function switchToProfile(profile) {
    if (!config) return;
    const updated = { ...config, awsProfile: profile };
    setConfig(updated);

    try {
      await api.saveConfig(updated);
      // Validate credentials after switching profile
      setCredentialStatus({ status: 'loading', profile: null, error: null });
      const data = await api.validateCredentials();
      setCredentialStatus({ status: 'valid', profile: data.profile, error: null });
    } catch (err) {
      setCredentialStatus({ status: 'invalid', profile: profile, error: err.message });
    }
  }

  function switchEnvironment(env) {
    setEnvironment(env);
  }

  async function saveConfig(newConfig) {
    try {
      await api.saveConfig(newConfig);
      setConfig(newConfig);
      addToast('Configuration saved', 'success');
    } catch (err) {
      addToast('Failed to save: ' + err.message, 'error');
    }
  }

  const envColors = {
    uat1: 'blue', uat2: 'azure', uat3: 'indigo', uat4: 'purple', uat5: 'pink',
  };
  const envColor = environment ? (envColors[environment] || 'primary') : 'primary';

  if (!config || !environment) return null;

  return (
    <React.Fragment>
      <Toast toasts={toasts} removeToast={removeToast} />

      <div className="page">
        {/* Shared Navbar — follows Tabler UI structure from RBAC editor */}
        <header className="navbar navbar-expand-md d-print-none">
          <div className="container-xl">
            <button className="navbar-toggler" type="button" data-bs-toggle="collapse" data-bs-target="#navbar-menu">
              <span className="navbar-toggler-icon"></span>
            </button>
            <h1 className="navbar-brand navbar-brand-autodark d-none-navbar-btn pe-0 pe-md-3">
              <i className="ti ti-rocket me-2"></i>Remote Control
            </h1>
            <div className="collapse navbar-collapse" id="navbar-menu">
              <ul className="navbar-nav">
                <li className={`nav-item ${activeTab === 'deploy' ? 'active' : ''}`}>
                  <a className="nav-link"
                    href="/deploy" onClick={(e) => { e.preventDefault(); switchTab('deploy'); }}>
                    <span className="nav-link-icon"><i className="ti ti-player-play"></i></span>
                    <span className="nav-link-title">Deploy</span>
                  </a>
                </li>
                <li className={`nav-item ${activeTab === 'multi-env' ? 'active' : ''}`}>
                  <a className="nav-link"
                    href="/multi-env" onClick={(e) => { e.preventDefault(); switchTab('multi-env'); }}>
                    <span className="nav-link-icon"><i className="ti ti-topology-star-3"></i></span>
                    <span className="nav-link-title">Multi-Env</span>
                  </a>
                </li>
                <li className={`nav-item ${activeTab === 'terminal' ? 'active' : ''}`}>
                  <a className="nav-link"
                    href="/terminal" onClick={(e) => { e.preventDefault(); switchTab('terminal'); }}>
                    <span className="nav-link-icon"><i className="ti ti-terminal-2"></i></span>
                    <span className="nav-link-title">Terminal</span>
                  </a>
                </li>
                <li className={`nav-item ${activeTab === 'settings' ? 'active' : ''}`}>
                  <a className="nav-link"
                    href="/settings" onClick={(e) => { e.preventDefault(); switchTab('settings'); }}>
                    <span className="nav-link-icon"><i className="ti ti-settings"></i></span>
                    <span className="nav-link-title">Settings</span>
                  </a>
                </li>
              </ul>
            </div>
            <div className="navbar-nav flex-row order-md-last ms-auto gap-2 align-items-center">
              <button className="btn btn-ghost-secondary btn-icon"
                onClick={() => setDark((d) => !d)}
                title={dark ? 'Switch to light mode' : 'Switch to dark mode'}>
                <i className={`ti ${dark ? 'ti-sun' : 'ti-moon'} icon-nav`}></i>
              </button>

              {/* AWS Profile Indicator */}
              <div className={`badge d-inline-flex align-items-center ${
                credentialStatus.status === 'valid' ? 'bg-success-lt' :
                credentialStatus.status === 'invalid' ? 'bg-danger-lt' :
                'bg-info-lt'
              }`}
                title={
                  credentialStatus.status === 'valid' ? `AWS credentials valid (${credentialStatus.profile})` :
                  credentialStatus.status === 'invalid' ? `AWS credentials invalid: ${credentialStatus.error}` :
                  'Validating AWS credentials...'
                }
                style={{ cursor: 'help' }}
              >
                <i className={`ti ${
                  credentialStatus.status === 'valid' ? 'ti-brand-aws' :
                  credentialStatus.status === 'invalid' ? 'ti-cloud-x' :
                  'ti-loader'
                } me-1`}></i>
                {credentialStatus.status === 'valid' ? credentialStatus.profile :
                 credentialStatus.status === 'invalid' ? (credentialStatus.profile || 'AWS') :
                 'AWS'}
              </div>

              <select
                className={`form-select bg-${envColor}-lt env-select`}
                value={environment}
                onChange={(e) => switchEnvironment(e.target.value)}
              >
                {config.environments.map((env) => (
                  <option key={env} value={env}>{env.toUpperCase()}</option>
                ))}
              </select>
            </div>
          </div>
        </header>

        {/* Page Content — all tabs stay mounted to preserve state */}
        <div className="page-body">
          {/* AWS Credential Error Banner */}
          {credentialStatus.status === 'invalid' && (
            <div className="container-xl mt-3">
              <div className="bg-danger text-white p-3 rounded" role="alert">
                <div className="d-flex align-items-start">
                  <div className="flex-shrink-0">
                    <i className="ti ti-cloud-x icon-nav"></i>
                  </div>
                  <div className="flex-grow-1 ms-3">
                    <h4 className="text-white mb-2">AWS Credentials Invalid</h4>
                    <div className="mb-2">{credentialStatus.error}</div>
                    <div className="d-flex align-items-center gap-2 mt-2">
                      <code className="bg-dark text-white px-2 py-1 rounded flex-grow-1">
                        aws sso login --profile {config?.awsProfile || 'your-profile-name'}
                      </code>
                      <i
                        className="ti ti-copy"
                        style={{ cursor: 'pointer', fontSize: '1.25rem' }}
                        onClick={() => {
                          const cmd = `aws sso login --profile ${config?.awsProfile || 'your-profile-name'}`;
                          navigator.clipboard.writeText(cmd).then(() => {
                            addToast('Command copied to clipboard', 'success');
                          }).catch(() => {
                            addToast('Failed to copy command', 'error');
                          });
                        }}
                        title="Copy command to clipboard"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          <div style={{ display: activeTab === 'deploy' ? 'block' : 'none' }}>
            <Deploy
              environment={environment}
              config={config}
              addToast={addToast}
            />
          </div>
          <div style={{ display: activeTab === 'multi-env' ? 'block' : 'none' }}>
            <MultiEnvDeploy
              config={config}
              addToast={addToast}
            />
          </div>
          <div style={{ display: activeTab === 'terminal' ? 'block' : 'none' }}>
            <RunCommandPage
              environment={environment}
              config={config}
              addToast={addToast}
            />
          </div>
          <div style={{ display: activeTab === 'settings' ? 'block' : 'none' }}>
            <SettingsPage
              config={config}
              profiles={profiles}
              onSave={saveConfig}
              onSelectProfile={switchToProfile}
              addToast={addToast}
              credentialStatus={credentialStatus}
            />
          </div>
        </div>
      </div>
    </React.Fragment>
  );
}

// Mount
const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<App />);
