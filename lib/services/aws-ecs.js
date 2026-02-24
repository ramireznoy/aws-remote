const { ECSClient, DescribeTaskDefinitionCommand } = require('@aws-sdk/client-ecs');
const { SSMClient, GetParametersCommand } = require('@aws-sdk/client-ssm');
const { fromSSO } = require('@aws-sdk/credential-providers');

function getECSClient(profile, region) {
  const opts = { region };
  if (profile && profile !== 'default') opts.credentials = fromSSO({ profile });
  return new ECSClient(opts);
}

function getSSMClient(profile, region) {
  const opts = { region };
  if (profile && profile !== 'default') opts.credentials = fromSSO({ profile });
  return new SSMClient(opts);
}

// Extract parameter name from SSM ARN: arn:aws:ssm:region:account:parameter/path → /path
function arnToParamName(valueFrom) {
  const match = valueFrom.match(/parameter(\/.+)$/);
  return match ? match[1] : valueFrom;
}

// Batch-fetch SSM parameters (API limit: 10 per call)
async function resolveSSMSecrets(ssmClient, secrets) {
  const ssmSecrets = (secrets || []).filter(s => s.valueFrom && s.valueFrom.includes(':ssm:'));
  if (!ssmSecrets.length) return {};

  const paramNames = [...new Set(ssmSecrets.map(s => arnToParamName(s.valueFrom)))];
  const paramMap = {};

  for (let i = 0; i < paramNames.length; i += 10) {
    const batch = paramNames.slice(i, i + 10);
    const result = await ssmClient.send(new GetParametersCommand({ Names: batch, WithDecryption: true }));
    for (const p of result.Parameters || []) paramMap[p.Name] = p.Value;
  }

  const resolved = {};
  for (const s of ssmSecrets) {
    const name = arnToParamName(s.valueFrom);
    resolved[s.name] = paramMap[name] ?? `(not found: ${name})`;
  }
  return resolved;
}

async function getTaskEnvVars(profile, region, taskName) {
  const ecsClient = getECSClient(profile, region);
  const ssmClient = getSSMClient(profile, region);

  const { taskDefinition } = await ecsClient.send(
    new DescribeTaskDefinitionCommand({ taskDefinition: taskName })
  );

  const containers = await Promise.all(
    (taskDefinition.containerDefinitions || []).map(async (c) => {
      const plain = Object.fromEntries((c.environment || []).map(({ name, value }) => [name, value]));
      const secrets = await resolveSSMSecrets(ssmClient, c.secrets || []);
      return { name: c.name, vars: { ...plain, ...secrets } };
    })
  );

  return { taskName, containers };
}

module.exports = { getTaskEnvVars };
