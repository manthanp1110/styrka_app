/**
 * Styrka Enterprise Telemetry Server Entrypoint
 */
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const config = require('./config');
const authMiddleware = require('./middleware/auth');
const healthRoutes = require('./routes/health');
const socketHandler = require('./socket/handler');

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
  pingInterval: 10000,
  pingTimeout: 5000,
});

// Configure Socket Auth handshakes
io.use(authMiddleware);

// Initialize Socket event handlers and capture the cache
const activeEmployees = socketHandler(io);

// Expose io and activeEmployees references on app instance for diagnostics health route
app.set('io', io);
app.set('activeEmployees', activeEmployees);

// Bind Observability Diagnostics Health Route (Step 19)
app.use(healthRoutes.router);

// Bind Location REST API
const expressAuth = require('./middleware/expressAuth');
const locationRoutes = require('./routes/location');
app.use('/api/location', expressAuth, locationRoutes);

server.listen(config.PORT, () => {
  console.log(`🚀 Modular Fleet Telemetry Server listening on port ${config.PORT}`);
});
