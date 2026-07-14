import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, SafeAreaView, ActivityIndicator, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useAppState } from '../store/useAppState';
import { supabase } from '../config/supabase';
import { MapView, Marker } from '../components/NativeMap';
import * as Location from 'expo-location';
import MapViewDirections from '../components/NativeDirections';
import { LOCATION_TASK_NAME } from '../tasks/locationTask';

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
  
  const [activeJourney, setActiveJourney] = useState<any>(null);
  const [pings, setPings] = useState<any[]>([]);
  const [currentLocation, setCurrentLocation] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [locationSubscription, setLocationSubscription] = useState<any>(null);
  const [distance, setDistance] = useState<number>(0);
  const [duration, setDuration] = useState<number>(0);
  const [address, setAddress] = useState<string>("Locating...");

  const fetchAddress = async (lat: number, lng: number) => {
    try {
      const apiKey = process.env.EXPO_PUBLIC_GOOGLE_GEOCODING_API_KEY;
      if (!apiKey) return;
      const res = await fetch(`https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${apiKey}`);
      const data = await res.json();
      if (data.results && data.results.length > 0) {
        // Just take the first part of the address (e.g. street name) to keep it concise
        const formatted = data.results[0].formatted_address.split(',')[0];
        setAddress(formatted);
      }
    } catch (e) {
      console.log('Geocoding error', e);
    }
  };

  const fetchActiveJourney = async () => {
    setIsLoading(true);
    try {
      const { data: journey, error } = await supabase
        .from('journeys')
        .select('*')
        .eq('user_id', user.id)
        .eq('status', 'active')
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
          .order('timestamp', { ascending: true });
        
        setPings(pingsData || []);
        if (pingsData && pingsData.length > 0) {
          const lastPing = pingsData[pingsData.length - 1];
          setCurrentLocation({ latitude: lastPing.latitude, longitude: lastPing.longitude });
          fetchAddress(lastPing.latitude, lastPing.longitude);
        } else {
          fetchAddress(journey.start_lat, journey.start_lng);
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

  // Geofencing Check: Auto-stop tracking when within 100m (0.1km)
  useEffect(() => {
    if (activeJourney && currentLocation && !isProcessing) {
      const dist = getDistanceFromLatLonInKm(
        currentLocation.latitude, currentLocation.longitude,
        activeJourney.destination_lat, activeJourney.destination_lng
      );
      if (dist < 0.1) {
        alert("You have reached your destination! Tracking has automatically stopped.");
        endJourney();
      }
    }
  }, [currentLocation, activeJourney, isProcessing]);

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
      let { status: fgStatus } = await Location.requestForegroundPermissionsAsync();
      if (fgStatus !== 'granted') {
        alert('Permission to access location was denied');
        setIsProcessing(false);
        return;
      }
      
      let { status: bgStatus } = await Location.requestBackgroundPermissionsAsync();
      if (bgStatus !== 'granted') {
        alert('Background permission was denied. Tracking will only work while the app is open.');
      }

      let location = await Location.getCurrentPositionAsync({});
      const startLat = location.coords.latitude;
      const startLng = location.coords.longitude;
      setCurrentLocation({ latitude: startLat, longitude: startLng });
      fetchAddress(startLat, startLng);

      let destLat = startLat + 0.05;
      let destLng = startLng + 0.05;
      const assignedDestination = route.params?.assignedDestination;
      
      if (assignedDestination) {
        destLat = assignedDestination.latitude;
        destLng = assignedDestination.longitude;
      }

      const { data, error } = await supabase.from('journeys').insert([
        {
          user_id: user.id,
          status: 'active',
          start_lat: startLat,
          start_lng: startLng,
          destination_lat: destLat,
          destination_lng: destLng,
        }
      ]).select().single();
      
      if (error) throw error;
      setActiveJourney(data);
      
      const sub = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.High,
          distanceInterval: 50,
        },
        async (loc) => {
          const newLat = loc.coords.latitude;
          const newLng = loc.coords.longitude;
          setCurrentLocation({ latitude: newLat, longitude: newLng });
          // Optionally update address periodically, but let's avoid too many API calls
          
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
      
      // Start true background tracking
      await Location.startLocationUpdatesAsync(LOCATION_TASK_NAME, {
        accuracy: Location.Accuracy.High,
        distanceInterval: 10,
        showsBackgroundLocationIndicator: true,
      });

      alert("Journey started! Tracking is active even in the background.");
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
      // 1. Mark Journey as Completed
      const { error } = await supabase.from('journeys').update({
        status: 'completed',
        ended_at: new Date().toISOString()
      }).eq('id', activeJourney.id);
      
      if (error) throw error;
      
      // 2. Mark assigned destination as Completed if we used one
      if (route.params?.assignedDestination?.id) {
        await supabase.from('assigned_destinations').update({
          status: 'completed'
        }).eq('id', route.params.assignedDestination.id);
      }
      
      if (locationSubscription) {
        locationSubscription.remove();
        setLocationSubscription(null);
      }
      
      // Stop background tracking
      await Location.stopLocationUpdatesAsync(LOCATION_TASK_NAME).catch(e => console.log(e));

      setActiveJourney(null);
      setPings([]);
      alert("Journey completed successfully.");
    } catch (e: any) {
      alert("Failed to end journey: " + e.message);
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
                <MapViewDirections
                  origin={currentLocation || { latitude: activeJourney.start_lat, longitude: activeJourney.start_lng }}
                  destination={{ latitude: activeJourney.destination_lat, longitude: activeJourney.destination_lng }}
                  apikey={process.env.EXPO_PUBLIC_GOOGLE_DIRECTIONS_API_KEY || ""}
                  strokeWidth={5}
                  strokeColor="#3B82F6"
                  optimizeWaypoints={true}
                  onReady={(result) => {
                    setDistance(result.distance);
                    setDuration(result.duration);
                  }}
                />
              </>
            )}
          </MapView>
        )}

        {/* Overlay Card */}
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
                 <View>
                   <Text className="text-xs text-gray-400 font-bold uppercase mb-1">Current Location</Text>
                   <Text className="text-gray-800 font-bold">{address}</Text>
                 </View>
                 <View className="items-end">
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
                    <Text className="text-white font-bold text-base ml-2">Start Uber Journey</Text>
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
