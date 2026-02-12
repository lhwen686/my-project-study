import { Link, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

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
      <Text style={styles.title}>Decks · 科目列表</Text>
      {loading ? (
        <ActivityIndicator size="large" />
      ) : (
        decks.map((deck) => (
          <Link key={deck.id} href={`/deck/${deck.id}`} style={styles.item}>
            {deck.name}
            {deck.description ? ` · ${deck.description}` : ''}
          </Link>
        ))
      )}
      {!loading && decks.length === 0 ? <Text style={styles.empty}>暂无科目，请先创建 Deck。</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, gap: 12, padding: 16 },
  title: { fontSize: 24, fontWeight: '700', marginBottom: 8 },
  item: {
    borderColor: '#d0d5dd',
    borderRadius: 12,
    borderWidth: 1,
    fontSize: 16,
    padding: 14,
  },
  empty: {
    color: '#667085',
    fontSize: 16,
  },
});
