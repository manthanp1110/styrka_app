import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { TrackingDataService } from '../services/TrackingDataService';

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
    set({ isLoading: true });
    try {
      const raw = await AsyncStorage.getItem(AUTH_KEY);
      if (raw) {
        const savedUser = JSON.parse(raw);
        set({
          user: savedUser,
          isAuthenticated: true,
        });
      } else {
        set({ isAuthenticated: false, user: { id: null, name: null, role: null, email: null } });
      }
    } catch (e) {
      console.error('Session check failed', e);
      set({ isAuthenticated: false, user: { id: null, name: null, role: null, email: null } });
    } finally {
      set({ isLoading: false });
    }
  },

  setSession: async (userId, role, name, email) => {
    const userObj = { id: userId, role, name, email: email || '' };
    await AsyncStorage.setItem(AUTH_KEY, JSON.stringify(userObj));
    await AsyncStorage.setItem('active_tracking_user_id', userId);
    set({
      user: userObj,
      isAuthenticated: true,
    });
  },

  logout: async () => {
    set({ isLoading: true });
    await AsyncStorage.removeItem(AUTH_KEY);
    await AsyncStorage.removeItem('active_tracking_user_id');
    set({
      user: { id: null, name: null, role: null, email: null },
      isAuthenticated: false,
      isLoading: false,
    });
  },

  setMoreModalVisible: (visible) => set({ isMoreModalVisible: visible }),
}));