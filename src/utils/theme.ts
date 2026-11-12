import { Appearance, ColorSchemeName, Platform } from 'react-native';

// Polyfill Appearance.setColorScheme for React Native Web if not provided
if (Platform.OS === 'web' || typeof (Appearance as any).setColorScheme !== 'function') {
  let customScheme: 'light' | 'dark' | null = null;
  const originalGet = Appearance.getColorScheme ? Appearance.getColorScheme.bind(Appearance) : () => 'light';
  const listeners: Array<(pref: { colorScheme: 'light' | 'dark' }) => void> = [];

  Appearance.getColorScheme = (): ColorSchemeName => {
    const res = customScheme ?? originalGet();
    return res === 'dark' ? 'dark' : 'light';
  };

  if (typeof Appearance.addChangeListener === 'function') {
    const originalAdd = Appearance.addChangeListener.bind(Appearance);
    Appearance.addChangeListener = (listener: any) => {
      listeners.push(listener);
      const sub = originalAdd(listener);
      return {
        remove: () => {
          const idx = listeners.indexOf(listener);
          if (idx !== -1) listeners.splice(idx, 1);
          if (sub && typeof sub.remove === 'function') {
            sub.remove();
          }
        },
      };
    };
  } else {
    (Appearance as any).addChangeListener = (listener: any) => {
      listeners.push(listener);
      return {
        remove: () => {
          const idx = listeners.indexOf(listener);
          if (idx !== -1) listeners.splice(idx, 1);
        },
      };
    };
  }

  (Appearance as any).setColorScheme = (scheme: 'light' | 'dark' | 'auto') => {
    customScheme = scheme === 'auto' ? null : scheme;
    const raw = originalGet();
    const resolved: 'light' | 'dark' = customScheme ?? (raw === 'dark' ? 'dark' : 'light');
    listeners.forEach((l) => {
      try {
        l({ colorScheme: resolved });
      } catch {}
    });
  };
}

export function applyTheme(theme: 'light' | 'dark' | 'system') {
  const target = theme === 'system' ? 'auto' : theme;
  if (typeof (Appearance as any).setColorScheme === 'function') {
    (Appearance as any).setColorScheme(target);
  }
}
