import { useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  LayoutAnimation,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  UIManager,
  View,
  type LayoutChangeEvent,
} from 'react-native';
import * as Haptics from 'expo-haptics';

import { useSQLiteContext } from 'expo-sqlite';

import { RichTextRenderer } from '@/components/RichTextRenderer';
import { type OcclusionRect, parseOcclusions, pickRandomOcclusion, toAbsoluteRect } from '@/data/occlusion';
import { type Card } from '@/data/sqlite';
import { CardShadow, CardShadowHeavy, Palette, Spacing } from '@/constants/design-tokens';

// Enable LayoutAnimation on Android (defensive — newArchEnabled should handle it)
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const RATING_OPTIONS = [
  { label: '会', value: 5, style: 'good' as const },
  { label: '模糊', value: 3, style: 'meh' as const },
  { label: '不会', value: 1, style: 'bad' as const },
];

const IMAGE_HEIGHT = 220;

export default function ReviewScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const deckId = Number(id);
  const db = useSQLiteContext();

  const [loading, setLoading] = useState(true);
  const [currentCard, setCurrentCard] = useState<Card | null>(null);
  const [totalDue, setTotalDue] = useState(0);
  const [completed, setCompleted] = useState(0);
  const [showBack, setShowBack] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [shownAt, setShownAt] = useState<number>(Date.now());
  const [imageBoxSize, setImageBoxSize] = useState({ width: 1, height: IMAGE_HEIGHT });
  const [questionMask, setQuestionMask] = useState<OcclusionRect | null>(null);

  const loadNextDueCard = useCallback(async () => {
    const now = new Date().toISOString();
    const card = await db.getFirstAsync<Card>(
      'SELECT * FROM cards WHERE deck_id = ? AND due_date <= ? ORDER BY due_date ASC, id ASC LIMIT 1;',
      deckId,
      now,
    );
    setCurrentCard(card ?? null);
  }, [db, deckId]);

  useEffect(() => {
    if (!Number.isFinite(deckId)) {
      setLoading(false);
      return;
    }

    const load = async () => {
      setLoading(true);
      try {
        const now = new Date().toISOString();
        const countResult = await db.getFirstAsync<{ count: number }>(
          'SELECT COUNT(*) as count FROM cards WHERE deck_id = ? AND due_date <= ?;',
          deckId,
          now,
        );
        setTotalDue(countResult?.count ?? 0);
        setCompleted(0);
        await loadNextDueCard();
        setShowBack(false);
        setShownAt(Date.now());
      } catch (error) {
        console.error('Failed to load due cards:', error);
        setCurrentCard(null);
        setTotalDue(0);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [deckId, db, loadNextDueCard]);

  useEffect(() => {
    if (!currentCard) {
      setQuestionMask(null);
      return;
    }
    const occlusions = parseOcclusions(currentCard.occlusions);
    setQuestionMask(pickRandomOcclusion(occlusions));
  }, [currentCard]);

  const progressText = useMemo(() => {
    if (totalDue === 0) return '0 / 0';
    return `${Math.min(completed + 1, totalDue)} / ${totalDue}`;
  }, [totalDue, completed]);

  const progressPercent = useMemo(() => {
    if (totalDue === 0) return 0;
    return (Math.min(completed + 1, totalDue) / totalDue) * 100;
  }, [totalDue, completed]);

  const onGrade = async (rating: number) => {
    if (!currentCard || submitting) return;

    // Haptic feedback based on rating
    if (rating === 5) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } else if (rating === 1) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } else {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }

    setSubmitting(true);
    try {
      // Simple scheduling: push due_date forward by 1 day
      const nextReviewDate = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
      await db.runAsync('UPDATE cards SET due_date = ? WHERE id = ?;', nextReviewDate, currentCard.id);

      setCompleted((prev) => prev + 1);
      setShowBack(false);
      setShownAt(Date.now());
      await loadNextDueCard();
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

  if (!currentCard) {
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
      {/* ── Top Progress Bar ───────────────────────────────────────────────── */}
      <View style={styles.progressHeader}>
        <View style={styles.progressBarTrack}>
          <View style={[styles.progressBarFill, { width: `${progressPercent}%` }]} />
        </View>
        <Text style={styles.progressText}>{progressText}</Text>
      </View>

      {/* ── Scrollable Content Area ────────────────────────────────────────── */}
      <ScrollView
        style={styles.scrollArea}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.card}>
          {/* Question Section */}
          <Text style={styles.sectionLabel}>QUESTION</Text>
          {currentCard?.front ? (
            <RichTextRenderer content={currentCard.front} variant="question" />
          ) : null}

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

          {/* Answer Section (with divider) */}
          {showBack ? (
            <>
              <View style={styles.divider} />
              <Text style={styles.sectionLabel}>ANSWER</Text>
              {currentCard?.back ? (
                <RichTextRenderer content={currentCard.back} variant="answer" />
              ) : null}
              {!!questionMask?.label && <Text style={styles.labelText}>遮挡结构：{questionMask.label}</Text>}
            </>
          ) : null}
        </View>
      </ScrollView>

      {/* ── Bottom Action Bar ──────────────────────────────────────────────── */}
      <View style={styles.bottomBar}>
        {!showBack ? (
          <Pressable
            style={({ pressed }) => [styles.flipButton, pressed && styles.flipButtonPressed]}
            onPress={() => {
              LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
              setShowBack(true);
            }}
          >
            <Text style={styles.flipButtonText}>显示答案</Text>
          </Pressable>
        ) : (
          <View style={styles.actionsRow}>
            {RATING_OPTIONS.map((option) => (
              <Pressable
                key={option.label}
                style={({ pressed }) => [
                  styles.actionButton,
                  option.style === 'good' && styles.good,
                  option.style === 'meh' && styles.meh,
                  option.style === 'bad' && styles.bad,
                  pressed && styles.actionButtonPressed,
                ]}
                onPress={() => onGrade(option.value)}
                disabled={submitting}
              >
                <Text style={styles.actionText}>{option.label}</Text>
              </Pressable>
            ))}
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  // ── Containers ──────────────────────────────────────────────────────────────
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  center: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
    padding: Spacing.page,
  },

  // ── Top Progress Bar ────────────────────────────────────────────────────────
  progressHeader: {
    paddingHorizontal: Spacing.page,
    paddingTop: 12,
    paddingBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  progressBarTrack: {
    flex: 1,
    height: 6,
    backgroundColor: '#E2E8F0',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: Palette.primary,
    borderRadius: 3,
  },
  progressText: {
    color: '#64748B',
    fontSize: 13,
    fontWeight: '600',
    minWidth: 44,
    textAlign: 'right',
  },

  // ── Scrollable Content ──────────────────────────────────────────────────────
  scrollArea: {
    flex: 1,
  },
  scrollContent: {
    padding: Spacing.page,
    paddingBottom: 8,
  },

  // ── Flash Card ──────────────────────────────────────────────────────────────
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 24,
    gap: 12,
    ...CardShadowHeavy,
  },
  sectionLabel: {
    color: '#64748B',
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1.2,
  },
  divider: {
    height: 1,
    backgroundColor: '#E2E8F0',
    marginVertical: 4,
  },
  labelText: {
    color: Palette.primary,
    fontSize: 13,
    marginTop: 4,
  },

  // ── Bottom Action Bar ───────────────────────────────────────────────────────
  bottomBar: {
    paddingHorizontal: Spacing.page,
    paddingTop: 12,
    paddingBottom: 24,
    backgroundColor: '#F8FAFC',
  },
  flipButton: {
    backgroundColor: Palette.primary,
    borderRadius: 28,
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
    ...CardShadow,
  },
  flipButtonPressed: {
    opacity: 0.85,
  },
  flipButtonText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '700',
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  actionButton: {
    flex: 1,
    borderRadius: 14,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionButtonPressed: {
    opacity: 0.8,
  },
  good: { backgroundColor: '#10B981' },
  meh: { backgroundColor: '#64748B' },
  bad: { backgroundColor: '#F87171' },
  actionText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },

  // ── Empty / Done states ─────────────────────────────────────────────────────
  message: { color: '#64748B', fontSize: 16, textAlign: 'center' },
  doneCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
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

  // ── Image / Occlusion ─────────────────────────────────────────────────────
  imageWrap: {
    width: '100%',
    height: IMAGE_HEIGHT,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#E2E8F0',
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
