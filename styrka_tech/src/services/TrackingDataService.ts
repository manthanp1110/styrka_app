import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  collection,
  doc,
  getDocs,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  writeBatch,
} from 'firebase/firestore';
import { db, auth, isFirebaseConfigured } from '../config/firebase';

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

// Safe timeout wrapper to prevent Firebase or network operations from ever hanging the app
export function withTimeout<T>(promise: PromiseLike<T> | Promise<T>, ms: number = 2500, fallbackVal?: T): Promise<T> {
  let timer: any;
  const timeoutPromise = new Promise<T>((resolve, reject) => {
    timer = setTimeout(() => {
      if (fallbackVal !== undefined) {
        resolve(fallbackVal);
      } else {
        reject(new Error(`Operation timed out after ${ms}ms`));
      }
    }, ms);
  });
  return Promise.race([Promise.resolve(promise), timeoutPromise]).finally(() => clearTimeout(timer));
}

export class TrackingDataService {
  // Clear all employees from local storage & Firebase
  static async clearAllEmployees(): Promise<void> {
    if (db && isFirebaseConfigured) {
      const firestore = db;
      try {
        const clearCloud = async () => {
          const collectionsToClear = ['users', 'destinations', 'live_locations'];
          for (const colName of collectionsToClear) {
            try {
              const snap = await getDocs(collection(firestore, colName));
              const batch = writeBatch(firestore);
              snap.docs.forEach((docItem) => {
                const data = docItem.data();
                if (colName === 'users' && data.role === 'admin') return;
                batch.delete(docItem.ref);
              });
              await batch.commit();
            } catch (err) {}
          }
        };
        withTimeout(clearCloud(), 2000).catch(() => {});
      } catch (e) {}
    }
    try {
      await AsyncStorage.removeItem(CUSTOM_EMPLOYEES_KEY);
      await AsyncStorage.removeItem(DESTINATIONS_KEY);
      await AsyncStorage.removeItem(LOCATIONS_KEY);
    } catch (e) {}
  }

