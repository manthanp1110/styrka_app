import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  SafeAreaView,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  StyleSheet,
  RefreshControl,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ScrollView,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useNavigation, NavigationProp } from '@react-navigation/native';
import { useAppState } from '../store/useAppState';
import { TrackingDataService } from '../services/TrackingDataService';
import MapplsApi from '../utils/mapplsApi';
import SocketService from '../services/SocketService';

const EmployeeDestinationScreen = () => {
  const navigation = useNavigation<NavigationProp<any>>();
  const { user } = useAppState();

  const [destinations, setDestinations] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Search & Selection State
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);
  const [selectedPlace, setSelectedPlace] = useState<any>(null);
  const [isStartingJourney, setIsStartingJourney] = useState(false);

  const fetchDestinations = useCallback(async () => {
    try {
      const empIdentifier = user.id || user.email || 'emp_1';
      let data = await TrackingDataService.getEmployeeDestinations(empIdentifier);
      if (!data || data.length === 0) {
        data = await TrackingDataService.getAllDestinations();
      }
      setDestinations(data);
    } catch (e) {
      console.error('[EmployeeDestinationScreen] Error fetching destinations:', e);
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  }, [user.id, user.email]);

  useEffect(() => {
    fetchDestinations();

    const unsubscribe = navigation?.addListener?.('focus', () => {
      fetchDestinations();
    });

    SocketService.connect(user.id || 'emp_1', 'employee');

    return () => {
      unsubscribe?.();
    };
  }, [fetchDestinations, navigation, user.id]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchDestinations();
  };

  // Handle place address search
  const handleSearchAddress = async (text: string) => {
    setSearchQuery(text);
    if (text.trim().length < 2) {
      setSearchResults([]);
      return;
    }

    setSearching(true);
    try {
      const res = await MapplsApi.autoSuggest({ query: text });
      let formatted: any[] = [];
      if (res && res.suggestedLocations && res.suggestedLocations.length > 0) {
        formatted = res.suggestedLocations.map((item: any) => ({
          place_id: item.mapplsPin || `${item.latitude},${item.longitude}`,
          description: item.placeAddress ? `${item.placeName}, ${item.placeAddress}` : item.placeName,
          mapplsPin: item.mapplsPin,
          latitude: item.latitude,
          longitude: item.longitude,
        }));
      }

      // Add direct search item if query is at least 3 chars
      if (text.trim().length >= 3) {
        const customItem = {
          place_id: `custom_${text.trim()}`,
          description: text.trim().toLowerCase().includes('maharashtra') ? text.trim() : `${text.trim()}, Maharashtra`,
          mapplsPin: null,
          latitude: null,
          longitude: null,
        };
        if (!formatted.some((f) => f.description.toLowerCase() === customItem.description.toLowerCase())) {
          formatted.unshift(customItem);
        }
      }

      setSearchResults(formatted);
    } catch (e) {
      console.error('[EmployeeDestinationScreen] Search place error:', e);
    } finally {
      setSearching(false);
    }
  };

  // Handle selecting place item from search results
  const handleSelectPlace = async (place: any) => {
    setSearchQuery(place.description);
    setSearchResults([]);

    try {
      setSearching(true);
      let lat = place.latitude;
      let lng = place.longitude;

      if ((!lat || !lng) && place.mapplsPin) {
        const detailRes = await MapplsApi.placeDetail({ mapplsPin: place.mapplsPin });
        if (detailRes && detailRes.latitude && detailRes.longitude) {
          lat = detailRes.latitude;
          lng = detailRes.longitude;
        }
      }

      if (!lat || !lng) {
        const geoRes = await MapplsApi.geocode({ address: place.description });
        if (geoRes && geoRes.results && geoRes.results.length > 0) {
          lat = geoRes.results[0].latitude;
          lng = geoRes.results[0].longitude;
        }
      }

      if (lat && lng) {
        setSelectedPlace({
          address: place.description,
          latitude: Number(lat),
          longitude: Number(lng),
        });
      } else {
        Alert.alert('Location Warning', 'Could not resolve exact GPS coordinates. Please select a more specific location.');
      }
    } catch (e) {
      Alert.alert('Error', 'Failed to resolve location details.');
    } finally {
      setSearching(false);
    }
  };

  // Start journey to selected destination
  const handleStartJourney = async (place?: any) => {
    const targetPlace = place || selectedPlace;
    if (!targetPlace) {
      return Alert.alert('Select Location', 'Please search and select a destination address.');
    }

    setIsStartingJourney(true);
    try {
      const created = await TrackingDataService.assignDestination({
        adminId: user.id || 'emp_1',
        employeeId: user.id || 'emp_1',
        address: targetPlace.address,
        latitude: targetPlace.latitude,
        longitude: targetPlace.longitude,
      });

      // Broadcast Socket.IO event so Admin is notified
      SocketService.assignDestination({
        destination_id: created.id,
        admin_id: user.id || 'emp_1',
        employee_id: user.id || 'emp_1',
        email: user.email || undefined,
        name: user.name || undefined,
        address: targetPlace.address,
        latitude: targetPlace.latitude,
        longitude: targetPlace.longitude,
      });

      // Emit new journey started status to reset Admin state from completed to active
      SocketService.emitJourneyStatus({
        journeyId: created.id,
        userId: user.id || 'emp_1',
        email: user.email || undefined,
        name: user.name || undefined,
        status: 'started',
      });

      // Reset state
      setSelectedPlace(null);
      setSearchQuery('');
      setSearchResults([]);

      // Navigate to live tracking map with selected destination
      navigation.navigate('LiveTracking', {
        assignedDestination: created,
      });
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to start journey');
    } finally {
      setIsStartingJourney(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#0F4C3A' }}>
      {/* Header */}
      <View style={styles.header}>
        <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center' }}>
          <View style={styles.headerIconBg}>
            <Feather name="navigation" size={20} color="#F59E0B" />
          </View>
          <View style={{ marginLeft: 10 }}>
            <Text style={styles.headerTitle}>Select Destination</Text>
            <Text style={styles.headerSubtitle}>Choose where you're heading today</Text>
          </View>
        </View>
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, backgroundColor: '#F4F7FB' }}>
        <ScrollView contentContainerStyle={{ padding: 16 }} keyboardShouldPersistTaps="handled" refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#0F4C3A']} />}>
          
          {/* Main Search Card */}
          <View style={styles.searchCard}>
            <Text style={styles.sectionLabel}>Search Destination</Text>
            <View style={styles.searchBox}>
              <Feather name="search" size={20} color="#9CA3AF" style={{ marginRight: 8 }} />
              <TextInput
                style={styles.searchInput}
                placeholder="Search station, office, landmark..."
                placeholderTextColor="#9CA3AF"
                value={searchQuery}
                onChangeText={handleSearchAddress}
              />
              {searchQuery.length > 0 && (
                <TouchableOpacity onPress={() => { setSearchQuery(''); setSearchResults([]); setSelectedPlace(null); }}>
                  <Feather name="x-circle" size={18} color="#9CA3AF" />
                </TouchableOpacity>
              )}
            </View>

            {searching ? <ActivityIndicator size="small" color="#0F4C3A" style={{ marginVertical: 12 }} /> : null}

            {/* Suggestions List */}
            {searchResults.length > 0 ? (
              <View style={styles.searchResultsContainer}>
                {searchResults.map((item, idx) => (
                  <TouchableOpacity key={`item_${idx}`} style={styles.searchResultItem} onPress={() => handleSelectPlace(item)}>
                    <Feather name="map-pin" size={16} color="#6B7280" style={{ marginRight: 8, marginTop: 2 }} />
                    <Text style={styles.searchResultText} numberOfLines={2}>{item.description}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            ) : null}

            {/* Selected Place Card */}
            {selectedPlace && (
              <View style={styles.selectedBox}>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6 }}>
                  <Feather name="check-circle" size={20} color="#10B981" style={{ marginRight: 8 }} />
                  <Text style={styles.selectedTitle}>Destination Selected</Text>
                </View>
                <Text style={styles.selectedAddress}>{selectedPlace.address}</Text>

                <TouchableOpacity
                  style={styles.startJourneyBtn}
                  disabled={isStartingJourney}
                  onPress={() => handleStartJourney()}
                >
                  {isStartingJourney ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <>
                      <Feather name="navigation" size={18} color="#FFFFFF" style={{ marginRight: 8 }} />
                      <Text style={styles.startJourneyBtnText}>Start Journey & Track Route</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            )}
          </View>

          {/* Recent / Saved Destinations Section */}
          <Text style={[styles.sectionLabel, { marginTop: 20, marginBottom: 10 }]}>Recent Destinations</Text>

          {isLoading ? (
            <ActivityIndicator size="large" color="#0F4C3A" style={{ marginTop: 20 }} />
          ) : destinations.length === 0 ? (
            <View style={styles.emptyCard}>
              <Feather name="map" size={36} color="#9CA3AF" />
              <Text style={styles.emptyCardText}>No recent destinations</Text>
              <Text style={styles.emptyCardSub}>Use the search bar above to select your destination.</Text>
            </View>
          ) : (
            destinations.map((item) => {
            const isCompleted = item.status === 'completed';
            const timestampToUse = isCompleted
              ? (item.completed_at || item.updated_at || item.created_at)
              : item.created_at;
            const dateObj = new Date(timestampToUse);
            const dateStr = dateObj.toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' });
            const timeStr = dateObj.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', hour12: true });

            return (
              <View key={item.id} style={styles.card}>
                <View style={styles.cardHeader}>
                  <View style={[styles.statusBadge, isCompleted ? styles.statusCompleted : styles.statusPending]}>
                    <Feather name={isCompleted ? "check-circle" : "clock"} size={12} color={isCompleted ? "#059669" : "#D97706"} style={{ marginRight: 4 }} />
                    <Text style={[styles.statusText, isCompleted ? styles.statusTextCompleted : styles.statusTextPending]}>
                      {isCompleted ? 'COMPLETED' : 'READY'}
                    </Text>
                  </View>

                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={styles.dateText}>
                      {isCompleted ? `Completed: ${dateStr}` : `Created: ${dateStr}`}
                    </Text>
                    <Text style={{ fontSize: 11, color: '#6B7280', fontWeight: '600', marginTop: 1 }}>
                      🕒 {timeStr}
                    </Text>
                  </View>
                </View>

                <View style={styles.addressContainer}>
                  <Feather name="map-pin" size={20} color={isCompleted ? "#059669" : "#F59E0B"} style={{ marginTop: 2 }} />
                  <Text style={styles.addressText}>{item.address}</Text>
                </View>

                {isCompleted ? (
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: '#F3F4F6' }}>
                    <Feather name="check-circle" size={15} color="#059669" style={{ marginRight: 6 }} />
                    <Text style={{ color: '#059669', fontWeight: '700', fontSize: 12 }}>
                      Drop-off Completed on {dateStr} at {timeStr}
                    </Text>
                  </View>
                ) : (
                  <TouchableOpacity
                    style={styles.reselectBtn}
                    disabled={isStartingJourney}
                    onPress={() => {
                      handleStartJourney({
                        address: item.address,
                        latitude: item.latitude,
                        longitude: item.longitude,
                      });
                    }}
                  >
                    <Feather name="play-circle" size={18} color="white" />
                    <Text style={styles.reselectBtnText}>Select & Start Journey</Text>
                  </TouchableOpacity>
                )}
              </View>
            );
          })
          )}

        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

export default EmployeeDestinationScreen;

const styles = StyleSheet.create({
  header: {
    backgroundColor: '#0F4C3A',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  headerIconBg: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(245, 158, 11, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 18,
  },
  headerSubtitle: {
    color: '#9CA3AF',
    fontSize: 12,
  },
  searchCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  sectionLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 10,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: '#111827',
  },
  searchResultsContainer: {
    marginTop: 10,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    elevation: 3,
    maxHeight: 220,
  },
  searchResultItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  searchResultText: {
    flex: 1,
    fontSize: 14,
    color: '#1F2937',
  },
  selectedBox: {
    backgroundColor: '#ECFDF5',
    borderColor: '#A7F3D0',
    borderWidth: 1,
    padding: 14,
    borderRadius: 12,
    marginTop: 16,
  },
  selectedTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#059669',
    textTransform: 'uppercase',
  },
  selectedAddress: {
    fontSize: 14,
    fontWeight: '600',
    color: '#065F46',
    marginBottom: 14,
  },
  startJourneyBtn: {
    backgroundColor: '#0F4C3A',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 10,
  },
  startJourneyBtnText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 15,
  },
  emptyCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 30,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  emptyCardText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#374151',
    marginTop: 10,
  },
  emptyCardSub: {
    fontSize: 13,
    color: '#9CA3AF',
    textAlign: 'center',
    marginTop: 4,
  },
  card: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 12,
  },
  statusPending: { backgroundColor: '#FEF3C7' },
  statusCompleted: { backgroundColor: '#D1FAE5' },
  statusText: { fontSize: 10, fontWeight: 'bold' },
  statusTextPending: { color: '#D97706' },
  statusTextCompleted: { color: '#059669' },
  dateText: { fontSize: 12, color: '#9CA3AF' },
  addressContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 14,
  },
  addressText: {
    flex: 1,
    marginLeft: 10,
    fontSize: 14,
    color: '#1F2937',
    fontWeight: '500',
  },
  reselectBtn: {
    flexDirection: 'row',
    backgroundColor: '#0F4C3A',
    padding: 12,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  reselectBtnText: {
    color: 'white',
    fontWeight: 'bold',
    marginLeft: 8,
    fontSize: 14,
  },
});
