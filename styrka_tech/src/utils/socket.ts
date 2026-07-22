import Constants from 'expo-constants';
import { io, Socket } from 'socket.io-client';

let socket: Socket | null = null;

const getSocketUrl = (): string => {
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

export const getSocket = (token?: string): Socket | null => {
  if (socket) {
    return socket;
  }

  if (!token) {
    console.warn('[Socket] Attempted to get socket without a token when not connected.');
    return null;
  }

  const socketUrl = getSocketUrl();
  
  console.log(`[Socket] Initializing Socket.IO connection to: ${socketUrl}`);
  
  socket = io(socketUrl, {
    auth: { token },
    transports: ['websocket', 'polling'], // Fall back to polling if direct websocket fails
    autoConnect: false,
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 2000,
  });

  socket.on('connect', () => {
    console.log('[Socket] Socket.IO connected successfully.');
  });

  socket.on('connect_error', (error) => {
    console.error('[Socket] Connection error:', error.message);
  });

  socket.on('disconnect', (reason) => {
    console.log('[Socket] Socket.IO disconnected. Reason:', reason);
  });

  socket.connect();
  return socket;
};

export const disconnectSocket = () => {
  if (socket) {
    console.log('[Socket] Disconnecting Socket.IO client.');
    socket.disconnect();
    socket = null;
  }
};
