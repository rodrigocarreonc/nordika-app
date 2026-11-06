import { Redirect, Stack } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, View, useColorScheme } from 'react-native';
import { Colors } from '../../constants/theme';
import { getToken } from '../../utils/tokenStorage';

export default function AppLayout() {
  const scheme = useColorScheme() ?? 'light';
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
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background }}>
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
  }

  if (!isLoggedIn) {
    return <Redirect href="/(auth)/login" />;
  }

  // Stack sobre las pestañas: detalle y formulario se montan limpios al abrirse y "atrás" regresa a la pantalla de origen.
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="mueble/[id]" />
      <Stack.Screen name="mueble/form" />
    </Stack>
  );
}
