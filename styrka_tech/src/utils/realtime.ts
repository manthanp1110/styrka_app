/**
 * Realtime helper using Firebase Firestore onSnapshot listeners
 */
import { collection, onSnapshot, Unsubscribe } from 'firebase/firestore';
import { db, isFirebaseConfigured } from '../config/firebase';

export const subscribeToEmployeeLocations = (
  userId: string | null,
  onInsert: (location: any) => void
): { unsubscribe: () => void } => {
  if (db && isFirebaseConfigured) {
    try {
      const q = collection(db, 'live_locations');
      const unsubscribe = onSnapshot(
        q,
        (snapshot) => {
          snapshot.docChanges().forEach((change) => {
            if (change.type === 'added' || change.type === 'modified') {
              const data = change.doc.data();
              if (onInsert) {
                onInsert(data);
              }
            }
          });
        },
        (error) => {
          console.warn('[Realtime] Firestore onSnapshot listener error:', error);
        }
      );
      return { unsubscribe };
    } catch (e) {
      console.warn('[Realtime] Error attaching Firestore onSnapshot:', e);
    }
  }

  console.log('[Realtime] Running in local/offline fallback mode');
  return { unsubscribe: () => {} };
};

export const trackPresence = (
  userId: string,
  userInfo: { name?: string; role?: string }
): { unsubscribe: () => void } => {
  return { unsubscribe: () => {} };
};

export const unsubscribeChannel = (channelKey: string) => {
  console.log(`[Realtime] Unsubscribed channel ${channelKey}`);
};

export const unsubscribeAll = () => {};
