import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';

import { CardShadow, Palette, Radius, Spacing } from '@/constants/design-tokens';
import { StatsSummary, getStatsSummary } from '@/data/sqlite';

type StatsState = { loading: boolean; data: StatsSummary | null; error: boolean };
const INITIAL: StatsState = { loading: true, data: null, error: false };

export default function StatsScreen() {
  const [state, setState] = useState<StatsState>(INITIAL);

  const loadStats = useCallback(async () => {
    setState({ loading: true, data: null, error: false });
    try {
      const summary = await getStatsSummary();
      setState({ loading: false, data: summary, error: false });
    } catch (error) {
      console.error('Failed to load stats:', error);
      setState({ loading: false, data: null, error: true });
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadStats();
    }, [loadStats]),
  );

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>统计</Text>
      {state.loading ? (
        <ActivityIndicator size="large" color={Palette.primary} style={{ marginTop: 24 }} />
      ) : state.error || !state.data ? (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyText}>加载失败，请稍后重试。</Text>
        </View>
      ) : (
        <>
          {/* ── 2×2 stat card grid ── */}
          <View style={styles.grid}>
            <View style={styles.statCard}>
              <Text style={styles.statNumber}>{state.data.todayCompleted}</Text>
              <Text style={styles.statLabel}>今日完成</Text>
            </View>

            <View style={styles.statCard}>
              <Text style={styles.statNumber}>{state.data.streakDays}</Text>
              <Text style={styles.statLabel}>连续天数 🔥</Text>
            </View>

            <View style={[styles.statCard, styles.statCardPrimary]}>
              <Text style={[styles.statNumber, styles.statNumberPrimary]}>
                {state.data.dueCount}
              </Text>
              <Text style={styles.statLabel}>今日待复习</Text>
            </View>

            <View style={[styles.statCard, styles.statCardDanger]}>
              <Text style={[styles.statNumber, styles.statNumberDanger]}>
                {state.data.lapsesCount}
              </Text>
              <Text style={styles.statLabel}>遗忘次数</Text>
            </View>
          </View>

          {/* ── Mastery by deck ── */}
          <Text style={styles.sectionTitle}>按卡包掌握度（7 日正确率）</Text>
          {state.data.masteryByDeck.length === 0 ? (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyText}>最近 7 日暂无复习数据</Text>
            </View>
          ) : (
            state.data.masteryByDeck.map((row) => (
              <View key={row.deck_id} style={styles.masteryCard}>
                <View style={styles.masteryHeader}>
                  <Text style={styles.masteryName}>{row.deck_name}</Text>
                  <Text style={styles.masteryPercent}>{row.accuracy}%</Text>
                </View>
                <View style={styles.progressTrack}>
                  <View style={[styles.progressFill, { width: `${Math.min(row.accuracy, 100)}%` as `${number}%` }]} />
                </View>
                <Text style={styles.masteryDetail}>{row.correct} / {row.total} 正确</Text>
              </View>
            ))
          )}
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: Palette.background,
    padding: Spacing.page,
    gap: Spacing.gap,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: Palette.textPrimary,
    marginBottom: 4,
  },

  // ── Grid ──────────────────────────────────────────────────────────────────
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  statCard: {
    backgroundColor: Palette.surface,
    borderRadius: Radius.card,
    padding: Spacing.cardPad,
    flexBasis: '47%',
    flexGrow: 1,
    alignItems: 'center',
    gap: 4,
    ...CardShadow,
  },
  statCardPrimary: {
    borderTopWidth: 3,
    borderTopColor: Palette.primary,
  },
  statCardDanger: {
    borderTopWidth: 3,
    borderTopColor: Palette.danger,
  },
  statNumber: {
    fontSize: 36,
    fontWeight: '700',
    color: Palette.textPrimary,
    lineHeight: 42,
  },
  statNumberPrimary: {
    color: Palette.primary,
  },
  statNumberDanger: {
    color: Palette.danger,
  },
  statLabel: {
    fontSize: 13,
    color: Palette.textSecondary,
    textAlign: 'center',
  },

  // ── Mastery ───────────────────────────────────────────────────────────────
  sectionTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: Palette.textPrimary,
    marginTop: 4,
  },
  masteryCard: {
    backgroundColor: Palette.surface,
    borderRadius: Radius.card,
    padding: Spacing.cardPad,
    gap: 8,
    ...CardShadow,
  },
  masteryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  masteryName: {
    fontSize: 15,
    fontWeight: '600',
    color: Palette.textPrimary,
    flex: 1,
  },
  masteryPercent: {
    fontSize: 20,
    fontWeight: '700',
    color: Palette.primary,
  },
  progressTrack: {
    height: 6,
    backgroundColor: Palette.divider,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: Palette.primary,
    borderRadius: 3,
  },
  masteryDetail: {
    fontSize: 13,
    color: Palette.textSecondary,
  },

  // ── Empty / Error ─────────────────────────────────────────────────────────
  emptyCard: {
    backgroundColor: Palette.surface,
    borderRadius: Radius.card,
    padding: 32,
    alignItems: 'center',
    ...CardShadow,
  },
  emptyText: {
    color: Palette.textTertiary,
    fontSize: 15,
    textAlign: 'center',
  },
});
