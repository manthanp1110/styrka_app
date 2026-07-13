import { create } from 'zustand';
import { supabase } from '../config/supabase';

// Define the possible roles for RBAC
export type UserRole = 'admin' | 'employee' | null;

interface AppState {
  user: {
    id: string | null;
    name: string | null;
    role: UserRole;
  };
  isAuthenticated: boolean;
  isLoading: boolean;
  isMoreModalVisible: boolean;
  
  // Actions
  checkSession: () => Promise<void>;
  setSession: (userId: string, role: UserRole, name: string) => void;
  logout: () => Promise<void>;
  setMoreModalVisible: (visible: boolean) => void;
}

export const useAppState = create<AppState>((set, get) => ({
  user: {
    id: null,
    name: null,
    role: null,
  },
  isAuthenticated: false,
  isLoading: true, // start loading while checking session
  isMoreModalVisible: false,

  checkSession: async () => {
    set({ isLoading: true });
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (session?.user) {
        // Fetch role from users table
        const { data: userData, error } = await supabase
          .from('users')
          .select('role, name, first_name')
          .eq('email', session.user.email)
          .single();

        if (!error && userData) {
          const displayName = userData.name || userData.first_name || session.user.email?.split('@')[0] || 'User';
          
          set({
            user: {
              id: session.user.id,
              name: displayName,
              role: userData.role as UserRole,
            },
            isAuthenticated: true,
          });
        } else {
          // Fallback if role is not found, maybe they are just a user? Log them out for safety.
          await supabase.auth.signOut();
          set({ isAuthenticated: false });
        }
      } else {
        set({ isAuthenticated: false });
      }
    } catch (e) {
      console.error('Session check failed', e);
      set({ isAuthenticated: false });
    } finally {
      set({ isLoading: false });
    }
  },

  setSession: (userId, role, name) => {
    set({
      user: { id: userId, role, name },
      isAuthenticated: true,
    });
  },

  logout: async () => {
    set({ isLoading: true });
    await supabase.auth.signOut();
    set({
      user: { id: null, name: null, role: null },
      isAuthenticated: false,
      isLoading: false,
    });
  },

  setMoreModalVisible: (visible) => set({ isMoreModalVisible: visible }),
}));