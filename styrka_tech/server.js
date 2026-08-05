/**
 * Styrka Enterprise Telemetry Server Entrypoint
 */
const express = require('express');
const http = require('http');

const config = require('./config');
const healthRoutes = require('./routes/health');

const app = express();
const server = http.createServer(app);

// Active employee tracking cache
const activeEmployees = new Map();

// Expose activeEmployees reference on app instance
app.set('activeEmployees', activeEmployees);

// Bind Root / Landing Route
app.get('/', (req, res) => {
  res.status(200).json({ status: 'UP', message: 'Styrka Modular Fleet Telemetry Server' });
});

// Bind Observability Diagnostics Health Route (Step 19)
app.use(healthRoutes.router);

// Bind Location REST API
const expressAuth = require('./middleware/expressAuth');
const locationRoutes = require('./routes/location');
app.use('/api/location', expressAuth, locationRoutes);

server.listen(config.PORT, () => {
  console.log(`🚀 Modular Fleet Telemetry Server listening on port ${config.PORT}`);
});
