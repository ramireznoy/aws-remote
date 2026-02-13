// Terminal built-in commands — registry pattern
// Each command: { name, description, execute(ctx) }
// ctx provides: { tab, appendOutput, updateTab, getServices, templates, environment }

var terminalCommands = [
  {
    name: 'help',
    description: 'Show this help',
    execute: function (ctx) {
      var lines = [
        { type: 'info', text: 'Available commands:' },
        { type: 'muted', text: '' },
      ];
      terminalCommands.forEach(function (cmd) {
        lines.push({ type: 'command', text: '  ' + cmd.name.padEnd(16) + cmd.description });
      });
      if (ctx.templates.length) {
        lines.push({ type: 'muted', text: '' });
        lines.push({ type: 'info', text: 'Command templates (run inside a service):' });
        ctx.templates.forEach(function (t) {
          lines.push({ type: 'command', text: '  ' + t.name.padEnd(20) + (t.description || t.command) });
        });
      }
      lines.push({ type: 'muted', text: '' });
      lines.push({ type: 'info', text: 'Inside a service, any input runs as a command via Lambda.' });
      lines.push({ type: 'muted', text: 'Lambda: ' + ctx.environment + '-run-command' });
      ctx.appendOutput(lines);
    },
  },

  {
    name: 'clear',
    description: 'Clear terminal output',
    execute: function (ctx) {
      ctx.updateTab(function (t) { return Object.assign({}, t, { output: [] }); });
    },
  },

  {
    name: 'history',
    description: 'Show command history',
    execute: function (ctx) {
      if (!ctx.tab.history.length) {
        ctx.appendOutput([{ type: 'muted', text: 'No command history' }]);
      } else {
        var lines = ctx.tab.history.map(function (h, i) {
          return { type: 'command', text: '  ' + String(i + 1).padStart(4) + '  ' + h };
        });
        ctx.appendOutput(lines);
      }
    },
  },

  {
    name: 'ls',
    description: 'List services or command templates',
    execute: function (ctx) {
      var services = ctx.getServices();
      if (!ctx.tab.cwd) {
        if (!services.length) {
          ctx.appendOutput([{ type: 'muted', text: 'No services configured. Add repos in Settings.' }]);
        } else {
          ctx.appendOutput(services.map(function (s) { return { type: 'info', text: '  ' + s }; }));
        }
      } else {
        if (!ctx.templates.length) {
          ctx.appendOutput([
            { type: 'muted', text: 'No command templates configured.' },
            { type: 'muted', text: 'Type any command to run it, e.g.: npm run migrate' },
          ]);
        } else {
          var lines = [{ type: 'info', text: 'Command templates:' }];
          ctx.templates.forEach(function (t) {
            lines.push({ type: 'command', text: '  ' + t.name.padEnd(20) + (t.description || t.command) });
          });
          ctx.appendOutput(lines);
        }
      }
    },
  },

  {
    name: 'cd <service>',
    description: 'Navigate into a service (cd .. to go back)',
    execute: function (ctx) {
      var target = ctx.args.join(' ').trim();
      if (!target || target === '/') {
        ctx.updateTab(function (t) { return Object.assign({}, t, { cwd: null }); });
        return;
      }
      if (target === '..' || target === '../') {
        ctx.updateTab(function (t) { return Object.assign({}, t, { cwd: null }); });
        return;
      }
      var services = ctx.getServices();
      if (services.includes(target)) {
        ctx.updateTab(function (t) { return Object.assign({}, t, { cwd: target }); });
        return;
      }
      var match = services.find(function (s) { return s.includes(target); });
      if (match) {
        ctx.updateTab(function (t) { return Object.assign({}, t, { cwd: match }); });
        ctx.appendOutput([{ type: 'muted', text: '→ matched: ' + match }]);
        return;
      }
      ctx.appendOutput([{ type: 'error', text: 'cd: no such service: ' + target }]);
    },
  },
];

// Lookup by command name (first word only)
function findTerminalCommand(cmd) {
  return terminalCommands.find(function (c) {
    return c.name === cmd || c.name.split(' ')[0] === cmd;
  });
}
