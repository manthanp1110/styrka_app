import { TelemetryQueue } from '../utils/TelemetryQueue';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { TrackingDataService } from './TrackingDataService';

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

      const userId = await AsyncStorage.getItem('active_tracking_user_id');

      if (!userId) {
        console.warn('[LocationUploadService] No tracking user ID available.');
        this.isProcessing = false;
        return;
      }

      while (size > 0) {
        const batch = await TelemetryQueue.peekAll(100);
        if (batch.length === 0) break;

        const latestItem = batch[batch.length - 1];
        await TrackingDataService.updateLiveLocation({
          userId,
          latitude: latestItem.latitude,
          longitude: latestItem.longitude,
          heading: latestItem.heading,
          speed: latestItem.speed,
        });

        await TelemetryQueue.dequeueBatch(batch.length);
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
      const userId = await AsyncStorage.getItem('active_tracking_user_id');
      if (!userId) return;
      // Heartbeat updated automatically via updateLiveLocation
    } catch (e: any) {
      console.error('[LocationUploadService] Heartbeat failed:', e.message);
    }
  }
}

export default new LocationUploadService();

