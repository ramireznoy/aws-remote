const { loadConfig, getClient, getEnvObject } = require('../config/config');
const { getPipelineStatuses } = require('../services/aws-pipeline');

// Track active pipeline subscriptions per socket
// socketId → Map<pipelineName, { awsProfile, awsRegion }>
const pipelineSubscriptions = new Map();

function initializeWebSocket(io) {
  io.on('connection', (socket) => {
    console.log(`WebSocket connected: ${socket.id}`);
    pipelineSubscriptions.set(socket.id, new Map());

    // Subscribe to pipeline status updates
    socket.on('pipeline:subscribe', async ({ pipelines, environment }) => {
      if (!Array.isArray(pipelines) || !pipelines.length) return;

      const config = loadConfig();
      const env = getEnvObject(config, environment);
      const credentials = { awsProfile: env.awsProfile, awsRegion: env.awsRegion };

      const subs = pipelineSubscriptions.get(socket.id);
      pipelines.forEach(name => {
        subs.set(name, credentials);
        socket.join(`pipeline:${name}`);
      });

      console.log(`Socket ${socket.id} subscribed to ${pipelines.length} pipelines (env: ${environment})`);

      // Send initial status immediately
      try {
        const client = getClient(env.awsProfile, env.awsRegion);
        const statuses = await getPipelineStatuses(client, pipelines);

        socket.emit('pipeline:status', {
          type: 'pipeline:status',
          timestamp: new Date().toISOString(),
          data: { statuses },
        });
      } catch (err) {
        socket.emit('error', {
          type: 'error',
          timestamp: new Date().toISOString(),
          data: { message: err.message },
        });
      }
    });

    // Unsubscribe from pipeline updates
    socket.on('pipeline:unsubscribe', ({ pipelines }) => {
      if (!Array.isArray(pipelines)) return;

      const subs = pipelineSubscriptions.get(socket.id);
      pipelines.forEach(name => {
        subs.delete(name);
        socket.leave(`pipeline:${name}`);
      });

      console.log(`Socket ${socket.id} unsubscribed from ${pipelines.length} pipelines`);
    });

    socket.on('disconnect', () => {
      console.log(`WebSocket disconnected: ${socket.id}`);
      pipelineSubscriptions.delete(socket.id);
    });
  });

  // Poll and broadcast pipeline status updates every 5 seconds
  setInterval(async () => {
    if (pipelineSubscriptions.size === 0) return;

    try {
      // Collect all pipelines grouped by awsProfile:awsRegion
      const groups = new Map(); // "profile::region" → { awsProfile, awsRegion, pipelines: [] }
      pipelineSubscriptions.forEach(subs => {
        subs.forEach(({ awsProfile, awsRegion }, name) => {
          const key = `${awsProfile}::${awsRegion}`;
          if (!groups.has(key)) groups.set(key, { awsProfile, awsRegion, pipelines: [] });
          groups.get(key).pipelines.push(name);
        });
      });

      if (groups.size === 0) return;

      // Fetch statuses per credential group in parallel
      await Promise.all(Array.from(groups.values()).map(async ({ awsProfile, awsRegion, pipelines }) => {
        try {
          const client = getClient(awsProfile, awsRegion);
          // Deduplicate pipeline names within the group
          const uniquePipelines = [...new Set(pipelines)];
          const statuses = await getPipelineStatuses(client, uniquePipelines);

          // Broadcast to rooms (one per pipeline)
          statuses.forEach(status => {
            io.to(`pipeline:${status.pipeline}`).emit('pipeline:status', {
              type: 'pipeline:status',
              timestamp: new Date().toISOString(),
              data: { statuses: [status] },
            });
          });
        } catch (err) {
          console.error(`Pipeline polling error (${awsProfile}/${awsRegion}):`, err.message);
        }
      }));
    } catch (err) {
      console.error('Pipeline polling error:', err.message);
    }
  }, 5000);
}

module.exports = { initializeWebSocket };
