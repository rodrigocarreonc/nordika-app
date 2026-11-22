import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { Platform, useColorScheme } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { Colors } from "../constants/theme";
import { DialogProvider } from "../context/DialogContext";
import { getStoredTheme } from "../utils/settingsStorage";
import { applyTheme } from "../utils/theme";

SplashScreen.preventAutoHideAsync().catch(() => {});

export default function RootLayout() {
  const scheme = useColorScheme();
  const colors = Colors[scheme ?? "light"];

  useEffect(() => {
    getStoredTheme().then((theme) => {
      applyTheme(theme);
    });
    SplashScreen.hideAsync().catch(() => {});
  }, []);

  // Web tooltip synchronizer: copies aria-label cleanly to DOM title for tooltips
  useEffect(() => {
    if (Platform.OS !== "web" || typeof document === "undefined") return;

    const syncTooltips = () => {
      const elements = document.querySelectorAll<HTMLElement>("[aria-label]");
      elements.forEach((el) => {
        const label = el.getAttribute("aria-label");
        if (label && el.getAttribute("title") !== label) {
          el.setAttribute("title", label);
        }
      });
    };

    syncTooltips();
    const observer = new MutationObserver(syncTooltips);
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["aria-label"],
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
