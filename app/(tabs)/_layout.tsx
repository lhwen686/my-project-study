import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';

import { Palette } from '@/constants/design-tokens';

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerTitleAlign: 'center',
        headerStyle: { backgroundColor: Palette.background },
        headerTintColor: Palette.textPrimary,
        headerTitleStyle: { fontWeight: '600' as const },
        tabBarActiveTintColor: Palette.primary,
        tabBarInactiveTintColor: Palette.textTertiary,
        tabBarStyle: { backgroundColor: Palette.surface, borderTopColor: Palette.divider },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: '首页',
          tabBarLabel: '首页',
          tabBarIcon: ({ color, size }) => <Ionicons name="home" color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="decks"
        options={{
          title: '卡包',
          tabBarLabel: '卡包',
          tabBarIcon: ({ color, size }) => <Ionicons name="albums" color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="stats"
        options={{
          title: '统计',
          tabBarLabel: '统计',
          tabBarIcon: ({ color, size }) => <Ionicons name="stats-chart" color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: '设置',
          tabBarLabel: '设置',
          tabBarIcon: ({ color, size }) => <Ionicons name="settings" color={color} size={size} />,
        }}
      />
    </Tabs>
  );
}
