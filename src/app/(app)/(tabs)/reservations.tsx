// Reservation management: splits active/history, shows time left and lets staff accept or reject.

import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
  useColorScheme,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Badge } from "../../../components/Badge";
import { EmptyView } from "../../../components/EmptyView";
import { ErrorView } from "../../../components/ErrorView";
import { Pagination } from "../../../components/Pagination";
import { ReservationsSkeleton } from "../../../components/Skeleton";
import { Colors } from "../../../constants/theme";
import { dialog } from "../../../context/DialogContext";
import { useResponsive } from "../../../hooks/use-responsive";
import { Reservation } from "../../../types";
import {
  apiAcceptReservation,
  apiGetReservations,
  apiRejectReservation,
} from "../../../utils/api";
import { getStoredPageSize } from "../../../utils/settingsStorage";
import { getUser } from "../../../utils/tokenStorage";

// Maps each business status to a label and a Badge color variant.
const STATUS_BADGE = {
  PENDING: { label: "Pendiente", variant: "warning" },
  ACCEPTED: { label: "Aceptado", variant: "success" },
  REJECTED: { label: "Rechazado", variant: "danger" },
  CANCELLED: { label: "Vencido", variant: "neutral" },
} as const;

/** Formats the milliseconds left before expiration ("4d 6h", "5h 20m", "12m"). */
const formatTimeLeft = (ms: number) => {
  const min = Math.floor(ms / 60000);
  const d = Math.floor(min / 1440);
  const h = Math.floor((min % 1440) / 60);
  const m = min % 60;
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
};

const formatPrice = (price: string | number) => {
  const num = typeof price === "number" ? price : parseFloat(price);
  return isNaN(num)
    ? "$0.00"
    : `$${num.toLocaleString("es-MX", { minimumFractionDigits: 2 })}`;
};

