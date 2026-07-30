import { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from '../config/supabase';

const activeChannels: { [key: string]: RealtimeChannel } = {};

/**
 * Subscribe to real-time location updates for a specific employee or all employees.
 */
export const subscribeToEmployeeLocations = (
  userId: string | null,
  onInsert: (location: any) => void
): RealtimeChannel => {
  const channelKey = userId ? `locations-${userId}` : 'locations-all';

  if (activeChannels[channelKey]) {
    return activeChannels[channelKey];
  }

  const channel = supabase
    .channel(channelKey)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'employee_locations',
        ...(userId ? { filter: `user_id=eq.${userId}` } : {}),
      },
      (payload) => {
        if (payload.new) {
          onInsert(payload.new);
        }
      }
    )
    .subscribe((status) => {
      console.log(`[Realtime] Subscription status for ${channelKey}:`, status);
    });

  activeChannels[channelKey] = channel;
  return channel;
};

/**
 * Track employee online presence using Supabase Presence.
 */
export const trackPresence = (
  userId: string,
  userInfo: { name?: string; role?: string }
): RealtimeChannel => {
  const channelKey = `presence-${userId}`;

  if (activeChannels[channelKey]) {
    return activeChannels[channelKey];
  }

  const channel = supabase.channel('online-employees', {
    config: {
      presence: {
        key: userId,
      },
    },
  });

  channel.subscribe(async (status) => {
    if (status === 'SUBSCRIBED') {
      await channel.track({
        user_id: userId,
        online_at: new Date().toISOString(),
        ...userInfo,
      });
      console.log(`[Realtime] Presence tracked for user ${userId}`);
    }
  });

  activeChannels[channelKey] = channel;
  return channel;
};

/**
 * Unsubscribe and clean up a specific channel.
 */
export const unsubscribeChannel = (channelKey: string) => {
  if (activeChannels[channelKey]) {
    supabase.removeChannel(activeChannels[channelKey]);
    delete activeChannels[channelKey];
    console.log(`[Realtime] Unsubscribed channel ${channelKey}`);
  }
};

/**
 * Unsubscribe all active realtime channels (e.g. on logout).
 */
export const unsubscribeAll = () => {
  Object.keys(activeChannels).forEach((key) => {
    unsubscribeChannel(key);
  });
};
