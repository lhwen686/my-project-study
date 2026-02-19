import { useEffect } from 'react';
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';

// Configure foreground notification behavior globally:
// show banner + play sound even when the app is in the foreground.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

const CHANNEL_ID = 'daily-review';

/**
 * Request notification permissions and set up Android notification channel.
 * Returns true if permission was granted.
 */
async function ensurePermissions(): Promise<boolean> {
  // Notifications only work on physical devices
  if (!Device.isDevice) {
    console.warn('[Notifications] Must use a physical device for push notifications');
    return false;
  }

  const { status: existing } = await Notifications.getPermissionsAsync();
  let finalStatus = existing;

  if (existing !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') {
    console.warn('[Notifications] Permission not granted');
    return false;
  }

  // Android requires an explicit notification channel
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
      name: 'Daily Review',
      importance: Notifications.AndroidImportance.HIGH,
      sound: 'default',
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#4A90D9',
    });
  }

  return true;
}

/**
 * Cancel all previously scheduled notifications, then schedule a daily
 * reminder at the given hour and minute (device local time).
 */
async function scheduleDailyReminder(hour = 20, minute = 0): Promise<void> {
  // Wipe any existing scheduled notifications to avoid duplicates
  await Notifications.cancelAllScheduledNotificationsAsync();

  await Notifications.scheduleNotificationAsync({
    content: {
      title: '突触巩固时间到了！🧠',
      body: '今天还有待复习的医学卡片，花几分钟清空它们吧。',
      sound: 'default',
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DAILY,
      hour,
      minute,
      channelId: Platform.OS === 'android' ? CHANNEL_ID : undefined,
    },
  });
}

/**
 * Hook: bootstraps notification permissions and schedules the daily
 * review reminder. Safe to call on every app launch — it is idempotent
 * because `scheduleDailyReminder` cancels then re-creates the schedule.
 */
export function useNotifications() {
  useEffect(() => {
    (async () => {
      try {
        const granted = await ensurePermissions();
        if (granted) {
          await scheduleDailyReminder(20, 0);
        }
      } catch (err) {
        console.error('[Notifications] Setup failed:', err);
      }
    })();
  }, []);
}
