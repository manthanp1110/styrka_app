import "./global.css";
import React from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import AppNavigator from './styrka_tech/src/navigation/AppNavigator';
import { ThemeColors } from './styrka_tech/src/theme/theme';
import { StatusBar } from 'expo-status-bar';
import './styrka_tech/src/tasks/locationTask';
import MapplsGL from 'mappls-map-react-native';

MapplsGL.setMapSDKKey("YOUR_MAP_SDK_KEY_HERE");
MapplsGL.setRestAPIKey("YOUR_REST_API_KEY_HERE");
MapplsGL.setAtlasClientId("YOUR_CLIENT_ID_HERE");
MapplsGL.setAtlasClientSecret("YOUR_CLIENT_SECRET_HERE");

export default function App() {
  return (
    <SafeAreaProvider style={{ flex: 1, backgroundColor: ThemeColors.background }}>
      <StatusBar style="dark" />
      <AppNavigator />
    </SafeAreaProvider>
  );
}
