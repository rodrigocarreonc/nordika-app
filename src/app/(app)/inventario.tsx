import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import React, { useCallback, useState } from 'react';
import {
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
  useColorScheme,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Badge } from '../../components/Badge';
import { EmptyView } from '../../components/EmptyView';
import { ErrorView } from '../../components/ErrorView';
import { LoadingView } from '../../components/LoadingView';
import { Colors } from '../../constants/theme';
import { MovimientoInventario } from '../../types';
import { apiGetMovimientos } from '../../utils/api';

export default function InventarioScreen() {
  const scheme = useColorScheme() ?? 'light';
  const colors = Colors[scheme];

  const [movimientos, setMovimientos] = useState<MovimientoInventario[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filterTipo, setFilterTipo] = useState<string | null>(null);

  const fetchMovimientos = useCallback(async (isRefresh = false) => {
    try {
      if (!isRefresh) setLoading(true);
      setError(null);
      const res = await apiGetMovimientos(1, 50);
      setMovimientos(res.results || []);
    } catch (err: any) {
      setError(err.message || 'Error al obtener movimientos de inventario.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchMovimientos();
    }, [fetchMovimientos])
  );

  const handleRefresh = () => {
    setRefreshing(true);
    fetchMovimientos(true);
  };

  const getTipoBadge = (tipo: string) => {
    switch (tipo) {
      case 'ENTRADA':
        return <Badge label="Entrada" variant="success" size="small" />;
      case 'SALIDA':
        return <Badge label="Salida" variant="danger" size="small" />;
      case 'AJUSTE':
        return <Badge label="Ajuste" variant="info" size="small" />;
      default:
        return <Badge label={tipo} variant="neutral" size="small" />;
    }
  };

  const filteredList = filterTipo
    ? movimientos.filter((m) => m.tipo_movimiento === filterTipo)
    : movimientos;

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]} edges={['top', 'left', 'right']}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <View>
          <Text style={[styles.title, { color: colors.text }]}>Control de Inventario</Text>
          <Text style={[styles.subtitle, { color: colors.textMuted }]}>
            Historial de entradas, ventas y ajustes de almacén
          </Text>
        </View>
        <View style={[styles.headerIcon, { backgroundColor: `${colors.accent}15` }]}>
          <Ionicons name="cube-outline" size={22} color={colors.accent} />
        </View>
      </View>

      {/* Filtros de Tipo */}
      <View style={styles.filterBar}>
        {[
          { label: 'Todos', value: null },
          { label: 'Entradas', value: 'ENTRADA' },
          { label: 'Salidas', value: 'SALIDA' },
          { label: 'Ajustes', value: 'AJUSTE' },
        ].map((item) => {
          const isSelected = filterTipo === item.value;
          return (
            <Pressable
              key={item.label}
              style={[
                styles.filterChip,
                isSelected
                  ? { backgroundColor: colors.primary, borderColor: colors.primary }
                  : { backgroundColor: colors.card, borderColor: colors.border },
              ]}
              onPress={() => setFilterTipo(item.value)}
            >
              <Text
                style={[
                  styles.filterChipText,
                  isSelected ? { color: '#FFFFFF' } : { color: colors.text },
                ]}
              >
                {item.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {/* Lista */}
      {loading && !refreshing ? (
        <LoadingView message="Cargando historial de inventario..." />
      ) : error ? (
        <ErrorView message={error} onRetry={() => fetchMovimientos()} />
      ) : (
        <FlatList
          data={filteredList}
          keyExtractor={(item) => item.id.toString()}
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
          renderItem={({ item }) => (
            <View style={[styles.itemCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={styles.cardHeader}>
                <View style={styles.muebleInfo}>
                  <Text style={[styles.muebleName, { color: colors.text }]} numberOfLines={1}>
                    {item.mueble?.nombre || `Mueble #${item.mueble_id}`}
                  </Text>
                  <Text style={[styles.motivoText, { color: colors.textMuted }]}>
                    {item.motivo}
                  </Text>
                </View>

                <View style={styles.badgeCol}>
                  {getTipoBadge(item.tipo_movimiento)}
                  <Text
                    style={[
                      styles.cantidadText,
                      {
                        color:
                          item.tipo_movimiento === 'ENTRADA'
                            ? colors.success
                            : item.tipo_movimiento === 'SALIDA'
                            ? colors.danger
                            : colors.accent,
                      },
                    ]}
                  >
                    {item.tipo_movimiento === 'ENTRADA' ? '+' : item.tipo_movimiento === 'SALIDA' ? '-' : ''}
                    {item.cantidad} uds
                  </Text>
                </View>
              </View>

              <View style={[styles.cardFooter, { borderTopColor: colors.border }]}>
                <View style={styles.footerRow}>
                  <Ionicons name="time-outline" size={13} color={colors.textMuted} style={{ marginRight: 4 }} />
                  <Text style={[styles.dateText, { color: colors.textMuted }]}>
                    {new Date(item.fecha_movimiento).toLocaleString('es-MX')}
                  </Text>
                </View>
                {item.usuario_username ? (
                  <View style={styles.footerRow}>
                    <Ionicons name="person-circle-outline" size={14} color={colors.textMuted} style={{ marginRight: 4 }} />
                    <Text style={[styles.userText, { color: colors.textMuted }]}>
                      {item.usuario_username}
                    </Text>
                  </View>
                ) : null}
              </View>
            </View>
          )}
          ListEmptyComponent={
            <EmptyView
              title="Sin movimientos registrados"
              description="Los movimientos de inventario se reflejarán aquí al agregar o surtir stock."
              icon="cube-outline"
            />
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
  title: {
    fontSize: 22,
    fontWeight: '800',
  },
  subtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  headerIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  filterBar: {
    flexDirection: 'row',
    paddingHorizontal: 18,
    paddingVertical: 10,
    gap: 8,
  },
  filterChip: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
  },
  filterChipText: {
    fontSize: 12,
    fontWeight: '700',
  },
  listContent: {
    paddingHorizontal: 18,
    paddingBottom: 24,
  },
  itemCard: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    marginBottom: 12,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  muebleInfo: {
    flex: 1,
    marginRight: 12,
  },
  muebleName: {
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 4,
  },
  motivoText: {
    fontSize: 13,
  },
  badgeCol: {
    alignItems: 'flex-end',
    gap: 4,
  },
  cantidadText: {
    fontSize: 14,
    fontWeight: '800',
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 8,
    borderTopWidth: 1,
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dateText: {
    fontSize: 11,
  },
  userText: {
    fontSize: 11,
    fontWeight: '600',
  },
});
