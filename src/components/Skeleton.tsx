// Skeleton loading blocks and templates with a soft pulse, adapted to light/dark theme and responsive layouts.

import React, { useEffect, useState } from "react";
import {
  Animated,
  DimensionValue,
  Platform,
  StyleProp,
  StyleSheet,
  View,
  ViewStyle,
} from "react-native";
import { Colors } from "../constants/theme";
import { useColorScheme } from "../hooks/use-color-scheme";
import { useResponsive } from "../hooks/use-responsive";

// On Web the native driver doesn't exist and logs warnings; on iOS/Android it runs on the native thread.
const USE_NATIVE_DRIVER = Platform.OS !== "web";

export interface SkeletonBoxProps {
  width?: DimensionValue;
  height?: DimensionValue;
  borderRadius?: number;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

/**
 * Rectangular block with a continuous pulse animation that stands in for loading content.
 */
export const SkeletonBox: React.FC<SkeletonBoxProps> = ({
  width = "100%",
  height = 16,
  borderRadius = 8,
  style,
  testID,
}) => {
  const scheme = useColorScheme() ?? "light";
  const colors = Colors[scheme];
  // useState with a lazy initializer avoids recreating Animated.Value on every render and satisfies react-hooks/refs.
  const [opacity] = useState(() => new Animated.Value(0.45));

  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 0.95,
          duration: 750,
          useNativeDriver: USE_NATIVE_DRIVER,
        }),
        Animated.timing(opacity, {
          toValue: 0.45,
          duration: 750,
          useNativeDriver: USE_NATIVE_DRIVER,
        }),
      ]),
    );
    pulse.start();
    return () => {
      pulse.stop();
    };
  }, [opacity]);

  return (
    <Animated.View
      testID={testID}
      style={[
        {
          width,
          height,
          borderRadius,
          backgroundColor: colors.backgroundElement,
          opacity,
        },
        style,
      ]}
    />
  );
};

export interface CatalogSkeletonProps {
  count?: number;
  columns?: 1 | 2 | 3;
  style?: StyleProp<ViewStyle>;
}

/**
 * Catalog grid skeleton; respects the column count on mobile, tablet and desktop.
 */
export const CatalogSkeleton: React.FC<CatalogSkeletonProps> = ({
  count,
  columns,
  style,
}) => {
  const scheme = useColorScheme() ?? "light";
  const colors = Colors[scheme];
  const { catalogColumns, catalogMaxWidth } = useResponsive("catalog");

  const effectiveColumns = columns ?? catalogColumns;
  const itemCount =
    count ?? (effectiveColumns === 3 ? 6 : effectiveColumns === 2 ? 4 : 3);

  // Groups into explicit rows to keep cards aligned at any width without overflow.
  const rows: number[][] = [];
  for (let i = 0; i < itemCount; i += effectiveColumns) {
    const row: number[] = [];
    for (let j = 0; j < effectiveColumns; j += 1) {
      row.push(i + j < itemCount ? i + j : -1);
    }
    rows.push(row);
  }

  return (
    <View
      testID="skeleton-loader"
      accessibilityLabel="Cargando contenido"
      accessibilityRole="progressbar"
      style={[
        styles.centeredWrapper,
        { maxWidth: catalogMaxWidth, paddingHorizontal: 16, paddingTop: 12 },
        style,
      ]}
    >
      {rows.map((row, rowIndex) => (
        <View
          key={`catalog-row-${rowIndex}`}
          style={[styles.catalogRow, effectiveColumns > 1 && styles.rowGap]}
        >
          {row.map((itemIndex, colIndex) =>
            itemIndex === -1 ? (
              <View
                key={`spacer-${rowIndex}-${colIndex}`}
                style={styles.catalogCell}
              />
            ) : (
              <View
                key={`catalog-card-${itemIndex}`}
                style={[
                  styles.catalogCell,
                  styles.catalogCard,
                  {
                    backgroundColor: colors.card,
                    borderColor: colors.border,
                  },
                ]}
              >
                <SkeletonBox width="100%" height={180} borderRadius={0} />
                <View style={styles.catalogCardBody}>
                  <View style={styles.spaceBetweenRow}>
                    <SkeletonBox width={84} height={22} borderRadius={11} />
                    <SkeletonBox width={72} height={14} borderRadius={6} />
                  </View>
                  <SkeletonBox width="88%" height={18} borderRadius={6} />
                  <SkeletonBox width="60%" height={18} borderRadius={6} />
                  <SkeletonBox
                    width={116}
                    height={22}
                    borderRadius={6}
                    style={styles.mt4}
                  />
                </View>
              </View>
            ),
          )}
        </View>
      ))}
    </View>
  );
};