  // Get list of employees from Render backend, Firebase destinations, users collection & local storage
  static async getEmployees(): Promise<User[]> {
    const DEMO_EMAILS = [
      'sangita@styrka.com', 'rahul@styrka.com', 'vikram@styrka.com', 
      'emp_1', 'emp_2', 'emp_3', 
      'emp_sangita_styrka_com', 'emp_rahul_styrka_com', 'emp_vikram_styrka_com'
    ];
    const ADMIN_EMAILS = ['manthanpandhare1110@gmail.com', 'pravindagade007@gmail.com', 'rustumsayyed905@gmail.com', 'admin_1', 'admin_2', 'admin_3'];

    // 1. Primary: Fetch active employees directly from Render backend (always active & fast)
    let backendEmployees: User[] = [];
    try {
      const backendUrl = process.env.EXPO_PUBLIC_BACKEND_URL || 'https://styrka-app.onrender.com';
      const res = await withTimeout(fetch(`${backendUrl}/api/location/active`), 2500);
      if (res && res.ok) {
        const activeList = await res.json();
        if (Array.isArray(activeList)) {
          activeList.forEach((item: any) => {
            const uId = String(item.user_id || item.employee_id || '').trim();
            const em = (item.email || '').trim().toLowerCase();
            if (uId && !DEMO_EMAILS.includes(uId) && !ADMIN_EMAILS.includes(em) && item.role !== 'admin') {
              const rawName = item.name || (em.includes('@') ? em.split('@')[0] : uId);
              const formattedName = rawName.charAt(0).toUpperCase() + rawName.slice(1);
              backendEmployees.push({
                id: uId,
                name: formattedName,
                email: em || (uId.includes('@') ? uId : `${uId}@styrka.com`),
                role: 'employee',
              });
            }
          });
        }
      }
    } catch (e) {
      console.log('[TrackingDataService] Backend active employees fetch:', e);
    }

    // 2. Fetch destinations directory from Firebase with fast 2s timeout
    let destinationEmployees: User[] = [];
    if (db && isFirebaseConfigured) {
      try {
        const destSnap = await withTimeout(
          getDocs(query(collection(db, 'destinations'), orderBy('created_at', 'desc'))),
          2000,
          null as any
        );
        if (destSnap && destSnap.docs) {
          destSnap.docs.forEach((docItem: any) => {
            const d = docItem.data();
            const rawId = (d.employee_id || d.admin_id || '').trim();
            if (!rawId) return;
            const lowerId = rawId.toLowerCase();
            if (DEMO_EMAILS.includes(lowerId) || ADMIN_EMAILS.includes(lowerId) || lowerId.startsWith('emp_17869')) return;

            let email = '';
            let name = '';

            if (d.address && d.address.startsWith('Directory:')) {
              const match = d.address.match(/Directory:\s*(.*?)\s*<([^>]+)>/);
              if (match) {
                name = match[1];
                email = match[2].toLowerCase();
              }
            }

            if (!email) {
              if (rawId.startsWith('emp_') && rawId.includes('_gmail_com')) {
                const withoutPrefix = rawId.replace(/^emp_/, '').replace(/_gmail_com$/, '');
                email = `${withoutPrefix}@gmail.com`;
              } else if (rawId.includes('@')) {
                email = rawId.toLowerCase();
              }
            }

            if (!name && email) {
              const prefix = email.split('@')[0];
              const letters = prefix.replace(/[^a-zA-Z]/g, '');
              name = letters ? (letters.charAt(0).toUpperCase() + letters.slice(1)) : (prefix.charAt(0).toUpperCase() + prefix.slice(1));
            }

            if (email && !DEMO_EMAILS.includes(email) && !ADMIN_EMAILS.includes(email)) {
              destinationEmployees.push({
                id: rawId,
                name: name || 'Employee',
                email: email,
                role: 'employee',
              });
            }
          });
        }
      } catch (e) {
        console.warn('[TrackingDataService] Could not fetch destinations for employee directory:', e);
      }
    }

    // 3. Fetch from Firebase users with fast 2s timeout
    let firebaseEmployees: User[] = [];
    if (db && isFirebaseConfigured) {
      try {
        const usersSnap = await withTimeout(
          getDocs(collection(db, 'users')),
          2000,
          null as any
        );
        if (usersSnap && usersSnap.docs && usersSnap.docs.length > 0) {
          firebaseEmployees = usersSnap.docs
            .map((docSnap: any) => ({ id: docSnap.id, ...docSnap.data() }))
            .filter((p: any) => p.role !== 'admin')
            .map((p: any) => ({
              id: String(p.id),
              name: p.name || p.email,
              email: p.email || `${p.id}@styrka.com`,
              role: 'employee' as const,
            }));
        }
      } catch (e) {
        console.warn('[TrackingDataService] Could not fetch employees from Firebase:', e);
      }
    }

    // Filter out demo and admin users from Firebase users
    firebaseEmployees = firebaseEmployees.filter((e) => {
      const em = (e.email || '').toLowerCase();
      const id = (e.id || '').toLowerCase();
      return !DEMO_EMAILS.includes(em) && !DEMO_EMAILS.includes(id) && !ADMIN_EMAILS.includes(em) && e.role !== 'admin';
    });

    // Merge with local custom employees (cleaned of demo accounts)
    let customEmployees: User[] = [];
    try {
      const raw = await AsyncStorage.getItem(CUSTOM_EMPLOYEES_KEY);
      if (raw) {
        const parsed: User[] = JSON.parse(raw);
        customEmployees = parsed.filter((e) => {
          const em = (e.email || '').toLowerCase();
          const id = (e.id || '').toLowerCase();
          return !DEMO_EMAILS.includes(em) && !DEMO_EMAILS.includes(id) && !ADMIN_EMAILS.includes(em) && e.role !== 'admin';
        });
      }
    } catch {}

    // ALSO merge with live locations in Firebase (with 2s timeout)
    let liveLocationEmployees: User[] = [];
    if (db && isFirebaseConfigured) {
      try {
        const locSnap = await withTimeout(
          getDocs(collection(db, 'live_locations')),
          2000,
          null as any
        );
        if (locSnap && locSnap.docs && locSnap.docs.length > 0) {
          locSnap.docs.forEach((docItem: any) => {
            const item = docItem.data();
            const uId = String(item.user_id || docItem.id).trim().toLowerCase();
            const em = (item.email || '').trim().toLowerCase();

            if (DEMO_EMAILS.includes(uId) || DEMO_EMAILS.includes(em) || ADMIN_EMAILS.includes(em) || item.role === 'admin') {
              return;
            }

            const rawName = item.name || (uId.includes('@') ? uId.split('@')[0] : uId);
            const formattedName = rawName.charAt(0).toUpperCase() + rawName.slice(1);
            liveLocationEmployees.push({
              id: uId,
              name: formattedName,
              email: em || (uId.includes('@') ? uId : `${uId}@styrka.com`),
              role: 'employee',
            });
          });
        }
      } catch {}
    }

    const all = [...backendEmployees, ...destinationEmployees, ...firebaseEmployees, ...customEmployees, ...liveLocationEmployees];

    const seenIds = new Set<string>();
    const seenEmails = new Set<string>();
    const seenPrefixes = new Set<string>();
    const resultList: User[] = [];

    all.forEach((emp) => {
      const cleanId = (emp.id || '').trim().toLowerCase();
      const cleanEmail = (emp.email || '').trim().toLowerCase();

      if (DEMO_EMAILS.includes(cleanId) || DEMO_EMAILS.includes(cleanEmail) || ADMIN_EMAILS.includes(cleanEmail) || emp.role === 'admin') {
        return;
      }

      const emailPrefix = cleanEmail 
        ? cleanEmail.split('@')[0].replace(/^emp_/, '').replace(/_styrka_com$/, '').replace(/[^a-z0-9]/g, '') 
        : '';

      if (cleanId && seenIds.has(cleanId)) return;
      if (cleanEmail && seenEmails.has(cleanEmail)) return;
      if (emailPrefix && emailPrefix.length > 2 && seenPrefixes.has(emailPrefix)) return;

      if (cleanId) seenIds.add(cleanId);
      if (cleanEmail) seenEmails.add(cleanEmail);
      if (emailPrefix) seenPrefixes.add(emailPrefix);

      let displayName = (emp.name && !emp.name.toLowerCase().startsWith('emp_') && !emp.name.toLowerCase().includes('_styrka_com'))
        ? emp.name
        : '';

      if (!displayName && cleanEmail.includes('@')) {
        const pref = cleanEmail.split('@')[0].replace(/^emp_/, '').replace(/_styrka_com$/, '');
        const letters = pref.replace(/[^a-zA-Z]/g, '');
        displayName = letters ? (letters.charAt(0).toUpperCase() + letters.slice(1)) : (pref.charAt(0).toUpperCase() + pref.slice(1));
      }

      if (!displayName) displayName = 'Employee';

      resultList.push({
        ...emp,
        name: displayName,
      });
    });

    // Sync back clean list to local storage
    try {
      await AsyncStorage.setItem(CUSTOM_EMPLOYEES_KEY, JSON.stringify(resultList));
    } catch {}

    return resultList;
  }

