// Returns the active palette (light or dark) based on the system scheme or the chosen preference.

import { Colors } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";

export function useTheme() {
  const scheme = useColorScheme();
  const theme = scheme ?? "light";

  return Colors[theme];
}
