import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { Platform, useColorScheme } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Colors } from '../constants/theme';
import { DialogProvider } from '../context/DialogContext';
import { getStoredTheme } from '../utils/settingsStorage';
import { applyTheme } from '../utils/theme';

SplashScreen.preventAutoHideAsync().catch(() => {});

export default function RootLayout() {
  const scheme = useColorScheme();
  const colors = Colors[scheme ?? 'light'];

  useEffect(() => {
    getStoredTheme().then((theme) => {
      applyTheme(theme);
    });
    SplashScreen.hideAsync().catch(() => {});
  }, []);

  // Web tooltip synchronizer: ensures title attribute is always present on DOM for tooltips
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return;

    const syncTooltips = () => {
      const elements = document.querySelectorAll<HTMLElement>(
        '[data-title], [aria-label], [role="button"], [role="tab"], [role="radio"], button'
      );
      elements.forEach((el) => {
        if (el.getAttribute('title')) return;
        const text = el.getAttribute('data-title') || el.getAttribute('aria-label');
        if (text) {
          el.setAttribute('title', text);
        }
      });
    };

    syncTooltips();
    const observer = new MutationObserver(syncTooltips);
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['aria-label', 'data-title'],
    });

    return () => observer.disconnect();
  }, []);

  return (
    <SafeAreaProvider>
      <DialogProvider>
        <StatusBar style="auto" />
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: colors.background },
          }}
        >
          <Stack.Screen name="index" />
          <Stack.Screen name="(auth)" options={{ headerShown: false }} />
          <Stack.Screen name="(app)" options={{ headerShown: false }} />
        </Stack>
      </DialogProvider>
    </SafeAreaProvider>
  );
}
