import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import 'react-native-reanimated';

import { initializeDatabase } from '@/data/sqlite';
import { Palette } from '@/constants/design-tokens';
import { useColorScheme } from '@/hooks/use-color-scheme';

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    initializeDatabase()
      .catch((error: unknown) => {
        console.error('Database initialization failed:', error);
      })
      .finally(() => setReady(true));
  }, []);

  if (!ready) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, backgroundColor: Palette.background }}>
        <ActivityIndicator size="large" color={Palette.primary} />
        <Text style={{ color: Palette.textSecondary, fontSize: 15 }}>正在初始化本地数据库...</Text>
      </View>
    );
  }

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <Stack>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="deck/[id]" options={{ title: '卡片列表' }} />
        <Stack.Screen name="review/[id]" options={{ title: '复习界面' }} />
      </Stack>
      <StatusBar style="auto" />
    </ThemeProvider>
  );
}
