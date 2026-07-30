import "./global.css";
import React from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import AppNavigator from './styrka_tech/src/navigation/AppNavigator';
import { ThemeColors } from './styrka_tech/src/theme/theme';
import { StatusBar } from 'expo-status-bar';
import './styrka_tech/src/tasks/locationTask';
import MapplsGL from 'mappls-map-react-native';


MapplsGL.setMapSDKKey = (MapplsGL as any).setMapSDKKey;
MapplsGL.setRestAPIKey = (MapplsGL as any).setRestAPIKey;
MapplsGL.setAtlasClientId = (MapplsGL as any).setAtlasClientId;
MapplsGL.setAtlasClientSecret = (MapplsGL as any).setAtlasClientSecret;

if (MapplsGL.setMapSDKKey) {
  MapplsGL.setMapSDKKey(process.env.EXPO_PUBLIC_MAPPLS_ATLAS_MAP_SDK_KEY);
  MapplsGL.setRestAPIKey(process.env.EXPO_PUBLIC_MAPPLS_ATLAS_REST_API_KEY);
  MapplsGL.setAtlasClientId(process.env.EXPO_PUBLIC_MAPPLS_ATLAS_CLIENT_ID);
  MapplsGL.setAtlasClientSecret(process.env.EXPO_PUBLIC_MAPPLS_ATLAS_CLIENT_SECRET);
}

export default function App() {
  return (
    <SafeAreaProvider style={{ flex: 1, backgroundColor: ThemeColors.background }}>
      <StatusBar style="dark" />
      <AppNavigator />
    </SafeAreaProvider>
  );
}