export interface SimpleSkeletonProps {
  style?: StyleProp<ViewStyle>;
}

/**
 * Furniture detail skeleton with the main image and the specs card.
 */
export const FurnitureDetailSkeleton: React.FC<SimpleSkeletonProps> = ({
  style,
}) => {
  const scheme = useColorScheme() ?? "light";
  const colors = Colors[scheme];
  const { contentMaxWidth, isMobile, isDesktop } = useResponsive("content");

  return (
    <View
      testID="skeleton-loader"
      accessibilityLabel="Cargando contenido"
      accessibilityRole="progressbar"
      style={[
        styles.centeredWrapper,
        {
          maxWidth: contentMaxWidth,
          paddingHorizontal: isMobile ? 0 : 16,
          paddingTop: isMobile ? 0 : 16,
        },
        style,
      ]}
    >
      <SkeletonBox
        width="100%"
        height={isDesktop ? 360 : 280}
        borderRadius={isMobile ? 0 : 16}
      />

      <View
        style={[
          styles.detailCard,
          {
            backgroundColor: colors.card,
            borderColor: colors.border,
          },
        ]}
      >
        <View style={styles.inlineRow}>
          <SkeletonBox width={96} height={24} borderRadius={12} />
          <SkeletonBox width={84} height={24} borderRadius={12} />
        </View>

        <SkeletonBox width="78%" height={26} borderRadius={8} />
        <SkeletonBox width={144} height={28} borderRadius={8} />

        <View style={styles.detailSection}>
          <SkeletonBox width="100%" height={15} borderRadius={6} />
          <SkeletonBox width="92%" height={15} borderRadius={6} />
          <SkeletonBox width="68%" height={15} borderRadius={6} />
        </View>

        <View style={styles.metaGrid}>
          <SkeletonBox
            width="48%"
            height={58}
            borderRadius={12}
            style={styles.flexOne}
          />
          <SkeletonBox
            width="48%"
            height={58}
            borderRadius={12}
            style={styles.flexOne}
          />
        </View>

        <SkeletonBox
          width="100%"
          height={48}
          borderRadius={12}
          style={styles.mt8}
        />
      </View>
    </View>
  );
};

export interface ListSkeletonProps {
  count?: number;
  style?: StyleProp<ViewStyle>;
}

/**
 * Reservations list skeleton (cards with thumbnail, status and totals).
 */
export const ReservationsSkeleton: React.FC<ListSkeletonProps> = ({
  count = 4,
  style,
}) => {
  const scheme = useColorScheme() ?? "light";
  const colors = Colors[scheme];
  const { contentMaxWidth } = useResponsive("content");

  return (
    <View
      testID="skeleton-loader"
      accessibilityLabel="Cargando contenido"
      accessibilityRole="progressbar"
      style={[
        styles.centeredWrapper,
        styles.listContainer,
        { maxWidth: contentMaxWidth },
        style,
      ]}
    >
      {Array.from({ length: count }).map((_, index) => (
        <View
          key={`reservation-skeleton-${index}`}
          style={[
            styles.reservationCard,
            {
              backgroundColor: colors.card,
              borderColor: colors.border,
            },
          ]}
        >
          <View style={styles.inlineRow}>
            <SkeletonBox width={64} height={64} borderRadius={10} />
            <View style={styles.reservationTextCol}>
              <SkeletonBox width="76%" height={18} borderRadius={6} />
              <SkeletonBox width="52%" height={14} borderRadius={6} />
              <SkeletonBox width="40%" height={16} borderRadius={6} />
            </View>
          </View>
          <View style={styles.spaceBetweenRow}>
            <SkeletonBox width={96} height={24} borderRadius={12} />
            <SkeletonBox width={112} height={14} borderRadius={6} />
          </View>
        </View>
      ))}
    </View>
  );
};

/**
 * Skeleton for admin tables and lists (thumbnail, text lines and action buttons).
 */
export const AdminListSkeleton: React.FC<ListSkeletonProps> = ({
  count = 5,
  style,
}) => {
  const scheme = useColorScheme() ?? "light";
  const colors = Colors[scheme];
  const { contentMaxWidth } = useResponsive("content");

  return (
    <View
      testID="skeleton-loader"
      accessibilityLabel="Cargando contenido"
      accessibilityRole="progressbar"
      style={[
        styles.centeredWrapper,
        styles.listContainer,
        { maxWidth: contentMaxWidth },
        style,
      ]}
    >
      {Array.from({ length: count }).map((_, index) => (
        <View
          key={`admin-row-skeleton-${index}`}
          style={[
            styles.adminRowCard,
            {
              backgroundColor: colors.card,
              borderColor: colors.border,
            },
          ]}
        >
          <SkeletonBox width={52} height={52} borderRadius={10} />
          <View style={styles.adminTextCol}>
            <SkeletonBox width="68%" height={16} borderRadius={6} />
            <SkeletonBox width="46%" height={13} borderRadius={6} />
          </View>
          <View style={styles.inlineRowSmall}>
            <SkeletonBox width={34} height={34} borderRadius={8} />
            <SkeletonBox width={34} height={34} borderRadius={8} />
          </View>
        </View>
      ))}
    </View>
  );
};

