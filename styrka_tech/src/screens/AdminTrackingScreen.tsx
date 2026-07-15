import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, StyleSheet, ScrollView, TextInput, Alert, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather, MaterialIcons } from '@expo/vector-icons';
import { useNavigation, NavigationProp } from '@react-navigation/native';
import { useAppState } from '../store/useAppState';
import { supabase } from '../config/supabase';
import { MapView, Marker, Callout, Polyline } from '../components/NativeMap';
import { AnimatedRegion, Marker as RNMarker } from 'react-native-maps';
import { decodePolyline, getDistanceFromLatLonInKm } from '../utils/mapsUtils';

const AnimatedVehicleMarker = ({ latestLocation, startLocation, selectedEmp, styles }: any) => {
  const [coordinate] = useState(
    new AnimatedRegion({
      latitude: Number(latestLocation.latitude),
      longitude: Number(latestLocation.longitude),
      latitudeDelta: 0,
      longitudeDelta: 0,
    })
  );

  useEffect(() => {
    coordinate.timing({
      latitude: Number(latestLocation.latitude),
      longitude: Number(latestLocation.longitude),
      duration: 1500,
      useNativeDriver: false,
    } as any).start();
  }, [latestLocation.latitude, latestLocation.longitude]);

  const empName = selectedEmp?.name || selectedEmp?.first_name || 'Employee';

  return (
    <RNMarker.Animated
      coordinate={coordinate as any}
      anchor={{ x: 0.5, y: 0.5 }}
      style={{ zIndex: 2 }}
    >
      <View style={{ alignItems: 'center', width: 200 }}>
        {/* Username Bubble */}
        <View style={{ backgroundColor: 'white', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 16, marginBottom: 4, borderWidth: 1, borderColor: '#1F473A', flexDirection: 'row', alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 3, elevation: 4, maxWidth: 160 }}>
          <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#10B981', marginRight: 6 }} />
          <Text style={{ color: '#1F2937', fontWeight: 'bold', fontSize: 13 }} numberOfLines={1} ellipsizeMode="tail">{empName}</Text>
        </View>
        
        {/* Motorcycle Image (No background) */}
        <Image 
          source={require('../../../assets/motorcycle.png')}
          style={{ width: 45, height: 45, resizeMode: 'contain', transform: [{ rotate: '180deg' }] }}
        />
      </View>
      <Callout tooltip>
        <View style={{ width: 220, backgroundColor: 'white', borderRadius: 16, overflow: 'hidden', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 5, elevation: 5 }}>
          {/* Top Section */}
          <View style={{ backgroundColor: '#215647', padding: 15, flexDirection: 'row', alignItems: 'center' }}>
            <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: '#477A6D', alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
              <Text style={{ color: 'white', fontSize: 18, fontWeight: 'bold' }}>{empName.charAt(0).toUpperCase()}</Text>
            </View>
            <View>
              <Text style={{ color: 'white', fontSize: 16, fontWeight: 'bold' }}>{empName}</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}>
                <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: '#10B981', marginRight: 6 }} />
                <Text style={{ color: '#A7F3D0', fontSize: 12 }}>Tracking active</Text>
              </View>
            </View>
          </View>
          
          {/* Bottom Section */}
          <View style={{ padding: 15 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Feather name="globe" size={14} color="#3B82F6" style={{ marginRight: 8 }} />
                <Text style={{ color: '#4B5563', fontSize: 14 }}>Lat</Text>
              </View>
              <Text style={{ color: '#1F2937', fontSize: 14, fontWeight: '500' }}>{Number(latestLocation.latitude).toFixed(5)}</Text>
            </View>
            
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Feather name="globe" size={14} color="#3B82F6" style={{ marginRight: 8 }} />
                <Text style={{ color: '#4B5563', fontSize: 14 }}>Lng</Text>
              </View>
              <Text style={{ color: '#1F2937', fontSize: 14, fontWeight: '500' }}>{Number(latestLocation.longitude).toFixed(5)}</Text>
            </View>
            
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Feather name="clock" size={14} color="#6B7280" style={{ marginRight: 8 }} />
                <Text style={{ color: '#4B5563', fontSize: 14 }}>Time</Text>
              </View>
              <Text style={{ color: '#1F2937', fontSize: 14, fontWeight: '500' }}>
                {new Date(latestLocation.timestamp).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' }).toLowerCase()}
              </Text>
            </View>
          </View>
        </View>
      </Callout>
    </RNMarker.Animated>
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
            const url = `http://router.project-osrm.org/route/v1/driving/${originLng},${originLat};${journey.destination_lng},${journey.destination_lat}?overview=full&geometries=polyline`;
            const res = await fetch(url);
            const data = await res.json();
            if (data.routes && data.routes.length > 0) {
              const decodedCoords = decodePolyline(data.routes[0].geometry);
              setCurrentRouteCoords(decodedCoords);
            }
          } catch (e) {
            console.log('OSRM routing error', e);
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
    
    const locationSubscription = supabase
      .channel('live-locations')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'employee_locations' }, (payload) => {
        const newLocation = payload.new;
        setActiveJourneys(current => {
          if (!current[newLocation.user_id]) return current;
          const journey = current[newLocation.user_id];
          return {
            ...current,
            [newLocation.user_id]: {
              ...journey,
              locationHistory: [...(journey.locationHistory || []), newLocation],
              latestLocation: newLocation
            }
          };
        });
      })
      .subscribe();

    const journeysSubscription = supabase
      .channel('live-journeys')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'journeys' }, () => {
        fetchTrackingData();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(locationSubscription);
      supabase.removeChannel(journeysSubscription);
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
            <MapView 
              ref={mapRef}
              style={styles.map} 
              initialRegion={initialRegion}
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

              {currentRouteCoords.length > 0 && (
                <Polyline
                  coordinates={currentRouteCoords}
                  strokeWidth={6}
                  strokeColor="#1D4ED8"
                />
              )}
              
              {selectedJourney.locationHistory && selectedJourney.locationHistory.length > 0 && (
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
                <View style={styles.statBox}>
                  <View style={[styles.avatar, { width: 50, height: 50, borderRadius: 25, backgroundColor: '#10B981' }]}>
                    <Text style={{ color: 'white', fontSize: 20, fontWeight: 'bold' }}>{selectedEmp?.name?.charAt(0)}</Text>
                  </View>
                </View>
                <View style={{ flex: 1, paddingLeft: 15, justifyContent: 'center' }}>
                  <Text style={{ color: '#1F2937', fontWeight: 'bold', fontSize: 18 }}>{selectedEmp?.name}</Text>
                  <Text style={{ color: '#059669', fontSize: 13, marginTop: 2, fontWeight: '600' }}>Active Live Tracking</Text>
                </View>
                
                <TouchableOpacity 
                  onPress={() => navigation.navigate('Chat', { employeeId: selectedEmp?.id, employeeName: selectedEmp?.name })}
                  style={{ padding: 15, backgroundColor: '#E0F2FE', borderRadius: 12, borderWidth: 1, borderColor: '#BAE6FD', alignSelf: 'center' }}
                >
                  <Feather name="message-circle" size={20} color="#0284C7" />
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
