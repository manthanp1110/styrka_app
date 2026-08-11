/**
 * Styrka Enterprise Telemetry & Realtime Socket.io Server Entrypoint
 */
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const config = require('./config');
const healthRoutes = require('./routes/health');

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
});

// Active employee tracking cache
const activeEmployees = new Map();
app.set('activeEmployees', activeEmployees);
app.set('io', io);

// Socket.io Real-time Event Handling
io.on('connection', (socket) => {
  console.log(`[Socket.io] Client connected: ${socket.id}`);

  // Register client role (admin / employee)
  socket.on('register', (data) => {
    const { userId, role } = data || {};
    if (userId) {
      socket.userId = userId;
      socket.userRole = role;
      socket.join(userId);
      if (role === 'admin') {
        socket.join('admin_room');
        console.log(`[Socket.io] Admin ${userId} joined admin_room. Sending ${activeEmployees.size} cached locations.`);
        // Send cached active employee locations to newly connected admin
        for (const [empId, record] of activeEmployees.entries()) {
          if (record && record.latestLoc) {
            socket.emit('employee_location_changed', record.latestLoc);
          }
        }
      } else {
        socket.join('employee_room');
      }
      console.log(`[Socket.io] User ${userId} (${role}) joined rooms.`);
    }
  });

  // Admin explicit pull request for all active employee locations
  socket.on('get_active_employees', () => {
    for (const [empId, record] of activeEmployees.entries()) {
      if (record && record.latestLoc) {
        socket.emit('employee_location_changed', record.latestLoc);
      }
    }
  });

  // Admin assigns destination -> relay to specific employee
  socket.on('assign_destination', (payload) => {
    console.log('[Socket.io] Destination assigned event:', payload);
    if (payload && payload.employee_id) {
      // Emit to employee room
      io.to(payload.employee_id).emit('destination_assigned', payload);
      // Emit to all admins
      io.to('admin_room').emit('destination_assigned', payload);
    }
  });

  // Employee sends live GPS location -> relay to admins
  socket.on('update_location', (payload) => {
    if (payload && payload.userId) {
      const locationRecord = {
        employee_id: payload.userId,
        latitude: payload.latitude,
        longitude: payload.longitude,
        heading: payload.heading || 0,
        speed: payload.speed || 0,
        status: 'online',
        timestamp: payload.timestamp || new Date().toISOString(),
      };

      activeEmployees.set(payload.userId, {
        latestLoc: locationRecord,
        status: 'online',
      });

      // Broadcast real-time location change to admin room
      io.to('admin_room').emit('employee_location_changed', locationRecord);
    }
  });

  // Journey status events (started, arrived, completed)
  socket.on('journey_status', (payload) => {
    console.log('[Socket.io] Journey status update:', payload);
    io.to('admin_room').emit('journey_status_changed', payload);
  });

  socket.on('disconnect', () => {
    console.log(`[Socket.io] Client disconnected: ${socket.id}`);
  });
});

// Landing Route
app.get('/', (req, res) => {
  res.status(200).json({ status: 'UP', message: 'Styrka Modular Fleet Socket.io & Telemetry Server' });
});

// Health Diagnostics Route
app.use(healthRoutes.router);

// Location REST API
const expressAuth = require('./middleware/expressAuth');
const locationRoutes = require('./routes/location');
app.use('/api/location', expressAuth, locationRoutes);

server.listen(config.PORT, () => {
  console.log(`🚀 Modular Fleet Telemetry & Socket.io Server listening on port ${config.PORT}`);
});
