import React from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { Colors } from '../constants/theme';
import { useColorScheme } from 'react-native';

interface LoadingViewProps {
  message?: string;
  size?: 'small' | 'large';
}

export const LoadingView: React.FC<LoadingViewProps> = ({
  message = 'Cargando información...',
  size = 'large',
}) => {
  const scheme = useColorScheme() ?? 'light';
  const colors = Colors[scheme];

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ActivityIndicator size={size} color={colors.accent} />
      {message ? (
        <Text style={[styles.message, { color: colors.textMuted }]}>{message}</Text>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  message: {
    marginTop: 14,
    fontSize: 15,
    fontWeight: '500',
    textAlign: 'center',
  },
});
