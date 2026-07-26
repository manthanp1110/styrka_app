const express = require('express');
const router = express.Router();
const { createClient } = require('@supabase/supabase-js');
const config = require('../config');
const osrm = require('../services/osrm');
const { recordMetric } = require('./health');

const supabase = createClient(config.SUPABASE_URL, config.SUPABASE_SERVICE_ROLE_KEY);

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
    const userRole = req.user.role;

    if (userRole !== 'employee') {
      return res.status(403).json({ success: false, reason: 'Permissions rejected: Only employees can stream telemetry.' });
    }

    const { locations } = req.body;
    if (!Array.isArray(locations) || locations.length === 0) {
      return res.status(400).json({ success: false, reason: 'No locations provided.' });
    }

    // Access activeEmployees from app instance (which is passed from socketHandler)
    const activeEmployees = req.app.get('activeEmployees');
    const io = req.app.get('io');
    
    let processedCount = 0;
    
    // Sort locations by timestamp ascending to process them in order
    const sortedLocations = locations.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

    for (const payload of sortedLocations) {
      const { 
        latitude, longitude, accuracy, speed, heading, altitude, 
        timestamp, batteryLevel, networkType, isMoving, deviceId, 
        trackingSessionId, sequenceNumber 
      } = payload;

      // 1. Strict Validation Pipeline
      if (
        typeof latitude !== 'number' || latitude < -90 || latitude > 90 ||
        typeof longitude !== 'number' || longitude < -180 || longitude > 180
      ) {
        recordMetric('validationFailures');
        continue;
      }

      const maxSpeedMps = config.MAX_SPEED_KMH / 3.6;
      if (typeof speed === 'number' && speed > maxSpeedMps) {
        recordMetric('validationFailures');
        continue;
      }

      // We maintain the cache to ensure we correctly throttle DB writes across REST and Socket
      const cache = activeEmployees.get(userId) || {
        lastWriteLat: 0,
        lastWriteLng: 0,
        lastWriteTime: 0,
        deviceSessionSequences: new Map(),
        lastBattery: 1.0,
        lastIsMoving: true,
      };

      // Composite Deduplication Check
      const deviceSessionSequences = cache.deviceSessionSequences || new Map();
      cache.deviceSessionSequences = deviceSessionSequences;
      
      const compositeKey = `${deviceId || 'unknown_device'}:${trackingSessionId || 'unknown_session'}`;
      const lastSeq = deviceSessionSequences.get(compositeKey) || 0;

      if (sequenceNumber !== undefined) {
        if (sequenceNumber <= lastSeq) {
          recordMetric('duplicatePackets');
          continue;
        }
        deviceSessionSequences.set(compositeKey, sequenceNumber);
      }

      // Transition presence status to online
      if (cache.status !== 'online') {
        cache.status = 'online';
        if (io) {
          io.to('admin-room').emit('employee:status_change', {
            employee_id: userId,
            status: 'online',
          });
        }
        
        // Asynchronously update presence, no need to await for telemetry ingestion
        supabase.from('employee_live_locations')
          .update({ status: 'online', updated_at: new Date().toISOString() })
          .eq('employee_id', userId).then();
        supabase.from('employee_presence')
          .upsert({
            employee_id: userId,
            tracking_session_id: trackingSessionId || '00000000-0000-0000-0000-000000000000',
            status: 'online',
            last_seen: new Date().toISOString(),
            last_heartbeat: new Date().toISOString(),
            last_sequence: sequenceNumber || 0,
            connection_type: networkType || 'unknown',
            updated_at: new Date().toISOString()
          }).then();
      }

      // 2. Conditional Map Snapping
      let snappedLat = null;
      let snappedLng = null;
      let snappedRoadName = null;

      const osrmStartTime = Date.now();
      if (accuracy != null && accuracy <= config.GPS_ACCURACY_THRESHOLD) {
        const snapped = await osrm.snapToNearestRoad(latitude, longitude);
        if (snapped) {
          snappedLat = snapped.latitude;
          snappedLng = snapped.longitude;
          snappedRoadName = snapped.roadName;
        }
        recordMetric('osrmRequests');
        recordMetric('osrmLatencySum', Date.now() - osrmStartTime);
      }

      const parsedTimestamp = timestamp ? new Date(timestamp).toISOString() : new Date().toISOString();

      const telemetry = {
        employee_id: userId,
        raw_latitude: latitude,
        raw_longitude: longitude,
        snapped_latitude: snappedLat,
        snapped_longitude: snappedLng,
        latitude: snappedLat !== null ? snappedLat : latitude,
        longitude: snappedLng !== null ? snappedLng : longitude,
        road_name: snappedRoadName,
        accuracy: accuracy || 0,
        speed: speed || 0,
        heading: heading || 0,
        altitude: altitude || 0,
        timestamp: parsedTimestamp,
        battery_level: batteryLevel || 1.0,
        network_type: networkType || 'unknown',
        is_moving: isMoving !== undefined ? isMoving : true,
        device_id: deviceId || 'unknown',
        sequence_number: sequenceNumber || 0,
        tracking_session_id: trackingSessionId || 'unknown',
        status: 'online'
      };

      // Broadcast coordinates immediately to connected Admin Dashboards
      if (io) {
        io.to('admin-room').emit('location:batch_update', [telemetry]);
      }

      cache.latestLoc = telemetry;

      // Evaluate database write throttling (MIN_DISTANCE_METERS / MAX_WRITE_INTERVAL_SECONDS)
      const now = Date.now();
      const referenceLat = snappedLat !== null ? snappedLat : latitude;
      const referenceLng = snappedLng !== null ? snappedLng : longitude;
      
      const distanceMoved = getDistanceInMeters(cache.lastWriteLat, cache.lastWriteLng, referenceLat, referenceLng);
      const timeElapsed = now - cache.lastWriteTime;
      const stateChanged = (Math.abs(cache.lastBattery - telemetry.battery_level) >= 0.15) || (cache.lastIsMoving !== telemetry.is_moving);

      if (distanceMoved >= config.MIN_DISTANCE_METERS || timeElapsed >= (config.MAX_WRITE_INTERVAL_SECONDS * 1000) || stateChanged) {
        cache.lastWriteLat = referenceLat;
        cache.lastWriteLng = referenceLng;
        cache.lastWriteTime = now;
        cache.lastBattery = telemetry.battery_level;
        cache.lastIsMoving = telemetry.is_moving;

        const dbStartTime = Date.now();
        try {
          const [liveRes, historyRes] = await Promise.all([
            // Upsert live locations
            supabase.from('employee_live_locations').upsert({
              employee_id: userId,
              raw_latitude: telemetry.raw_latitude,
              raw_longitude: telemetry.raw_longitude,
              snapped_latitude: telemetry.snapped_latitude,
              snapped_longitude: telemetry.snapped_longitude,
              road_name: telemetry.road_name,
              accuracy: telemetry.accuracy,
              speed: telemetry.speed,
              heading: telemetry.heading,
              battery_level: telemetry.battery_level,
              network_type: telemetry.network_type,
              is_moving: telemetry.is_moving,
              updated_at: telemetry.timestamp,
              status: 'online',
            }),
            // Insert history coordinates
            supabase.from('employee_locations').insert({
              user_id: userId,
              raw_latitude: telemetry.raw_latitude,
              raw_longitude: telemetry.raw_longitude,
              snapped_latitude: telemetry.snapped_latitude,
              snapped_longitude: telemetry.snapped_longitude,
              road_name: telemetry.road_name,
              accuracy: telemetry.accuracy,
              speed: telemetry.speed,
              heading: telemetry.heading,
              timestamp: telemetry.timestamp,
            })
          ]);
          
          recordMetric('databaseWrites');
          recordMetric('databaseLatencySum', Date.now() - dbStartTime);
          
          if (liveRes.error) console.error('[REST DB Write Failure] Live upsert failed:', liveRes.error.message);
          if (historyRes.error) console.error('[REST DB Write Failure] History log failed:', historyRes.error.message);
        } catch (dbErr) {
          console.error('[REST DB Write Failure] Database transaction error:', dbErr);
        }
      }

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
  try {
    const userId = req.user.id;
    const userRole = req.user.role;

    if (userRole !== 'employee') {
      return res.status(403).json({ success: false, reason: 'Permissions rejected.' });
    }

    const { deviceId, trackingSessionId, sequenceNumber, networkType, batteryLevel } = req.body;
    
    const activeEmployees = req.app.get('activeEmployees');
    const io = req.app.get('io');
    
    const cache = activeEmployees.get(userId);
    if (cache) {
      cache.status = 'online';

      if (cache.offlineTimer) {
        clearTimeout(cache.offlineTimer);
      }
      
      cache.offlineTimer = setTimeout(async () => {
        cache.status = 'offline';
        if (io) {
          io.to('admin-room').emit('employee:status_change', { employee_id: userId, status: 'offline' });
        }
        await Promise.all([
          supabase.from('employee_live_locations').update({ status: 'offline', updated_at: new Date().toISOString() }).eq('employee_id', userId),
          supabase.from('employee_presence').upsert({
            employee_id: userId,
            tracking_session_id: trackingSessionId || '00000000-0000-0000-0000-000000000000',
            status: 'offline',
            last_sequence: sequenceNumber || 0,
            connection_type: networkType || 'unknown',
            updated_at: new Date().toISOString()
          })
        ]);
      }, config.OFFLINE_TIMEOUT_SECONDS * 1000);

      // Upsert presence
      await supabase.from('employee_presence').upsert({
        employee_id: userId,
        tracking_session_id: trackingSessionId || '00000000-0000-0000-0000-000000000000',
        status: 'online',
        last_seen: new Date().toISOString(),
        last_heartbeat: new Date().toISOString(),
        last_sequence: sequenceNumber || 0,
        connection_type: networkType || 'unknown',
        updated_at: new Date().toISOString()
      });
    }

    res.status(200).json({ success: true });
  } catch (err) {
    console.error('[Heartbeat REST] Failed:', err.message);
    res.status(500).json({ success: false });
  }
});

module.exports = router;
