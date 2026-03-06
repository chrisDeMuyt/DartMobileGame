import { Stack } from 'expo-router';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Platform, StyleSheet } from 'react-native';
import { useFonts } from 'expo-font';
import { PressStart2P_400Regular } from '@expo-google-fonts/press-start-2p';
import { useBackgroundMusic } from '../hooks/useBackgroundMusic';
import { useEffect, useState } from 'react';

function AppShell() {
  useBackgroundMusic();
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: '#0a1628' },
      }}
    />
  );
}

export default function RootLayout() {
  const [fontsLoaded] = useFonts({ PressStart2P_400Regular });
  const [skiaReady, setSkiaReady] = useState(Platform.OS !== 'web');

  useEffect(() => {
    if (Platform.OS === 'web') {
      (async () => {
        // @ts-ignore — web-only Skia WASM loader
        const { LoadSkiaWeb } = await import('@shopify/react-native-skia/lib/module/web');
        await LoadSkiaWeb({ locateFile: (file: string) => `/${file}` });
        setSkiaReady(true);
      })();
    }
  }, []);

  if (!fontsLoaded || !skiaReady) return null;

  return (
    <GestureHandlerRootView style={styles.root}>
      <SafeAreaProvider>
        <AppShell />
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
});
