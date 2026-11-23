// Lista paginada de muebles guardados como favoritos por el usuario autenticado.

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
import { MuebleCard } from "../../../components/MuebleCard";
import { Pagination } from "../../../components/Pagination";
import { CatalogSkeleton } from "../../../components/Skeleton";
import { Colors } from "../../../constants/theme";
import { useRealtimeEvents } from "../../../hooks/use-realtime";
import { useResponsive } from "../../../hooks/use-responsive";
import { Mueble } from "../../../types";
import { apiGetMisFavoritos, apiToggleFavorito } from "../../../utils/api";
import { getStoredPageSize } from "../../../utils/settingsStorage";

type FavoritoGridItem = Mueble | { id: number; __spacer: true };

export default function FavoritosScreen() {
  const router = useRouter();
  const scheme = useColorScheme() ?? "light";
  const colors = Colors[scheme];
  const { isMobile, catalogColumns, catalogMaxWidth } =
    useResponsive("catalog");

  const [favoritos, setFavoritos] = useState<Mueble[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  const fetchFavoritos = useCallback(
    async (targetPage = 1, isRefresh = false, silent = false) => {
      try {
        if (!isRefresh && !silent) setLoading(true);
        if (!silent) setError(null);
        const pageSize = await getStoredPageSize();
        const res = await apiGetMisFavoritos({
          page: targetPage,
          page_size: pageSize,
        });
        setFavoritos(res.results || []);
        setTotalPages(res.total_pages || 1);
        setTotalCount(res.count ?? (res.results ? res.results.length : 0));
        setPage(res.current_page || targetPage);
      } catch (err: any) {
        if (!silent) {
          setError(err.message || "Error al obtener tus muebles favoritos.");
        }
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [],
  );

  useFocusEffect(
    useCallback(() => {
      fetchFavoritos(page);
    }, [fetchFavoritos, page]),
  );

  // Actualiza la lista silenciosamente al recibir eventos SSE de favoritos o cambios en muebles.
  useRealtimeEvents(["favorito", "mueble"], () => {
    fetchFavoritos(page, true, true);
  });

  // Completa la última fila con espaciadores para mantener proporciones homogéneas en cuadrícula.
  const gridItems = useMemo<FavoritoGridItem[]>(() => {
    if (catalogColumns <= 1 || favoritos.length === 0) return favoritos;
    const remainder = favoritos.length % catalogColumns;
    if (remainder === 0) return favoritos;
    const spacers: FavoritoGridItem[] = Array.from(
      { length: catalogColumns - remainder },
      (_, idx) => ({ id: -(idx + 1), __spacer: true as const }),
    );
    return [...favoritos, ...spacers];
  }, [favoritos, catalogColumns]);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchFavoritos(1, true);
  };

  const handlePageChange = (newPage: number) => {
    setPage(newPage);
    fetchFavoritos(newPage);
  };

  const handleRemoveFavorito = async (mueble: Mueble) => {
    try {
      await apiToggleFavorito(mueble.id);
      // Si la página actual solo tenía este elemento y estamos más allá de la pág 1, retroceder
      if (favoritos.length === 1 && page > 1) {
        const prevPage = page - 1;
        setPage(prevPage);
        fetchFavoritos(prevPage, true);
      } else {
        fetchFavoritos(page, true);
      }
    } catch {
      // Ignorar error
    }
  };

  // Ancho máximo centrado en tablet/escritorio; en móvil se mantiene el layout original completo.
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
      {/* Header con separador de ancho completo y contenido centrado en escritorio */}
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
        <ErrorView message={error} onRetry={() => fetchFavoritos(page)} />
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
              <MuebleCard
                mueble={item}
                isFavorito={true}
                isGridItem={catalogColumns > 1}
                onPress={() => router.push(`/(app)/mueble/${item.id}`)}
                onToggleFavorito={handleRemoveFavorito}
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
