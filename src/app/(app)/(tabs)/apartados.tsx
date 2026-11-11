import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
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
import { Badge } from '../../../components/Badge';
import { EmptyView } from '../../../components/EmptyView';
import { ErrorView } from '../../../components/ErrorView';
import { LoadingView } from '../../../components/LoadingView';
import { Pagination } from '../../../components/Pagination';
import { Colors } from '../../../constants/theme';
import { Apartado } from '../../../types';
import { apiAceptarApartado, apiGetApartados, apiRechazarApartado } from '../../../utils/api';
import { getStoredPageSize } from '../../../utils/settingsStorage';
import { getUser } from '../../../utils/tokenStorage';

const ESTADO_BADGE = {
  PENDIENTE: { label: 'Pendiente', variant: 'warning' },
  ACEPTADO: { label: 'Aceptado', variant: 'success' },
  RECHAZADO: { label: 'Rechazado', variant: 'danger' },
  CANCELADO: { label: 'Vencido', variant: 'neutral' },
} as const;

/** Tiempo restante legible: "4d 6h", "5h 20m", "12m". */
const formatRestante = (ms: number) => {
  const min = Math.floor(ms / 60000);
  const d = Math.floor(min / 1440);
  const h = Math.floor((min % 1440) / 60);
  const m = min % 60;
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
};

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
  const [vista, setVista] = useState<'activos' | 'historial'>('activos');
  const [now, setNow] = useState(() => Date.now());
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  // Actualiza el countdown cada minuto.
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 60000);
    return () => clearInterval(timer);
  }, []);

  const fetchApartados = useCallback(
    async (targetPage = 1, size = pageSize, isRefresh = false, currentVista = vista) => {
      try {
        if (!isRefresh) setLoading(true);
        setError(null);
        const staff = !!(await getUser())?.is_staff;
        setIsStaff(staff);

        const params: Parameters<typeof apiGetApartados>[0] = {
          page: targetPage,
          page_size: size,
        };
        if (!staff) {
          if (currentVista === 'activos') {
            params.estado = 'PENDIENTE';
          } else {
            params.historial = true;
          }
        }

        const res = await apiGetApartados(params);
        setApartados(res.results || []);
        setTotalCount(res.count);
        setTotalPages(Math.max(1, Math.ceil(res.count / size)));
        setPage(targetPage);
      } catch (err: any) {
        setError(err.message || 'Error al obtener los apartados.');
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [pageSize, vista]
  );

  useFocusEffect(
    useCallback(() => {
      let isMounted = true;
      getStoredPageSize().then((storedSize) => {
        if (!isMounted) return;
        setPageSize(storedSize);
        fetchApartados(1, storedSize, false, vista);
      });
      return () => {
        isMounted = false;
      };
    }, [fetchApartados, vista])
  );

  const handleRefresh = () => {
    setRefreshing(true);
    fetchApartados(page, pageSize, true, vista);
  };

  const handleSelectVista = (newVista: 'activos' | 'historial') => {
    if (newVista === vista) return;
    setVista(newVista);
    setPage(1);
    fetchApartados(1, pageSize, false, newVista);
  };

  const resolver = (apartado: Apartado, accion: 'aceptar' | 'rechazar') => {
    const aceptar = accion === 'aceptar';
    Alert.alert(
      aceptar ? 'Aceptar apartado' : 'Rechazar apartado',
      aceptar
        ? `${apartado.codigo}: se registrará la venta de ${apartado.cantidad} x "${apartado.mueble.nombre}".`
        : `${apartado.codigo}: se liberarán ${apartado.cantidad} unidades de "${apartado.mueble.nombre}" al stock.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: aceptar ? 'Aceptar' : 'Rechazar',
          style: aceptar ? 'default' : 'destructive',
          onPress: async () => {
            try {
              setResolvingId(apartado.id);
              if (aceptar) {
                await apiAceptarApartado(apartado.id);
              } else {
                await apiRechazarApartado(apartado.id);
              }
              // Si la página actual queda vacía tras resolver un apartado, regresar a la página anterior si existe
              const targetPage = apartados.length === 1 && page > 1 ? page - 1 : page;
              await fetchApartados(targetPage, pageSize, false, vista);
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

  const lista = apartados;

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
        <Text style={[styles.cardCode, { color: colors.accent }]}>{item.codigo}</Text>

        <Text style={[styles.cardDetail, { color: colors.textMuted }]}>
          {item.cantidad} {item.cantidad === 1 ? 'pieza' : 'piezas'} · Total {formatPrice(total)}
        </Text>
        {isStaff ? (
          <Text style={[styles.cardDetail, { color: colors.textMuted }]}>Cliente: {item.usuario_username}</Text>
        ) : null}
        <Text style={[styles.cardDate, { color: colors.textMuted }]}>
          {new Date(item.creado_en).toLocaleString('es-MX')}
        </Text>

        {item.estado === 'PENDIENTE' ? (() => {
          const restante = new Date(item.expira_en).getTime() - now;
          const urgente = restante < 24 * 3600 * 1000;
          const color = urgente ? colors.danger : colors.warning;
          return (
            <View style={[styles.countdown, { backgroundColor: `${color}15` }]}>
              <Ionicons name="time-outline" size={14} color={color} />
              <Text style={[styles.countdownText, { color }]}>
                {restante > 0 ? `Vence en ${formatRestante(restante)}` : 'Vencido, se cancelará al actualizar'}
              </Text>
            </View>
          );
        })() : null}

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
              ? `${totalCount} ${totalCount === 1 ? 'apartado registrado' : 'apartados registrados'}`
              : vista === 'activos'
                ? `${totalCount} ${totalCount === 1 ? 'apartado activo' : 'apartados activos'}`
                : `${totalCount} ${totalCount === 1 ? 'apartado resuelto' : 'apartados resueltos'}`}
          </Text>
        </View>

        <View style={[styles.iconPill, { backgroundColor: `${colors.accent}15` }]}>
          <Ionicons name="bookmark" size={20} color={colors.accent} />
        </View>
      </View>

      {!isStaff ? (
        <View style={styles.tabsRow}>
          {(['activos', 'historial'] as const).map((v) => (
            <Pressable
              key={v}
              style={[
                styles.tabChip,
                vista === v
                  ? { backgroundColor: colors.accent, borderColor: colors.accent }
                  : { backgroundColor: colors.card, borderColor: colors.border },
              ]}
              onPress={() => handleSelectVista(v)}
              accessibilityRole="tab"
              accessibilityState={{ selected: vista === v }}
            >
              <Text style={[styles.tabChipText, { color: vista === v ? '#FFFFFF' : colors.text }]}>
                {v === 'activos' ? 'Activos' : 'Historial'}
              </Text>
            </Pressable>
          ))}
        </View>
      ) : null}

      {loading && !refreshing ? (
        <LoadingView message="Cargando apartados..." />
      ) : error ? (
        <ErrorView message={error} onRetry={() => fetchApartados(page, pageSize, false, vista)} />
      ) : (
        <FlatList
          data={lista}
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
          ListFooterComponent={
            totalPages > 1 ? (
              <Pagination
                page={page}
                totalPages={totalPages}
                onPageChange={(p) => fetchApartados(p, pageSize, false, vista)}
              />
            ) : undefined
          }
          ListEmptyComponent={
            <EmptyView
              title={
                isStaff ? 'No hay apartados' : vista === 'activos' ? 'No tienes apartados activos' : 'Sin historial'
              }
              description={
                isStaff
                  ? 'Cuando un cliente aparte un mueble aparecerá aquí para que lo revises.'
                  : vista === 'activos'
                    ? 'Abre un mueble del catálogo y apártalo para reservar tus piezas.'
                    : 'Aquí verás tus apartados aceptados, rechazados o vencidos.'
              }
              icon={vista === 'historial' && !isStaff ? 'time-outline' : 'bookmark-outline'}
              actionLabel={isStaff || vista === 'historial' ? undefined : 'Explorar catálogo'}
              onAction={isStaff || vista === 'historial' ? undefined : () => router.replace('/')}
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
  tabsRow: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 18,
    paddingTop: 12,
  },
  tabChip: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
  },
  tabChipText: {
    fontSize: 13,
    fontWeight: '700',
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
  cardCode: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  cardDetail: {
    fontSize: 13,
    marginTop: 2,
  },
  cardDate: {
    fontSize: 11,
    marginTop: 6,
  },
  countdown: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    marginTop: 8,
  },
  countdownText: {
    fontSize: 12,
    fontWeight: '700',
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
