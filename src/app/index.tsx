import { Redirect } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View, useColorScheme } from 'react-native';
import { Colors } from '../constants/theme';
import { getToken } from '../utils/tokenStorage';

export default function RootIndex() {
  const scheme = useColorScheme();
  const colors = Colors[scheme ?? 'light'];

  const [checking, setChecking] = useState(true);
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  useEffect(() => {
    let isMounted = true;
    (async () => {
      try {
        const token = await getToken();
        if (isMounted) {
          setIsLoggedIn(!!token);
        }
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
      <View style={[styles.centered, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
  }

  return isLoggedIn ? <Redirect href={"/(app)/(tabs)" as any} /> : <Redirect href="/(auth)/login" />;
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
