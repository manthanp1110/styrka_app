import { io, Socket } from 'socket.io-client';
import { supabase } from '../config/supabase';

const SERVER_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

class SocketService {
  private socket: Socket | null = null;
  private supabaseChannel: any = null;
  private listeners: Map<string, Function[]> = new Map();

  public connect(userId?: string, role?: string) {
    // 1. Supabase Realtime WebSockets (Primary cloud stream for production APKs)
    if (!this.supabaseChannel) {
      try {
        this.supabaseChannel = supabase
          .channel('realtime_fleet_tracking_v1')
          .on(
            'postgres_changes',
            { event: '*', schema: 'public', table: 'live_locations' },
            (payload: any) => {
              const row = payload.new || payload.record;
              if (row && row.user_id) {
                console.log('[Supabase Realtime] Received live location:', row.user_id, row.latitude, row.longitude);
                this.emitLocal('employee_location_changed', {
                  employee_id: String(row.user_id),
                  latitude: Number(row.latitude),
                  longitude: Number(row.longitude),
                  heading: Number(row.heading || 0),
                  speed: Number(row.speed || 0),
                  status: row.status || 'online',
                  destination_lat: row.destination_lat != null ? Number(row.destination_lat) : null,
                  destination_lng: row.destination_lng != null ? Number(row.destination_lng) : null,
                  destination_address: row.destination_address || null,
                  timestamp: row.updated_at || new Date().toISOString(),
                });
              }
            }
          )
          .on(
            'postgres_changes',
            { event: '*', schema: 'public', table: 'destinations' },
            (payload: any) => {
              console.log('[Supabase Realtime] Received destination update:', payload);
              this.emitLocal('destination_assigned', payload.new || payload.record);
            }
          )
          .subscribe((status) => {
            console.log('[Supabase Realtime] Channel subscription status:', status);
          });
      } catch (e) {
        console.warn('[Supabase Realtime] Exception subscribing:', e);
      }
    }

    // 2. Optional local Socket.IO fallback (only if SERVER_URL is provided)
    if (SERVER_URL && !this.socket) {
      try {
        this.socket = io(SERVER_URL, {
          transports: ['websocket', 'polling'],
          reconnection: true,
          reconnectionAttempts: 5,
        });

        this.socket.on('connect', () => {
          if (userId && role) this.register(userId, role);
        });

        this.socket.on('employee_location_changed', (data) => {
          this.emitLocal('employee_location_changed', data);
        });

        this.socket.on('destination_assigned', (data) => {
          this.emitLocal('destination_assigned', data);
        });
      } catch (e) {}
    }
  }

  public register(userId: string, role: string) {
    if (this.socket) {
      this.socket.emit('register', { userId, role });
    }
  }

  public assignDestination(payload: {
    destination_id?: string;
    admin_id: string;
    employee_id: string;
    address: string;
    latitude: number;
    longitude: number;
  }) {
    if (this.socket) {
      this.socket.emit('assign_destination', payload);
    }
  }

  public updateLocation(payload: {
    userId: string;
    latitude: number;
    longitude: number;
    heading?: number;
    speed?: number;
    destination_lat?: number;
    destination_lng?: number;
    destination_address?: string;
  }) {
    if (this.socket) {
      this.socket.emit('update_location', payload);
    }
  }

  public emitJourneyStatus(payload: {
    journeyId: string;
    userId: string;
    status: 'started' | 'arrived' | 'completed';
  }) {
    if (this.socket) {
      this.socket.emit('journey_status', payload);
    }
  }

  // Local event bus for UI components
  public on(event: string, callback: Function) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event)?.push(callback);
  }

  public off(event: string, callback: Function) {
    const list = this.listeners.get(event);
    if (list) {
      this.listeners.set(
        event,
        list.filter((cb) => cb !== callback)
      );
    }
  }

  private emitLocal(event: string, data: any) {
    const list = this.listeners.get(event);
    if (list) {
      list.forEach((cb) => cb(data));
    }
  }

  public disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }
}

export default new SocketService();
