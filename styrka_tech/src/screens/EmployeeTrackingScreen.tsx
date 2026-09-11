import React, { useState, useEffect, useRef } from 'react';
import { 
  View, 
  Text, 
  TouchableOpacity, 
  SafeAreaView, 
  ActivityIndicator, 
  StyleSheet, 
  Platform, 
  Alert, 
  AppState, 
  AppStateStatus, 
  Linking 
} from 'react-native';
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
import GoogleMapsApi from '../utils/googleMapsApi';
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
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const mapRef = useRef<any>(null);
  const trackingMapRef = useRef<MapplsTrackingMapRef>(null);
  
  // Connection / Duty state (Feature 2)
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  
  // Destination state (Feature 1 - Optional)
  const [activeJourney, setActiveJourney] = useState<any>(null);
  const activeJourneyRef = useRef<any>(null);

  const [currentLocation, setCurrentLocation] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [locationSubscription, setLocationSubscription] = useState<any>(null);
  const [distance, setDistance] = useState<number>(0);
  const [duration, setDuration] = useState<number>(0);
  const [address, setAddress] = useState<string>("Locating...");
  const [routeCoordinates, setRouteCoordinates] = useState<any[]>([]);
  
  const sequenceNumberRef = useRef(1);
  const lastTelemetrySentTimeRef = useRef(0);
  const heartbeatTimerRef = useRef<any>(null);
  const lastDbUploadTimeRef = useRef<number>(0);
  const lastDbUploadCoordsRef = useRef<{ lat: number; lng: number } | null>(null);
  const hasCenteredRef = useRef<boolean>(false);
  const lastGeocodeCoordsRef = useRef<{ lat: number; lng: number } | null>(null);
  const lastGeocodeTimeRef = useRef<number>(0);
  const lastRouteCoordsRef = useRef<{ lat: number; lng: number } | null>(null);
  const lastRouteTimeRef = useRef<number>(0);

  const fetchWithTimeout = (promise: Promise<any>, ms: number) => {
    let timeoutId: any;
    const timeoutPromise = new Promise((_, reject) => {
      timeoutId = setTimeout(() => reject(new Error('Timeout')), ms);
    });
    return Promise.race([promise, timeoutPromise]).finally(() => clearTimeout(timeoutId));
  };

  const fetchAddress = async (lat: number, lng: number) => {
    const now = Date.now();
    const last = lastGeocodeCoordsRef.current;
    if (last && now - lastGeocodeTimeRef.current < 25000) {
      const moved = getDistanceFromLatLonInKm(last.lat, last.lng, lat, lng) * 1000;
      if (moved < 50) return;
    }
    lastGeocodeCoordsRef.current = { lat, lng };
    lastGeocodeTimeRef.current = now;

    try {
      const res = await fetchWithTimeout(GoogleMapsApi.reverseGeocode({ latitude: lat, longitude: lng }), 3500);
      if (res && res.results && res.results.length > 0) {
        setAddress(res.results[0].formatted_address);
        return;
      }
    } catch (e) {
      console.log('[EmployeeTracking] Reverse geocoding fallback:', e);
    }
    setAddress(`${lat.toFixed(4)}, ${lng.toFixed(4)}`);
  };

  const fetchRoute = async (originLat: number, originLng: number, destLat: number, destLng: number) => {
    const now = Date.now();
    const last = lastRouteCoordsRef.current;
    if (last && now - lastRouteTimeRef.current < 20000) {
      const moved = getDistanceFromLatLonInKm(last.lat, last.lng, originLat, originLng) * 1000;
      if (moved < 30) return;
    }
    lastRouteCoordsRef.current = { lat: originLat, lng: originLng };
    lastRouteTimeRef.current = now;

    try {
      const res = await fetchWithTimeout(GoogleMapsApi.direction({
        origin: `${originLng},${originLat}`,
        destination: `${destLng},${destLat}`,
        profile: 'driving',
        overview: 'full',
        geometries: 'polyline'
      }), 6000);
      
      if (res && res.routes && res.routes.length > 0) {
        const route = res.routes[0];
        setDistance(route.distance / 1000);
        setDuration(route.duration / 60);
        const decodedCoords = decodePolyline(route.geometry);
        setRouteCoordinates(decodedCoords);
        
        if (mapRef.current && decodedCoords.length > 0) {
          mapRef.current.fitToCoordinates(decodedCoords, {
            edgePadding: { top: 60, right: 60, bottom: 200, left: 60 },
            animated: true
          });
        }
      } else {
        const straightDist = getDistanceFromLatLonInKm(originLat, originLng, destLat, destLng);
        setDistance(straightDist);
        setDuration((straightDist / 40) * 60);
        setRouteCoordinates([{ latitude: originLat, longitude: originLng }, { latitude: destLat, longitude: destLng }]);
      }
    } catch (e) {
      const straightDist = getDistanceFromLatLonInKm(originLat, originLng, destLat, destLng);
      setDistance(straightDist);
      setDuration((straightDist / 40) * 60);
      setRouteCoordinates([{ latitude: originLat, longitude: originLng }, { latitude: destLat, longitude: destLng }]);
    }
  };

  const getDeviceLocation = async (): Promise<{ latitude: number; longitude: number } | null> => {
    try {
      const loc: any = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      if (loc?.coords?.latitude && loc?.coords?.longitude) {
        return { latitude: Number(loc.coords.latitude), longitude: Number(loc.coords.longitude) };
      }
    } catch (e) {}

    try {
      const lastLoc = await Location.getLastKnownPositionAsync();
      if (lastLoc?.coords?.latitude && lastLoc?.coords?.longitude) {
        return { latitude: Number(lastLoc.coords.latitude), longitude: Number(lastLoc.coords.longitude) };
      }
    } catch (e) {}

    return null;
  };

  // Initialize Screen State (Duty Connection & Destination)
  const initializeState = async () => {
    setIsLoading(true);
    try {
      const currentEmpId = user.id || user.email || 'employee';
      await AsyncStorage.setItem('active_tracking_user_id', currentEmpId);
      if (user.email) await AsyncStorage.setItem('active_tracking_user_email', user.email);
      if (user.name) await AsyncStorage.setItem('active_tracking_user_name', user.name);

      SocketService.connect(currentEmpId, 'employee');

      // 1. Check if previously connected to duty
      const savedDuty = await AsyncStorage.getItem('is_duty_connected');
      const isDutyActive = savedDuty === 'true';
      setIsConnected(isDutyActive);

      // 2. Fetch fresh initial device location
      const initialLoc = await getDeviceLocation();
      if (initialLoc) {
        setCurrentLocation(initialLoc);
        fetchAddress(initialLoc.latitude, initialLoc.longitude);
        if (!hasCenteredRef.current && mapRef.current) {
          hasCenteredRef.current = true;
          mapRef.current.animateToRegion({
            latitude: initialLoc.latitude,
            longitude: initialLoc.longitude,
            latitudeDelta: 0.018,
            longitudeDelta: 0.018,
          }, 800);
        }
      }

      // 3. Process assigned destination (if user just picked one or if saved)
      const assigned = route.params?.assignedDestination;
      if (assigned) {
        const journeyData = {
          id: assigned.id || `j_${currentEmpId}`,
          user_id: currentEmpId,
          destination_lat: Number(assigned.latitude),
          destination_lng: Number(assigned.longitude),
          address: assigned.address,
          status: 'active',
          created_at: new Date().toISOString(),
        };
        activeJourneyRef.current = journeyData;
        setActiveJourney(journeyData);
        await AsyncStorage.setItem('active_journey', JSON.stringify(journeyData));

        if (initialLoc) {
          fetchRoute(initialLoc.latitude, initialLoc.longitude, Number(assigned.latitude), Number(assigned.longitude));
        }

        // If connected, sync new destination to Supabase & Socket immediately
        if (isDutyActive) {
          const syncLat = initialLoc?.latitude || 0;
          const syncLng = initialLoc?.longitude || 0;
          TrackingDataService.updateLiveLocation({
            userId: currentEmpId,
            name: user.name || undefined,
            email: user.email || undefined,
            latitude: syncLat,
            longitude: syncLng,
            destination_lat: Number(assigned.latitude),
            destination_lng: Number(assigned.longitude),
            destination_address: assigned.address,
            status: 'online',
          });
          SocketService.updateLocation({
            userId: currentEmpId,
            name: user.name || undefined,
            email: user.email || undefined,
            latitude: syncLat,
            longitude: syncLng,
            destination_lat: Number(assigned.latitude),
            destination_lng: Number(assigned.longitude),
            destination_address: assigned.address,
            status: 'online',
          });
        }
      } else {
        const rawJourney = await AsyncStorage.getItem('active_journey');
        if (rawJourney) {
          const journey = JSON.parse(rawJourney);
          activeJourneyRef.current = journey;
          setActiveJourney(journey);
          if (journey?.destination_lat && journey?.destination_lng && initialLoc) {
            fetchRoute(initialLoc.latitude, initialLoc.longitude, Number(journey.destination_lat), Number(journey.destination_lng));
          }
        }
      }

      // 4. If duty was active, start live tracking watchers
      if (isDutyActive) {
        startForegroundWatcher();
        BackgroundLocationManager.verifyAndResumeTracking();
      }
    } catch (e) {
      console.error('[EmployeeTracking] Init state error:', e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    initializeState();
  }, [user?.id, route.params?.assignedDestination]);

  // AppState change listener: ensure background task and connection remain resilient
  useEffect(() => {
    const handleAppStateChange = async (nextAppState: AppStateStatus) => {
      if (nextAppState === 'active' && isConnected) {
        await BackgroundLocationManager.verifyAndResumeTracking();
        const freshLoc = await getDeviceLocation();
        if (freshLoc) {
          setCurrentLocation(freshLoc);
          trackingMapRef.current?.updateLocation(freshLoc);
          fetchAddress(freshLoc.latitude, freshLoc.longitude);
        }
        LocationUploadService.processQueue();
      }
    };

    const sub = AppState.addEventListener('change', handleAppStateChange);
    return () => {
      sub.remove();
    };
  }, [isConnected]);

  // Foreground watcher for smooth UI updates
  const startForegroundWatcher = async () => {
    if (locationSubscription) {
      try { locationSubscription.remove(); } catch (e) {}
    }

    try {
      const sub = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.High,
          timeInterval: 2000,
          distanceInterval: 1,
        },
        async (loc) => {
          const newLat = loc.coords.latitude;
          const newLng = loc.coords.longitude;
          const timestamp = new Date(loc.timestamp).toISOString();

          setCurrentLocation({ latitude: newLat, longitude: newLng });
          if (!hasCenteredRef.current && mapRef.current) {
            hasCenteredRef.current = true;
            mapRef.current.animateToRegion({
              latitude: newLat,
              longitude: newLng,
              latitudeDelta: 0.018,
              longitudeDelta: 0.018,
            }, 800);
          }
          fetchAddress(newLat, newLng);

          const journey = activeJourneyRef.current;
          if (journey?.destination_lat && journey?.destination_lng) {
            fetchRoute(newLat, newLng, Number(journey.destination_lat), Number(journey.destination_lng));
          }

          // Throttle updates: send if >3 seconds OR >5m moved
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

          if (shouldUpload) {
            lastDbUploadTimeRef.current = now;
            lastDbUploadCoordsRef.current = { lat: newLat, lng: newLng };

            const userId = user.id || user.email || 'employee';
            TrackingDataService.updateLiveLocation({
              userId,
              latitude: newLat,
              longitude: newLng,
              heading: loc.coords.heading || 0,
              speed: loc.coords.speed || 0,
              destination_lat: journey?.destination_lat ? Number(journey.destination_lat) : undefined,
              destination_lng: journey?.destination_lng ? Number(journey.destination_lng) : undefined,
              destination_address: journey?.address || undefined,
              status: 'online',
            }).catch(() => {});

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
        }
      );
      setLocationSubscription(sub);
    } catch (e) {
      console.warn('[EmployeeTracking] Foreground watcher error:', e);
    }
  };

  const stopForegroundWatcher = () => {
    if (locationSubscription) {
      try { locationSubscription.remove(); } catch (e) {}
      setLocationSubscription(null);
    }
  };

  // ──────────────────────────────────────────────
  // FEATURE 2: ONE-TAP CONNECT / DISCONNECT
  // ──────────────────────────────────────────────
  const handleToggleConnect = async () => {
    if (isConnected) {
      // DISCONNECT / END DUTY
      Alert.alert(
        "End Duty & Disconnect?",
        "Are you sure you want to stop broadcasting your live location to Admin?",
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Disconnect",
            style: "destructive",
            onPress: async () => {
              setIsProcessing(true);
              try {
                const userId = user.id || user.email || 'employee';

                // 1. Stop background tracking
                await BackgroundLocationManager.stopTracking();
                stopForegroundWatcher();
                setIsConnected(false);

                // 2. Mark offline in Supabase and Socket.IO
                await TrackingDataService.updateLiveLocation({
                  userId,
                  latitude: currentLocation?.latitude || 0,
                  longitude: currentLocation?.longitude || 0,
                  status: 'offline',
                });

                SocketService.updateLocation({
                  userId,
                  email: user.email || undefined,
                  name: user.name || undefined,
                  latitude: currentLocation?.latitude || 0,
                  longitude: currentLocation?.longitude || 0,
                  status: 'offline',
                });

                Alert.alert("Disconnected", "You are now off-duty. Location broadcasting is paused.");
              } catch (e: any) {
                Alert.alert("Error", e.message || "Failed to disconnect");
              } finally {
                setIsProcessing(false);
              }
            }
          }
        ]
      );
    } else {
      // CONNECT / START DUTY
      setIsProcessing(true);
      try {
        const permsGranted = await ensureAllLocationPermissions(true);
        if (!permsGranted) {
          setIsProcessing(false);
          return;
        }

        const userId = user.id || user.email || 'employee';
        await AsyncStorage.setItem('is_duty_connected', 'true');
        setIsConnected(true);

        const initialLoc = await getDeviceLocation();
        const lat = initialLoc?.latitude || currentLocation?.latitude || 18.5204;
        const lng = initialLoc?.longitude || currentLocation?.longitude || 73.8567;

        if (initialLoc) {
          setCurrentLocation(initialLoc);
          fetchAddress(lat, lng);
          mapRef.current?.animateToRegion({
            latitude: lat,
            longitude: lng,
            latitudeDelta: 0.018,
            longitudeDelta: 0.018,
          }, 800);
        }

        // 1. Start continuous Background Foreground Service (runs even when screen is locked or app closed)
        const journey = activeJourneyRef.current;
        await BackgroundLocationManager.startTracking(user, journey);

        // 2. Start Foreground Watcher
        startForegroundWatcher();

        // 3. Broadcast online status to Admin via Supabase & Socket.IO (non-blocking)
        TrackingDataService.updateLiveLocation({
          userId,
          name: user.name || undefined,
          email: user.email || undefined,
          latitude: lat,
          longitude: lng,
          destination_lat: journey?.destination_lat ? Number(journey.destination_lat) : undefined,
          destination_lng: journey?.destination_lng ? Number(journey.destination_lng) : undefined,
          destination_address: journey?.address || undefined,
          status: 'online',
        }).catch(() => {});

        SocketService.updateLocation({
          userId,
          email: user.email || undefined,
          name: user.name || undefined,
          latitude: lat,
          longitude: lng,
          destination_lat: journey?.destination_lat ? Number(journey.destination_lat) : undefined,
          destination_lng: journey?.destination_lng ? Number(journey.destination_lng) : undefined,
          destination_address: journey?.address || undefined,
          status: 'online',
        });

        Alert.alert(
          "🟢 Connected & On Duty!",
          "Your live location is now streaming to Admin. Tracking will continue even when you switch apps or lock your phone."
        );
      } catch (e: any) {
        Alert.alert("Error", e.message || "Failed to connect to duty");
        setIsConnected(false);
      } finally {
        setIsProcessing(false);
      }
    }
  };

  // ──────────────────────────────────────────────
  // FEATURE 1: OPTIONAL DESTINATION (CLEAR / REMOVE)
  // ──────────────────────────────────────────────
  const handleClearDestination = async () => {
    try {
      await AsyncStorage.removeItem('active_journey');
      await AsyncStorage.removeItem('active_journey_id');
      activeJourneyRef.current = null;
      setActiveJourney(null);
      setRouteCoordinates([]);
      setDistance(0);
      setDuration(0);

      // If connected, inform Admin that destination was removed (duty remains online!)
      if (isConnected) {
        const userId = user.id || user.email || 'employee';
        await TrackingDataService.updateLiveLocation({
          userId,
          latitude: currentLocation?.latitude || 0,
          longitude: currentLocation?.longitude || 0,
          destination_lat: undefined,
          destination_lng: undefined,
          destination_address: undefined,
          status: 'online',
        });

        SocketService.updateLocation({
          userId,
          email: user.email || undefined,
          name: user.name || undefined,
          latitude: currentLocation?.latitude || 0,
          longitude: currentLocation?.longitude || 0,
          destination_lat: undefined,
          destination_lng: undefined,
          destination_address: undefined,
          status: 'online',
        });
      }

      Alert.alert("Destination Cleared", "You are now in free-roaming duty mode.");
    } catch (e) {
      console.warn('Error clearing destination:', e);
    }
  };

  const initialRegion = {
    latitude: currentLocation?.latitude || activeJourney?.destination_lat || 18.5204,
    longitude: currentLocation?.longitude || activeJourney?.destination_lng || 73.8567,
    latitudeDelta: 0.03,
    longitudeDelta: 0.03,
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#0F4C3A' }}>
      {/* Top Header */}
      <View style={styles.header}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <View style={[styles.avatarBadge, isConnected ? styles.avatarBadgeOnline : styles.avatarBadgeOffline]}>
            <Text style={{ color: 'white', fontWeight: 'bold', fontSize: 16 }}>{user.name?.charAt(0) || 'E'}</Text>
          </View>
          <View style={{ marginLeft: 12 }}>
            <Text style={{ color: 'white', fontWeight: 'bold', fontSize: 17, lineHeight: 22 }}>STYRKA Field</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 2 }}>
              <View style={[styles.statusDot, { backgroundColor: isConnected ? '#10B981' : '#9CA3AF' }]} />
              <Text style={{ color: isConnected ? '#10B981' : '#D1D5DB', fontSize: 11, fontWeight: '800', letterSpacing: 0.8 }}>
                {isConnected ? 'LIVE DUTY CONNECTED' : 'OFF DUTY / DISCONNECTED'}
              </Text>
            </View>
          </View>
        </View>

        <TouchableOpacity onPress={logout} style={styles.exitButton}>
          <Feather name="log-out" size={15} color="#F87171" style={{ marginRight: 4 }} />
          <Text style={{ color: '#FCA5A5', fontSize: 12, fontWeight: '700' }}>Exit</Text>
        </TouchableOpacity>
      </View>

      {/* Main Map Container */}
      <View style={styles.mapContainer}>
        <MapView
          ref={mapRef}
          style={styles.map}
          initialRegion={initialRegion}
        >
          {/* Current Employee Marker */}
          {currentLocation && (
            <Marker
              coordinate={{
                latitude: Number(currentLocation.latitude),
                longitude: Number(currentLocation.longitude),
              }}
              title={user.name || "My Current Location"}
              pinColor="#2563EB"
            />
          )}

          {/* Optional Destination Marker */}
          {activeJourney?.destination_lat && activeJourney?.destination_lng && (
            <Marker
              coordinate={{
                latitude: Number(activeJourney.destination_lat),
                longitude: Number(activeJourney.destination_lng),
              }}
              title="Destination"
              description={activeJourney.address}
              pinColor="#EF4444"
            />
          )}

          {/* Optional Polyline Route */}
          {routeCoordinates.length >= 2 && (
            <Polyline
              coordinates={routeCoordinates}
              strokeColor="#2563EB"
              strokeWidth={5}
            />
          )}
        </MapView>

        {/* Floating GPS locating badge */}
        {(!currentLocation || isLoading) && (
          <View style={styles.gpsFloatingBadge}>
            <ActivityIndicator size="small" color="#10B981" />
            <Text style={{ marginLeft: 8, color: '#1F2937', fontSize: 12, fontWeight: '700' }}>
              Acquiring GPS fix...
            </Text>
          </View>
        )}

        {/* Floating Recenter Map Button */}
        {currentLocation && (
          <TouchableOpacity
            onPress={() => {
              mapRef.current?.animateToRegion({
                latitude: Number(currentLocation.latitude),
                longitude: Number(currentLocation.longitude),
                latitudeDelta: 0.02,
                longitudeDelta: 0.02,
              }, 600);
            }}
            style={styles.recenterFab}
          >
            <Feather name="crosshair" size={20} color="#0F4C3A" />
          </TouchableOpacity>
        )}

        {/* Bottom Floating Control Panel */}
        <View style={styles.bottomCard}>
          {/* Section 1: Connection & Duty Toggle */}
          <View style={{ marginBottom: 14 }}>
            <TouchableOpacity
              onPress={handleToggleConnect}
              disabled={isProcessing}
              style={[
                styles.connectActionBtn,
                isConnected ? styles.disconnectBtnStyle : styles.connectBtnStyle,
              ]}
            >
              {isProcessing ? (
                <ActivityIndicator color="white" />
              ) : isConnected ? (
                <>
                  <Feather name="power" size={18} color="white" />
                  <Text style={styles.btnText}>DISCONNECT / END DUTY</Text>
                </>
              ) : (
                <>
                  <Feather name="zap" size={19} color="white" />
                  <Text style={styles.btnText}>CONNECT / GO ONLINE</Text>
                </>
              )}
            </TouchableOpacity>
            
            <Text style={styles.dutyHelpText}>
              {isConnected 
                ? "🟢 Live location is streaming continuously to Admin in background."
                : "Tap Connect to start streaming your location to Admin (runs with screen off)."}
            </Text>
          </View>

          {/* Section 2: Destination Card (Completely Optional) */}
          <View style={styles.destinationCard}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                <Feather name="map-pin" size={15} color={activeJourney ? "#EF4444" : "#6B7280"} style={{ marginRight: 6 }} />
                <Text style={{ fontSize: 11, fontWeight: '800', color: '#6B7280', letterSpacing: 0.5, textTransform: 'uppercase' }}>
                  {activeJourney ? "Destination Target" : "Destination (Optional)"}
                </Text>
              </View>
              {activeJourney && distance > 0 && (
                <Text style={{ fontSize: 12, fontWeight: '800', color: '#047857' }}>
                  {distance.toFixed(1)} km ({Math.ceil(duration)} min)
                </Text>
              )}
            </View>

            {activeJourney ? (
              <View>
                <Text style={{ color: '#111827', fontWeight: '700', fontSize: 13, marginBottom: 10 }} numberOfLines={2}>
                  {activeJourney.address || 'Selected Destination'}
                </Text>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <TouchableOpacity
                    onPress={() => navigation.navigate('Select Destination')}
                    style={styles.destSecondaryBtn}
                  >
                    <Feather name="edit-2" size={13} color="#0F4C3A" style={{ marginRight: 4 }} />
                    <Text style={styles.destSecondaryBtnText}>Change</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={handleClearDestination}
                    style={[styles.destSecondaryBtn, { borderColor: '#FCA5A5', backgroundColor: '#FEF2F2' }]}
                  >
                    <Feather name="x" size={14} color="#EF4444" style={{ marginRight: 4 }} />
                    <Text style={[styles.destSecondaryBtnText, { color: '#EF4444' }]}>Clear Destination</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <Text style={{ color: '#6B7280', fontSize: 12, flex: 1 }}>
                  Free roaming mode (No destination set)
                </Text>
                <TouchableOpacity
                  onPress={() => navigation.navigate('Select Destination')}
                  style={styles.setDestBtn}
                >
                  <Feather name="plus" size={14} color="#0F4C3A" style={{ marginRight: 4 }} />
                  <Text style={{ color: '#0F4C3A', fontWeight: '700', fontSize: 12 }}>Set Destination</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>

          {/* Current Address Pill */}
          <View style={styles.addressPill}>
            <Feather name="compass" size={13} color="#2563EB" style={{ marginRight: 6 }} />
            <Text style={{ color: '#374151', fontSize: 11, fontWeight: '600', flex: 1 }} numberOfLines={1}>
              {address}
            </Text>
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  header: {
    backgroundColor: 'rgba(15, 76, 58, 0.98)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.12)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    zIndex: 10,
    elevation: 6,
  },
  avatarBadge: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
  },
  avatarBadgeOnline: {
    backgroundColor: 'rgba(16, 185, 129, 0.3)',
    borderColor: '#10B981',
  },
  avatarBadgeOffline: {
    backgroundColor: 'rgba(156, 163, 175, 0.3)',
    borderColor: '#9CA3AF',
  },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    marginRight: 5,
  },
  exitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(239, 68, 68, 0.16)', 
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.38)',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  mapContainer: {
    flex: 1,
    backgroundColor: '#E5E7EB',
  },
  map: {
    ...StyleSheet.absoluteFillObject,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  gpsFloatingBadge: {
    position: 'absolute',
    top: 16,
    left: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 4,
  },
  recenterFab: {
    position: 'absolute',
    top: 16,
    right: 16,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 5,
    elevation: 6,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  bottomCard: {
    position: 'absolute',
    bottom: 20,
    left: 14,
    right: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.98)',
    borderRadius: 22,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 14,
    elevation: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  connectActionBtn: {
    paddingVertical: 14,
    borderRadius: 14,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 4,
  },
  connectBtnStyle: {
    backgroundColor: '#0F4C3A',
    shadowColor: '#0F4C3A',
  },
  disconnectBtnStyle: {
    backgroundColor: '#EF4444',
    shadowColor: '#EF4444',
  },
  btnText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 15,
    letterSpacing: 0.5,
    marginLeft: 8,
  },
  dutyHelpText: {
    textAlign: 'center',
    fontSize: 11,
    color: '#6B7280',
    marginTop: 6,
  },
  destinationCard: {
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 14,
    padding: 12,
    marginBottom: 10,
  },
  destSecondaryBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
    borderRadius: 8,
  },
  destSecondaryBtnText: {
    color: '#065F46',
    fontWeight: '700',
    fontSize: 12,
  },
  setDestBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  addressPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#DBEAFE',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
});

export default EmployeeTrackingScreen;
