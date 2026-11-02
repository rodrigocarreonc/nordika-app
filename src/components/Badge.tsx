import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

interface BadgeProps {
  label: string;
  variant?: 'success' | 'warning' | 'danger' | 'info' | 'neutral';
  size?: 'small' | 'medium';
}

export const Badge: React.FC<BadgeProps> = ({
  label,
  variant = 'neutral',
  size = 'small',
}) => {
  const getColors = () => {
    switch (variant) {
      case 'success':
        return { bg: '#DCFCE7', text: '#15803D' };
      case 'warning':
        return { bg: '#FEF3C7', text: '#B45309' };
      case 'danger':
        return { bg: '#FEE2E2', text: '#B91C1C' };
      case 'info':
        return { bg: '#E0F2FE', text: '#0369A1' };
      default:
        return { bg: '#F1F5F9', text: '#475569' };
    }
  };

  const colors = getColors();
  const isSmall = size === 'small';

  return (
    <View
      style={[
        styles.badge,
        { backgroundColor: colors.bg },
        isSmall ? styles.smallBadge : styles.mediumBadge,
      ]}
    >
      <Text
        style={[
          styles.text,
          { color: colors.text },
          isSmall ? styles.smallText : styles.mediumText,
        ]}
      >
        {label}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  badge: {
    borderRadius: 9999,
    alignSelf: 'flex-start',
    justifyContent: 'center',
    alignItems: 'center',
  },
  smallBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  mediumBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  text: {
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  smallText: {
    fontSize: 11,
  },
  mediumText: {
    fontSize: 13,
  },
});
