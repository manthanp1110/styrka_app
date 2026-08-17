import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import { TrackingDataService } from '../services/TrackingDataService';
import SocketService from '../services/SocketService';

export type UserRole = 'admin' | 'employee' | null;

interface AppState {
  user: {
    id: string | null;
    name: string | null;
    role: UserRole;
    email: string | null;
  };
  isAuthenticated: boolean;
  isLoading: boolean;
  isMoreModalVisible: boolean;
  
  // Actions
  checkSession: () => Promise<void>;
  setSession: (userId: string, role: UserRole, name: string, email?: string) => Promise<void>;
  logout: () => Promise<void>;
  setMoreModalVisible: (visible: boolean) => void;
}

const AUTH_KEY = '@styrka_auth_user';

export const useAppState = create<AppState>((set, get) => ({
  user: {
    id: null,
    name: null,
    role: null,
    email: null,
  },
  isAuthenticated: false,
  isLoading: true,
  isMoreModalVisible: false,

  checkSession: async () => {
    try {
      const raw = await Promise.race([
        AsyncStorage.getItem(AUTH_KEY),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 600))
      ]).catch(() => null);

      if (raw) {
        const savedUser = JSON.parse(raw as string);
        if (savedUser && savedUser.id && savedUser.role) {
          set({
            user: savedUser,
            isAuthenticated: true,
            isLoading: false,
          });
          return;
        }
      }
      set({
        isAuthenticated: false,
        user: { id: null, name: null, role: null, email: null },
        isLoading: false,
      });
    } catch (e) {
      set({
        isAuthenticated: false,
        user: { id: null, name: null, role: null, email: null },
        isLoading: false,
      });
    }
  },

  setSession: async (userId, role, name, email) => {
    const userObj = { id: userId, role, name, email: email || '' };
    try {
      await AsyncStorage.setItem(AUTH_KEY, JSON.stringify(userObj));
      await AsyncStorage.setItem('active_tracking_user_id', userId);
    } catch (e) {}
    set({
      user: userObj,
      isAuthenticated: true,
      isLoading: false,
    });
  },

  logout: async () => {
    try {
      const userId = get().user.id || (await AsyncStorage.getItem('active_tracking_user_id'));

      // 1. Stop background GPS location task
      try {
        const isTaskStarted = await Location.hasStartedLocationUpdatesAsync('background-location-task');
        if (isTaskStarted) {
          await Location.stopLocationUpdatesAsync('background-location-task');
        }
      } catch (e) {}

      // 2. Notify Supabase & WebSocket that employee has gone offline (preserving last known location & destination)
      if (userId) {
        let lat = 0;
        let lng = 0;
        let heading = 0;
        let destLat: number | undefined = undefined;
        let destLng: number | undefined = undefined;
        let destAddress: string | undefined = undefined;

        try {
          const lastLoc = await TrackingDataService.getLiveLocation(userId);
          if (lastLoc && lastLoc.latitude !== 0 && lastLoc.longitude !== 0) {
            lat = Number(lastLoc.latitude);
            lng = Number(lastLoc.longitude);
            heading = Number(lastLoc.heading || 0);
            destLat = lastLoc.destination_lat != null ? Number(lastLoc.destination_lat) : undefined;
            destLng = lastLoc.destination_lng != null ? Number(lastLoc.destination_lng) : undefined;
            destAddress = lastLoc.destination_address || undefined;
          }
        } catch (e) {}

        await TrackingDataService.updateLiveLocation({
          userId,
          latitude: lat,
          longitude: lng,
          heading,
          speed: 0,
          destination_lat: destLat,
          destination_lng: destLng,
          destination_address: destAddress,
          status: 'offline',
        }).catch(() => {});

        SocketService.updateLocation({
          userId,
          latitude: lat,
          longitude: lng,
          heading,
          speed: 0,
          destination_lat: destLat,
          destination_lng: destLng,
          destination_address: destAddress,
          status: 'offline',
        });
      }

      // 3. Clear local storage keys
      await AsyncStorage.removeItem(AUTH_KEY);
      await AsyncStorage.removeItem('active_tracking_user_id');
      await AsyncStorage.removeItem('active_journey');
      await AsyncStorage.removeItem('active_journey_id');
    } catch (e) {}
    set({
      user: { id: null, name: null, role: null, email: null },
      isAuthenticated: false,
      isLoading: false,
    });
  },

  setMoreModalVisible: (visible) => set({ isMoreModalVisible: visible }),
}));