const { loadConfig, getClient } = require('../config/config');
const { getPipelineStatuses } = require('../services/aws-pipeline');

// Track active pipeline subscriptions per socket
const pipelineSubscriptions = new Map(); // socketId → Set<pipelineName>

function initializeWebSocket(io) {
  io.on('connection', (socket) => {
    console.log(`WebSocket connected: ${socket.id}`);
    pipelineSubscriptions.set(socket.id, new Set());

    // Subscribe to pipeline status updates
    socket.on('pipeline:subscribe', async ({ pipelines }) => {
      if (!Array.isArray(pipelines) || !pipelines.length) return;

      const subs = pipelineSubscriptions.get(socket.id);
      pipelines.forEach(name => {
        subs.add(name);
        socket.join(`pipeline:${name}`);
      });

      console.log(`Socket ${socket.id} subscribed to ${pipelines.length} pipelines`);

      // Send initial status immediately
      try {
        const config = loadConfig();
        const client = getClient(config.awsProfile, config.awsRegion);
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
      const config = loadConfig();
      const client = getClient(config.awsProfile, config.awsRegion);

      // Collect all unique pipelines across all subscriptions
      const allPipelines = new Set();
      pipelineSubscriptions.forEach(subs => {
        subs.forEach(name => allPipelines.add(name));
      });

      if (allPipelines.size === 0) return;

      const statuses = await getPipelineStatuses(client, Array.from(allPipelines));

      // Broadcast to rooms (one per pipeline)
      statuses.forEach(status => {
        io.to(`pipeline:${status.pipeline}`).emit('pipeline:status', {
          type: 'pipeline:status',
          timestamp: new Date().toISOString(),
          data: { statuses: [status] },
        });
      });
    } catch (err) {
      console.error('Pipeline polling error:', err.message);
    }
  }, 5000);
}

module.exports = { initializeWebSocket };