export default function ReservationsScreen() {
  const router = useRouter();
  const scheme = useColorScheme() ?? "light";
  const colors = Colors[scheme];
  const { isMobile, contentMaxWidth } = useResponsive("content");

  // On tablet/desktop it narrows and centers the content column; mobile keeps the original full width.
  const desktopContainerStyle = !isMobile
    ? {
        maxWidth: contentMaxWidth,
        width: "100%" as const,
        alignSelf: "center" as const,
      }
    : undefined;

  const [isStaff, setIsStaff] = useState(false);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resolvingId, setResolvingId] = useState<number | null>(null);
  const [view, setView] = useState<"active" | "history">("active");
  const [now, setNow] = useState(() => Date.now());
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  // Refreshes the local clock every minute to update the countdown without calling the API.
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 60000);
    return () => clearInterval(timer);
  }, []);

  const fetchReservations = useCallback(
    async (
      targetPage = 1,
      size = pageSize,
      isRefresh = false,
      currentView = view,
    ) => {
      try {
        if (!isRefresh) setLoading(true);
        setError(null);
        const staff = !!(await getUser())?.is_staff;
        setIsStaff(staff);

        const params: Parameters<typeof apiGetReservations>[0] = {
          page: targetPage,
          page_size: size,
        };
        if (currentView === "active") {
          params.status = "PENDING";
        } else {
          params.history = true;
        }

        const res = await apiGetReservations(params);
        setReservations(res.results || []);
        setTotalCount(res.count);
        setTotalPages(Math.max(1, Math.ceil(res.count / size)));
        setPage(targetPage);
      } catch (err: any) {
        setError(err.message || "Error al obtener los apartados.");
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [pageSize, view],
  );

  useFocusEffect(
    useCallback(() => {
      let isMounted = true;
      getStoredPageSize().then((storedSize) => {
        if (!isMounted) return;
        setPageSize(storedSize);
        fetchReservations(1, storedSize, false, view);
      });
      return () => {
        isMounted = false;
      };
    }, [fetchReservations, view]),
  );

  const handleRefresh = () => {
    setRefreshing(true);
    fetchReservations(page, pageSize, true, view);
  };

  const handleSelectView = (newView: "active" | "history") => {
    if (newView === view) return;
    setView(newView);
    setPage(1);
    fetchReservations(1, pageSize, false, newView);
  };

  // Asks for confirmation before accepting (creates a Sale) or rejecting (returns pieces to stock).
  const resolveReservation = async (
    reservation: Reservation,
    action: "accept" | "reject",
  ) => {
    const accept = action === "accept";
    const confirmed = await dialog.confirm({
      title: accept ? "Aceptar apartado" : "Rechazar apartado",
      message: accept
        ? `${reservation.code}: se registrará la venta de ${reservation.quantity} x "${reservation.furniture.name}".`
        : `${reservation.code}: se liberarán ${reservation.quantity} unidades de "${reservation.furniture.name}" al stock.`,
      confirmText: accept ? "Aceptar" : "Rechazar",
      cancelText: "Cancelar",
      confirmStyle: accept ? "default" : "destructive",
    });

    if (!confirmed) return;

    try {
      setResolvingId(reservation.id);
      if (accept) {
        await apiAcceptReservation(reservation.id);
      } else {
        await apiRejectReservation(reservation.id);
      }
      // If the current page is empty after resolving a reservation, go back to the previous page if there is one
      const targetPage = reservations.length === 1 && page > 1 ? page - 1 : page;
      await fetchReservations(targetPage, pageSize, false, view);
    } catch (err: any) {
      dialog.alert({
        title: "Error",
        message: err.message || "No se pudo actualizar el apartado.",
      });
    } finally {
      setResolvingId(null);
    }
  };

  const list = reservations;

  const renderItem = ({ item }: { item: Reservation }) => {
    const badge = STATUS_BADGE[item.status];
    const total =
      item.sale?.total ?? Number(item.furniture.price) * item.quantity;
    const resolving = resolvingId === item.id;

    return (
      <View
        style={[
          styles.card,
          { backgroundColor: colors.card, borderColor: colors.border },
        ]}
      >
        <Pressable
          onPress={() => router.push(`/(app)/furniture/${item.furniture.id}`)}
          accessibilityRole="button"
          accessibilityLabel={`Apartado ${item.code} para ${item.furniture.name}`}
          accessibilityHint="Toca para ver el detalle de este mueble"
        >
          <View style={styles.cardHeader}>
            <Text
              style={[styles.cardTitle, { color: colors.text }]}
              numberOfLines={1}
            >
              {item.furniture.name}
            </Text>
            <Badge label={badge.label} variant={badge.variant} size="small" />
          </View>
          <Text style={[styles.cardCode, { color: colors.accent }]}>
            {item.code}
          </Text>

          <Text style={[styles.cardDetail, { color: colors.textMuted }]}>
            {item.quantity} {item.quantity === 1 ? "pieza" : "piezas"} · Total{" "}
            {formatPrice(total)}
          </Text>
          {isStaff ? (
            <View style={{ marginVertical: 4 }}>
              <Text
                style={[
                  styles.cardDetail,
                  { color: colors.text, fontWeight: "600" },
                ]}
              >
                Cliente:{" "}
                {item.user_active === false
                  ? item.user_full_name
                    ? `${item.user_full_name} (cuenta eliminada)`
                    : "Cuenta eliminada"
                  : item.user_full_name
                    ? `${item.user_full_name} (@${item.user_username})`
                    : item.user_username}
              </Text>
              {item.user_email ? (
                <Text style={[styles.cardDetail, { color: colors.textMuted }]}>
                  Contacto: {item.user_email}
                </Text>
              ) : null}
            </View>
          ) : null}
          <Text style={[styles.cardDate, { color: colors.textMuted }]}>
            {new Date(item.created_at).toLocaleString("es-MX")}
          </Text>

          {item.status === "PENDING"
            ? (() => {
                const timeLeft = new Date(item.expires_at).getTime() - now;
                const isUrgent = timeLeft < 24 * 3600 * 1000;
                const color = isUrgent ? colors.danger : colors.warning;
                return (
                  <View
                    style={[
                      styles.countdown,
                      { backgroundColor: `${color}15` },
                    ]}
                  >
                    <Ionicons name="time-outline" size={14} color={color} />
                    <Text style={[styles.countdownText, { color }]}>
                      {timeLeft > 0
                        ? `Vence en ${formatTimeLeft(timeLeft)}`
                        : "Vencido, se cancelará al actualizar"}
                    </Text>
                  </View>
                );
              })()
            : null}
        </Pressable>

        {isStaff && item.status === "PENDING" ? (
          <View style={styles.actionsRow}>
            {resolving ? (
              <ActivityIndicator color={colors.accent} />
            ) : (
              <>
                <Pressable
                  style={[
                    styles.actionButton,
                    {
                      backgroundColor: `${colors.danger}15`,
                      borderColor: `${colors.danger}40`,
                    },
                  ]}
                  onPress={() => resolveReservation(item, "reject")}
                  accessibilityRole="button"
                  accessibilityLabel="Rechazar apartado"
                  accessibilityHint="Cancela este apartado y regresa las unidades al inventario disponible"
                >
                  <Ionicons name="close" size={16} color={colors.danger} />
                  <Text style={[styles.actionText, { color: colors.danger }]}>
                    Rechazar
                  </Text>
                </Pressable>
                <Pressable
                  style={[
                    styles.actionButton,
                    {
                      backgroundColor: colors.accent,
                      borderColor: colors.accent,
                    },
                  ]}
                  onPress={() => resolveReservation(item, "accept")}
                  accessibilityRole="button"
                  accessibilityLabel="Aceptar apartado"
                  accessibilityHint="Aprueba el apartado y formaliza la venta de los muebles"
                >
                  <Ionicons name="checkmark" size={16} color="#FFFFFF" />
                  <Text style={[styles.actionText, { color: "#FFFFFF" }]}>
                    Aceptar
                  </Text>
                </Pressable>
              </>
            )}
          </View>
        ) : null}
      </View>
    );
  };

  return (
    <SafeAreaView
      style={[styles.safeArea, { backgroundColor: colors.background }]}
      edges={["top", "left", "right"]}
    >
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <View style={[styles.headerInner, desktopContainerStyle]}>
          <View>
            <Text style={[styles.headerTitle, { color: colors.text }]}>
              {isStaff ? "Gestión de Apartados" : "Mis Apartados"}
            </Text>
            <Text style={[styles.headerSubtitle, { color: colors.textMuted }]}>
              {view === "active"
                ? `${totalCount} ${totalCount === 1 ? "apartado activo" : "apartados activos"}`
                : `${totalCount} ${totalCount === 1 ? "apartado resuelto" : "apartados resueltos"}`}
            </Text>
          </View>

          <View
            style={[styles.iconPill, { backgroundColor: `${colors.accent}15` }]}
          >
            <Ionicons name="bookmark" size={20} color={colors.accent} />
          </View>
        </View>
      </View>

      <View style={[styles.tabsRow, desktopContainerStyle]}>
        {(["active", "history"] as const).map((v) => (
          <Pressable
            key={v}
            style={[
              styles.tabChip,
              view === v
                ? { backgroundColor: colors.accent, borderColor: colors.accent }
                : { backgroundColor: colors.card, borderColor: colors.border },
            ]}
            onPress={() => handleSelectView(v)}
            accessibilityRole="tab"
            accessibilityState={{ selected: view === v }}
            accessibilityLabel={
              v === "active" ? "Pestaña Activos" : "Pestaña Historial"
            }
            accessibilityHint={`Filtra la lista para mostrar apartados ${v === "active" ? "pendientes" : "resueltos"}`}
          >
            <Text
              style={[
                styles.tabChipText,
                { color: view === v ? "#FFFFFF" : colors.text },
              ]}
            >
              {v === "active" ? "Activos" : "Historial"}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* Shows a skeleton on the first load to keep the layout stable before the list renders. */}
      {loading && !refreshing ? (
        <ReservationsSkeleton />
      ) : error ? (
        <ErrorView
          message={error}
          onRetry={() => fetchReservations(page, pageSize, false, view)}
        />
      ) : (
        <FlatList
          data={list}
          keyExtractor={(item) => item.id.toString()}
          renderItem={renderItem}
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
          ListFooterComponent={
            totalPages > 1 ? (
              <Pagination
                page={page}
                totalPages={totalPages}
                onPageChange={(p) => fetchReservations(p, pageSize, false, view)}
              />
            ) : undefined
          }
          ListEmptyComponent={
            <EmptyView
              title={
                view === "history"
                  ? "Sin historial"
                  : isStaff
                    ? "No hay apartados pendientes"
                    : "No tienes apartados activos"
              }
              description={
                view === "history"
                  ? isStaff
                    ? "Aquí verás los apartados aceptados, rechazados o vencidos."
                    : "Aquí verás tus apartados aceptados, rechazados o vencidos."
                  : isStaff
                    ? "Cuando un cliente aparte un mueble aparecerá aquí para que lo revises."
                    : "Abre un mueble del catálogo y apártalo para reservar tus piezas."
              }
              icon={view === "history" ? "time-outline" : "bookmark-outline"}
              actionLabel={
                isStaff || view === "history"
                  ? undefined
                  : "Explorar catálogo"
              }
              onAction={
                isStaff || view === "history"
                  ? undefined
                  : () => router.replace("/")
              }
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
    borderBottomWidth: 1,
  },
  headerInner: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 18,
    paddingVertical: 14,
    width: "100%",
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
  tabsRow: {
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 18,
    paddingTop: 12,
  },
  tabChip: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: "center",
  },
  tabChipText: {
    fontSize: 13,
    fontWeight: "700",
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
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 8,
    marginBottom: 6,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: "700",
    flex: 1,
  },
  cardCode: {
    fontSize: 12,
    fontWeight: "800",
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
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    marginTop: 8,
  },
  countdownText: {
    fontSize: 12,
    fontWeight: "700",
  },
  actionsRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 8,
    marginTop: 12,
  },
  actionButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
  },
  actionText: {
    fontSize: 13,
    fontWeight: "700",
  },
});
