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

const DEFAULT_ADMIN: User = {
  id: 'admin_1',
  name: 'Admin Manager',
  email: 'admin@styrka.com',
  role: 'admin',
};

const DESTINATIONS_KEY = '@styrka_destinations';
const LOCATIONS_KEY = '@styrka_live_locations';

export class TrackingDataService {
  // Get list of employees from Supabase profiles table
  static async getEmployees(): Promise<User[]> {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('id, name, email, role')
        .eq('role', 'employee');
      if (error || !data || data.length === 0) {
        return DEFAULT_EMPLOYEES;
      }
      return data.map((p: any) => ({
        id: p.id,
        name: p.name || p.email,
        email: p.email,
        role: 'employee' as const,
      }));
    } catch {
      return DEFAULT_EMPLOYEES;
    }
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
    if (cleanStr.includes('admin') || cleanStr === DEFAULT_ADMIN.id) {
      return DEFAULT_ADMIN;
    }
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
