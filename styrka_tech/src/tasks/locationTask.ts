import * as TaskManager from 'expo-task-manager';
import * as Battery from 'expo-battery';
import NetInfo from '@react-native-community/netinfo';
import * as Device from 'expo-device';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { TelemetryQueue } from '../utils/TelemetryQueue';
import LocationUploadService from '../services/LocationUploadService';
import { TrackingDataService } from '../services/TrackingDataService';
import SocketService from '../services/SocketService';

export const LOCATION_TASK_NAME = 'background-location-task';
let backgroundSequenceNumber = 1;

const AUTH_KEY = '@styrka_auth_user';

TaskManager.defineTask(LOCATION_TASK_NAME, async ({ data, error }: any) => {
  if (error) {
    console.error('[Background Task] Location Task Error:', error);
    return;
  }

  if (data) {
    const { locations } = data;
    if (locations && locations.length > 0) {
      // Always select the newest, freshest location in the received batch
      const loc = locations[locations.length - 1];

      try {
        let userId = await AsyncStorage.getItem('active_tracking_user_id');
        let userEmail = await AsyncStorage.getItem('active_tracking_user_email');
        let userName = await AsyncStorage.getItem('active_tracking_user_name');
        let userRole: string | null = null;

        // Primary fallback: Read active authenticated user session
        try {
          const authRaw = await AsyncStorage.getItem(AUTH_KEY);
          if (authRaw) {
            const authUser = JSON.parse(authRaw);
            if (authUser?.id && !userId) userId = authUser.id;
            if (authUser?.email && !userEmail) userEmail = authUser.email;
            if (authUser?.name && !userName) userName = authUser.name;
            if (authUser?.role) userRole = authUser.role;
          }
        } catch (e) {}

        // Secondary fallback for backwards compatibility
        if (!userId) {
          try {
            const sessionRaw = await AsyncStorage.getItem('@styrka_auth_session');
            if (sessionRaw) {
              const session = JSON.parse(sessionRaw);
              if (session?.id) userId = session.id;
              if (session?.email && !userEmail) userEmail = session.email;
              if (session?.name && !userName) userName = session.name;
            }
          } catch (e) {}
        }

        // Do not track admin users in background
        const cleanEmail = (userEmail || '').trim().toLowerCase();
        const cleanId = String(userId || '').trim().toLowerCase();
        const ADMIN_EMAILS = [
          'manthanpandhare1110@gmail.com',
          'pravindagade007@gmail.com',
          'rustumsayyed905@gmail.com',
          'admin_1',
          'admin_2',
          'admin_3'
        ];
        if (userRole === 'admin' || ADMIN_EMAILS.includes(cleanEmail) || cleanId.startsWith('admin')) {
          return;
        }

        // Fallback to active journey if present
        let journeyObj: any = null;
        try {
          const rawJourney = await AsyncStorage.getItem('active_journey');
          if (rawJourney) {
            journeyObj = JSON.parse(rawJourney);
            if (!userId && journeyObj.user_id) userId = journeyObj.user_id;
          }
        } catch (e) {}

        if (!userId) {
          console.warn('[Background Task] No valid employee ID found. Skipping background location write.');
          return;
        }

        const finalUserId = userId;
        const timestamp = new Date(loc.timestamp || Date.now()).toISOString();
        const journeyId = (await AsyncStorage.getItem('active_journey_id')) || journeyObj?.id || `journey_${finalUserId}`;

        console.log(`[Background Task] Live location update for employee ${finalUserId}: (${loc.coords.latitude}, ${loc.coords.longitude})`);

        let batteryLevel = 1.0;
        try {
          batteryLevel = await Battery.getBatteryLevelAsync();
        } catch (e) {}

        let networkType = 'unknown';
        try {
          const netInfo = await NetInfo.fetch();
          networkType = netInfo.type;
        } catch (e) {}

        const isMoving = loc.coords.speed !== null && loc.coords.speed > 0.5;
        const deviceId = Device.osBuildId || Device.modelName || 'RN_Device';
        const seq = backgroundSequenceNumber++;

        const payload = {
          protocolVersion: '1.0',
          latitude: loc.coords.latitude,
          longitude: loc.coords.longitude,
          accuracy: loc.coords.accuracy,
          speed: loc.coords.speed,
          heading: loc.coords.heading,
          altitude: loc.coords.altitude,
          timestamp,
          batteryLevel,
          networkType,
          isMoving,
          deviceId,
          trackingSessionId: journeyId,
          sequenceNumber: seq,
        };

        // 1. Enqueue coordinate for offline resilience
        await TelemetryQueue.enqueue(payload);

        // 2. Direct Supabase live_locations update (high reliability via HTTPS REST)
        try {
          await TrackingDataService.updateLiveLocation({
            userId: finalUserId,
            email: userEmail || undefined,
            name: userName || undefined,
            latitude: loc.coords.latitude,
            longitude: loc.coords.longitude,
            heading: loc.coords.heading || 0,
            speed: loc.coords.speed || 0,
            destination_lat: journeyObj?.destination_lat ? Number(journeyObj.destination_lat) : undefined,
            destination_lng: journeyObj?.destination_lng ? Number(journeyObj.destination_lng) : undefined,
            destination_address: journeyObj?.address || undefined,
            status: 'online',
          });
        } catch (e: any) {
          console.warn('[Background Task] Supabase live location update error:', e?.message || e);
        }

        // 3. Broadcast Socket.IO location update in background to Render server
        try {
          SocketService.connect(finalUserId, 'employee');
          SocketService.updateLocation({
            userId: finalUserId,
            email: userEmail || undefined,
            name: userName || undefined,
            latitude: loc.coords.latitude,
            longitude: loc.coords.longitude,
            heading: loc.coords.heading || 0,
            speed: loc.coords.speed || 0,
            accuracy: loc.coords.accuracy || 0,
            timestamp,
            destination_lat: journeyObj?.destination_lat ? Number(journeyObj.destination_lat) : undefined,
            destination_lng: journeyObj?.destination_lng ? Number(journeyObj.destination_lng) : undefined,
            destination_address: journeyObj?.address || undefined,
            status: 'online',
          });
        } catch (e: any) {
          console.warn('[Background Task] Socket update error:', e?.message || e);
        }

        // 4. Attempt immediate queue process
        await LocationUploadService.processQueue();
      } catch (err: any) {
        console.error('[Background Task] Execution exception:', err?.message || err);
      }
    }
  }
});
