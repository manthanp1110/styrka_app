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
  completed_at?: string;
  updated_at?: string;
}

export interface LiveLocation {
  user_id: string;
  name?: string;
  email?: string;
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

const DEFAULT_EMPLOYEES: User[] = [];

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
    email: 'pravindagade007@gmail.com',
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
  // Clear all employees from local storage & Supabase
  static async clearAllEmployees(): Promise<void> {
    try {
      await supabase.from('users').delete().eq('role', 'employee');
      await supabase.from('destinations').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      await supabase.from('live_locations').delete().neq('user_id', '00000000-0000-0000-0000-000000000000');
    } catch (e) {}
    try {
      await AsyncStorage.removeItem(CUSTOM_EMPLOYEES_KEY);
      await AsyncStorage.removeItem(DESTINATIONS_KEY);
      await AsyncStorage.removeItem(LOCATIONS_KEY);
    } catch (e) {}
  }

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
          id: String(p.id),
          name: p.name || p.email,
          email: p.email || `${p.id}@styrka.com`,
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

    // ALSO merge with live locations in Supabase
    let liveLocationEmployees: User[] = [];
    try {
      const { data: locData } = await supabase.from('live_locations').select('*');
      if (locData && locData.length > 0) {
        locData.forEach((item: any) => {
          const uId = String(item.user_id);
          const rawName = item.name || (uId.includes('@') ? uId.split('@')[0] : uId);
          const formattedName = rawName.charAt(0).toUpperCase() + rawName.slice(1);
          liveLocationEmployees.push({
            id: uId,
            name: formattedName,
            email: item.email || (uId.includes('@') ? uId : `${uId}@styrka.com`),
            role: 'employee',
          });
        });
      }
    } catch {}

    const all = [...supabaseEmployees, ...customEmployees, ...liveLocationEmployees];

    const seenIds = new Set<string>();
    const seenEmails = new Set<string>();
    const seenPrefixes = new Set<string>();
    const resultList: User[] = [];

    all.forEach((emp) => {
      const cleanId = (emp.id || '').trim().toLowerCase();
      const cleanEmail = (emp.email || '').trim().toLowerCase();
      const emailPrefix = cleanEmail 
        ? cleanEmail.split('@')[0].replace(/^emp_/, '').replace(/_styrka_com$/, '').replace(/[^a-z0-9]/g, '') 
        : '';

      if (cleanId && seenIds.has(cleanId)) return;
      if (cleanEmail && seenEmails.has(cleanEmail)) return;
      if (emailPrefix && emailPrefix.length > 2 && seenPrefixes.has(emailPrefix)) return;

      if (cleanId) seenIds.add(cleanId);
      if (cleanEmail) seenEmails.add(cleanEmail);
      if (emailPrefix) seenPrefixes.add(emailPrefix);

      const displayName = (emp.name && !emp.name.toLowerCase().startsWith('emp_'))
        ? emp.name
        : (cleanEmail.includes('@') ? cleanEmail.split('@')[0].charAt(0).toUpperCase() + cleanEmail.split('@')[0].slice(1) : (emp.name || 'Employee'));

      resultList.push({
        ...emp,
        name: displayName,
      });
    });

    // Sync back to local storage so offline access is instant
    try {
      await AsyncStorage.setItem(CUSTOM_EMPLOYEES_KEY, JSON.stringify(resultList));
    } catch {}

    return resultList;
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

    const finalId = createdId || `emp_${Date.now()}`;

    // 2. Always upsert profile into public.users and live_locations tables in Supabase
    try {
      await supabase
        .from('users')
        .upsert([
          {
            id: finalId,
            name: cleanName,
            email: cleanEmail,
            role: 'employee',
          },
        ]);
    } catch (e) {
      console.warn('[TrackingDataService] Error upserting user into public.users table:', e);
    }

    try {
      await supabase
        .from('live_locations')
        .upsert([
          {
            user_id: finalId,
            name: cleanName,
            email: cleanEmail,
            latitude: 0,
            longitude: 0,
            status: 'offline',
            updated_at: new Date().toISOString(),
          },
        ]);
    } catch (e) {
      console.warn('[TrackingDataService] Error upserting user into live_locations table:', e);
    }

    const newEmp: User = {
      id: finalId,
      name: cleanName,
      email: cleanEmail,
      role: 'employee',
    };

