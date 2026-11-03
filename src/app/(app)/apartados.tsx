import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
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
import { Apartado } from '../../types';
import { apiAceptarApartado, apiGetApartados, apiRechazarApartado } from '../../utils/api';
import { getUser } from '../../utils/tokenStorage';

const ESTADO_BADGE = {
  PENDIENTE: { label: 'Pendiente', variant: 'warning' },
  ACEPTADO: { label: 'Aceptado', variant: 'success' },
  RECHAZADO: { label: 'Rechazado', variant: 'danger' },
} as const;

const formatPrice = (price: string | number) => {
  const num = typeof price === 'number' ? price : parseFloat(price);
  return isNaN(num) ? '$0.00' : `$${num.toLocaleString('es-MX', { minimumFractionDigits: 2 })}`;
};

export default function ApartadosScreen() {
  const router = useRouter();
  const scheme = useColorScheme() ?? 'light';
  const colors = Colors[scheme];

  const [isStaff, setIsStaff] = useState(false);
  const [apartados, setApartados] = useState<Apartado[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resolvingId, setResolvingId] = useState<number | null>(null);

  const fetchApartados = useCallback(async (isRefresh = false) => {
    try {
      if (!isRefresh) setLoading(true);
      setError(null);
      const staff = !!(await getUser())?.is_staff;
      setIsStaff(staff);
      // Staff ve todos; el usuario normal solo sus apartados activos (pendientes).
      const res = await apiGetApartados(staff ? {} : { estado: 'PENDIENTE' });
      setApartados(res.results || []);
    } catch (err: any) {
      setError(err.message || 'Error al obtener los apartados.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchApartados();
    }, [fetchApartados])
  );

  const handleRefresh = () => {
    setRefreshing(true);
    fetchApartados(true);
  };

  const resolver = (apartado: Apartado, accion: 'aceptar' | 'rechazar') => {
    const aceptar = accion === 'aceptar';
    Alert.alert(
      aceptar ? 'Aceptar apartado' : 'Rechazar apartado',
      aceptar
        ? `Se registrará la venta de ${apartado.cantidad} x "${apartado.mueble.nombre}".`
        : `Se liberarán ${apartado.cantidad} unidades de "${apartado.mueble.nombre}" al stock.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: aceptar ? 'Aceptar' : 'Rechazar',
          style: aceptar ? 'default' : 'destructive',
          onPress: async () => {
            try {
              setResolvingId(apartado.id);
              const actualizado = aceptar
                ? await apiAceptarApartado(apartado.id)
                : await apiRechazarApartado(apartado.id);
              setApartados((prev) => prev.map((a) => (a.id === actualizado.id ? actualizado : a)));
            } catch (err: any) {
              Alert.alert('Error', err.message || 'No se pudo actualizar el apartado.');
            } finally {
              setResolvingId(null);
            }
          },
        },
      ]
    );
  };

  const renderItem = ({ item }: { item: Apartado }) => {
    const badge = ESTADO_BADGE[item.estado];
    const total = item.venta?.total ?? Number(item.mueble.precio) * item.cantidad;
    const resolving = resolvingId === item.id;

    return (
      <Pressable
        style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}
        onPress={() => router.push(`/(app)/mueble/${item.mueble.id}`)}
      >
        <View style={styles.cardHeader}>
          <Text style={[styles.cardTitle, { color: colors.text }]} numberOfLines={1}>
            {item.mueble.nombre}
          </Text>
          <Badge label={badge.label} variant={badge.variant} size="small" />
        </View>

        <Text style={[styles.cardDetail, { color: colors.textMuted }]}>
          {item.cantidad} {item.cantidad === 1 ? 'pieza' : 'piezas'} · Total {formatPrice(total)}
        </Text>
        {isStaff ? (
          <Text style={[styles.cardDetail, { color: colors.textMuted }]}>Cliente: {item.usuario_username}</Text>
        ) : null}
        <Text style={[styles.cardDate, { color: colors.textMuted }]}>
          {new Date(item.creado_en).toLocaleString('es-MX')}
        </Text>

        {isStaff && item.estado === 'PENDIENTE' ? (
          <View style={styles.actionsRow}>
            {resolving ? (
              <ActivityIndicator color={colors.accent} />
            ) : (
              <>
                <Pressable
                  style={[styles.actionButton, { backgroundColor: `${colors.danger}15`, borderColor: `${colors.danger}40` }]}
                  onPress={() => resolver(item, 'rechazar')}
                >
                  <Ionicons name="close" size={16} color={colors.danger} />
                  <Text style={[styles.actionText, { color: colors.danger }]}>Rechazar</Text>
                </Pressable>
                <Pressable
                  style={[styles.actionButton, { backgroundColor: colors.accent, borderColor: colors.accent }]}
                  onPress={() => resolver(item, 'aceptar')}
                >
                  <Ionicons name="checkmark" size={16} color="#FFFFFF" />
                  <Text style={[styles.actionText, { color: '#FFFFFF' }]}>Aceptar</Text>
                </Pressable>
              </>
            )}
          </View>
        ) : null}
      </Pressable>
    );
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]} edges={['top', 'left', 'right']}>
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <View>
          <Text style={[styles.headerTitle, { color: colors.text }]}>
            {isStaff ? 'Gestión de Apartados' : 'Mis Apartados'}
          </Text>
          <Text style={[styles.headerSubtitle, { color: colors.textMuted }]}>
            {isStaff
              ? `${apartados.filter((a) => a.estado === 'PENDIENTE').length} pendientes de revisión`
              : `${apartados.length} ${apartados.length === 1 ? 'apartado activo' : 'apartados activos'}`}
          </Text>
        </View>

        <View style={[styles.iconPill, { backgroundColor: `${colors.accent}15` }]}>
          <Ionicons name="bookmark" size={20} color={colors.accent} />
        </View>
      </View>

      {loading && !refreshing ? (
        <LoadingView message="Cargando apartados..." />
      ) : error ? (
        <ErrorView message={error} onRetry={() => fetchApartados()} />
      ) : (
        <FlatList
          data={apartados}
          keyExtractor={(item) => item.id.toString()}
          renderItem={renderItem}
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
              title={isStaff ? 'No hay apartados' : 'No tienes apartados activos'}
              description={
                isStaff
                  ? 'Cuando un cliente aparte un mueble aparecerá aquí para que lo revises.'
                  : 'Abre un mueble del catálogo y apártalo para reservar tus piezas.'
              }
              icon="bookmark-outline"
              actionLabel={isStaff ? undefined : 'Explorar catálogo'}
              onAction={isStaff ? undefined : () => router.replace('/(app)')}
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
    flexGrow: 1,
  },
  card: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    flex: 1,
  },
  cardDetail: {
    fontSize: 13,
    marginTop: 2,
  },
  cardDate: {
    fontSize: 11,
    marginTop: 6,
  },
  actionsRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
    marginTop: 12,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
  },
  actionText: {
    fontSize: 13,
    fontWeight: '700',
  },
});
