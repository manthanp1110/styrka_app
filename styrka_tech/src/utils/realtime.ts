/**
 * Realtime helper stubs (Supabase disconnected)
 */

export const subscribeToEmployeeLocations = (
  userId: string | null,
  onInsert: (location: any) => void
): any => {
  console.log('[Realtime] Subscription active for local storage polling');
  return { unsubscribe: () => {} };
};

export const trackPresence = (
  userId: string,
  userInfo: { name?: string; role?: string }
): any => {
  return { unsubscribe: () => {} };
};

export const unsubscribeChannel = (channelKey: string) => {
  console.log(`[Realtime] Unsubscribed channel ${channelKey}`);
};

export const unsubscribeAll = () => {};

