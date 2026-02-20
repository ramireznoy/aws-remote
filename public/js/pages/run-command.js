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

function RunCommandPage({ environment, config, addToast, onSwitchEnvironment }) {
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
  const outputRef = React.useRef(null);
  const inputRef = React.useRef(null);

  // Derive templates and per-service scripts from config
  const templates = (config && config.commandAliases) || [];

  function getServiceScripts(serviceName) {
    if (!config || !config.repos) return [];
    const repo = config.repos.find((r) => r.name === serviceName);
    return (repo && repo.scripts) || [];
  }

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

  // Built-in command handler — delegates to terminal-commands.js registry
  function handleBuiltinCommand(tab, cmd, args) {
    const handler = findTerminalCommand(cmd);
    if (!handler) return false;

    const tabId = tab.id;
    handler.execute({
      tab,
      args,
      templates,
      getServiceScripts,
      environment,
      environments: (config && config.environments) || [],
      onSwitchEnvironment,
      getServices,
      appendOutput: (lines) => appendOutput(tabId, lines),
      updateTab: (updater) => updateTab(tabId, updater),
    });
    return true;
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

    // Check if it's a per-service script or global template shortcut
    const currentScripts = activeTab.cwd ? getServiceScripts(activeTab.cwd) : [];
    const script = currentScripts.find((s) => s.name === cmd);
    const template = !script ? templates.find((t) => t.name === cmd) : null;
    const extraArgs = args.join(' ');
    const base = script ? script.command : template ? template.command : null;
    const resolvedCommand = base ? (extraArgs ? base + ' ' + extraArgs : base) : trimmed;

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

  function deepParseJson(val) {
    if (typeof val === 'string') {
      try { return deepParseJson(JSON.parse(val)); } catch { return val; }
    }
    if (Array.isArray(val)) return val.map(deepParseJson);
    if (val && typeof val === 'object') {
      const out = {};
      for (const k of Object.keys(val)) out[k] = deepParseJson(val[k]);
      return out;
    }
    return val;
  }

  function formatPayload(payload) {
    if (typeof payload === 'string') {
      try { payload = JSON.parse(payload); } catch { return payload; }
    }
    try {
      return JSON.stringify(deepParseJson(payload), null, 2);
    } catch {
      return String(payload);
    }
  }

  function getCompletions(text) {
    const parts = text.split(/\s+/);
    const isTypingArg = text.includes(' ');

    // Completing argument for cd → service names (supports cd ../partial)
    if (isTypingArg && parts[0].toLowerCase() === 'cd') {
      const arg = parts.slice(1).join(' ');
      const isRelative = arg.startsWith('../');
      const partial = (isRelative ? arg.slice(3) : arg).toLowerCase();
      const prefix = isRelative ? 'cd ../' : 'cd ';
      return getServices()
        .filter((s) => s.toLowerCase().startsWith(partial))
        .map((s) => prefix + s);
    }

    // Completing argument for venv → environment names
    if (isTypingArg && parts[0].toLowerCase() === 'venv') {
      const partial = parts.slice(1).join(' ').toLowerCase();
      const envs = (config && config.environments) || [];
      return envs
        .filter((e) => e.name.toLowerCase().startsWith(partial))
        .map((e) => 'venv ' + e.name);
    }

    // Completing first word
    if (!isTypingArg) {
      const partial = text.toLowerCase();
      const builtins = terminalCommands
        .map((c) => c.name.split(' ')[0])
        .filter((n) => n.startsWith(partial));
      const templateNames = templates
        .map((t) => t.name)
        .filter((n) => n.toLowerCase().startsWith(partial));
      // Per-service scripts when inside a service
      const currentScripts = activeTab.cwd ? getServiceScripts(activeTab.cwd) : [];
      const scriptNames = currentScripts
        .map((s) => s.name)
        .filter((n) => n.toLowerCase().startsWith(partial));
      const serviceNames = !activeTab.cwd
        ? getServices().filter((s) => s.toLowerCase().startsWith(partial)).map((s) => 'cd ' + s)
        : [];
      return [...new Set([...builtins, ...scriptNames, ...templateNames, ...serviceNames])];
    }

    return [];
  }

  // Auto-resize textarea to fit content
  function autoResize() {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = el.scrollHeight + 'px';
  }

  React.useEffect(autoResize, [input]);

  function handleKeyDown(e) {
    // Tab completion
    if (e.key === 'Tab') {
      e.preventDefault();
      if (!input.trim()) return;
      const matches = getCompletions(input);
      if (matches.length === 1) {
        setInput(matches[0]);
      } else if (matches.length > 1) {
        // Find common prefix
        let prefix = matches[0];
        for (let i = 1; i < matches.length; i++) {
          while (!matches[i].startsWith(prefix)) {
            prefix = prefix.slice(0, -1);
          }
        }
        if (prefix.length > input.length) {
          setInput(prefix);
        } else {
          appendOutput(activeTab.id, [
            { type: 'prompt-line', prompt: getPrompt(activeTab), command: input },
            { type: 'muted', text: matches.join('  ') },
          ]);
        }
      }
      return;
    }

    // Enter executes, Shift+Enter adds newline
    if (e.key === 'Enter' && !e.shiftKey && !running) {
      e.preventDefault();
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

        {/* Output + inline input */}
        <div
          className="terminal-output"
          ref={outputRef}
          onClick={() => {
            const selection = window.getSelection();
            if (!selection || selection.isCollapsed) {
              inputRef.current && inputRef.current.focus();
            }
          }}
        >
          {activeTab.output.map(renderLine)}

          {/* Inline prompt + input */}
          <div className="terminal-input-line">
            {running && (
              <span className="terminal-spinner">
                <i className="ti ti-loader" />
              </span>
            )}
            <span className="line-prompt">{getPrompt(activeTab)} </span>
            <textarea
              ref={inputRef}
              className="terminal-input"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              rows={1}
              placeholder={running ? 'Running...' : ''}
              disabled={running}
              autoFocus
              spellCheck={false}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
