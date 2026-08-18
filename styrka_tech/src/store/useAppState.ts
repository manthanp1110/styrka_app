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
        if (savedUser && savedUser.id) {
          const cleanEmail = (savedUser.email || '').trim().toLowerCase();
          const cleanId = String(savedUser.id || '').toLowerCase();
          const ADMIN_EMAILS = ['manthanpandhare1110@gmail.com', 'pravindagade007@gmail.com', 'rustumsayyed905@gmail.com', 'admin_1', 'admin_2', 'admin_3'];
          
          if (ADMIN_EMAILS.includes(cleanEmail) || cleanId.startsWith('admin')) {
            savedUser.role = 'admin';
          }

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
    const cleanEmail = (email || '').trim().toLowerCase();
    const cleanId = String(userId || '').toLowerCase();
    const ADMIN_EMAILS = ['manthanpandhare1110@gmail.com', 'pravindagade007@gmail.com', 'rustumsayyed905@gmail.com', 'admin_1', 'admin_2', 'admin_3'];
    
    const finalRole: UserRole = (ADMIN_EMAILS.includes(cleanEmail) || cleanId.startsWith('admin')) ? 'admin' : (role || 'employee');
    const userObj = { id: userId, role: finalRole, name, email: cleanEmail };
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
      const currentUser = get().user;
      const userId = currentUser.id || (await AsyncStorage.getItem('active_tracking_user_id'));
      const userEmail = currentUser.email || (await AsyncStorage.getItem('active_tracking_user_email'));
      const userName = currentUser.name || (await AsyncStorage.getItem('active_tracking_user_name'));
      const nowIso = new Date().toISOString();

      // 1. Stop background GPS location task
      try {
        const isTaskStarted = await Location.hasStartedLocationUpdatesAsync('background-location-task');
        if (isTaskStarted) {
          await Location.stopLocationUpdatesAsync('background-location-task');
        }
      } catch (e) {}

      // 2. Mark any active journey/destination as COMPLETED in Supabase & Local Storage
      let activeDestId: string | null = null;
      let activeJourneyId: string | null = null;
      try {
        const rawJourney = await AsyncStorage.getItem('active_journey');
        if (rawJourney) {
          const j = JSON.parse(rawJourney);
          activeDestId = j.destination_id || j.id;
          activeJourneyId = j.id;
        }
      } catch (e) {}

      if (activeDestId) {
        await TrackingDataService.updateDestinationStatus(activeDestId, 'completed', nowIso).catch(() => {});
      }
      if (userId) {
        await TrackingDataService.updateDestinationStatus(userId, 'completed', nowIso).catch(() => {});
      }
      if (userEmail) {
        const emailEmpId = `emp_${userEmail.replace(/[^a-z0-9]/g, '_')}`;
        await TrackingDataService.updateDestinationStatus(emailEmpId, 'completed', nowIso).catch(() => {});
      }

      // 3. Notify Admin Dashboard & WebSocket server that employee has completed journey and gone offline
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
          email: userEmail || undefined,
          name: userName || undefined,
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
          email: userEmail || undefined,
          name: userName || undefined,
          latitude: lat,
          longitude: lng,
          heading,
          speed: 0,
          destination_lat: destLat,
          destination_lng: destLng,
          destination_address: destAddress,
          status: 'offline',
          completed_at: nowIso,
        });

        SocketService.emitJourneyStatus({
          journeyId: activeDestId || activeJourneyId || `journey_${userId}`,
          destination_id: activeDestId || undefined,
          userId,
          email: userEmail || undefined,
          name: userName || undefined,
          status: 'completed',
          completed_at: nowIso,
        });
      }

      // 4. Clear local storage keys
      await AsyncStorage.removeItem(AUTH_KEY);
      await AsyncStorage.removeItem('active_tracking_user_id');
      await AsyncStorage.removeItem('active_tracking_user_email');
      await AsyncStorage.removeItem('active_tracking_user_name');
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