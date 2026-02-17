import { useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Image, Pressable, StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';

import { parseOcclusions, pickRandomOcclusion, toAbsoluteRect } from '@/data/occlusion';
import { Card, getTodayDueCardsByDeckId, reviewCard } from '@/data/sqlite';
import { rescheduleDailyReminder } from '@/services/notifications';

const RATING_OPTIONS = [
  { label: '会', value: 5, style: 'good' as const },
  { label: '模糊', value: 3, style: 'meh' as const },
  { label: '不会', value: 1, style: 'bad' as const },
];

const IMAGE_HEIGHT = 220;

export default function ReviewScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const deckId = Number(id);

  const [loading, setLoading] = useState(true);
  const [cards, setCards] = useState<Card[]>([]);
  const [index, setIndex] = useState(0);
  const [showBack, setShowBack] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [shownAt, setShownAt] = useState<number>(Date.now());
  const [imageBoxSize, setImageBoxSize] = useState({ width: 1, height: IMAGE_HEIGHT });
  const [questionMask, setQuestionMask] = useState<OcclusionRect | null>(null);

  const currentCard = cards[index] ?? null;
  const finished = !loading && cards.length > 0 && index >= cards.length;
  const emptyDue = !loading && cards.length === 0;

  useEffect(() => {
    if (!Number.isFinite(deckId)) {
      setLoading(false);
      return;
    }

    const load = async () => {
      setLoading(true);
      try {
        const dueCards = await getTodayDueCardsByDeckId(deckId);
        setCards(dueCards);
        setIndex(0);
        setShowBack(false);
        setShownAt(Date.now());
        await rescheduleDailyReminder();
      } catch (error) {
        console.error('Failed to load due cards:', error);
        setCards([]);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [deckId]);

  useEffect(() => {
    if (!currentCard) {
      setQuestionMask(null);
      return;
    }
    const occlusions = parseOcclusions(currentCard.occlusions);
    setQuestionMask(pickRandomOcclusion(occlusions));
  }, [currentCard]);

  const progressText = useMemo(() => {
    if (cards.length === 0) return '0 / 0';
    return `${Math.min(index + 1, cards.length)} / ${cards.length}`;
  }, [cards.length, index]);

  const onGrade = async (rating: number) => {
    if (!currentCard || submitting) return;

    setSubmitting(true);
    try {
      const durationSeconds = Math.max(1, Math.round((Date.now() - shownAt) / 1000));
      await reviewCard(currentCard.id, rating, new Date(), durationSeconds);
      setIndex((prev) => prev + 1);
      setShowBack(false);
      setShownAt(Date.now());
      await rescheduleDailyReminder();
    } catch (error) {
      console.error('Failed to submit review result:', error);
    } finally {
      setSubmitting(false);
    }
  };

  const onImageLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    if (width > 0 && height > 0) setImageBoxSize({ width, height });
  };

  if (!Number.isFinite(deckId)) {
    return (
      <View style={styles.center}>
        <Text style={styles.title}>Review · 复习界面</Text>
        <Text style={styles.message}>无效的 deck id：{String(id)}</Text>
      </View>
    );
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
        <Text style={styles.message}>正在加载今日待复习卡片...</Text>
      </View>
    );
  }

  if (emptyDue || finished) {
    return (
      <View style={styles.center}>
        <Text style={styles.title}>Review · 复习界面</Text>
        <Text style={styles.done}>🎉 今日 due 卡片已复习完成！</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Review · 复习界面</Text>
      <Text style={styles.progress}>进度：{progressText}</Text>

      <View style={styles.card}>
        <Text style={styles.faceLabel}>正面</Text>
        <Text style={styles.faceText}>{currentCard?.front}</Text>

        {!!currentCard?.image_uri && (
          <View style={styles.imageWrap} onLayout={onImageLayout}>
            <Image source={{ uri: currentCard.image_uri }} style={styles.image} resizeMode="cover" />
            {!!questionMask && (() => {
              const abs = toAbsoluteRect(questionMask, imageBoxSize.width, imageBoxSize.height);
              return (
                <View style={[styles.maskRect, { left: abs.left, top: abs.top, width: abs.width, height: abs.height }]}>
                  <Text style={styles.maskText}>{showBack ? questionMask.label || '答案' : '?'}</Text>
                </View>
              );
            })()}
          </View>
        )}

        {showBack ? (
          <>
            <Text style={styles.faceLabel}>背面</Text>
            <Text style={styles.answerText}>{currentCard?.back}</Text>
            {!!questionMask?.label && <Text style={styles.labelText}>遮挡结构：{questionMask.label}</Text>}
          </>
        ) : null}
      </View>

      {!showBack ? (
        <Pressable style={styles.flipButton} onPress={() => setShowBack(true)}>
          <Text style={styles.flipButtonText}>点击翻面</Text>
        </Pressable>
      ) : (
        <View style={styles.actions}>
          {RATING_OPTIONS.map((option) => (
            <Pressable
              key={option.label}
              style={[
                styles.actionButton,
                option.style === 'good' && styles.good,
                option.style === 'meh' && styles.meh,
                option.style === 'bad' && styles.bad,
              ]}
              onPress={() => onGrade(option.value)}
              disabled={submitting}>
              <Text style={styles.actionText}>{option.label}</Text>
            </Pressable>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12, padding: 16 },
  title: { fontSize: 24, fontWeight: '700' },
  progress: { color: '#667085', fontSize: 16, marginTop: 8 },
  card: {
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    gap: 8,
    marginTop: 18,
    padding: 16,
  },
  faceLabel: { color: '#475467', fontSize: 14 },
  faceText: { fontSize: 22, fontWeight: '700' },
  answerText: { fontSize: 20, marginTop: 6 },
  labelText: { color: '#155eef', fontSize: 14 },
  flipButton: {
    backgroundColor: '#155eef',
    borderRadius: 10,
    marginTop: 16,
    padding: 14,
  },
  flipButtonText: { color: '#fff', fontSize: 16, textAlign: 'center' },
  actions: { gap: 10, marginTop: 16 },
  actionButton: { borderRadius: 10, padding: 14 },
  good: { backgroundColor: '#17b26a' },
  meh: { backgroundColor: '#f79009' },
  bad: { backgroundColor: '#d92d20' },
  actionText: { color: '#fff', fontSize: 16, fontWeight: '600', textAlign: 'center' },
  message: { color: '#667085', fontSize: 16 },
  done: { color: '#155eef', fontSize: 20, fontWeight: '700', textAlign: 'center' },
  imageWrap: {
    width: '100%',
    height: IMAGE_HEIGHT,
    borderRadius: 10,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#98a2b3',
    position: 'relative',
  },
  image: { width: '100%', height: '100%' },
  maskRect: {
    position: 'absolute',
    backgroundColor: 'rgba(16, 24, 40, 0.72)',
    borderColor: '#fff',
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  maskText: { color: '#fff', fontWeight: '700' },
});
