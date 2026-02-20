import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { BarChart, PieChart } from 'react-native-chart-kit';
import Svg, { Circle } from 'react-native-svg';

import { CardShadow, Palette, Radius, Spacing } from '@/constants/design-tokens';
import { DashboardData, getDashboardData } from '@/data/sqlite';

type State = { loading: boolean; data: DashboardData | null; error: boolean };
const INITIAL: State = { loading: true, data: null, error: false };

const SCREEN_WIDTH = Dimensions.get('window').width;
const CHART_WIDTH = SCREEN_WIDTH - Spacing.page * 2 - Spacing.cardPad * 2;

// ── Progress Ring ────────────────────────────────────────────────────────────
function ProgressRing({
  progress,
  size = 100,
  strokeWidth = 10,
}: {
  progress: number;
  size?: number;
  strokeWidth?: number;
}) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.min(Math.max(progress, 0), 1);
  const strokeDashoffset = circumference * (1 - clamped);

  return (
    <Svg width={size} height={size}>
      {/* Background track */}
      <Circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        stroke={Palette.divider}
        strokeWidth={strokeWidth}
        fill="none"
      />
      {/* Foreground arc */}
      <Circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        stroke={Palette.primary}
        strokeWidth={strokeWidth}
        fill="none"
        strokeDasharray={`${circumference} ${circumference}`}
        strokeDashoffset={strokeDashoffset}
        strokeLinecap="round"
        rotation="-90"
        origin={`${size / 2}, ${size / 2}`}
      />
    </Svg>
  );
}

// ── Card Wrapper ─────────────────────────────────────────────────────────────
function DashboardCard({
  title,
  children,
}: {
  title?: string;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.card}>
      {title ? <Text style={styles.cardTitle}>{title}</Text> : null}
      {children}
    </View>
  );
}

