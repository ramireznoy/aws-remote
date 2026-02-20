// Multi-Environment Deploy Page — Deploy same branch to multiple environments

function MultiEnvDeploy({ config, addToast }) {
  const [defaultBranch, setDefaultBranch] = React.useState(() => {
    try {
      return localStorage.getItem('rc-multienv-branch') || '';
    } catch { return ''; }
  });
  const [branchOverrides, setBranchOverrides] = React.useState(() => {
    try {
      const stored = localStorage.getItem('rc-multienv-overrides');
      return stored ? JSON.parse(stored) : {};
    } catch { return {}; }
  });
  const [selectedRepos, setSelectedRepos] = React.useState(() => {
    try {
      const stored = localStorage.getItem('rc-multienv-repos');
      return stored ? JSON.parse(stored) : {};
    } catch { return {}; }
  });
  const [selectedEnvs, setSelectedEnvs] = React.useState(() => {
    try {
      const stored = localStorage.getItem('rc-multienv-envs');
      return stored ? JSON.parse(stored) : {};
    } catch { return {}; }
  });
  const [deploying, setDeploying] = React.useState(false);
  const [results, setResults] = React.useState([]);
  const [addSearch, setAddSearch] = React.useState('');
  const [addOpen, setAddOpen] = React.useState(false);
  const [editingBranch, setEditingBranch] = React.useState(null);
  const [pipelineStatuses, setPipelineStatuses] = React.useState([]);
  const [monitoring, setMonitoring] = React.useState(false);
  const prevStatusesRef = React.useRef({});
  const subscribedPipelinesRef = React.useRef([]);

  // Initialize WebSocket connection on mount
  React.useEffect(() => {
    WebSocketClient.connect();

    // Listen for pipeline status events
    const unsubscribe = WebSocketClient.on('pipeline:status', (event) => {
      if (event.data && event.data.statuses) {
        handleStatusUpdate(event.data.statuses);
      }
    });

    // Re-subscribe when WebSocket reconnects
    const handleReconnect = () => {
      console.log('WebSocket reconnected, re-subscribing to pipelines...');
      if (subscribedPipelinesRef.current.length) {
        WebSocketClient.subscribePipelines(subscribedPipelinesRef.current);
      }
    };
    const unsubscribeReconnect = WebSocketClient.on('connect', handleReconnect);

    return () => {
      unsubscribe();
      unsubscribeReconnect();
      // Unsubscribe from all pipelines on unmount
      if (subscribedPipelinesRef.current.length) {
        WebSocketClient.unsubscribePipelines(subscribedPipelinesRef.current);
      }
    };
  }, []);

  // Persist to localStorage
  React.useEffect(() => {
    try {
      localStorage.setItem('rc-multienv-branch', defaultBranch);
    } catch {}
  }, [defaultBranch]);

  React.useEffect(() => {
    try {
      localStorage.setItem('rc-multienv-overrides', JSON.stringify(branchOverrides));
    } catch {}
  }, [branchOverrides]);

  React.useEffect(() => {
    try {
      localStorage.setItem('rc-multienv-repos', JSON.stringify(selectedRepos));
    } catch {}
  }, [selectedRepos]);

  React.useEffect(() => {
    try {
      localStorage.setItem('rc-multienv-envs', JSON.stringify(selectedEnvs));
    } catch {}
  }, [selectedEnvs]);

  // Auto-subscribe to WebSocket updates for selected pipelines
  React.useEffect(() => {
    // Unsubscribe from previous pipelines first
    if (subscribedPipelinesRef.current.length) {
      WebSocketClient.unsubscribePipelines(subscribedPipelinesRef.current);
      subscribedPipelinesRef.current = [];
    }

    const repos = config ? config.repos.filter((r) => selectedRepos[r.name]) : [];
    const envs = Object.keys(selectedEnvs).filter((e) => selectedEnvs[e]);

    const pipelineNames = [];
    envs.forEach((env) => {
      repos.forEach((repo) => {
        pipelineNames.push(repo.pipelineName.replace('{env}', env));
      });
    });

    if (!pipelineNames.length) {
      setPipelineStatuses([]);
      setMonitoring(false);
      return;
    }

    // Subscribe to new pipelines (server will send initial status immediately)
    WebSocketClient.subscribePipelines(pipelineNames);
    subscribedPipelinesRef.current = pipelineNames;
    setMonitoring(true);

    // Keep fallback HTTP polling for initial load (in case WebSocket isn't connected yet)
    let cancelled = false;
    const timer = setTimeout(() => {
      api.getStatus(pipelineNames)
        .then(statuses => { if (!cancelled) setPipelineStatuses(statuses); })
        .catch(() => {});
    }, 300);

    return () => {
      cancelled = true;
      clearTimeout(timer);
      // Unsubscribe on cleanup
      if (subscribedPipelinesRef.current.length) {
        WebSocketClient.unsubscribePipelines(subscribedPipelinesRef.current);
        subscribedPipelinesRef.current = [];
      }
    };
  }, [JSON.stringify(selectedRepos), JSON.stringify(selectedEnvs), config]);

  function getBranch(repoName) {
    return branchOverrides[repoName] || defaultBranch;
  }

  // Handle incoming WebSocket status updates
  function handleStatusUpdate(statuses) {
    let allStatuses = [];
    setPipelineStatuses((prev) => {
      // Merge new statuses with existing ones
      const statusMap = {};
      prev.forEach((s) => { statusMap[s.pipeline] = s; });
      statuses.forEach((s) => { statusMap[s.pipeline] = s; });
      allStatuses = Object.values(statusMap);
      return allStatuses;
    });

    // Send browser notifications for state transitions
    if ('Notification' in window && Notification.permission === 'granted') {
      statuses.forEach((current) => {
        const prev = prevStatusesRef.current[current.pipeline];
        if (prev && prev !== current.overall) {
          // Notify on transition to terminal states
          if (current.overall === 'Succeeded') {
            new Notification('Pipeline Succeeded ✓', {
              body: `${current.pipeline} completed successfully`,
              icon: '/favicon.ico',
            });
          } else if (current.overall === 'Failed') {
            new Notification('Pipeline Failed ✗', {
              body: `${current.pipeline} failed`,
              icon: '/favicon.ico',
            });
          }
        }
        prevStatusesRef.current[current.pipeline] = current.overall;
      });
    }

    // Check if ALL monitored pipelines (not just incoming) are in terminal state
    if (allStatuses.length > 0 && monitoring) {
      const allDone = allStatuses.every(
        (s) => s.overall === 'Succeeded' || s.overall === 'Failed' || s.overall === 'Stopped' || s.overall === 'Canceled' || s.overall === 'Error' || s.overall === 'Idle'
      );
      if (allDone) {
        const succeeded = allStatuses.filter((s) => s.overall === 'Succeeded').length;
        const failed = allStatuses.filter((s) => s.overall === 'Failed' || s.overall === 'Error' || s.overall === 'Canceled').length;
        if (succeeded && !failed) addToast('All pipelines succeeded!', 'success');
        else if (failed) addToast(`${failed} pipeline(s) failed`, 'error');
      }
    }
  }

  function setOverride(repoName, branch) {
    setBranchOverrides((prev) => {
      const next = { ...prev };
      if (branch === '' || branch === null) {
        delete next[repoName];
      } else {
        next[repoName] = branch;
      }
      return next;
    });
  }

  function toggleEnv(env) {
    setSelectedEnvs((prev) => {
      const next = { ...prev };
      if (next[env]) delete next[env];
      else next[env] = true;
      return next;
    });
  }

  function addRepo(repoName) {
    setSelectedRepos((prev) => ({ ...prev, [repoName]: true }));
  }

  function removeRepo(repoName) {
    setSelectedRepos((prev) => {
      const next = { ...prev };
      delete next[repoName];
      return next;
    });
  }

  async function handleDeploy() {
    if (!defaultBranch.trim()) {
      addToast('Please enter a default branch', 'error');
      return;
    }

    const activeRepos = config.repos.filter((r) => selectedRepos[r.name]);
    if (!activeRepos.length) {
      addToast('Please select at least one repository', 'error');
      return;
    }

    // Check all repos have a branch
    const noBranch = activeRepos.find((r) => !getBranch(r.name).trim());
    if (noBranch) {
      addToast(`No branch set for ${noBranch.name}`, 'error');
      return;
    }

    const activeEnvs = Object.keys(selectedEnvs).filter((e) => selectedEnvs[e]);
    if (!activeEnvs.length) {
      addToast('Please select at least one environment', 'error');
      return;
    }

    setDeploying(true);
    setResults([]);

    // Deploy to all environments in parallel
    const deployPromises = activeEnvs.map(async (environment) => {
      const repos = activeRepos.map((r) => ({
        name: r.name,
        pipelineName: r.pipelineName,
        branch: getBranch(r.name).trim(),
      }));

      try {
        const data = await api.deploy({ environment, repos });
        return { environment, results: data.results };
      } catch (err) {
        return {
          environment,
          results: repos.map((r) => ({
            repo: r.name,
            pipeline: r.pipelineName.replace('{env}', environment),
            status: 'error',
            error: err.message,
          })),
        };
      }
    });

    const allResults = await Promise.all(deployPromises);
    setResults(allResults);
    setDeploying(false);

    // Summary toast
    const totalTriggered = allResults.reduce((sum, r) => sum + r.results.filter((x) => x.status === 'triggered').length, 0);
    const totalErrors = allResults.reduce((sum, r) => sum + r.results.filter((x) => x.status === 'error').length, 0);

    if (totalTriggered) addToast(`${totalTriggered} pipeline(s) triggered across ${allResults.length} environment(s)`, 'success');
    if (totalErrors) addToast(`${totalErrors} pipeline(s) failed`, 'error');

    // WebSocket subscriptions are already active via selectedPipelines effect
  }

  async function triggerPipeline(pipelineName) {
    try {
      // Optimistically update the status to InProgress
      setPipelineStatuses((prev) => {
        return prev.map((s) => {
          if (s.pipeline === pipelineName) {
            return { ...s, overall: 'InProgress' };
          }
          return s;
        });
      });

      await api.trigger(pipelineName);
      addToast('Pipeline triggered: ' + pipelineName, 'success');

      // Force immediate status refresh for this pipeline
      setTimeout(() => {
        api.getStatus([pipelineName])
          .then(statuses => handleStatusUpdate(statuses))
          .catch(() => {});
      }, 2000);
    } catch (err) {
      addToast('Trigger failed: ' + err.message, 'error');
      // Revert optimistic update on error
      api.getStatus([pipelineName])
        .then(statuses => handleStatusUpdate(statuses))
        .catch(() => {});
    }
  }

  async function stopPipeline(pipelineName) {
    try {
      const status = pipelineStatuses.find((s) => s.pipeline === pipelineName);
      if (!status || !status.executions || !status.executions.length) {
        addToast('No execution found to stop', 'error');
        return;
      }

      // Optimistically update the status to Stopped
      setPipelineStatuses((prev) => {
        return prev.map((s) => {
          if (s.pipeline === pipelineName) {
            return { ...s, overall: 'Stopped' };
          }
          return s;
        });
      });

      const executionId = status.executions[0].id;
      await api.stopPipeline(pipelineName, executionId);
      addToast('Pipeline stopped: ' + pipelineName, 'success');

      // Force immediate status refresh
      setTimeout(() => {
        api.getStatus([pipelineName])
          .then(statuses => handleStatusUpdate(statuses))
          .catch(() => {});
      }, 2000);
    } catch (err) {
      addToast('Stop failed: ' + err.message, 'error');
      // Revert optimistic update on error
      api.getStatus([pipelineName])
        .then(statuses => handleStatusUpdate(statuses))
        .catch(() => {});
    }
  }

  const activeRepos = config ? config.repos.filter((r) => selectedRepos[r.name]) : [];
  const availableRepos = config ? config.repos.filter((r) => !selectedRepos[r.name]) : [];
  const filteredAvailable = addSearch
    ? availableRepos.filter((r) => r.name.toLowerCase().includes(addSearch.toLowerCase()))
    : availableRepos;

  const activeEnvs = Object.keys(selectedEnvs).filter((e) => selectedEnvs[e]);

  return (
    <div className="container-xl py-4">
      <PageHeader
        icon="topology-star-3"
        title="Multi-Environment Deploy"
        subtitle="Deploy the same branch to multiple environments simultaneously."
      />

      <div className="row g-4">
        {/* Left Panel — Configuration */}
        <div className="col-md-4">
          <div className="card">
            <div className="card-header">
              <h3 className="card-title">
                <i className="ti ti-git-branch me-2" />
                Multi-Environment Deploy Configuration
              </h3>
            </div>
            <div className="card-body">
              <BranchInput
                value={defaultBranch}
                onChange={setDefaultBranch}
              />

              <RepositorySelector
                activeRepos={activeRepos}
                addSearch={addSearch}
                setAddSearch={setAddSearch}
                addOpen={addOpen}
                setAddOpen={setAddOpen}
                filteredAvailable={filteredAvailable}
                onAddRepo={addRepo}
                badgeText="selected"
              />

              <RepositoryList
                activeRepos={activeRepos}
                defaultBranch={defaultBranch}
                branchOverrides={branchOverrides}
                editingBranch={editingBranch}
                setEditingBranch={setEditingBranch}
                setOverride={setOverride}
                removeRepo={removeRepo}
                emptyMessage="Add repositories above"
              />

              {/* Environments */}
              <div className="mb-3">
                <div className="d-flex justify-content-between align-items-center mb-2">
                  <label className="form-label mb-0">Environments</label>
                  {activeEnvs.length > 0 && (
                    <span className="badge bg-info-lt">{activeEnvs.length} selected</span>
                  )}
                </div>
                <div className="row g-2">
                  {config && config.environments.map((env) => (
                    <div key={env} className="col-6">
                      <label className="form-check form-check-single">
                        <input
                          type="checkbox"
                          className="form-check-input mx-2"
                          checked={!!selectedEnvs[env]}
                          onChange={() => toggleEnv(env)}
                        />
                        <span className="form-check-label">{env.toUpperCase()}</span>
                      </label>
                    </div>
                  ))}
                </div>
              </div>

              {/* Deploy Button */}
              <button
                className="btn btn-primary w-100"
                onClick={handleDeploy}
                disabled={deploying || !defaultBranch.trim() || activeRepos.length === 0 || activeEnvs.length === 0}
              >
                {deploying ? (
                  <React.Fragment>
                    <span className="spinner-border spinner-border-sm me-2" />
                    Deploying...
                  </React.Fragment>
                ) : (
                  <React.Fragment>
                    <i className="ti ti-rocket me-1" />
                    Deploy to {activeEnvs.length || 0} env(s)
                  </React.Fragment>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Right Panel — Pipeline Status */}
        <div className="col-md-8">
          <div className="card">
            <div className="card-header d-flex justify-content-between align-items-center">
              <h3 className="card-title">
                <i className="ti ti-activity me-2" />
                Pipeline Status
              </h3>
              {monitoring && (
                <span className="badge bg-success-lt d-inline-flex align-items-center">
                  <i className="ti ti-wifi me-1" />
                  Live
                </span>
              )}
            </div>
            <div className="card-body scrollable-panel">
              {activeRepos.length === 0 || activeEnvs.length === 0 ? (
                <EmptyState
                  icon="list-search"
                  title="No pipelines selected"
                  subtitle="Select repositories and environments to see their pipeline status"
                />
              ) : (
                <div className="d-flex flex-column gap-3">
                  {activeEnvs.map((environment) => {
                    const envPipelines = activeRepos.map((repo) => {
                      const pipelineName = repo.pipelineName.replace('{env}', environment);
                      const status = pipelineStatuses.find((s) => s.pipeline === pipelineName);
                      const branch = getBranch(repo.name);
                      return { repo: repo.name, pipeline: pipelineName, status, branch, loading: monitoring && !status };
                    });

                    return (
                      <div key={environment}>
                        <h4 className="mb-2">{environment.toUpperCase()}</h4>
                        <div className="d-flex flex-column gap-2">
                          {envPipelines.map(({ repo, pipeline, status, branch, loading }) => (
                            <PipelineCard
                              key={pipeline}
                              repo={repo}
                              pipeline={pipeline}
                              result={{ repo, pipeline }}
                              status={status}
                              branch={branch}
                              loading={loading}
                              onTrigger={() => triggerPipeline(pipeline)}
                              onStop={() => stopPipeline(pipeline)}
                            />
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
