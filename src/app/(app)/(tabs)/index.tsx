// Main catalog screen: search, category/stock filter, sorting and pagination.

import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  FlatList,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
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
import { Category, Furniture } from "../../../types";
import {
  apiGetCategories,
  apiGetFurnitureList,
  apiToggleFavorite,
} from "../../../utils/api";
import { getStoredPageSize } from "../../../utils/settingsStorage";
import { getUser } from "../../../utils/tokenStorage";

type CatalogGridItem = Furniture | { id: number; __spacer: true };

export default function CatalogScreen() {
  const router = useRouter();
  const scheme = useColorScheme() ?? "light";
  const colors = Colors[scheme];
  const { isMobile, catalogColumns, catalogMaxWidth } =
    useResponsive("catalog");

  // Data state
  const [furnitureList, setFurnitureList] = useState<Furniture[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [currentUser, setCurrentUser] = useState<any>(null);

  // Filter and pagination state
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<number | null>(
    null,
  );
  const [ordering, setOrdering] = useState("-created_at");
  const [onlyInStock, setOnlyInStock] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  // UI and feedback state
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showOrderModal, setShowOrderModal] = useState(false);

  // Load the user
  useEffect(() => {
    getUser().then((u) => {
      if (u) setCurrentUser(u);
    });
  }, []);

  // Reload categories when returning to the catalog, to see the ones created/edited in Administration
  const fetchCategories = useCallback(() => {
    apiGetCategories()
      .then((cats) => {
        setCategories(cats);
        // If the filtered category was deleted, go back to "Todas"
        setSelectedCategory((sel) =>
          sel !== null && !cats.some((c) => c.id === sel) ? null : sel,
        );
      })
      .catch(() => {});
  }, []);

  useFocusEffect(fetchCategories);

  // Paginated query honoring the page_size chosen in Settings and every active filter.
  const fetchFurniture = useCallback(
    async (currentPage = 1, isRefresh = false) => {
      try {
        if (!isRefresh) setLoading(true);
        setError(null);

        const currentSize = await getStoredPageSize();

        const data = await apiGetFurnitureList({
          page: currentPage,
          page_size: currentSize,
          search: search.trim() || undefined,
          category: selectedCategory || undefined,
          in_stock: onlyInStock ? true : undefined,
          ordering: ordering,
        });

        setFurnitureList(data.results || []);
        setTotalPages(data.total_pages || 1);
        setTotalCount(data.count || 0);
        setPage(data.current_page || 1);
      } catch (err: any) {
        setError(err.message || "Error al cargar muebles");
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [search, selectedCategory, onlyInStock, ordering],
  );

  // Refresh when the screen gains focus
  useFocusEffect(
    useCallback(() => {
      getUser().then((u) => {
        if (u) setCurrentUser(u);
      });
      fetchFurniture(page);
    }, [fetchFurniture, page]),
  );

  // Fills the last grid row with empty cells so a lone card does not stretch to 100%.
  const gridItems = useMemo<CatalogGridItem[]>(() => {
    if (catalogColumns <= 1 || furnitureList.length === 0) return furnitureList;
    const remainder = furnitureList.length % catalogColumns;
    if (remainder === 0) return furnitureList;
    const spacers: CatalogGridItem[] = Array.from(
      { length: catalogColumns - remainder },
      (_, idx) => ({ id: -(idx + 1), __spacer: true as const }),
    );
    return [...furnitureList, ...spacers];
  }, [furnitureList, catalogColumns]);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchCategories();
    fetchFurniture(1, true);
  };

  const handleSearchSubmit = () => {
    setPage(1);
    fetchFurniture(1);
  };

  const handleClearSearch = () => {
    setSearch("");
    setPage(1);
    // triggers an immediate fetch with an empty search
    setTimeout(() => fetchFurniture(1), 50);
  };

  const handleToggleFavorite = async (furniture: Furniture) => {
    try {
      const res = await apiToggleFavorite(furniture.id);
      setFurnitureList((prev) =>
        prev.map((m) =>
          m.id === furniture.id
            ? {
                ...m,
                is_favorite: res.is_favorite,
                favorites_count: res.favorites_count,
              }
            : m,
        ),
      );
    } catch {
      // If it fails, FurnitureCard already reverts its internal state
    }
  };

  const orderingOptions = [
    { label: "Más recientes", value: "-created_at" },
    { label: "Precio: menor a mayor", value: "price" },
    { label: "Precio: mayor a menor", value: "-price" },
    { label: "Nombre: A - Z", value: "name" },
  ];

  // Centered container with a max width on tablet/desktop; full width on mobile.
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
      {/* Top header with a full-width border and centered content on desktop */}
      <View
        style={[styles.headerWrapper, { borderBottomColor: colors.border }]}
      >
        <View style={[styles.header, desktopContainerStyle]}>
          <View>
            <Text style={[styles.brandLogo, { color: colors.text }]}>
              NORDIKA
            </Text>
            <Text style={[styles.greeting, { color: colors.textMuted }]}>
              {currentUser?.first_name
                ? `Hola, ${currentUser.first_name}`
                : "Mobiliario Nórdico"}
            </Text>
          </View>

          <View style={styles.headerActions}>
            <Pressable
              style={[
                styles.headerIconButton,
                { backgroundColor: colors.card, borderColor: colors.border },
              ]}
              onPress={() => setShowOrderModal(true)}
              accessibilityRole="button"
              accessibilityLabel="Ordenar catálogo"
              accessibilityHint="Abre opciones para ordenar los muebles por precio o fecha"
            >
              <Ionicons name="filter-outline" size={20} color={colors.text} />
            </Pressable>

            {/* New furniture button (staff only) */}
            {currentUser?.is_staff ? (
              <Pressable
                style={[
                  styles.headerCreateButton,
                  { backgroundColor: colors.accent },
                ]}
                onPress={() => router.push("/(app)/furniture/form")}
                accessibilityRole="button"
                accessibilityLabel="Nuevo mueble"
                accessibilityHint="Abre el formulario para dar de alta un mueble"
              >
                <Ionicons name="add" size={18} color="#FFFFFF" />
                <Text style={styles.headerCreateButtonText}>Nuevo</Text>
              </Pressable>
            ) : null}
          </View>
        </View>
      </View>

      {/* Search bar */}
      <View style={[styles.searchSection, desktopContainerStyle]}>
        <View
          style={[
            styles.searchBar,
            { backgroundColor: colors.card, borderColor: colors.border },
          ]}
        >
          <Ionicons
            name="search-outline"
            size={18}
            color={colors.textMuted}
            style={styles.searchIcon}
          />
          <TextInput
            style={[styles.searchInput, { color: colors.text }]}
            placeholder="Buscar sofás, mesas, recámaras..."
            placeholderTextColor={colors.textMuted}
            value={search}
            onChangeText={setSearch}
            onSubmitEditing={handleSearchSubmit}
            returnKeyType="search"
          />
          {search ? (
            <Pressable
              onPress={handleClearSearch}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Limpiar texto de búsqueda"
              accessibilityHint="Borra el texto ingresado y muestra todos los muebles"
            >
              <Ionicons
                name="close-circle"
                size={18}
                color={colors.textMuted}
              />
            </Pressable>
          ) : null}
        </View>
      </View>

      {/* Category chips (horizontal scroll) */}
      <View style={[styles.categoriesSection, desktopContainerStyle]}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.categoriesList}
        >
          <Pressable
            style={[
              styles.categoryChip,
              selectedCategory === null
                ? {
                    backgroundColor: colors.primary,
                    borderColor: colors.primary,
                  }
                : { backgroundColor: colors.card, borderColor: colors.border },
            ]}
            onPress={() => {
              setSelectedCategory(null);
              setPage(1);
            }}
            accessibilityRole="button"
            accessibilityLabel="Categoría: Todas"
            accessibilityHint="Muestra muebles de cualquier categoría"
          >
            <Text
              style={[
                styles.categoryChipText,
                selectedCategory === null
                  ? { color: colors.onPrimary }
                  : { color: colors.text },
              ]}
            >
              Todas
            </Text>
          </Pressable>

          {categories.map((cat) => {
            const isSelected = selectedCategory === cat.id;
            return (
              <Pressable
                key={cat.id}
                style={[
                  styles.categoryChip,
                  isSelected
                    ? {
                        backgroundColor: colors.primary,
                        borderColor: colors.primary,
                      }
                    : {
                        backgroundColor: colors.card,
                        borderColor: colors.border,
                      },
                ]}
                onPress={() => {
                  setSelectedCategory(isSelected ? null : cat.id);
                  setPage(1);
                }}
                accessibilityRole="button"
                accessibilityLabel={`Categoría: ${cat.name}`}
                accessibilityHint={`Filtra los muebles para mostrar sólo de categoría ${cat.name}`}
              >
                <Text
                  style={[
                    styles.categoryChipText,
                    isSelected
                      ? { color: colors.onPrimary }
                      : { color: colors.text },
                  ]}
                >
                  {cat.name}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      {/* Active filters & counter */}
      <View style={[styles.filterStatsRow, desktopContainerStyle]}>
        <Text style={[styles.resultsCount, { color: colors.textMuted }]}>
          {totalCount}{" "}
          {totalCount === 1 ? "mueble encontrado" : "muebles encontrados"}
        </Text>

        <Pressable
          style={[
            styles.inStockToggle,
            onlyInStock
              ? {
                  backgroundColor: `${colors.accent}20`,
                  borderColor: colors.accent,
                }
              : { borderColor: colors.border },
          ]}
          onPress={() => {
            setOnlyInStock(!onlyInStock);
            setPage(1);
          }}
          accessibilityRole="button"
          accessibilityLabel="Filtro en stock"
          accessibilityHint="Alterna entre todos los muebles o únicamente aquellos con inventario disponible"
        >
          <Ionicons
            name={onlyInStock ? "checkmark-circle" : "ellipse-outline"}
            size={14}
            color={onlyInStock ? colors.accent : colors.textMuted}
            style={{ marginRight: 4 }}
          />
          <Text
            style={[
              styles.inStockText,
              { color: onlyInStock ? colors.accent : colors.textMuted },
            ]}
          >
            En stock
          </Text>
        </Pressable>
      </View>

      {/* Furniture list or states */}
      {loading && !refreshing ? (
        <ScrollView showsVerticalScrollIndicator={false}>
          <CatalogSkeleton columns={catalogColumns} />
        </ScrollView>
      ) : error ? (
        <ErrorView message={error} onRetry={() => fetchFurniture(page)} />
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
                isGridItem={catalogColumns > 1}
                onPress={() => router.push(`/(app)/furniture/${item.id}`)}
                onToggleFavorite={handleToggleFavorite}
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
              title="No hay muebles disponibles"
              description="Prueba cambiando los términos de búsqueda o filtros seleccionados."
              icon="search-outline"
              actionLabel="Ver todo el catálogo"
              onAction={() => {
                setSearch("");
                setSelectedCategory(null);
                setOnlyInStock(false);
                setPage(1);
              }}
            />
          }
          ListFooterComponent={
            totalPages > 1 ? (
              <Pagination
                page={page}
                totalPages={totalPages}
                onPageChange={setPage}
              />
            ) : undefined
          }
        />
      )}

      {/* Sort modal */}
      <Modal
        visible={showOrderModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowOrderModal(false)}
      >
        <View style={styles.modalOverlay}>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={() => setShowOrderModal(false)}
            accessibilityRole="button"
            accessibilityLabel="Cerrar modal de ordenamiento"
            accessibilityHint="Cierra el modal al tocar fuera"
          />
          <View
            style={[
              styles.modalCard,
              { backgroundColor: colors.card, borderColor: colors.border },
            ]}
            onStartShouldSetResponder={() => true}
          >
            <Text style={[styles.modalTitle, { color: colors.text }]}>
              Ordenar Catálogo
            </Text>
            {orderingOptions.map((opt) => {
              const isSelected = ordering === opt.value;
              return (
                <Pressable
                  key={opt.value}
                  style={[
                    styles.modalOption,
                    isSelected && { backgroundColor: `${colors.accent}15` },
                  ]}
                  onPress={() => {
                    setOrdering(opt.value);
                    setShowOrderModal(false);
                    setPage(1);
                  }}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: isSelected }}
                  accessibilityLabel={opt.label}
                >
                  <Text
                    style={[
                      styles.modalOptionText,
                      {
                        color: isSelected ? colors.accent : colors.text,
                        fontWeight: isSelected ? "700" : "400",
                      },
                    ]}
                  >
                    {opt.label}
                  </Text>
                  {isSelected && (
                    <Ionicons
                      name="checkmark"
                      size={18}
                      color={colors.accent}
                    />
                  )}
                </Pressable>
              );
            })}
          </View>
        </View>
      </Modal>
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
    paddingVertical: 12,
  },
  brandLogo: {
    fontSize: 22,
    fontWeight: "900",
    letterSpacing: 2,
  },
  greeting: {
    fontSize: 12,
    marginTop: 2,
  },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  headerIconButton: {
    width: 38,
    height: 38,
    borderRadius: 10,
    borderWidth: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  headerCreateButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 10,
    gap: 4,
  },
  headerCreateButtonText: {
    color: "#FFFFFF",
    fontWeight: "700",
    fontSize: 13,
  },
  searchSection: {
    paddingHorizontal: 18,
    paddingTop: 12,
    paddingBottom: 6,
  },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
  },
  categoriesSection: {
    paddingVertical: 6,
  },
  categoriesList: {
    paddingHorizontal: 18,
    gap: 8,
  },
  categoryChip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
  },
  categoryChipText: {
    fontSize: 13,
    fontWeight: "600",
  },
  filterStatsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 18,
    paddingVertical: 8,
  },
  resultsCount: {
    fontSize: 12,
    fontWeight: "500",
  },
  inStockToggle: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
  },
  inStockText: {
    fontSize: 12,
    fontWeight: "600",
  },
  listContent: {
    paddingHorizontal: 18,
    paddingBottom: 24,
  },
  columnWrapper: {
    gap: 16,
  },
  gridSpacer: {
    flex: 1,
  },
  paginationRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
  },
  pageButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    gap: 4,
  },
  pageButtonDisabled: {
    opacity: 0.4,
  },
  pageButtonText: {
    fontSize: 13,
    fontWeight: "600",
  },
  pageIndicator: {
    fontSize: 13,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  modalCard: {
    width: "100%",
    maxWidth: 340,
    borderRadius: 16,
    borderWidth: 1,
    padding: 18,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 12,
  },
  modalOption: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderRadius: 8,
  },
  modalOptionText: {
    fontSize: 14,
  },
});
