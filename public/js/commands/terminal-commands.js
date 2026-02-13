// Terminal built-in commands — registry pattern
// Each command: { name, description, execute(ctx) }
// ctx provides: { tab, args, templates, getServiceScripts, environment, getServices, appendOutput, updateTab }

function formatScriptLine(s) {
  return { type: 'command', text: '  ' + s.name.padEnd(20) + (s.description || s.command) };
}

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
      if (ctx.tab.cwd) {
        var serviceScripts = ctx.getServiceScripts(ctx.tab.cwd);
        if (serviceScripts.length) {
          lines.push({ type: 'muted', text: '' });
          lines.push({ type: 'info', text: 'Scripts for ' + ctx.tab.cwd + ':' });
          serviceScripts.forEach(function (s) { lines.push(formatScriptLine(s)); });
        }
        if (ctx.templates.length) {
          lines.push({ type: 'muted', text: '' });
          lines.push({ type: 'info', text: 'Global commands:' });
          ctx.templates.forEach(function (s) { lines.push(formatScriptLine(s)); });
        }
      } else {
        if (ctx.templates.length) {
          lines.push({ type: 'muted', text: '' });
          lines.push({ type: 'info', text: 'Global commands (run inside any service):' });
          ctx.templates.forEach(function (t) { lines.push(formatScriptLine(t)); });
        }
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
    description: 'List services or available scripts',
    execute: function (ctx) {
      var services = ctx.getServices();
      if (!ctx.tab.cwd) {
        // At root — list services with script count
        if (!services.length) {
          ctx.appendOutput([{ type: 'muted', text: 'No services configured. Add repos in Settings.' }]);
        } else {
          var lines = services.map(function (s) {
            var count = ctx.getServiceScripts(s).length;
            var suffix = count ? '  (' + count + ' scripts)' : '';
            return { type: 'info', text: '  ' + s + suffix };
          });
          ctx.appendOutput(lines);
        }
      } else {
        // Inside a service — show per-service scripts only
        var serviceScripts = ctx.getServiceScripts(ctx.tab.cwd);
        var lines = [];
        if (serviceScripts.length) {
          serviceScripts.forEach(function (s) { lines.push(formatScriptLine(s)); });
        } else {
          lines.push({ type: 'muted', text: 'No scripts configured for this service.' });
          lines.push({ type: 'muted', text: 'Type any command to run it directly.' });
        }
        ctx.appendOutput(lines);
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
