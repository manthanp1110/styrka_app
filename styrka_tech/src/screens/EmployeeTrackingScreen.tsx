import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, SafeAreaView, ActivityIndicator, StyleSheet, Platform, Alert, PermissionsAndroid, AppState, AppStateStatus, Linking } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Feather } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useAppState } from '../store/useAppState';
import { TrackingDataService } from '../services/TrackingDataService';
import { MapView, Marker, Polyline } from '../components/NativeMap';

import * as Location from 'expo-location';
import { LOCATION_TASK_NAME } from '../tasks/locationTask';
import { decodePolyline } from '../utils/mapsUtils';

import * as Battery from 'expo-battery';
import * as IntentLauncher from 'expo-intent-launcher';
import NetInfo from '@react-native-community/netinfo';
import * as Device from 'expo-device';
import { TelemetryQueue } from '../utils/TelemetryQueue';
import LocationUploadService from '../services/LocationUploadService';
import MapplsApi from '../utils/mapplsApi';
import Constants from 'expo-constants';
import MapplsTrackingMap, { MapplsTrackingMapRef } from '../components/MapplsTrackingMap';
import SocketService from '../services/SocketService';
import BackgroundLocationManager from '../services/BackgroundLocationManager';

export const openAppSettings = async () => {
  try {
    await Linking.openSettings();
  } catch (e) {
    if (Platform.OS === 'android') {
      try {
        await IntentLauncher.startActivityAsync(
          IntentLauncher.ActivityAction.APPLICATION_DETAILS_SETTINGS,
          { data: 'package:com.manthanp_2811.styrka' }
        );
      } catch (err) {
        console.log('Error opening settings:', err);
      }
    }
  }
};

export const ensureAllLocationPermissions = async (promptBattery: boolean = false): Promise<boolean> => {
  return await BackgroundLocationManager.ensurePermissionsAndBatteryOpt(promptBattery);
};

function getDistanceFromLatLonInKm(lat1: number, lon1: number, lat2: number, lon2: number) {
  var R = 6371;
  var dLat = (lat2-lat1) * (Math.PI/180);
  var dLon = (lon2-lon1) * (Math.PI/180); 
  var a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * (Math.PI/180)) * Math.cos(lat2 * (Math.PI/180)) * 
    Math.sin(dLon/2) * Math.sin(dLon/2); 
  var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)); 
  var d = R * c;
  return d;
}

