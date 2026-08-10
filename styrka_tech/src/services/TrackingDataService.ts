import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../config/supabase';

export interface User {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'employee';
}

export interface AssignedDestination {
  id: string;
  admin_id: string;
  employee_id: string;
  address: string;
  latitude: number;
  longitude: number;
  status: 'pending' | 'in_progress' | 'completed';
  created_at: string;
}

export interface LiveLocation {
  user_id: string;
  latitude: number;
  longitude: number;
  heading?: number;
  speed?: number;
  status: 'online' | 'offline';
  timestamp: string;
  updated_at: string;
}

const DEFAULT_EMPLOYEES: User[] = [
  { id: 'emp_1', name: 'Rahul Sharma', email: 'rahul@styrka.com', role: 'employee' },
  { id: 'emp_2', name: 'Priya Singh', email: 'priya@styrka.com', role: 'employee' },
  { id: 'emp_3', name: 'Amit Kumar', email: 'amit@styrka.com', role: 'employee' },
];

const DEFAULT_ADMINS: User[] = [
  {
    id: 'admin_1',
    name: 'Manthan Pandhare',
    email: 'manthanpandhare1110@gmail.com',
    role: 'admin',
  },
  {
    id: 'admin_2',
    name: 'Pravin Dagade',
    email: 'dagadepravin55@gmail.com',
    role: 'admin',
  },
  {
    id: 'admin_3',
    name: 'Rustum Sayyed',
    email: 'rustumsayyed905@gmail.com',
    role: 'admin',
  },
];
const DEFAULT_ADMIN = DEFAULT_ADMINS[0];

const DESTINATIONS_KEY = '@styrka_destinations';
const LOCATIONS_KEY = '@styrka_live_locations';
const CUSTOM_EMPLOYEES_KEY = '@styrka_custom_employees';

export class TrackingDataService {
  // Get list of employees from Supabase users table & local storage
  static async getEmployees(): Promise<User[]> {
    let supabaseEmployees: User[] = [];
    try {
      const { data, error } = await supabase
        .from('users')
        .select('id, name, email, role')
        .eq('role', 'employee');
      if (!error && data && data.length > 0) {
        supabaseEmployees = data.map((p: any) => ({
          id: p.id,
          name: p.name || p.email,
          email: p.email,
          role: 'employee' as const,
        }));
      }
    } catch (e) {
      console.warn('[TrackingDataService] Could not fetch employees from Supabase:', e);
    }

    // Merge with local custom employees
    let customEmployees: User[] = [];
    try {
      const raw = await AsyncStorage.getItem(CUSTOM_EMPLOYEES_KEY);
      if (raw) customEmployees = JSON.parse(raw);
    } catch {}

    const all = [...supabaseEmployees, ...customEmployees];
    if (all.length === 0) {
      return DEFAULT_EMPLOYEES;
    }

    // Remove duplicates by id or email
    const uniqueMap = new Map<string, User>();
    all.forEach((emp) => uniqueMap.set(emp.id, emp));
    DEFAULT_EMPLOYEES.forEach((emp) => {
      if (!uniqueMap.has(emp.id)) uniqueMap.set(emp.id, emp);
    });

    return Array.from(uniqueMap.values());
  }

  // Add a new employee to Supabase and local storage
  static async addEmployee(param: { name: string; email: string; password?: string }): Promise<User> {
    const cleanName = param.name.trim();
    const cleanEmail = param.email.trim().toLowerCase();
    const password = param.password || 'Styrka123!';

    let createdId: string | null = null;

    try {
      // 1. Register with Supabase Auth
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: cleanEmail,
        password: password,
        options: {
          data: {
            name: cleanName,
            role: 'employee',
          },
        },
      });

