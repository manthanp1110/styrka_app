/**
 * Durable FileSystem Telemetry Queue using modernized Expo SDK 54 File API.
 * Packets survive app restart, process kill, and device reboot.
 */
import { File, Paths } from 'expo-file-system';

const queueFile = new File(Paths.document, 'telemetry_queue.json');

export class TelemetryQueue {
  private static async readQueue(): Promise<any[]> {
    try {
      if (!queueFile.exists) {
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
      if (!queueFile.exists) {
        queueFile.create();
      }
      queueFile.write(JSON.stringify(queue));
    } catch (e) {
      console.error('[TelemetryQueue] Write failed.', e);
    }
  }

  /**
   * Add packet to queue
   */
  public static async enqueue(packet: any): Promise<void> {
    const queue = await this.readQueue();
    queue.push(packet);
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
