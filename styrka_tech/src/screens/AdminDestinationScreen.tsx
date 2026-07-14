import React, { useState, useEffect } from 'react';
import { View, Text, SafeAreaView, TouchableOpacity, TextInput, FlatList, ActivityIndicator, StyleSheet, Alert } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useNavigation, NavigationProp } from '@react-navigation/native';
import { supabase } from '../config/supabase';
import { useAppState } from '../store/useAppState';

const AdminDestinationScreen = () => {
  const navigation = useNavigation<NavigationProp<any>>();
  const { user } = useAppState();
  
  const [employees, setEmployees] = useState<any[]>([]);
  const [selectedEmployee, setSelectedEmployee] = useState<any>(null);
  
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [selectedPlace, setSelectedPlace] = useState<any>(null);
  
  const [isLoading, setIsLoading] = useState(false);
  const [isAssigning, setIsAssigning] = useState(false);

  useEffect(() => {
    fetchEmployees();
  }, []);

  const fetchEmployees = async () => {
    const { data } = await supabase.from('users').select('*').eq('role', 'employee');
    if (data) setEmployees(data);
  };

  const searchAddress = async (text: string) => {
    setSearchQuery(text);
    if (text.length < 3) {
      setSearchResults([]);
      return;
    }
    
    try {
      // Fallback to free OpenStreetMap API since Google API billing is not enabled
      const res = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(text)}&format=json&limit=5`, {
        headers: {
          'User-Agent': 'StyrkaApp/1.0 (Testing)'
        }
      });
      
      if (!res.ok) {
        throw new Error(`Nominatim API returned ${res.status}`);
      }
      
      const json = await res.json();
      
      const formattedResults = json.map((item: any) => ({
        place_id: item.place_id.toString(),
        description: item.display_name,
        lat: parseFloat(item.lat),
        lng: parseFloat(item.lon)
      }));
      
      setSearchResults(formattedResults || []);
    } catch (e) {
      console.error("Place search error", e);
    }
  };

  const selectPlace = (place: any) => {
    setSearchQuery(place.description);
    setSearchResults([]);
    setSelectedPlace({
      address: place.description,
      latitude: place.lat,
      longitude: place.lng
    });
  };

  const assignDestination = async () => {
    if (!selectedEmployee) return Alert.alert("Error", "Please select an employee");
    if (!selectedPlace) return Alert.alert("Error", "Please select a destination");
    
    setIsAssigning(true);
    try {
      const { error } = await supabase.from('assigned_destinations').insert([{
        admin_id: user.id,
        employee_id: selectedEmployee.id,
        address: selectedPlace.address,
        latitude: selectedPlace.latitude,
        longitude: selectedPlace.longitude,
        status: 'pending'
      }]);
      
      if (error) throw error;
      
      Alert.alert("Success", "Destination assigned successfully!");
      setSelectedEmployee(null);
      setSelectedPlace(null);
      setSearchQuery('');
    } catch (e: any) {
      Alert.alert("Error", e.message || "Failed to assign destination");
    } finally {
      setIsAssigning(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#0F4C3A' }}>
      <View className="bg-[#0F4C3A] flex-row items-center px-4 py-4 z-10">
        <TouchableOpacity onPress={() => navigation.goBack()} className="mr-3 p-1">
          <Feather name="arrow-left" size={24} color="white" />
        </TouchableOpacity>
        <Text className="text-white font-bold text-lg">Assign Destination</Text>
      </View>

      <View style={{ flex: 1, backgroundColor: '#F4F7FB', padding: 20 }}>
        {/* Step 1: Select Employee */}
        <Text style={styles.label}>1. Select Employee</Text>
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={employees}
          keyExtractor={item => item.id}
          style={{ maxHeight: 60, marginBottom: 20 }}
          renderItem={({ item }) => (
            <TouchableOpacity 
              style={[
                styles.employeeBadge, 
                selectedEmployee?.id === item.id ? styles.employeeBadgeActive : null
              ]}
              onPress={() => setSelectedEmployee(item)}
            >
              <Text style={[
                styles.employeeBadgeText,
                selectedEmployee?.id === item.id ? styles.employeeBadgeTextActive : null
              ]}>{item.name}</Text>
            </TouchableOpacity>
          )}
        />

        {/* Step 2: Search Destination */}
        <Text style={styles.label}>2. Search Destination</Text>
        <View style={styles.searchContainer}>
          <Feather name="search" size={20} color="#9CA3AF" />
          <TextInput
            style={styles.searchInput}
            placeholder="Search address..."
            value={searchQuery}
            onChangeText={searchAddress}
          />
          {isLoading && <ActivityIndicator size="small" color="#10B981" />}
        </View>

        {searchResults.length > 0 && (
          <View style={styles.searchResults}>
            {searchResults.map((item) => (
              <TouchableOpacity 
                key={item.place_id} 
                style={styles.searchResultItem}
                onPress={() => selectPlace(item)}
              >
                <Feather name="map-pin" size={16} color="#6B7280" />
                <Text style={styles.searchResultText} numberOfLines={2}>{item.description}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {selectedPlace && (
          <View style={styles.selectedPlaceCard}>
            <Feather name="check-circle" size={24} color="#10B981" />
            <Text style={styles.selectedPlaceText}>{selectedPlace.address}</Text>
          </View>
        )}

        {/* Step 3: Assign Button */}
        <TouchableOpacity 
          style={[styles.assignBtn, (!selectedEmployee || !selectedPlace) ? { opacity: 0.5 } : null]}
          disabled={!selectedEmployee || !selectedPlace || isAssigning}
          onPress={assignDestination}
        >
          {isAssigning ? (
            <ActivityIndicator color="white" />
          ) : (
            <Text style={styles.assignBtnText}>Assign Destination</Text>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  label: { fontSize: 16, fontWeight: 'bold', color: '#1F2937', marginBottom: 10 },
  employeeBadge: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: 'white',
    borderRadius: 20,
    marginRight: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    justifyContent: 'center',
    alignItems: 'center'
  },
  employeeBadgeActive: {
    backgroundColor: '#0F4C3A',
    borderColor: '#0F4C3A',
  },
  employeeBadgeText: { color: '#4B5563', fontWeight: 'bold' },
  employeeBadgeTextActive: { color: 'white' },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    borderRadius: 12,
    paddingHorizontal: 15,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    marginBottom: 10,
  },
  searchInput: { flex: 1, marginLeft: 10, fontSize: 16 },
  searchResults: {
    backgroundColor: 'white',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    maxHeight: 200,
    marginBottom: 20,
  },
  searchResultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6'
  },
  searchResultText: { marginLeft: 10, color: '#4B5563', flex: 1 },
  selectedPlaceCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ECFDF5',
    padding: 15,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#A7F3D0',
    marginBottom: 20,
  },
  selectedPlaceText: { marginLeft: 10, color: '#065F46', fontWeight: '500', flex: 1 },
  assignBtn: {
    backgroundColor: '#0F4C3A',
    padding: 18,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 'auto'
  },
  assignBtnText: { color: 'white', fontWeight: 'bold', fontSize: 16 }
});

export default AdminDestinationScreen;
