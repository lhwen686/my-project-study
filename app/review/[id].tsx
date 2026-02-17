import { useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Image, Pressable, StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';

import { parseOcclusions, pickRandomOcclusion, toAbsoluteRect } from '@/data/occlusion';
import { Card, getTodayDueCardsByDeckId, reviewCard } from '@/data/sqlite';
import { rescheduleDailyReminder } from '@/services/notifications';
import { CardShadow, CardShadowHeavy, Palette, Radius, Spacing } from '@/constants/design-tokens';

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
        <Text style={styles.message}>无效的 deck id：{String(id)}</Text>
      </View>
    );
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={Palette.primary} />
        <Text style={styles.message}>正在加载今日待复习卡片...</Text>
      </View>
    );
  }

  if (emptyDue || finished) {
    return (
      <View style={styles.center}>
        <View style={styles.doneCard}>
          <Text style={styles.doneEmoji}>🎉</Text>
          <Text style={styles.done}>今日复习全部完成！</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.progressBadge}>
        <Text style={styles.progressText}>{progressText}</Text>
      </View>

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
  // ── Containers ──────────────────────────────────────────────────────────────
  container: {
    flex: 1,
    backgroundColor: Palette.background,
    padding: Spacing.page,
  },
  center: {
    flex: 1,
    backgroundColor: Palette.background,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
    padding: Spacing.page,
  },

  // ── Progress badge ───────────────────────────────────────────────────────────
  progressBadge: {
    backgroundColor: Palette.primaryLight,
    borderRadius: Radius.badge,
    paddingHorizontal: 14,
    paddingVertical: 6,
    alignSelf: 'flex-start',
    marginBottom: 4,
  },
  progressText: {
    color: Palette.primary,
    fontSize: 14,
    fontWeight: '600',
  },

  // ── Flash card ───────────────────────────────────────────────────────────────
  card: {
    backgroundColor: Palette.surface,
    borderRadius: Radius.card,
    gap: 10,
    marginTop: 12,
    padding: Spacing.cardPadLarge,
    ...CardShadowHeavy,
  },
  faceLabel: {
    color: Palette.textTertiary,
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  faceText: {
    fontSize: 22,
    fontWeight: '700',
    color: Palette.textPrimary,
    lineHeight: 30,
  },
  answerText: {
    fontSize: 20,
    color: Palette.textPrimary,
    marginTop: 6,
    lineHeight: 28,
  },
  labelText: {
    color: Palette.primary,
    fontSize: 14,
  },

  // ── Actions ──────────────────────────────────────────────────────────────────
  flipButton: {
    backgroundColor: Palette.primary,
    borderRadius: Radius.button,
    marginTop: 16,
    padding: 16,
    alignItems: 'center',
    ...CardShadow,
  },
  flipButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  actions: { gap: 12, marginTop: 16 },
  actionButton: { borderRadius: Radius.button, padding: 16, alignItems: 'center' },
  good: { backgroundColor: Palette.success },
  meh: { backgroundColor: Palette.warning },
  bad: { backgroundColor: Palette.danger },
  actionText: { color: '#FFFFFF', fontSize: 16, fontWeight: '600' },

  // ── Empty / Done states ──────────────────────────────────────────────────────
  message: { color: Palette.textSecondary, fontSize: 16, textAlign: 'center' },
  doneCard: {
    backgroundColor: Palette.surface,
    borderRadius: Radius.card,
    padding: 40,
    alignItems: 'center',
    ...CardShadow,
  },
  doneEmoji: {
    fontSize: 52,
    marginBottom: 16,
  },
  done: {
    color: Palette.primary,
    fontSize: 20,
    fontWeight: '700',
    textAlign: 'center',
  },

  // ── Image / Occlusion ────────────────────────────────────────────────────────
  imageWrap: {
    width: '100%',
    height: IMAGE_HEIGHT,
    borderRadius: Radius.input,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Palette.border,
    position: 'relative',
  },
  image: { width: '100%', height: '100%' },
  maskRect: {
    position: 'absolute',
    backgroundColor: 'rgba(30, 41, 59, 0.75)',
    borderColor: '#FFFFFF',
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  maskText: { color: '#FFFFFF', fontWeight: '700' },
});
