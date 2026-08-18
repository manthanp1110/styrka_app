import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, StyleSheet, ScrollView, TextInput, Alert, Image } from 'react-native';

import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather, MaterialIcons } from '@expo/vector-icons';

import { useNavigation, NavigationProp } from '@react-navigation/native';

import { useAppState } from '../store/useAppState';

import { TrackingDataService } from '../services/TrackingDataService';
import SocketService from '../services/SocketService';

import { MapView, Marker, Callout, Polyline } from '../components/NativeMap';

import { decodePolyline, getDistanceFromLatLonInKm } from '../utils/mapsUtils';
import { useSmoothLocation } from '../hooks/useSmoothLocation';
import MapplsApi from '../utils/mapplsApi';


const AnimatedVehicleMarker = ({ latestLocation, selectedEmp }: any) => {
  const empName = selectedEmp?.name || selectedEmp?.first_name || 'Employee';
  const isOffline = latestLocation.status === 'offline';
  
  const animatedLoc = useSmoothLocation(
    Number(latestLocation.latitude),
    Number(latestLocation.longitude),
    Number(latestLocation.heading || 0),
    2000
  );

  return (
    <Marker
      coordinate={{
        latitude: animatedLoc.latitude,
        longitude: animatedLoc.longitude,
      }}
      anchor={{ x: 0.5, y: 0.5 }}
      style={{ zIndex: 2 }}
    >
      <View style={{ alignItems: 'center' }}>
        {/* Rider Name Tag */}
        <View style={{ backgroundColor: '#0F4C3A', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10, marginBottom: 3, flexDirection: 'row', alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25, elevation: 4 }}>
          <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: isOffline ? '#9CA3AF' : '#10B981', marginRight: 5 }} />
          <Text style={{ color: 'white', fontWeight: 'bold', fontSize: 11 }}>{empName}</Text>
        </View>
        
        {/* Pulsing Blue Dot Rider Pointer */}
        <View style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: 'rgba(59, 130, 246, 0.25)', alignItems: 'center', justifyContent: 'center' }}>
          <View style={{ width: 20, height: 20, borderRadius: 10, backgroundColor: '#2563EB', borderWidth: 3, borderColor: 'white', alignItems: 'center', justifyContent: 'center', shadowColor: '#1D4ED8', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.4, shadowRadius: 3, elevation: 6 }}>
            <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: 'white' }} />
          </View>
        </View>
      </View>
    </Marker>
  );
};