const EmployeeTrackingScreen = () => {
  const { logout, user } = useAppState();
  const navigation = useNavigation();
  const route = useRoute<any>();
  const mapRef = useRef<any>(null);
  const trackingMapRef = useRef<MapplsTrackingMapRef>(null);
  
  const [activeJourney, setActiveJourney] = useState<any>(null);
  const [pings, setPings] = useState<any[]>([]);
  const [currentLocation, setCurrentLocation] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [locationSubscription, setLocationSubscription] = useState<any>(null);
  const [distance, setDistance] = useState<number>(0);
  const [duration, setDuration] = useState<number>(0);
  const [address, setAddress] = useState<string>("Locating...");
  const [routeCoordinates, setRouteCoordinates] = useState<any[]>([]);
  const [trackingSessionId, setTrackingSessionId] = useState<string | null>(null);
  const sequenceNumberRef = useRef(1);
  const lastTelemetrySentTimeRef = useRef(0);
  const heartbeatTimerRef = useRef<any>(null);
  const lastDbUploadTimeRef = useRef<number>(0);
  const lastDbUploadCoordsRef = useRef<{ lat: number; lng: number } | null>(null);

  const fetchWithTimeout = (promise: Promise<any>, ms: number) => {
    let timeoutId: any;
    const timeoutPromise = new Promise((_, reject) => {
      timeoutId = setTimeout(() => reject(new Error('Timeout')), ms);
    });
    return Promise.race([promise, timeoutPromise]).finally(() => clearTimeout(timeoutId));
  };

  const fetchAddress = async (lat: number, lng: number) => {
    try {
      const res = await fetchWithTimeout(MapplsApi.reverseGeocode({ latitude: lat, longitude: lng }), 5000);
      if (res && res.results && res.results.length > 0) {
        setAddress(res.results[0].formatted_address);
        return;
      }
    } catch (e) {
      console.log('Mappls reverse geocoding error:', e);
    }
    setAddress(`${lat.toFixed(4)}, ${lng.toFixed(4)}`);
  };


  const fetchRoute = async (originLat: number, originLng: number, destLat: number, destLng: number) => {
    try {
      const res = await fetchWithTimeout(MapplsApi.direction({
        origin: `${originLng},${originLat}`,
        destination: `${destLng},${destLat}`,
        profile: 'driving',
        overview: 'full',
        geometries: 'polyline'
      }), 10000);
      
      if (res && res.routes && res.routes.length > 0) {
        const route = res.routes[0];
        setDistance(route.distance / 1000);
        setDuration(route.duration / 60);
        const decodedCoords = decodePolyline(route.geometry);
        setRouteCoordinates(decodedCoords);
        
        // Auto fit to show start and end
        if (mapRef.current && decodedCoords.length > 0) {
          mapRef.current.fitToCoordinates(decodedCoords, {
            edgePadding: { top: 50, right: 50, bottom: 200, left: 50 },
            duration: 1000
          });
        }
      } else {
        // Fallback distance calculation if routing fails (straight line)
        const straightDist = getDistanceFromLatLonInKm(originLat, originLng, destLat, destLng);
        setDistance(straightDist);
        setDuration((straightDist / 40) * 60); // assume 40km/h
        setRouteCoordinates([{ latitude: originLat, longitude: originLng }, { latitude: destLat, longitude: destLng }]);
        if (mapRef.current) {
          mapRef.current.fitToCoordinates([
            { latitude: originLat, longitude: originLng },
            { latitude: destLat, longitude: destLng }
          ], { edgePadding: { top: 50, right: 50, bottom: 200, left: 50 }, duration: 1000 });
        }
      }
    } catch (e) {
      console.log('Mappls routing error', e);
      // Fallback on error
      const straightDist = getDistanceFromLatLonInKm(originLat, originLng, destLat, destLng);
      setDistance(straightDist);
      setDuration((straightDist / 40) * 60);
      setRouteCoordinates([{ latitude: originLat, longitude: originLng }, { latitude: destLat, longitude: destLng }]);
      if (mapRef.current) {
        mapRef.current.fitToCoordinates([
          { latitude: originLat, longitude: originLng },
          { latitude: destLat, longitude: destLng }
        ], { edgePadding: { top: 50, right: 50, bottom: 200, left: 50 }, duration: 1000 });
      }
    }
  };

  // Ref to always expose current destination to watchPositionAsync callback
  const activeJourneyRef = useRef<any>(null);

  // Component-level robust GPS location retriever
  const getDeviceLocation = async (): Promise<{ latitude: number; longitude: number } | null> => {
    // Attempt 1: Instantaneous cell/Wi-Fi fix (resolves <100ms on all devices)
    try {
      const loc: any = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Lowest });
      if (loc?.coords?.latitude && loc?.coords?.longitude) {
        console.log('[GPS] Instant Lowest accuracy hit:', loc.coords.latitude, loc.coords.longitude);
        return { latitude: Number(loc.coords.latitude), longitude: Number(loc.coords.longitude) };
      }
    } catch (e) {
      console.log('[GPS] Lowest accuracy failed:', e);
    }

    // Attempt 2: Balanced accuracy
    try {
      const loc: any = await fetchWithTimeout(
        Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
        10000
      );
      if (loc?.coords?.latitude && loc?.coords?.longitude) {
        console.log('[GPS] Balanced accuracy hit:', loc.coords.latitude, loc.coords.longitude);
        return { latitude: Number(loc.coords.latitude), longitude: Number(loc.coords.longitude) };
      }
    } catch (e) {
      console.log('[GPS] Balanced accuracy failed:', e);
    }

    // Attempt 3: Last Known Position (fallback placeholder)
    try {
      const lastLoc = await Location.getLastKnownPositionAsync();
      if (lastLoc?.coords?.latitude && lastLoc?.coords?.longitude) {
        console.log('[GPS] LastKnown fallback:', lastLoc.coords.latitude, lastLoc.coords.longitude);
        return { latitude: Number(lastLoc.coords.latitude), longitude: Number(lastLoc.coords.longitude) };
      }
    } catch (e) {}

    return null;
  };

  const fetchActiveJourney = async () => {
    setIsLoading(true);
    try {
      // 1. Request all location & notification permissions
      const permsGranted = await ensureAllLocationPermissions();
      if (!permsGranted) {
        setIsLoading(false);
        return;
      }

      const currentEmpId = user.id || user.email || 'employee';
      await AsyncStorage.setItem('active_tracking_user_id', currentEmpId);
      if (user.email) await AsyncStorage.setItem('active_tracking_user_email', user.email);
      if (user.name) await AsyncStorage.setItem('active_tracking_user_name', user.name);

      // Always connect SocketService for employee
      SocketService.connect(currentEmpId, 'employee');

      // 2. Fetch real initial device location immediately
      const initialLoc = await getDeviceLocation();
      if (initialLoc) {
        setCurrentLocation(initialLoc);
        fetchAddress(initialLoc.latitude, initialLoc.longitude);
        TrackingDataService.updateLiveLocation({
          userId: currentEmpId,
          name: user.name || undefined,
          email: user.email || undefined,
          latitude: initialLoc.latitude,
          longitude: initialLoc.longitude,
        });
        SocketService.updateLocation({
          userId: currentEmpId,
          name: user.name || undefined,
          email: user.email || undefined,
          latitude: initialLoc.latitude,
          longitude: initialLoc.longitude,
        });
      }

      // 3. Process assigned destination or active journey
      const assigned = route.params?.assignedDestination;

      if (assigned) {
        const newJourney: any = {
          id: `j_${currentEmpId}`,
          user_id: currentEmpId,
          start_lat: initialLoc ? initialLoc.latitude : (Number(assigned.latitude) - 0.015),
          start_lng: initialLoc ? initialLoc.longitude : (Number(assigned.longitude) - 0.015),
          destination_lat: Number(assigned.latitude),
          destination_lng: Number(assigned.longitude),
          address: assigned.address,
          status: 'active',
          created_at: new Date().toISOString(),
        };

        activeJourneyRef.current = newJourney;
        setActiveJourney(newJourney);

        const currentLat = initialLoc ? initialLoc.latitude : (Number(assigned.latitude) - 0.015);
        const currentLng = initialLoc ? initialLoc.longitude : (Number(assigned.longitude) - 0.015);

        if (initialLoc) {
          fetchRoute(initialLoc.latitude, initialLoc.longitude, Number(assigned.latitude), Number(assigned.longitude));
        } else {
          const initialOffset = {
            latitude: currentLat,
            longitude: currentLng,
          };
          setCurrentLocation(initialOffset);
          fetchRoute(initialOffset.latitude, initialOffset.longitude, Number(assigned.latitude), Number(assigned.longitude));
        }

        // Broadcast current location WITH destination metadata immediately to Supabase & Socket.IO
        await TrackingDataService.updateLiveLocation({
          userId: currentEmpId,
          name: user.name || undefined,
          email: user.email || undefined,
          latitude: currentLat,
          longitude: currentLng,
          destination_lat: Number(assigned.latitude),
          destination_lng: Number(assigned.longitude),
          destination_address: assigned.address,
        });

        SocketService.updateLocation({
          userId: currentEmpId,
          name: user.name || undefined,
          email: user.email || undefined,
          latitude: currentLat,
          longitude: currentLng,
          destination_lat: Number(assigned.latitude),
          destination_lng: Number(assigned.longitude),
          destination_address: assigned.address,
        });

        await AsyncStorage.setItem('active_journey', JSON.stringify(newJourney));
        await AsyncStorage.setItem('active_journey_id', newJourney.id);
        setupTracking(newJourney.id);
        return;
      }

      const raw = await AsyncStorage.getItem('active_journey');
      if (raw) {
        const journey = JSON.parse(raw);
        activeJourneyRef.current = journey;
        setActiveJourney(journey);
        if (journey?.destination_lat && journey?.destination_lng && currentLocation) {
          fetchRoute(currentLocation.latitude, currentLocation.longitude, Number(journey.destination_lat), Number(journey.destination_lng));

          await TrackingDataService.updateLiveLocation({
            userId: currentEmpId,
            name: user.name || undefined,
            email: user.email || undefined,
            latitude: currentLocation.latitude,
            longitude: currentLocation.longitude,
            destination_lat: Number(journey.destination_lat),
            destination_lng: Number(journey.destination_lng),
            destination_address: journey.address,
          });

          SocketService.updateLocation({
            userId: currentEmpId,
            name: user.name || undefined,
            email: user.email || undefined,
            latitude: currentLocation.latitude,
            longitude: currentLocation.longitude,
            destination_lat: Number(journey.destination_lat),
            destination_lng: Number(journey.destination_lng),
            destination_address: journey.address,
          });
        }
        setupTracking(journey.id);
      } else {
        setActiveJourney(null);
        setPings([]);
        setupTracking();
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchActiveJourney();
  }, [user?.id, route.params?.assignedDestination]);


  useEffect(() => {
    if (activeJourney && currentLocation && activeJourney.destination_lat && activeJourney.destination_lng) {
      if (routeCoordinates.length === 0) {
        fetchRoute(
          currentLocation.latitude, currentLocation.longitude,
          activeJourney.destination_lat, activeJourney.destination_lng
        );
      }
    }
  }, [activeJourney, currentLocation]);

  useEffect(() => {
    if (activeJourney && currentLocation && !isProcessing && activeJourney.status === 'active') {
      const dist = getDistanceFromLatLonInKm(
        currentLocation.latitude, currentLocation.longitude,
        activeJourney.destination_lat, activeJourney.destination_lng
      );
      if (dist < 0.1) {
        const markArrived = async () => {
          try {
            const updated = { ...activeJourney, status: 'arrived' };
            await AsyncStorage.setItem('active_journey', JSON.stringify(updated));
            setActiveJourney(updated);
            Alert.alert("Arrival Detected", "You have arrived at your destination! You can now start your visit.");
          } catch (e) {
            console.log('Error setting arrived status:', e);
          }
        };
        markArrived();
      }
    }
  }, [currentLocation, activeJourney, isProcessing]);


  useEffect(() => {
    return () => {
      if (locationSubscription && typeof (locationSubscription as any).remove === 'function') {
        try {
          (locationSubscription as any).remove();
        } catch (e) {}
      }
    };
  }, [locationSubscription]);

  // AppState change listener: ensure background task and connection remain resilient when switching apps / returning to foreground
  useEffect(() => {
    const handleAppStateChange = async (nextAppState: AppStateStatus) => {
      console.log('[AppState] State changed to:', nextAppState);
      if (nextAppState === 'active') {
        await BackgroundLocationManager.verifyAndResumeTracking();
        try {
          // Fetch fresh GPS fix on resume
          const freshLoc = await getDeviceLocation();
          if (freshLoc) {
            setCurrentLocation(freshLoc);
            trackingMapRef.current?.updateLocation(freshLoc);
            fetchAddress(freshLoc.latitude, freshLoc.longitude);
          }

          // Process queued telemetry points
          processQueue();
        } catch (e) {
          console.warn('[AppState] Resume handler exception:', e);
        }
      }
    };

    const sub = AppState.addEventListener('change', handleAppStateChange);
    return () => {
      sub.remove();
    };
  }, []);

  const isProcessingQueueRef = useRef(false);

  const processQueue = async () => {
    if (isProcessingQueueRef.current) return;
    isProcessingQueueRef.current = true;
    try {
      await LocationUploadService.processQueue();
    } finally {
      isProcessingQueueRef.current = false;
    }
  };

  const checkBatteryOptimization = async () => {
    await BackgroundLocationManager.requestIgnoreBatteryOptimizations();
  };
  
  const setupTracking = async (journeyId?: string) => {
    try {
      const currentEmpId = user.id || user.email || (await AsyncStorage.getItem('active_tracking_user_id')) || 'emp_1';
      SocketService.connect(currentEmpId, 'employee');

      // Start continuous background tracking immediately while in foreground
      if (Platform.OS !== 'web') {
        BackgroundLocationManager.startTracking(user, activeJourneyRef.current).catch((err) => {
          console.warn('[EmployeeTrackingScreen] Early background start error:', err);
        });
      }

      // Foreground live location watcher for smooth map animation
      const sub = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.BestForNavigation,
          timeInterval: 1000,
          distanceInterval: 1,
        },
        async (loc) => {
          const newLat = loc.coords.latitude;
          const newLng = loc.coords.longitude;
          const timestamp = new Date(loc.timestamp).toISOString();
          
          setCurrentLocation({ latitude: newLat, longitude: newLng });
          trackingMapRef.current?.updateLocation({ latitude: newLat, longitude: newLng });
          fetchAddress(newLat, newLng);

          // Use ref to avoid stale closure — always has up-to-date destination
          const journey = activeJourneyRef.current;
          if (journey?.destination_lat && journey?.destination_lng) {
            fetchRoute(newLat, newLng, journey.destination_lat, journey.destination_lng);
          }

          // Smart DB throttling: Update Supabase if >3s elapsed OR >5m moved
          const now = Date.now();
          const lastTime = lastDbUploadTimeRef.current;
          const lastCoords = lastDbUploadCoordsRef.current;

          let shouldUpload = false;
          if (!lastCoords || now - lastTime > 3000) {
            shouldUpload = true;
          } else {
            const distMoved = getDistanceFromLatLonInKm(lastCoords.lat, lastCoords.lng, newLat, newLng) * 1000;
            if (distMoved >= 5) shouldUpload = true;
          }

          console.log('[LOCATION DEBUG] GPS position received:', {
            latitude: newLat,
            longitude: newLng,
            accuracy: loc.coords.accuracy,
            timestamp,
          });

          if (shouldUpload) {
            lastDbUploadTimeRef.current = now;
            lastDbUploadCoordsRef.current = { lat: newLat, lng: newLng };

            const userId = user.id || (await AsyncStorage.getItem('active_tracking_user_id')) || 'emp_1';
            await TrackingDataService.updateLiveLocation({
              userId,
              latitude: newLat,
              longitude: newLng,
              heading: loc.coords.heading || 0,
              speed: loc.coords.speed || 0,
              destination_lat: journey?.destination_lat ? Number(journey.destination_lat) : undefined,
              destination_lng: journey?.destination_lng ? Number(journey.destination_lng) : undefined,
              destination_address: journey?.address || undefined,
              status: 'online',
            });

            SocketService.updateLocation({
              userId,
              email: user.email || undefined,
              name: user.name || undefined,
              latitude: newLat,
              longitude: newLng,
              heading: loc.coords.heading || 0,
              speed: loc.coords.speed || 0,
              accuracy: loc.coords.accuracy || 0,
              timestamp,
              destination_lat: journey?.destination_lat ? Number(journey.destination_lat) : undefined,
              destination_lng: journey?.destination_lng ? Number(journey.destination_lng) : undefined,
              destination_address: journey?.address || undefined,
              status: 'online',
            });
          }
          
          let batteryLevel = 1.0;
          try { batteryLevel = await Battery.getBatteryLevelAsync(); } catch (e) {}

          let networkType = 'unknown';
          try { const netInfo = await NetInfo.fetch(); networkType = netInfo.type; } catch (e) {}

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
            try { batteryLevel = await Battery.getBatteryLevelAsync(); } catch (e) {}
            let networkType = 'unknown';
            try { const netInfo = await NetInfo.fetch(); networkType = netInfo.type; } catch (e) {}
            const deviceId = Device.osBuildId || Device.modelName || 'RN_Device';
            const seq = sequenceNumberRef.current;
            LocationUploadService.sendHeartbeat({
              deviceId, trackingSessionId: journeyId, sequenceNumber: seq, networkType, batteryLevel,
            });
          }
        }, 10000);
      }

      // Background Location Service (Runs continuously when app is closed, minimized, or screen locked)
      if (Platform.OS !== 'web') {
        await BackgroundLocationManager.startTracking(user, activeJourneyRef.current);
      }
    } catch (e) {
      console.log('Error setting up tracking', e);
    }
  };

  const startJourney = async () => {
    setIsProcessing(true);
    try {
      const permsGranted = await ensureAllLocationPermissions(true);
      if (!permsGranted) {
        setIsProcessing(false);
        return;
      }

      let startLat: number | null = null;
      let startLng: number | null = null;

      try {
        let location: any = await fetchWithTimeout(Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }), 5000);
        if (location && location.coords) {
          startLat = location.coords.latitude;
          startLng = location.coords.longitude;
        }
      } catch (e) {}

      if (!startLat || !startLng) {
        try {
          let lastLoc = await Location.getLastKnownPositionAsync();
          if (lastLoc && lastLoc.coords) {
            startLat = lastLoc.coords.latitude;
            startLng = lastLoc.coords.longitude;
          }
        } catch (e) {}
      }

      const assignedDestination = route.params?.assignedDestination;
      let destLat = startLat ? startLat + 0.05 : 28.6139;
      let destLng = startLng ? startLng + 0.05 : 77.2090;

      if (assignedDestination) {
        if (assignedDestination.latitude && assignedDestination.longitude) {
          destLat = Number(assignedDestination.latitude);
          destLng = Number(assignedDestination.longitude);
        } else if (assignedDestination.address) {
          try {
            const result = await fetchWithTimeout(MapplsApi.geocode({ address: assignedDestination.address }), 5000);
            if (result && result.results && result.results.length > 0) {
              destLat = result.results[0].latitude;
              destLng = result.results[0].longitude;
            }
          } catch (e) {}
        }
      }

      const finalStartLat = startLat ?? (destLat - 0.015);
      const finalStartLng = startLng ?? (destLng - 0.015);

      setCurrentLocation({ latitude: finalStartLat, longitude: finalStartLng });
      fetchAddress(finalStartLat, finalStartLng);

      const userId = user.id || user.email || 'employee';
      const destAddress = assignedDestination?.address || 'Custom destination';

      const journeyData = {
        id: `journey_${Date.now()}`,
        user_id: userId,
        status: 'active',
        start_lat: finalStartLat,
        start_lng: finalStartLng,
        destination_lat: destLat,
        destination_lng: destLng,
        address: destAddress,
        created_at: new Date().toISOString(),
      };

      await AsyncStorage.setItem('active_journey', JSON.stringify(journeyData));
      await AsyncStorage.setItem('active_tracking_user_id', userId);
      if (user.email) await AsyncStorage.setItem('active_tracking_user_email', user.email);
      if (user.name) await AsyncStorage.setItem('active_tracking_user_name', user.name);
      await AsyncStorage.setItem('active_journey_id', journeyData.id);

      if (route.params?.assignedDestination?.id) {
        await TrackingDataService.updateDestinationStatus(route.params.assignedDestination.id, 'in_progress');
      }

      // Send initial live location WITH destination to Supabase so admin can see polyline
      await TrackingDataService.updateLiveLocation({
        userId,
        name: user.name || undefined,
        email: user.email || undefined,
        latitude: finalStartLat,
        longitude: finalStartLng,
        destination_lat: destLat,
        destination_lng: destLng,
        destination_address: destAddress,
        status: 'online',
      });

      // Also emit via Socket.IO so admin gets immediate update
      SocketService.updateLocation({
        userId,
        email: user.email || undefined,
        name: user.name || undefined,
        latitude: finalStartLat,
        longitude: finalStartLng,
        heading: 0,
        speed: 0,
        destination_lat: destLat,
        destination_lng: destLng,
        destination_address: destAddress,
        status: 'online',
      });

      // Reset journey status on Admin dashboard to started
      SocketService.emitJourneyStatus({
        journeyId: journeyData.id,
        userId,
        email: user.email || undefined,
        name: user.name || undefined,
        status: 'started',
      });

      setTrackingSessionId(journeyData.id);
      sequenceNumberRef.current = 1;
      activeJourneyRef.current = journeyData;
      setActiveJourney(journeyData);
      fetchRoute(finalStartLat, finalStartLng, destLat, destLng);
      
      await setupTracking(journeyData.id);
      await BackgroundLocationManager.startTracking(user, journeyData);
      alert("Journey started! Tracking is active.");
    } catch (e: any) {
      alert("Failed to start journey: " + e.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const endJourney = async () => {
    if (!activeJourney) return;
    setIsProcessing(true);
    try {
      const userId = user.id || (await AsyncStorage.getItem('active_tracking_user_id')) || 'emp_1';
      const journeyId = activeJourney.id || `journey_${userId}`;

      // 1. Stop location watcher & background tasks first so no trailing GPS pings are sent
      if (locationSubscription) {
        try { locationSubscription.remove(); } catch (e) {}
        setLocationSubscription(null);
      }
      if (Platform.OS !== 'web') {
        await Location.stopLocationUpdatesAsync(LOCATION_TASK_NAME).catch((e) => console.log('Stop bg location task error:', e));
      }
      if (heartbeatTimerRef.current) {
        clearInterval(heartbeatTimerRef.current);
        heartbeatTimerRef.current = null;
      }

      const nowIso = new Date().toISOString();

      // 2. Mark destination status as completed in local storage & database
      const destId = route.params?.assignedDestination?.id || activeJourney.destination_id || activeJourney.id;
      if (destId) {
        await TrackingDataService.updateDestinationStatus(destId, 'completed', nowIso);
      }

      // 3. Notify Render server & Admin dashboard that employee tracking has stopped / completed
      SocketService.updateLocation({
        userId,
        email: user.email || undefined,
        name: user.name || undefined,
        latitude: currentLocation?.latitude || 0,
        longitude: currentLocation?.longitude || 0,
        status: 'offline',
        completed_at: nowIso,
      });
      SocketService.emitJourneyStatus({
        journeyId: destId || journeyId,
        destination_id: destId,
        userId,
        email: user.email || undefined,
        name: user.name || undefined,
        status: 'completed',
        completed_at: nowIso,
      });

      // Clear active journey from storage (keep active_tracking_user_id for user session)
      await AsyncStorage.removeItem('active_journey');
      await AsyncStorage.removeItem('active_journey_id');

      activeJourneyRef.current = null;
      setActiveJourney(null);
      setTrackingSessionId(null);
      setPings([]);
      setRouteCoordinates([]);
      setAddress("Locating...");

      Alert.alert("Journey Completed", "Drop-off is complete. Location tracking has stopped.");
      
      if (navigation.canGoBack()) {
        navigation.goBack();
      }
    } catch (e: any) {
      Alert.alert("Error", "Failed to end journey: " + e.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const initialRegion = {
    latitude: currentLocation?.latitude || activeJourney?.start_lat || 18.5204,
    longitude: currentLocation?.longitude || activeJourney?.start_lng || 73.8567,
    latitudeDelta: 0.05,
    longitudeDelta: 0.05,
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#0F4C3A' }}>
      <View style={{
        backgroundColor: 'rgba(15, 76, 58, 0.96)',
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(255, 255, 255, 0.12)',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 14,
        zIndex: 10,
        elevation: 6,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.2,
      }}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={{ marginRight: 12, padding: 4 }}>
            <Feather name="arrow-left" size={24} color="white" />
          </TouchableOpacity>
          <View style={{
            width: 40,
            height: 40,
            borderRadius: 20,
            backgroundColor: 'rgba(245, 158, 11, 0.25)',
            alignItems: 'center',
            justifyContent: 'center',
            borderWidth: 1.5,
            borderColor: 'rgba(245, 158, 11, 0.6)',
          }}>
            <Text style={{ color: 'white', fontWeight: 'bold', fontSize: 16 }}>{user.name?.charAt(0) || 'E'}</Text>
          </View>
          <View style={{ marginLeft: 12 }}>
            <Text style={{ color: 'white', fontWeight: 'bold', fontSize: 17, lineHeight: 22 }}>STYRKA Live</Text>
            <Text style={{ color: '#F59E0B', fontSize: 10, fontWeight: '800', letterSpacing: 1.5 }}>TRIP IN PROGRESS</Text>
          </View>
        </View>

        <TouchableOpacity 
          onPress={logout} 
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: 'rgba(239, 68, 68, 0.16)', 
            borderWidth: 1,
            borderColor: 'rgba(239, 68, 68, 0.38)',
            borderRadius: 12,
            paddingHorizontal: 10,
            paddingVertical: 6,
          }}
        >
          <Feather name="log-out" size={15} color="#F87171" style={{ marginRight: 4 }} />
          <Text style={{ color: '#FCA5A5', fontSize: 12, fontWeight: '700' }}>Exit</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.mapContainer}>
        {isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#10B981" />
            <Text style={{ marginTop: 10, color: 'gray' }}>Loading Map...</Text>
          </View>
        ) : activeJourney ? (
          <MapplsTrackingMap 
            ref={trackingMapRef}
            style={styles.map}
            origin={currentLocation || { latitude: Number(activeJourney.start_lat), longitude: Number(activeJourney.start_lng) }}
            destination={{ latitude: Number(activeJourney.destination_lat), longitude: Number(activeJourney.destination_lng) }}
            routeCoordinates={routeCoordinates}
            onSegmentComplete={(event: any) => {
              if (event && event.distance != null) {
                setDistance(event.distance / 1000);
              }
              if (event && event.duration != null) {
                setDuration(event.duration / 60);
              }
            }}
          />
        ) : (
          <MapView 
            ref={mapRef}
            style={styles.map} 
            region={{
              latitude: currentLocation?.latitude || 18.5204,
              longitude: currentLocation?.longitude || 73.8567,
              latitudeDelta: 0.02,
              longitudeDelta: 0.02,
            }}
          >
            {currentLocation && (
              <Marker
                coordinate={{
                  latitude: Number(currentLocation.latitude),
                  longitude: Number(currentLocation.longitude),
                }}
                title="My Current Location"
                pinColor="#3B82F6"
              />
            )}
          </MapView>
        )}

        <View style={styles.overlayCard}>
          {activeJourney ? (
            <View>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                <View style={{
                  backgroundColor: 'rgba(209, 250, 229, 0.92)',
                  paddingHorizontal: 12,
                  paddingVertical: 5,
                  borderRadius: 999,
                  flexDirection: 'row',
                  alignItems: 'center',
                  borderWidth: 1,
                  borderColor: 'rgba(110, 231, 183, 0.9)',
                }}>
                  <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#10B981', marginRight: 6 }} />
                  <Text style={{ color: '#047857', fontWeight: '800', fontSize: 11, letterSpacing: 0.6 }}>DRIVING / EN ROUTE</Text>
                </View>
                <Text style={{ color: '#111827', fontWeight: '900', fontSize: 19 }}>{Math.ceil(duration)} min</Text>
              </View>
              
              <View style={{
                backgroundColor: 'rgba(243, 244, 246, 0.88)',
                padding: 14,
                borderRadius: 16,
                borderWidth: 1,
                borderColor: 'rgba(229, 231, 235, 0.9)',
                marginBottom: 16,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}>
                 <View style={{ flex: 1 }}>
                   <Text style={{ fontSize: 10, color: '#6B7280', fontWeight: '800', letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 3 }}>Current Location</Text>
                   <Text style={{ color: '#111827', fontWeight: '700', fontSize: 13 }} numberOfLines={1}>{address}</Text>
                 </View>
                 <View style={{ alignItems: 'flex-end', marginLeft: 16 }}>
                   <Text style={{ fontSize: 10, color: '#6B7280', fontWeight: '800', letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 3 }}>Distance</Text>
                   <Text style={{ color: '#111827', fontWeight: '800', fontSize: 15 }}>{distance.toFixed(1)} km</Text>
                 </View>
              </View>

              <TouchableOpacity 
                onPress={endJourney}
                disabled={isProcessing}
                style={{
                  backgroundColor: '#EF4444',
                  borderWidth: 1,
                  borderColor: 'rgba(255, 255, 255, 0.25)',
                  paddingVertical: 15,
                  borderRadius: 14,
                  flexDirection: 'row',
                  justifyContent: 'center',
                  alignItems: 'center',
                  shadowColor: '#EF4444',
                  shadowOffset: { width: 0, height: 4 },
                  shadowOpacity: 0.3,
                  shadowRadius: 8,
                  elevation: 5,
                }}
              >
                {isProcessing ? (
                  <ActivityIndicator color="white" />
                ) : (
                  <>
                    <Feather name="square" size={17} color="white" />
                    <Text style={{ color: 'white', fontWeight: 'bold', fontSize: 15, marginLeft: 8 }}>Complete Drop-off</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          ) : (
            <View>
              <Text style={{ fontSize: 18, fontWeight: '800', color: '#111827', marginBottom: 4 }}>Ready to move?</Text>
              <Text style={{ color: '#6B7280', fontSize: 13, marginBottom: 16, lineHeight: 18 }}>
                Start tracking to broadcast your GPS coordinates to the Admin dashboard in real-time.
              </Text>
              <TouchableOpacity 
                onPress={startJourney}
                disabled={isProcessing}
                style={{
                  backgroundColor: '#0F4C3A',
                  borderWidth: 1,
                  borderColor: 'rgba(255, 255, 255, 0.2)',
                  paddingVertical: 15,
                  borderRadius: 14,
                  flexDirection: 'row',
                  justifyContent: 'center',
                  alignItems: 'center',
                  shadowColor: '#0F4C3A',
                  shadowOffset: { width: 0, height: 4 },
                  shadowOpacity: 0.3,
                  shadowRadius: 8,
                  elevation: 5,
                }}
              >
                {isProcessing ? (
                  <ActivityIndicator color="white" />
                ) : (
                  <>
                    <Feather name="play" size={18} color="white" />
                    <Text style={{ color: 'white', fontWeight: 'bold', fontSize: 15, marginLeft: 8 }}>Start Journey & Track</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  mapContainer: { flex: 1, backgroundColor: '#E5E7EB' },
  map: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  overlayCard: {
    position: 'absolute', 
    bottom: 24, 
    left: 16, 
    right: 16, 
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.85)',
    borderRadius: 24, 
    padding: 20, 
    shadowColor: '#000', 
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18, 
    shadowRadius: 16, 
    elevation: 8,
  }
});

export default EmployeeTrackingScreen;
