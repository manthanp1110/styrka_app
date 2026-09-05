const express = require('express');
const router = express.Router();
const osrm = require('../services/osrm');
const { recordMetric } = require('./health');

// Helper to calculate distance between coordinates (Haversine formula in meters)
function getDistanceInMeters(lat1, lon1, lat2, lon2) {
  const R = 6371e3; // Earth radius in meters
  const phi1 = (lat1 * Math.PI) / 180;
  const phi2 = (lat2 * Math.PI) / 180;
  const deltaPhi = ((lat2 - lat1) * Math.PI) / 180;
  const deltaLambda = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
    Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

router.post('/upload', express.json(), async (req, res) => {
  try {
    const defaultUserId = req.user?.id || 'employee';
    const { locations } = req.body;
    if (!Array.isArray(locations) || locations.length === 0) {
      return res.status(400).json({ success: false, reason: 'No locations provided.' });
    }

    const activeEmployees = req.app.get('activeEmployees');
    const io = req.app.get('io');
    let processedCount = 0;
    
    // Sort locations by timestamp ascending to process them in order
    const sortedLocations = locations.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

    for (const payload of sortedLocations) {
      const { 
        latitude, longitude, accuracy, speed, heading, altitude, 
        timestamp, batteryLevel, networkType, isMoving, deviceId 
      } = payload;

      // 1. Strict Validation Pipeline
      if (
        typeof latitude !== 'number' || latitude < -90 || latitude > 90 ||
        typeof longitude !== 'number' || longitude < -180 || longitude > 180
      ) {
        recordMetric('validationFailures');
        continue;
      }

      const empId = payload.userId || payload.employee_id || defaultUserId;
      const cache = activeEmployees.get(empId) || {
        lastWriteLat: 0,
        lastWriteLng: 0,
        lastWriteTime: 0,
        status: 'online'
      };

      const empEmail = payload.email || cache.email || cache.latestLoc?.email || '';
      const empName = payload.name || cache.name || cache.latestLoc?.name || '';
      const isOffline = payload.status === 'offline';

      const locationRecord = {
        employee_id: empId,
        user_id: empId,
        email: empEmail,
        name: empName,
        latitude,
        longitude,
        speed: isOffline ? 0 : (speed || 0),
        heading: heading || 0,
        accuracy: accuracy || 0,
        altitude: altitude || 0,
        status: isOffline ? 'offline' : 'online',
        timestamp: timestamp || new Date().toISOString(),
        destination_lat: payload.destination_lat != null ? Number(payload.destination_lat) : (cache.latestLoc?.destination_lat != null ? Number(cache.latestLoc.destination_lat) : null),
        destination_lng: payload.destination_lng != null ? Number(payload.destination_lng) : (cache.latestLoc?.destination_lng != null ? Number(cache.latestLoc.destination_lng) : null),
        destination_address: payload.destination_address || cache.latestLoc?.destination_address || null,
        batteryLevel: batteryLevel != null ? batteryLevel : null,
        networkType: networkType || null,
        deviceId: deviceId || null,
      };

      cache.status = isOffline ? 'offline' : 'online';
      cache.latestLoc = locationRecord;
      if (empEmail) cache.email = empEmail;
      if (empName) cache.name = empName;

      activeEmployees.set(empId, cache);
      if (empEmail) activeEmployees.set(empEmail, cache);
      if (empName) activeEmployees.set(empName, cache);

      // CRITICAL: Real-time broadcast to admin room so Admin sees background location updates live!
      if (io) {
        io.to('admin_room').emit('employee_location_changed', locationRecord);
        io.to('employee_room').emit('employee_location_changed', locationRecord);
      }

      processedCount++;
    }

    res.status(200).json({ success: true, processedCount });

  } catch (err) {
    console.error('[Location REST API] Processing failed:', err.message);
    res.status(500).json({ success: false, reason: 'Internal server error processing locations.' });
  }
});

// GET /api/location/active - Returns all active employee live locations
router.get('/active', async (req, res) => {
  try {
    const activeEmployees = req.app.get('activeEmployees');
    if (!activeEmployees) {
      return res.status(200).json([]);
    }

    const seen = new Set();
    const result = [];
    for (const [key, record] of activeEmployees.entries()) {
      if (record && record.latestLoc && record.latestLoc.latitude != null) {
        const primaryId = record.latestLoc.employee_id || record.latestLoc.user_id;
        if (primaryId && !seen.has(primaryId)) {
          seen.add(primaryId);
          result.push(record.latestLoc);
        }
      }
    }

    res.status(200).json(result);
  } catch (err) {
    console.error('[Location REST API] Failed to get active employees:', err.message);
    res.status(500).json({ success: false, reason: 'Failed to retrieve active employees.' });
  }
});

router.post('/heartbeat', express.json(), async (req, res) => {
  res.status(200).json({ success: true, status: 'online' });
});

module.exports = router;
