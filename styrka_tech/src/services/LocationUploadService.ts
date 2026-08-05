import { supabase } from '../config/supabase';
import { TelemetryQueue } from '../utils/TelemetryQueue';
import AsyncStorage from '@react-native-async-storage/async-storage';

class LocationUploadService {
  private isProcessing = false;

  public async processQueue(): Promise<void> {
    if (this.isProcessing) return;
    this.isProcessing = true;

    try {
      let size = await TelemetryQueue.size();
      if (size === 0) {
        this.isProcessing = false;
        return;
      }

      console.log(`[LocationUploadService] Processing queue of size: ${size}`);

      const { data: { session } } = await supabase.auth.getSession();
      let userId = session?.user?.id;
      if (!userId) {
        userId = (await AsyncStorage.getItem('active_tracking_user_id')) || undefined;
      }

      if (!userId) {
        console.warn('[LocationUploadService] No auth session available. Retrying later.');
        this.isProcessing = false;
        return;
      }

      while (size > 0) {
        const batch = await TelemetryQueue.peekAll(100);
        if (batch.length === 0) break;

        // 1. Upsert the latest location point to employee_locations (1 row per user)
        const latestItem = batch[batch.length - 1];
        const latestRecord = {
          user_id: userId,
          latitude: latestItem.latitude,
          longitude: latestItem.longitude,
          status: 'online',
          timestamp: latestItem.timestamp || new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };

        const { error: liveError } = await supabase
          .from('employee_locations')
          .upsert(latestRecord, { onConflict: 'user_id' });

        // 2. Also insert historical coordinates into locations table if present
        try {
          const historyRecords = batch.map((item: any) => ({
            user_id: userId,
            latitude: item.latitude,
            longitude: item.longitude,
            created_at: item.timestamp || new Date().toISOString(),
          }));
          await supabase.from('locations').insert(historyRecords);
        } catch (e) {
          // ignore history insert errors if table is absent
        }

        if (!liveError) {
          await TelemetryQueue.dequeueBatch(batch.length);
          console.log(`[LocationUploadService] Successfully uploaded ${batch.length} location records to Supabase`);
        } else {
          console.error('[LocationUploadService] Supabase insert error:', liveError.message);
          break; // Retry later
        }

        size = await TelemetryQueue.size();
      }
    } catch (e: any) {
      console.error('[LocationUploadService] Exception during queue processing:', e.message);
    } finally {
      this.isProcessing = false;
    }
  }

  public async sendHeartbeat(payload: any): Promise<void> {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) return;

      await supabase
        .from('employee_presence')
        .upsert({
          user_id: session.user.id,
          employee_id: session.user.id,
          status: 'online',
          last_seen: new Date().toISOString(),
          last_heartbeat: new Date().toISOString(),
          battery_level: payload?.batteryLevel || 1.0,
          updated_at: new Date().toISOString(),
        });
    } catch (e: any) {
      console.error('[LocationUploadService] Heartbeat failed:', e.message);
    }
  }
}

export default new LocationUploadService();
