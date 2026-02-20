// Deploy Dashboard — Main deployment content (no navbar, rendered inside app shell)

function Deploy({ environment, config, addToast }) {
  const {
    defaultBranch, setDefaultBranch,
    branchOverrides, setOverride,
    selectedRepos, addRepo, removeRepo,
    getBranch, deploying, deploy,
    deployResults, pipelineStatuses, monitoring,
    triggerPipeline, stopPipeline,
  } = useDeploy(environment, config, addToast);

  const [editingBranch, setEditingBranch] = React.useState(null);
  const [addSearch, setAddSearch] = React.useState('');
  const [addOpen, setAddOpen] = React.useState(false);
  const [notifyModal, setNotifyModal] = React.useState(false);
  const [notifyText, setNotifyText] = React.useState('');
  const [copied, setCopied] = React.useState(false);

  function handleCopy() {
    navigator.clipboard.writeText(notifyText).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  async function handleDeploy() {
    const result = await deploy();
    if (result && result.ok.length && result.notifyText) {
      setNotifyText(result.notifyText);
      setNotifyModal(true);
    }
  }

  async function handleNotifyClick() {
    // Fetch notification message from server (single source of truth)
    const repos = activeRepos.map((r) => ({
      name: r.name,
      pipelineName: r.pipelineName,
      branch: getBranch(r.name),
    }));
    try {
      const data = await api.getNotifyMessage({ environment, repos });
      setNotifyText(data.text);
      setNotifyModal(true);
    } catch (err) {
      addToast('Failed to generate message: ' + err.message, 'error');
    }
  }

  // Build status map from polling results
  const statusMap = {};
  pipelineStatuses.forEach((s) => { statusMap[s.pipeline] = s; });

  // Repos in working set vs available to add
  const activeRepos = config ? config.repos.filter((r) => selectedRepos[r.name]) : [];
  const availableRepos = config ? config.repos.filter((r) => !selectedRepos[r.name]) : [];
  const filteredAvailable = addSearch
    ? availableRepos.filter((r) => r.name.toLowerCase().includes(addSearch.toLowerCase()))
    : availableRepos;

  // Build pipeline list from selected repos
  const activePipelines = config ? config.repos
    .filter((r) => selectedRepos[r.name])
    .map((r) => {
      const pipeline = r.pipelineName.replace('{env}', environment);
      const result = deployResults.find((dr) => dr.pipeline === pipeline);
      const status = statusMap[pipeline];
      const branch = getBranch(r.name);
      return { repo: r.name, pipeline, result, status, branch, loading: monitoring && !status };
    }) : [];

  return (
    <div className="container-xl py-4">
      <PageHeader
        icon="player-play"
        title="Environment Deploy"
        subtitle="Deploy multiple services simultaneously."
      />

      <div className="row g-3">
        {/* Left Panel — Config */}
        <div className="col-md-4">
          <div className="card">
            <div className="card-header">
              <h3 className="card-title">
                <i className="ti ti-git-branch me-2" />
                Deploy Configuration
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
                badgeText="active"
              />

              <RepositoryList
                activeRepos={activeRepos}
                defaultBranch={defaultBranch}
                branchOverrides={branchOverrides}
                editingBranch={editingBranch}
                setEditingBranch={setEditingBranch}
                setOverride={setOverride}
                removeRepo={removeRepo}
                emptyMessage="Add repositories above to get started"
              />

              {/* Deploy Button */}
              <button
                className="btn btn-primary deploy-btn"
                onClick={handleDeploy}
                disabled={deploying || !defaultBranch.trim() || activeRepos.length === 0}
              >
                {deploying ? (
                  <React.Fragment>
                    <span className="spinner-border spinner-border-sm me-2" />
                    Deploying...
                  </React.Fragment>
                ) : (
                  <React.Fragment>
                    <i className="ti ti-player-play me-1" />
                    Deploy {activeRepos.length > 0 ? '(' + activeRepos.length + ')' : ''}
                  </React.Fragment>
                )}
              </button>

              {/* Notify Team Button */}
              <button
                className="btn btn-outline-secondary deploy-btn"
                onClick={handleNotifyClick}
                disabled={!defaultBranch.trim() || activeRepos.length === 0}
              >
                <i className="ti ti-brand-teams me-1" />
                Notify Team
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
              {activePipelines.length === 0 ? (
                <EmptyState
                  icon="list-search"
                  title="No pipelines selected"
                  subtitle="Add repositories to see their pipeline status"
                />
              ) : (
                <div className="d-flex flex-column gap-2">
                  {activePipelines.map(({ repo, pipeline, result, status, branch, loading }) => (
                    <PipelineCard
                      key={pipeline}
                      repo={repo}
                      pipeline={pipeline}
                      result={result || { repo, pipeline, status: 'idle' }}
                      status={status}
                      branch={branch}
                      loading={loading}
                      onTrigger={() => triggerPipeline(pipeline)}
                      onStop={() => stopPipeline(pipeline)}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Notify Team Modal */}
      <Modal
        show={notifyModal}
        title="Notify Your Team"
        onClose={() => { setNotifyModal(false); setCopied(false); }}
        size="lg"
        footer={
          <React.Fragment>
            <button
              className="btn btn-ghost-secondary"
              onClick={() => { setNotifyModal(false); setCopied(false); }}
            >
              Close
            </button>
            <button className="btn btn-primary" onClick={handleCopy}>
              <i className={'ti me-1 ' + (copied ? 'ti-check' : 'ti-copy')} />
              {copied ? 'Copied!' : 'Copy to Clipboard'}
            </button>
          </React.Fragment>
        }
      >
        <p className="text-muted mb-3">
          Copy this message and paste it in your Teams channel to notify the team.
        </p>
        <pre className="p-3 rounded notify-text">
          {notifyText}
        </pre>
      </Modal>
    </div>
  );
}
