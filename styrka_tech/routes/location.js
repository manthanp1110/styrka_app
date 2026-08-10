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
    const userId = req.user.id;
    const { locations } = req.body;
    if (!Array.isArray(locations) || locations.length === 0) {
      return res.status(400).json({ success: false, reason: 'No locations provided.' });
    }

    const activeEmployees = req.app.get('activeEmployees');
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

      const cache = activeEmployees.get(userId) || {
        lastWriteLat: 0,
        lastWriteLng: 0,
        lastWriteTime: 0,
        status: 'online'
      };

      cache.status = 'online';
      cache.latestLoc = {
        employee_id: userId,
        latitude,
        longitude,
        speed: speed || 0,
        heading: heading || 0,
        timestamp: timestamp || new Date().toISOString()
      };

      activeEmployees.set(userId, cache);
      processedCount++;
    }

    res.status(200).json({ success: true, processedCount });

  } catch (err) {
    console.error('[Location REST API] Processing failed:', err.message);
    res.status(500).json({ success: false, reason: 'Internal server error processing locations.' });
  }
});

router.post('/heartbeat', express.json(), async (req, res) => {
  res.status(200).json({ success: true, status: 'online' });
});

module.exports = router;
