import * as TaskManager from 'expo-task-manager';
import * as Location from 'expo-location';
import * as Battery from 'expo-battery';
import NetInfo from '@react-native-community/netinfo';
import * as Device from 'expo-device';
import { TelemetryQueue } from '../utils/TelemetryQueue';
import LocationUploadService from '../services/LocationUploadService';
import { TrackingDataService } from '../services/TrackingDataService';
import SocketService from '../services/SocketService';

import AsyncStorage from '@react-native-async-storage/async-storage';

export const LOCATION_TASK_NAME = 'background-location-task';
let backgroundSequenceNumber = 1;

TaskManager.defineTask(LOCATION_TASK_NAME, async ({ data, error }: any) => {
  if (error) {
    console.error('[Background Task] Location Task Error:', error);
    return;
  }
  
  if (data) {
    const { locations } = data;
    if (locations && locations.length > 0) {
      const loc = locations[0];
      
      try {
        const userId = await AsyncStorage.getItem('active_tracking_user_id');
        const userEmail = await AsyncStorage.getItem('active_tracking_user_email');
        const userName = await AsyncStorage.getItem('active_tracking_user_name');

        if (userId) {
          const timestamp = new Date(loc.timestamp || Date.now()).toISOString();
          let journeyId = (await AsyncStorage.getItem('active_journey_id')) || 'default_journey';
          let journeyObj: any = null;
          try {
            const rawJourney = await AsyncStorage.getItem('active_journey');
            if (rawJourney) journeyObj = JSON.parse(rawJourney);
          } catch (e) {}

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

          // Enqueue coordinate
          await TelemetryQueue.enqueue(payload);

          // 1. Update Supabase live_locations directly in background
          try {
            await TrackingDataService.updateLiveLocation({
              userId,
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
          } catch (e) {}

          // 2. Broadcast Socket.IO location update in background to Render server
          try {
            SocketService.connect(userId, 'employee');
            SocketService.updateLocation({
              userId,
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
          } catch (e) {}

          // 3. Attempt immediate queue process
          await LocationUploadService.processQueue();
        }
      } catch (err: any) {
        console.error('[Background Task] Execution exception:', err.message);
      }
    }
  }
});

