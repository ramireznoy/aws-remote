const { LambdaClient, InvokeCommand } = require('@aws-sdk/client-lambda');
const { fromSSO } = require('@aws-sdk/credential-providers');

function getLambdaClient(profile, region) {
  const opts = { region };
  if (profile && profile !== 'default') {
    opts.credentials = fromSSO({ profile });
  }
  return new LambdaClient(opts);
}

async function invokeLambda(client, functionName, payload) {
  const command = new InvokeCommand({
    FunctionName: functionName,
    Payload: Buffer.from(JSON.stringify(payload)),
    LogType: 'Tail',
  });

  const response = await client.send(command);
  const responsePayload = Buffer.from(response.Payload).toString('utf-8');

  let parsed;
  try {
    parsed = JSON.parse(responsePayload);
  } catch {
    parsed = responsePayload;
  }

  return {
    statusCode: response.StatusCode,
    functionError: response.FunctionError || null,
    payload: parsed,
    logs: response.LogResult ? Buffer.from(response.LogResult, 'base64').toString('utf-8') : null,
  };
}

module.exports = { getLambdaClient, invokeLambda };
