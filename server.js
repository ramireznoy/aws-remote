require('dotenv').config();

const express = require('express');
const path = require('path');
const http = require('http');
const { Server } = require('socket.io');
const { registerRoutes } = require('./lib/routes');
const { initializeWebSocket } = require('./lib/websocket/pipeline-monitor');
const { validateConfigProfile } = require('./lib/config/config');

// Ensure configured AWS profile exists on this machine
validateConfigProfile();

const app = express();
const server = http.createServer(app);
const io = new Server(server);
const PORT = process.env.PORT || 9001;

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Register all API routes
registerRoutes(app);

// Initialize WebSocket
initializeWebSocket(io);

// SPA fallback
app.get('*', (_req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start server
server.listen(PORT, () => {
  console.log(`Remote Control running at http://localhost:${PORT}`);
});
