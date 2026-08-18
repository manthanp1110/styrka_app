import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, SafeAreaView, ActivityIndicator, StyleSheet, Platform, Alert, PermissionsAndroid } from 'react-native';
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
      // 1. Request location permissions unconditionally
      let { status: fgStatus } = await Location.requestForegroundPermissionsAsync();
      if (fgStatus !== 'granted') {
        Alert.alert(
          'Location Permission Required',
          'Please grant location permission to enable tracking and map navigation.',
          [{ text: 'OK' }]
        );
        setIsLoading(false);
        return;
      }

      // Prompt user natively to enable GPS if turned off on Android
      try {
        const servicesEnabled = await Location.hasServicesEnabledAsync();
        if (!servicesEnabled && Platform.OS === 'android') {
          try {
            await Location.enableNetworkProviderAsync();
          } catch (e) {
            Alert.alert(
              'GPS Disabled',
              'Location services (GPS) are turned off. Please swipe down your Android notifications bar and turn ON Location / GPS.'
            );
          }
        }
      } catch {}

      // Always connect SocketService for employee
      SocketService.connect(user.id || 'emp_1', 'employee');

      // 2. Fetch real initial device location immediately
      const initialLoc = await getDeviceLocation();
      if (initialLoc) {
        setCurrentLocation(initialLoc);
        fetchAddress(initialLoc.latitude, initialLoc.longitude);
        TrackingDataService.updateLiveLocation({
          userId: user.id || 'emp_1',
          latitude: initialLoc.latitude,
          longitude: initialLoc.longitude,
        });
        SocketService.updateLocation({
          userId: user.id || 'emp_1',
          latitude: initialLoc.latitude,
          longitude: initialLoc.longitude,
        });
      }

      // 3. Process assigned destination or active journey
      const assigned = route.params?.assignedDestination;
      if (assigned) {
        const newJourney: any = {
          id: `j_${user.id || 'emp_1'}`,
          user_id: user.id || 'emp_1',
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
          userId: user.id || 'emp_1',
          latitude: currentLat,
          longitude: currentLng,
          destination_lat: Number(assigned.latitude),
          destination_lng: Number(assigned.longitude),
          destination_address: assigned.address,
        });

        SocketService.updateLocation({
          userId: user.id || 'emp_1',
          latitude: currentLat,
          longitude: currentLng,
          destination_lat: Number(assigned.latitude),
          destination_lng: Number(assigned.longitude),
          destination_address: assigned.address,
        });

        AsyncStorage.setItem('active_journey', JSON.stringify(newJourney));
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
            userId: user.id || 'emp_1',
            latitude: currentLocation.latitude,
            longitude: currentLocation.longitude,
            destination_lat: Number(journey.destination_lat),
            destination_lng: Number(journey.destination_lng),
            destination_address: journey.address,
          });

          SocketService.updateLocation({
            userId: user.id || 'emp_1',
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
    if (Platform.OS === 'android') {
      try {
        Alert.alert(
          "Battery Optimization",
          "To ensure background tracking works reliably, please set this app's battery usage to 'Unrestricted' in settings.",
          [
            { text: "Cancel", style: "cancel" },
            { 
              text: "Open Settings", 
              onPress: async () => {
                await IntentLauncher.startActivityAsync(
                  IntentLauncher.ActivityAction.IGNORE_BATTERY_OPTIMIZATION_SETTINGS
                );
              }
            }
          ]
        );
      } catch (e) {
        console.log("Could not launch battery settings", e);
      }
    }
  };
  
  const setupTracking = async (journeyId?: string) => {
    try {
      SocketService.connect(user.id || 'emp_1', 'employee');

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

      // Background Location Service (Only available in compiled APK / Development Build, not Expo Go)
      try {
        const isExpoGo = Constants.appOwnership === 'expo' || Constants.executionEnvironment === 'storeClient';
        if (!isExpoGo && Platform.OS !== 'web') {
          const isBackgroundRunning = await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK_NAME);
          if (!isBackgroundRunning) {
            await Location.startLocationUpdatesAsync(LOCATION_TASK_NAME, {
              accuracy: Location.Accuracy.High,
              distanceInterval: 10,
              showsBackgroundLocationIndicator: true,
              pausesUpdatesAutomatically: false,
              foregroundService: {
                notificationTitle: "Styrka Tracking Active",
                notificationBody: "Your location is being tracked."
              }
            }).catch(e => console.log('Background location error:', e));
          }
        }
      } catch (e) {
        console.log('Skipped background task in Expo Go context:', e);
      }
    } catch (e) {
      console.log('Error setting up tracking', e);
    }
  };

  const startJourney = async () => {
    setIsProcessing(true);
    try {
      if (Platform.OS === 'android' && (Platform.Version as number) >= 33) {
        try {
          await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS);
        } catch (e) {}
      }

      let { status: fgStatus } = await Location.requestForegroundPermissionsAsync();
      if (fgStatus !== 'granted') {
        alert('Permission to access location was denied');
        setIsProcessing(false);
        return;
      }
      
      let { status: bgStatus } = await Location.requestBackgroundPermissionsAsync();
      if (bgStatus === 'granted') {
        checkBatteryOptimization();
      } else {
        Alert.alert(
          "Background Location Required",
          "For live tracking to work when your phone screen is off or app is in background, please set Location Permission to 'Allow all the time' in system settings.",
          [
            { text: "Later", style: "cancel" },
            { 
              text: "Open Settings", 
              onPress: async () => {
                await IntentLauncher.startActivityAsync(
                  IntentLauncher.ActivityAction.LOCATION_SOURCE_SETTINGS
                );
              } 
            }
          ]
        );
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

      if (!user.id) {
        alert("User session not found. Please log in again.");
        setIsProcessing(false);
        return;
      }
      const userId = user.id || 'emp_1';

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
      await AsyncStorage.setItem('active_journey_id', journeyData.id);

      if (route.params?.assignedDestination?.id) {
        await TrackingDataService.updateDestinationStatus(route.params.assignedDestination.id, 'in_progress');
      }

      // Send initial live location WITH destination to Supabase so admin can see polyline
      await TrackingDataService.updateLiveLocation({
        userId,
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

      setTrackingSessionId(journeyData.id);
      sequenceNumberRef.current = 1;
      activeJourneyRef.current = journeyData;
      setActiveJourney(journeyData);
      fetchRoute(finalStartLat, finalStartLng, destLat, destLng);
      
      await setupTracking(journeyData.id);
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

      // Mark destination status as completed in local storage & database
      const destId = route.params?.assignedDestination?.id || activeJourney.destination_id || activeJourney.id;
      if (destId) {
        await TrackingDataService.updateDestinationStatus(destId, 'completed');
      }

      // Notify Render server & Admin dashboard that employee tracking has stopped / completed
      SocketService.updateLocation({
        userId,
        email: user.email || undefined,
        name: user.name || undefined,
        latitude: currentLocation?.latitude || 0,
        longitude: currentLocation?.longitude || 0,
        status: 'offline',
      });
      SocketService.emitJourneyStatus({
        journeyId,
        userId,
        email: user.email || undefined,
        name: user.name || undefined,
        status: 'completed',
      });

      // Stop location watcher
      if (locationSubscription) {
        try { locationSubscription.remove(); } catch (e) {}
        setLocationSubscription(null);
      }
      
      // Stop background location task
      if (Platform.OS !== 'web') {
        await Location.stopLocationUpdatesAsync(LOCATION_TASK_NAME).catch(e => console.log('Stop bg location task error:', e));
      }

      // Clear heartbeat timer
      if (heartbeatTimerRef.current) {
        clearInterval(heartbeatTimerRef.current);
        heartbeatTimerRef.current = null;
      }

      // Clear storage & state
      await AsyncStorage.removeItem('active_journey');
      await AsyncStorage.removeItem('active_tracking_user_id');
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
      <View className="bg-[#0F4C3A] flex-row items-center justify-between px-4 py-4 z-10">
        <View className="flex-row items-center">
          <TouchableOpacity onPress={() => navigation.goBack()} className="mr-3 p-1">
            <Feather name="arrow-left" size={24} color="white" />
          </TouchableOpacity>
          <View className="w-10 h-10 rounded-full bg-[#F59E0B] items-center justify-center shadow-sm border border-[#D97706]">
            <Text className="text-white font-bold text-lg">{user.name?.charAt(0) || 'E'}</Text>
          </View>
          <View className="ml-3">
            <Text className="text-white font-bold text-lg leading-tight">STYRKA v2</Text>
            <Text className="text-[#F59E0B] text-[10px] font-bold tracking-widest">LIVE TRACKING</Text>
          </View>
        </View>

        <TouchableOpacity onPress={logout} className="w-10 h-10 rounded-xl bg-[#1A634E] items-center justify-center border border-[#144F3D]">
          <Feather name="log-out" size={18} color="#D1D5DB" />
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
              <View className="flex-row items-center justify-between mb-2">
                <View className="bg-emerald-100 px-3 py-1.5 rounded-full flex-row items-center border border-emerald-200">
                  <View className="w-2 h-2 rounded-full bg-emerald-500 mr-2" />
                  <Text className="text-emerald-700 font-bold text-xs uppercase tracking-wider">Driving</Text>
                </View>
                <Text className="text-gray-800 font-black text-lg">{Math.ceil(duration)} min</Text>
              </View>
              
              <View className="bg-gray-50 p-3 rounded-xl border border-gray-100 mb-4 flex-row items-center justify-between">
                 <View style={{ flex: 1 }}>
                   <Text className="text-xs text-gray-400 font-bold uppercase mb-1">Current Location</Text>
                   <Text className="text-gray-800 font-bold" numberOfLines={1}>{address}</Text>
                 </View>
                 <View className="items-end ml-4">
                   <Text className="text-xs text-gray-400 font-bold uppercase mb-1">Distance</Text>
                   <Text className="text-gray-800 font-bold">{distance.toFixed(1)} km</Text>
                 </View>
              </View>

              <TouchableOpacity 
                onPress={endJourney}
                disabled={isProcessing}
                className="bg-red-500 py-4 rounded-xl flex-row justify-center items-center shadow-sm"
              >
                {isProcessing ? (
                  <ActivityIndicator color="white" />
                ) : (
                  <>
                    <Feather name="square" size={18} color="white" />
                    <Text className="text-white font-bold text-base ml-2">Complete Drop-off</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          ) : (
            <View>
              <Text className="text-lg font-bold text-[#1F2937] mb-2">Ready to move?</Text>
              <Text className="text-gray-500 text-sm mb-4">
                Start tracking to log your GPS coordinates to the Admin dashboard in real-time.
              </Text>
              <TouchableOpacity 
                onPress={startJourney}
                disabled={isProcessing}
                className="bg-[#10B981] py-4 rounded-xl flex-row justify-center items-center shadow-sm"
              >
                {isProcessing ? (
                  <ActivityIndicator color="white" />
                ) : (
                  <>
                    <Feather name="play" size={18} color="white" />
                    <Text className="text-white font-bold text-base ml-2">Start Journey</Text>
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
    position: 'absolute', bottom: 30, left: 20, right: 20, backgroundColor: 'white',
    borderRadius: 24, padding: 20, shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1, shadowRadius: 12, elevation: 5, borderWidth: 1, borderColor: '#E5E7EB',
  }
});

export default EmployeeTrackingScreen;
