/**
 * Durable FileSystem Telemetry Queue using modernized Expo SDK 54 File API.
 * Packets survive app restart, process kill, and device reboot.
 * Optimized for REST batch uploads with expiration and size limits.
 */
import { File, Paths } from 'expo-file-system';
import { Platform } from 'react-native';

let queueFile: File | null = null;
if (Platform.OS !== 'web') {
  try {
    queueFile = new File(Paths.document, 'telemetry_queue.json');
  } catch (e) {
    console.warn('[TelemetryQueue] Failed to initialize file on this platform.', e);
  }
}

const MAX_QUEUE_SIZE = 1000;
const EXPIRATION_MS = 24 * 60 * 60 * 1000; // 24 hours

export class TelemetryQueue {
  private static async readQueue(): Promise<any[]> {
    try {
      if (!queueFile || !queueFile.exists) {
        return [];
      }
      const raw = await queueFile.text();
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
      console.warn('[TelemetryQueue] Read failed. Returning empty array.', e);
      return [];
    }
  }

  private static async writeQueue(queue: any[]): Promise<void> {
    try {
      if (!queueFile) return;
      if (!queueFile.exists) {
        queueFile.create();
      }
      queueFile.write(JSON.stringify(queue));
    } catch (e) {
      console.error('[TelemetryQueue] Write failed.', e);
    }
  }

  private static filterExpired(queue: any[]): any[] {
    const now = Date.now();
    return queue.filter(packet => {
      if (!packet.timestamp) return false;
      const packetTime = new Date(packet.timestamp).getTime();
      return (now - packetTime) <= EXPIRATION_MS;
    });
  }

  /**
   * Add packet to queue, ensuring size limits and expiration
   */
  public static async enqueue(packet: any): Promise<void> {
    let queue = await this.readQueue();
    queue.push(packet);
    
    // Cleanup expired and limit size
    queue = this.filterExpired(queue);
    if (queue.length > MAX_QUEUE_SIZE) {
      // Keep the most recent ones
      queue = queue.slice(queue.length - MAX_QUEUE_SIZE);
    }
    
    await this.writeQueue(queue);
  }

  /**
   * Add multiple packets to queue
   */
  public static async enqueueBatch(packets: any[]): Promise<void> {
    let queue = await this.readQueue();
    queue.push(...packets);
    
    queue = this.filterExpired(queue);
    if (queue.length > MAX_QUEUE_SIZE) {
      queue = queue.slice(queue.length - MAX_QUEUE_SIZE);
    }
    
    await this.writeQueue(queue);
  }

  /**
   * Peek the oldest packet (index 0)
   */
  public static async peek(): Promise<any | null> {
    const queue = await this.readQueue();
    return queue.length > 0 ? queue[0] : null;
  }

  /**
   * Peek all packets up to a limit
   */
  public static async peekAll(limit: number = 100): Promise<any[]> {
    const queue = await this.readQueue();
    return queue.slice(0, limit);
  }

  /**
   * Remove the oldest packet (index 0)
   */
  public static async dequeue(): Promise<void> {
    const queue = await this.readQueue();
    if (queue.length > 0) {
      queue.shift();
      await this.writeQueue(queue);
    }
  }

  /**
   * Remove multiple packets from the front of the queue
   */
  public static async dequeueBatch(count: number): Promise<void> {
    let queue = await this.readQueue();
    if (queue.length > 0) {
      queue = queue.slice(count);
      await this.writeQueue(queue);
    }
  }

  /**
   * Get total size
   */
  public static async size(): Promise<number> {
    const queue = await this.readQueue();
    return queue.length;
  }

  /**
   * Clear the entire queue
   */
  public static async clear(): Promise<void> {
    await this.writeQueue([]);
  }
}
