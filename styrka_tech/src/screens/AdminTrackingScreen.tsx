import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, SafeAreaView, ActivityIndicator, StyleSheet, Image, ScrollView } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useAppState } from '../store/useAppState';
import { supabase } from '../config/supabase';
import { MapView, Marker, Callout } from '../components/NativeMap';

const AdminTrackingScreen = () => {
  const { logout, user } = useAppState();
  const navigation = useNavigation();
  const mapRef = useRef<any>(null);
  
  const [activeJourneys, setActiveJourneys] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const fetchActiveTracking = async () => {
    setIsRefreshing(true);
    try {
      const { data: journeys, error } = await supabase
        .from('journeys')
        .select(`
          *,
          users!inner (
            name,
            email
          )
        `)
        .eq('status', 'Active')
        .order('created_at', { ascending: false });

      if (error) throw error;

      const journeysWithLocation = await Promise.all(
        (journeys || []).map(async (j) => {
          const { data: latestPing } = await supabase
            .from('employee_locations')
            .select('*')
            .eq('user_id', j.user_id)
            .gte('timestamp', j.created_at)
            .order('timestamp', { ascending: false })
            .limit(1)
            .single();
          
          return {
            ...j,
            latestLocation: latestPing || { latitude: j.start_lat, longitude: j.start_lng, status: 'Starting', timestamp: j.created_at }
          };
        })
      );

      setActiveJourneys(journeysWithLocation);
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchActiveTracking();
    
    const locationSubscription = supabase
      .channel('live-locations')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'employee_locations' }, (payload) => {
        const newLocation = payload.new;
        
        setActiveJourneys(currentJourneys => {
          return currentJourneys.map(journey => {
            if (journey.user_id === newLocation.user_id) {
              return {
                ...journey,
                latestLocation: newLocation
              };
            }
            return journey;
          });
        });
      })
      .subscribe();

    const journeysSubscription = supabase
      .channel('live-journeys')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'journeys' }, () => {
        fetchActiveTracking();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(locationSubscription);
      supabase.removeChannel(journeysSubscription);
    };
  }, []);

  const initialRegion = {
    latitude: 18.5204, // Default to Pune/India if no journeys
    longitude: 73.8567,
    latitudeDelta: 2.0,
    longitudeDelta: 2.0,
  };

  if (activeJourneys.length > 0) {
    initialRegion.latitude = activeJourneys[0].latestLocation.latitude;
    initialRegion.longitude = activeJourneys[0].latestLocation.longitude;
    initialRegion.latitudeDelta = 0.1;
    initialRegion.longitudeDelta = 0.1;
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#0F4C3A' }}>
      {/* Header */}
      <View className="bg-[#0F4C3A] flex-row items-center justify-between px-4 py-4 z-10">
        <View className="flex-row items-center">
          <TouchableOpacity onPress={() => navigation.goBack()} className="mr-3 p-1">
            <Feather name="arrow-left" size={24} color="white" />
          </TouchableOpacity>
          <View className="w-10 h-10 rounded-full bg-[#F59E0B] items-center justify-center shadow-sm border border-[#D97706]">
            <Text className="text-white font-bold text-lg">{user.name?.charAt(0) || 'A'}</Text>
          </View>
          <View className="ml-3">
            <Text className="text-white font-bold text-lg leading-tight">STYRKA</Text>
            <Text className="text-[#F59E0B] text-[10px] font-bold tracking-widest">LIVE TRACKING</Text>
          </View>
        </View>

        <View className="flex-row items-center">
          <TouchableOpacity onPress={fetchActiveTracking} className="w-10 h-10 rounded-xl bg-[#145C44] items-center justify-center border border-[#186D51] mr-2">
            {isRefreshing && !isLoading ? (
              <ActivityIndicator size="small" color="white" />
            ) : (
              <Feather name="refresh-cw" size={16} color="white" />
            )}
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.mapContainer}>
        {isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#10B981" />
            <Text style={{ marginTop: 10, color: 'gray' }}>Loading Map...</Text>
          </View>
        ) : (
          <MapView 
            ref={mapRef}
            style={styles.map} 
            initialRegion={initialRegion}
          >
            {activeJourneys.map((journey) => (
              <Marker
                key={journey.id}
                coordinate={{ 
                  latitude: journey.latestLocation.latitude, 
                  longitude: journey.latestLocation.longitude 
                }}
                pinColor="#10B981" // Emerald
              >
                <Callout tooltip>
                  <View style={styles.calloutContainer}>
                    <Text style={styles.calloutName}>{journey.users.name}</Text>
                    <Text style={styles.calloutStatus}>Status: {journey.latestLocation.status}</Text>
                    <Text style={styles.calloutTime}>Last seen: {new Date(journey.latestLocation.timestamp).toLocaleTimeString()}</Text>
                  </View>
                </Callout>
              </Marker>
            ))}
          </MapView>
        )}

        {/* Overlay Footer */}
        <View style={styles.overlayFooter}>
          <View style={styles.footerInner}>
            <View style={styles.statBox}>
              <Text style={styles.statNumber}>{activeJourneys.length}</Text>
              <Text style={styles.statLabel}>Active{'\n'}Journeys</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={{ flex: 1, paddingLeft: 15, justifyContent: 'center' }}>
              <Text style={{ color: '#1F2937', fontWeight: 'bold', fontSize: 14 }}>Real-time Fleet View</Text>
              <Text style={{ color: '#6B7280', fontSize: 12, marginTop: 2 }}>Tap an employee below to locate them on the map.</Text>
            </View>
          </View>
          
          {activeJourneys.length > 0 && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 15 }}>
              {activeJourneys.map(journey => (
                <TouchableOpacity 
                  key={journey.id}
                  style={styles.employeeCard}
                  onPress={() => {
                    mapRef.current?.animateToRegion({
                      latitude: journey.latestLocation.latitude,
                      longitude: journey.latestLocation.longitude,
                      latitudeDelta: 0.05,
                      longitudeDelta: 0.05,
                    }, 1000);
                  }}
                >
                  <View style={styles.employeeAvatar}>
                    <Text style={styles.employeeAvatarText}>{journey.users.name.charAt(0)}</Text>
                  </View>
                  <View>
                    <Text style={styles.employeeName}>{journey.users.name}</Text>
                    <Text style={styles.employeeStatus}>{journey.latestLocation.status}</Text>
                  </View>
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}
        </View>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  mapContainer: {
    flex: 1,
    backgroundColor: '#E5E7EB',
  },
  map: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
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
    paddingBottom: 30, // Safe area for iPhone
    paddingTop: 15,
    paddingHorizontal: 20,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 5,
  },
  footerInner: {
    flexDirection: 'row',
  },
  statBox: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingRight: 15,
  },
  statNumber: {
    fontSize: 28,
    fontWeight: '900',
    color: '#10B981',
  },
  statLabel: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#6B7280',
    textTransform: 'uppercase',
    textAlign: 'center',
    marginTop: 2,
  },
  statDivider: {
    width: 1,
    backgroundColor: '#E5E7EB',
    height: '100%',
  },
  employeeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    padding: 10,
    borderRadius: 12,
    marginRight: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    minWidth: 140,
  },
  employeeAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#10B981',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  employeeAvatarText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 14,
  },
  employeeName: {
    fontWeight: 'bold',
    fontSize: 14,
    color: '#1F2937',
  },
  employeeStatus: {
    fontSize: 11,
    color: '#059669',
  }
});

export default AdminTrackingScreen;
