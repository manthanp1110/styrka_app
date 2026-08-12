import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  SafeAreaView,
  TouchableOpacity,
  TextInput,
  FlatList,
  ActivityIndicator,
  StyleSheet,
  Alert,
  Modal,
  RefreshControl,
  ScrollView,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useNavigation, NavigationProp, useRoute } from '@react-navigation/native';
import { useAppState } from '../store/useAppState';
import { TrackingDataService, AssignedDestination, User } from '../services/TrackingDataService';
import SocketService from '../services/SocketService';
import MapplsApi from '../utils/mapplsApi';
import { isWithinMaharashtra } from '../utils/mapsUtils';

export const AdminDestinationScreen = () => {
  const navigation = useNavigation<NavigationProp<any>>();
  const route = useRoute<any>();
  const { user } = useAppState();

  const [activeTab, setActiveTab] = useState<'assign' | 'active'>('assign');
  const [employees, setEmployees] = useState<User[]>([]);
  const [destinations, setDestinations] = useState<AssignedDestination[]>([]);
  const [selectedEmployee, setSelectedEmployee] = useState<User | null>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [selectedPlace, setSelectedPlace] = useState<any>(null);

  const [isLoading, setIsLoading] = useState(false);
  const [isAssigning, setIsAssigning] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Edit Modal State
  const [editingDest, setEditingDest] = useState<AssignedDestination | null>(null);
  const [editSearchQuery, setEditSearchQuery] = useState('');
  const [editSearchResults, setEditSearchResults] = useState<any[]>([]);
  const [editSelectedPlace, setEditSelectedPlace] = useState<any>(null);
  const [isUpdating, setIsUpdating] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const [empList, destList] = await Promise.all([
        TrackingDataService.getEmployees(),
        TrackingDataService.getAllDestinations(),
      ]);
      setEmployees(empList);
      setDestinations(destList);

      // Pre-select employee if passed in navigation route params
      const routeEmpId = route.params?.selectedEmployeeId;
      if (routeEmpId) {
        const found = empList.find((e) => e.id === routeEmpId || e.email === routeEmpId);
        if (found) setSelectedEmployee(found);
      }
    } catch (e) {
      console.error('[AdminDestinationScreen] Error loading data:', e);
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  }, [route.params?.selectedEmployeeId]);

  useEffect(() => {
    loadData();
    const unsubscribe = navigation?.addListener?.('focus', () => {
      loadData();
    });
    return unsubscribe;
  }, [loadData, navigation]);

  const handleRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const searchAddress = async (text: string) => {
    setSearchQuery(text);
    if (text.length < 3) {
      setSearchResults([]);
      return;
    }

    setIsLoading(true);
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
        setSearchResults(formatted || []);
      }
    } catch (e) {
      console.error('Place search error', e);
    } finally {
      setIsLoading(false);
    }
  };

  const selectPlace = async (place: any) => {
    setSearchQuery(place.description);
    setSearchResults([]);

    try {
      setIsLoading(true);
      let lat = place.latitude;
      let lng = place.longitude;

      if ((!lat || !lng) && place.mapplsPin) {
        const detailRes = await MapplsApi.placeDetail({ mapplsPin: place.mapplsPin });
        if (detailRes && detailRes.latitude && detailRes.longitude) {
          lat = detailRes.latitude;
          lng = detailRes.longitude;
        }
      }

      if (lat && lng) {
        const numLat = Number(lat);
        const numLng = Number(lng);

        if (!isWithinMaharashtra(numLat, numLng)) {
          Alert.alert(
            'Location Restricted',
            'This app is restricted strictly to Maharashtra state. Please select a destination within Maharashtra.'
          );
          setSelectedPlace(null);
          return;
        }

        setSelectedPlace({
          address: place.description,
          latitude: numLat,
          longitude: numLng,
        });
      } else {
        Alert.alert('Location Warning', 'Could not resolve exact GPS coordinates. Please pick another location.');
      }
    } catch (error) {
      console.error('Place detail error:', error);
      Alert.alert('Error', 'Failed to fetch location details.');
    } finally {
      setIsLoading(false);
    }
  };

  const assignDestination = async () => {
    if (!selectedEmployee) return Alert.alert('Error', 'Please select an employee');
    if (!selectedPlace) return Alert.alert('Error', 'Please select a destination');

    if (!isWithinMaharashtra(selectedPlace.latitude, selectedPlace.longitude)) {
      return Alert.alert(
        'Location Restricted',
        'Destinations can only be assigned within Maharashtra state.'
      );
    }

    setIsAssigning(true);
    try {
      const created = await TrackingDataService.assignDestination({
        adminId: user.id || 'admin_1',
        employeeId: selectedEmployee.id,
        address: selectedPlace.address,
        latitude: selectedPlace.latitude,
        longitude: selectedPlace.longitude,
      });

      // Emit real-time Socket.io event
      SocketService.assignDestination({
        destination_id: created.id,
        admin_id: user.id || 'admin_1',
        employee_id: selectedEmployee.id,
        address: selectedPlace.address,
        latitude: selectedPlace.latitude,
        longitude: selectedPlace.longitude,
      });

      Alert.alert('Success', `Destination assigned to ${selectedEmployee.name}!`);
      setSelectedEmployee(null);
      setSelectedPlace(null);
      setSearchQuery('');
      loadData();
      setActiveTab('active');
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to assign destination');
    } finally {
      setIsAssigning(false);
    }
  };

  // EDIT DESTINATION HANDLERS
  const openEditModal = (dest: AssignedDestination) => {
    setEditingDest(dest);
    setEditSearchQuery(dest.address);
    setEditSearchResults([]);
    setEditSelectedPlace({
      address: dest.address,
      latitude: dest.latitude,
      longitude: dest.longitude,
    });
  };

  const searchEditAddress = async (text: string) => {
    setEditSearchQuery(text);
    if (text.length < 3) {
      setEditSearchResults([]);
      return;
    }

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
        setEditSearchResults(formatted || []);
      }
    } catch (e) {
      console.error('Edit search error', e);
    }
  };

  const selectEditPlace = async (place: any) => {
    setEditSearchQuery(place.description);
    setEditSearchResults([]);

    try {
      let lat = place.latitude;
      let lng = place.longitude;

      if ((!lat || !lng) && place.mapplsPin) {
        const detailRes = await MapplsApi.placeDetail({ mapplsPin: place.mapplsPin });
        if (detailRes && detailRes.latitude && detailRes.longitude) {
          lat = detailRes.latitude;
          lng = detailRes.longitude;
        }
      }

      if (lat && lng) {
        const numLat = Number(lat);
        const numLng = Number(lng);

        if (!isWithinMaharashtra(numLat, numLng)) {
          Alert.alert(
            'Location Restricted',
            'This app is restricted strictly to Maharashtra state. Please select a location within Maharashtra.'
          );
          setEditSelectedPlace(null);
          return;
        }

        setEditSelectedPlace({
          address: place.description,
          latitude: numLat,
          longitude: numLng,
        });
      }
    } catch (e) {
      Alert.alert('Error', 'Failed to resolve location coordinates');
    }
  };

  const handleUpdateDestination = async () => {
    if (!editingDest || !editSelectedPlace) return;

    setIsUpdating(true);
    try {
      await TrackingDataService.updateDestination(editingDest.id, {
        address: editSelectedPlace.address,
        latitude: editSelectedPlace.latitude,
        longitude: editSelectedPlace.longitude,
      });

      // Broadcast Socket.IO update
      SocketService.assignDestination({
        destination_id: editingDest.id,
        admin_id: user.id || 'admin_1',
        employee_id: editingDest.employee_id,
        address: editSelectedPlace.address,
        latitude: editSelectedPlace.latitude,
        longitude: editSelectedPlace.longitude,
      });

      Alert.alert('Updated', 'Destination updated successfully!');
      setEditingDest(null);
      loadData();
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to update destination');
    } finally {
      setIsUpdating(false);
    }
  };

  // DELETE DESTINATION HANDLER
  const handleDeleteDestination = (dest: AssignedDestination) => {
    Alert.alert(
      'Delete Destination',
      `Are you sure you want to remove the destination "${dest.address}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await TrackingDataService.deleteDestination(dest.id);
              Alert.alert('Deleted', 'Destination removed successfully.');
              loadData();
            } catch (e: any) {
              Alert.alert('Error', e.message || 'Failed to delete destination');
            }
          },
        },
      ]
    );
  };

  const getEmpName = (empId: string) => {
    const found = employees.find((e) => e.id === empId || e.email === empId);
    return found ? found.name : empId;
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header Bar */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Destinations Manager</Text>
          <Text style={styles.headerSubtitle}>Assign & monitor employee destinations</Text>
        </View>
      </View>

      {/* Tabs */}
      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[styles.tabBtn, activeTab === 'assign' && styles.tabBtnActive]}
          onPress={() => setActiveTab('assign')}
        >
          <Feather name="plus-circle" size={16} color={activeTab === 'assign' ? '#0F4C3A' : '#6B7280'} />
          <Text style={[styles.tabText, activeTab === 'assign' && styles.tabTextActive]}>Assign New</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabBtn, activeTab === 'active' && styles.tabBtnActive]}
          onPress={() => setActiveTab('active')}
        >
          <Feather name="list" size={16} color={activeTab === 'active' ? '#0F4C3A' : '#6B7280'} />
          <Text style={[styles.tabText, activeTab === 'active' && styles.tabTextActive]}>
            Active List ({destinations.length})
          </Text>
        </TouchableOpacity>
      </View>

      {activeTab === 'assign' ? (
        <ScrollView style={styles.formPadding} keyboardShouldPersistTaps="handled">
          {/* Step 1: Select Employee */}
          <Text style={styles.stepLabel}>1. Select Employee</Text>
          <FlatList
            horizontal
            showsHorizontalScrollIndicator={false}
            data={employees}
            keyExtractor={(item) => item.id}
            style={{ maxHeight: 54, marginBottom: 16 }}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={[
                  styles.employeeBadge,
                  selectedEmployee?.id === item.id ? styles.employeeBadgeActive : null,
                ]}
                onPress={() => setSelectedEmployee(item)}
              >
                <Text
                  style={[
                    styles.employeeBadgeText,
                    selectedEmployee?.id === item.id ? styles.employeeBadgeTextActive : null,
                  ]}
                >
                  {item.name}
                </Text>
              </TouchableOpacity>
            )}
          />

          {/* Step 2: Search Destination */}
          <Text style={styles.stepLabel}>2. Search Destination (Maharashtra Only)</Text>
          <View style={styles.searchContainer}>
            <Feather name="search" size={20} color="#9CA3AF" />
            <TextInput
              style={styles.searchInput}
              placeholder="Search address or landmark..."
              placeholderTextColor="#9CA3AF"
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
                  <Text style={styles.searchResultText} numberOfLines={2}>
                    {item.description}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          {selectedPlace && (
            <View style={styles.selectedPlaceCard}>
              <Feather name="check-circle" size={24} color="#10B981" />
              <View style={{ flex: 1, marginLeft: 10 }}>
                <Text style={{ fontSize: 12, fontWeight: '700', color: '#047857' }}>SELECTED DESTINATION</Text>
                <Text style={styles.selectedPlaceText}>{selectedPlace.address}</Text>
              </View>
            </View>
          )}

          {/* Step 3: Assign Button */}
          <TouchableOpacity
            style={[styles.assignBtn, !selectedEmployee || !selectedPlace ? { opacity: 0.5 } : null]}
            disabled={!selectedEmployee || !selectedPlace || isAssigning}
            onPress={assignDestination}
          >
            {isAssigning ? (
              <ActivityIndicator color="white" />
            ) : (
              <>
                <Feather name="send" size={18} color="white" style={{ marginRight: 8 }} />
                <Text style={styles.assignBtnText}>Assign Destination</Text>
              </>
            )}
          </TouchableOpacity>
        </ScrollView>
      ) : (
        /* ACTIVE DESTINATIONS TAB */
        <FlatList
          data={destinations}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: 16 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} colors={['#0F4C3A']} />}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Feather name="map-pin" size={48} color="#D1D5DB" />
              <Text style={styles.emptyTitle}>No Active Destinations</Text>
              <Text style={styles.emptySub}>Assign your first destination using the "Assign New" tab above.</Text>
            </View>
          }
          renderItem={({ item }) => (
            <View style={styles.destCard}>
              <View style={styles.destHeader}>
                <View style={styles.employeeTag}>
                  <Feather name="user" size={14} color="#0F4C3A" style={{ marginRight: 4 }} />
                  <Text style={styles.employeeTagText}>{getEmpName(item.employee_id)}</Text>
                </View>

                <View
                  style={[
                    styles.statusBadge,
                    item.status === 'completed'
                      ? { backgroundColor: '#D1FAE5', borderColor: '#A7F3D0' }
                      : item.status === 'in_progress'
                      ? { backgroundColor: '#DBEAFE', borderColor: '#BFDBFE' }
                      : { backgroundColor: '#FEF3C7', borderColor: '#FDE68A' },
                  ]}
                >
                  <Text
                    style={[
                      styles.statusBadgeText,
                      item.status === 'completed'
                        ? { color: '#047857' }
                        : item.status === 'in_progress'
                        ? { color: '#1D4ED8' }
                        : { color: '#B45309' },
                    ]}
                  >
                    {item.status.toUpperCase().replace('_', ' ')}
                  </Text>
                </View>
              </View>

              <Text style={styles.destAddress}>📍 {item.address}</Text>

              <Text style={styles.destDate}>
                Assigned: {new Date(item.created_at).toLocaleString()}
              </Text>

              <View style={styles.destActions}>
                <TouchableOpacity
                  style={styles.editBtn}
                  onPress={() => openEditModal(item)}
                >
                  <Feather name="edit-3" size={14} color="#2563EB" style={{ marginRight: 4 }} />
                  <Text style={styles.editBtnText}>Edit</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.deleteBtn}
                  onPress={() => handleDeleteDestination(item)}
                >
                  <Feather name="trash-2" size={14} color="#EF4444" style={{ marginRight: 4 }} />
                  <Text style={styles.deleteBtnText}>Delete</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        />
      )}

      {/* EDIT DESTINATION MODAL */}
      <Modal visible={!!editingDest} animationType="slide" transparent={true} onRequestClose={() => setEditingDest(null)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Edit Destination</Text>
              <TouchableOpacity onPress={() => setEditingDest(null)}>
                <Feather name="x" size={22} color="#6B7280" />
              </TouchableOpacity>
            </View>

            <Text style={styles.stepLabel}>Search New Address (Maharashtra Only)</Text>
            <View style={styles.searchContainer}>
              <Feather name="search" size={18} color="#9CA3AF" />
              <TextInput
                style={styles.searchInput}
                placeholder="Search new location..."
                value={editSearchQuery}
                onChangeText={searchEditAddress}
              />
            </View>

            {editSearchResults.length > 0 && (
              <View style={styles.searchResults}>
                {editSearchResults.map((item) => (
                  <TouchableOpacity
                    key={item.place_id}
                    style={styles.searchResultItem}
                    onPress={() => selectEditPlace(item)}
                  >
                    <Feather name="map-pin" size={16} color="#6B7280" />
                    <Text style={styles.searchResultText} numberOfLines={2}>
                      {item.description}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {editSelectedPlace && (
              <View style={styles.selectedPlaceCard}>
                <Feather name="check-circle" size={20} color="#10B981" />
                <Text style={[styles.selectedPlaceText, { marginLeft: 8 }]}>{editSelectedPlace.address}</Text>
              </View>
            )}

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => setEditingDest(null)}
                disabled={isUpdating}
              >
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.submitBtn}
                onPress={handleUpdateDestination}
                disabled={isUpdating || !editSelectedPlace}
              >
                {isUpdating ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.submitBtnText}>Save Changes</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

export default AdminDestinationScreen;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F3F4F6' },
  header: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  headerTitle: { fontSize: 20, fontWeight: '700', color: '#111827' },
  headerSubtitle: { fontSize: 13, color: '#6B7280', marginTop: 2 },

  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  tabBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 8,
    marginHorizontal: 4,
    backgroundColor: '#F3F4F6',
  },
  tabBtnActive: { backgroundColor: '#0F4C3A15', borderWidth: 1, borderColor: '#0F4C3A' },
  tabText: { fontSize: 13, fontWeight: '600', color: '#6B7280', marginLeft: 6 },
  tabTextActive: { color: '#0F4C3A', fontWeight: '700' },

  formPadding: { padding: 16 },
  stepLabel: { fontSize: 14, fontWeight: '700', color: '#374151', marginBottom: 8, marginTop: 12 },
  employeeBadge: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    justifyContent: 'center',
    alignItems: 'center',
  },
  employeeBadgeActive: { backgroundColor: '#0F4C3A', borderColor: '#0F4C3A' },
  employeeBadgeText: { color: '#4B5563', fontWeight: '600' },
  employeeBadgeTextActive: { color: '#FFFFFF', fontWeight: '700' },

  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    marginBottom: 10,
  },
  searchInput: { flex: 1, marginLeft: 10, fontSize: 14, color: '#111827' },
  searchResults: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    maxHeight: 200,
    marginBottom: 16,
  },
  searchResultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  searchResultText: { marginLeft: 10, color: '#374151', flex: 1, fontSize: 13 },
  selectedPlaceCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ECFDF5',
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#A7F3D0',
    marginBottom: 20,
  },
  selectedPlaceText: { color: '#065F46', fontWeight: '600', fontSize: 13, marginTop: 2 },
  assignBtn: {
    backgroundColor: '#0F4C3A',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 10,
  },
  assignBtnText: { color: '#FFFFFF', fontWeight: '700', fontSize: 15 },

  // ACTIVE DESTINATIONS LIST STYLES
  destCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
  },
  destHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  employeeTag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0F4C3A10',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  employeeTagText: { fontSize: 12, fontWeight: '700', color: '#0F4C3A' },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4, borderWidth: 1 },
  statusBadgeText: { fontSize: 10, fontWeight: '700' },
  destAddress: { fontSize: 14, fontWeight: '600', color: '#111827', marginTop: 4 },
  destDate: { fontSize: 11, color: '#9CA3AF', marginTop: 6 },
  destActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  editBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    marginRight: 8,
  },
  editBtnText: { fontSize: 12, fontWeight: '600', color: '#2563EB' },
  deleteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF2F2',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  deleteBtnText: { fontSize: 12, fontWeight: '600', color: '#EF4444' },

  emptyContainer: { alignItems: 'center', justifyContent: 'center', paddingVertical: 60 },
  emptyTitle: { fontSize: 18, fontWeight: '600', color: '#374151', marginTop: 12 },
  emptySub: { fontSize: 13, color: '#6B7280', textAlign: 'center', marginTop: 6, paddingHorizontal: 20 },

  // MODAL STYLES
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    paddingHorizontal: 20,
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
    marginBottom: 12,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  modalTitle: { fontSize: 18, fontWeight: '700', color: '#111827' },
  modalActions: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 20 },
  cancelBtn: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 8, marginRight: 10 },
  cancelBtnText: { color: '#6B7280', fontWeight: '600', fontSize: 14 },
  submitBtn: { backgroundColor: '#0F4C3A', paddingHorizontal: 18, paddingVertical: 10, borderRadius: 8 },
  submitBtnText: { color: '#FFFFFF', fontWeight: '600', fontSize: 14 },
});
