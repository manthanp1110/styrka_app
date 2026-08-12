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
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Alert,
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

  // Custom Destination Selection Modal state
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);
  const [selectedPlace, setSelectedPlace] = useState<any>(null);
  const [isAssigningCustom, setIsAssigningCustom] = useState(false);

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
    const handleNewDestination = async (payload?: any) => {
      if (payload && payload.address && payload.latitude && payload.longitude) {
        try {
          await TrackingDataService.assignDestination({
            adminId: payload.admin_id || 'admin_1',
            employeeId: payload.employee_id || user.id || 'emp_1',
            address: payload.address,
            latitude: Number(payload.latitude),
            longitude: Number(payload.longitude),
          });
        } catch (e) {}
      }
      fetchDestinations();
    };

    SocketService.on('destination_assigned', handleNewDestination);
    SocketService.on('destination_updated', fetchDestinations);
    SocketService.on('destination_deleted', fetchDestinations);

    return () => {
      unsubscribe?.();
      SocketService.off('destination_assigned', handleNewDestination);
      SocketService.off('destination_updated', fetchDestinations);
      SocketService.off('destination_deleted', fetchDestinations);
    };
  }, [fetchDestinations, navigation, user.id]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchDestinations();
  };

  // Handle place address search
  const handleSearchAddress = async (text: string) => {
    setSearchQuery(text);
    if (text.length < 3) {
      setSearchResults([]);
      return;
    }

    setSearching(true);
    try {
      const res = await MapplsApi.autoSuggest({ query: text });
      if (res && res.suggestedLocations) {
        const formatted = res.suggestedLocations.map((item: any) => ({
          place_id: item.mapplsPin || item.eLoc,
          description: item.placeAddress ? `${item.placeName}, ${item.placeAddress}` : item.placeName,
          mapplsPin: item.mapplsPin || item.eLoc,
          latitude: item.latitude,
          longitude: item.longitude,
        }));
        setSearchResults(formatted);
      }
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

  // Start journey to employee-selected custom destination
  const handleStartCustomJourney = async () => {
    if (!selectedPlace) {
      return Alert.alert('Select Location', 'Please search and select a destination address.');
    }

    setIsAssigningCustom(true);
    try {
      const created = await TrackingDataService.assignDestination({
        adminId: 'self',
        employeeId: user.id || 'emp_1',
        address: selectedPlace.address,
        latitude: selectedPlace.latitude,
        longitude: selectedPlace.longitude,
      });

      // Reset modal state
      setIsModalVisible(false);
      setSelectedPlace(null);
      setSearchQuery('');
      setSearchResults([]);

      // Refresh list & navigate to live tracking map
      fetchDestinations();
      navigation.navigate('LiveTracking', {
        assignedDestination: created,
      });
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to start custom journey');
    } finally {
      setIsAssigningCustom(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#0F4C3A' }}>
      {/* Header */}
      <View style={styles.header}>
        <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center' }}>
          <TouchableOpacity onPress={() => { if (navigation.canGoBack()) navigation.goBack(); }} style={{ marginRight: 10 }}>
            <Feather name="arrow-left" size={24} color="white" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>My Destinations</Text>
        </View>

        <TouchableOpacity style={styles.pickCustomBtn} onPress={() => setIsModalVisible(true)}>
          <Feather name="plus-circle" size={16} color="#0F4C3A" style={{ marginRight: 4 }} />
          <Text style={styles.pickCustomBtnText}>Custom Destination</Text>
        </TouchableOpacity>
      </View>

      {/* Main List */}
      <View style={{ flex: 1, backgroundColor: '#F4F7FB', padding: 20 }}>
        {isLoading ? (
          <ActivityIndicator size="large" color="#0F4C3A" style={{ marginTop: 50 }} />
        ) : (
          <FlatList
            data={destinations}
            keyExtractor={(item) => item.id}
            showsVerticalScrollIndicator={false}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#0F4C3A']} />}
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <Feather name="map-pin" size={48} color="#D1D5DB" />
                <Text style={styles.emptyText}>No destinations assigned yet</Text>
                <TouchableOpacity style={styles.emptyActionBtn} onPress={() => setIsModalVisible(true)}>
                  <Feather name="search" size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
                  <Text style={styles.emptyActionBtnText}>Select Your Destination</Text>
                </TouchableOpacity>
              </View>
            }
            renderItem={({ item }) => (
              <View style={styles.card}>
                <View style={styles.cardHeader}>
                  <View style={[styles.statusBadge, item.status === 'completed' ? styles.statusCompleted : styles.statusPending]}>
                    <Text style={[styles.statusText, item.status === 'completed' ? styles.statusTextCompleted : styles.statusTextPending]}>
                      {item.status.toUpperCase()}
                    </Text>
                  </View>
                  <Text style={styles.dateText}>{new Date(item.created_at).toLocaleDateString()}</Text>
                </View>

                <View style={styles.addressContainer}>
                  <Feather name="map-pin" size={20} color="#F59E0B" style={{ marginTop: 2 }} />
                  <Text style={styles.addressText}>{item.address}</Text>
                </View>

                {item.status !== 'completed' && (
                  <TouchableOpacity
                    style={styles.startBtn}
                    onPress={() => {
                      navigation.navigate('LiveTracking', {
                        assignedDestination: item,
                      });
                    }}
                  >
                    <Feather name="navigation" size={18} color="white" />
                    <Text style={styles.startBtnText}>Start Journey</Text>
                  </TouchableOpacity>
                )}
              </View>
            )}
          />
        )}
      </View>

      {/* Select Custom Destination Modal */}
      <Modal visible={isModalVisible} animationType="slide" transparent={true} onRequestClose={() => setIsModalVisible(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Feather name="map-pin" size={20} color="#0F4C3A" style={{ marginRight: 8 }} />
                <Text style={styles.modalTitle}>Choose Custom Destination</Text>
              </View>
              <TouchableOpacity onPress={() => setIsModalVisible(false)}>
                <Feather name="x" size={22} color="#6B7280" />
              </TouchableOpacity>
            </View>

            <Text style={styles.inputLabel}>Search Location / Address</Text>
            <View style={styles.searchBox}>
              <Feather name="search" size={18} color="#9CA3AF" style={{ marginRight: 8 }} />
              <TextInput
                style={styles.searchInput}
                placeholder="e.g. Pune Railway Station, Phoenix Mall..."
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

            {/* Search Suggestions Dropdown */}
            {searchResults.length > 0 ? (
              <View style={styles.searchResultsContainer}>
                <FlatList
                  data={searchResults}
                  keyExtractor={(item, idx) => `item_${idx}`}
                  style={{ maxHeight: 180 }}
                  keyboardShouldPersistTaps="handled"
                  renderItem={({ item }) => (
                    <TouchableOpacity style={styles.searchResultItem} onPress={() => handleSelectPlace(item)}>
                      <Feather name="map-pin" size={16} color="#6B7280" style={{ marginRight: 8, marginTop: 2 }} />
                      <Text style={styles.searchResultText} numberOfLines={2}>{item.description}</Text>
                    </TouchableOpacity>
                  )}
                />
              </View>
            ) : null}

            {/* Selected Place Box */}
            {selectedPlace ? (
              <View style={styles.selectedBox}>
                <Feather name="check-circle" size={20} color="#10B981" style={{ marginRight: 10 }} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.selectedTitle}>Selected Destination:</Text>
                  <Text style={styles.selectedAddress}>{selectedPlace.address}</Text>
                  <Text style={styles.selectedCoords}>
                    GPS: {selectedPlace.latitude.toFixed(4)}, {selectedPlace.longitude.toFixed(4)}
                  </Text>
                </View>
              </View>
            ) : null}

            {/* Actions */}
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setIsModalVisible(false)}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.confirmBtn, !selectedPlace && { backgroundColor: '#9CA3AF' }]}
                disabled={!selectedPlace || isAssigningCustom}
                onPress={handleStartCustomJourney}
              >
                {isAssigningCustom ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <>
                    <Feather name="navigation" size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
                    <Text style={styles.confirmBtnText}>Start Journey</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
};

export default EmployeeDestinationScreen;

const styles = StyleSheet.create({
  header: {
    backgroundColor: '#0F4C3A',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  headerTitle: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 18,
  },
  pickCustomBtn: {
    backgroundColor: '#F59E0B',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
  },
  pickCustomBtnText: {
    color: '#0F4C3A',
    fontWeight: '700',
    fontSize: 12,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    marginTop: 15,
    fontSize: 16,
    color: '#6B7280',
    fontWeight: '500',
  },
  emptyActionBtn: {
    backgroundColor: '#0F4C3A',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 8,
    marginTop: 16,
  },
  emptyActionBtnText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 14,
  },
  card: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 16,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 5,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusPending: { backgroundColor: '#FEF3C7' },
  statusCompleted: { backgroundColor: '#D1FAE5' },
  statusText: { fontSize: 10, fontWeight: 'bold' },
  statusTextPending: { color: '#D97706' },
  statusTextCompleted: { color: '#059669' },
  dateText: { fontSize: 12, color: '#9CA3AF', fontWeight: '500' },
  addressContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  addressText: {
    flex: 1,
    marginLeft: 10,
    fontSize: 15,
    color: '#1F2937',
    fontWeight: '500',
    lineHeight: 22,
  },
  startBtn: {
    flexDirection: 'row',
    backgroundColor: '#0F4C3A',
    padding: 12,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  startBtnText: {
    color: 'white',
    fontWeight: 'bold',
    marginLeft: 8,
    fontSize: 15,
  },

  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    elevation: 5,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#111827',
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 6,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: '#111827',
  },
  searchResultsContainer: {
    marginTop: 8,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 10,
    elevation: 3,
  },
  searchResultItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  searchResultText: {
    flex: 1,
    fontSize: 13,
    color: '#1F2937',
  },
  selectedBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ECFDF5',
    borderColor: '#A7F3D0',
    borderWidth: 1,
    padding: 12,
    borderRadius: 10,
    marginTop: 16,
  },
  selectedTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: '#059669',
    textTransform: 'uppercase',
  },
  selectedAddress: {
    fontSize: 13,
    fontWeight: '600',
    color: '#065F46',
    marginTop: 2,
  },
  selectedCoords: {
    fontSize: 11,
    color: '#047857',
    marginTop: 2,
  },
  modalActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginTop: 20,
  },
  cancelBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    marginRight: 10,
  },
  cancelBtnText: {
    color: '#6B7280',
    fontWeight: '600',
    fontSize: 14,
  },
  confirmBtn: {
    backgroundColor: '#0F4C3A',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 8,
  },
  confirmBtnText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 14,
  },
});
