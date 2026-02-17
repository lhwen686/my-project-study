import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

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
    <View style={styles.container}>
      <Text style={styles.title}>Stats · 统计</Text>
      {state.loading ? (
        <ActivityIndicator size="large" />
      ) : state.error || !state.data ? (
        <Text style={styles.empty}>加载失败，请稍后重试。</Text>
      ) : (
        <>
          <Text style={styles.text}>今日完成：{state.data.todayCompleted} 张</Text>
          <Text style={styles.text}>连续天数：{state.data.streakDays} 天</Text>
          <Text style={styles.due}>今日待复习：{state.data.dueCount} 张</Text>
          <Text style={styles.lapses}>Lapses（不会）：{state.data.lapsesCount}</Text>

          <Text style={styles.sectionTitle}>按 Deck 掌握度（7 日正确率）</Text>
          {state.data.masteryByDeck.length === 0 ? (
            <Text style={styles.empty}>最近 7 日暂无复习数据</Text>
          ) : (
            state.data.masteryByDeck.map((row) => (
              <Text key={row.deck_id} style={styles.masteryRow}>
                {row.deck_name}：{row.accuracy}%（{row.correct}/{row.total}）
              </Text>
            ))
          )}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, gap: 10, padding: 16 },
  title: { fontSize: 24, fontWeight: '700', marginBottom: 8 },
  text: { fontSize: 18 },
  due: { color: '#155eef', fontSize: 18, fontWeight: '600' },
  lapses: { color: '#d92d20', fontSize: 18, fontWeight: '600' },
  sectionTitle: { fontSize: 17, fontWeight: '700', marginTop: 10 },
  empty: { color: '#667085', fontSize: 15 },
  masteryRow: { fontSize: 16 },
});
