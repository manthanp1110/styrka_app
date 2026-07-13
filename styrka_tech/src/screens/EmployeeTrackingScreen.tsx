import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, SafeAreaView, ActivityIndicator, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useAppState } from '../store/useAppState';
import { supabase } from '../config/supabase';
import { MapView, Marker, Polyline } from '../components/NativeMap';
import * as Location from 'expo-location';

const EmployeeTrackingScreen = () => {
  const { logout, user } = useAppState();
  const navigation = useNavigation();
  
  const [activeJourney, setActiveJourney] = useState<any>(null);
  const [pings, setPings] = useState<any[]>([]);
  const [currentLocation, setCurrentLocation] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [locationSubscription, setLocationSubscription] = useState<any>(null);

  const fetchActiveJourney = async () => {
    setIsLoading(true);
    try {
      const { data: journey, error } = await supabase
        .from('journeys')
        .select('*')
        .eq('user_id', user.id)
        .eq('status', 'Active')
        .order('created_at', { ascending: false })
        .limit(1)
        .single();
      
      if (!error && journey) {
        setActiveJourney(journey);
        const { data: pingsData } = await supabase
          .from('employee_locations')
          .select('*')
          .eq('user_id', user.id)
          .gte('timestamp', journey.created_at)
          .order('timestamp', { ascending: true }); // Ascending for polyline
        
        setPings(pingsData || []);
        if (pingsData && pingsData.length > 0) {
          const lastPing = pingsData[pingsData.length - 1];
          setCurrentLocation({ latitude: lastPing.latitude, longitude: lastPing.longitude });
        }
      } else {
        setActiveJourney(null);
        setPings([]);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (user.id) fetchActiveJourney();
  }, [user.id]);

  useEffect(() => {
    return () => {
      if (locationSubscription) {
        locationSubscription.remove();
      }
    };
  }, [locationSubscription]);

  const startJourney = async () => {
    setIsProcessing(true);
    try {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        alert('Permission to access location was denied');
        setIsProcessing(false);
        return;
      }

      let location = await Location.getCurrentPositionAsync({});
      const startLat = location.coords.latitude;
      const startLng = location.coords.longitude;
      setCurrentLocation({ latitude: startLat, longitude: startLng });

      const { data, error } = await supabase.from('journeys').insert([
        {
          user_id: user.id,
          status: 'Active',
          start_lat: startLat,
          start_lng: startLng,
          destination_lat: startLat + 0.05, // Mock destination
          destination_lng: startLng + 0.05,
        }
      ]).select().single();
      
      if (error) throw error;
      setActiveJourney(data);
      
      // Start watching position
      const sub = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.High,
          distanceInterval: 50, // Update every 50 meters
        },
        async (loc) => {
          const newLat = loc.coords.latitude;
          const newLng = loc.coords.longitude;
          setCurrentLocation({ latitude: newLat, longitude: newLng });
          
          // Silently push to supabase
          const { data: newPing } = await supabase.from('employee_locations').insert([
            {
              user_id: user.id,
              latitude: newLat,
              longitude: newLng,
              status: 'Moving',
              timestamp: new Date().toISOString()
            }
          ]).select().single();

          if (newPing) {
            setPings(prev => [...prev, newPing]);
          }
        }
      );
      setLocationSubscription(sub);

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
      const { error } = await supabase.from('journeys').update({
        status: 'Completed',
        ended_at: new Date().toISOString()
      }).eq('id', activeJourney.id);
      
      if (error) throw error;
      
      if (locationSubscription) {
        locationSubscription.remove();
        setLocationSubscription(null);
      }

      setActiveJourney(null);
      setPings([]);
      alert("Journey completed successfully.");
    } catch (e: any) {
      alert("Failed to end journey: " + e.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const polylineCoordinates = pings.map(p => ({
    latitude: p.latitude,
    longitude: p.longitude
  }));
  if (activeJourney && pings.length === 0 && currentLocation) {
    polylineCoordinates.push({ latitude: activeJourney.start_lat, longitude: activeJourney.start_lng });
    polylineCoordinates.push(currentLocation);
  } else if (pings.length > 0 && currentLocation) {
    // Add current location to the end of the line
    polylineCoordinates.push(currentLocation);
  }

  const initialRegion = {
    latitude: currentLocation?.latitude || activeJourney?.start_lat || 18.5204,
    longitude: currentLocation?.longitude || activeJourney?.start_lng || 73.8567,
    latitudeDelta: 0.05,
    longitudeDelta: 0.05,
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#0F4C3A' }}>
      {/* Header */}
      <View className="bg-[#0F4C3A] flex-row items-center justify-between px-4 py-4 z-10">
        <View className="flex-row items-center">
          <TouchableOpacity onPress={() => navigation.goBack()} className="mr-3 p-1">
            <Feather name="arrow-left" size={24} color="white" />
          </TouchableOpacity>
          <View className="w-10 h-10 rounded-full bg-[#F59E0B] items-center justify-center shadow-sm border border-[#D97706]">
            <Text className="text-white font-bold text-lg">{user.name?.charAt(0) || 'E'}</Text>
          </View>
          <View className="ml-3">
            <Text className="text-white font-bold text-lg leading-tight">STYRKA</Text>
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
        ) : (
          <MapView 
            style={styles.map} 
            initialRegion={initialRegion}
            showsUserLocation={true}
            showsMyLocationButton={true}
          >
            {activeJourney && (
              <>
                <Marker 
                  coordinate={{ latitude: activeJourney.start_lat, longitude: activeJourney.start_lng }}
                  title="Start Location"
                  pinColor="green"
                />
                <Marker 
                  coordinate={{ latitude: activeJourney.destination_lat, longitude: activeJourney.destination_lng }}
                  title="Destination"
                  pinColor="red"
                />
                <Polyline 
                  coordinates={polylineCoordinates}
                  strokeColor="#3B82F6"
                  strokeWidth={4}
                />
              </>
            )}
          </MapView>
        )}

        {/* Overlay Card */}
        <View style={styles.overlayCard}>
          {activeJourney ? (
            <View>
              <View className="flex-row items-center justify-between mb-4">
                <View className="bg-emerald-100 px-3 py-1.5 rounded-full flex-row items-center border border-emerald-200">
                  <View className="w-2 h-2 rounded-full bg-emerald-500 mr-2" />
                  <Text className="text-emerald-700 font-bold text-xs uppercase tracking-wider">Tracking Active</Text>
                </View>
                <Text className="text-gray-500 text-xs font-semibold">{pings.length} pings logged</Text>
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
                    <Text className="text-white font-bold text-base ml-2">End Journey</Text>
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
  overlayCard: {
    position: 'absolute',
    bottom: 30,
    left: 20,
    right: 20,
    backgroundColor: 'white',
    borderRadius: 24,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 5,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  }
});

export default EmployeeTrackingScreen;
