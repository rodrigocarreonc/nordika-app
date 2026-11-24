// Paginated list of the furniture the authenticated user saved as favorites.

import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import React, { useCallback, useMemo, useState } from "react";
import {
  FlatList,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useColorScheme,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { EmptyView } from "../../../components/EmptyView";
import { ErrorView } from "../../../components/ErrorView";
import { FurnitureCard } from "../../../components/FurnitureCard";
import { Pagination } from "../../../components/Pagination";
import { CatalogSkeleton } from "../../../components/Skeleton";
import { Colors } from "../../../constants/theme";
import { useResponsive } from "../../../hooks/use-responsive";
import { Furniture } from "../../../types";
import { apiGetMyFavorites, apiToggleFavorite } from "../../../utils/api";
import { getStoredPageSize } from "../../../utils/settingsStorage";

type FavoriteGridItem = Furniture | { id: number; __spacer: true };

export default function FavoritesScreen() {
  const router = useRouter();
  const scheme = useColorScheme() ?? "light";
  const colors = Colors[scheme];
  const { isMobile, catalogColumns, catalogMaxWidth } =
    useResponsive("catalog");

  const [favorites, setFavorites] = useState<Furniture[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  const fetchFavorites = useCallback(
    async (targetPage = 1, isRefresh = false) => {
      try {
        if (!isRefresh) setLoading(true);
        setError(null);
        const pageSize = await getStoredPageSize();
        const res = await apiGetMyFavorites({
          page: targetPage,
          page_size: pageSize,
        });
        setFavorites(res.results || []);
        setTotalPages(res.total_pages || 1);
        setTotalCount(res.count ?? (res.results ? res.results.length : 0));
        setPage(res.current_page || targetPage);
      } catch (err: any) {
        setError(err.message || "Error al obtener tus muebles favoritos.");
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [],
  );

  useFocusEffect(
    useCallback(() => {
      fetchFavorites(page);
    }, [fetchFavorites, page]),
  );

  // Fills the last row with spacers to keep grid proportions even.
  const gridItems = useMemo<FavoriteGridItem[]>(() => {
    if (catalogColumns <= 1 || favorites.length === 0) return favorites;
    const remainder = favorites.length % catalogColumns;
    if (remainder === 0) return favorites;
    const spacers: FavoriteGridItem[] = Array.from(
      { length: catalogColumns - remainder },
      (_, idx) => ({ id: -(idx + 1), __spacer: true as const }),
    );
    return [...favorites, ...spacers];
  }, [favorites, catalogColumns]);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchFavorites(1, true);
  };

  const handlePageChange = (newPage: number) => {
    setPage(newPage);
    fetchFavorites(newPage);
  };

  const handleRemoveFavorite = async (furniture: Furniture) => {
    try {
      await apiToggleFavorite(furniture.id);
      // If the current page only had this item and we are past page 1, go back one page
      if (favorites.length === 1 && page > 1) {
        const prevPage = page - 1;
        setPage(prevPage);
        fetchFavorites(prevPage, true);
      } else {
        fetchFavorites(page, true);
      }
    } catch {
      // Ignore the error
    }
  };

  // Centered max width on tablet/desktop; mobile keeps the original full layout.
  const desktopContainerStyle = !isMobile
    ? {
        maxWidth: catalogMaxWidth,
        width: "100%" as const,
        alignSelf: "center" as const,
      }
    : undefined;

  return (
    <SafeAreaView
      style={[styles.safeArea, { backgroundColor: colors.background }]}
      edges={["top", "left", "right"]}
    >
      {/* Header with a full-width divider and centered content on desktop */}
      <View
        style={[styles.headerWrapper, { borderBottomColor: colors.border }]}
      >
        <View style={[styles.header, desktopContainerStyle]}>
          <View>
            <Text style={[styles.headerTitle, { color: colors.text }]}>
              Mis Favoritos
            </Text>
            <Text style={[styles.headerSubtitle, { color: colors.textMuted }]}>
              {totalCount}{" "}
              {totalCount === 1 ? "mueble guardado" : "muebles guardados"}
            </Text>
          </View>

          <View
            style={[styles.iconPill, { backgroundColor: `${colors.danger}15` }]}
          >
            <Ionicons name="heart" size={20} color={colors.danger} />
          </View>
        </View>
      </View>

      {loading && !refreshing ? (
        <ScrollView showsVerticalScrollIndicator={false}>
          <CatalogSkeleton columns={catalogColumns} />
        </ScrollView>
      ) : error ? (
        <ErrorView message={error} onRetry={() => fetchFavorites(page)} />
      ) : (
        <FlatList
          key={`grid-${catalogColumns}`}
          data={gridItems}
          numColumns={catalogColumns}
          columnWrapperStyle={
            catalogColumns > 1 ? styles.columnWrapper : undefined
          }
          keyExtractor={(item) =>
            "__spacer" in item ? `spacer-${item.id}` : item.id.toString()
          }
          renderItem={({ item }) =>
            "__spacer" in item ? (
              <View style={styles.gridSpacer} pointerEvents="none" />
            ) : (
              <FurnitureCard
                furniture={item}
                isFavorite={true}
                isGridItem={catalogColumns > 1}
                onPress={() => router.push(`/(app)/furniture/${item.id}`)}
                onToggleFavorite={handleRemoveFavorite}
              />
            )
          }
          contentContainerStyle={[styles.listContent, desktopContainerStyle]}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              colors={[colors.accent]}
              tintColor={colors.accent}
            />
          }
          ListEmptyComponent={
            <EmptyView
              title="Aún no tienes favoritos"
              description="Explora nuestro catálogo de diseño nórdico y toca el corazón para guardar lo que más te guste."
              icon="heart-outline"
              actionLabel="Explorar catálogo"
              onAction={() => router.replace("/")}
            />
          }
          ListFooterComponent={
            totalPages > 1 ? (
              <Pagination
                page={page}
                totalPages={totalPages}
                onPageChange={handlePageChange}
              />
            ) : undefined
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  headerWrapper: {
    borderBottomWidth: 1,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 18,
    paddingVertical: 14,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: "800",
  },
  headerSubtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  iconPill: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
  },
  listContent: {
    padding: 18,
    paddingBottom: 32,
  },
  columnWrapper: {
    gap: 16,
  },
  gridSpacer: {
    flex: 1,
  },
});