const AdminTrackingScreen = () => {
  const { user } = useAppState();
  const navigation = useNavigation<NavigationProp<any>>();
  const mapRef = useRef<any>(null);
  
  const [employees, setEmployees] = useState<any[]>([]);
  const [dailyAttendance, setDailyAttendance] = useState<Record<string, any>>({});
  const [activeJourneys, setActiveJourneys] = useState<Record<string, any>>({});
  
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [followMode, setFollowMode] = useState(true);
  const [showHistory, setShowHistory] = useState(false);
  const [mapRegion, setMapRegion] = useState<any>(null);
  
  // selectedEmployeeId === null -> show List
  // selectedEmployeeId !== null -> show Map for this employee
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string | null>(null);
  const [currentRouteCoords, setCurrentRouteCoords] = useState<any[]>([]);
  const [routeDistance, setRouteDistance] = useState<number | null>(null);
  const [routeDuration, setRouteDuration] = useState<number | null>(null);
  const [currentLocationAddress, setCurrentLocationAddress] = useState<string>('');
  const lastRouteFetchRef = useRef<number>(0);
  const routeFetchingRef = useRef<boolean>(false);



  const employeesRef = useRef<any[]>(employees);
  useEffect(() => {
    employeesRef.current = employees;
  }, [employees]);

  // Clear route when switching employees
  useEffect(() => {
    setCurrentRouteCoords([]);
    setRouteDistance(null);
    setRouteDuration(null);
    lastRouteFetchRef.current = 0;
  }, [selectedEmployeeId]);



  // Helper: Resolve journey using emp.id -> emp.email -> live_locations.user_id -> fuzzy match
  const resolveEmployeeJourney = (emp: any, journeysMap: Record<string, any>, isSelectedMapContext: boolean = false) => {
    if (!emp) return null;

    const candidateJourneys: any[] = [];
    const empId = String(emp.id || '').toLowerCase();
    const empEmail = String(emp.email || '').toLowerCase();
    const emailPrefix = empEmail.split('@')[0];
    const empName = String(emp.name || emp.first_name || '').toLowerCase();

    Object.keys(journeysMap).forEach((key) => {
      const j = journeysMap[key];
      if (!j) return;

      const jUserId = String(j.user_id || key || '').toLowerCase();
      const jEmpId = String(j.employee_id || '').toLowerCase();
      const jEmail = String(j.email || j.latestLocation?.email || '').toLowerCase();
      const jName = String(j.name || j.latestLocation?.name || '').toLowerCase();
      const locUserId = String(j.latestLocation?.user_id || '').toLowerCase();

      const isMatch =
        (empId && (jUserId === empId || jEmpId === empId || locUserId === empId)) ||
        (empEmail && (jEmail === empEmail || jUserId === empEmail || locUserId === empEmail)) ||
        (emailPrefix && emailPrefix.length > 2 && (jUserId === emailPrefix || locUserId === emailPrefix || jEmail === emailPrefix || jEmpId === emailPrefix));

      if (isMatch && !candidateJourneys.includes(j)) {
        candidateJourneys.push(j);
      }
    });

    if (candidateJourneys.length === 0) {
      return null;
    }

    candidateJourneys.sort((a, b) => {
      const tA = new Date(a.latestLocation?.timestamp || a.updated_at || a.created_at || 0).getTime();
      const tB = new Date(b.latestLocation?.timestamp || b.updated_at || b.created_at || 0).getTime();
      return tB - tA;
    });

    const base = { ...candidateJourneys[0] };
    for (const c of candidateJourneys) {
      if (c.status === 'in_progress' || c.status === 'started') base.status = c.status;
      if (!base.latestLocation && c.latestLocation) {
        base.latestLocation = c.latestLocation;
      } else if (base.latestLocation && c.latestLocation) {
        const baseTime = new Date(base.latestLocation.timestamp || 0).getTime();
        const cTime = new Date(c.latestLocation.timestamp || 0).getTime();
        if (cTime > baseTime) {
          base.latestLocation = c.latestLocation;
        }
      }
      if (!base.destination_lat && c.destination_lat) {
        base.destination_lat = c.destination_lat;
        base.destination_lng = c.destination_lng;
        base.address = c.address;
      }
    }

    if (base.latestLocation && base.latestLocation.latitude != null) {
      base.start_lat = Number(base.latestLocation.latitude);
      base.start_lng = Number(base.latestLocation.longitude);
    }
    return base;
  };

  const fetchTrackingData = async () => {
    setIsRefreshing(true);
    try {
      const usersData = await TrackingDataService.getEmployees();
      const allLocations = await TrackingDataService.getAllLiveLocations();
      const allDestinations = await TrackingDataService.getAllDestinations();

      const fetchedEmployees = usersData || [];

      setEmployees((prevEmps) => {
        const mergedMap = new Map<string, any>();
        const seenPrefixes = new Set<string>();

        fetchedEmployees.forEach((e) => {
          const emailPrefix = (e.email || '').split('@')[0].replace(/^emp_/, '').replace(/_styrka_com$/, '').replace(/[^a-z0-9]/g, '').toLowerCase();
          if (emailPrefix && emailPrefix.length > 2) seenPrefixes.add(emailPrefix);
          mergedMap.set(e.id, e);
        });

        (prevEmps || []).forEach((e) => {
          const emailPrefix = (e.email || '').split('@')[0].replace(/^emp_/, '').replace(/_styrka_com$/, '').replace(/[^a-z0-9]/g, '').toLowerCase();
          if (emailPrefix && emailPrefix.length > 2 && seenPrefixes.has(emailPrefix)) return;
          if (!mergedMap.has(e.id)) {
            if (emailPrefix) seenPrefixes.add(emailPrefix);
            mergedMap.set(e.id, e);
          }
        });

        // Synthesize any active employees from live location records
        Object.keys(allLocations || {}).forEach((key) => {
          const loc = allLocations[key];
          if (loc && loc.latitude != null) {
            const locId = loc.user_id || key;
            const locEmail = loc.email || (locId.includes('@') ? locId : '');
            const emailPrefix = locEmail 
              ? locEmail.split('@')[0].replace(/^emp_/, '').replace(/_styrka_com$/, '').replace(/[^a-z0-9]/g, '').toLowerCase() 
              : locId.replace(/^emp_/, '').replace(/_styrka_com$/, '').replace(/[^a-z0-9]/g, '').toLowerCase();

            if (emailPrefix && emailPrefix.length > 2 && seenPrefixes.has(emailPrefix)) return;

            const existingMatch = Array.from(mergedMap.values()).find(
              (e: any) => e.id === locId || e.email === locId || (e.email && locId.includes(e.email))
            );
            if (!existingMatch) {
              const rawName = loc.name || (locId.includes('@') ? locId.split('@')[0] : locId);
              const formattedName = rawName.charAt(0).toUpperCase() + rawName.slice(1);
              if (emailPrefix) seenPrefixes.add(emailPrefix);
              mergedMap.set(locId, {
                id: locId,
                name: formattedName,
                email: locId.includes('@') ? locId : `${locId}@styrka.com`,
                role: 'employee',
              });
            }
          }
        });

        return Array.from(mergedMap.values());
      });

      setActiveJourneys((prev) => {
        const nextMap: Record<string, any> = { ...prev };

        for (const emp of usersData || []) {
          const loc = allLocations[emp.id]
            || (emp.email ? allLocations[emp.email] : null)
            || Object.values(allLocations).find((l: any) => 
                 l.user_id === emp.id || 
                 (emp.email && l.user_id === emp.email) ||
                 (l.user_id && (
                   l.user_id.toLowerCase() === (emp.id || '').toLowerCase() ||
                   l.user_id.toLowerCase() === (emp.email || '').toLowerCase() ||
                   (emp.name && l.user_id.toLowerCase().includes(emp.name.toLowerCase()))
                 ))
               );

          // Get employee destinations sorted descending by latest timestamp using strict exact matching
          const empIdStr = (emp.id || '').trim().toLowerCase();
          const empEmailStr = (emp.email || '').trim().toLowerCase();
          const emailPrefix = empEmailStr ? empEmailStr.split('@')[0] : '';
          const empNameStr = (emp.name || (emp as any).first_name || '').trim().toLowerCase();

          const empDests = allDestinations.filter((d) => {
            const destEmpId = (d.employee_id || '').trim().toLowerCase();
            if (!destEmpId) return false;

            if (empIdStr && destEmpId === empIdStr) return true;
            if (empEmailStr && destEmpId === empEmailStr) return true;
            if (emailPrefix && emailPrefix.length > 2 && destEmpId === emailPrefix) return true;
            if (empNameStr && empNameStr.length > 3 && destEmpId === empNameStr) return true;
            return false;
          });

          empDests.sort((a, b) => new Date(b.updated_at || b.completed_at || b.created_at).getTime() - new Date(a.updated_at || a.completed_at || a.created_at).getTime());
          const dest = empDests[0];

          const existingJourney = prev[emp.id] 
            || (emp.email ? prev[emp.email] : null) 
            || (emp.name ? prev[emp.name] : null);

          const existingTime = existingJourney?.latestLocation?.timestamp
            ? new Date(existingJourney.latestLocation.timestamp).getTime()
            : 0;
          const fetchedTime = loc?.timestamp ? new Date(loc.timestamp).getTime() : 0;

          // Preserve newer live Socket.IO ping if available in state
          let latestPing = existingJourney?.latestLocation || null;
          if (loc && loc.latitude != null && Number(loc.latitude) !== 0) {
            if (!latestPing || fetchedTime >= existingTime) {
              latestPing = {
                user_id: loc.user_id || emp.id,
                latitude: Number(loc.latitude),
                longitude: Number(loc.longitude),
                heading: Number(loc.heading || 0),
                speed: Number(loc.speed || 0),
                status: loc.status || 'online',
                timestamp: loc.timestamp || new Date().toISOString(),
              };
            }
          }

          // Prioritize ACTIVE live journey destination from Socket ping / live_locations over static fallback table
          const destLat = (existingJourney?.destination_lat != null && Number(existingJourney.destination_lat) !== 0)
            ? Number(existingJourney.destination_lat)
            : ((loc?.destination_lat != null && Number(loc.destination_lat) !== 0)
            ? Number(loc.destination_lat)
            : (dest ? Number(dest.latitude) : null));

          const destLng = (existingJourney?.destination_lng != null && Number(existingJourney.destination_lng) !== 0)
            ? Number(existingJourney.destination_lng)
            : ((loc?.destination_lng != null && Number(loc.destination_lng) !== 0)
            ? Number(loc.destination_lng)
            : (dest ? Number(dest.longitude) : null));

          const destAddress = (existingJourney?.address && existingJourney.address !== 'Custom destination')
            ? existingJourney.address
            : ((loc as any)?.destination_address
            ? (loc as any).destination_address
            : (dest?.address || existingJourney?.address || 'Custom destination'));

          if (loc || dest || existingJourney) {
            const startLat = latestPing?.latitude != null 
              ? Number(latestPing.latitude) 
              : (existingJourney?.start_lat != null ? Number(existingJourney.start_lat) : (destLat || 28.6139));
            const startLng = latestPing?.longitude != null 
              ? Number(latestPing.longitude) 
              : (existingJourney?.start_lng != null ? Number(existingJourney.start_lng) : (destLng || 77.2090));

            const resolvedStatus = (dest?.status === 'completed' || existingJourney?.status === 'completed')
              ? 'completed'
              : ((dest?.status === 'in_progress' || (dest?.status as any) === 'started' || existingJourney?.status === 'in_progress')
                ? 'in_progress'
                : 'offline');

            const journeyObj = {
              ...(existingJourney || {}),
              id: existingJourney?.id || `j_${emp.id}`,
              user_id: emp.id,
              start_lat: startLat,
              start_lng: startLng,
              destination_lat: destLat,
              destination_lng: destLng,
              locationHistory: existingJourney?.locationHistory || (latestPing ? [latestPing] : []),
              latestLocation: latestPing,
              address: destAddress,
              status: resolvedStatus,
            };

            nextMap[emp.id] = journeyObj;
            if (emp.email) nextMap[emp.email] = journeyObj;
            if (emp.name) nextMap[emp.name] = journeyObj;
          }
        }

        return nextMap;
      });
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchTrackingData();

    SocketService.connect(user.id || 'admin_1', 'admin');
    // Explicitly request active employees from Render Socket server
    SocketService.emit('get_active_employees', {});

    const handleLocationChange = (loc: any) => {
      const incomingId = loc?.employee_id || loc?.user_id;
      if (loc && incomingId) {
        console.log('[ADMIN LOCATION] received:', {
          employeeId: incomingId,
          userId: loc.user_id,
          email: loc.email,
          name: loc.name,
          latitude: loc.latitude,
          longitude: loc.longitude,
          timestamp: loc.timestamp
        });

        // Resolve incoming employee_id to matched employee in state using ref
        const currentEmployees = employeesRef.current || [];
        const matched = currentEmployees.find(
          (e) => e.id === incomingId || 
                 (e.email && e.email.toLowerCase() === String(incomingId).toLowerCase()) || 
                 (loc.email && e.email && e.email.toLowerCase() === String(loc.email).toLowerCase()) ||
                 (loc.name && e.name && e.name.toLowerCase() === String(loc.name).toLowerCase())
        );
        const primaryEmpId = matched ? matched.id : incomingId;
        const empEmail = matched?.email || loc.email;

        console.log('[ADMIN LOCATION] employee matched:', { primaryEmpId, matchedName: matched?.name || 'none' });

        setActiveJourneys((prev) => {
          const currentJourney = prev[primaryEmpId] || (empEmail ? prev[empEmail] : null) || prev[incomingId];

          const incomingTimestamp = loc.timestamp || new Date().toISOString();
          const incomingTime = new Date(incomingTimestamp).getTime();
          const existingTime = currentJourney?.latestLocation?.timestamp
            ? new Date(currentJourney.latestLocation.timestamp).getTime()
            : 0;

          // Ignore out-of-order stale location broadcasts
          if (existingTime > 0 && incomingTime < existingTime) {
            console.warn(`[Socket.IO AUDIT] Discarded out-of-order ping for ${primaryEmpId}: incoming ${incomingTime} < existing ${existingTime}`);
            return prev;
          }

          const updatedPing = {
            user_id: primaryEmpId,
            latitude: Number(loc.latitude),
            longitude: Number(loc.longitude),
            heading: Number(loc.heading || 0),
            speed: Number(loc.speed || 0),
            status: loc.status || 'online',
            timestamp: incomingTimestamp,
          };

          console.log('[ADMIN LOCATION] latestLocation updated:', updatedPing);

          // Pick up destination data from Socket.IO pings (for custom journeys)
          const incomingDestLat = loc.destination_lat != null ? Number(loc.destination_lat) : null;
          const incomingDestLng = loc.destination_lng != null ? Number(loc.destination_lng) : null;
          const incomingDestAddr = loc.destination_address || null;

          const updatedJourney = {
            ...(currentJourney || {
              id: `j_${primaryEmpId}`,
              user_id: primaryEmpId,
              start_lat: Number(loc.latitude),
              start_lng: Number(loc.longitude),
            }),
            status: currentJourney?.status === 'completed' ? 'completed' : (currentJourney?.status || 'in_progress'),
            ...(incomingDestLat != null ? { destination_lat: incomingDestLat } : {}),
            ...(incomingDestLng != null ? { destination_lng: incomingDestLng } : {}),
            ...(incomingDestAddr != null ? { address: incomingDestAddr } : {}),
            latestLocation: updatedPing,
            locationHistory: currentJourney?.locationHistory
              ? [...currentJourney.locationHistory, updatedPing]
              : [updatedPing],
          };

          const nextMap: Record<string, any> = {
            ...prev,
            [primaryEmpId]: updatedJourney,
          };
          if (empEmail) nextMap[empEmail] = updatedJourney;
          if (incomingId) nextMap[incomingId] = updatedJourney;
          return nextMap;
        });
      }
    };

    const handleDestinationAssigned = (data: any) => {
      console.log('[ADMIN DESTINATION] received:', data);
      if (data && (data.latitude != null || data.address)) {
        const targetEmpId = data.employee_id || data.user_id;
        const targetEmail = data.email;
        const targetName = data.name;
        const destLat = data.latitude != null ? Number(data.latitude) : null;
        const destLng = data.longitude != null ? Number(data.longitude) : null;
        const destAddr = data.address || null;

        setActiveJourneys((prev) => {
          const nextMap: Record<string, any> = { ...prev };
          Object.keys(nextMap).forEach((key) => {
            if (
              !targetEmpId ||
              key === targetEmpId ||
              (targetEmail && key === targetEmail) ||
              (targetName && key === targetName) ||
              key.toLowerCase().includes(String(targetEmpId).toLowerCase())
            ) {
              nextMap[key] = {
                ...nextMap[key],
                destination_lat: destLat ?? nextMap[key]?.destination_lat,
                destination_lng: destLng ?? nextMap[key]?.destination_lng,
                address: destAddr || nextMap[key]?.address,
                status: 'in_progress',
              };
            }
          });

          if (targetEmpId) {
            nextMap[targetEmpId] = {
              ...(nextMap[targetEmpId] || {}),
              id: `j_${targetEmpId}`,
              user_id: targetEmpId,
              destination_lat: destLat,
              destination_lng: destLng,
              address: destAddr,
              status: 'in_progress',
            };
          }
          if (targetEmail) {
            nextMap[targetEmail] = {
              ...(nextMap[targetEmail] || {}),
              id: `j_${targetEmpId || targetEmail}`,
              user_id: targetEmpId || targetEmail,
              destination_lat: destLat,
              destination_lng: destLng,
              address: destAddr,
              status: 'in_progress',
            };
          }
          return nextMap;
        });
      }
      fetchTrackingData();
    };

    const handleJourneyStatusChanged = (data: any) => {
      console.log('[ADMIN JOURNEY STATUS] received:', data);
      if (data && data.status) {
        const targetEmpId = data.user_id || data.employee_id;
        const targetEmail = data.email;
        const targetName = data.name;

        setActiveJourneys((prev) => {
          const nextMap: Record<string, any> = { ...prev };
          Object.keys(nextMap).forEach((key) => {
            if (
              !targetEmpId ||
              key === targetEmpId ||
              (targetEmail && key === targetEmail) ||
              (targetName && key === targetName) ||
              key.toLowerCase().includes(String(targetEmpId).toLowerCase())
            ) {
              nextMap[key] = {
                ...nextMap[key],
                status: data.status,
                latestLocation: nextMap[key]?.latestLocation ? {
                  ...nextMap[key].latestLocation,
                  status: data.status === 'completed' ? 'offline' : nextMap[key].latestLocation.status,
                } : null,
              };
            }
          });

          if (targetEmpId) {
            nextMap[targetEmpId] = {
              ...(nextMap[targetEmpId] || {}),
              user_id: targetEmpId,
              status: data.status,
            };
          }
          if (targetEmail) {
            nextMap[targetEmail] = {
              ...(nextMap[targetEmail] || {}),
              user_id: targetEmpId || targetEmail,
              status: data.status,
            };
          }
          return nextMap;
        });
      }
      fetchTrackingData();
    };

    SocketService.on('employee_location_changed', handleLocationChange);
    SocketService.on('destination_assigned', handleDestinationAssigned);
    SocketService.on('journey_status_changed', handleJourneyStatusChanged);

    const interval = setInterval(() => {
      fetchTrackingData();
    }, 4000);

    return () => {
      clearInterval(interval);
      SocketService.off('employee_location_changed', handleLocationChange);
      SocketService.off('destination_assigned', handleDestinationAssigned);
      SocketService.off('journey_status_changed', handleJourneyStatusChanged);
    };
  }, []);

  const getEmployeeStatus = (empId: string) => {
    const emp = employees.find(e => e.id === empId || e.email === empId);
    const journey = emp ? resolveEmployeeJourney(emp, activeJourneys, false) : (activeJourneys[empId]?.latestLocation ? activeJourneys[empId] : null);

    if (journey) {
      if (journey.status === 'completed') {
        return { label: 'Journey Completed', color: '#3B82F6', canTrack: true, isOffline: true };
      }

      if (journey.status === 'in_progress' || journey.status === 'started') {
        return { label: 'Journey Started / On Route', color: '#10B981', canTrack: true, isOffline: false };
      }

      return { label: 'Offline', color: '#6B7280', canTrack: false, isOffline: true };
    }
    
    return { label: 'Offline', color: '#6B7280', canTrack: false, isOffline: true };
  };

  const filteredEmployees = employees.filter(emp => {
    const role = (emp.role || '').toLowerCase();
    const idStr = String(emp.id || '').toLowerCase();
    const emailStr = String(emp.email || '').toLowerCase();
    const nameStr = String(emp.name || emp.first_name || '').toLowerCase();

    const isAdmin =
      role === 'admin' ||
      idStr.includes('admin') ||
      emailStr.includes('admin') ||
      nameStr.startsWith('admin');

    if (isAdmin) return false;
    return nameStr.includes(searchQuery.trim().toLowerCase());
  });

  const handleEmployeePress = (empId: string) => {
    setSelectedEmployeeId(empId);
  };

  const selectedEmp = selectedEmployeeId ? employees.find(e => e.id === selectedEmployeeId || e.email === selectedEmployeeId) : null;
  const resolvedJourney = selectedEmp ? resolveEmployeeJourney(selectedEmp, activeJourneys, false) : (selectedEmployeeId ? activeJourneys[selectedEmployeeId] : null);

  const selectedJourney = resolvedJourney || (selectedEmp ? {
    id: `j_${selectedEmp.id}`,
    user_id: selectedEmp.id,
    start_lat: 18.5204,
    start_lng: 73.8567,
    destination_lat: null,
    destination_lng: null,
    latestLocation: null,
    locationHistory: [],
    address: null,
  } : null);

  // Compute live polyline that ALWAYS starts at the exact live employee location and connects to destination
  const displayedPolyline = React.useMemo(() => {
    const liveLat = selectedJourney?.latestLocation?.latitude != null
      ? Number(selectedJourney.latestLocation.latitude)
      : (selectedJourney?.start_lat != null ? Number(selectedJourney.start_lat) : null);
    const liveLng = selectedJourney?.latestLocation?.longitude != null
      ? Number(selectedJourney.latestLocation.longitude)
      : (selectedJourney?.start_lng != null ? Number(selectedJourney.start_lng) : null);

    if (liveLat == null || liveLng == null || isNaN(liveLat) || isNaN(liveLng)) {
      return currentRouteCoords;
    }

    const livePt = { latitude: liveLat, longitude: liveLng };

    if (currentRouteCoords.length > 1) {
      return [livePt, ...currentRouteCoords.slice(1)];
    }

    if (selectedJourney?.destination_lat != null && selectedJourney?.destination_lng != null) {
      return [
        livePt,
        {
          latitude: Number(selectedJourney.destination_lat),
          longitude: Number(selectedJourney.destination_lng),
        },
      ];
    }

    return [livePt];
  }, [
    selectedJourney?.latestLocation?.latitude,
    selectedJourney?.latestLocation?.longitude,
    selectedJourney?.start_lat,
    selectedJourney?.start_lng,
    selectedJourney?.destination_lat,
    selectedJourney?.destination_lng,
    currentRouteCoords,
  ]);

  useEffect(() => {
    if (selectedJourney && selectedJourney.destination_lat != null && selectedJourney.destination_lng != null) {
      const originLat = selectedJourney.latestLocation?.latitude != null
        ? Number(selectedJourney.latestLocation.latitude)
        : Number(selectedJourney.start_lat);
      const originLng = selectedJourney.latestLocation?.longitude != null
        ? Number(selectedJourney.latestLocation.longitude)
        : Number(selectedJourney.start_lng);
      const destLat = Number(selectedJourney.destination_lat);
      const destLng = Number(selectedJourney.destination_lng);

      if (!originLat || !originLng || !destLat || !destLng || isNaN(originLat) || isNaN(originLng) || isNaN(destLat) || isNaN(destLng)) return;

      const now = Date.now();
      if (now - lastRouteFetchRef.current < 10000 && currentRouteCoords.length > 0) return;
      if (routeFetchingRef.current) return;

      routeFetchingRef.current = true;
      lastRouteFetchRef.current = now;

      (async () => {
        try {
          const res = await MapplsApi.direction({
            origin: `${originLng},${originLat}`,
            destination: `${destLng},${destLat}`,
            profile: 'driving',
            overview: 'full',
            geometries: 'polyline'
          });

          if (res?.routes?.length > 0 && res.routes[0].geometry) {
            const decodedCoords = decodePolyline(res.routes[0].geometry);
            setCurrentRouteCoords(decodedCoords);
            setRouteDistance(res.routes[0].distance ? res.routes[0].distance / 1000 : null);
            setRouteDuration(res.routes[0].duration ? res.routes[0].duration / 60 : null);
          } else {
            setCurrentRouteCoords([
              { latitude: originLat, longitude: originLng },
              { latitude: destLat, longitude: destLng },
            ]);
            setRouteDistance(getDistanceFromLatLonInKm(originLat, originLng, destLat, destLng));
            setRouteDuration(null);
          }
        } catch (e) {
          console.log('Mappls routing error', e);
          setCurrentRouteCoords([
            { latitude: originLat, longitude: originLng },
            { latitude: destLat, longitude: destLng },
          ]);
        } finally {
          routeFetchingRef.current = false;
        }
      })();
    }
  }, [
    selectedEmployeeId,
    selectedJourney?.latestLocation?.latitude,
    selectedJourney?.latestLocation?.longitude,
    selectedJourney?.destination_lat,
    selectedJourney?.destination_lng,
  ]);

  useEffect(() => {
    let isMounted = true;
    const fetchCurrentAddress = async () => {
      const lat = selectedJourney?.latestLocation?.latitude != null 
        ? Number(selectedJourney.latestLocation.latitude) 
        : (selectedJourney?.start_lat != null ? Number(selectedJourney.start_lat) : null);
      const lng = selectedJourney?.latestLocation?.longitude != null 
        ? Number(selectedJourney.latestLocation.longitude) 
        : (selectedJourney?.start_lng != null ? Number(selectedJourney.start_lng) : null);

      if (lat != null && lng != null && !isNaN(lat) && !isNaN(lng)) {
        console.log('[ADDRESS DEBUG] reverse geocoding:', { latitude: lat, longitude: lng });
        try {
          const res = await MapplsApi.reverseGeocode({ latitude: lat, longitude: lng });
          if (isMounted && res && res.results && res.results.length > 0 && res.results[0].formatted_address) {
            console.log('[ADDRESS DEBUG] address resolved:', res.results[0].formatted_address);
            setCurrentLocationAddress(res.results[0].formatted_address);
            return;
          }
        } catch (e: any) {
          console.log('[ADDRESS DEBUG] reverse geocoding failed:', e?.message || e);
        }
        if (isMounted) {
          setCurrentLocationAddress(`${lat.toFixed(4)}°N, ${lng.toFixed(4)}°E`);
        }
      }
    };

    fetchCurrentAddress();
    return () => { isMounted = false; };
  }, [
    selectedJourney?.latestLocation?.latitude, 
    selectedJourney?.latestLocation?.longitude,
    selectedJourney?.start_lat,
    selectedJourney?.start_lng
  ]);

  if (selectedEmp) {
    console.log(`[ADMIN_MATCH] employee.id = ${selectedEmp.id}`);
    console.log(`[ADMIN_MATCH] employee.email = ${selectedEmp.email}`);
    console.log(`[ADMIN_MATCH] location.user_id = ${selectedJourney?.latestLocation?.user_id || selectedJourney?.user_id}`);
    console.log(`[ADMIN_MATCH] resolvedJourneyKey = ${selectedJourney ? 'MATCHED' : 'NULL'}`);
    console.log(`[ADMIN_MATCH] latestLocation =`, selectedJourney?.latestLocation);
  }

  const initialRegion = {
    latitude: 18.5204, // Default
    longitude: 73.8567,
    latitudeDelta: 0.05,
    longitudeDelta: 0.05,
  };

  if (selectedJourney && selectedJourney.latestLocation && selectedJourney.latestLocation.latitude != null) {
    initialRegion.latitude = Number(selectedJourney.latestLocation.latitude);
    initialRegion.longitude = Number(selectedJourney.latestLocation.longitude);
  }

  useEffect(() => {
    if (followMode && mapRef.current && selectedJourney?.latestLocation && mapRegion) {
      const lat = Number(selectedJourney.latestLocation.latitude);
      const lng = Number(selectedJourney.latestLocation.longitude);
      if (!isNaN(lat) && !isNaN(lng)) {
        // Calculate safe viewport margins (80% box from center)
        const margin = 0.8;
        const latMin = mapRegion.latitude - (mapRegion.latitudeDelta / 2) * margin;
        const latMax = mapRegion.latitude + (mapRegion.latitudeDelta / 2) * margin;
        const lngMin = mapRegion.longitude - (mapRegion.longitudeDelta / 2) * margin;
        const lngMax = mapRegion.longitude + (mapRegion.longitudeDelta / 2) * margin;

        if (lat < latMin || lat > latMax || lng < lngMin || lng > lngMax) {
          mapRef.current.animateToRegion({
            latitude: lat,
            longitude: lng,
            latitudeDelta: mapRegion.latitudeDelta,
            longitudeDelta: mapRegion.longitudeDelta,
          }, 1000);
        }
      }
    }
  }, [selectedJourney?.latestLocation?.latitude, selectedJourney?.latestLocation?.longitude, followMode, mapRegion]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#0F4C3A' }}>
      {/* Header */}
      <View className="bg-[#0F4C3A] flex-row items-center justify-between px-4 py-4 z-10 shadow-md">
        <View className="flex-row items-center">
          <TouchableOpacity onPress={() => selectedEmployeeId ? setSelectedEmployeeId(null) : navigation.goBack()} className="mr-3 p-1">
            <Feather name="arrow-left" size={24} color="white" />
          </TouchableOpacity>
          <View className="ml-2">
            <Text className="text-white font-bold text-lg leading-tight">
              {selectedEmployeeId ? 'EMPLOYEE MAP' : 'FLEET TRACKING'}
            </Text>
            <Text className="text-[#F59E0B] text-xs font-bold tracking-widest">
              {selectedEmployeeId ? `TRACKING ${(selectedEmp?.name || selectedEmp?.first_name || 'EMPLOYEE').toUpperCase()}` : 'ALL EMPLOYEES'}
            </Text>
          </View>
        </View>

        {!selectedEmployeeId && (
          <TouchableOpacity onPress={fetchTrackingData} className="w-10 h-10 rounded-xl bg-[#145C44] items-center justify-center border border-[#186D51]">
            {isRefreshing && !isLoading ? (
              <ActivityIndicator size="small" color="white" />
            ) : (
              <Feather name="refresh-cw" size={16} color="white" />
            )}
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.container}>
        
        {/* LIST VIEW */}
        {!selectedEmployeeId && (
          <View style={{ flex: 1, backgroundColor: '#F3F4F6' }}>
            <View style={styles.searchContainer}>
              <Feather name="search" size={20} color="#9CA3AF" />
              <TextInput
                style={styles.searchInput}
                placeholder="Search employee..."
                placeholderTextColor="#9CA3AF"
                value={searchQuery}
                onChangeText={setSearchQuery}
              />
              {searchQuery.length > 0 && (
                <TouchableOpacity onPress={() => setSearchQuery('')}>
                  <Feather name="x" size={20} color="#9CA3AF" />
                </TouchableOpacity>
              )}
            </View>

            {isLoading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#10B981" />
                <Text style={{ marginTop: 10, color: 'gray' }}>Loading Fleet Data...</Text>
              </View>
            ) : (
              <ScrollView contentContainerStyle={{ padding: 20, paddingTop: 10 }}>
                {filteredEmployees.map(emp => {
                  const status = getEmployeeStatus(emp.id);
                  return (
                    <TouchableOpacity 
                      key={emp.id} 
                      style={[styles.employeeListItem, status.canTrack && styles.activeItem]}
                      onPress={() => handleEmployeePress(emp.id)}
                    >
                      <View style={[styles.avatar, { backgroundColor: status.color }]}>
                        <Text style={styles.avatarText}>{emp.name?.charAt(0) || 'E'}</Text>
                      </View>
                      <View style={{ flex: 1, marginLeft: 15 }}>
                        <Text style={styles.listEmpName}>{emp.name || emp.first_name}</Text>
                        <Text style={[styles.listEmpStatus, { color: status.color }]}>{status.label}</Text>
                      </View>
                      <View>
                        {status.canTrack ? (
                          <Feather name="map-pin" size={20} color={status.color} />
                        ) : (
                          <Feather name="chevron-right" size={20} color="#D1D5DB" />
                        )}
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            )}
          </View>
        )}

        {/* MAP VIEW */}
        {selectedEmployeeId && (
          <View style={{ flex: 1 }}>
            {/* Map Controls Floating Overlay */}
            <View style={{ position: 'absolute', top: 16, right: 16, zIndex: 10, flexDirection: 'row', gap: 10 }}>
              {/* Follow Mode Toggle */}
              <TouchableOpacity 
                onPress={() => setFollowMode(!followMode)}
                style={{ 
                  backgroundColor: followMode ? '#10B981' : '#FFF', 
                  paddingHorizontal: 12, 
                  paddingVertical: 10, 
                  borderRadius: 12, 
                  shadowColor: '#000', 
                  shadowOffset: { width: 0, height: 2 }, 
                  shadowOpacity: 0.1, 
                  shadowRadius: 4, 
                  elevation: 3,
                  flexDirection: 'row',
                  alignItems: 'center',
                  borderWidth: 1,
                  borderColor: followMode ? '#059669' : '#E5E7EB'
                }}
              >
                <Feather name="navigation" size={16} color={followMode ? '#FFF' : '#374151'} style={{ marginRight: 6 }} />
                <Text style={{ color: followMode ? '#FFF' : '#374151', fontWeight: 'bold', fontSize: 13 }}>
                  {followMode ? 'Follow ON' : 'Follow OFF'}
                </Text>
              </TouchableOpacity>

              {/* Show History Toggle */}
              <TouchableOpacity 
                onPress={() => setShowHistory(!showHistory)}
                style={{ 
                  backgroundColor: showHistory ? '#F59E0B' : '#FFF', 
                  paddingHorizontal: 12, 
                  paddingVertical: 10, 
                  borderRadius: 12, 
                  shadowColor: '#000', 
                  shadowOffset: { width: 0, height: 2 }, 
                  shadowOpacity: 0.1, 
                  shadowRadius: 4, 
                  elevation: 3,
                  flexDirection: 'row',
                  alignItems: 'center',
                  borderWidth: 1,
                  borderColor: showHistory ? '#D97706' : '#E5E7EB'
                }}
              >
                <Feather name="map" size={16} color={showHistory ? '#FFF' : '#374151'} style={{ marginRight: 6 }} />
                <Text style={{ color: showHistory ? '#FFF' : '#374151', fontWeight: 'bold', fontSize: 13 }}>
                  {showHistory ? 'Show History' : 'Live Map'}
                </Text>
              </TouchableOpacity>
            </View>

            <MapView 
              ref={mapRef}
              style={styles.map} 
              initialRegion={initialRegion}
              onRegionChangeComplete={setMapRegion}
              onPanDrag={() => setFollowMode(false)}
            >
              {selectedJourney.latestLocation && selectedJourney.latestLocation.latitude != null && (
                <AnimatedVehicleMarker
                  coordinate={{
                    latitude: Number(selectedJourney.latestLocation.latitude),
                    longitude: Number(selectedJourney.latestLocation.longitude)
                  }}
                  pinColor="#3B82F6"
                  title={selectedEmp?.name || selectedEmp?.first_name || 'Rider'}
                  latestLocation={selectedJourney.latestLocation}
                  startLocation={{ latitude: selectedJourney.start_lat, longitude: selectedJourney.start_lng }}
                  selectedEmp={selectedEmp}
                  styles={styles}
                />
              )}

              {selectedJourney.destination_lat != null && selectedJourney.destination_lng != null && (
                <Marker
                  coordinate={{ 
                    latitude: Number(selectedJourney.destination_lat), 
                    longitude: Number(selectedJourney.destination_lng) 
                  }}
                  pinColor="red"
                />
              )}

              {/* Destination Route Polyline — dynamically anchors from rider's exact live GPS position */}
              {selectedJourney.destination_lat != null && selectedJourney.destination_lng != null && displayedPolyline.length >= 2 && (
                <Polyline
                  coordinates={displayedPolyline}
                  strokeWidth={6}
                  strokeColor="#3B82F6"
                />
              )}
              
              {showHistory && selectedJourney.locationHistory && selectedJourney.locationHistory.length > 0 && (
                <Polyline 
                  coordinates={selectedJourney.locationHistory.map((loc: any) => ({
                    latitude: Number(loc.latitude),
                    longitude: Number(loc.longitude)
                  }))}
                  strokeColor="#F59E0B"
                  strokeWidth={5}
                />
              )}
            </MapView>

            <View style={styles.overlayFooter}>
              <View style={styles.footerInner}>
                {/* Rider Pointer Avatar */}
                <View style={[styles.avatar, { width: 44, height: 44, borderRadius: 22, backgroundColor: '#3B82F6', borderWidth: 2, borderColor: '#60A5FA' }]}>
                  <Feather name="navigation" size={20} color="white" />
                </View>
                
                {/* Rider Position Pointer Info */}
                <View style={{ flex: 1, paddingLeft: 12, justifyContent: 'center' }}>
                  <Text style={{ color: '#111827', fontWeight: 'bold', fontSize: 16 }}>
                    {selectedEmp?.name || 'Rider'}
                  </Text>
                  <Text style={{ color: '#2563EB', fontSize: 12, marginTop: 2, fontWeight: '700' }} numberOfLines={2}>
                    📍 Current: {currentLocationAddress || (selectedJourney?.latestLocation?.latitude ? `${Number(selectedJourney.latestLocation.latitude).toFixed(4)}°N, ${Number(selectedJourney.latestLocation.longitude).toFixed(4)}°E` : 'Locating rider...')}
                  </Text>
                  {selectedJourney?.address && (
                    <Text style={{ color: '#6B7280', fontSize: 11, marginTop: 2 }} numberOfLines={1}>
                      🏁 Dest: {selectedJourney.address}
                    </Text>
                  )}
                </View>

                {/* Recenter Map Button */}
                <TouchableOpacity 
                  onPress={() => {
                    if (selectedJourney?.latestLocation && mapRef.current) {
                      mapRef.current.animateToRegion({
                        latitude: Number(selectedJourney.latestLocation.latitude),
                        longitude: Number(selectedJourney.latestLocation.longitude),
                        latitudeDelta: 0.02,
                        longitudeDelta: 0.02,
                      }, 1000);
                      setFollowMode(true);
                    }
                  }}
                  style={{ paddingHorizontal: 14, paddingVertical: 10, backgroundColor: '#EFF6FF', borderRadius: 12, borderWidth: 1, borderColor: '#BFDBFE', alignSelf: 'center', flexDirection: 'row', alignItems: 'center' }}
                >
                  <Feather name="crosshair" size={16} color="#2563EB" style={{ marginRight: 6 }} />
                  <Text style={{ color: '#2563EB', fontWeight: 'bold', fontSize: 13 }}>Recenter</Text>
                </TouchableOpacity>
              </View>

              {/* Route Stats Row */}
              {(routeDistance != null || routeDuration != null) && (
                <View style={{ flexDirection: 'row', marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#E5E7EB' }}>
                  {routeDistance != null && (
                    <View style={{ flex: 1, alignItems: 'center' }}>
                      <Text style={{ color: '#6B7280', fontSize: 11, fontWeight: '600' }}>DISTANCE</Text>
                      <Text style={{ color: '#111827', fontSize: 16, fontWeight: 'bold', marginTop: 2 }}>
                        {routeDistance.toFixed(1)} km
                      </Text>
                    </View>
                  )}
                  {routeDuration != null && (
                    <View style={{ flex: 1, alignItems: 'center' }}>
                      <Text style={{ color: '#6B7280', fontSize: 11, fontWeight: '600' }}>ETA</Text>
                      <Text style={{ color: '#111827', fontSize: 16, fontWeight: 'bold', marginTop: 2 }}>
                        {Math.round(routeDuration)} min
                      </Text>
                    </View>
                  )}
                  <View style={{ flex: 1, alignItems: 'center' }}>
                    <Text style={{ color: '#6B7280', fontSize: 11, fontWeight: '600' }}>STATUS</Text>
                    {(() => {
                      const isCompleted = selectedJourney?.status === 'completed';
                      const isLive = !isCompleted && selectedJourney?.latestLocation && (
                        selectedJourney.latestLocation.status === 'online' ||
                        (selectedJourney.latestLocation.timestamp && (Date.now() - new Date(selectedJourney.latestLocation.timestamp).getTime()) < 10 * 60 * 1000)
                      );
                      return (
                        <Text style={{ color: isCompleted ? '#3B82F6' : (isLive ? '#10B981' : '#6B7280'), fontSize: 13, fontWeight: 'bold', marginTop: 2 }}>
                          {isCompleted ? '✓ COMPLETED' : (isLive ? '● LIVE' : '○ OFFLINE (SAVED)')}
                        </Text>
                      );
                    })()}
                  </View>
                </View>
              )}
            </View>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F3F4F6',
  },
  searchContainer: {
    margin: 20,
    backgroundColor: 'white',
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 15,
    paddingVertical: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 5,
    elevation: 3,
  },
  searchInput: {
    flex: 1,
    marginLeft: 10,
    fontSize: 16,
    color: '#1F2937',
  },
  employeeListItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    padding: 16,
    borderRadius: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 2,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  activeItem: {
    borderColor: '#D1FAE5',
    backgroundColor: '#F0FDF4',
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 18,
  },
  listEmpName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#111827',
  },
  listEmpStatus: {
    fontSize: 13,
    marginTop: 2,
    fontWeight: '600',
  },
  map: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  calloutContainer: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 12,
    width: 200,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 3,
    borderColor: '#E5E7EB',
    borderWidth: 1,
  },
  calloutName: {
    fontWeight: 'bold',
    fontSize: 16,
    color: '#1F2937',
    marginBottom: 4,
  },
  calloutStatus: {
    fontSize: 12,
    color: '#059669',
    fontWeight: '600',
    marginBottom: 2,
  },
  calloutTime: {
    fontSize: 11,
    color: '#6B7280',
  },
  overlayFooter: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'white',
    paddingBottom: 35, 
    paddingTop: 20,
    paddingHorizontal: 20,
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 10,
  },
  footerInner: {
    flexDirection: 'row',
  },
  statBox: {
    alignItems: 'center',
    justifyContent: 'center',
  }
});

export default AdminTrackingScreen;
