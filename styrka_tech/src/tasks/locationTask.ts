import * as TaskManager from 'expo-task-manager';
import * as Location from 'expo-location';
import { supabase } from '../config/supabase';
import { getSocket } from '../utils/socket';
import * as Battery from 'expo-battery';
import NetInfo from '@react-native-community/netinfo';
import * as Device from 'expo-device';
import { TelemetryQueue } from '../utils/TelemetryQueue';

export const LOCATION_TASK_NAME = 'background-location-task';
let backgroundSequenceNumber = 1;

function getDistanceFromLatLonInKm(lat1: number, lon1: number, lat2: number, lon2: number) {
  var R = 6371;
  var dLat = (lat2-lat1) * (Math.PI/180);
  var dLon = (lon2-lon1) * (Math.PI/180); 
  var a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * (Math.PI/180)) * Math.cos(lat2 * (Math.PI/180)) * 
    Math.sin(dLon/2) * Math.sin(dLon/2); 
  var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)); 
  var d = R * c;
  return d;
}

TaskManager.defineTask(LOCATION_TASK_NAME, async ({ data, error }: any) => {
  if (error) {
    console.error('Background Location Task Error:', error);
    return;
  }
  if (data) {
    const { locations } = data;
    if (locations && locations.length > 0) {
      const loc = locations[0];
      
      try {
        const { data: { session } } = await supabase.auth.getSession();
        
        if (session?.user) {
          const timestamp = new Date(loc.timestamp || Date.now()).toISOString();
          
          // Fetch the active journey to retrieve trackingSessionId (journey.id)
          const { data: journey } = await supabase
            .from('journeys')
            .select('*')
            .eq('user_id', session.user.id)
            .eq('status', 'active')
            .order('created_at', { ascending: false })
            .limit(1)
            .single();

          if (journey) {
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
              trackingSessionId: journey.id,
              sequenceNumber: seq,
            };

            // Enqueue coordinate
            await TelemetryQueue.enqueue(payload);

            // Attempt immediate background socket emit if connected
            const socket = getSocket(session.access_token);
            if (socket && socket.connected) {
              const packet = await TelemetryQueue.peek();
              if (packet) {
                socket.emit('location:update', packet, (ackResponse: any) => {
                  if (ackResponse && ackResponse.success) {
                    TelemetryQueue.dequeue();
                  }
                });
              }
            }
            const dist = getDistanceFromLatLonInKm(
              loc.coords.latitude, loc.coords.longitude,
              journey.destination_lat, journey.destination_lng
            );
            
            if (dist < 0.1) {
              // 3. Arrived! Stop the tracking
              await supabase.from('journeys').update({
                status: 'completed',
                ended_at: new Date().toISOString()
              }).eq('id', journey.id);
              
              // Find and complete the pending assigned destination
              const { data: pendingDestinations } = await supabase
                .from('assigned_destinations')
                .select('*')
                .eq('employee_id', session.user.id)
                .eq('status', 'pending')
                .order('created_at', { ascending: false })
                .limit(1);
                
              if (pendingDestinations && pendingDestinations.length > 0) {
                await supabase.from('assigned_destinations').update({
                  status: 'completed'
                }).eq('id', pendingDestinations[0].id);
              }
              
              await Location.stopLocationUpdatesAsync(LOCATION_TASK_NAME);
              console.log(`[Background GPS] Arrived at destination! Tracking stopped for user ${session.user.id}`);
            }
          }
        }
      } catch (err) {
        console.error('[Background GPS] Error processing background location:', err);
      }
    }
  }
});
