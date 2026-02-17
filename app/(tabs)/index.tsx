import { Link, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { getDecksDueToday } from '@/data/sqlite';

type DeckDue = { id: number; name: string; due_count: number };

export default function HomeScreen() {
  const [decks, setDecks] = useState<DeckDue[]>([]);
  const [loading, setLoading] = useState(true);

  const loadDue = useCallback(async () => {
    setLoading(true);
    try {
      const rows = await getDecksDueToday();
      setDecks(rows);
    } catch (error) {
      console.error('Failed to load due counts:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadDue();
    }, [loadDue]),
  );

  const dueDecks = decks.filter((d) => d.due_count > 0);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Home · 今日复习</Text>
      {loading ? (
        <ActivityIndicator size="large" />
      ) : dueDecks.length === 0 ? (
        <Text style={styles.empty}>🎉 今日无待复习卡片！</Text>
      ) : (
        dueDecks.map((deck) => (
          <Link key={deck.id} href={`/review/${deck.id}`} style={styles.card}>
            {deck.name}：待复习 {deck.due_count} 张
          </Link>
        ))
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    gap: 12,
    padding: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 8,
  },
  card: {
    backgroundColor: '#f2f4f7',
    borderRadius: 12,
    fontSize: 16,
    overflow: 'hidden',
    padding: 14,
  },
  empty: {
    color: '#667085',
    fontSize: 16,
  },
});