  // Add a new employee to Firebase and local storage
  static async addEmployee(param: { name: string; email: string; password?: string }): Promise<User> {
    const cleanName = param.name.trim();
    const cleanEmail = param.email.trim().toLowerCase();
    const password = param.password || 'Styrka123!';

    const finalId = `emp_${cleanEmail.replace(/[^a-z0-9]/g, '_')}`;

    const newEmp: User = {
      id: finalId,
      name: cleanName,
      email: cleanEmail,
      role: 'employee',
    };

    if (db && isFirebaseConfigured) {
      // 1. Direct insert directory record into Firebase destinations collection (Global for all phones)
      try {
        const destRef = doc(collection(db, 'destinations'));
        await setDoc(destRef, {
          admin_id: 'admin_directory',
          employee_id: finalId,
          address: `Directory: ${cleanName} <${cleanEmail}>`,
          latitude: 0,
          longitude: 0,
          status: 'pending',
          created_at: new Date().toISOString(),
        });
      } catch (e) {
        console.warn('[TrackingDataService] Could not insert directory record into destinations collection:', e);
      }

      // 2. Direct upsert into live_locations collection in Firebase (Global for all phones)
      try {
        await setDoc(
          doc(db, 'live_locations', finalId),
          {
            user_id: finalId,
            name: cleanName,
            email: cleanEmail,
            latitude: 0,
            longitude: 0,
            status: 'offline',
            updated_at: new Date().toISOString(),
          },
          { merge: true }
        );
      } catch (e) {
        console.warn('[TrackingDataService] Error upserting user into live_locations collection:', e);
      }

      // 3. Insert into users collection
      try {
        await setDoc(
          doc(db, 'users', finalId),
          {
            id: finalId,
            name: cleanName,
            email: cleanEmail,
            role: 'employee',
            created_at: new Date().toISOString(),
          },
          { merge: true }
        );
      } catch (e) {
        console.warn('[TrackingDataService] Error creating Firebase user record:', e);
      }
    }

    // 4. Store in local storage cache for instant offline access
    try {
      const raw = await AsyncStorage.getItem(CUSTOM_EMPLOYEES_KEY);
      const customEmployees: User[] = raw ? JSON.parse(raw) : [];
      const updated = [newEmp, ...customEmployees.filter((e) => e.email !== cleanEmail && e.id !== newEmp.id)];
      await AsyncStorage.setItem(CUSTOM_EMPLOYEES_KEY, JSON.stringify(updated));
    } catch (e) {
      console.error('[TrackingDataService] Failed to save custom employee locally:', e);
    }

    // 5. Try registering with Firebase Auth in background
    if (auth && isFirebaseConfigured) {
      try {
        const { createUserWithEmailAndPassword } = await import('firebase/auth');
        await createUserWithEmailAndPassword(auth, cleanEmail, password);
      } catch (e) {}
    }

    return newEmp;
  }

