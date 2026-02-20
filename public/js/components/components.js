// Reusable UI Components

function Toast({ toasts, removeToast }) {
  return (
    <div className="toast-container">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`toast show align-items-center text-white bg-${t.type === 'error' ? 'danger' : 'success'} border-0`}
          role="alert"
        >
          <div className="d-flex">
            <div className="toast-body">{t.message}</div>
            <button
              type="button"
              className="btn-close btn-close-white me-2 m-auto"
              onClick={() => removeToast(t.id)}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

function Modal({ show, title, onClose, children, footer, size }) {
  if (!show) return null;
  return (
    <React.Fragment>
      <div className="modal-backdrop fade show" onClick={onClose} />
      <div className="modal modal-blur fade show" style={{ display: 'block' }} tabIndex="-1">
        <div className={`modal-dialog modal-dialog-centered ${size ? 'modal-' + size : ''}`}>
          <div className="modal-content">
            <div className="modal-header">
              <h5 className="modal-title">{title}</h5>
              <button type="button" className="btn-close" onClick={onClose} />
            </div>
            <div className="modal-body">{children}</div>
            {footer && <div className="modal-footer">{footer}</div>}
          </div>
        </div>
      </div>
    </React.Fragment>
  );
}

function ConfirmModal({ show, title, message, onConfirm, onCancel, confirmText, confirmColor }) {
  return (
    <Modal
      show={show}
      title={title || 'Confirm'}
      onClose={onCancel}
      footer={
        <React.Fragment>
          <button className="btn btn-ghost-secondary" onClick={onCancel}>Cancel</button>
          <button className={`btn btn-${confirmColor || 'primary'}`} onClick={onConfirm}>
            {confirmText || 'Confirm'}
          </button>
        </React.Fragment>
      }
    >
      <p>{message}</p>
    </Modal>
  );
}

function StatusBadge({ status }) {
  const colorMap = {
    Succeeded: 'success',
    Failed: 'danger',
    InProgress: 'info',
    Stopped: 'warning',
    Canceled: 'warning',
    Error: 'warning',
    Unknown: 'secondary',
    Idle: 'secondary',
    triggered: 'info',
    error: 'danger',
  };
  const color = colorMap[status] || 'secondary';
  return <span className={`badge bg-${color}-lt`}>{status}</span>;
}

function StageIndicator({ stages }) {
  if (!stages || !stages.length) return <span className="text-muted">No stages</span>;
  return (
    <div className="stage-steps">
      {stages.map((s, i) => {
        let tip;
        if (s.status === 'Failed') {
          const failedAction = s.actions?.find(a => a.status === 'Failed');
          const msg = failedAction?.errorMessage;
          tip = msg || undefined;
        }
        return (
          <React.Fragment key={s.name}>
            {i > 0 && <i className="ti ti-chevron-right stage-arrow" />}
            <span className={`stage-step ${s.status}`} title={tip}>
              {s.status === 'Succeeded' && <i className="ti ti-check" />}
              {s.status === 'Failed' && <i className="ti ti-x" />}
              {s.status === 'InProgress' && <span className="spinner-border spinner-border-sm" />}
              {s.name}
            </span>
          </React.Fragment>
        );
      })}
    </div>
  );
}

function SavingOverlay({ show, text }) {
  if (!show) return null;
  return (
    <div
      style={{
        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
        background: 'rgba(0,0,0,0.3)', zIndex: 9998,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
    >
      <div className="card p-4 text-center">
        <div className="spinner-border text-primary mb-3" />
        <div>{text || 'Working...'}</div>
      </div>
    </div>
  );
}

function EmptyState({ icon, title, subtitle, children }) {
  return (
    <div className="empty">
      {icon && (
        <div className="empty-icon">
          <i className={`ti ti-${icon}`} style={{ fontSize: '3rem' }} />
        </div>
      )}
      <p className="empty-title">{title}</p>
      {subtitle && <p className="empty-subtitle text-muted">{subtitle}</p>}
      {children}
    </div>
  );
}

function PageHeader({ icon, title, subtitle }) {
  return (
    <div className="page-header mb-4">
      <div className="row align-items-center">
        <div className="col">
          <h2 className="page-title">
            <i className={`ti ti-${icon} me-2`} />
            {title}
          </h2>
          <div className="text-muted mt-1">{subtitle}</div>
        </div>
      </div>
    </div>
  );
}

function BranchInput({ value, onChange, placeholder }) {
  return (
    <div className="mb-3">
      <label className="form-label">Default Branch</label>
      <div className="input-icon">
        <span className="input-icon-addon">
          <i className="ti ti-git-branch" />
        </span>
        <input
          type="text"
          className="form-control"
          placeholder={placeholder || "e.g. feature/my-branch"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      </div>
    </div>
  );
}

function RepositorySelector({ activeRepos, addSearch, setAddSearch, addOpen, setAddOpen, filteredAvailable, onAddRepo, badgeText }) {
  return (
    <div className="mb-3">
      <div className="d-flex justify-content-between align-items-center mb-2">
        <label className="form-label mb-0">Repositories</label>
        {activeRepos.length > 0 && (
          <span className="badge bg-primary-lt">{activeRepos.length} {badgeText || 'active'}</span>
        )}
      </div>
      <div className="position-relative">
        <div className="input-icon">
          <span className="input-icon-addon">
            <i className="ti ti-plus" />
          </span>
          <input
            type="text"
            className="form-control"
            placeholder="Add repository..."
            value={addSearch}
            onChange={(e) => setAddSearch(e.target.value)}
            onFocus={() => setAddOpen(true)}
            onBlur={() => setTimeout(() => setAddOpen(false), 150)}
          />
        </div>
        {addOpen && filteredAvailable.length > 0 && (
          <div className="dropdown-menu show w-100 repo-dropdown">
            {filteredAvailable.map((r) => (
              <a
                key={r.name}
                className="dropdown-item"
                onMouseDown={() => { onAddRepo(r.name); setAddSearch(''); }}
              >
                {r.name}
              </a>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function RepositoryList({
  activeRepos,
  defaultBranch,
  branchOverrides,
  editingBranch,
  setEditingBranch,
  setOverride,
  removeRepo,
  emptyMessage
}) {
  if (activeRepos.length === 0) {
    return (
      <div className="text-muted text-center py-3 mb-3">
        <i className="ti ti-inbox me-1" />
        {emptyMessage || 'Add repositories above to get started'}
      </div>
    );
  }

  return (
    <div className="repo-list mb-3">
      {activeRepos.map((repo) => {
        const hasOverride = branchOverrides[repo.name] !== undefined;
        const isEditing = editingBranch === repo.name;
        return (
          <div key={repo.name} className="repo-item">
            <div className="d-flex align-items-center gap-2">
              <span className="flex-grow-1 fw-bold">{repo.name}</span>
              {!isEditing && (
                <button
                  className="btn btn-ghost-secondary btn-sm btn-icon"
                  onClick={() => setEditingBranch(repo.name)}
                  title="Override branch"
                >
                  <i className="ti ti-pencil" />
                </button>
              )}
              <button
                className="btn btn-ghost-danger btn-sm btn-icon"
                onClick={() => removeRepo(repo.name)}
                title="Remove"
              >
                <i className="ti ti-x" />
              </button>
            </div>

            {/* Branch info */}
            <div className="branch-override mt-1">
              {isEditing ? (
                <div className="d-flex align-items-center gap-1">
                  <input
                    type="text"
                    className="form-control branch-override-input"
                    placeholder={defaultBranch || 'branch name'}
                    value={branchOverrides[repo.name] || ''}
                    onChange={(e) => setOverride(repo.name, e.target.value)}
                    autoFocus
                  />
                  <button
                    className="btn btn-ghost-success btn-sm btn-icon"
                    onClick={() => setEditingBranch(null)}
                  >
                    <i className="ti ti-check" />
                  </button>
                  <button
                    className="btn btn-ghost-danger btn-sm btn-icon"
                    onClick={() => { setOverride(repo.name, null); setEditingBranch(null); }}
                    title="Reset to default"
                  >
                    <i className="ti ti-x" />
                  </button>
                </div>
              ) : hasOverride ? (
                <span className="branch-badge-override">
                  <i className="ti ti-git-branch me-1" />
                  <span className="badge bg-warning-lt">{branchOverrides[repo.name]}</span>
                </span>
              ) : (
                <span className="branch-badge-default">
                  <i className="ti ti-git-branch me-1" />
                  {defaultBranch || '(no branch set)'}
                </span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function PipelineCard({ repo, pipeline, result, status, branch, loading, onTrigger, onStop }) {
  if (loading) {
    return (
      <div className="card pipeline-card mb-0">
        <div className="card-body py-2 px-3">
          <div className="d-flex justify-content-between align-items-center mb-1">
            <div className="fw-bold">{repo}</div>
            <div className="placeholder-glow">
              <span className="placeholder rounded-pill bg-secondary" style={{ width: 64, height: 20, display: 'inline-block' }} />
            </div>
          </div>
          <div className="placeholder-glow text-sm">
            <span className="placeholder col-8" />
          </div>
          <div className="placeholder-glow mt-2">
            <span className="placeholder col-10" style={{ height: 18, display: 'inline-block' }} />
          </div>
        </div>
      </div>
    );
  }

  const overall = status ? status.overall
    : result?.status === 'error' ? 'Error'
    : result?.status === 'triggered' ? 'InProgress'
    : 'Idle';
  const stages = status ? status.stages : [];
  const sourceBranch = status ? status.sourceBranch : null;
  const executions = status ? (status.executions || []) : [];
  const lastExecution = executions[0] || null;

  return (
    <div className={`card pipeline-card status-${overall} mb-0`}>
      <div className="card-body py-2 px-3">
        <div className="d-flex justify-content-between align-items-center mb-1">
          <div className="fw-bold">{repo}</div>
          <div className="d-flex align-items-center gap-2">
            <StatusBadge status={overall} />
            <button
              className="btn btn-ghost-danger btn-sm btn-icon"
              onClick={onStop}
              disabled={overall !== 'InProgress'}
              title="Stop pipeline execution"
            >
              <i className="ti ti-player-stop" />
            </button>
            <button
              className="btn btn-ghost-primary btn-sm btn-icon"
              onClick={onTrigger}
              disabled={overall === 'InProgress' || !branch || !branch.trim()}
              title="Release (re-run pipeline)"
            >
              <i className="ti ti-player-play" />
            </button>
          </div>
        </div>
        <div className="text-muted text-sm">{pipeline}</div>

        {/* Branch & last run */}
        {(sourceBranch || lastExecution) && (
          <div className="d-flex align-items-center gap-3 mt-1 text-sm">
            {sourceBranch && (
              <span>
                <i className="ti ti-git-branch me-1" />
                <strong>{sourceBranch}</strong>
              </span>
            )}
            {lastExecution && lastExecution.startTime && (
              <span className="text-muted" title={new Date(lastExecution.startTime).toLocaleString()}>
                <i className="ti ti-clock me-1" />
                {timeAgo(lastExecution.startTime)}
              </span>
            )}
          </div>
        )}

        {(result?.status === 'error' || status?.error) ? (
          <div className="text-danger mt-1 text-sm">
            <i className="ti ti-alert-triangle me-1" />
            {status?.error || result?.error}
          </div>
        ) : (
          <div className="mt-1">
            <StageIndicator stages={stages} />
          </div>
        )}

        {/* Inline failure detail */}
        {overall === 'Failed' && (() => {
          const failedStage = stages.find(s => s.status === 'Failed');
          const failedAction = failedStage?.actions?.find(a => a.status === 'Failed');
          const msg = failedAction?.errorMessage;
          const url = failedAction?.externalUrl;
          if (!msg && !url) return null;
          return (
            <div className="d-flex align-items-baseline gap-1 mt-1 text-sm">
              <i className="ti ti-alert-circle text-danger flex-shrink-0" />
              {msg && (
                <span className="text-danger text-truncate flex-grow-1" title={msg}>
                  <span className="text-muted">{failedStage.name}:</span> {msg}
                </span>
              )}
              {url && (
                <a
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-shrink-0 text-muted"
                  title="View build logs"
                  onClick={e => e.stopPropagation()}
                >
                  <i className="ti ti-external-link" />
                </a>
              )}
            </div>
          );
        })()}

        {/* Execution history */}
        {executions.length > 0 && (
          <div className="d-flex align-items-center gap-1 mt-2">
            <span className="text-muted me-1 text-xs">Recent:</span>
            {executions.map((ex, i) => {
              const lines = [ex.status];
              if (ex.startTime) lines.push(new Date(ex.startTime).toLocaleString());
              if (ex.statusSummary) lines.push(ex.statusSummary);
              const commitMsg = ex.sourceRevisions?.[0]?.revisionSummary;
              if (commitMsg) lines.push(commitMsg.split('\n')[0]);
              if (ex.errorMessage) lines.push(ex.errorMessage);
              const tip = lines.join('\n');
              const dot = <span className={'exec-dot bg-' + (execColorMap[ex.status] || 'secondary')} />;
              return ex.externalUrl ? (
                <a
                  key={ex.id || i}
                  href={ex.externalUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  title={tip}
                  onClick={e => e.stopPropagation()}
                  style={{ lineHeight: 0 }}
                >
                  {dot}
                </a>
              ) : (
                <span
                  key={ex.id || i}
                  className={'exec-dot bg-' + (execColorMap[ex.status] || 'secondary')}
                  title={tip}
                />
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
