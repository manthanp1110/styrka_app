import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { initializeAuth, Auth, getAuth } from 'firebase/auth';
import { initializeFirestore, Firestore } from 'firebase/firestore';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

// @ts-ignore - getReactNativePersistence is exported by @firebase/auth react-native entrypoint
import { getReactNativePersistence } from 'firebase/auth';

const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY || '',
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN || '',
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID || '',
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET || '',
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || '',
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID || '',
};

export const isFirebaseConfigured: boolean = !!(
  firebaseConfig.apiKey &&
  firebaseConfig.projectId &&
  !firebaseConfig.apiKey.includes('your-')
);

let app: FirebaseApp | null = null;
let auth: Auth | null = null;
let db: Firestore | null = null;

if (isFirebaseConfigured) {
  try {
    app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
    if (Platform.OS === 'web') {
      auth = getAuth(app);
    } else {
      try {
        if (typeof getReactNativePersistence === 'function') {
          auth = initializeAuth(app, {
            persistence: getReactNativePersistence(AsyncStorage),
          });
        } else {
          auth = getAuth(app);
        }
      } catch (e) {
        auth = getAuth(app);
      }
    }
    db = initializeFirestore(app, {
      experimentalForceLongPolling: true,
    });
    console.log('[Firebase] Initialized successfully for project:', firebaseConfig.projectId);
  } catch (error) {
    console.warn('[Firebase] Initialization error:', error);
  }
} else {
  console.log('[Firebase] Not configured yet. Running in offline/resilient mode with local & backend fallbacks.');
}

export { app, auth, db };
export default app;