  // Delete an employee from Firebase and local storage
  static async deleteEmployee(employeeId: string): Promise<void> {
    const cleanKey = (employeeId || '').trim().toLowerCase();
    if (!cleanKey) return;

    const emailPrefix = cleanKey.includes('@') ? cleanKey.split('@')[0] : cleanKey;

    if (db && isFirebaseConfigured) {
      try {
        // 1. Delete from Firebase users collection
        await deleteDoc(doc(db, 'users', employeeId)).catch(() => {});
        if (cleanKey !== employeeId) {
          await deleteDoc(doc(db, 'users', cleanKey)).catch(() => {});
        }
        const userByEmailQuery = query(collection(db, 'users'), where('email', '==', cleanKey));
        const userSnap = await getDocs(userByEmailQuery);
        userSnap.forEach((d) => deleteDoc(d.ref).catch(() => {}));

        // 2. Delete from Firebase live_locations collection
        await deleteDoc(doc(db, 'live_locations', employeeId)).catch(() => {});
        if (cleanKey !== employeeId) {
          await deleteDoc(doc(db, 'live_locations', cleanKey)).catch(() => {});
        }
        const locByEmailQuery = query(collection(db, 'live_locations'), where('email', '==', cleanKey));
        const locSnap = await getDocs(locByEmailQuery);
        locSnap.forEach((d) => deleteDoc(d.ref).catch(() => {}));

        // 3. Delete from Firebase destinations collection
        const destQuery = query(collection(db, 'destinations'), where('employee_id', '==', employeeId));
        const destSnap = await getDocs(destQuery);
        destSnap.forEach((d) => deleteDoc(d.ref).catch(() => {}));
        if (cleanKey !== employeeId) {
          const destQuery2 = query(collection(db, 'destinations'), where('employee_id', '==', cleanKey));
          const destSnap2 = await getDocs(destQuery2);
          destSnap2.forEach((d) => deleteDoc(d.ref).catch(() => {}));
        }
      } catch (e) {
        console.warn('[TrackingDataService] Error deleting employee from Firebase:', e);
      }
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

  // Get user by email or ID from Firebase or local storage
  static async getUser(emailOrId: string): Promise<User | null> {
    const cleanStr = (emailOrId || '').trim().toLowerCase();
    if (!cleanStr) return null;

    const DEMO_EMAILS = [
      'sangita@styrka.com', 'rahul@styrka.com', 'vikram@styrka.com', 
      'emp_1', 'emp_2', 'emp_3', 
      'emp_sangita_styrka_com', 'emp_rahul_styrka_com', 'emp_vikram_styrka_com'
    ];
    if (DEMO_EMAILS.includes(cleanStr)) {
      return null;
    }

    // 1. Check admin defaults
    const matchedAdmin = DEFAULT_ADMINS.find(
      (a) => a.email.toLowerCase() === cleanStr || a.id.toLowerCase() === cleanStr
    );
    if (matchedAdmin) return matchedAdmin;

    // 2. Check Firebase users collection by email or ID
    if (db && isFirebaseConfigured) {
      try {
        // Check by ID
        const docByIdSnap = await withTimeout(getDoc(doc(db, 'users', cleanStr)), 2000, null as any);
        if (docByIdSnap && docByIdSnap.exists()) {
          const uData = docByIdSnap.data();
          if (!DEMO_EMAILS.includes((uData.email || '').toLowerCase())) {
            return {
              id: String(uData.id || docByIdSnap.id),
              name: uData.name || cleanStr.split('@')[0],
              email: uData.email || cleanStr,
              role: (uData.role as any) || 'employee',
            };
          }
        }

        // Check by email query
        const qEmail = query(collection(db, 'users'), where('email', '==', cleanStr));
        const emailSnap = await withTimeout(getDocs(qEmail), 2000, null as any);
        if (emailSnap && emailSnap.docs && emailSnap.docs.length > 0) {
          const uData = emailSnap.docs[0].data();
          if (!DEMO_EMAILS.includes((uData.email || '').toLowerCase())) {
            return {
              id: String(uData.id || emailSnap.docs[0].id),
              name: uData.name || cleanStr.split('@')[0],
              email: uData.email || cleanStr,
              role: (uData.role as any) || 'employee',
            };
          }
        }
      } catch {}

      // 3. Check Firebase live_locations collection
      try {
        const locDocSnap = await withTimeout(getDoc(doc(db, 'live_locations', cleanStr)), 2000, null as any);
        if (locDocSnap && locDocSnap.exists()) {
          const locData = locDocSnap.data();
          if (!DEMO_EMAILS.includes((locData.email || '').toLowerCase())) {
            return {
              id: String(locData.user_id || locDocSnap.id),
              name: locData.name || cleanStr.split('@')[0],
              email: locData.email || cleanStr,
              role: 'employee',
            };
          }
        }

        const qLocEmail = query(collection(db, 'live_locations'), where('email', '==', cleanStr));
        const locEmailSnap = await withTimeout(getDocs(qLocEmail), 2000, null as any);
        if (locEmailSnap && locEmailSnap.docs && locEmailSnap.docs.length > 0) {
          const locData = locEmailSnap.docs[0].data();
          if (!DEMO_EMAILS.includes((locData.email || '').toLowerCase())) {
            return {
              id: String(locData.user_id || locEmailSnap.docs[0].id),
              name: locData.name || cleanStr.split('@')[0],
              email: locData.email || cleanStr,
              role: 'employee',
            };
          }
        }
      } catch {}
    }

    // 4. Check local custom employees cache
    try {
      const raw = await AsyncStorage.getItem(CUSTOM_EMPLOYEES_KEY);
      if (raw) {
        const localList: User[] = JSON.parse(raw);
        const matched = localList.find(
          (u) => (u.email && u.email.toLowerCase() === cleanStr) || (u.id && u.id.toLowerCase() === cleanStr)
        );
        if (matched && !DEMO_EMAILS.includes((matched.email || '').toLowerCase())) {
          return matched;
        }
      }
    } catch {}

    // 5. If valid employee email format (contains @), synthesize employee profile so they are never blocked
    if (cleanStr.includes('@') && !DEMO_EMAILS.includes(cleanStr)) {
      const prefix = cleanStr.split('@')[0];
      const letters = prefix.replace(/[^a-zA-Z]/g, '');
      const displayName = letters ? (letters.charAt(0).toUpperCase() + letters.slice(1)) : (prefix.charAt(0).toUpperCase() + prefix.slice(1));
      const fallbackId = `emp_${cleanStr.replace(/[^a-zA-Z0-9]/g, '_')}`;

      // Upsert into Firebase asynchronously to persist across devices
      if (db && isFirebaseConfigured) {
        setDoc(
          doc(db, 'users', fallbackId),
          {
            id: fallbackId,
            name: displayName,
            email: cleanStr,
            role: 'employee',
          },
          { merge: true }
        ).catch(() => {});
      }

      return {
        id: fallbackId,
        name: displayName,
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

    // Save to Firebase `destinations` collection
    if (db && isFirebaseConfigured) {
      try {
        await setDoc(doc(db, 'destinations', newDest.id), {
          id: newDest.id,
          admin_id: String(param.adminId),
          employee_id: String(param.employeeId),
          address: param.address,
          latitude: param.latitude,
          longitude: param.longitude,
          status: 'pending',
          created_at: newDest.created_at,
          updated_at: newDest.created_at,
        });
      } catch (e) {
        console.warn('[TrackingDataService] Could not insert destination to Firebase:', e);
      }
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
    // 1. Firebase update
    if (db && isFirebaseConfigured) {
      try {
        await updateDoc(doc(db, 'destinations', destinationId), {
          address: param.address,
          latitude: param.latitude,
          longitude: param.longitude,
          updated_at: new Date().toISOString(),
        });
      } catch (e) {
        console.warn('[TrackingDataService] Could not update destination in Firebase:', e);
      }
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
    // 1. Firebase delete
    if (db && isFirebaseConfigured) {
      try {
        await deleteDoc(doc(db, 'destinations', destinationId));
      } catch (e) {
        console.warn('[TrackingDataService] Could not delete destination from Firebase:', e);
      }
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

      // Combine with Firebase (with 2s timeout)
      if (db && isFirebaseConfigured) {
        try {
          const snap = await withTimeout(
            getDocs(query(collection(db, 'destinations'), orderBy('created_at', 'desc'))),
            2000,
            null as any
          );

          if (snap && snap.docs && snap.docs.length > 0) {
            const remoteList: AssignedDestination[] = snap.docs.map((docSnap: any) => {
              const d = docSnap.data();
              return {
                id: String(d.id || docSnap.id),
                admin_id: d.admin_id ? String(d.admin_id) : 'admin_1',
                employee_id: d.employee_id ? String(d.employee_id) : 'emp_1',
                address: d.address || '',
                latitude: Number(d.latitude),
                longitude: Number(d.longitude),
                status: d.status || 'pending',
                created_at: d.created_at || new Date().toISOString(),
                completed_at: d.completed_at || d.updated_at || undefined,
                updated_at: d.updated_at || undefined,
              };
            });

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
      }

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
    // 1. Firebase update
    if (db && isFirebaseConfigured) {
      try {
        if (destinationId) {
          const updatePayload: any = {
            status,
            ...(status === 'completed' ? { completed_at: nowIso } : {}),
            updated_at: nowIso,
          };
          updateDoc(doc(db, 'destinations', destinationId), updatePayload).catch(async () => {
            const q = query(collection(db!, 'destinations'), where('employee_id', '==', destinationId));
            const snap = await getDocs(q);
            snap.forEach((docSnap) => {
              updateDoc(docSnap.ref, updatePayload).catch(() => {});
            });
          });
        }
      } catch (e) {}
    }

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
    name?: string;
    email?: string;
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
      const empName = location.name || existingLoc?.name;
      const empEmail = location.email || existingLoc?.email;

      locMap[location.userId] = {
        user_id: location.userId,
        name: empName,
        email: empEmail,
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

      // 2. Sync to Render Telemetry server via REST (Immediate, resilient)
      try {
        const backendUrl = process.env.EXPO_PUBLIC_BACKEND_URL || 'https://styrka-app.onrender.com';
        fetch(`${backendUrl}/api/location/upload`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${location.userId}`,
          },
          body: JSON.stringify({
            locations: [{
              userId: location.userId,
              employee_id: location.userId,
              email: empEmail,
              name: empName,
              latitude: Number(finalLat),
              longitude: Number(finalLng),
              heading: Number(location.heading || existingLoc?.heading || 0),
              speed: Number(location.speed || 0),
              status: location.status || 'online',
              destination_lat: destLat != null ? Number(destLat) : undefined,
              destination_lng: destLng != null ? Number(destLng) : undefined,
              destination_address: destAddress || undefined,
              timestamp,
            }],
          }),
        }).catch(() => {});
      } catch (e) {}

      // 3. Non-blocking asynchronous sync to Firebase live_locations (fast 2s timeout)
      if (db && isFirebaseConfigured) {
        withTimeout(
          setDoc(
            doc(db, 'live_locations', String(location.userId)),
            {
              user_id: String(location.userId),
              name: empName,
              email: empEmail,
              latitude: Number(finalLat),
              longitude: Number(finalLng),
              heading: Number(location.heading || existingLoc?.heading || 0),
              speed: Number(location.speed || 0),
              status: location.status || 'online',
              destination_lat: destLat != null ? Number(destLat) : null,
              destination_lng: destLng != null ? Number(destLng) : null,
              destination_address: destAddress || null,
              updated_at: timestamp,
            },
            { merge: true }
          ),
          2000
        ).catch(() => {});
      }
    } catch (e) {
      console.error('[TrackingDataService] Error updating live location', e);
    }
  }

  // Get live location for employee
  static async getLiveLocation(userId: string): Promise<LiveLocation | null> {
    if (db && isFirebaseConfigured) {
      try {
        const snap = await withTimeout(
          getDoc(doc(db, 'live_locations', userId)),
          2000,
          null as any
        );

        if (snap && snap.exists()) {
          const data = snap.data();
          return {
            user_id: String(data.user_id || snap.id),
            name: data.name || undefined,
            email: data.email || undefined,
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
    }

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

    // 1. Fetch active locations from Render Telemetry server (Primary, fast)
    try {
      const backendUrl = process.env.EXPO_PUBLIC_BACKEND_URL || 'https://styrka-app.onrender.com';
      const res = await withTimeout(fetch(`${backendUrl}/api/location/active`), 2500);

      if (res && res.ok) {
        const activeList = await res.json();
        if (Array.isArray(activeList)) {
          activeList.forEach((item: any) => {
            if (item && item.latitude != null) {
              const locObj: LiveLocation = {
                user_id: String(item.user_id || item.employee_id),
                name: item.name || undefined,
                email: item.email || undefined,
                latitude: Number(item.latitude),
                longitude: Number(item.longitude),
                heading: Number(item.heading || 0),
                speed: Number(item.speed || 0),
                status: item.status || 'online',
                timestamp: item.timestamp || new Date().toISOString(),
                updated_at: item.timestamp || new Date().toISOString(),
                destination_lat: item.destination_lat != null ? Number(item.destination_lat) : null,
                destination_lng: item.destination_lng != null ? Number(item.destination_lng) : null,
                destination_address: item.destination_address || null,
              };

              const keyPrimary = String(item.user_id || item.employee_id);
              resultMap[keyPrimary] = locObj;
              if (item.email) resultMap[String(item.email)] = locObj;
              if (item.name) resultMap[String(item.name)] = locObj;
            }
          });
        }
      }
    } catch (e) {
      console.log('[TrackingDataService] Render live locations fetch fallback:', e);
    }

    // 2. Fetch live locations from Firebase with 2s timeout
    if (db && isFirebaseConfigured) {
      try {
        const snap = await withTimeout(
          getDocs(collection(db, 'live_locations')),
          2000,
          null as any
        );
        if (snap && snap.docs && snap.docs.length > 0) {
          snap.docs.forEach((docSnap: any) => {
            const item = docSnap.data();
            const locObj: LiveLocation = {
              user_id: String(item.user_id || docSnap.id),
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

            const keyPrimary = String(item.user_id || docSnap.id);
            if (!resultMap[keyPrimary]) resultMap[keyPrimary] = locObj;
            if (item.email && !resultMap[String(item.email)]) resultMap[String(item.email)] = locObj;
            if (item.name && !resultMap[String(item.name)]) resultMap[String(item.name)] = locObj;
          });
        }
      } catch (e) {
        console.warn('[TrackingDataService] Firebase live_locations warning:', e);
      }
    }

    // 3. Merge with local storage cache
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
