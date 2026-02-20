import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import * as Haptics from 'expo-haptics';
import * as Sharing from 'expo-sharing';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { z } from 'zod';

import {
  ExportPayload,
  clearAllData,
  exportAllData,
  getTodayDueCount,
  importAllData,
  initializeDatabase,
} from '@/data/sqlite';
import { CardShadow, Palette, Radius, Spacing } from '@/constants/design-tokens';

// ─── Zod schema (internal, invisible to user) ────────────────────────────────
const payloadSchema = z.object({
  schemaVersion: z.number().int(),
  exportedAt: z.string(),
  decks: z.array(
    z.object({
      id: z.number().int(),
      name: z.string(),
      description: z.string().nullable(),
      created_at: z.string(),
    }),
  ),
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

// ─── Toast Component ──────────────────────────────────────────────────────────
type ToastType = 'success' | 'error' | 'info';

function Toast({
  message,
  type,
  visible,
}: {
  message: string;
  type: ToastType;
  visible: boolean;
}) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(-20)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(opacity, {
          toValue: 1,
          duration: 250,
          useNativeDriver: true,
        }),
        Animated.timing(translateY, {
          toValue: 0,
          duration: 250,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(opacity, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(translateY, {
          toValue: -20,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible, opacity, translateY]);

  if (!message) return null;

  const bgColor =
    type === 'success'
      ? Palette.success
      : type === 'error'
        ? Palette.danger
        : Palette.primary;

  return (
    <Animated.View
      style={[
        toastStyles.container,
        { backgroundColor: bgColor, opacity, transform: [{ translateY }] },
      ]}
      pointerEvents="none"
    >
      <Ionicons
        name={
          type === 'success'
            ? 'checkmark-circle'
            : type === 'error'
              ? 'close-circle'
              : 'information-circle'
        }
        size={18}
        color="#FFFFFF"
      />
      <Text style={toastStyles.text} numberOfLines={2}>
        {message}
      </Text>
    </Animated.View>
  );
}

const toastStyles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 12,
    left: Spacing.page,
    right: Spacing.page,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: Radius.button,
    zIndex: 100,
  },
  text: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '500',
    flex: 1,
  },
});

// ─── SettingRow Component ─────────────────────────────────────────────────────
function SettingRow({
  icon,
  iconColor = Palette.primary,
  title,
  subtitle,
  buttonLabel,
  buttonColor = Palette.primary,
  onPress,
  disabled = false,
  danger = false,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  iconColor?: string;
  title: string;
  subtitle: string;
  buttonLabel: string;
  buttonColor?: string;
  onPress: () => void;
  disabled?: boolean;
  danger?: boolean;
}) {
  return (
    <Pressable
      style={({ pressed }) => [
        rowStyles.container,
        danger && rowStyles.dangerContainer,
        pressed && rowStyles.pressed,
        disabled && rowStyles.disabled,
      ]}
      onPress={onPress}
      disabled={disabled}
    >
      <View
        style={[
          rowStyles.iconWrap,
          { backgroundColor: danger ? '#FEE2E2' : Palette.primaryLight },
        ]}
      >
        <Ionicons name={icon} size={20} color={iconColor} />
      </View>
      <View style={rowStyles.content}>
        <Text
          style={[rowStyles.title, danger && { color: Palette.danger }]}
          numberOfLines={1}
        >
          {title}
        </Text>
        <Text style={rowStyles.subtitle} numberOfLines={2}>
          {subtitle}
        </Text>
      </View>
      <View
        style={[
          rowStyles.badge,
          { backgroundColor: buttonColor },
          disabled && { opacity: 0.5 },
        ]}
      >
        <Text style={rowStyles.badgeText}>{buttonLabel}</Text>
      </View>
    </Pressable>
  );
}

const rowStyles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Palette.surface,
    paddingVertical: 14,
    paddingHorizontal: Spacing.cardPad,
    gap: 12,
  },
  dangerContainer: {
    backgroundColor: Palette.surface,
  },
  pressed: {
    backgroundColor: Palette.divider,
  },
  disabled: {
    opacity: 0.6,
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    flex: 1,
    gap: 2,
  },
  title: {
    fontSize: 15,
    fontWeight: '600',
    color: Palette.textPrimary,
  },
  subtitle: {
    fontSize: 13,
    color: Palette.textSecondary,
    lineHeight: 18,
  },
  badge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: Radius.badge,
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
  },
});

