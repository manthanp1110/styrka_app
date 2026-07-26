import Constants from 'expo-constants';
import { supabase } from '../config/supabase';
import { TelemetryQueue } from '../utils/TelemetryQueue';

export const getApiUrl = (): string => {
  if (process.env.EXPO_PUBLIC_SOCKET_SERVER_URL) {
    return process.env.EXPO_PUBLIC_SOCKET_SERVER_URL;
  }
  const hostUri = Constants.expoConfig?.hostUri;
  if (hostUri) {
    const ip = hostUri.split(':')[0];
    return `http://${ip}:4000`;
  }
  return 'http://10.0.2.2:4000';
};

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
      const token = session?.access_token;
      
      if (!token) {
        console.warn('[LocationUploadService] No auth token available. Retrying later.');
        this.isProcessing = false;
        return;
      }

      const apiUrl = `${getApiUrl()}/api/location/upload`;

      while (size > 0) {
        const batch = await TelemetryQueue.peekAll(100);
        if (batch.length === 0) break;

        const response = await fetch(apiUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ locations: batch })
        });

        if (response.ok) {
          const resJson = await response.json();
          if (resJson.success) {
            await TelemetryQueue.dequeueBatch(batch.length);
            console.log(`[LocationUploadService] Successfully uploaded batch of ${batch.length}`);
          } else {
            console.error('[LocationUploadService] Server returned failure:', resJson.reason);
            break; // Stop and retry later
          }
        } else {
          console.error(`[LocationUploadService] Upload failed with status: ${response.status}`);
          break; // Stop and retry later on network or server error
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
      const token = session?.access_token;
      
      if (!token) return;

      const apiUrl = `${getApiUrl()}/api/location/heartbeat`;
      
      await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });
    } catch (e: any) {
      console.error('[LocationUploadService] Heartbeat failed:', e.message);
    }
  }
}

export default new LocationUploadService();
