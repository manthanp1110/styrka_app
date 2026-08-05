import { supabase } from '../config/supabase';
import { TelemetryQueue } from '../utils/TelemetryQueue';

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
      if (!session?.user) {
        console.warn('[LocationUploadService] No auth session available. Retrying later.');
        this.isProcessing = false;
        return;
      }

      while (size > 0) {
        const batch = await TelemetryQueue.peekAll(100);
        if (batch.length === 0) break;

        // Map telemetry queue items to Supabase employee_locations schema (matching existing columns)
        const recordsToInsert = batch.map((item: any) => ({
          user_id: session.user.id,
          latitude: item.latitude,
          longitude: item.longitude,
          status: 'online',
          timestamp: item.timestamp || new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }));

        const { error } = await supabase
          .from('employee_locations')
          .upsert(recordsToInsert, { onConflict: 'user_id' });

        if (!error) {
          await TelemetryQueue.dequeueBatch(batch.length);
          console.log(`[LocationUploadService] Successfully uploaded ${batch.length} location records to Supabase`);
        } else {
          console.error('[LocationUploadService] Supabase insert error:', error.message);
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
