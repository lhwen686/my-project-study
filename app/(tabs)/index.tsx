import { Link, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { CardShadow, Palette, Radius, Spacing } from '@/constants/design-tokens';
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
      <Text style={styles.title}>今日复习</Text>
      {loading ? (
        <ActivityIndicator size="large" color={Palette.primary} style={{ marginTop: 24 }} />
      ) : dueDecks.length === 0 ? (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyIcon}>🎉</Text>
          <Text style={styles.emptyTitle}>全部完成！</Text>
          <Text style={styles.emptyText}>今日无待复习卡片</Text>
        </View>
      ) : (
        dueDecks.map((deck) => (
          <Link key={deck.id} href={`/review/${deck.id}`} asChild>
            <Pressable style={styles.card}>
              <View style={styles.cardRow}>
                <Text style={styles.cardName}>{deck.name}</Text>
                <View style={styles.dueBlock}>
                  <Text style={styles.dueNumber}>{deck.due_count}</Text>
                  <Text style={styles.dueLabel}>待复习</Text>
                </View>
              </View>
            </Pressable>
          </Link>
        ))
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
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
  card: {
    backgroundColor: Palette.surface,
    borderRadius: Radius.card,
    padding: Spacing.cardPad,
    ...CardShadow,
  },
  cardRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardName: {
    fontSize: 17,
    fontWeight: '600',
    color: Palette.textPrimary,
    flex: 1,
  },
  dueBlock: {
    alignItems: 'center',
    minWidth: 48,
  },
  dueNumber: {
    fontSize: 28,
    fontWeight: '700',
    color: Palette.primary,
    lineHeight: 32,
  },
  dueLabel: {
    fontSize: 12,
    color: Palette.textSecondary,
    marginTop: 2,
  },
  emptyCard: {
    backgroundColor: Palette.surface,
    borderRadius: Radius.card,
    padding: 40,
    alignItems: 'center',
    marginTop: 8,
    ...CardShadow,
  },
  emptyIcon: {
    fontSize: 44,
    marginBottom: 12,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Palette.textPrimary,
    marginBottom: 4,
  },
  emptyText: {
    fontSize: 15,
    color: Palette.textTertiary,
  },
});
