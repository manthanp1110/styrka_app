import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';

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
  isLoading: false,
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
      await AsyncStorage.removeItem(AUTH_KEY);
      await AsyncStorage.removeItem('active_tracking_user_id');
    } catch (e) {}
    set({
      user: { id: null, name: null, role: null, email: null },
      isAuthenticated: false,
      isLoading: false,
    });
  },

  setMoreModalVisible: (visible) => set({ isMoreModalVisible: visible }),
}));