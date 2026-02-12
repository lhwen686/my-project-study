import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { DeckMastery, getStatsSummary } from '@/data/sqlite';

export default function StatsScreen() {
  const [loading, setLoading] = useState(true);
  const [dueCount, setDueCount] = useState(0);
  const [todayCompleted, setTodayCompleted] = useState(0);
  const [streakDays, setStreakDays] = useState(0);
  const [lapsesCount, setLapsesCount] = useState(0);
  const [masteryByDeck, setMasteryByDeck] = useState<DeckMastery[]>([]);

  const loadStats = useCallback(async () => {
    setLoading(true);
    try {
      const summary = await getStatsSummary();
      setDueCount(summary.dueCount);
      setTodayCompleted(summary.todayCompleted);
      setStreakDays(summary.streakDays);
      setLapsesCount(summary.lapsesCount);
      setMasteryByDeck(summary.masteryByDeck);
    } catch (error) {
      console.error('Failed to load stats:', error);
      setDueCount(0);
      setTodayCompleted(0);
      setStreakDays(0);
      setLapsesCount(0);
      setMasteryByDeck([]);
    } finally {
      setLoading(false);
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
      {loading ? (
        <ActivityIndicator size="small" />
      ) : (
        <>
          <Text style={styles.text}>今日完成：{todayCompleted} 张</Text>
          <Text style={styles.text}>连续天数：{streakDays} 天</Text>
          <Text style={styles.due}>今日待复习：{dueCount} 张</Text>
          <Text style={styles.lapses}>Lapses（不会）：{lapsesCount}</Text>

          <Text style={styles.sectionTitle}>按 Deck 掌握度（7 日正确率）</Text>
          {masteryByDeck.length === 0 ? (
            <Text style={styles.empty}>最近 7 日暂无复习数据</Text>
          ) : (
            masteryByDeck.map((row) => (
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
