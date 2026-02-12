import { Platform } from 'react-native';

import { getNotificationDigest, getReminderSettings, saveReminderSettings } from '@/data/sqlite';

const REMINDER_ID_KEY = 'reminderNotificationId';

async function getNotificationsModule() {
  if (Platform.OS === 'web') return null;
  return import('expo-notifications');
}

export async function ensureReminderPermissions() {
  const Notifications = await getNotificationsModule();
  if (!Notifications) return true;

  const perms = await Notifications.getPermissionsAsync();
  if (perms.granted) return true;
  const req = await Notifications.requestPermissionsAsync();
  return req.granted;
}

export async function rescheduleDailyReminder() {
  const Notifications = await getNotificationsModule();
  const settings = await getReminderSettings();
  if (!Notifications) return;

  const existingId = (globalThis as any)[REMINDER_ID_KEY] as string | undefined;
  if (existingId) {
    try {
      await Notifications.cancelScheduledNotificationAsync(existingId);
    } catch {}
  }

  if (!settings.enabled) {
    (globalThis as any)[REMINDER_ID_KEY] = undefined;
    return;
  }

  const digest = await getNotificationDigest();
  if (digest.completedToday && settings.onCompleted === 'skip') {
    (globalThis as any)[REMINDER_ID_KEY] = undefined;
    return;
  }

  const now = new Date();
  const target = new Date(now);
  target.setHours(settings.hour, settings.minute, 0, 0);
  if (target <= now) target.setDate(target.getDate() + 1);

  const body = digest.completedToday
    ? '今日复习已完成✅'
    : `今日待复习 ${digest.dueCount} 张，预计 ${digest.estimatedMinutes} 分钟`;

  const id = await Notifications.scheduleNotificationAsync({
    content: { title: '复习提醒', body },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: target },
  });
  (globalThis as any)[REMINDER_ID_KEY] = id;
}

export async function updateReminderSettings(next: {
  enabled: boolean;
  hour: number;
  minute: number;
  onCompleted: 'skip' | 'completed';
}) {
  await saveReminderSettings(next);
  await rescheduleDailyReminder();
}
