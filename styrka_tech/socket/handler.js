/**
 * Socket.IO Telemetry Ingestion and Presence Handlers
 */
const { createClient } = require('@supabase/supabase-js');
const config = require('../config');
const osrm = require('../services/osrm');
const { recordMetric } = require('../routes/health');

const supabase = createClient(config.SUPABASE_URL, config.SUPABASE_SERVICE_ROLE_KEY);

// Active employee telemetry state cache
// Map: user_id -> { status, socketId, lastWriteLat, lastWriteLng, lastWriteTime, latestLoc, deviceSessionSequences: Map, offlineTimer }
const activeEmployees = new Map();

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

// Perform presence status update in Supabase employee_presence table
async function updatePresenceRecord(userId, sessionId, socketId, status, sequenceNum, connectionType) {
  try {
    const { error } = await supabase.from('employee_presence').upsert({
      employee_id: userId,
      tracking_session_id: sessionId || '00000000-0000-0000-0000-000000000000',
      socket_id: socketId,
      status: status,
      last_seen: new Date().toISOString(),
      last_heartbeat: new Date().toISOString(),
      last_sequence: sequenceNum || 0,
      connection_type: connectionType || 'unknown',
      updated_at: new Date().toISOString()
    });

    if (error) {
      console.error('[Presence DB Update Error]', error.message);
    }
  } catch (err) {
    console.error('[Presence DB Transaction Error]', err);
  }
}

