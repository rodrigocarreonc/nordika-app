import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import {
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  View,
  useColorScheme,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { EmptyView } from '../../../components/EmptyView';
import { ErrorView } from '../../../components/ErrorView';
import { LoadingView } from '../../../components/LoadingView';
import { MuebleCard } from '../../../components/MuebleCard';
import { Pagination } from '../../../components/Pagination';
import { Colors } from '../../../constants/theme';
import { Mueble } from '../../../types';
import { apiGetMisFavoritos, apiToggleFavorito } from '../../../utils/api';
import { getStoredPageSize } from '../../../utils/settingsStorage';

export default function FavoritosScreen() {
  const router = useRouter();
  const scheme = useColorScheme() ?? 'light';
  const colors = Colors[scheme];

  const [favoritos, setFavoritos] = useState<Mueble[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  const fetchFavoritos = useCallback(async (targetPage = 1, isRefresh = false) => {
    try {
      if (!isRefresh) setLoading(true);
      setError(null);
      const pageSize = await getStoredPageSize();
      const res = await apiGetMisFavoritos({ page: targetPage, page_size: pageSize });
      setFavoritos(res.results || []);
      setTotalPages(res.total_pages || 1);
      setTotalCount(res.count ?? (res.results ? res.results.length : 0));
      setPage(res.current_page || targetPage);
    } catch (err: any) {
      setError(err.message || 'Error al obtener tus muebles favoritos.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchFavoritos(page);
    }, [fetchFavoritos, page])
  );

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
        fetchFavoritos(prevPage);
      } else {
        fetchFavoritos(page);
      }
    } catch {
      // Ignorar error
    }
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]} edges={['top', 'left', 'right']}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <View>
          <Text style={[styles.headerTitle, { color: colors.text }]}>Mis Favoritos</Text>
          <Text style={[styles.headerSubtitle, { color: colors.textMuted }]}>
            {totalCount} {totalCount === 1 ? 'mueble guardado' : 'muebles guardados'}
          </Text>
        </View>

        <View style={[styles.iconPill, { backgroundColor: `${colors.danger}15` }]}>
          <Ionicons name="heart" size={20} color={colors.danger} />
        </View>
      </View>

      {loading && !refreshing ? (
        <LoadingView message="Cargando tus favoritos..." />
      ) : error ? (
        <ErrorView message={error} onRetry={() => fetchFavoritos(page)} />
      ) : (
        <FlatList
          data={favoritos}
          keyExtractor={(item) => item.id.toString()}
          renderItem={({ item }) => (
            <MuebleCard
              mueble={item}
              isFavorito={true}
              onPress={() => router.push(`/(app)/mueble/${item.id}`)}
              onToggleFavorito={handleRemoveFavorito}
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
              title="Aún no tienes favoritos"
              description="Explora nuestro catálogo de diseño nórdico y toca el corazón para guardar lo que más te guste."
              icon="heart-outline"
              actionLabel="Explorar catálogo"
              onAction={() => router.replace('/')}
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
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '800',
  },
  headerSubtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  iconPill: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listContent: {
    padding: 18,
    paddingBottom: 32,
  },
});
