const fs = require('fs');
const path = 'g:/Styrka_app/styrka_tech/src/screens/EmployeeTrackingScreen.tsx';
let code = fs.readFileSync(path, 'utf8');

// 1. Fix fetchAddress to add headers
code = code.replace(
  'const res = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`);',
  `const res = await fetch(\`https://nominatim.openstreetmap.org/reverse?lat=\${lat}&lon=\${lng}&format=json\`, {
        headers: { 'User-Agent': 'StyrkaApp/1.0' }
      });`
);

// 2. Fix fetchRoute to use HTTPS
code = code.replace(
  'http://router.project-osrm.org/route/v1/driving/',
  'https://router.project-osrm.org/route/v1/driving/'
);

// 3. Fix fetchActiveJourney else block to set currentLocation
code = code.replace(
  `} else {
          fetchAddress(journey.start_lat, journey.start_lng);
        }`,
  `} else {
          setCurrentLocation({ latitude: journey.start_lat, longitude: journey.start_lng });
          fetchAddress(journey.start_lat, journey.start_lng);
        }

        // Setup tracking if resumed
        if (!heartbeatTimerRef.current) {
          setTrackingSessionId(journey.id);
          setupTracking(journey.id);
        }`
);

// 4. Create setupTracking function
const setupTrackingCode = `
  const setupTracking = async (journeyId: string) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      const socket = getSocket(token);

      if (socket) {
        socket.on('connect', () => {
          console.log('[Socket] Connected / Reconnected. Socket presence enabled.');
        });
      }

      const sub = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.High,
          distanceInterval: 10,
        },
        async (loc) => {
          const newLat = loc.coords.latitude;
          const newLng = loc.coords.longitude;
          const timestamp = new Date(loc.timestamp).toISOString();
          
          setCurrentLocation({ latitude: newLat, longitude: newLng });
          
          let batteryLevel = 1.0;
          try {
            batteryLevel = await Battery.getBatteryLevelAsync();
          } catch (e) {}

          let networkType = 'unknown';
          try {
            const netInfo = await NetInfo.fetch();
            networkType = netInfo.type;
          } catch (e) {}

          const isMoving = loc.coords.speed !== null && loc.coords.speed > 0.5;
          const deviceId = Device.osBuildId || Device.modelName || 'RN_Device';
          const seq = sequenceNumberRef.current++;

          const payload = {
            protocolVersion: '1.0',
            latitude: newLat,
            longitude: newLng,
            accuracy: loc.coords.accuracy,
            speed: loc.coords.speed,
            heading: loc.coords.heading,
            altitude: loc.coords.altitude,
            timestamp,
            batteryLevel,
            networkType,
            isMoving,
            deviceId,
            trackingSessionId: journeyId,
            sequenceNumber: seq,
          };

          await TelemetryQueue.enqueue(payload);
          lastTelemetrySentTimeRef.current = Date.now();
          processQueue();

          const newPing = {
            latitude: newLat,
            longitude: newLng,
            status: 'Moving',
            timestamp,
          };
          setPings(prev => [...prev, newPing]);
        }
      );
      setLocationSubscription(sub);
      
      lastTelemetrySentTimeRef.current = Date.now();
      if (!heartbeatTimerRef.current) {
        heartbeatTimerRef.current = setInterval(async () => {
          processQueue();
          const now = Date.now();
          if (now - lastTelemetrySentTimeRef.current >= 10000) {
            let batteryLevel = 1.0;
            try {
              batteryLevel = await Battery.getBatteryLevelAsync();
            } catch (e) {}
            let networkType = 'unknown';
            try {
              const netInfo = await NetInfo.fetch();
              networkType = netInfo.type;
            } catch (e) {}
            const deviceId = Device.osBuildId || Device.modelName || 'RN_Device';
            const seq = sequenceNumberRef.current;
            LocationUploadService.sendHeartbeat({
              deviceId,
              trackingSessionId: journeyId,
              sequenceNumber: seq,
              networkType,
              batteryLevel,
            });
          }
        }, 10000);
      }

      const isBackgroundRunning = await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK_NAME);
      if (!isBackgroundRunning) {
        await Location.startLocationUpdatesAsync(LOCATION_TASK_NAME, {
          accuracy: Location.Accuracy.High,
          distanceInterval: 10,
          showsBackgroundLocationIndicator: true,
          pausesUpdatesAutomatically: false,
          foregroundService: {
            notificationTitle: "Styrka Tracking Active",
            notificationBody: "Your location is being tracked for the current journey."
          }
        }).catch(e => console.log(e));
      }
    } catch (e) {
      console.log('Error setting up tracking', e);
    }
  };
`;

// Insert setupTrackingCode before startJourney
code = code.replace(
  'const startJourney = async () => {',
  setupTrackingCode + '\n  const startJourney = async () => {'
);

// Modify startJourney to use setupTracking
// First, replace generateUUID usages with journey.id inside startJourney
// Wait, in startJourney we create the journey then we get data back.
const startJourneyRegex = /const sessionUuid = generateUUID\(\);\s*setTrackingSessionId\(sessionUuid\);\s*sequenceNumberRef\.current = 1;\s*setActiveJourney\(data\);\s*\/\/ Get session token and initialize Socket\.IO[\s\S]*?alert\("Journey started! Tracking is active even in the background\."\);/m;

const replacementStartJourney = `setTrackingSessionId(data.id);
      sequenceNumberRef.current = 1;
      setActiveJourney(data);
      
      await setupTracking(data.id);

      alert("Journey started! Tracking is active even in the background.");`;

code = code.replace(startJourneyRegex, replacementStartJourney);

fs.writeFileSync(path, code);
console.log('Done');
