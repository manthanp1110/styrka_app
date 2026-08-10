import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, SafeAreaView, TouchableOpacity, FlatList, ActivityIndicator, StyleSheet, RefreshControl } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useNavigation, NavigationProp } from '@react-navigation/native';
import { useAppState } from '../store/useAppState';
import { TrackingDataService } from '../services/TrackingDataService';

import SocketService from '../services/SocketService';

const EmployeeDestinationScreen = () => {
  const navigation = useNavigation<NavigationProp<any>>();
  const { user } = useAppState();
  
  const [destinations, setDestinations] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

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
    const handleNewDestination = () => {
      fetchDestinations();
    };

    SocketService.on('destination_assigned', handleNewDestination);

    return () => {
      unsubscribe?.();
      SocketService.off('destination_assigned', handleNewDestination);
    };
  }, [fetchDestinations, navigation, user.id]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchDestinations();
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#0F4C3A' }}>
      <View className="bg-[#0F4C3A] flex-row items-center px-4 py-4 z-10">
        <TouchableOpacity onPress={() => { if (navigation.canGoBack()) navigation.goBack(); }} className="mr-3 p-1">
          <Feather name="arrow-left" size={24} color="white" />
        </TouchableOpacity>
        <Text className="text-white font-bold text-lg">My Destinations</Text>
      </View>

      <View style={{ flex: 1, backgroundColor: '#F4F7FB', padding: 20 }}>
        {isLoading ? (
          <ActivityIndicator size="large" color="#0F4C3A" style={{ marginTop: 50 }} />
        ) : (
          <FlatList
            data={destinations}
            keyExtractor={item => item.id}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#0F4C3A']} />
            }
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <Feather name="map" size={48} color="#D1D5DB" />
                <Text style={styles.emptyText}>No destinations assigned</Text>
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
                        assignedDestination: item
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
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyText: { marginTop: 15, fontSize: 16, color: '#6B7280', fontWeight: '500' },
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
    marginBottom: 12
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
    marginBottom: 16
  },
  addressText: {
    flex: 1,
    marginLeft: 10,
    fontSize: 15,
    color: '#1F2937',
    fontWeight: '500',
    lineHeight: 22
  },
  startBtn: {
    flexDirection: 'row',
    backgroundColor: '#0F4C3A',
    padding: 12,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center'
  },
  startBtnText: {
    color: 'white',
    fontWeight: 'bold',
    marginLeft: 8,
    fontSize: 15
  }
});

export default EmployeeDestinationScreen;
