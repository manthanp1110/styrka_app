import * as TaskManager from 'expo-task-manager';
import * as Location from 'expo-location';
import * as Battery from 'expo-battery';
import NetInfo from '@react-native-community/netinfo';
import * as Device from 'expo-device';
import { TelemetryQueue } from '../utils/TelemetryQueue';
import LocationUploadService from '../services/LocationUploadService';

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

        if (userId) {
          const timestamp = new Date(loc.timestamp || Date.now()).toISOString();
          let journeyId = (await AsyncStorage.getItem('active_journey_id')) || 'default_journey';

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

          // Attempt immediate local upload
          await LocationUploadService.processQueue();
        }
      } catch (err: any) {
        console.error('[Background Task] Execution exception:', err.message);
      }
    }
  }
});

