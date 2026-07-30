import "./global.css";
import React from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import AppNavigator from './styrka_tech/src/navigation/AppNavigator';
import { ThemeColors } from './styrka_tech/src/theme/theme';
import { StatusBar } from 'expo-status-bar';
import './styrka_tech/src/tasks/locationTask';

try {
  const MapplsGL = require('mappls-map-react-native').default;
  const mapplsAny = MapplsGL as any;
  if (mapplsAny && typeof mapplsAny.setMapSDKKey === 'function') {
    mapplsAny.setMapSDKKey(process.env.EXPO_PUBLIC_MAPPLS_ATLAS_MAP_SDK_KEY);
    mapplsAny.setRestAPIKey(process.env.EXPO_PUBLIC_MAPPLS_ATLAS_REST_API_KEY);
    mapplsAny.setAtlasClientId(process.env.EXPO_PUBLIC_MAPPLS_ATLAS_CLIENT_ID);
    mapplsAny.setAtlasClientSecret(process.env.EXPO_PUBLIC_MAPPLS_ATLAS_CLIENT_SECRET);
  }
} catch (e) {
  console.log('[App] Mappls native SDK initialization skipped (Expo Go mode)');
}

export default function App() {
  return (
    <SafeAreaProvider style={{ flex: 1, backgroundColor: ThemeColors.background }}>
      <StatusBar style="dark" />
      <AppNavigator />
    </SafeAreaProvider>
  );
}
