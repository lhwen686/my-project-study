import * as DocumentPicker from 'expo-document-picker';
import * as Sharing from 'expo-sharing';
import { useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { z } from 'zod';

import {
  ExportPayload,
  clearAllData,
  exportAllData,
  getReminderSettings,
  getTodayDueCount,
  importAllData,
  initializeDatabase,
} from '@/data/sqlite';
import { ensureReminderPermissions, updateReminderSettings } from '@/services/notifications';
import { CardShadow, Palette, Radius, Spacing } from '@/constants/design-tokens';

const payloadSchema = z.object({
  schemaVersion: z.number().int(),
  exportedAt: z.string(),
  decks: z.array(z.object({ id: z.number().int(), name: z.string(), description: z.string().nullable(), created_at: z.string() })),
  cards: z.array(
    z.object({
      id: z.number().int(),
      deck_id: z.number().int(),
      front: z.string(),
      back: z.string(),
      tags: z.string().nullable().optional(),
      image_uri: z.string().nullable().optional(),
      occlusions: z.string().nullable().optional(),
      repetition: z.number().int(),
      interval_days: z.number().int(),
      ease_factor: z.number(),
      due_date: z.string(),
      created_at: z.string(),
    }),
  ),
  reviews: z.array(
    z.object({
      id: z.number().int(),
      card_id: z.number().int(),
      reviewed_at: z.string(),
      rating: z.number().int(),
      duration_seconds: z.number().int().optional(),
    }),
  ),
});

async function fs() {
  const moduleName = 'expo-file-system/legacy';
 // eslint-disable-next-line @typescript-eslint/no-var-requires
  return require(moduleName) as any;
}

export default function SettingsScreen() {
  const [status, setStatus] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [hour, setHour] = useState('21');
  const [minute, setMinute] = useState('30');
  const [onCompleted, setOnCompleted] = useState<'skip' | 'completed'>('skip');

  useEffect(() => {
    getReminderSettings().then((s) => {
      setEnabled(s.enabled);
      setHour(String(s.hour));
      setMinute(String(s.minute));
      setOnCompleted(s.onCompleted);
    });
  }, []);

  const saveReminder = async () => {
    const h = Number(hour);
    const m = Number(minute);
    if (!Number.isInteger(h) || !Number.isInteger(m) || h < 0 || h > 23 || m < 0 || m > 59) {
      setStatus('提醒时间格式错误，请输入 0-23 和 0-59');
      return;
    }

    const granted = await ensureReminderPermissions();
    if (enabled && !granted) {
      setStatus('未获得通知权限，无法开启提醒');
      return;
    }

    await updateReminderSettings({ enabled, hour: h, minute: m, onCompleted });
    setStatus(`提醒设置已保存：${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
  };

  const handleExport = async () => {
    if (isLoading) return;
    setIsLoading(true);
    setStatus('导出中...');
    try {
      await initializeDatabase();
      const payload = await exportAllData();
      const fileSystem = await fs();
      const writableDir = fileSystem.documentDirectory ?? fileSystem.cacheDirectory;
      if (!writableDir) throw new Error('未找到可写目录');
      const fileUri = `${writableDir}flashcards-export-${Date.now()}.json`;
      await fileSystem.writeAsStringAsync(fileUri, JSON.stringify(payload, null, 2));
      if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(fileUri, { mimeType: 'application/json' });
      setStatus(`导出成功：${fileUri}`);
    } catch (error) {
      console.error(error);
      setStatus('导出失败');
    } finally {
      setIsLoading(false);
    }
  };

  const importFromJson = async (mode: 'merge' | 'replace') => {
    if (isLoading) return;
    setIsLoading(true);
    setStatus('导入中...');
    try {
      await initializeDatabase();
      const picked = await DocumentPicker.getDocumentAsync({ type: 'application/json', copyToCacheDirectory: true });
      if (picked.canceled || !picked.assets?.[0]?.uri) {
        setStatus('');
        return;
      }
      const fileSystem = await fs();
      const jsonText = await fileSystem.readAsStringAsync(picked.assets[0].uri);
      const parsed = JSON.parse(jsonText);
      const result = payloadSchema.safeParse(parsed);
      if (!result.success) {
        const issue = result.error.issues[0];
        setStatus(`导入失败：字段 ${issue.path.join('.')} - ${issue.message}`);
        return;
      }
      await importAllData(result.data as ExportPayload, mode);
      const after = await exportAllData();
      const due = await getTodayDueCount();
      setStatus(`导入成功（${mode === 'merge' ? '合并' : '覆盖'}）：cards=${after.cards.length}, reviews=${after.reviews.length}, due=${due}`);
    } catch (error) {
      console.error(error);
      setStatus(`导入失败：${error instanceof Error ? error.message : '未知错误'}`);
    } finally {
      setIsLoading(false);
    }
  };

  const clearDatabase = async () => {
    Alert.alert('确认清空', '将删除 decks/cards/reviews 全部数据。', [
      { text: '取消', style: 'cancel' },
      {
        text: '确认',
        style: 'destructive',
        onPress: async () => {
          await clearAllData();
          setStatus('数据库已清空');
        },
      },
    ]);
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>数据管理</Text>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>每日提醒</Text>
        <View style={styles.rowBetween}>
          <Text style={styles.label}>开启提醒</Text>
          <Switch value={enabled} onValueChange={setEnabled} thumbColor={Palette.surface} trackColor={{ true: Palette.primary, false: Palette.border }} />
        </View>
        <View style={styles.row}>
          <TextInput style={styles.timeInput} keyboardType="number-pad" value={hour} onChangeText={setHour} placeholder="21" placeholderTextColor={Palette.textTertiary} />
          <Text style={styles.timeSeparator}>:</Text>
          <TextInput style={styles.timeInput} keyboardType="number-pad" value={minute} onChangeText={setMinute} placeholder="30" placeholderTextColor={Palette.textTertiary} />
        </View>
        <View style={styles.row}>
          <Pressable style={onCompleted === 'skip' ? styles.primary : styles.secondary} onPress={() => setOnCompleted('skip')}>
            <Text style={styles.btnText}>当天完成则不提醒</Text>
          </Pressable>
          <Pressable
            style={onCompleted === 'completed' ? styles.primary : styles.secondary}
            onPress={() => setOnCompleted('completed')}>
            <Text style={styles.btnText}>改为"已完成✅"</Text>
          </Pressable>
        </View>
        <Pressable style={styles.primary} onPress={saveReminder}>
          <Text style={styles.btnText}>保存提醒设置</Text>
        </Pressable>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>导出 JSON 并分享</Text>
        <Pressable style={[styles.primary, isLoading && styles.disabled]} onPress={handleExport} disabled={isLoading}>
          <Text style={styles.btnText}>导出全量数据</Text>
        </Pressable>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>JSON 导入（zod 校验）</Text>
        <View style={styles.row}>
          <Pressable style={[styles.primary, isLoading && styles.disabled]} onPress={() => importFromJson('merge')} disabled={isLoading}>
            <Text style={styles.btnText}>导入（合并）</Text>
          </Pressable>
          <Pressable style={[styles.warn, isLoading && styles.disabled]} onPress={() => importFromJson('replace')} disabled={isLoading}>
            <Text style={styles.btnText}>导入（覆盖）</Text>
          </Pressable>
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>清空数据库（验收辅助）</Text>
        <Pressable style={styles.danger} onPress={clearDatabase}>
          <Text style={styles.btnText}>清空 decks/cards/reviews</Text>
        </Pressable>
      </View>

      <View style={styles.statusContainer}>
        <Text style={styles.statusText}>{status || '等待操作...'}</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: Palette.background,
    gap: Spacing.gap,
    padding: Spacing.page,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: Palette.textPrimary,
  },
  card: {
    backgroundColor: Palette.surface,
    borderRadius: Radius.card,
    gap: 12,
    padding: Spacing.cardPad,
    ...CardShadow,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Palette.textPrimary,
  },
  label: {
    fontSize: 15,
    color: Palette.textPrimary,
  },
  row: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  rowBetween: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  timeInput: {
    backgroundColor: Palette.background,
    borderColor: Palette.border,
    borderRadius: Radius.input,
    borderWidth: 1,
    minWidth: 56,
    padding: 10,
    fontSize: 16,
    color: Palette.textPrimary,
    textAlign: 'center',
  },
  timeSeparator: {
    fontSize: 18,
    fontWeight: '600',
    color: Palette.textSecondary,
  },
  primary: {
    backgroundColor: Palette.primary,
    borderRadius: Radius.button,
    paddingHorizontal: 16,
    paddingVertical: 12,
    alignItems: 'center',
  },
  secondary: {
    backgroundColor: Palette.textTertiary,
    borderRadius: Radius.button,
    paddingHorizontal: 16,
    paddingVertical: 12,
    alignItems: 'center',
  },
  warn: {
    backgroundColor: Palette.warning,
    borderRadius: Radius.button,
    paddingHorizontal: 16,
    paddingVertical: 12,
    alignItems: 'center',
  },
  danger: {
    backgroundColor: Palette.danger,
    borderRadius: Radius.button,
    paddingHorizontal: 16,
    paddingVertical: 12,
    alignItems: 'center',
  },
  btnText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 15,
  },
  disabled: { opacity: 0.5 },
  statusContainer: {
    backgroundColor: Palette.primaryLight,
    borderRadius: Radius.button,
    padding: 12,
    marginTop: 4,
  },
  statusText: {
    color: Palette.primary,
    fontSize: 14,
    fontWeight: '500',
    textAlign: 'center',
  },
});
