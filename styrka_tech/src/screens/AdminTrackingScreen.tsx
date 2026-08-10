import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, StyleSheet, ScrollView, TextInput, Alert, Image } from 'react-native';

import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather, MaterialIcons } from '@expo/vector-icons';

import { useNavigation, NavigationProp } from '@react-navigation/native';

import { useAppState } from '../store/useAppState';

import { TrackingDataService } from '../services/TrackingDataService';
import SocketService from '../services/SocketService';

import { MapView, Marker, Callout, Polyline } from '../components/NativeMap';

import { decodePolyline, getDistanceFromLatLonInKm } from '../utils/mapsUtils';
import { useSmoothLocation } from '../hooks/useSmoothLocation';
import MapplsApi from '../utils/mapplsApi';


const AnimatedVehicleMarker = ({ latestLocation, selectedEmp }: any) => {
  const empName = selectedEmp?.name || selectedEmp?.first_name || 'Employee';
  const isOffline = latestLocation.status === 'offline';
  
  const animatedLoc = useSmoothLocation(
    Number(latestLocation.latitude),
    Number(latestLocation.longitude),
    Number(latestLocation.heading || 0),
    2000
  );

  return (
    <Marker
      coordinate={{
        latitude: animatedLoc.latitude,
        longitude: animatedLoc.longitude,
      }}
      anchor={{ x: 0.5, y: 0.5 }}
      style={{ zIndex: 2 }}
    >
      <View style={{ alignItems: 'center' }}>
        {/* Rider Name Tag */}
        <View style={{ backgroundColor: '#0F4C3A', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10, marginBottom: 3, flexDirection: 'row', alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25, elevation: 4 }}>
          <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: isOffline ? '#9CA3AF' : '#10B981', marginRight: 5 }} />
          <Text style={{ color: 'white', fontWeight: 'bold', fontSize: 11 }}>{empName}</Text>
        </View>
        
        {/* Pulsing Blue Dot Rider Pointer */}
        <View style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: 'rgba(59, 130, 246, 0.25)', alignItems: 'center', justifyContent: 'center' }}>
          <View style={{ width: 20, height: 20, borderRadius: 10, backgroundColor: '#2563EB', borderWidth: 3, borderColor: 'white', alignItems: 'center', justifyContent: 'center', shadowColor: '#1D4ED8', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.4, shadowRadius: 3, elevation: 6 }}>
            <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: 'white' }} />
          </View>
        </View>
      </View>
    </Marker>
  );
};

