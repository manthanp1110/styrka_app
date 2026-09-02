import "./global.css";
import React, { useEffect } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import AppNavigator from './styrka_tech/src/navigation/AppNavigator';
import { ThemeColors } from './styrka_tech/src/theme/theme';
import { StatusBar } from 'expo-status-bar';
import './styrka_tech/src/tasks/locationTask';
import BackgroundLocationManager from './styrka_tech/src/services/BackgroundLocationManager';
import * as SplashScreen from 'expo-splash-screen';

SplashScreen.hideAsync().catch(() => {});

export default function App() {
  useEffect(() => {
    // Hide splash screen immediately upon component mounting
    SplashScreen.hideAsync().catch(() => {});
    // Verify and resume tracking if employee session is active
    BackgroundLocationManager.verifyAndResumeTracking().catch(() => {});
  }, []);

  return (
    <SafeAreaProvider style={{ flex: 1, backgroundColor: ThemeColors.background }}>
      <StatusBar style="dark" />
      <AppNavigator />
    </SafeAreaProvider>
  );
}
