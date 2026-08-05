import "./global.css";
import React from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import AppNavigator from './styrka_tech/src/navigation/AppNavigator';
import { ThemeColors } from './styrka_tech/src/theme/theme';
import { StatusBar } from 'expo-status-bar';
import './styrka_tech/src/tasks/locationTask';

import { UIManager, Platform } from 'react-native';

try {
  if (Platform.OS !== 'web') {
    const MapplsGL = require('mappls-map-react-native').default;
    if (MapplsGL && typeof MapplsGL.setMapSDKKey === 'function') {
      MapplsGL.setMapSDKKey(process.env.EXPO_PUBLIC_MAPPLS_ATLAS_MAP_SDK_KEY || '28b2df366fa28c4d538d96c1b5cf32fb');
      MapplsGL.setRestAPIKey(process.env.EXPO_PUBLIC_MAPPLS_ATLAS_REST_API_KEY || '28b2df366fa28c4d538d96c1b5cf32fb');
      if (process.env.EXPO_PUBLIC_MAPPLS_ATLAS_CLIENT_ID) {
        MapplsGL.setAtlasClientId(process.env.EXPO_PUBLIC_MAPPLS_ATLAS_CLIENT_ID);
      }
      if (process.env.EXPO_PUBLIC_MAPPLS_ATLAS_CLIENT_SECRET) {
        MapplsGL.setAtlasClientSecret(process.env.EXPO_PUBLIC_MAPPLS_ATLAS_CLIENT_SECRET);
      }
      console.log('[App] Mappls native SDK initialized successfully');
    }
  }
} catch (e) {
  console.log('[App] Mappls native SDK initialization skipped (Expo Go mode or web)');
}

export default function App() {
  return (
    <SafeAreaProvider style={{ flex: 1, backgroundColor: ThemeColors.background }}>
      <StatusBar style="dark" />
      <AppNavigator />
    </SafeAreaProvider>
  );
}
