const {
  GetPipelineCommand,
  UpdatePipelineCommand,
  StartPipelineExecutionCommand,
  StopPipelineExecutionCommand,
  GetPipelineStateCommand,
  ListPipelineExecutionsCommand,
  ListActionExecutionsCommand,
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
      const [state, execList, definition, actionExecsResult] = await Promise.all([
        client.send(new GetPipelineStateCommand({ name })),
        client.send(new ListPipelineExecutionsCommand({ pipelineName: name, maxResults: 5 })),
        client.send(new GetPipelineCommand({ name })),
        client.send(new ListActionExecutionsCommand({ pipelineName: name, maxResults: 50 }))
          .catch(() => ({ actionExecutionDetails: [] })),
      ]);

      // Group action details by executionId, keeping the first failed action per execution
      const failedActionByExec = {};
      const latestActionByStageAction = {};
      const latestExecId = execList.pipelineExecutionSummaries?.[0]?.pipelineExecutionId;
      for (const d of (actionExecsResult.actionExecutionDetails || [])) {
        // For the inline failure detail on the current execution
        if (d.pipelineExecutionId === latestExecId) {
          latestActionByStageAction[`${d.stageName}/${d.actionName}`] = d;
        }
        // For history dots: track first failed action per past execution
        if (d.status === 'Failed' && !failedActionByExec[d.pipelineExecutionId]) {
          failedActionByExec[d.pipelineExecutionId] = d;
        }
      }

      const rawStages = (state.stageStates || []).map(s => ({
        name: s.stageName,
        status: s.latestExecution?.status || 'Idle',
        actionStates: s.actionStates || [],
      }));
      const overall = calculateOverallStatus(rawStages);

      const stages = rawStages.map(({ name: stageName, status, actionStates }) => ({
        name: stageName,
        status,
        actions: actionStates.map(a => {
          const detail = latestActionByStageAction[`${stageName}/${a.actionName}`];
          return {
            name: a.actionName,
            status: a.latestExecution?.status || 'Idle',
            errorMessage: detail?.output?.executionResult?.externalExecutionSummary
              || detail?.output?.executionResult?.errorDetails?.message
              || detail?.error?.message
              || null,
            externalUrl: detail?.output?.executionResult?.externalExecutionUrl || null,
          };
        }),
      }));
      const sourceBranch = extractSourceBranch(definition);

      // Format recent executions — include failure link for history dots
      const executions = (execList.pipelineExecutionSummaries || []).map(ex => {
        const failedAction = failedActionByExec[ex.pipelineExecutionId];
        return {
          id: ex.pipelineExecutionId,
          status: ex.status,
          statusSummary: ex.statusSummary || null,
          startTime: ex.startTime?.toISOString() || null,
          lastUpdateTime: ex.lastUpdateTime?.toISOString() || null,
          trigger: ex.trigger?.triggerType || null,
          sourceRevisions: (ex.sourceRevisions || []).map(sr => ({
            revisionId: sr.revisionId,
            revisionSummary: sr.revisionSummary,
          })),
          errorMessage: failedAction?.output?.executionResult?.externalExecutionSummary
            || failedAction?.output?.executionResult?.errorDetails?.message
            || failedAction?.error?.message
            || null,
          externalUrl: failedAction?.output?.executionResult?.externalExecutionUrl || null,
        };
      });

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
