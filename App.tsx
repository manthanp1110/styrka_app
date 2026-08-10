import "./global.css";
import React, { useEffect } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import AppNavigator from './styrka_tech/src/navigation/AppNavigator';
import { ThemeColors } from './styrka_tech/src/theme/theme';
import { StatusBar } from 'expo-status-bar';
import './styrka_tech/src/tasks/locationTask';
import { UIManager, Platform } from 'react-native';
import * as SplashScreen from 'expo-splash-screen';

SplashScreen.hideAsync().catch(() => {});

export default function App() {
  useEffect(() => {
    // Hide splash screen as soon as component mounts
    SplashScreen.hideAsync().catch(() => {});

    try {
      if (Platform.OS !== 'web' && typeof UIManager.getViewManagerConfig === 'function') {
        const mapViewConfig = UIManager.getViewManagerConfig('RCTMGLMapView');
        if (mapViewConfig) {
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
      }
    } catch (e) {
      console.log('[App] Mappls native SDK initialization skipped');
    }
  }, []);

  return (
    <SafeAreaProvider style={{ flex: 1, backgroundColor: ThemeColors.background }}>
      <StatusBar style="dark" />
      <AppNavigator />
    </SafeAreaProvider>
  );
}
