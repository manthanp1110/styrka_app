import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, StyleSheet, ScrollView, TextInput, Alert, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather, MaterialIcons } from '@expo/vector-icons';
import { useNavigation, NavigationProp } from '@react-navigation/native';
import { useAppState } from '../store/useAppState';
import { supabase } from '../config/supabase';
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
        
        {/* Pulsing Blue Dot Rider Pointer (Uber / Google Maps Style) */}
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

  useEffect(() => {
    if (selectedEmployeeId && activeJourneys[selectedEmployeeId]) {
      const journey = activeJourneys[selectedEmployeeId];
      if (journey.destination_lat && journey.destination_lng) {
        const fetchRoute = async () => {
          try {
            const originLat = journey.start_lat;
            const originLng = journey.start_lng;
            
            const res = await MapplsApi.direction({
              origin: `${originLng},${originLat}`,
              destination: `${journey.destination_lng},${journey.destination_lat}`,
              profile: 'driving',
              overview: 'full',
              geometries: 'polyline'
            });
            
            if (res && res.routes && res.routes.length > 0) {
              const decodedCoords = decodePolyline(res.routes[0].geometry);
              setCurrentRouteCoords(decodedCoords);
            }
          } catch (e) {
            console.log('Mappls routing error', e);
          }
        };
        fetchRoute();
      }
    } else {
      setCurrentRouteCoords([]);
    }
  }, [selectedEmployeeId]);

  const fetchTrackingData = async () => {
    setIsRefreshing(true);
    try {
      // 1. Fetch all employees
      const { data: usersData, error: usersError } = await supabase
        .from('users')
        .select('id, name, email, first_name')
        .eq('role', 'employee');
      
      if (usersError) throw usersError;
      
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);

      // 2. Fetch today's attendance for all employees
      const { data: attendanceData } = await supabase
        .from('daily_attendance')
        .select('*')
        .gte('created_at', todayStart.toISOString())
        .order('created_at', { ascending: false });

      const attendanceMap: any = {};
      (attendanceData || []).forEach(record => {
        if (!attendanceMap[record.user_id]) attendanceMap[record.user_id] = record;
      });

      // 3. Fetch active journeys
      const { data: journeysData } = await supabase
        .from('journeys')
        .select('*')
        .eq('status', 'active');
        
      const journeyMap: any = {};
      
      await Promise.all((journeysData || []).map(async (j) => {
        // fetch their location history
        // Allow up to 15 mins of clock skew from the device
        const journeyStart = new Date(j.created_at);
        journeyStart.setMinutes(journeyStart.getMinutes() - 15);

        const { data: pings } = await supabase
          .from('employee_locations')
          .select('*')
          .eq('user_id', j.user_id)
          .gte('timestamp', journeyStart.toISOString())
          .order('timestamp', { ascending: true });
          
        const startNode = {
          latitude: j.start_lat,
          longitude: j.start_lng,
          timestamp: j.created_at,
          status: 'Started'
        };
        
        const history = [startNode, ...(pings || [])];
        const latestPing = pings && pings.length > 0 ? pings[pings.length - 1] : startNode;
        
        journeyMap[j.user_id] = {
           ...j,
           locationHistory: history,
           latestLocation: latestPing
        };
      }));

      setEmployees(usersData || []);
      setDailyAttendance(attendanceMap);
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
    
    let isMounted = true;

    // Subscriptions array to manage cleanup
    const subscriptions: any[] = [];

    // 1. Subscribe to Live Journeys
    const journeysSubscription = supabase
      .channel('live-journeys')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'journeys' }, () => {
        fetchTrackingData();
      })
      .subscribe();
      
    subscriptions.push(journeysSubscription);

    // 2. Subscribe to Employee Live Locations
    const locationsSubscription = supabase
      .channel('live-locations')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'employee_live_locations' }, (payload: any) => {
        if (!isMounted) return;
        
        const newLocation = payload.new;
        if (!newLocation || !newLocation.employee_id) return;
        
        setActiveJourneys(current => {
          const empId = newLocation.employee_id;
          if (!current[empId]) return current;
          
          const journey = current[empId];
          
          const normalizedLoc = {
            user_id: empId,
            latitude: Number(newLocation.latitude || newLocation.snapped_latitude || newLocation.raw_latitude),
            longitude: Number(newLocation.longitude || newLocation.snapped_longitude || newLocation.raw_longitude),
            status: newLocation.status || 'online',
            timestamp: newLocation.updated_at,
            accuracy: newLocation.accuracy,
            speed: newLocation.speed,
            heading: newLocation.heading,
          };

          return {
            ...current,
            [empId]: {
              ...journey,
              locationHistory: [...(journey.locationHistory || []), normalizedLoc],
              latestLocation: normalizedLoc
            }
          };
        });
      })
      .subscribe();
      
    subscriptions.push(locationsSubscription);

    return () => {
      isMounted = false;
      subscriptions.forEach(sub => supabase.removeChannel(sub));
    };
  }, []);

  const getEmployeeStatus = (empId: string) => {
    const attendance = dailyAttendance[empId];
    if (!attendance) return { label: 'Not Punched In', color: '#9CA3AF', canTrack: false };
    if (attendance.punch_out_time) return { label: 'Punched Out', color: '#6B7280', canTrack: false };
    
    const journey = activeJourneys[empId];
    if (journey) return { label: 'Tracking Active', color: '#10B981', canTrack: true };
    
    return { label: 'Punched In (No Journey)', color: '#F59E0B', canTrack: false };
  };

  const filteredEmployees = employees.filter(emp => 
    (emp.name || emp.first_name || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleEmployeePress = (empId: string) => {
    const status = getEmployeeStatus(empId);
    if (status.canTrack) {
      setSelectedEmployeeId(empId);
    } else {
      Alert.alert("Location Not Available", `This employee is currently ${status.label}. Live tracking is only available during active journeys.`);
    }
  };

  const selectedJourney = selectedEmployeeId ? activeJourneys[selectedEmployeeId] : null;
  const selectedEmp = selectedEmployeeId ? employees.find(e => e.id === selectedEmployeeId) : null;

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

              {/* Destination Route Polyline */}
              {selectedJourney.start_lat != null && selectedJourney.destination_lat != null && (
                <Polyline
                  coordinates={
                    currentRouteCoords.length > 0
                      ? currentRouteCoords
                      : [
                          { latitude: Number(selectedJourney.start_lat), longitude: Number(selectedJourney.start_lng) },
                          { latitude: Number(selectedJourney.latestLocation?.latitude || selectedJourney.start_lat), longitude: Number(selectedJourney.latestLocation?.longitude || selectedJourney.start_lng) },
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
                    {selectedEmp?.name || 'Rider'} Position
                  </Text>
                  <Text style={{ color: '#3B82F6', fontSize: 12, marginTop: 2, fontWeight: '700' }}>
                    📍 {selectedJourney?.latestLocation?.latitude ? `${Number(selectedJourney.latestLocation.latitude).toFixed(4)}°N, ${Number(selectedJourney.latestLocation.longitude).toFixed(4)}°E` : 'Locating rider...'}
                  </Text>
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
