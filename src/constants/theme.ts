import { Platform } from 'react-native';

const light = {
  text: '#0F172A',
  textSecondary: '#64748B',
  textMuted: '#64748B',
  background: '#F8F9FA',
  backgroundElement: '#E2E8F0',
  backgroundSelected: '#CBD5E1',
  card: '#FFFFFF',
  tint: '#0F766E', // Forest Nordic Teal
  icon: '#64748B',
  tabIconDefault: '#94A3B8',
  tabIconSelected: '#0F766E',
  border: '#E2E8F0',
  primary: '#1E293B',
  secondary: '#D97706',
  accent: '#0F766E',
  success: '#16A34A',
  danger: '#DC2626',
  warning: '#D97706',
  inputBg: '#FFFFFF',
};

const dark = {
  text: '#F8FAFC',
  textSecondary: '#94A3B8',
  textMuted: '#94A3B8',
  background: '#0F172A',
  backgroundElement: '#334155',
  backgroundSelected: '#475569',
  card: '#1E293B',
  tint: '#2DD4BF', // Bright teal for dark mode
  icon: '#94A3B8',
  tabIconDefault: '#64748B',
  tabIconSelected: '#2DD4BF',
  border: '#334155',
  primary: '#F8FAFC',
  secondary: '#F59E0B',
  accent: '#2DD4BF',
  success: '#22C55E',
  danger: '#EF4444',
  warning: '#F59E0B',
  inputBg: '#1E293B',
};

export const Colors = {
  light,
  dark,
  unspecified: light,
} as const;

export type ThemeColors = typeof light;
export type ThemeColor = keyof typeof light;

export const Fonts = Platform.select({
  ios: {
    sans: 'system-ui',
    serif: 'ui-serif',
    rounded: 'ui-rounded',
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: 'var(--font-display)',
    serif: 'var(--font-serif)',
    rounded: 'var(--font-rounded)',
    mono: 'var(--font-mono)',
  },
});

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;

export const BottomTabInset = Platform.select({ ios: 50, android: 80 }) ?? 0;
export const MaxContentWidth = 800;