const AdminTrackingScreen = () => {
  const { user } = useAppState();
  const navigation = useNavigation<NavigationProp<any>>();
  const mapRef = useRef<any>(null);
  
  const [employees, setEmployees] = useState<any[]>([]);
  const [dailyAttendance, setDailyAttendance] = useState<Record<string, any>>({});
  const [activeJourneys, setActiveJourneys] = useState<Record<string, any>>({});
  
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [followMode, setFollowMode] = useState(true);
  const [showHistory, setShowHistory] = useState(false);
  const [mapRegion, setMapRegion] = useState<any>(null);
  
  // selectedEmployeeId === null -> show List
  // selectedEmployeeId !== null -> show Map for this employee
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string | null>(null);
  const [currentRouteCoords, setCurrentRouteCoords] = useState<any[]>([]);
  const [routeDistance, setRouteDistance] = useState<number | null>(null);
  const [routeDuration, setRouteDuration] = useState<number | null>(null);
  const lastRouteFetchRef = useRef<number>(0);
  const routeFetchingRef = useRef<boolean>(false);

  useEffect(() => {
    if (!selectedEmployeeId && employees.length > 0) {
      // Auto-select first employee so Admin opens directly to live map & polyline
      setSelectedEmployeeId(employees[0].id);
    }
  }, [employees]);

  // Clear route when switching employees
  useEffect(() => {
    setCurrentRouteCoords([]);
    setRouteDistance(null);
    setRouteDuration(null);
    lastRouteFetchRef.current = 0;
  }, [selectedEmployeeId]);

  useEffect(() => {
    if (selectedEmployeeId && activeJourneys[selectedEmployeeId]) {
      const journey = activeJourneys[selectedEmployeeId];
      if (journey.destination_lat != null && journey.destination_lng != null) {
        const originLat = journey.latestLocation?.latitude != null
          ? Number(journey.latestLocation.latitude)
          : Number(journey.start_lat);
        const originLng = journey.latestLocation?.longitude != null
          ? Number(journey.latestLocation.longitude)
          : Number(journey.start_lng);
        const destLat = Number(journey.destination_lat);
        const destLng = Number(journey.destination_lng);

        if (!originLat || !originLng || !destLat || !destLng) return;

        // Throttle route API calls to every 10 seconds
        const now = Date.now();
        if (now - lastRouteFetchRef.current < 10000 && currentRouteCoords.length > 0) return;
        if (routeFetchingRef.current) return;

        routeFetchingRef.current = true;
        lastRouteFetchRef.current = now;

        (async () => {
          try {
            const res = await MapplsApi.direction({
              origin: `${originLng},${originLat}`,
              destination: `${destLng},${destLat}`,
              profile: 'driving',
              overview: 'full',
              geometries: 'polyline'
            });

            if (res?.routes?.length > 0 && res.routes[0].geometry) {
              const decodedCoords = decodePolyline(res.routes[0].geometry);
              setCurrentRouteCoords(decodedCoords);
              setRouteDistance(res.routes[0].distance ? res.routes[0].distance / 1000 : null);
              setRouteDuration(res.routes[0].duration ? res.routes[0].duration / 60 : null);
            } else {
              // Fallback: straight line
              setCurrentRouteCoords([
                { latitude: originLat, longitude: originLng },
                { latitude: destLat, longitude: destLng },
              ]);
              // Compute straight-line distance
              setRouteDistance(getDistanceFromLatLonInKm(originLat, originLng, destLat, destLng));
              setRouteDuration(null);
            }
          } catch (e) {
            console.log('Mappls routing error', e);
            // On error, draw straight line so polyline is always visible
            setCurrentRouteCoords([
              { latitude: originLat, longitude: originLng },
              { latitude: destLat, longitude: destLng },
            ]);
          } finally {
            routeFetchingRef.current = false;
          }
        })();
      }
    } else {
      setCurrentRouteCoords([]);
      setRouteDistance(null);
      setRouteDuration(null);
    }
  }, [
    selectedEmployeeId,
    selectedEmployeeId ? activeJourneys[selectedEmployeeId]?.latestLocation?.latitude : null,
    selectedEmployeeId ? activeJourneys[selectedEmployeeId]?.latestLocation?.longitude : null,
    selectedEmployeeId ? activeJourneys[selectedEmployeeId]?.destination_lat : null,
    selectedEmployeeId ? activeJourneys[selectedEmployeeId]?.destination_lng : null,
  ]);

  const fetchTrackingData = async () => {
    setIsRefreshing(true);
    try {
      const usersData = await TrackingDataService.getEmployees();
      const allLocations = await TrackingDataService.getAllLiveLocations();
      const allDestinations = await TrackingDataService.getAllDestinations();

  // Helper: Resolve journey using emp.id -> emp.email -> live_locations.user_id -> null
  const resolveEmployeeJourney = (emp: any, journeysMap: Record<string, any>) => {
    if (!emp) return null;
    // 1. Check emp.id
    if (emp.id && journeysMap[emp.id]) {
      return journeysMap[emp.id];
    }
    // 2. Check emp.email
    if (emp.email && journeysMap[emp.email]) {
      return journeysMap[emp.email];
    }
    // 3. Search values for user_id matching emp.id or emp.email
    const match = Object.values(journeysMap).find((j: any) => {
      const locUserId = j.latestLocation?.user_id || j.user_id;
      if (!locUserId) return false;
      return (
        locUserId === emp.id ||
        (emp.email && locUserId === emp.email) ||
        (emp.id && String(locUserId).toLowerCase() === String(emp.id).toLowerCase()) ||
        (emp.email && String(locUserId).toLowerCase() === String(emp.email).toLowerCase())
      );
    });
    return match || null;
  };

  const fetchTrackingData = async () => {
    try {
      const usersData = await TrackingDataService.getEmployees();
      const allLocations = await TrackingDataService.getAllLiveLocations();
      const allDestinations = await TrackingDataService.getAllDestinations();

      const journeyMap: any = {};
      for (const emp of usersData) {
        const loc = allLocations[emp.id]
          || (emp.email ? allLocations[emp.email] : null)
          || Object.values(allLocations).find((l: any) => 
               l.user_id === emp.id || 
               (emp.email && l.user_id === emp.email) ||
               (l.user_id && (
                 l.user_id.toLowerCase() === (emp.id || '').toLowerCase() ||
                 l.user_id.toLowerCase() === (emp.email || '').toLowerCase() ||
                 (emp.name && l.user_id.toLowerCase().includes(emp.name.toLowerCase()))
               ))
             );
        const dest = allDestinations.find((d) => (d.employee_id === emp.id || (emp.email && d.employee_id === emp.email)) && d.status !== 'completed');

        // Prevent older database poll from overwriting newer live Socket.IO pings
        const existingJourney = activeJourneys[emp.id] || (emp.email ? activeJourneys[emp.email] : null);
        const existingTime = existingJourney?.latestLocation?.timestamp
          ? new Date(existingJourney.latestLocation.timestamp).getTime()
          : 0;
        const fetchedTime = loc?.timestamp ? new Date(loc.timestamp).getTime() : 0;

        if (existingTime > fetchedTime && existingJourney?.latestLocation) {
          journeyMap[emp.id] = existingJourney;
          if (emp.email) journeyMap[emp.email] = existingJourney;
          if (loc?.user_id) journeyMap[loc.user_id] = existingJourney;
          continue;
        }

        if (loc || dest) {
          const latestPing = loc ? {
            user_id: loc.user_id || emp.id,
            latitude: Number(loc.latitude),
            longitude: Number(loc.longitude),
            heading: Number(loc.heading || 0),
            speed: Number(loc.speed || 0),
            status: loc.status || 'online',
            timestamp: loc.timestamp || new Date().toISOString(),
          } : null;

          // Destination priority: admin-assigned dest > live_locations dest (custom journey) > null
          const destLat = dest ? Number(dest.latitude)
            : (loc?.destination_lat != null ? Number(loc.destination_lat) : null);
          const destLng = dest ? Number(dest.longitude)
            : (loc?.destination_lng != null ? Number(loc.destination_lng) : null);
          const destAddress = dest?.address
            || (loc as any)?.destination_address
            || 'Custom destination';

          const journeyObj = {
            id: `j_${emp.id}`,
            user_id: emp.id,
            start_lat: latestPing ? latestPing.latitude : (destLat || 28.6139),
            start_lng: latestPing ? latestPing.longitude : (destLng || 77.2090),
            destination_lat: destLat,
            destination_lng: destLng,
            locationHistory: latestPing ? [latestPing] : [],
            latestLocation: latestPing,
            address: destAddress,
          };

          journeyMap[emp.id] = journeyObj;
          if (emp.email) journeyMap[emp.email] = journeyObj;
          if (loc?.user_id) journeyMap[loc.user_id] = journeyObj;
        }
      }

      setEmployees(usersData || []);
      setActiveJourneys(journeyMap);
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchTrackingData();

    SocketService.connect(user.id || 'admin_1', 'admin');

    const handleLocationChange = (loc: any) => {
      const incomingId = loc?.employee_id || loc?.user_id;
      if (loc && incomingId) {
        // Resolve incoming employee_id to matched employee in state
        const matched = employees.find(
          (e) => e.id === incomingId || (e.email && e.email.toLowerCase() === String(incomingId).toLowerCase()) || (e.name && e.name.toLowerCase() === String(incomingId).toLowerCase())
        );
        const primaryEmpId = matched ? matched.id : incomingId;
        const empEmail = matched?.email;

        setActiveJourneys((prev) => {
          const currentJourney = prev[primaryEmpId] || (empEmail ? prev[empEmail] : null) || prev[incomingId];

          const incomingTimestamp = loc.timestamp || new Date().toISOString();
          const incomingTime = new Date(incomingTimestamp).getTime();
          const existingTime = currentJourney?.latestLocation?.timestamp
            ? new Date(currentJourney.latestLocation.timestamp).getTime()
            : 0;

          // Ignore out-of-order stale location broadcasts
          if (existingTime > 0 && incomingTime < existingTime) {
            console.warn(`[Socket.IO AUDIT] Discarded out-of-order ping for ${primaryEmpId}: incoming ${incomingTime} < existing ${existingTime}`);
            return prev;
          }

          const updatedPing = {
            user_id: primaryEmpId,
            latitude: Number(loc.latitude),
            longitude: Number(loc.longitude),
            heading: Number(loc.heading || 0),
            speed: Number(loc.speed || 0),
            status: loc.status || 'online',
            timestamp: incomingTimestamp,
          };

          // Pick up destination data from Socket.IO pings (for custom journeys)
          const incomingDestLat = loc.destination_lat != null ? Number(loc.destination_lat) : null;
          const incomingDestLng = loc.destination_lng != null ? Number(loc.destination_lng) : null;
          const incomingDestAddr = loc.destination_address || null;

          const updatedJourney = {
            ...(currentJourney || {
              id: `j_${primaryEmpId}`,
              user_id: primaryEmpId,
              start_lat: Number(loc.latitude),
              start_lng: Number(loc.longitude),
            }),
            ...(incomingDestLat != null ? { destination_lat: incomingDestLat } : {}),
            ...(incomingDestLng != null ? { destination_lng: incomingDestLng } : {}),
            ...(incomingDestAddr != null ? { address: incomingDestAddr } : {}),
            latestLocation: updatedPing,
            locationHistory: currentJourney?.locationHistory
              ? [...currentJourney.locationHistory, updatedPing]
              : [updatedPing],
          };

          const nextMap = {
            ...prev,
            [primaryEmpId]: updatedJourney,
          };
          if (empEmail) nextMap[empEmail] = updatedJourney;
          if (incomingId) nextMap[incomingId] = updatedJourney;
          return nextMap;
        });
      }
    };

    SocketService.on('employee_location_changed', handleLocationChange);
    SocketService.on('destination_assigned', fetchTrackingData);
    SocketService.on('journey_status_changed', fetchTrackingData);

    const interval = setInterval(() => {
      fetchTrackingData();
    }, 4000);

    return () => {
      clearInterval(interval);
      SocketService.off('employee_location_changed', handleLocationChange);
      SocketService.off('destination_assigned', fetchTrackingData);
      SocketService.off('journey_status_changed', fetchTrackingData);
    };
  }, []);

  const getEmployeeStatus = (empId: string) => {
    const emp = employees.find(e => e.id === empId || e.email === empId);
    const journey = emp ? resolveEmployeeJourney(emp, activeJourneys) : activeJourneys[empId];

    if (journey) {
      const isOffline = !journey.latestLocation
        || journey.latestLocation.status === 'offline'
        || (journey.latestLocation.timestamp && Date.now() - new Date(journey.latestLocation.timestamp).getTime() > 5 * 60 * 1000);

      if (isOffline) {
        return { label: 'Tracking Interrupted / Offline', color: '#9CA3AF', canTrack: false, isOffline: true };
      }
      if (journey.status === 'arrived') {
        return { label: 'Arrived at Destination', color: '#3B82F6', canTrack: true, isOffline: false };
      }
      if (journey.status === 'visiting') {
        return { label: 'Visit in Progress', color: '#8B5CF6', canTrack: true, isOffline: false };
      }
      return { label: 'Journey Started / On Route', color: '#10B981', canTrack: true, isOffline: false };
    }
    
    return { label: 'Assigned / Ready', color: '#F59E0B', canTrack: false, isOffline: true };
  };

  const filteredEmployees = employees.filter(emp => 
    (emp.name || emp.first_name || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleEmployeePress = (empId: string) => {
    setSelectedEmployeeId(empId);
  };

  const selectedEmp = selectedEmployeeId ? employees.find(e => e.id === selectedEmployeeId || e.email === selectedEmployeeId) : null;
  const selectedJourney = selectedEmp ? resolveEmployeeJourney(selectedEmp, activeJourneys) : (selectedEmployeeId ? activeJourneys[selectedEmployeeId] : null);

  if (selectedEmp) {
    console.log(`[ADMIN_MATCH] employee.id = ${selectedEmp.id}`);
    console.log(`[ADMIN_MATCH] employee.email = ${selectedEmp.email}`);
    console.log(`[ADMIN_MATCH] location.user_id = ${selectedJourney?.latestLocation?.user_id || selectedJourney?.user_id}`);
    console.log(`[ADMIN_MATCH] resolvedJourneyKey = ${selectedJourney ? 'MATCHED' : 'NULL'}`);
    console.log(`[ADMIN_MATCH] latestLocation =`, selectedJourney?.latestLocation);
  }

  const initialRegion = {
    latitude: 18.5204, // Default
    longitude: 73.8567,
    latitudeDelta: 0.05,
    longitudeDelta: 0.05,
  };

  if (selectedJourney && selectedJourney.latestLocation && selectedJourney.latestLocation.latitude != null) {
    initialRegion.latitude = Number(selectedJourney.latestLocation.latitude);
    initialRegion.longitude = Number(selectedJourney.latestLocation.longitude);
  }

  useEffect(() => {
    if (followMode && mapRef.current && selectedJourney?.latestLocation && mapRegion) {
      const lat = Number(selectedJourney.latestLocation.latitude);
      const lng = Number(selectedJourney.latestLocation.longitude);
      if (!isNaN(lat) && !isNaN(lng)) {
        // Calculate safe viewport margins (80% box from center)
        const margin = 0.8;
        const latMin = mapRegion.latitude - (mapRegion.latitudeDelta / 2) * margin;
        const latMax = mapRegion.latitude + (mapRegion.latitudeDelta / 2) * margin;
        const lngMin = mapRegion.longitude - (mapRegion.longitudeDelta / 2) * margin;
        const lngMax = mapRegion.longitude + (mapRegion.longitudeDelta / 2) * margin;

        if (lat < latMin || lat > latMax || lng < lngMin || lng > lngMax) {
          mapRef.current.animateToRegion({
            latitude: lat,
            longitude: lng,
            latitudeDelta: mapRegion.latitudeDelta,
            longitudeDelta: mapRegion.longitudeDelta,
          }, 1000);
        }
      }
    }
  }, [selectedJourney?.latestLocation?.latitude, selectedJourney?.latestLocation?.longitude, followMode, mapRegion]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#0F4C3A' }}>
      {/* Header */}
      <View className="bg-[#0F4C3A] flex-row items-center justify-between px-4 py-4 z-10 shadow-md">
        <View className="flex-row items-center">
          <TouchableOpacity onPress={() => selectedEmployeeId ? setSelectedEmployeeId(null) : navigation.goBack()} className="mr-3 p-1">
            <Feather name="arrow-left" size={24} color="white" />
          </TouchableOpacity>
          <View className="ml-2">
            <Text className="text-white font-bold text-lg leading-tight">
              {selectedEmployeeId ? 'EMPLOYEE MAP' : 'FLEET TRACKING'}
            </Text>
            <Text className="text-[#F59E0B] text-xs font-bold tracking-widest">
              {selectedEmployeeId ? `TRACKING ${(selectedEmp?.name || selectedEmp?.first_name || 'EMPLOYEE').toUpperCase()}` : 'ALL EMPLOYEES'}
            </Text>
          </View>
        </View>

        {!selectedEmployeeId && (
          <TouchableOpacity onPress={fetchTrackingData} className="w-10 h-10 rounded-xl bg-[#145C44] items-center justify-center border border-[#186D51]">
            {isRefreshing && !isLoading ? (
              <ActivityIndicator size="small" color="white" />
            ) : (
              <Feather name="refresh-cw" size={16} color="white" />
            )}
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.container}>
        
        {/* LIST VIEW */}
        {!selectedEmployeeId && (
          <View style={{ flex: 1, backgroundColor: '#F3F4F6' }}>
            <View style={styles.searchContainer}>
              <Feather name="search" size={20} color="#9CA3AF" />
              <TextInput
                style={styles.searchInput}
                placeholder="Search employee..."
                placeholderTextColor="#9CA3AF"
                value={searchQuery}
                onChangeText={setSearchQuery}
              />
              {searchQuery.length > 0 && (
                <TouchableOpacity onPress={() => setSearchQuery('')}>
                  <Feather name="x" size={20} color="#9CA3AF" />
                </TouchableOpacity>
              )}
            </View>

            {isLoading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#10B981" />
                <Text style={{ marginTop: 10, color: 'gray' }}>Loading Fleet Data...</Text>
              </View>
            ) : (
              <ScrollView contentContainerStyle={{ padding: 20, paddingTop: 10 }}>
                {filteredEmployees.map(emp => {
                  const status = getEmployeeStatus(emp.id);
                  return (
                    <TouchableOpacity 
                      key={emp.id} 
                      style={[styles.employeeListItem, status.canTrack && styles.activeItem]}
                      onPress={() => handleEmployeePress(emp.id)}
                    >
                      <View style={[styles.avatar, { backgroundColor: status.color }]}>
                        <Text style={styles.avatarText}>{emp.name?.charAt(0) || 'E'}</Text>
                      </View>
                      <View style={{ flex: 1, marginLeft: 15 }}>
                        <Text style={styles.listEmpName}>{emp.name || emp.first_name}</Text>
                        <Text style={[styles.listEmpStatus, { color: status.color }]}>{status.label}</Text>
                      </View>
                      <View>
                        {status.canTrack ? (
                          <Feather name="map-pin" size={20} color={status.color} />
                        ) : (
                          <Feather name="chevron-right" size={20} color="#D1D5DB" />
                        )}
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            )}
          </View>
        )}

        {/* MAP VIEW */}
        {selectedEmployeeId && selectedJourney && (
          <View style={{ flex: 1 }}>
            {/* Map Controls Floating Overlay */}
            <View style={{ position: 'absolute', top: 16, right: 16, zIndex: 10, flexDirection: 'row', gap: 10 }}>
              {/* Follow Mode Toggle */}
              <TouchableOpacity 
                onPress={() => setFollowMode(!followMode)}
                style={{ 
                  backgroundColor: followMode ? '#10B981' : '#FFF', 
                  paddingHorizontal: 12, 
                  paddingVertical: 10, 
                  borderRadius: 12, 
                  shadowColor: '#000', 
                  shadowOffset: { width: 0, height: 2 }, 
                  shadowOpacity: 0.1, 
                  shadowRadius: 4, 
                  elevation: 3,
                  flexDirection: 'row',
                  alignItems: 'center',
                  borderWidth: 1,
                  borderColor: followMode ? '#059669' : '#E5E7EB'
                }}
              >
                <Feather name="navigation" size={16} color={followMode ? '#FFF' : '#374151'} style={{ marginRight: 6 }} />
                <Text style={{ color: followMode ? '#FFF' : '#374151', fontWeight: 'bold', fontSize: 13 }}>
                  {followMode ? 'Follow ON' : 'Follow OFF'}
                </Text>
              </TouchableOpacity>

              {/* Show History Toggle */}
              <TouchableOpacity 
                onPress={() => setShowHistory(!showHistory)}
                style={{ 
                  backgroundColor: showHistory ? '#F59E0B' : '#FFF', 
                  paddingHorizontal: 12, 
                  paddingVertical: 10, 
                  borderRadius: 12, 
                  shadowColor: '#000', 
                  shadowOffset: { width: 0, height: 2 }, 
                  shadowOpacity: 0.1, 
                  shadowRadius: 4, 
                  elevation: 3,
                  flexDirection: 'row',
                  alignItems: 'center',
                  borderWidth: 1,
                  borderColor: showHistory ? '#D97706' : '#E5E7EB'
                }}
              >
                <Feather name="map" size={16} color={showHistory ? '#FFF' : '#374151'} style={{ marginRight: 6 }} />
                <Text style={{ color: showHistory ? '#FFF' : '#374151', fontWeight: 'bold', fontSize: 13 }}>
                  {showHistory ? 'Show History' : 'Live Map'}
                </Text>
              </TouchableOpacity>
            </View>

            <MapView 
              ref={mapRef}
              style={styles.map} 
              initialRegion={initialRegion}
              onRegionChangeComplete={setMapRegion}
              onPanDrag={() => setFollowMode(false)}
            >
              {selectedJourney.latestLocation && selectedJourney.latestLocation.latitude != null && (
                <AnimatedVehicleMarker
                  coordinate={{
                    latitude: Number(selectedJourney.latestLocation.latitude),
                    longitude: Number(selectedJourney.latestLocation.longitude)
                  }}
                  pinColor="#3B82F6"
                  title={selectedEmp?.name || selectedEmp?.first_name || 'Rider'}
                  latestLocation={selectedJourney.latestLocation}
                  startLocation={{ latitude: selectedJourney.start_lat, longitude: selectedJourney.start_lng }}
                  selectedEmp={selectedEmp}
                  styles={styles}
                />
              )}

              {selectedJourney.destination_lat != null && selectedJourney.destination_lng != null && (
                <Marker
                  coordinate={{ 
                    latitude: Number(selectedJourney.destination_lat), 
                    longitude: Number(selectedJourney.destination_lng) 
                  }}
                  pinColor="red"
                />
              )}

              {/* Destination Route Polyline — only draw when rider is live & online */}
              {selectedJourney.latestLocation && selectedJourney.latestLocation.status !== 'offline' && selectedJourney.destination_lat != null && (
                <Polyline
                  coordinates={
                    currentRouteCoords.length > 0
                      ? currentRouteCoords
                      : [
                          { latitude: Number(selectedJourney.latestLocation.latitude), longitude: Number(selectedJourney.latestLocation.longitude) },
                          { latitude: Number(selectedJourney.destination_lat), longitude: Number(selectedJourney.destination_lng) }
                        ]
                  }
                  strokeWidth={6}
                  strokeColor="#3B82F6"
                />
              )}
              
              {showHistory && selectedJourney.locationHistory && selectedJourney.locationHistory.length > 0 && (
                <Polyline 
                  coordinates={selectedJourney.locationHistory.map((loc: any) => ({
                    latitude: Number(loc.latitude),
                    longitude: Number(loc.longitude)
                  }))}
                  strokeColor="#F59E0B"
                  strokeWidth={5}
                />
              )}
            </MapView>

            <View style={styles.overlayFooter}>
              <View style={styles.footerInner}>
                {/* Rider Pointer Avatar */}
                <View style={[styles.avatar, { width: 44, height: 44, borderRadius: 22, backgroundColor: '#3B82F6', borderWidth: 2, borderColor: '#60A5FA' }]}>
                  <Feather name="navigation" size={20} color="white" />
                </View>
                
                {/* Rider Position Pointer Info */}
                <View style={{ flex: 1, paddingLeft: 12, justifyContent: 'center' }}>
                  <Text style={{ color: '#111827', fontWeight: 'bold', fontSize: 16 }}>
                    {selectedEmp?.name || 'Rider'}
                  </Text>
                  <Text style={{ color: '#3B82F6', fontSize: 12, marginTop: 2, fontWeight: '700' }}>
                    📍 {selectedJourney?.latestLocation?.latitude ? `${Number(selectedJourney.latestLocation.latitude).toFixed(4)}°N, ${Number(selectedJourney.latestLocation.longitude).toFixed(4)}°E` : 'Locating rider...'}
                  </Text>
                  {selectedJourney?.address && (
                    <Text style={{ color: '#6B7280', fontSize: 11, marginTop: 2 }} numberOfLines={1}>
                      🏁 Dest: {selectedJourney.address}
                    </Text>
                  )}
                </View>

                {/* Recenter Map Button */}
                <TouchableOpacity 
                  onPress={() => {
                    if (selectedJourney?.latestLocation && mapRef.current) {
                      mapRef.current.animateToRegion({
                        latitude: Number(selectedJourney.latestLocation.latitude),
                        longitude: Number(selectedJourney.latestLocation.longitude),
                        latitudeDelta: 0.02,
                        longitudeDelta: 0.02,
                      }, 1000);
                      setFollowMode(true);
                    }
                  }}
                  style={{ paddingHorizontal: 14, paddingVertical: 10, backgroundColor: '#EFF6FF', borderRadius: 12, borderWidth: 1, borderColor: '#BFDBFE', alignSelf: 'center', flexDirection: 'row', alignItems: 'center' }}
                >
                  <Feather name="crosshair" size={16} color="#2563EB" style={{ marginRight: 6 }} />
                  <Text style={{ color: '#2563EB', fontWeight: 'bold', fontSize: 13 }}>Recenter</Text>
                </TouchableOpacity>
              </View>

              {/* Route Stats Row */}
              {(routeDistance != null || routeDuration != null) && (
                <View style={{ flexDirection: 'row', marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#E5E7EB' }}>
                  {routeDistance != null && (
                    <View style={{ flex: 1, alignItems: 'center' }}>
                      <Text style={{ color: '#6B7280', fontSize: 11, fontWeight: '600' }}>DISTANCE</Text>
                      <Text style={{ color: '#111827', fontSize: 16, fontWeight: 'bold', marginTop: 2 }}>
                        {routeDistance.toFixed(1)} km
                      </Text>
                    </View>
                  )}
                  {routeDuration != null && (
                    <View style={{ flex: 1, alignItems: 'center' }}>
                      <Text style={{ color: '#6B7280', fontSize: 11, fontWeight: '600' }}>ETA</Text>
                      <Text style={{ color: '#111827', fontSize: 16, fontWeight: 'bold', marginTop: 2 }}>
                        {Math.round(routeDuration)} min
                      </Text>
                    </View>
                  )}
                  <View style={{ flex: 1, alignItems: 'center' }}>
                    <Text style={{ color: '#6B7280', fontSize: 11, fontWeight: '600' }}>STATUS</Text>
                    <Text style={{ color: selectedJourney?.latestLocation ? '#10B981' : '#F59E0B', fontSize: 16, fontWeight: 'bold', marginTop: 2 }}>
                      {selectedJourney?.latestLocation ? '● LIVE' : '○ Waiting'}
                    </Text>
                  </View>
                </View>
              )}
            </View>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F3F4F6',
  },
  searchContainer: {
    margin: 20,
    backgroundColor: 'white',
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 15,
    paddingVertical: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 5,
    elevation: 3,
  },
  searchInput: {
    flex: 1,
    marginLeft: 10,
    fontSize: 16,
    color: '#1F2937',
  },
  employeeListItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    padding: 16,
    borderRadius: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 2,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  activeItem: {
    borderColor: '#D1FAE5',
    backgroundColor: '#F0FDF4',
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 18,
  },
  listEmpName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#111827',
  },
  listEmpStatus: {
    fontSize: 13,
    marginTop: 2,
    fontWeight: '600',
  },
  map: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  calloutContainer: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 12,
    width: 200,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 3,
    borderColor: '#E5E7EB',
    borderWidth: 1,
  },
  calloutName: {
    fontWeight: 'bold',
    fontSize: 16,
    color: '#1F2937',
    marginBottom: 4,
  },
  calloutStatus: {
    fontSize: 12,
    color: '#059669',
    fontWeight: '600',
    marginBottom: 2,
  },
  calloutTime: {
    fontSize: 11,
    color: '#6B7280',
  },
  overlayFooter: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'white',
    paddingBottom: 35, 
    paddingTop: 20,
    paddingHorizontal: 20,
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 10,
  },
  footerInner: {
    flexDirection: 'row',
  },
  statBox: {
    alignItems: 'center',
    justifyContent: 'center',
  }
});

export default AdminTrackingScreen;
