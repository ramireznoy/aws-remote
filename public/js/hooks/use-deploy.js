// Deploy state management hook

function useDeploy(environment, config, addToast) {
  // Initialize from localStorage
  const [defaultBranch, setDefaultBranch] = React.useState(() => {
    try {
      return localStorage.getItem('rc-defaultBranch') || '';
    } catch { return ''; }
  });
  const [branchOverrides, setBranchOverrides] = React.useState(() => {
    try {
      const stored = localStorage.getItem('rc-branchOverrides');
      return stored ? JSON.parse(stored) : {};
    } catch { return {}; }
  });
  const [selectedRepos, setSelectedRepos] = React.useState(() => {
    try {
      const stored = localStorage.getItem('rc-selectedRepos');
      return stored ? JSON.parse(stored) : {};
    } catch { return {}; }
  });
  const [deploying, setDeploying] = React.useState(false);
  const [deployResults, setDeployResults] = React.useState([]);
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

  // Unsubscribe when environment changes
  React.useEffect(() => {
    if (subscribedPipelinesRef.current.length) {
      WebSocketClient.unsubscribePipelines(subscribedPipelinesRef.current);
      subscribedPipelinesRef.current = [];
      setMonitoring(false);
    }
  }, [environment]);

  // Persist to localStorage
  React.useEffect(() => {
    try {
      localStorage.setItem('rc-defaultBranch', defaultBranch);
    } catch {}
  }, [defaultBranch]);

  React.useEffect(() => {
    try {
      localStorage.setItem('rc-branchOverrides', JSON.stringify(branchOverrides));
    } catch {}
  }, [branchOverrides]);

  React.useEffect(() => {
    try {
      localStorage.setItem('rc-selectedRepos', JSON.stringify(selectedRepos));
    } catch {}
  }, [selectedRepos]);

  // Auto-subscribe to WebSocket updates for selected pipelines
  var selectedPipelineNames = (config && config.repos)
    ? config.repos.filter(function (r) { return selectedRepos[r.name]; })
        .map(function (r) { return r.pipelineName.replace('{env}', environment); })
    : [];
  var selectedPipelinesKey = selectedPipelineNames.join(',');

  React.useEffect(() => {
    // Unsubscribe from previous pipelines first
    if (subscribedPipelinesRef.current.length) {
      WebSocketClient.unsubscribePipelines(subscribedPipelinesRef.current);
      subscribedPipelinesRef.current = [];
    }

    if (!selectedPipelineNames.length) {
      setPipelineStatuses([]);
      setMonitoring(false);
      return;
    }

    // Subscribe to new pipelines (server will send initial status immediately)
    WebSocketClient.subscribePipelines(selectedPipelineNames);
    subscribedPipelinesRef.current = selectedPipelineNames;
    setMonitoring(true);

    // Keep fallback HTTP polling for initial load (in case WebSocket isn't connected yet)
    let cancelled = false;
    const timer = setTimeout(() => {
      api.getStatus(selectedPipelineNames)
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
  }, [selectedPipelinesKey]);

  function getBranch(repoName) {
    return branchOverrides[repoName] || defaultBranch;
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

  // Handle incoming WebSocket status updates
  function handleStatusUpdate(statuses) {
    console.log('handleStatusUpdate called with', statuses.length, 'statuses:', statuses);
    let allStatuses = [];
    setPipelineStatuses((prev) => {
      // Merge new statuses with existing ones
      const statusMap = {};
      prev.forEach((s) => { statusMap[s.pipeline] = s; });
      statuses.forEach((s) => { statusMap[s.pipeline] = s; });
      allStatuses = Object.values(statusMap);
      console.log('Updated pipeline statuses:', allStatuses);
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
        const failed = allStatuses.filter((s) => s.overall === 'Failed' || s.overall === 'Error').length;
        if (succeeded && !failed) addToast('All pipelines succeeded!', 'success');
        else if (failed) addToast(`${failed} pipeline(s) failed`, 'error');
      }
    }
  }

  async function deploy() {
    if (!defaultBranch.trim()) {
      addToast('Please enter a default branch', 'error');
      return;
    }

    // Build status map to check which pipelines are in progress
    const statusMap = {};
    pipelineStatuses.forEach((s) => { statusMap[s.pipeline] = s; });

    const repos = config.repos
      .filter((r) => selectedRepos[r.name])
      .map((r) => ({
        name: r.name,
        pipelineName: r.pipelineName,
        branch: getBranch(r.name),
      }))
      .filter((r) => {
        // Skip pipelines that are already InProgress
        const pipeline = r.pipelineName.replace('{env}', environment);
        const status = statusMap[pipeline];
        if (status && status.overall === 'InProgress') {
          addToast(`${r.name} is already running, skipping`, 'info');
          return false;
        }
        return true;
      });

    if (!repos.length) {
      addToast('No repos available to deploy (all running or none selected)', 'error');
      return;
    }

    // Check all have a branch
    const noBranch = repos.find((r) => !r.branch.trim());
    if (noBranch) {
      addToast(`No branch set for ${noBranch.name}`, 'error');
      return;
    }

    setDeploying(true);
    try {
      const data = await api.deploy({ environment, repos });
      setDeployResults(data.results);

      const errors = data.results.filter((r) => r.status === 'error');
      const ok = data.results.filter((r) => r.status === 'triggered');

      if (ok.length) addToast(`${ok.length} pipeline(s) triggered`, 'success');
      if (errors.length) addToast(`${errors.length} pipeline(s) failed to trigger`, 'error');

      // WebSocket subscriptions are already active via selectedPipelineNames effect
      return { ok, errors, repos, notifyText: data.notifyText };
    } catch (err) {
      addToast('Deploy failed: ' + err.message, 'error');
      return null;
    } finally {
      setDeploying(false);
    }
  }

  async function triggerPipeline(pipelineName) {
    try {
      // Optimistically update the status to InProgress
      setPipelineStatuses((prev) => {
        return prev.map((s) => {
          if (s.pipeline === pipelineName) {
            console.log('Optimistically updating', pipelineName, 'to InProgress');
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
      const currentStatuses = pipelineStatuses.filter(s => s.pipeline !== pipelineName);
      if (currentStatuses.length < pipelineStatuses.length) {
        api.getStatus([pipelineName])
          .then(statuses => handleStatusUpdate(statuses))
          .catch(() => {});
      }
    }
  }

  async function stopPipeline(pipelineName) {
    try {
      // Find current execution ID from status
      const status = pipelineStatuses.find((s) => s.pipeline === pipelineName);
      if (!status || !status.executions || !status.executions.length) {
        addToast('No execution found to stop', 'error');
        return;
      }

      // Optimistically update the status to Stopped
      setPipelineStatuses((prev) => {
        return prev.map((s) => {
          if (s.pipeline === pipelineName) {
            console.log('Optimistically updating', pipelineName, 'to Stopped');
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

  function stopMonitoring() {
    if (subscribedPipelinesRef.current.length) {
      WebSocketClient.unsubscribePipelines(subscribedPipelinesRef.current);
      subscribedPipelinesRef.current = [];
    }
    setMonitoring(false);
  }

  return {
    defaultBranch,
    setDefaultBranch,
    branchOverrides,
    setOverride,
    selectedRepos,
    addRepo,
    removeRepo,
    getBranch,
    deploying,
    deploy,
    deployResults,
    pipelineStatuses,
    monitoring,
    stopMonitoring,
    triggerPipeline,
    stopPipeline,
  };
}
