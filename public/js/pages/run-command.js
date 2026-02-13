// Run Command — Virtual CLI Terminal

function createTab(id) {
  return {
    id: id || Date.now().toString(),
    name: 'Terminal',
    cwd: null, // null = root
    history: [],
    historyIndex: -1,
    output: [
      { type: 'info', text: 'Remote Control Terminal — type "help" for available commands' },
      { type: 'muted', text: '' },
    ],
  };
}

function RunCommandPage({ environment, config, addToast }) {
  // Load tabs from localStorage or create default
  const [tabs, setTabs] = React.useState(() => {
    try {
      const stored = localStorage.getItem('rc-terminal-tabs');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed.length) return parsed;
      }
    } catch {}
    return [createTab('default')];
  });

  const [activeTabId, setActiveTabId] = React.useState(() => {
    try {
      return localStorage.getItem('rc-terminal-active-tab') || 'default';
    } catch { return 'default'; }
  });

  const [input, setInput] = React.useState('');
  const [running, setRunning] = React.useState(false);
  const [templates, setTemplates] = React.useState([]);
  const outputRef = React.useRef(null);
  const inputRef = React.useRef(null);

  // Load command templates on mount
  React.useEffect(() => {
    api.getCommandTemplates()
      .then((data) => setTemplates(data.templates || []))
      .catch(() => {});
  }, []);

  // Persist tabs to localStorage
  React.useEffect(() => {
    try {
      localStorage.setItem('rc-terminal-tabs', JSON.stringify(tabs));
    } catch {}
  }, [tabs]);

  React.useEffect(() => {
    try {
      localStorage.setItem('rc-terminal-active-tab', activeTabId);
    } catch {}
  }, [activeTabId]);

  // Auto-scroll output to bottom
  React.useEffect(() => {
    if (outputRef.current) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight;
    }
  });

  // Focus input when switching tabs
  React.useEffect(() => {
    if (inputRef.current) inputRef.current.focus();
  }, [activeTabId]);

  const activeTab = tabs.find((t) => t.id === activeTabId) || tabs[0];

  function updateTab(tabId, updater) {
    setTabs((prev) => prev.map((t) => (t.id === tabId ? updater(t) : t)));
  }

  function appendOutput(tabId, lines) {
    updateTab(tabId, (t) => ({
      ...t,
      output: [...t.output, ...lines],
    }));
  }

  function getPrompt(tab) {
    const env = environment || '?';
    if (tab.cwd) return `${env}:/${tab.cwd} $`;
    return `${env}:/ $`;
  }

  function getServices() {
    if (!config || !config.repos) return [];
    return config.repos.map((r) => r.name);
  }

  // Built-in command handlers
  function handleBuiltinCommand(tab, cmd, args) {
    const tabId = tab.id;

    switch (cmd) {
      case 'help': {
        appendOutput(tabId, [
          { type: 'info', text: 'Available commands:' },
          { type: 'muted', text: '' },
          { type: 'command', text: '  cd <service>    Navigate into a service' },
          { type: 'command', text: '  cd ..           Go back to root' },
          { type: 'command', text: '  ls              List services or command templates' },
          { type: 'command', text: '  help            Show this help' },
          { type: 'command', text: '  clear           Clear terminal output' },
          { type: 'command', text: '  history         Show command history' },
          { type: 'muted', text: '' },
          { type: 'info', text: 'Inside a service, any other input runs as a command via Lambda:' },
          { type: 'command', text: '  npm run migrate' },
          { type: 'command', text: '  node scripts/seed.js' },
          { type: 'muted', text: '' },
          { type: 'muted', text: `Lambda: ${environment}-run-command` },
        ]);
        return true;
      }

      case 'clear': {
        updateTab(tabId, (t) => ({ ...t, output: [] }));
        return true;
      }

      case 'history': {
        if (!tab.history.length) {
          appendOutput(tabId, [{ type: 'muted', text: 'No command history' }]);
        } else {
          const lines = tab.history.map((h, i) => ({
            type: 'command',
            text: `  ${String(i + 1).padStart(4)}  ${h}`,
          }));
          appendOutput(tabId, lines);
        }
        return true;
      }

      case 'ls': {
        const services = getServices();
        if (!tab.cwd) {
          // At root — list services
          if (!services.length) {
            appendOutput(tabId, [{ type: 'muted', text: 'No services configured. Add repos in Settings.' }]);
          } else {
            const lines = services.map((s) => ({ type: 'info', text: '  ' + s }));
            appendOutput(tabId, lines);
          }
        } else {
          // Inside a service — list templates
          if (!templates.length) {
            appendOutput(tabId, [
              { type: 'muted', text: 'No command templates configured.' },
              { type: 'muted', text: 'Type any command to run it, e.g.: npm run migrate' },
            ]);
          } else {
            appendOutput(tabId, [{ type: 'info', text: 'Command templates:' }]);
            const lines = templates.map((t) => ({
              type: 'command',
              text: `  ${t.name.padEnd(20)} ${t.description || t.command}`,
            }));
            appendOutput(tabId, lines);
          }
        }
        return true;
      }

      case 'cd': {
        const target = args.join(' ').trim();
        if (!target || target === '/') {
          updateTab(tabId, (t) => ({ ...t, cwd: null }));
          return true;
        }
        if (target === '..' || target === '../') {
          updateTab(tabId, (t) => ({ ...t, cwd: null }));
          return true;
        }
        const services = getServices();
        if (services.includes(target)) {
          updateTab(tabId, (t) => ({ ...t, cwd: target }));
          return true;
        }
        // Fuzzy match — check if any service contains the input
        const match = services.find((s) => s.includes(target));
        if (match) {
          updateTab(tabId, (t) => ({ ...t, cwd: match }));
          appendOutput(tabId, [{ type: 'muted', text: `→ matched: ${match}` }]);
          return true;
        }
        appendOutput(tabId, [{ type: 'error', text: `cd: no such service: ${target}` }]);
        return true;
      }

      default:
        return false;
    }
  }

  async function executeCommand(rawInput) {
    const trimmed = rawInput.trim();
    if (!trimmed) return;

    const tabId = activeTab.id;

    // Add prompt + command to output
    appendOutput(tabId, [
      { type: 'prompt-line', prompt: getPrompt(activeTab), command: trimmed },
    ]);

    // Add to history
    updateTab(tabId, (t) => ({
      ...t,
      history: [...t.history.filter((h) => h !== trimmed), trimmed],
      historyIndex: -1,
    }));

    // Parse command
    const parts = trimmed.split(/\s+/);
    const cmd = parts[0].toLowerCase();
    const args = parts.slice(1);

    // Check if it's a template shortcut
    const template = templates.find((t) => t.name === cmd);
    const resolvedCommand = template ? template.command : trimmed;

    // Try built-in commands first
    if (handleBuiltinCommand(activeTab, cmd, args)) {
      setInput('');
      return;
    }

    // Not a built-in — must be inside a service to run Lambda
    if (!activeTab.cwd) {
      appendOutput(tabId, [
        { type: 'error', text: `command not found: ${cmd}` },
        { type: 'muted', text: 'Navigate into a service first: cd <service-name>' },
      ]);
      setInput('');
      return;
    }

    // Run via Lambda
    setRunning(true);
    setInput('');
    appendOutput(tabId, [
      { type: 'muted', text: `→ invoking ${environment}-run-command ...` },
    ]);

    try {
      const result = await api.runCommand({
        environment,
        targetService: activeTab.cwd,
        command: resolvedCommand,
      });

      if (result.functionError) {
        appendOutput(tabId, [
          { type: 'error', text: `Lambda error: ${result.functionError}` },
          { type: 'error', text: formatPayload(result.payload) },
        ]);
      } else {
        appendOutput(tabId, [
          { type: 'success', text: formatPayload(result.payload) },
        ]);
      }

      if (result.logs) {
        appendOutput(tabId, [
          { type: 'muted', text: '--- logs ---' },
          { type: 'muted', text: result.logs },
        ]);
      }
    } catch (err) {
      appendOutput(tabId, [
        { type: 'error', text: 'Request failed: ' + err.message },
      ]);
    } finally {
      setRunning(false);
      appendOutput(tabId, [{ type: 'muted', text: '' }]);
    }
  }

  function formatPayload(payload) {
    if (typeof payload === 'string') return payload;
    try {
      return JSON.stringify(payload, null, 2);
    } catch {
      return String(payload);
    }
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !running) {
      executeCommand(input);
      return;
    }

    // History navigation
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      const hist = activeTab.history;
      if (!hist.length) return;
      const newIndex = activeTab.historyIndex < 0
        ? hist.length - 1
        : Math.max(0, activeTab.historyIndex - 1);
      updateTab(activeTab.id, (t) => ({ ...t, historyIndex: newIndex }));
      setInput(hist[newIndex]);
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      const hist = activeTab.history;
      if (activeTab.historyIndex < 0) return;
      const newIndex = activeTab.historyIndex + 1;
      if (newIndex >= hist.length) {
        updateTab(activeTab.id, (t) => ({ ...t, historyIndex: -1 }));
        setInput('');
      } else {
        updateTab(activeTab.id, (t) => ({ ...t, historyIndex: newIndex }));
        setInput(hist[newIndex]);
      }
      return;
    }

    // Ctrl+L / Ctrl+K — clear
    if ((e.key === 'l' || e.key === 'k') && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      updateTab(activeTab.id, (t) => ({ ...t, output: [] }));
      return;
    }
  }

  // Tab management
  function addTab() {
    const newTab = createTab();
    setTabs((prev) => [...prev, newTab]);
    setActiveTabId(newTab.id);
  }

  function closeTab(tabId) {
    if (tabs.length <= 1) return; // Keep at least one
    setTabs((prev) => {
      const filtered = prev.filter((t) => t.id !== tabId);
      if (activeTabId === tabId) {
        setActiveTabId(filtered[filtered.length - 1].id);
      }
      return filtered;
    });
  }

  function renameTab(tabId) {
    const tab = tabs.find((t) => t.id === tabId);
    if (!tab) return;
    const newName = prompt('Tab name:', tab.name);
    if (newName && newName.trim()) {
      updateTab(tabId, (t) => ({ ...t, name: newName.trim() }));
    }
  }

  // Render output lines
  function renderLine(line, i) {
    if (line.type === 'prompt-line') {
      return (
        <div key={i}>
          <span className="line-prompt">{line.prompt} </span>
          <span className="line-command">{line.command}</span>
        </div>
      );
    }
    const cls = `line-${line.type || 'command'}`;
    return <div key={i} className={cls}>{line.text}</div>;
  }

  return (
    <div className="container-xl py-4">
      <div className="terminal-container">
        {/* Tab bar */}
        <div className="terminal-tabs">
          {tabs.map((tab) => (
            <div
              key={tab.id}
              className={`terminal-tab ${tab.id === activeTabId ? 'active' : ''}`}
              onClick={() => setActiveTabId(tab.id)}
              onDoubleClick={() => renameTab(tab.id)}
              title="Double-click to rename"
            >
              <span>{tab.name}</span>
              {tabs.length > 1 && (
                <button
                  className="terminal-tab-close"
                  onClick={(e) => { e.stopPropagation(); closeTab(tab.id); }}
                  title="Close tab"
                >
                  <i className="ti ti-x" />
                </button>
              )}
            </div>
          ))}
          <button className="terminal-tab-add" onClick={addTab} title="New tab">
            <i className="ti ti-plus" />
          </button>
        </div>

        {/* Output area */}
        <div
          className="terminal-output"
          ref={outputRef}
          onClick={() => inputRef.current && inputRef.current.focus()}
        >
          {activeTab.output.map(renderLine)}
        </div>

        {/* Input row */}
        <div className="terminal-input-row">
          {running && (
            <span className="terminal-spinner">
              <i className="ti ti-loader" />
            </span>
          )}
          <span className="terminal-prompt">{getPrompt(activeTab)}</span>
          <input
            ref={inputRef}
            className="terminal-input"
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={running ? 'Running...' : 'Type a command...'}
            disabled={running}
            autoFocus
          />
        </div>
      </div>
    </div>
  );
}
