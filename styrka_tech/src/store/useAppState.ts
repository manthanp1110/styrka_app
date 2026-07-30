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
      const { data, error: sessionError } = await supabase.auth.getSession();
      
      if (sessionError) {
        console.warn('[Auth] Stale refresh token encountered, signing out:', sessionError.message);
        await supabase.auth.signOut();
        set({ isAuthenticated: false, user: { id: null, name: null, role: null } });
        return;
      }

      const session = data?.session;
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
          await supabase.auth.signOut();
          set({ isAuthenticated: false, user: { id: null, name: null, role: null } });
        }
      } else {
        set({ isAuthenticated: false, user: { id: null, name: null, role: null } });
      }
    } catch (e) {
      console.error('Session check failed', e);
      await supabase.auth.signOut();
      set({ isAuthenticated: false, user: { id: null, name: null, role: null } });
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