module.exports = (io) => {
  io.on('connection', (socket) => {
    const userId = socket.user.id;
    const userRole = socket.user.role;

    console.log(`[Connected] User: ${userId} | Role: ${userRole} | Socket: ${socket.id}`);

    if (userRole === 'admin') {
      socket.join('admin-room');
      
      const list = [];
      activeEmployees.forEach((val, key) => {
        list.push({
          employee_id: key,
          ...val.latestLoc,
          status: val.status,
        });
      });
      socket.emit('initial:active_employees', list);
    } else {
      socket.join(`employee:${userId}`);
      
      // Load or create cache entry
      const cache = activeEmployees.get(userId) || {
        lastWriteLat: 0,
        lastWriteLng: 0,
        lastWriteTime: 0,
        deviceSessionSequences: new Map(),
      };
      cache.socketId = socket.id;
      cache.status = 'online';
      activeEmployees.set(userId, cache);

      // Presence Online Notification
      io.to('admin-room').emit('employee:status_change', {
        employee_id: userId,
        status: 'online',
      });

      updatePresenceRecord(userId, null, socket.id, 'online', 0, socket.handshake.headers['user-agent']);
    }

    // Presence Heartbeat Ping Ingestion (Step 9)
    socket.on('heartbeat', async (payload, ack) => {
      const serverTimestamp = new Date().toISOString();
      if (userRole !== 'employee') {
        if (typeof ack === 'function') {
          return ack({ success: false, reason: 'Invalid role', sequenceNumber: 0, serverTimestamp });
        }
        return;
      }

      try {
        const cache = activeEmployees.get(userId);
        if (cache) {
          cache.status = 'online';

          // Reset Heartbeat Presence Timeout Timer
          if (cache.offlineTimer) {
            clearTimeout(cache.offlineTimer);
          }
          
          cache.offlineTimer = setTimeout(async () => {
            console.log(`[Presence Timeout] User: ${userId} offline (no ping for ${config.OFFLINE_TIMEOUT_SECONDS}s)`);
            cache.status = 'offline';
            
            io.to('admin-room').emit('employee:status_change', {
              employee_id: userId,
              status: 'offline',
            });

            await Promise.all([
              supabase.from('employee_live_locations').update({ status: 'offline', updated_at: new Date().toISOString() }).eq('employee_id', userId),
              updatePresenceRecord(userId, payload.trackingSessionId, socket.id, 'offline', payload.sequenceNumber, payload.networkType)
            ]);
          }, config.OFFLINE_TIMEOUT_SECONDS * 1000);

          updatePresenceRecord(userId, payload.trackingSessionId, socket.id, 'online', payload.sequenceNumber, payload.networkType);
        }

        if (typeof ack === 'function') {
          ack({ success: true, reason: null, sequenceNumber: payload.sequenceNumber || 0, serverTimestamp });
        }
      } catch (err) {
        console.error('[Heartbeat Ingest Error]', err.message);
        if (typeof ack === 'function') {
          ack({ success: false, reason: err.message, sequenceNumber: payload.sequenceNumber || 0, serverTimestamp });
        }
      }
    });

    // Telemetry Ingestion with Composite Session Deduplication & Structured ACKs (Step 4, 5, 6)
    socket.on('location:update', async (payload, ack) => {
      const serverTimestamp = new Date().toISOString();
      if (userRole !== 'employee') {
        if (typeof ack === 'function') {
          return ack({ success: false, reason: 'Permissions rejected: Only employees can stream telemetry.', sequenceNumber: 0, serverTimestamp });
        }
        return;
      }

      try {
        const { 
          latitude, longitude, accuracy, speed, heading, altitude, 
          timestamp, batteryLevel, networkType, isMoving, deviceId, 
          trackingSessionId, sequenceNumber 
        } = payload;

        // 1. Strict Validation Pipeline
        
        // Coordinates bounds validation
        if (
          typeof latitude !== 'number' || latitude < -90 || latitude > 90 ||
          typeof longitude !== 'number' || longitude < -180 || longitude > 180
        ) {
          recordMetric('validationFailures');
          if (typeof ack === 'function') {
            return ack({ success: false, reason: 'Coordinates out of bounds.', sequenceNumber: sequenceNumber || 0, serverTimestamp });
          }
          return;
        }

        // Physical speed threshold validation
        const maxSpeedMps = config.MAX_SPEED_KMH / 3.6;
        if (typeof speed === 'number' && speed > maxSpeedMps) {
          recordMetric('validationFailures');
          if (typeof ack === 'function') {
            return ack({ success: false, reason: `Impossible speed recorded (> ${config.MAX_SPEED_KMH} km/h).`, sequenceNumber: sequenceNumber || 0, serverTimestamp });
          }
          return;
        }

        const cache = activeEmployees.get(userId) || {
          lastWriteLat: 0,
          lastWriteLng: 0,
          lastWriteTime: 0,
          deviceSessionSequences: new Map(),
          lastBattery: 1.0,
          lastIsMoving: true,
        };

        // Composite Deduplication Check (deviceId + trackingSessionId + sequenceNumber)
        const deviceSessionSequences = cache.deviceSessionSequences || new Map();
        cache.deviceSessionSequences = deviceSessionSequences;
        
        const compositeKey = `${deviceId || 'unknown_device'}:${trackingSessionId || 'unknown_session'}`;
        const lastSeq = deviceSessionSequences.get(compositeKey) || 0;

        if (sequenceNumber !== undefined) {
          if (sequenceNumber <= lastSeq) {
            recordMetric('duplicatePackets');
            if (typeof ack === 'function') {
              return ack({ success: false, reason: `Duplicate or out-of-order sequence: ${sequenceNumber} (last was ${lastSeq})`, sequenceNumber, serverTimestamp });
            }
            return;
          }
          deviceSessionSequences.set(compositeKey, sequenceNumber);
        }

        // Reset Heartbeat Presence Timeout Timer
        if (cache.offlineTimer) {
          clearTimeout(cache.offlineTimer);
        }
        
        cache.offlineTimer = setTimeout(async () => {
          console.log(`[Presence Timeout] User: ${userId} marked offline (no telemetry for ${config.OFFLINE_TIMEOUT_SECONDS}s)`);
          cache.status = 'offline';
          
          io.to('admin-room').emit('employee:status_change', {
            employee_id: userId,
            status: 'offline',
          });

          await Promise.all([
            supabase.from('employee_live_locations').update({ status: 'offline', updated_at: new Date().toISOString() }).eq('employee_id', userId),
            updatePresenceRecord(userId, trackingSessionId, socket.id, 'offline', sequenceNumber, networkType)
          ]);
        }, config.OFFLINE_TIMEOUT_SECONDS * 1000);

        // Transition presence status to online if required
        if (cache.status !== 'online') {
          cache.status = 'online';
          io.to('admin-room').emit('employee:status_change', {
            employee_id: userId,
            status: 'online',
          });
          
          supabase
            .from('employee_live_locations')
            .update({ status: 'online', updated_at: new Date().toISOString() })
            .eq('employee_id', userId)
            .then(({ error }) => {
              if (error) console.error('[DB Online Update Error]', error.message);
            });
          
          updatePresenceRecord(userId, trackingSessionId, socket.id, 'online', sequenceNumber, networkType);
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

        // Broadcast coordinates immediately to connected Admin Dashboards (<100ms)
        io.to('admin-room').emit('location:batch_update', [telemetry]);

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
          Promise.all([
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
            }),
          ]).then(([liveRes, historyRes]) => {
            recordMetric('databaseWrites');
            recordMetric('databaseLatencySum', Date.now() - dbStartTime);

            if (liveRes.error) console.error('[DB Write Failure] Live upsert failed:', liveRes.error.message);
            if (historyRes.error) console.error('[DB Write Failure] History log failed:', historyRes.error.message);
          }).catch((err) => {
            console.error('[DB Write Failure] Database transaction error:', err);
          });
        }

        activeEmployees.set(userId, cache);

        // Structured ACK response
        if (typeof ack === 'function') {
          ack({ success: true, reason: null, sequenceNumber, serverTimestamp });
        }
      } catch (err) {
        console.error('[Ingest Telemetry] Ingest failed:', err.message);
        if (typeof ack === 'function') {
          ack({ success: false, reason: err.message, sequenceNumber: payload.sequenceNumber || 0, serverTimestamp });
        }
      }
    });

    socket.on('disconnect', (reason) => {
      console.log(`[Disconnected] User: ${userId} | Reason: ${reason}`);

      if (userRole === 'employee') {
        const cache = activeEmployees.get(userId);
        if (cache) {
          cache.status = 'offline';
          activeEmployees.set(userId, cache);

          // Clear presence timeout on disconnect
          if (cache.offlineTimer) {
            clearTimeout(cache.offlineTimer);
          }

          // Broadcast status change immediately
          io.to('admin-room').emit('employee:status_change', {
            employee_id: userId,
            status: 'offline',
          });

          // Set status in database after buffer delay (in case they reconnect quickly)
          setTimeout(async () => {
            const latestCache = activeEmployees.get(userId);
            if (latestCache && latestCache.status === 'offline') {
              await Promise.all([
                supabase.from('employee_live_locations').update({ status: 'offline', updated_at: new Date().toISOString() }).eq('employee_id', userId),
                updatePresenceRecord(userId, null, socket.id, 'offline', 0, socket.handshake.headers['user-agent'])
              ]);
            }
          }, 5000);
        }
      }
    });
  });

  return activeEmployees;
};
