import { Platform, Alert, PermissionsAndroid, AppState, AppStateStatus } from 'react-native';
import * as Location from 'expo-location';
import * as IntentLauncher from 'expo-intent-launcher';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LOCATION_TASK_NAME } from '../tasks/locationTask';
import { TrackingDataService } from './TrackingDataService';
import SocketService from './SocketService';

const AUTH_KEY = '@styrka_auth_user';
const ANDROID_PACKAGE_NAME = 'com.manthanp_2811.styrka';

export interface TrackingUserInfo {
  id?: string | null;
  name?: string | null;
  email?: string | null;
  role?: string | null;
}

class BackgroundLocationManager {
  private isStarting = false;
  private appStateSubscription: any = null;

  constructor() {
    this.initAppStateListener();
  }

  private initAppStateListener() {
    if (this.appStateSubscription) return;
    this.appStateSubscription = AppState.addEventListener('change', async (nextState: AppStateStatus) => {
      console.log('[BackgroundLocationManager] AppState changed to:', nextState);
      // Only verify and resume when app transitions back to 'active' foreground state!
      // Attempting to start a foreground service while in background is rejected on Android 14+.
      if (nextState === 'active') {
        await this.verifyAndResumeTracking();
      }
    });
  }

  /**
   * Open system application settings for Styrka
   */
  public async openAppSettings(): Promise<void> {
    if (Platform.OS === 'android') {
      try {
        await IntentLauncher.startActivityAsync(
          IntentLauncher.ActivityAction.APPLICATION_DETAILS_SETTINGS,
          { data: `package:${ANDROID_PACKAGE_NAME}` }
        );
      } catch (err) {
        console.warn('[BackgroundLocationManager] Could not open app details settings:', err);
      }
    }
  }

  /**
   * Request Android system to ignore battery optimization so Doze mode / App Standby does not kill tracking
   */
  public async requestIgnoreBatteryOptimizations(): Promise<void> {
    if (Platform.OS === 'android') {
      try {
        // Direct native prompt to whitelist app from battery optimization
        await IntentLauncher.startActivityAsync(
          IntentLauncher.ActivityAction.REQUEST_IGNORE_BATTERY_OPTIMIZATIONS,
          { data: `package:${ANDROID_PACKAGE_NAME}` }
        );
      } catch (e) {
        console.log('[BackgroundLocationManager] Direct battery optimization intent fallback to settings:', e);
        try {
          await IntentLauncher.startActivityAsync(
            IntentLauncher.ActivityAction.IGNORE_BATTERY_OPTIMIZATION_SETTINGS
          );
        } catch (err) {
          console.warn('[BackgroundLocationManager] Battery settings launch error:', err);
        }
      }
    }
  }

