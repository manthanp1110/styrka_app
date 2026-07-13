import * as TaskManager from 'expo-task-manager';
import * as Location from 'expo-location';
import { supabase } from '../config/supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';

export const LOCATION_TASK_NAME = 'background-location-task';

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
        // Since this runs in the background, we need to manually get the session
        // Supabase client might already have it if it's initialized, but let's be safe
        const { data: { session } } = await supabase.auth.getSession();
        
        if (session?.user) {
          // Push to employee_locations
          await supabase.from('employee_locations').insert([
            {
              user_id: session.user.id,
              latitude: loc.coords.latitude,
              longitude: loc.coords.longitude,
              status: 'Moving',
              timestamp: new Date().toISOString()
            }
          ]);
          console.log(`[Background GPS] Logged location for user ${session.user.id}: ${loc.coords.latitude}, ${loc.coords.longitude}`);
        } else {
          console.log('[Background GPS] No active user session found, skipping logging.');
        }
      } catch (err) {
        console.error('[Background GPS] Error saving location to Supabase:', err);
      }
    }
  }
});
