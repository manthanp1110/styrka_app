import { io, Socket } from 'socket.io-client';

const SERVER_URL = process.env.EXPO_PUBLIC_BACKEND_URL || 'http://localhost:3000';


class SocketService {
  private socket: Socket | null = null;
  private listeners: Map<string, Function[]> = new Map();

  public connect(userId?: string, role?: string) {
    if (this.socket && this.socket.connected) return;

    this.socket = io(SERVER_URL, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 2000,
    });

    this.socket.on('connect', () => {
      console.log('[SocketService] Connected to Socket.io server with ID:', this.socket?.id);
      if (userId && role) {
        this.register(userId, role);
      }
    });

    this.socket.on('destination_assigned', (data) => {
      this.emitLocal('destination_assigned', data);
    });

    this.socket.on('employee_location_changed', (data) => {
      this.emitLocal('employee_location_changed', data);
    });

    this.socket.on('journey_status_changed', (data) => {
      this.emitLocal('journey_status_changed', data);
    });

    this.socket.on('disconnect', () => {
      console.log('[SocketService] Disconnected from server');
    });
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