  /**
   * Verify all required permissions (Foreground Location, Background Location "Allow all the time", POST_NOTIFICATIONS)
   */
  public async ensurePermissionsAndBatteryOpt(promptBattery: boolean = true): Promise<boolean> {
    if (Platform.OS === 'web') return true;

    // 1. Android 13+ (API 33+) Notification Permission (Mandatory for Foreground Service)
    if (Platform.OS === 'android' && (Platform.Version as number) >= 33) {
      try {
        const postGranted = await PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS);
        if (!postGranted) {
          await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS);
        }
      } catch (e) {
        console.log('[BackgroundLocationManager] Notification permission request error:', e);
      }
    }

    // 2. Foreground Location Permission
    let fgStatus = (await Location.getForegroundPermissionsAsync()).status;
    if (fgStatus !== 'granted') {
      const fgReq = await Location.requestForegroundPermissionsAsync();
      fgStatus = fgReq.status;
    }

    if (fgStatus !== 'granted') {
      Alert.alert(
        'Location Permission Required',
        'Styrka requires Location permission to track your field movements. Please grant location access in Settings.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Open Settings', onPress: () => this.openAppSettings() },
        ]
      );
      return false;
    }

    // 3. Android GPS Hardware check
    if (Platform.OS === 'android') {
      try {
        const servicesEnabled = await Location.hasServicesEnabledAsync();
        if (!servicesEnabled) {
          try {
            await Location.enableNetworkProviderAsync();
          } catch (e) {
            Alert.alert(
              'GPS Disabled',
              'Location services (GPS) are turned off. Please turn ON Location / GPS in your device settings.'
            );
          }
        }
      } catch (e) {}
    }

    // 4. Background Location Permission ("Allow all the time")
    let bgStatus = (await Location.getBackgroundPermissionsAsync()).status;
    if (bgStatus !== 'granted') {
      const bgReq = await Location.requestBackgroundPermissionsAsync();
      bgStatus = bgReq.status;
    }

    if (bgStatus !== 'granted') {
      Alert.alert(
        'Continuous Background Tracking',
        'To track your location when you switch to other apps (WhatsApp, Maps, etc.) or close the app, please set Location permission to "Allow all the time".',
        [
          { text: 'Later', style: 'cancel' },
          { text: 'Open Settings', onPress: () => this.openAppSettings() },
        ]
      );
    }

    // 5. Battery optimization alert if requested (non-blocking)
    if (promptBattery && Platform.OS === 'android') {
      this.requestIgnoreBatteryOptimizations().catch(() => {});
    }

    return true;
  }

  /**
   * Start continuous background tracking for an employee
   */
  public async startTracking(user: TrackingUserInfo, journey?: any): Promise<boolean> {
    if (Platform.OS === 'web') return true;

    // Do not track admin users
    const cleanEmail = (user.email || '').trim().toLowerCase();
    const cleanId = String(user.id || '').trim().toLowerCase();
    const ADMIN_EMAILS = [
      'manthanpandhare1110@gmail.com',
      'pravindagade007@gmail.com',
      'rustumsayyed905@gmail.com',
      'admin_1',
      'admin_2',
      'admin_3'
    ];
    if (user.role === 'admin' || ADMIN_EMAILS.includes(cleanEmail) || cleanId.startsWith('admin')) {
      console.log('[BackgroundLocationManager] User is admin. Background tracking skipped.');
      return false;
    }

    const resolvedId = user.id || user.email || 'employee';

    if (this.isStarting) return false;
    this.isStarting = true;

    try {
      // 1. Ensure permissions (without re-prompting battery dialog)
      await this.ensurePermissionsAndBatteryOpt(false);

      // 2. Persist active employee credentials for headless background access
      await AsyncStorage.setItem('active_tracking_user_id', resolvedId);
      await AsyncStorage.setItem('is_duty_connected', 'true');
      if (user.email) await AsyncStorage.setItem('active_tracking_user_email', user.email);
      if (user.name) await AsyncStorage.setItem('active_tracking_user_name', user.name);

      if (journey) {
        await AsyncStorage.setItem('active_journey', JSON.stringify(journey));
        await AsyncStorage.setItem('active_journey_id', journey.id || `journey_${resolvedId}`);
      }

      // Connect Socket.IO for employee
      SocketService.connect(resolvedId, 'employee');

      // 3. Check if already started
      const isRunning = await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK_NAME);
      if (isRunning) {
        console.log('[BackgroundLocationManager] Background location updates already active.');
        this.isStarting = false;
        return true;
      }

      // Guard: Android 14+ prohibits starting a foreground service while the app is in the background
      if (Platform.OS === 'android' && AppState.currentState !== 'active') {
        console.log('[BackgroundLocationManager] App currently in background. Foreground service will start on resume.');
        this.isStarting = false;
        return false;
      }

      // 4. Start foreground service location updates with zero deferral
      console.log('[BackgroundLocationManager] Starting Location.startLocationUpdatesAsync for user:', resolvedId);
      await Location.startLocationUpdatesAsync(LOCATION_TASK_NAME, {
        accuracy: Location.Accuracy.High,
        timeInterval: 3000,
        distanceInterval: 0, // Ensure continuous time-based reports even when stopped
        deferredUpdatesInterval: 0, // No deferral! Immediate updates
        deferredUpdatesDistance: 0, // No deferral!
        showsBackgroundLocationIndicator: true,
        pausesUpdatesAutomatically: false,
        activityType: Location.ActivityType.AutomotiveNavigation,
        foregroundService: {
          notificationTitle: 'Styrka Duty Active',
          notificationBody: 'Broadcasting your live location to Admin',
          notificationColor: '#0F4C3A',
          killServiceOnDestroy: false,
        },
      });

      console.log('[BackgroundLocationManager] Background location updates successfully started.');
      return true;
    } catch (error: any) {
      console.error('[BackgroundLocationManager] Failed to start background location updates:', error?.message || error);
      return false;
    } finally {
      this.isStarting = false;
    }
  }

  /**
   * Stop background location updates
   */
  public async stopTracking(): Promise<void> {
    if (Platform.OS === 'web') return;
    try {
      await AsyncStorage.setItem('is_duty_connected', 'false');
      const isRunning = await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK_NAME);
      if (isRunning) {
        await Location.stopLocationUpdatesAsync(LOCATION_TASK_NAME);
        console.log('[BackgroundLocationManager] Background location updates stopped.');
      }
    } catch (e: any) {
      console.warn('[BackgroundLocationManager] Error stopping background location updates:', e?.message || e);
    }
  }

  /**
   * Verify and resume tracking if a logged-in employee session exists and duty is connected
   */
  public async verifyAndResumeTracking(): Promise<void> {
    if (Platform.OS === 'web') return;

    try {
      // Check if duty was connected
      const isConnected = await AsyncStorage.getItem('is_duty_connected');
      if (isConnected !== 'true') {
        console.log('[BackgroundLocationManager] Duty is not connected. Skipping background resume.');
        return;
      }

      // Read saved user session
      const rawUser = await AsyncStorage.getItem(AUTH_KEY);
      if (!rawUser) return;

      const user = JSON.parse(rawUser);
      if (!user || !user.id) return;

      const cleanEmail = (user.email || '').trim().toLowerCase();
      const cleanId = String(user.id || '').trim().toLowerCase();
      const ADMIN_EMAILS = [
        'manthanpandhare1110@gmail.com',
        'pravindagade007@gmail.com',
        'rustumsayyed905@gmail.com',
        'admin_1',
        'admin_2',
        'admin_3'
      ];
      if (user.role === 'admin' || ADMIN_EMAILS.includes(cleanEmail) || cleanId.startsWith('admin')) {
        return;
      }

      const isRunning = await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK_NAME);
      if (!isRunning) {
        console.log('[BackgroundLocationManager] Active duty session found. Resuming background tracking...');
        let journey: any = null;
        try {
          const rawJourney = await AsyncStorage.getItem('active_journey');
          if (rawJourney) journey = JSON.parse(rawJourney);
        } catch (e) {}

        await this.startTracking(user, journey);
      }
    } catch (e) {
      console.warn('[BackgroundLocationManager] Error in verifyAndResumeTracking:', e);
    }
  }
}

export default new BackgroundLocationManager();
