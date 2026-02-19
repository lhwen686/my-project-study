import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Suspense } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import 'react-native-reanimated';
import { SQLiteProvider } from 'expo-sqlite';

import { initDB, DB_NAME } from '@/data/db';
import { Palette } from '@/constants/design-tokens';
import { useColorScheme } from '@/hooks/use-color-scheme';

function Loading() {
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, backgroundColor: Palette.background }}>
      <ActivityIndicator size="large" color={Palette.primary} />
      <Text style={{ color: Palette.textSecondary, fontSize: 15 }}>正在初始化本地数据库...</Text>
    </View>
  );
}

export default function RootLayout() {
  const colorScheme = useColorScheme();

  return (
    <Suspense fallback={<Loading />}>
      <SQLiteProvider databaseName={DB_NAME} onInit={initDB}>
        <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
          <Stack>
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            <Stack.Screen name="deck/[id]" options={{ title: '卡片列表' }} />
            <Stack.Screen name="review/[id]" options={{ title: '复习界面' }} />
          </Stack>
          <StatusBar style="auto" />
        </ThemeProvider>
      </SQLiteProvider>
    </Suspense>
  );
}
