/**
 * Express Diagnostics health check endpoint
 */
const express = require('express');
const router = express.Router();

let metrics = {
  validationFailures: 0,
  duplicatePackets: 0,
  osrmLatencySum: 0,
  osrmRequests: 0,
  databaseLatencySum: 0,
  databaseWrites: 0,
};

function recordMetric(key, val = 1) {
  if (metrics[key] !== undefined) {
    metrics[key] += val;
  }
}

router.get('/health', (req, res) => {
  const io = req.app.get('io');
  const activeEmployees = req.app.get('activeEmployees');

  // Count active sockets
  const connectedSocketsCount = io ? io.engine.clientsCount : 0;
  
  // Count active employees in cache
  const activeEmployeesCount = activeEmployees ? activeEmployees.size : 0;

  res.status(200).json({
    status: 'UP',
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    connectedSockets: connectedSocketsCount,
    activeEmployees: activeEmployeesCount,
    performanceMetrics: {
      validationFailures: metrics.validationFailures,
      duplicatePackets: metrics.duplicatePackets,
      avgOsrmLatencyMs: metrics.osrmRequests > 0 ? Math.round(metrics.osrmLatencySum / metrics.osrmRequests) : 0,
      avgDbLatencyMs: metrics.databaseWrites > 0 ? Math.round(metrics.databaseLatencySum / metrics.databaseWrites) : 0,
    }
  });
});

module.exports = {
  router,
  recordMetric
};
