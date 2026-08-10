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
  destination_lat?: number | null;
  destination_lng?: number | null;
  destination_address?: string | null;
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

    // Save to Supabase `destinations` table
    try {
      const { data, error } = await supabase
        .from('destinations')
        .insert([
          {
            admin_id: String(param.adminId),
            employee_id: String(param.employeeId),
            address: param.address,
            latitude: param.latitude,
            longitude: param.longitude,
            status: 'pending',
          },
        ])
        .select()
        .single();

      if (!error && data) {
        newDest.id = data.id;
      } else if (error) {
        console.warn('[TrackingDataService] Supabase destination insert error:', error.message);
      }
    } catch (e) {
      console.warn('[TrackingDataService] Could not insert destination to Supabase:', e);
    }

    // Save to local storage for instant access across screens
    const existing = await this.getAllDestinations();
    const updated = [newDest, ...existing];
    await AsyncStorage.setItem(DESTINATIONS_KEY, JSON.stringify(updated));
    return newDest;
  }

  // Get all destinations
  static async getAllDestinations(): Promise<AssignedDestination[]> {
    try {
      const raw = await AsyncStorage.getItem(DESTINATIONS_KEY);
      const localList: AssignedDestination[] = raw ? JSON.parse(raw) : [];

      // Combine with Supabase
      try {
        const { data, error } = await supabase
          .from('destinations')
          .select('*')
          .order('created_at', { ascending: false });

        if (!error && data && data.length > 0) {
          const remoteList: AssignedDestination[] = data.map((d: any) => ({
            id: String(d.id),
            admin_id: d.admin_id ? String(d.admin_id) : 'admin_1',
            employee_id: d.employee_id ? String(d.employee_id) : 'emp_1',
            address: d.address || '',
            latitude: Number(d.latitude),
            longitude: Number(d.longitude),
            status: d.status || 'pending',
            created_at: d.created_at || new Date().toISOString(),
          }));

          const destMap = new Map<string, AssignedDestination>();
          [...remoteList, ...localList].forEach((item) => destMap.set(item.id, item));
          return Array.from(destMap.values());
        }
      } catch {}

      return localList;
    } catch {
      return [];
    }
  }

  // Get destinations for specific employee
  static async getEmployeeDestinations(employeeId: string): Promise<AssignedDestination[]> {
    const all = await this.getAllDestinations();
    if (all.length === 0) return [];
    if (!employeeId) return all;

    const cleanId = employeeId.trim().toLowerCase();
    
    // Filter matching employee ID, email, or name
    const filtered = all.filter((d) => {
      const empTarget = (d.employee_id || '').toLowerCase();
      if (!empTarget) return true;
      return (
        empTarget === cleanId ||
        empTarget.includes(cleanId) ||
        cleanId.includes(empTarget)
      );
    });

    if (filtered.length > 0) return filtered;
    
    // Fallback: return all destinations so employee receives assigned task
    return all;
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

  // Update live location for an employee (includes optional destination for admin visibility)
  static async updateLiveLocation(location: {
    userId: string;
    latitude: number;
    longitude: number;
    heading?: number;
    speed?: number;
    destination_lat?: number;
    destination_lng?: number;
    destination_address?: string;
    status?: 'online' | 'offline';
  }): Promise<void> {
    const timestamp = new Date().toISOString();
    try {
      // 1. Local storage cache
      const raw = await AsyncStorage.getItem(LOCATIONS_KEY);
      let locMap: Record<string, any> = raw ? JSON.parse(raw) : {};

      locMap[location.userId] = {
        user_id: location.userId,
        latitude: location.latitude,
        longitude: location.longitude,
        heading: location.heading || 0,
        speed: location.speed || 0,
        status: location.status || 'online',
        timestamp,
        updated_at: timestamp,
        destination_lat: location.destination_lat ?? locMap[location.userId]?.destination_lat ?? null,
        destination_lng: location.destination_lng ?? locMap[location.userId]?.destination_lng ?? null,
        destination_address: location.destination_address ?? locMap[location.userId]?.destination_address ?? null,
      };

      await AsyncStorage.setItem(LOCATIONS_KEY, JSON.stringify(locMap));

      // 2. Remote Supabase `public.live_locations` table upsert
      try {
        const upsertData: any = {
          user_id: String(location.userId),
          latitude: location.latitude,
          longitude: location.longitude,
          heading: location.heading || 0,
          speed: location.speed || 0,
          status: location.status || 'online',
          updated_at: timestamp,
        };
        // Include destination fields if provided
        if (location.destination_lat != null) upsertData.destination_lat = location.destination_lat;
        if (location.destination_lng != null) upsertData.destination_lng = location.destination_lng;
        if (location.destination_address != null) upsertData.destination_address = location.destination_address;

        await supabase
          .from('live_locations')
          .upsert([upsertData], { onConflict: 'user_id' });
      } catch (err) {
        console.warn('[TrackingDataService] Supabase live_locations upsert error:', err);
      }
    } catch (e) {
      console.error('[TrackingDataService] Error updating live location', e);
    }
  }

  // Get live location for employee
  static async getLiveLocation(userId: string): Promise<LiveLocation | null> {
    try {
      // Try Supabase first
      const { data } = await supabase
        .from('live_locations')
        .select('*')
        .eq('user_id', String(userId))
        .maybeSingle();

      if (data) {
        return {
          user_id: String(data.user_id),
          latitude: Number(data.latitude),
          longitude: Number(data.longitude),
          heading: Number(data.heading || 0),
          speed: Number(data.speed || 0),
          status: data.status || 'online',
          timestamp: data.updated_at || new Date().toISOString(),
          updated_at: data.updated_at || new Date().toISOString(),
        };
      }
    } catch {}

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
    const resultMap: Record<string, LiveLocation> = {};

    // 1. Read local storage cache
    try {
      const raw = await AsyncStorage.getItem(LOCATIONS_KEY);
      if (raw) {
        const localMap = JSON.parse(raw);
        Object.assign(resultMap, localMap);
      }
    } catch {}

    // 2. Merge latest from Supabase
    try {
      const { data, error } = await supabase
        .from('live_locations')
        .select('*');

      if (!error && data && data.length > 0) {
        data.forEach((row: any) => {
          resultMap[String(row.user_id)] = {
            user_id: String(row.user_id),
            latitude: Number(row.latitude),
            longitude: Number(row.longitude),
            heading: Number(row.heading || 0),
            speed: Number(row.speed || 0),
            status: row.status || 'online',
            timestamp: row.updated_at || new Date().toISOString(),
            updated_at: row.updated_at || new Date().toISOString(),
            destination_lat: row.destination_lat != null ? Number(row.destination_lat) : null,
            destination_lng: row.destination_lng != null ? Number(row.destination_lng) : null,
            destination_address: row.destination_address || null,
          };
        });
      }
    } catch (e) {
      console.warn('[TrackingDataService] Could not fetch remote live_locations:', e);
    }

    return resultMap;
  }
}
