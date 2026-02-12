// Single source of truth for notification message content
function buildNotifyText(environment, developer, repos) {
  const lines = [`Deployment started on ${environment.toUpperCase()}`];
  if (developer) lines.push(`by ${developer}`);
  lines.push('');
  repos.forEach(r => {
    const pipelineName = r.pipelineName.replace('{env}', environment);
    lines.push(`${pipelineName}  (${r.branch})`);
  });
  return lines.join('\n');
}

async function notifyTeams(webhookUrl, environment, developer, repos) {
  if (!webhookUrl) return;

  // One FactSet row per repo — renders reliably across Teams clients
  const repoFacts = repos.map(r => ({
    title: r.pipelineName.replace('{env}', environment),
    value: r.branch,
  }));

  const card = {
    type: 'message',
    attachments: [{
      contentType: 'application/vnd.microsoft.card.adaptive',
      content: {
        '$schema': 'http://adaptivecards.io/schemas/adaptive-card.json',
        type: 'AdaptiveCard',
        version: '1.4',
        body: [
          {
            type: 'TextBlock',
            text: `Deployment started on ${environment.toUpperCase()}`,
            weight: 'Bolder',
            size: 'Medium',
            wrap: true,
          },
          {
            type: 'TextBlock',
            text: `by **${developer}**`,
            spacing: 'Small',
            isSubtle: true,
            wrap: true,
          },
          {
            type: 'FactSet',
            spacing: 'Medium',
            facts: repoFacts,
          },
        ],
      },
    }],
  };

  try {
    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(card),
    });
    if (!res.ok) {
      const text = await res.text();
      console.error('Teams notification failed:', res.status, text);
    }
  } catch (err) {
    console.error('Teams notification failed:', err.message);
  }
}

module.exports = { buildNotifyText, notifyTeams };
