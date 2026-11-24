// Auth guard of the private (app) group: blocks access without a token and wraps the tabs + furniture screens.

import { Redirect, Stack } from "expo-router";
import React, { useEffect, useState } from "react";
import { ActivityIndicator, View, useColorScheme } from "react-native";
import { Colors } from "../../constants/theme";
import { getToken } from "../../utils/tokenStorage";

export default function AppLayout() {
  const scheme = useColorScheme() ?? "light";
  const colors = Colors[scheme];

  const [checking, setChecking] = useState(true);
  const [isLoggedIn, setIsLoggedIn] = useState(true);

  useEffect(() => {
    let isMounted = true;
    (async () => {
      try {
        const token = await getToken();
        if (isMounted) setIsLoggedIn(!!token);
      } catch {
        if (isMounted) setIsLoggedIn(false);
      } finally {
        if (isMounted) setChecking(false);
      }
    })();
    return () => {
      isMounted = false;
    };
  }, []);

  if (checking) {
    return (
      <View
        style={{
          flex: 1,
          justifyContent: "center",
          alignItems: "center",
          backgroundColor: colors.background,
        }}
      >
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
  }

  if (!isLoggedIn) {
    return <Redirect href="/(auth)/login" />;
  }

  // Stack over the tabs: detail and form mount fresh when opened and "back" returns to the source screen.
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.background },
      }}
    >
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="furniture/[id]" />
      <Stack.Screen name="furniture/form" />
    </Stack>
  );
}
