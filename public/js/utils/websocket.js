// WebSocket Event Bus — Real-time communication with backend

var WebSocketClient = (function () {
  let socket = null;
  const listeners = new Map(); // eventType → Set<callback>

  function connect() {
    if (socket?.connected) {
      console.log('WebSocket already connected:', socket.id);
      return socket;
    }

    // Socket.IO client is loaded from CDN in index.html
    console.log('Connecting to WebSocket...');
    socket = io({
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: Infinity,
    });

    socket.on('connect', () => {
      console.log('✓ WebSocket connected:', socket.id);
    });

    socket.on('disconnect', (reason) => {
      console.warn('✗ WebSocket disconnected:', reason);
    });

    socket.on('connect_error', (err) => {
      console.error('✗ WebSocket connection error:', err.message);
    });

    // Route incoming events to registered listeners
    socket.onAny((eventType, payload) => {
      console.log('← WebSocket event received:', eventType, payload);
      const callbacks = listeners.get(eventType);
      if (callbacks) {
        callbacks.forEach(cb => {
          try {
            cb(payload);
          } catch (err) {
            console.error(`Error in WebSocket listener for ${eventType}:`, err);
          }
        });
      }
    });

    return socket;
  }

  function on(eventType, callback) {
    if (!listeners.has(eventType)) {
      listeners.set(eventType, new Set());
    }
    listeners.get(eventType).add(callback);

    // Return unsubscribe function
    return () => {
      const callbacks = listeners.get(eventType);
      if (callbacks) {
        callbacks.delete(callback);
        if (callbacks.size === 0) {
          listeners.delete(eventType);
        }
      }
    };
  }

  function emit(eventType, data) {
    if (!socket?.connected) {
      console.warn('✗ WebSocket not connected, cannot emit:', eventType);
      return;
    }
    console.log('→ WebSocket emit:', eventType, data);
    socket.emit(eventType, data);
  }

  function subscribePipelines(pipelineNames, environment) {
    if (!pipelineNames || !pipelineNames.length) return;
    console.log('→ Subscribing to pipelines:', pipelineNames, '(env:', environment, ')');
    emit('pipeline:subscribe', { pipelines: pipelineNames, environment });
  }

  function unsubscribePipelines(pipelineNames) {
    if (!pipelineNames || !pipelineNames.length) return;
    console.log('→ Unsubscribing from pipelines:', pipelineNames);
    emit('pipeline:unsubscribe', { pipelines: pipelineNames });
  }

  return {
    connect,
    on,
    emit,
    subscribePipelines,
    unsubscribePipelines,
  };
})();