// ─── Main Screen ──────────────────────────────────────────────────────────────
export default function SettingsScreen() {
  const [isLoading, setIsLoading] = useState(false);
  const [toast, setToast] = useState<{
    message: string;
    type: ToastType;
    visible: boolean;
  }>({ message: '', type: 'info', visible: false });
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = useCallback(
    (message: string, type: ToastType = 'info') => {
      if (toastTimer.current) clearTimeout(toastTimer.current);
      setToast({ message, type, visible: true });
      toastTimer.current = setTimeout(() => {
        setToast((prev) => ({ ...prev, visible: false }));
      }, 3000);
    },
    [],
  );

  const handleExport = async () => {
    if (isLoading) return;
    setIsLoading(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    showToast('正在导出...', 'info');
    try {
      await initializeDatabase();
      const payload = await exportAllData();
      const fileSystem = await fs();
      const writableDir =
        fileSystem.documentDirectory ?? fileSystem.cacheDirectory;
      if (!writableDir) throw new Error('未找到可写目录');
      const fileUri = `${writableDir}flashcards-export-${Date.now()}.json`;
      await fileSystem.writeAsStringAsync(
        fileUri,
        JSON.stringify(payload, null, 2),
      );
      if (await Sharing.isAvailableAsync())
        await Sharing.shareAsync(fileUri, { mimeType: 'application/json' });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      showToast('备份文件已导出', 'success');
    } catch (error) {
      console.error(error);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      showToast('导出失败，请重试', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const importFromJson = async (mode: 'merge' | 'replace') => {
    if (isLoading) return;
    setIsLoading(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    showToast('正在导入...', 'info');
    try {
      await initializeDatabase();
      const picked = await DocumentPicker.getDocumentAsync({
        type: 'application/json',
        copyToCacheDirectory: true,
      });
      if (picked.canceled || !picked.assets?.[0]?.uri) {
        setToast((prev) => ({ ...prev, visible: false }));
        return;
      }
      const fileSystem = await fs();
      const jsonText = await fileSystem.readAsStringAsync(
        picked.assets[0].uri,
      );
      const parsed = JSON.parse(jsonText);
      const result = payloadSchema.safeParse(parsed);
      if (!result.success) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        showToast('文件格式不正确，请检查后重试', 'error');
        return;
      }
      await importAllData(result.data as ExportPayload, mode);
      const after = await exportAllData();
      const due = await getTodayDueCount();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      const modeLabel = mode === 'merge' ? '合并' : '覆盖恢复';
      showToast(
        `${modeLabel}成功！共 ${after.cards.length} 张卡片，今日待复习 ${due} 张`,
        'success',
      );
    } catch (error) {
      console.error(error);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      showToast(
        `导入失败：${error instanceof Error ? error.message : '未知错误'}`,
        'error',
      );
    } finally {
      setIsLoading(false);
    }
  };

  const clearDatabase = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    Alert.alert(
      '确定要清空所有数据吗？',
      '此操作不可逆，所有的卡片和复习记录都将被永久删除！',
      [
        { text: '取消', style: 'cancel' },
        {
          text: '确定',
          style: 'destructive',
          onPress: async () => {
            try {
              await clearAllData();
              Haptics.notificationAsync(
                Haptics.NotificationFeedbackType.Success,
              );
              showToast('所有数据已清除', 'success');
            } catch (error) {
              console.error(error);
              Haptics.notificationAsync(
                Haptics.NotificationFeedbackType.Error,
              );
              showToast('清除失败，请重试', 'error');
            }
          },
        },
      ],
    );
  };

  return (
    <View style={styles.root}>
      <Toast
        message={toast.message}
        type={toast.type}
        visible={toast.visible}
      />
      <ScrollView
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Section: 备份我的记忆卡库 ──────────────────────────── */}
        <View style={styles.section}>
          <Text style={styles.sectionHeader}>备份我的记忆卡库</Text>
          <Text style={styles.sectionDesc}>
            将所有卡片和复习进度导出为文件，妥善保存。
          </Text>
          <View style={styles.listCard}>
            <SettingRow
              icon="cloud-download-outline"
              title="导出备份"
              subtitle="生成备份文件并通过分享发送"
              buttonLabel="导出"
              onPress={handleExport}
              disabled={isLoading}
            />
          </View>
        </View>

        {/* ── Section: 恢复与导入 ────────────────────────────────── */}
        <View style={styles.section}>
          <Text style={styles.sectionHeader}>恢复与导入</Text>
          <View style={styles.listCard}>
            <SettingRow
              icon="cloud-upload-outline"
              title="覆盖恢复"
              subtitle="用于还原备份，将替换当前所有数据"
              buttonLabel="恢复"
              buttonColor={Palette.warning}
              onPress={() => importFromJson('replace')}
              disabled={isLoading}
            />
            <View style={styles.separator} />
            <SettingRow
              icon="add-circle-outline"
              title="合并导入"
              subtitle="用于添加新题库，不会覆盖已有数据"
              buttonLabel="导入"
              onPress={() => importFromJson('merge')}
              disabled={isLoading}
            />
          </View>
        </View>

        {/* ── Section: 危险操作区 ────────────────────────────────── */}
        <View style={styles.section}>
          <Text style={[styles.sectionHeader, { color: Palette.danger }]}>
            危险操作区
          </Text>
          <View style={styles.listCard}>
            <SettingRow
              icon="trash-outline"
              iconColor={Palette.danger}
              title="抹除所有应用数据"
              subtitle="清空全部卡片、复习记录，此操作不可逆"
              buttonLabel="抹除"
              buttonColor={Palette.danger}
              onPress={clearDatabase}
              danger
            />
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

// ─── Screen Styles ────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Palette.background,
  },
  container: {
    paddingTop: 8,
    paddingBottom: 40,
    gap: Spacing.gap + 8,
  },
  section: {
    gap: 6,
  },
  sectionHeader: {
    fontSize: 13,
    fontWeight: '600',
    color: Palette.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    paddingHorizontal: Spacing.page,
  },
  sectionDesc: {
    fontSize: 13,
    color: Palette.textTertiary,
    paddingHorizontal: Spacing.page,
    marginBottom: 2,
  },
  listCard: {
    backgroundColor: Palette.surface,
    marginHorizontal: Spacing.page,
    borderRadius: Radius.card,
    overflow: 'hidden',
    ...CardShadow,
  },
  separator: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: Palette.border,
    marginLeft: Spacing.cardPad + 36 + 12, // icon wrap + gap
  },
});