// ── Main Screen ──────────────────────────────────────────────────────────────
export default function StatsScreen() {
  const [state, setState] = useState<State>(INITIAL);

  const load = useCallback(async () => {
    setState({ loading: true, data: null, error: false });
    try {
      const data = await getDashboardData();
      setState({ loading: false, data, error: false });
    } catch (e) {
      console.error('Dashboard load failed:', e);
      setState({ loading: false, data: null, error: true });
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  if (state.loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={Palette.primary} />
      </View>
    );
  }

  if (state.error || !state.data) {
    return (
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.pageTitle}>数据大盘</Text>
        <View style={styles.emptyCard}>
          <Text style={styles.emptyText}>加载失败，请稍后重试。</Text>
        </View>
      </ScrollView>
    );
  }

  const { todayCompleted, dailyGoal, next7Days, masteryBuckets } = state.data;
  const progress = dailyGoal > 0 ? todayCompleted / dailyGoal : 0;
  const totalCards = masteryBuckets.reduce((s, b) => s + b.count, 0);

  // ── Chart data ─────────────────────────────────────────────────────────────
  const barData = {
    labels: next7Days.map((d) => d.label),
    datasets: [{ data: next7Days.map((d) => d.count) }],
  };

  const pieData = masteryBuckets.map((b) => ({
    name: b.name,
    population: b.count,
    color: b.color,
    legendFontColor: Palette.textSecondary,
    legendFontSize: 13,
  }));

  const chartConfig = {
    backgroundGradientFrom: Palette.surface,
    backgroundGradientTo: Palette.surface,
    color: (opacity = 1) => `rgba(37, 99, 235, ${opacity})`,
    labelColor: () => Palette.textSecondary,
    barPercentage: 0.55,
    decimalCount: 0,
    propsForBackgroundLines: { stroke: Palette.divider },
  };

  return (
    <ScrollView
      contentContainerStyle={styles.container}
      showsVerticalScrollIndicator={false}
    >
      <Text style={styles.pageTitle}>数据大盘</Text>

      {/* ── Module A: Today Overview ── */}
      <DashboardCard>
        <View style={styles.overviewRow}>
          <View style={styles.overviewText}>
            <Text style={styles.overviewLabel}>今日已复习</Text>
            <Text style={styles.overviewNumber}>{todayCompleted}</Text>
            <Text style={styles.overviewSub}>张卡片</Text>
            <Text style={styles.overviewGoal}>
              目标 {dailyGoal} 张 · {Math.round(progress * 100)}%
            </Text>
          </View>
          <View style={styles.ringContainer}>
            <ProgressRing progress={progress} size={100} strokeWidth={10} />
            <Text style={styles.ringPercent}>{Math.round(progress * 100)}%</Text>
          </View>
        </View>
      </DashboardCard>

      {/* ── Module B: 7-day Bar Chart ── */}
      <DashboardCard title="未来复习压力预测">
        {next7Days.every((d) => d.count === 0) ? (
          <Text style={styles.emptyText}>暂无到期卡片</Text>
        ) : (
          <BarChart
            data={barData}
            width={CHART_WIDTH}
            height={200}
            yAxisLabel=""
            yAxisSuffix=""
            chartConfig={chartConfig}
            fromZero
            showValuesOnTopOfBars
            withInnerLines={false}
            style={styles.chart}
          />
        )}
      </DashboardCard>

      {/* ── Module C: Mastery Pie Chart ── */}
      <DashboardCard title="记忆突触固化情况">
        {totalCards === 0 ? (
          <Text style={styles.emptyText}>暂无卡片数据</Text>
        ) : (
          <>
            <PieChart
              data={pieData}
              width={CHART_WIDTH}
              height={200}
              chartConfig={chartConfig}
              accessor="population"
              backgroundColor="transparent"
              paddingLeft="0"
              absolute
              style={styles.chart}
            />
            <View style={styles.legendRow}>
              {masteryBuckets.map((b) => (
                <View key={b.name} style={styles.legendItem}>
                  <View style={[styles.legendDot, { backgroundColor: b.color }]} />
                  <Text style={styles.legendLabel}>
                    {b.name}: {b.count}
                  </Text>
                </View>
              ))}
            </View>
          </>
        )}
      </DashboardCard>
    </ScrollView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: {
    backgroundColor: Palette.background,
    padding: Spacing.page,
    paddingBottom: 40,
    gap: Spacing.gap,
  },
  centered: {
    flex: 1,
    backgroundColor: Palette.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pageTitle: {
    fontSize: 26,
    fontWeight: '800',
    color: Palette.textPrimary,
    marginBottom: 4,
  },

  // ── Card ────────────────────────────────────────────────────────────────────
  card: {
    backgroundColor: Palette.surface,
    borderRadius: Radius.card,
    padding: Spacing.cardPadLarge,
    gap: 12,
    ...CardShadow,
  },
  cardTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: Palette.textPrimary,
  },

  // ── Module A: Overview ──────────────────────────────────────────────────────
  overviewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  overviewText: {
    flex: 1,
    gap: 2,
  },
  overviewLabel: {
    fontSize: 15,
    color: Palette.textSecondary,
  },
  overviewNumber: {
    fontSize: 48,
    fontWeight: '800',
    color: Palette.primary,
    lineHeight: 56,
  },
  overviewSub: {
    fontSize: 15,
    color: Palette.textSecondary,
    marginTop: -4,
  },
  overviewGoal: {
    fontSize: 13,
    color: Palette.textTertiary,
    marginTop: 6,
  },
  ringContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  ringPercent: {
    position: 'absolute',
    fontSize: 18,
    fontWeight: '700',
    color: Palette.primary,
  },

  // ── Chart ───────────────────────────────────────────────────────────────────
  chart: {
    borderRadius: 8,
    alignSelf: 'center',
  },

  // ── Pie legend ──────────────────────────────────────────────────────────────
  legendRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    flexWrap: 'wrap',
    gap: 16,
    marginTop: 4,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  legendLabel: {
    fontSize: 13,
    color: Palette.textSecondary,
  },

  // ── Empty / Error ───────────────────────────────────────────────────────────
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
    paddingVertical: 16,
  },
});
