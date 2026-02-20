import { Link, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { CardShadow, Palette, Radius, Spacing } from '@/constants/design-tokens';
import { Deck, getDecks } from '@/data/sqlite';

export default function DecksScreen() {
  const [decks, setDecks] = useState<Deck[]>([]);
  const [loading, setLoading] = useState(true);

  const loadDecks = useCallback(async () => {
    setLoading(true);
    try {
      const rows = await getDecks();
      setDecks(rows);
    } catch (error) {
      console.error('Failed to load decks:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadDecks();
    }, [loadDecks]),
  );

  return (
    <View style={styles.container}>
      <Text style={styles.title}>卡包</Text>
      {loading ? (
        <ActivityIndicator size="large" color={Palette.primary} style={{ marginTop: 24 }} />
      ) : decks.length === 0 ? (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyIcon}>📚</Text>
          <Text style={styles.emptyTitle}>暂无科目</Text>
          <Text style={styles.emptyText}>请先创建一个卡包</Text>
        </View>
      ) : (
        decks.map((deck) => (
          <Link key={deck.id} href={`/deck/${deck.id}`} asChild>
            <Pressable style={styles.item}>
              <Text style={styles.itemName}>{deck.name}</Text>
              {!!deck.description && (
                <Text style={styles.itemDescription}>{deck.description}</Text>
              )}
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
  item: {
    backgroundColor: Palette.surface,
    borderRadius: Radius.card,
    padding: Spacing.cardPad,
    gap: 4,
    ...CardShadow,
  },
  itemName: {
    fontSize: 16,
    fontWeight: '600',
    color: Palette.textPrimary,
  },
  itemDescription: {
    fontSize: 14,
    color: Palette.textSecondary,
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
