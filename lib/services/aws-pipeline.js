const {
  GetPipelineCommand,
  UpdatePipelineCommand,
  StartPipelineExecutionCommand,
  StopPipelineExecutionCommand,
  GetPipelineStateCommand,
  ListPipelineExecutionsCommand,
  ListPipelinesCommand,
} = require('@aws-sdk/client-codepipeline');

// Calculate overall status from stages
function calculateOverallStatus(stages) {
  if (stages.some(s => s.status === 'Failed')) {
    return 'Failed';
  } else if (stages.some(s => s.status === 'InProgress' || s.status === 'Stopping')) {
    return 'InProgress';
  } else if (stages.every(s => s.status === 'Succeeded')) {
    return 'Succeeded';
  } else if (stages.some(s => s.status === 'Stopped')) {
    return 'Stopped';
  } else if (stages.some(s => s.status === 'Canceled' || s.status === 'Superseded')) {
    return 'Canceled';
  } else if (stages.every(s => s.status === 'Idle')) {
    return 'Idle';
  } else {
    // Mixed states that don't fit any pattern (shouldn't happen often)
    return 'Unknown';
  }
}

// Extract source branch from pipeline definition
function extractSourceBranch(definition) {
  const sourceStage = definition.pipeline?.stages?.find(s =>
    s.actions?.some(a => a.actionTypeId?.category === 'Source')
  );
  if (sourceStage) {
    for (const action of sourceStage.actions || []) {
      if (action.actionTypeId?.category === 'Source' && action.configuration) {
        return action.configuration.BranchName || action.configuration.Branch || null;
      }
    }
  }
  return null;
}

// Fetch statuses for multiple pipelines
async function getPipelineStatuses(client, pipelineNames) {
  return Promise.all(pipelineNames.map(async (name) => {
    try {
      const [state, execList, definition] = await Promise.all([
        client.send(new GetPipelineStateCommand({ name })),
        client.send(new ListPipelineExecutionsCommand({ pipelineName: name, maxResults: 5 })),
        client.send(new GetPipelineCommand({ name })),
      ]);

      const stages = (state.stageStates || []).map(s => ({
        name: s.stageName,
        status: s.latestExecution?.status || 'Idle',
      }));

      const overall = calculateOverallStatus(stages);
      const sourceBranch = extractSourceBranch(definition);

      // Format recent executions
      const executions = (execList.pipelineExecutionSummaries || []).map(ex => ({
        id: ex.pipelineExecutionId,
        status: ex.status,
        startTime: ex.startTime?.toISOString() || null,
        lastUpdateTime: ex.lastUpdateTime?.toISOString() || null,
        trigger: ex.trigger?.triggerType || null,
        sourceRevisions: (ex.sourceRevisions || []).map(sr => ({
          revisionId: sr.revisionId,
          revisionSummary: sr.revisionSummary,
        })),
      }));

      return { pipeline: name, overall, stages, sourceBranch, executions };
    } catch (err) {
      return { pipeline: name, overall: 'Error', error: err.message, stages: [], sourceBranch: null, executions: [] };
    }
  }));
}

// Update pipeline source branch
async function updatePipelineBranch(client, pipelineName, branch) {
  const { pipeline, metadata } = await client.send(
    new GetPipelineCommand({ name: pipelineName })
  );

  // Update source stage branch
  const sourceStage = pipeline.stages.find(s =>
    s.name.toLowerCase() === 'source' ||
    s.actions.some(a => a.actionTypeId?.category === 'Source')
  );

  if (sourceStage) {
    for (const action of sourceStage.actions) {
      if (action.actionTypeId?.category === 'Source' && action.configuration) {
        // Handle both CodeStar/GitHub and CodeCommit
        if (action.configuration.BranchName !== undefined) {
          action.configuration.BranchName = branch;
        }
        if (action.configuration.Branch !== undefined) {
          action.configuration.Branch = branch;
        }
      }
    }
  }

  // Update pipeline
  delete pipeline.metadata;
  await client.send(new UpdatePipelineCommand({ pipeline }));
}

// List pipelines matching environment prefix
async function listPipelines(client, envPrefix) {
  const { pipelines } = await client.send(new ListPipelinesCommand({}));
  return pipelines
    .filter(p => p.name.toLowerCase().includes(envPrefix.toLowerCase()))
    .map(p => ({ name: p.name, created: p.created, updated: p.updated }));
}

// Trigger pipeline execution
async function triggerPipeline(client, pipelineName) {
  const { pipelineExecutionId } = await client.send(
    new StartPipelineExecutionCommand({ name: pipelineName })
  );
  return { pipelineExecutionId };
}

// Stop pipeline execution
async function stopPipeline(client, pipelineName, executionId) {
  await client.send(
    new StopPipelineExecutionCommand({
      pipelineName,
      pipelineExecutionId: executionId,
      abandon: false,
      reason: 'Stopped by user via Remote Control',
    })
  );
}

module.exports = {
  calculateOverallStatus,
  extractSourceBranch,
  getPipelineStatuses,
  updatePipelineBranch,
  listPipelines,
  triggerPipeline,
  stopPipeline,
};
