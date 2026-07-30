/**
 * Operational Configurations and Environmental Variables
 */
require('dotenv').config();

module.exports = {
  PORT: process.env.PORT || 4000,
  
  // Supabase Integration
  SUPABASE_URL: process.env.SUPABASE_URL || process.env.EXPO_PUBLIC_SUPABASE_URL || '',
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.EXPO_PUBLIC_SUPABASE_SERVICE_ROLE_KEY || '',
  SUPABASE_JWT_SECRET: process.env.SUPABASE_JWT_SECRET || '',

  // Operational Thresholds
  GPS_ACCURACY_THRESHOLD: Number(process.env.GPS_ACCURACY_THRESHOLD) || 20, // meters
  MAX_SPEED_KMH: Number(process.env.MAX_SPEED_KMH) || 150, // km/h
  MIN_DISTANCE_METERS: Number(process.env.MIN_DISTANCE_METERS) || 10, // meters
  MAX_WRITE_INTERVAL_SECONDS: Number(process.env.MAX_WRITE_INTERVAL_SECONDS) || 20, // seconds
  OFFLINE_TIMEOUT_SECONDS: Number(process.env.OFFLINE_TIMEOUT_SECONDS) || 5, // seconds
  HEARTBEAT_INTERVAL_SECONDS: Number(process.env.HEARTBEAT_INTERVAL_SECONDS) || 10, // seconds
  SOCKET_ACK_TIMEOUT_MS: Number(process.env.SOCKET_ACK_TIMEOUT_MS) || 2000, // ms
  OSRM_TIMEOUT_MS: Number(process.env.OSRM_TIMEOUT_MS) || 3000, // ms
  MAX_PACKET_SIZE_KB: Number(process.env.MAX_PACKET_SIZE_KB) || 10, // KB
  ROUTE_BUFFER_METERS: Number(process.env.ROUTE_BUFFER_METERS) || 30, // meters

  // Mappls API Keys
  MAPPLS_ATLAS_REST_API_KEY: process.env.EXPO_PUBLIC_MAPPLS_ATLAS_REST_API_KEY || '',
  MAPPLS_ATLAS_MAP_SDK_KEY: process.env.EXPO_PUBLIC_MAPPLS_ATLAS_MAP_SDK_KEY || '',
  MAPPLS_ATLAS_CLIENT_ID: process.env.EXPO_PUBLIC_MAPPLS_ATLAS_CLIENT_ID || '',
  MAPPLS_ATLAS_CLIENT_SECRET: process.env.EXPO_PUBLIC_MAPPLS_ATLAS_CLIENT_SECRET || '',
};