/**
 * Skeleton for the furniture create/edit form (image picker and fields).
 */
export const FormSkeleton: React.FC<SimpleSkeletonProps> = ({ style }) => {
  const { contentMaxWidth } = useResponsive("content");

  return (
    <View
      testID="skeleton-loader"
      accessibilityLabel="Cargando contenido"
      accessibilityRole="progressbar"
      style={[
        styles.centeredWrapper,
        styles.formContainer,
        { maxWidth: contentMaxWidth },
        style,
      ]}
    >
      <SkeletonBox width="100%" height={200} borderRadius={14} />

      <View style={styles.fieldGroup}>
        <SkeletonBox width={110} height={14} borderRadius={6} />
        <SkeletonBox width="100%" height={46} borderRadius={10} />
      </View>

      <View style={styles.fieldGroup}>
        <SkeletonBox width={130} height={14} borderRadius={6} />
        <SkeletonBox width="100%" height={92} borderRadius={10} />
      </View>

      <View style={styles.metaGrid}>
        <View style={[styles.fieldGroup, styles.flexOne]}>
          <SkeletonBox width={80} height={14} borderRadius={6} />
          <SkeletonBox width="100%" height={46} borderRadius={10} />
        </View>
        <View style={[styles.fieldGroup, styles.flexOne]}>
          <SkeletonBox width={70} height={14} borderRadius={6} />
          <SkeletonBox width="100%" height={46} borderRadius={10} />
        </View>
      </View>

      <View style={styles.fieldGroup}>
        <SkeletonBox width={100} height={14} borderRadius={6} />
        <SkeletonBox width="100%" height={46} borderRadius={10} />
      </View>

      <SkeletonBox
        width="100%"
        height={50}
        borderRadius={12}
        style={styles.mt8}
      />
    </View>
  );
};

/**
 * Compact skeleton for the profile header on the settings screen.
 */
export const SettingsProfileSkeleton: React.FC<SimpleSkeletonProps> = ({
  style,
}) => {
  const scheme = useColorScheme() ?? "light";
  const colors = Colors[scheme];

  return (
    <View
      testID="skeleton-loader"
      accessibilityLabel="Cargando contenido"
      accessibilityRole="progressbar"
      style={[
        styles.profileCard,
        {
          backgroundColor: colors.card,
          borderColor: colors.border,
        },
        style,
      ]}
    >
      <SkeletonBox width={60} height={60} borderRadius={30} />
      <View style={styles.profileTextCol}>
        <SkeletonBox width="56%" height={18} borderRadius={6} />
        <SkeletonBox width="74%" height={14} borderRadius={6} />
        <SkeletonBox width={86} height={22} borderRadius={11} />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  centeredWrapper: {
    width: "100%",
    alignSelf: "center",
  },
  catalogRow: {
    flexDirection: "row",
    width: "100%",
    marginBottom: 16,
  },
  rowGap: {
    gap: 16,
  },
  catalogCell: {
    flex: 1,
  },
  catalogCard: {
    borderRadius: 14,
    borderWidth: 1,
    overflow: "hidden",
  },
  catalogCardBody: {
    padding: 14,
    gap: 10,
  },
  spaceBetweenRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
  },
  inlineRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  inlineRowSmall: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  detailCard: {
    margin: 16,
    padding: 20,
    borderRadius: 16,
    borderWidth: 1,
    gap: 14,
  },
  detailSection: {
    gap: 8,
    marginTop: 4,
  },
  metaGrid: {
    flexDirection: "row",
    gap: 12,
    width: "100%",
  },
  flexOne: {
    flex: 1,
  },
  listContainer: {
    padding: 16,
    gap: 12,
  },
  reservationCard: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    gap: 14,
  },
  reservationTextCol: {
    flex: 1,
    gap: 8,
  },
  adminRowCard: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  adminTextCol: {
    flex: 1,
    gap: 8,
  },
  formContainer: {
    padding: 16,
    gap: 18,
  },
  fieldGroup: {
    gap: 8,
  },
  profileCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
  },
  profileTextCol: {
    flex: 1,
    gap: 8,
  },
  mt4: {
    marginTop: 4,
  },
  mt8: {
    marginTop: 8,
  },
});
