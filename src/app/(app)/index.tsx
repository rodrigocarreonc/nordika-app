import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { EmptyView } from '../../components/EmptyView';
import { ErrorView } from '../../components/ErrorView';
import { LoadingView } from '../../components/LoadingView';
import { MuebleCard } from '../../components/MuebleCard';
import { Colors } from '../../constants/theme';
import { Categoria, Mueble } from '../../types';
import { apiGetCategorias, apiGetMuebles, apiToggleFavorito } from '../../utils/api';
import { getStoredPageSize } from '../../utils/settingsStorage';
import { getUser } from '../../utils/tokenStorage';

export default function CatalogScreen() {
  const router = useRouter();
  const scheme = useColorScheme() ?? 'light';
  const colors = Colors[scheme];

  // Estados de datos
  const [muebles, setMuebles] = useState<Mueble[]>([]);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [currentUser, setCurrentUser] = useState<any>(null);

  // Estados de filtros y paginación
  const [search, setSearch] = useState('');
  const [selectedCategoria, setSelectedCategoria] = useState<number | null>(null);
  const [ordering, setOrdering] = useState('-creado_en');
  const [onlyInStock, setOnlyInStock] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  // Estados de interfaz y feedback
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showOrderModal, setShowOrderModal] = useState(false);

  // Cargar usuario
  useEffect(() => {
    getUser().then((u) => {
      if (u) setCurrentUser(u);
    });
  }, []);

  // Cargar categorías iniciales
  useEffect(() => {
    apiGetCategorias()
      .then((cats) => setCategorias(cats))
      .catch(() => {});
  }, []);

  // Cargar muebles
  const fetchMuebles = useCallback(
    async (currentPage = page, isRefresh = false) => {
      try {
        if (!isRefresh) setLoading(true);
        setError(null);

        const currentSize = await getStoredPageSize();
        setPageSize(currentSize);

        const data = await apiGetMuebles({
          page: currentPage,
          page_size: currentSize,
          search: search.trim() || undefined,
          categoria: selectedCategoria || undefined,
          en_stock: onlyInStock ? true : undefined,
          ordering: ordering,
        });

        setMuebles(data.results || []);
        setTotalPages(data.total_pages || 1);
        setTotalCount(data.count || 0);
        setPage(data.current_page || 1);
      } catch (err: any) {
        setError(err.message || 'Error al cargar muebles');
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [search, selectedCategoria, onlyInStock, ordering]
  );

  // Refrescar al enfocar pantalla
  useFocusEffect(
    useCallback(() => {
      fetchMuebles(page);
    }, [fetchMuebles, page])
  );

  const handleRefresh = () => {
    setRefreshing(true);
    fetchMuebles(1, true);
  };

  const handleSearchSubmit = () => {
    setPage(1);
    fetchMuebles(1);
  };

  const handleClearSearch = () => {
    setSearch('');
    setPage(1);
    // dispara fetch inmediato con search vacío
    setTimeout(() => fetchMuebles(1), 50);
  };

  const handleToggleFavorito = async (mueble: Mueble) => {
    try {
      const res = await apiToggleFavorito(mueble.id);
      setMuebles((prev) =>
        prev.map((m) =>
          m.id === mueble.id
            ? { ...m, is_favorito: res.is_favorito, favoritos_count: res.total_favoritos }
            : m
        )
      );
    } catch {
      // Si falla, el MuebleCard ya revierte su estado interno
    }
  };

  const orderingOptions = [
    { label: 'Más recientes', value: '-creado_en' },
    { label: 'Precio: menor a mayor', value: 'precio' },
    { label: 'Precio: mayor a menor', value: '-precio' },
    { label: 'Nombre: A - Z', value: 'nombre' },
  ];

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]} edges={['top', 'left', 'right']}>
      {/* Header Superior */}
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <View>
          <Text style={[styles.brandLogo, { color: colors.text }]}>NORDIKA</Text>
          <Text style={[styles.greeting, { color: colors.textMuted }]}>
            {currentUser?.first_name ? `Hola, ${currentUser.first_name}` : 'Mobiliario Nórdico'}
          </Text>
        </View>

        <View style={styles.headerActions}>
          <Pressable
            style={[styles.headerIconButton, { backgroundColor: colors.card, borderColor: colors.border }]}
            onPress={() => setShowOrderModal(true)}
          >
            <Ionicons name="filter-outline" size={20} color={colors.text} />
          </Pressable>

          {/* Botón Nuevo Mueble (CRUD) */}
          <Pressable
            style={[styles.headerCreateButton, { backgroundColor: colors.accent }]}
            onPress={() => router.push('/(app)/mueble/form')}
          >
            <Ionicons name="add" size={18} color="#FFFFFF" />
            <Text style={styles.headerCreateButtonText}>Nuevo</Text>
          </Pressable>
        </View>
      </View>

      {/* Barra de Búsqueda */}
      <View style={styles.searchSection}>
        <View style={[styles.searchBar, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Ionicons name="search-outline" size={18} color={colors.textMuted} style={styles.searchIcon} />
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
            <Pressable onPress={handleClearSearch} hitSlop={8}>
              <Ionicons name="close-circle" size={18} color={colors.textMuted} />
            </Pressable>
          ) : null}
        </View>
      </View>

      {/* Chips de Categorías (Horizontal Scroll) */}
      <View style={styles.categoriesSection}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoriesList}>
          <Pressable
            style={[
              styles.categoryChip,
              selectedCategoria === null
                ? { backgroundColor: colors.primary, borderColor: colors.primary }
                : { backgroundColor: colors.card, borderColor: colors.border },
            ]}
            onPress={() => {
              setSelectedCategoria(null);
              setPage(1);
            }}
          >
            <Text
              style={[
                styles.categoryChipText,
                selectedCategoria === null ? { color: '#FFFFFF' } : { color: colors.text },
              ]}
            >
              Todas
            </Text>
          </Pressable>

          {categorias.map((cat) => {
            const isSelected = selectedCategoria === cat.id;
            return (
              <Pressable
                key={cat.id}
                style={[
                  styles.categoryChip,
                  isSelected
                    ? { backgroundColor: colors.primary, borderColor: colors.primary }
                    : { backgroundColor: colors.card, borderColor: colors.border },
                ]}
                onPress={() => {
                  setSelectedCategoria(isSelected ? null : cat.id);
                  setPage(1);
                }}
              >
                <Text
                  style={[
                    styles.categoryChipText,
                    isSelected ? { color: '#FFFFFF' } : { color: colors.text },
                  ]}
                >
                  {cat.nombre}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      {/* Filtros Activos & Contador */}
      <View style={styles.filterStatsRow}>
        <Text style={[styles.resultsCount, { color: colors.textMuted }]}>
          {totalCount} {totalCount === 1 ? 'mueble encontrado' : 'muebles encontrados'}
        </Text>

        <Pressable
          style={[
            styles.inStockToggle,
            onlyInStock ? { backgroundColor: `${colors.accent}20`, borderColor: colors.accent } : { borderColor: colors.border },
          ]}
          onPress={() => {
            setOnlyInStock(!onlyInStock);
            setPage(1);
          }}
        >
          <Ionicons
            name={onlyInStock ? 'checkmark-circle' : 'ellipse-outline'}
            size={14}
            color={onlyInStock ? colors.accent : colors.textMuted}
            style={{ marginRight: 4 }}
          />
          <Text style={[styles.inStockText, { color: onlyInStock ? colors.accent : colors.textMuted }]}>
            En stock
          </Text>
        </Pressable>
      </View>

      {/* Lista de Muebles o Estados */}
      {loading && !refreshing ? (
        <LoadingView message="Cargando catálogo Nordika..." />
      ) : error ? (
        <ErrorView message={error} onRetry={() => fetchMuebles(page)} />
      ) : (
        <FlatList
          data={muebles}
          keyExtractor={(item) => item.id.toString()}
          renderItem={({ item }) => (
            <MuebleCard
              mueble={item}
              onPress={() => router.push(`/(app)/mueble/${item.id}`)}
              onToggleFavorito={handleToggleFavorito}
            />
          )}
          contentContainerStyle={styles.listContent}
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
                setSearch('');
                setSelectedCategoria(null);
                setOnlyInStock(false);
                setPage(1);
              }}
            />
          }
          ListFooterComponent={
            totalPages > 1 ? (
              <View style={[styles.paginationRow, { borderTopColor: colors.border }]}>
                <Pressable
                  style={[
                    styles.pageButton,
                    { backgroundColor: colors.card, borderColor: colors.border },
                    page <= 1 && styles.pageButtonDisabled,
                  ]}
                  disabled={page <= 1}
                  onPress={() => setPage((p) => Math.max(1, p - 1))}
                >
                  <Ionicons name="chevron-back" size={16} color={page <= 1 ? colors.textMuted : colors.text} />
                  <Text style={[styles.pageButtonText, { color: page <= 1 ? colors.textMuted : colors.text }]}>
                    Anterior
                  </Text>
                </Pressable>

                <Text style={[styles.pageIndicator, { color: colors.text }]}>
                  Pág. <Text style={{ fontWeight: '800' }}>{page}</Text> de {totalPages}
                </Text>

                <Pressable
                  style={[
                    styles.pageButton,
                    { backgroundColor: colors.card, borderColor: colors.border },
                    page >= totalPages && styles.pageButtonDisabled,
                  ]}
                  disabled={page >= totalPages}
                  onPress={() => setPage((p) => Math.min(totalPages, p + 1))}
                >
                  <Text style={[styles.pageButtonText, { color: page >= totalPages ? colors.textMuted : colors.text }]}>
                    Siguiente
                  </Text>
                  <Ionicons name="chevron-forward" size={16} color={page >= totalPages ? colors.textMuted : colors.text} />
                </Pressable>
              </View>
            ) : null
          }
        />
      )}

      {/* Modal de Ordenamiento */}
      <Modal visible={showOrderModal} transparent animationType="fade">
        <Pressable style={styles.modalOverlay} onPress={() => setShowOrderModal(false)}>
          <View style={[styles.modalCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>Ordenar Catálogo</Text>
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
                >
                  <Text
                    style={[
                      styles.modalOptionText,
                      { color: isSelected ? colors.accent : colors.text, fontWeight: isSelected ? '700' : '400' },
                    ]}
                  >
                    {opt.label}
                  </Text>
                  {isSelected && <Ionicons name="checkmark" size={18} color={colors.accent} />}
                </Pressable>
              );
            })}
          </View>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  brandLogo: {
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: 2,
  },
  greeting: {
    fontSize: 12,
    marginTop: 2,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerIconButton: {
    width: 38,
    height: 38,
    borderRadius: 10,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerCreateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 10,
    gap: 4,
  },
  headerCreateButtonText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 13,
  },
  searchSection: {
    paddingHorizontal: 18,
    paddingTop: 12,
    paddingBottom: 6,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
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
    fontWeight: '600',
  },
  filterStatsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingVertical: 8,
  },
  resultsCount: {
    fontSize: 12,
    fontWeight: '500',
  },
  inStockToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
  },
  inStockText: {
    fontSize: 12,
    fontWeight: '600',
  },
  listContent: {
    paddingHorizontal: 18,
    paddingBottom: 24,
  },
  paginationRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
  },
  pageButton: {
    flexDirection: 'row',
    alignItems: 'center',
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
    fontWeight: '600',
  },
  pageIndicator: {
    fontSize: 13,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalCard: {
    width: '100%',
    maxWidth: 340,
    borderRadius: 16,
    borderWidth: 1,
    padding: 18,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 12,
  },
  modalOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderRadius: 8,
  },
  modalOptionText: {
    fontSize: 14,
  },
});