    // Store in local storage so it persists offline / instantly
    try {
      const raw = await AsyncStorage.getItem(CUSTOM_EMPLOYEES_KEY);
      const customEmployees: User[] = raw ? JSON.parse(raw) : [];
      const updated = [newEmp, ...customEmployees.filter((e) => e.email !== cleanEmail && e.id !== newEmp.id)];
      await AsyncStorage.setItem(CUSTOM_EMPLOYEES_KEY, JSON.stringify(updated));
    } catch (e) {
      console.error('[TrackingDataService] Failed to save custom employee locally:', e);
    }

    return newEmp;
  }

  // Delete an employee from Supabase and local storage
  static async deleteEmployee(employeeId: string): Promise<void> {
    const cleanKey = (employeeId || '').trim().toLowerCase();
    if (!cleanKey) return;

    const emailPrefix = cleanKey.includes('@') ? cleanKey.split('@')[0] : cleanKey;

    try {
      // 1. Delete from Supabase users table
      await supabase.from('users').delete().eq('id', employeeId);
      await supabase.from('users').delete().eq('email', cleanKey);

      // 2. Delete from Supabase live_locations table so it isn't re-synthesized on fetch!
      await supabase.from('live_locations').delete().eq('user_id', employeeId);
      await supabase.from('live_locations').delete().eq('email', cleanKey);
      if (emailPrefix && emailPrefix.length > 2) {
        await supabase.from('live_locations').delete().ilike('user_id', `%${emailPrefix}%`);
        await supabase.from('users').delete().ilike('email', `%${emailPrefix}%`);
      }

      // 3. Delete from Supabase destinations table
      await supabase.from('destinations').delete().eq('employee_id', employeeId);
      await supabase.from('destinations').delete().eq('employee_id', cleanKey);
    } catch (e) {
      console.warn('[TrackingDataService] Error deleting employee from Supabase:', e);
    }

    // 4. Delete from local storage cache
    try {
      const raw = await AsyncStorage.getItem(CUSTOM_EMPLOYEES_KEY);
      if (raw) {
        const list: User[] = JSON.parse(raw);
        const filtered = list.filter((e) => {
          const eId = (e.id || '').toLowerCase();
          const eEmail = (e.email || '').toLowerCase();
          return eId !== cleanKey && eEmail !== cleanKey && (!emailPrefix || (!eId.includes(emailPrefix) && !eEmail.includes(emailPrefix)));
        });
        await AsyncStorage.setItem(CUSTOM_EMPLOYEES_KEY, JSON.stringify(filtered));
      }

      const locRaw = await AsyncStorage.getItem(LOCATIONS_KEY);
      if (locRaw) {
        const locMap = JSON.parse(locRaw);
        Object.keys(locMap).forEach((k) => {
          if ((emailPrefix && k.toLowerCase().includes(emailPrefix)) || k.toLowerCase() === cleanKey) {
            delete locMap[k];
          }
        });
        await AsyncStorage.setItem(LOCATIONS_KEY, JSON.stringify(locMap));
      }

      const destRaw = await AsyncStorage.getItem(DESTINATIONS_KEY);
      if (destRaw) {
        const destList: AssignedDestination[] = JSON.parse(destRaw);
        const filteredDest = destList.filter((d) => {
          const dEmpId = (d.employee_id || '').toLowerCase();
          return dEmpId !== cleanKey && (!emailPrefix || !dEmpId.includes(emailPrefix));
        });
        await AsyncStorage.setItem(DESTINATIONS_KEY, JSON.stringify(filteredDest));
      }
    } catch (e) {
      console.error('[TrackingDataService] Error deleting employee locally:', e);
    }
  }

  // Get user by email or ID from Supabase or local storage
  static async getUser(emailOrId: string): Promise<User | null> {
    const cleanStr = emailOrId.trim().toLowerCase();

    // 1. Check Supabase users table by email
    try {
      const { data, error } = await supabase
        .from('users')
        .select('id, name, email, role')
        .eq('email', cleanStr)
        .maybeSingle();

      if (!error && data) {
        return {
          id: data.id,
          name: data.name || data.email,
          email: data.email,
          role: data.role as 'admin' | 'employee',
        };
      }
    } catch {}

    // 2. Check Supabase users table by ID
    try {
      const { data, error } = await supabase
        .from('users')
        .select('id, name, email, role')
        .eq('id', emailOrId)
        .maybeSingle();

      if (!error && data) {
        return {
          id: data.id,
          name: data.name || data.email,
          email: data.email,
          role: data.role as 'admin' | 'employee',
        };
      }
    } catch {}

    // 3. Check local custom employees in AsyncStorage
    try {
      const raw = await AsyncStorage.getItem(CUSTOM_EMPLOYEES_KEY);
      if (raw) {
        const customList: User[] = JSON.parse(raw);
        const matchedLocal = customList.find(
          (e) => e.email.toLowerCase() === cleanStr || e.id === cleanStr
        );
        if (matchedLocal) return matchedLocal;
      }
    } catch {}

    // 4. Fallback: check admin defaults
    const matchedAdmin = DEFAULT_ADMINS.find(
      (a) => a.email.toLowerCase() === cleanStr || a.id === cleanStr
    );
    if (matchedAdmin) return matchedAdmin;
    if (cleanStr.includes('admin')) return DEFAULT_ADMIN;

    // 5. Fallback: if it's an email address or valid employee identifier
    if (cleanStr.includes('@')) {
      const namePart = cleanStr.split('@')[0];
      const formattedName = namePart.charAt(0).toUpperCase() + namePart.slice(1);
      return {
        id: `emp_${cleanStr.replace(/[^a-z0-9]/g, '_')}`,
        name: formattedName,
        email: cleanStr,
        role: 'employee',
      };
    }

    return null;
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
        newDest.id = String(data.id);
      } else if (error) {
        console.warn('[TrackingDataService] Supabase destination insert error:', error.message);
      }
    } catch (e) {
      console.warn('[TrackingDataService] Could not insert destination to Supabase:', e);
    }

    // Save to local storage for instant access across screens
    const existing = await this.getAllDestinations();
    const updated = [newDest, ...existing.filter((d) => d.id !== newDest.id)];
    await AsyncStorage.setItem(DESTINATIONS_KEY, JSON.stringify(updated));
    return newDest;
  }

  // Edit/Update an assigned destination
  static async updateDestination(
    destinationId: string,
    param: { address: string; latitude: number; longitude: number }
  ): Promise<void> {
    // 1. Supabase update
    try {
      await supabase
        .from('destinations')
        .update({
          address: param.address,
          latitude: param.latitude,
          longitude: param.longitude,
          updated_at: new Date().toISOString(),
        })
        .eq('id', destinationId);
    } catch (e) {
      console.warn('[TrackingDataService] Could not update destination in Supabase:', e);
    }

    // 2. Local storage update
    const all = await this.getAllDestinations();
    const updated = all.map((d) =>
      d.id === destinationId
        ? {
            ...d,
            address: param.address,
            latitude: param.latitude,
            longitude: param.longitude,
          }
        : d
    );
    await AsyncStorage.setItem(DESTINATIONS_KEY, JSON.stringify(updated));
  }

  // Delete an assigned destination
  static async deleteDestination(destinationId: string): Promise<void> {
    // 1. Supabase delete
    try {
      await supabase.from('destinations').delete().eq('id', destinationId);
    } catch (e) {
      console.warn('[TrackingDataService] Could not delete destination from Supabase:', e);
    }

    // 2. Local storage delete
    const all = await this.getAllDestinations();
    const updated = all.filter((d) => d.id !== destinationId);
    await AsyncStorage.setItem(DESTINATIONS_KEY, JSON.stringify(updated));
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
            completed_at: d.completed_at || d.updated_at || undefined,
            updated_at: d.updated_at || undefined,
          }));

          const destMap = new Map<string, AssignedDestination>();
          [...localList, ...remoteList].forEach((item) => {
            const existing = destMap.get(item.id);
            if (!existing) {
              destMap.set(item.id, item);
            } else {
              if (item.status === 'completed' || new Date(item.updated_at || item.created_at).getTime() >= new Date(existing.updated_at || existing.created_at).getTime()) {
                destMap.set(item.id, item);
              }
            }
          });
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
    status: 'pending' | 'in_progress' | 'completed',
    completedAt?: string
  ): Promise<void> {
    const nowIso = completedAt || new Date().toISOString();
    // 1. Supabase update
    try {
      await supabase
        .from('destinations')
        .update({
          status,
          ...(status === 'completed' ? { completed_at: nowIso } : {}),
          updated_at: nowIso,
        })
        .or(`id.eq.${destinationId},employee_id.eq.${destinationId}`);
    } catch (e) {}

    // 2. Local update
    const all = await this.getAllDestinations();
    const updated = all.map((d) => {
      const isTarget = d.id === destinationId || d.employee_id === destinationId || (status === 'completed' && d.status === 'in_progress');
      if (isTarget) {
        return {
          ...d,
          status,
          completed_at: status === 'completed' ? (d.completed_at || nowIso) : d.completed_at,
          updated_at: nowIso,
        };
      }
      return d;
    });
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

      const existingLoc = locMap[location.userId];
      const finalLat = (location.latitude !== 0 && location.latitude != null) ? location.latitude : (existingLoc?.latitude || 0);
      const finalLng = (location.longitude !== 0 && location.longitude != null) ? location.longitude : (existingLoc?.longitude || 0);
      const destLat = location.destination_lat ?? existingLoc?.destination_lat ?? null;
      const destLng = location.destination_lng ?? existingLoc?.destination_lng ?? null;
      const destAddress = location.destination_address ?? existingLoc?.destination_address ?? null;

      locMap[location.userId] = {
        user_id: location.userId,
        latitude: finalLat,
        longitude: finalLng,
        heading: location.heading || existingLoc?.heading || 0,
        speed: location.speed || 0,
        status: location.status || 'online',
        timestamp,
        updated_at: timestamp,
        destination_lat: destLat,
        destination_lng: destLng,
        destination_address: destAddress,
      };

      await AsyncStorage.setItem(LOCATIONS_KEY, JSON.stringify(locMap));

      // 2. Sync to Supabase `live_locations` table for cross-device visibility
      try {
        await supabase.from('live_locations').upsert({
          user_id: String(location.userId),
          latitude: Number(finalLat),
          longitude: Number(finalLng),
          heading: Number(location.heading || existingLoc?.heading || 0),
          speed: Number(location.speed || 0),
          status: location.status || 'online',
          destination_lat: destLat != null ? Number(destLat) : null,
          destination_lng: destLng != null ? Number(destLng) : null,
          destination_address: destAddress,
          updated_at: timestamp,
        });
      } catch (err) {
        console.warn('[TrackingDataService] Could not upsert live location to Supabase:', err);
      }
    } catch (e) {
      console.error('[TrackingDataService] Error updating live location', e);
    }
  }

  // Get live location for employee
  static async getLiveLocation(userId: string): Promise<LiveLocation | null> {
    try {
      const { data, error } = await supabase
        .from('live_locations')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();

      if (!error && data) {
        return {
          user_id: String(data.user_id),
          latitude: Number(data.latitude),
          longitude: Number(data.longitude),
          heading: Number(data.heading || 0),
          speed: Number(data.speed || 0),
          status: data.status || 'online',
          timestamp: data.updated_at || new Date().toISOString(),
          updated_at: data.updated_at || new Date().toISOString(),
          destination_lat: data.destination_lat != null ? Number(data.destination_lat) : null,
          destination_lng: data.destination_lng != null ? Number(data.destination_lng) : null,
          destination_address: data.destination_address || null,
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

    // 1. Fetch live locations from Supabase
    try {
      const { data, error } = await supabase.from('live_locations').select('*');
      if (!error && data && data.length > 0) {
        data.forEach((item: any) => {
          const locObj: LiveLocation = {
            user_id: String(item.user_id),
            name: item.name || undefined,
            email: item.email || undefined,
            latitude: Number(item.latitude),
            longitude: Number(item.longitude),
            heading: Number(item.heading || 0),
            speed: Number(item.speed || 0),
            status: item.status || 'online',
            timestamp: item.updated_at || new Date().toISOString(),
            updated_at: item.updated_at || new Date().toISOString(),
            destination_lat: item.destination_lat != null ? Number(item.destination_lat) : null,
            destination_lng: item.destination_lng != null ? Number(item.destination_lng) : null,
            destination_address: item.destination_address || null,
          };

          const keyPrimary = String(item.user_id);
          resultMap[keyPrimary] = locObj;
          if (item.email) resultMap[String(item.email)] = locObj;
          if (item.name) resultMap[String(item.name)] = locObj;
        });
      }
    } catch (e) {
      console.warn('[TrackingDataService] Could not fetch live_locations from Supabase:', e);
    }

    // 2. Merge with local storage cache
    try {
      const raw = await AsyncStorage.getItem(LOCATIONS_KEY);
      if (raw) {
        const localMap = JSON.parse(raw);
        Object.keys(localMap).forEach((key) => {
          if (!resultMap[key]) {
            resultMap[key] = localMap[key];
          } else {
            // Keep local version if newer
            const remoteTime = new Date(resultMap[key].timestamp || 0).getTime();
            const localTime = new Date(localMap[key].timestamp || 0).getTime();
            if (localTime > remoteTime) {
              resultMap[key] = localMap[key];
            }
          }
        });
      }
    } catch {}

    return resultMap;
  }
}