      if (!authError && authData.user) {
        createdId = authData.user.id;
      }
    } catch (e) {
      console.warn('[TrackingDataService] Supabase Auth signUp failed, attempting direct table insert', e);
    }

    if (!createdId) {
      try {
        // 2. Direct insert into public.users table if Auth signup is skipped or restricted
        const tempId = `emp_${Date.now()}`;
        const { data, error } = await supabase
          .from('users')
          .insert([
            {
              id: tempId,
              name: cleanName,
              email: cleanEmail,
              role: 'employee',
            },
          ])
          .select()
          .single();

        if (!error && data) {
          createdId = data.id;
        } else {
          createdId = tempId;
        }
      } catch {
        createdId = `emp_${Date.now()}`;
      }
    }

    const newEmp: User = {
      id: createdId || `emp_${Date.now()}`,
      name: cleanName,
      email: cleanEmail,
      role: 'employee',
    };

    // Store in local storage so it persists offline / instantly
    try {
      const raw = await AsyncStorage.getItem(CUSTOM_EMPLOYEES_KEY);
      const customEmployees: User[] = raw ? JSON.parse(raw) : [];
      const updated = [newEmp, ...customEmployees.filter((e) => e.email !== cleanEmail)];
      await AsyncStorage.setItem(CUSTOM_EMPLOYEES_KEY, JSON.stringify(updated));
    } catch (e) {
      console.error('[TrackingDataService] Failed to save custom employee locally:', e);
    }

    return newEmp;
  }

  // Get user by email or ID from Supabase
  static async getUser(emailOrId: string): Promise<User | null> {
    try {
      const cleanStr = emailOrId.trim().toLowerCase();
      const { data, error } = await supabase
        .from('users')
        .select('id, name, email, role')
        .or(`email.eq.${cleanStr},id.eq.${emailOrId}`)
        .limit(1)
        .single();
      if (!error && data) {
        return {
          id: data.id,
          name: data.name || data.email,
          email: data.email,
          role: data.role as 'admin' | 'employee',
        };
      }
    } catch {}
    // Fallback: check local defaults
    const cleanStr = emailOrId.trim().toLowerCase();
    const matchedAdmin = DEFAULT_ADMINS.find(
      (a) => a.email.toLowerCase() === cleanStr || a.id === cleanStr
    );
    if (matchedAdmin) return matchedAdmin;
    if (cleanStr.includes('admin')) return DEFAULT_ADMIN;
    return DEFAULT_EMPLOYEES.find(
      (e) => e.email.toLowerCase() === cleanStr || e.id === cleanStr
    ) || DEFAULT_EMPLOYEES[0];
  }

  // Assign a new destination
  static async assignDestination(param: {
    adminId: string;
    employeeId: string;
    address: string;
    latitude: number;
    longitude: number;
  }): Promise<AssignedDestination> {
    const existing = await this.getAllDestinations();
    const newDest: AssignedDestination = {
      id: `dest_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
      admin_id: param.adminId,
      employee_id: param.employeeId,
      address: param.address,
      latitude: param.latitude,
      longitude: param.longitude,
      status: 'pending',
      created_at: new Date().toISOString(),
    };

    const updated = [newDest, ...existing];
    await AsyncStorage.setItem(DESTINATIONS_KEY, JSON.stringify(updated));
    return newDest;
  }

  // Get all destinations
  static async getAllDestinations(): Promise<AssignedDestination[]> {
    try {
      const raw = await AsyncStorage.getItem(DESTINATIONS_KEY);
      if (!raw) return [];
      return JSON.parse(raw);
    } catch {
      return [];
    }
  }

  // Get destinations for specific employee
  static async getEmployeeDestinations(employeeId: string): Promise<AssignedDestination[]> {
    const all = await this.getAllDestinations();
    return all.filter((d) => d.employee_id === employeeId);
  }

  // Update destination status
  static async updateDestinationStatus(
    destinationId: string,
    status: 'pending' | 'in_progress' | 'completed'
  ): Promise<void> {
    const all = await this.getAllDestinations();
    const updated = all.map((d) => (d.id === destinationId ? { ...d, status } : d));
    await AsyncStorage.setItem(DESTINATIONS_KEY, JSON.stringify(updated));
  }

  // Update live location for an employee
  static async updateLiveLocation(location: {
    userId: string;
    latitude: number;
    longitude: number;
    heading?: number;
    speed?: number;
  }): Promise<void> {
    try {
      const raw = await AsyncStorage.getItem(LOCATIONS_KEY);
      let locMap: Record<string, LiveLocation> = raw ? JSON.parse(raw) : {};

      locMap[location.userId] = {
        user_id: location.userId,
        latitude: location.latitude,
        longitude: location.longitude,
        heading: location.heading || 0,
        speed: location.speed || 0,
        status: 'online',
        timestamp: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      await AsyncStorage.setItem(LOCATIONS_KEY, JSON.stringify(locMap));
    } catch (e) {
      console.error('[TrackingDataService] Error updating live location', e);
    }
  }

  // Get live location for employee
  static async getLiveLocation(userId: string): Promise<LiveLocation | null> {
    try {
      const raw = await AsyncStorage.getItem(LOCATIONS_KEY);
      if (!raw) return null;
      const locMap: Record<string, LiveLocation> = JSON.parse(raw);
      return locMap[userId] || null;
    } catch {
      return null;
    }
  }

  // Get all live locations map
  static async getAllLiveLocations(): Promise<Record<string, LiveLocation>> {
    try {
      const raw = await AsyncStorage.getItem(LOCATIONS_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  }
}
