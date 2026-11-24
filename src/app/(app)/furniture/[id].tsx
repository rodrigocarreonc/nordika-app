// Furniture detail screen: customers can reserve and mark favorites; staff can edit/delete.

import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useColorScheme,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Badge } from "../../../components/Badge";
import { ErrorView } from "../../../components/ErrorView";
import { ImageViewerModal } from "../../../components/ImageViewerModal";
import { FurnitureDetailSkeleton } from "../../../components/Skeleton";
import { Colors } from "../../../constants/theme";
import { dialog } from "../../../context/DialogContext";
import { useResponsive } from "../../../hooks/use-responsive";
import { Furniture } from "../../../types";
import {
  apiCreateReservation,
  apiDeleteFurniture,
  apiGetFurniture,
  apiToggleFavorite,
  resolveImageUrl,
} from "../../../utils/api";
import { safeBack } from "../../../utils/navigation";
import { getUser } from "../../../utils/tokenStorage";

export default function FurnitureDetailsScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const scheme = useColorScheme() ?? "light";
  const colors = Colors[scheme];
  const { isMobile, isTablet, isDesktop, contentMaxWidth } =
    useResponsive("content");

  const furnitureId = Number(id);

  const [furniture, setFurniture] = useState<Furniture | null>(null);
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [favLoading, setFavLoading] = useState(false);
  const [reserveQuantity, setReserveQuantity] = useState(1);
  const [reserving, setReserving] = useState(false);
  const [isStaff, setIsStaff] = useState(false);
  const [showFullscreenImage, setShowFullscreenImage] = useState(false);

  const fetchDetails = useCallback(async () => {
    if (!furnitureId) return;
    try {
      setLoading(true);
      setError(null);
      const data = await apiGetFurniture(furnitureId);
      setFurniture(data);
      setImageUri(await resolveImageUrl(data.image));
    } catch (err: any) {
      setError(err.message || "Error al obtener detalles del mueble.");
    } finally {
      setLoading(false);
    }
  }, [furnitureId]);

  // Reloads when returning to the screen (e.g. after editing the furniture).
  useFocusEffect(
    useCallback(() => {
      getUser().then((u) => {
        setIsStaff(!!u?.is_staff);
      });
      fetchDetails();
    }, [fetchDetails]),
  );

  const handleToggleFav = async () => {
    if (!furniture) return;
    try {
      setFavLoading(true);
      const res = await apiToggleFavorite(furniture.id);
      setFurniture({
        ...furniture,
        is_favorite: res.is_favorite,
        favorites_count: res.favorites_count,
      });
    } catch (err: any) {
      dialog.alert({
        title: "Error",
        message: err.message || "No se pudo actualizar favoritos.",
      });
    } finally {
      setFavLoading(false);
    }
  };

  // The backend blocks with 409 if there are pending/sold reservations and cleans up rejected/cancelled ones.
  const handleDelete = async () => {
    if (!furniture) return;
    const ok = await dialog.confirm({
      title: "Eliminar Mueble",
      message: `¿Estás seguro de que deseas eliminar "${furniture.name}"? Esta acción no se puede deshacer.`,
      confirmText: "Eliminar",
      cancelText: "Cancelar",
      confirmStyle: "destructive",
    });
    if (!ok) return;

    try {
      await apiDeleteFurniture(furniture.id);
      await dialog.alert({
        title: "Éxito",
        message: "El mueble ha sido eliminado.",
      });
      safeBack(router, "/");
    } catch (err: any) {
      dialog.alert({
        title: "Error al eliminar",
        message: err.message || "No se pudo eliminar el mueble.",
      });
    }
  };

  // Creates the reservation, updates the on-screen stock from the response and offers to go to Mis Apartados.
  const handleReserve = async () => {
    if (!furniture) return;
    try {
      setReserving(true);
      const reservation = await apiCreateReservation(furniture.id, reserveQuantity);
      setFurniture({ ...furniture, stock: reservation.furniture.stock });
      setReserveQuantity(1);
      const expiresAt = new Date(reservation.expires_at).toLocaleString("es-MX", {
        dateStyle: "medium",
        timeStyle: "short",
      });
      dialog.show({
        title: "Mueble apartado",
        message: `Tu apartado ${reservation.code} quedó pendiente de revisión.\n\nTienes 5 días para concretarlo: vence el ${expiresAt}. Si no se concreta antes, se cancelará automáticamente.`,
        buttons: [
          {
            text: "Ver mis apartados",
            onPress: () => router.navigate("/(app)/(tabs)/reservations"),
          },
          {
            text: "Aceptar",
            style: "default",
          },
        ],
      });
    } catch (err: any) {
      dialog.alert({
        title: "No se pudo apartar",
        message: err.message || "Intenta de nuevo.",
      });
    } finally {
      setReserving(false);
    }
  };

  const formatPrice = (price: string | number) => {
    const num = typeof price === "number" ? price : parseFloat(price);
    return isNaN(num)
      ? "$0.00"
      : `$${num.toLocaleString("es-MX", { minimumFractionDigits: 2 })}`;
  };

  // Skeleton only the first time; reloads keep the content visible.
  if (loading && !furniture) {
    return (
      <SafeAreaView
        style={[styles.safeArea, { backgroundColor: colors.background }]}
        edges={["top", "left", "right"]}
      >
        <ScrollView showsVerticalScrollIndicator={false}>
          <FurnitureDetailSkeleton />
        </ScrollView>
      </SafeAreaView>
    );
  }

  if (error || !furniture) {
    return (
      <ErrorView
        message={error || "Mueble no encontrado"}
        onRetry={() => fetchDetails()}
      />
    );
  }

  // On tablet/desktop the reading width is narrowed and the hero height adjusted to avoid excessive zoom.
  const desktopContainerStyle = !isMobile
    ? {
        maxWidth: contentMaxWidth,
        width: "100%" as const,
        alignSelf: "center" as const,
      }
    : undefined;
  const heroHeight = isDesktop ? 420 : isTablet ? 360 : 280;

  return (
    <SafeAreaView
      style={[styles.safeArea, { backgroundColor: colors.background }]}
      edges={["top", "left", "right"]}
    >
      {/* Top navigation bar with a full divider and centered content on desktop */}
      <View
        style={[styles.navBarWrapper, { borderBottomColor: colors.border }]}
      >
        <View style={[styles.navBar, desktopContainerStyle]}>
          <Pressable
            style={[
              styles.navButton,
              { backgroundColor: colors.card, borderColor: colors.border },
            ]}
            onPress={() => safeBack(router, "/")}
            accessibilityRole="button"
            accessibilityLabel="Regresar al catálogo"
            accessibilityHint="Regresar a la pantalla anterior del catálogo"
          >
            <Ionicons name="arrow-back" size={20} color={colors.text} />
          </Pressable>

          <Text
            style={[styles.navTitle, { color: colors.text }]}
            numberOfLines={1}
          >
            Detalle de Producto
          </Text>

          {isStaff ? (
            <View style={styles.navRightActions}>
              {/* Edit button (staff only) */}
              <Pressable
                style={[
                  styles.navButton,
                  { backgroundColor: colors.card, borderColor: colors.border },
                ]}
                onPress={() =>
                  router.push(`/(app)/furniture/form?id=${furniture.id}`)
                }
                accessibilityRole="button"
                accessibilityLabel="Editar mueble"
                accessibilityHint="Abrir formulario de edición del mueble"
              >
                <Ionicons name="create-outline" size={19} color={colors.text} />
              </Pressable>

              {/* Delete button (staff only) */}
              <Pressable
                style={[
                  styles.navButton,
                  {
                    backgroundColor: `${colors.danger}15`,
                    borderColor: `${colors.danger}30`,
                  },
                ]}
                onPress={handleDelete}
                accessibilityRole="button"
                accessibilityLabel="Eliminar mueble"
                accessibilityHint="Eliminar este mueble del catálogo permanentemente"
              >
                <Ionicons
                  name="trash-outline"
                  size={19}
                  color={colors.danger}
                />
              </Pressable>
            </View>
          ) : (
            <View style={{ width: 40 }} />
          )}
        </View>
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          desktopContainerStyle,
          !isMobile && styles.scrollContentDesktop,
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Main hero image: on desktop uses contain on a neutral background to show the whole piece */}
        <View
          style={[
            styles.heroImageContainer,
            {
              height: heroHeight,
              backgroundColor: colors.backgroundElement,
            },
            !isMobile && styles.heroImageContainerDesktop,
          ]}
        >
          {imageUri ? (
            <Pressable
              style={[
                styles.heroImagePressable,
                Platform.OS === "web" && ({ cursor: "zoom-in" } as any),
              ]}
              onPress={() => setShowFullscreenImage(true)}
              accessibilityRole="button"
              accessibilityLabel="Ver imagen en pantalla completa"
              accessibilityHint="Abre la fotografía del mueble ampliada sin recortes"
              testID="hero-image-fullscreen-trigger"
            >
              <Image
                source={{ uri: imageUri }}
                style={styles.heroImage}
                contentFit={isMobile ? "cover" : "contain"}
                transition={300}
              />
              {/* Subtle visual hint that the photo can be enlarged */}
              <View style={styles.expandBadge} pointerEvents="none">
                <Ionicons name="expand-outline" size={18} color="#FFFFFF" />
              </View>
            </Pressable>
          ) : (
            <View
              style={[
                styles.placeholderHero,
                { backgroundColor: colors.backgroundElement },
              ]}
            >
              <Ionicons
                name="image-outline"
                size={60}
                color={colors.textMuted}
              />
              <Text
                style={[
                  styles.placeholderHeroText,
                  { color: colors.textMuted },
                ]}
              >
                Nordika Mobiliario
              </Text>
            </View>
          )}

          {/* Floating favorite button (sibling of the full-screen trigger to avoid nested buttons on Web) */}
          <Pressable
            style={[
              styles.heroFavoriteButton,
              { backgroundColor: colors.card },
            ]}
            onPress={handleToggleFav}
            disabled={favLoading}
            accessibilityRole="button"
            accessibilityLabel={
              furniture.is_favorite ? "Quitar de favoritos" : "Agregar a favoritos"
            }
            accessibilityHint="Guarda o quita este mueble de tu lista de favoritos"
          >
            {favLoading ? (
              <ActivityIndicator size="small" color={colors.accent} />
            ) : (
              <Ionicons
                name={furniture.is_favorite ? "heart" : "heart-outline"}
                size={24}
                color={furniture.is_favorite ? colors.danger : colors.icon}
              />
            )}
          </Pressable>
        </View>

        {/* Product information */}
        <View
          style={[
            styles.infoCard,
            !isMobile && styles.infoCardDesktop,
            { backgroundColor: colors.card, borderColor: colors.border },
          ]}
        >
          {/* Category & supplier */}
          <View style={styles.tagsRow}>
            {furniture.category?.name ? (
              <Badge
                label={furniture.category.name}
                variant="info"
                size="medium"
              />
            ) : null}
            {furniture.stock > 3 ? (
              <Badge
                label={`En stock (${furniture.stock})`}
                variant="success"
                size="medium"
              />
            ) : furniture.stock > 0 ? (
              <Badge
                label={`Últimas ${furniture.stock} unidades`}
                variant="warning"
                size="medium"
              />
            ) : (
              <Badge label="Agotado" variant="danger" size="medium" />
            )}
          </View>

          {/* Title */}
          <Text style={[styles.title, { color: colors.text }]}>
            {furniture.name}
          </Text>

          {/* Price */}
          <View style={styles.priceRow}>
            <Text style={[styles.price, { color: colors.accent }]}>
              {formatPrice(furniture.price)}
            </Text>
            <Text style={[styles.currency, { color: colors.textMuted }]}>
              MXN
            </Text>
          </View>

          {/* Supplier */}
          {furniture.supplier?.name ? (
            <View
              style={[
                styles.supplierBox,
                {
                  backgroundColor: colors.background,
                  borderColor: colors.border,
                },
              ]}
            >
              <Ionicons
                name="business-outline"
                size={20}
                color={colors.textMuted}
                style={{ marginRight: 10 }}
              />
              <View style={{ flex: 1 }}>
                <Text
                  style={[styles.supplierLabel, { color: colors.textMuted }]}
                >
                  Proveedor asociado
                </Text>
                <Text style={[styles.supplierName, { color: colors.text }]}>
                  {furniture.supplier.name}
                </Text>
                {furniture.supplier.contact_name ? (
                  <Text
                    style={[
                      styles.supplierContact,
                      { color: colors.textMuted },
                    ]}
                  >
                    Contacto: {furniture.supplier.contact_name} (
                    {furniture.supplier.phone || furniture.supplier.email})
                  </Text>
                ) : null}
              </View>
            </View>
          ) : null}

          {/* Description */}
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>
              Descripción del Producto
            </Text>
            <Text style={[styles.description, { color: colors.textMuted }]}>
              {furniture.description ||
                "Este artículo cuenta con los más altos estándares de carpintería y diseño nórdico."}
            </Text>
          </View>

          {/* Reserve pieces */}
          {!isStaff && furniture.stock > 0 ? (
            <View
              style={[
                styles.reserveCard,
                { backgroundColor: colors.backgroundElement },
              ]}
            >
              <View style={styles.stepper}>
                <Pressable
                  style={[
                    styles.stepperButton,
                    {
                      backgroundColor: colors.card,
                      borderColor: colors.border,
                    },
                  ]}
                  onPress={() => setReserveQuantity((c) => Math.max(1, c - 1))}
                  disabled={reserveQuantity <= 1}
                  accessibilityRole="button"
                  accessibilityLabel="Disminuir cantidad"
                  accessibilityHint="Resta una pieza a apartar"
                >
                  <Ionicons name="remove" size={18} color={colors.text} />
                </Pressable>
                <Text style={[styles.stepperValue, { color: colors.text }]}>
                  {reserveQuantity}
                </Text>
                <Pressable
                  style={[
                    styles.stepperButton,
                    {
                      backgroundColor: colors.card,
                      borderColor: colors.border,
                    },
                  ]}
                  onPress={() =>
                    setReserveQuantity((c) => Math.min(furniture.stock, c + 1))
                  }
                  disabled={reserveQuantity >= furniture.stock}
                  accessibilityRole="button"
                  accessibilityLabel="Aumentar cantidad"
                  accessibilityHint="Suma una pieza a apartar"
                >
                  <Ionicons name="add" size={18} color={colors.text} />
                </Pressable>
              </View>
              <Pressable
                style={[
                  styles.reserveButton,
                  { backgroundColor: colors.accent },
                ]}
                onPress={handleReserve}
                disabled={reserving}
                accessibilityRole="button"
                accessibilityLabel="Apartar mueble"
                accessibilityHint="Crea una reserva por las piezas seleccionadas"
              >
                {reserving ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <>
                    <Ionicons
                      name="bookmark"
                      size={16}
                      color="#FFFFFF"
                      style={{ marginRight: 6 }}
                    />
                    <Text style={styles.reserveButtonText}>Apartar</Text>
                  </>
                )}
              </Pressable>
            </View>
          ) : null}

          {/* Audit data */}
          <View style={styles.auditRow}>
            <Text style={[styles.auditText, { color: colors.textMuted }]}>
              Registrado el:{" "}
              {new Date(furniture.created_at).toLocaleDateString("es-MX")}
            </Text>
            <Text style={[styles.auditText, { color: colors.textMuted }]}>
              Favoritos: {furniture.favorites_count || 0}
            </Text>
          </View>
        </View>
      </ScrollView>

      {/* Full-screen viewer when the furniture photo is tapped */}
      <ImageViewerModal
        visible={showFullscreenImage}
        imageUri={imageUri}
        title={furniture.name}
        onClose={() => setShowFullscreenImage(false)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  navBarWrapper: {
    borderBottomWidth: 1,
  },
  navBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  navButton: {
    width: 38,
    height: 38,
    borderRadius: 10,
    borderWidth: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  navTitle: {
    fontSize: 16,
    fontWeight: "700",
    flex: 1,
    marginHorizontal: 12,
    textAlign: "center",
  },
  navRightActions: {
    flexDirection: "row",
    gap: 8,
  },
  scrollContent: {
    paddingBottom: 32,
  },
  scrollContentDesktop: {
    paddingHorizontal: 18,
    paddingTop: 18,
  },
  heroImageContainer: {
    width: "100%",
    height: 280,
    position: "relative",
  },
  heroImageContainerDesktop: {
    borderRadius: 16,
    overflow: "hidden",
  },
  heroImagePressable: {
    width: "100%",
    height: "100%",
    position: "relative",
  },
  heroImage: {
    width: "100%",
    height: "100%",
  },
  expandBadge: {
    position: "absolute",
    top: 14,
    right: 14,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(0, 0, 0, 0.55)",
    justifyContent: "center",
    alignItems: "center",
  },
  placeholderHero: {
    width: "100%",
    height: "100%",
    justifyContent: "center",
    alignItems: "center",
  },
  placeholderHeroText: {
    fontSize: 14,
    fontWeight: "600",
    marginTop: 8,
  },
  heroFavoriteButton: {
    position: "absolute",
    bottom: 16,
    right: 16,
    width: 46,
    height: 46,
    borderRadius: 23,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 4,
  },
  infoCard: {
    marginTop: -20,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    padding: 20,
  },
  infoCardDesktop: {
    marginTop: 16,
    borderRadius: 20,
  },
  tagsRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 12,
  },
  title: {
    fontSize: 22,
    fontWeight: "800",
    lineHeight: 28,
    marginBottom: 10,
  },
  priceRow: {
    flexDirection: "row",
    alignItems: "baseline",
    marginBottom: 16,
  },
  price: {
    fontSize: 26,
    fontWeight: "900",
  },
  currency: {
    fontSize: 14,
    fontWeight: "600",
    marginLeft: 6,
  },
  supplierBox: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 20,
  },
  supplierLabel: {
    fontSize: 11,
    fontWeight: "600",
    textTransform: "uppercase",
  },
  supplierName: {
    fontSize: 14,
    fontWeight: "700",
    marginTop: 2,
  },
  supplierContact: {
    fontSize: 12,
    marginTop: 2,
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 8,
  },
  description: {
    fontSize: 15,
    lineHeight: 22,
  },
  reserveCard: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 14,
    borderRadius: 14,
    marginBottom: 16,
  },
  stepper: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  stepperButton: {
    width: 34,
    height: 34,
    borderRadius: 8,
    borderWidth: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  stepperValue: {
    fontSize: 16,
    fontWeight: "800",
    minWidth: 24,
    textAlign: "center",
  },
  reserveButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    minWidth: 110,
    height: 40,
    paddingHorizontal: 16,
    borderRadius: 10,
  },
  reserveButtonText: {
    color: "#FFFFFF",
    fontWeight: "700",
    fontSize: 14,
  },
  auditRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#E2E8F0",
  },
  auditText: {
    fontSize: 12,
  },
});
