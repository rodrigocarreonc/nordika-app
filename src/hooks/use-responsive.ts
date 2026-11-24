// Responsive layout hook: computes breakpoints, catalog columns and max widths without changing mobile.

import { useMemo } from "react";
import { Platform, useWindowDimensions } from "react-native";

// Standard breakpoints to tell mobile, tablet and desktop apart.
export const BREAKPOINTS = {
  tablet: 768,
  desktop: 1024,
} as const;

// Max container widths on wide screens to improve readability and visual proportion.
export const LAYOUT_MAX_WIDTH = {
  catalog: 1140,
  content: 860,
} as const;

export type ContainerVariant = "catalog" | "content";

export interface ResponsiveInfo {
  width: number;
  height: number;
  isWeb: boolean;
  isMobile: boolean;
  isTablet: boolean;
  isDesktop: boolean;
  catalogColumns: 1 | 2 | 3;
  catalogMaxWidth: number;
  contentMaxWidth: number;
  containerMaxWidth: number;
}

/**
 * Returns responsive metrics that react to window resizing.
 * On mobile (`width < 768`) it keeps a single column and full width.
 */
export function useResponsive(
  variant: ContainerVariant = "catalog",
): ResponsiveInfo {
  const { width, height } = useWindowDimensions();

  return useMemo(() => {
    const isWeb = Platform.OS === "web";
    const isMobile = width < BREAKPOINTS.tablet;
    const isTablet = width >= BREAKPOINTS.tablet && width < BREAKPOINTS.desktop;
    const isDesktop = width >= BREAKPOINTS.desktop;

    const catalogColumns: 1 | 2 | 3 = isDesktop ? 3 : isTablet ? 2 : 1;
    const catalogMaxWidth = LAYOUT_MAX_WIDTH.catalog;
    const contentMaxWidth = LAYOUT_MAX_WIDTH.content;
    const containerMaxWidth =
      variant === "content" ? contentMaxWidth : catalogMaxWidth;

    return {
      width,
      height,
      isWeb,
      isMobile,
      isTablet,
      isDesktop,
      catalogColumns,
      catalogMaxWidth,
      contentMaxWidth,
      containerMaxWidth,
    };
  }, [width, height, variant]);
}
