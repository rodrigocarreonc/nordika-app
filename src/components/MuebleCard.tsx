// Tarjeta de producto del catálogo con foto, semáforo de stock, precio y toggle optimista de favorito.

import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import React, { useEffect, useState } from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  useColorScheme,
} from "react-native";
import { Colors } from "../constants/theme";
import { useResponsive } from "../hooks/use-responsive";
import { Mueble } from "../types";
import { resolveImageUrl } from "../utils/api";
import { Badge } from "./Badge";

interface MuebleCardProps {
  mueble: Mueble;
  onPress: () => void;
  onToggleFavorito?: (mueble: Mueble) => void;
  isFavorito?: boolean;
  isGridItem?: boolean;
}

export const MuebleCard: React.FC<MuebleCardProps> = ({
  mueble,
  onPress,
  onToggleFavorito,
  isFavorito = false,
  isGridItem = false,
}) => {
  const scheme = useColorScheme() ?? "light";
  const colors = Colors[scheme];
  const { isMobile } = useResponsive("catalog");
  const [imageUri, setImageUri] = useState<string | null>(null);
  const computedFav = isFavorito || !!mueble.is_favorito;
  // Estado optimista ligado al id del mueble para dar respuesta instantánea al tocar el corazon
  // sin arrastrar el estado si FlatList recicla la tarjeta para otro producto.
  const [localFav, setLocalFav] = useState<{ id: number; val: boolean } | null>(
    null,
  );
  const favState =
    localFav && localFav.id === mueble.id ? localFav.val : computedFav;

  useEffect(() => {
    let isMounted = true;
    resolveImageUrl(mueble.imagen).then((url) => {
      if (isMounted) setImageUri(url);
    });
    return () => {
      isMounted = false;
    };
  }, [mueble.imagen]);

  const handleHeartPress = (e: any) => {
    e.stopPropagation?.();
    setLocalFav({ id: mueble.id, val: !favState });
    if (onToggleFavorito) {
      onToggleFavorito(mueble);
    }
  };

  const getStockBadge = (stock: number) => {
    if (stock <= 0) return <Badge label="Agotado" variant="danger" />;
    if (stock <= 3)
      return <Badge label={`Últimas ${stock} uds`} variant="warning" />;
    return <Badge label="En stock" variant="success" />;
  };

  const formatPrice = (price: string | number) => {
    const num = typeof price === "number" ? price : parseFloat(price);
    return isNaN(num)
      ? "$0.00"
      : `$${num.toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  return (
    <View
      style={[
        styles.card,
        // En cuadrícula multi-columna ocupa todo el ancho de su celda para alinear filas.
        isGridItem && styles.cardGrid,
        {
          backgroundColor: colors.card,
          borderColor: colors.border,
        },
      ]}
    >
      <Pressable
        style={({ pressed }) => [
          isGridItem && styles.cardPressableGrid,
          {
            opacity: pressed ? 0.95 : 1,
            transform: [{ scale: pressed ? 0.99 : 1 }],
          },
        ]}
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={`${mueble.nombre}, precio ${formatPrice(mueble.precio)}`}
        accessibilityHint="Toca para abrir la ficha detallada"
      >
        {/* En tablet/escritorio usamos proporción 4:3 con contain para evitar recortes agresivos de la foto. */}
        <View
          style={[
            isMobile ? styles.imageContainer : styles.imageContainerDesktop,
            !isMobile && { backgroundColor: colors.backgroundElement },
          ]}
        >
          {imageUri ? (
            <Image
              source={{ uri: imageUri }}
              style={styles.image}
              contentFit={isMobile ? "cover" : "contain"}
              transition={300}
            />
          ) : (
            <View
              style={[
                styles.placeholderImage,
                { backgroundColor: colors.backgroundElement },
              ]}
            >
              <Ionicons
                name="image-outline"
                size={36}
                color={colors.textMuted}
              />
              <Text
                style={[styles.placeholderText, { color: colors.textMuted }]}
              >
                Nordika Design
              </Text>
            </View>
          )}

          {/* Badge de Categoría */}
          {mueble.categoria?.nombre ? (
            <View style={styles.categoryBadgeContainer}>
              <Badge
                label={mueble.categoria.nombre}
                variant="info"
                size="small"
              />
            </View>
          ) : null}
        </View>

        <View style={styles.content}>
          <View style={styles.stockRow}>
            {getStockBadge(mueble.stock)}
            {mueble.proveedor?.nombre ? (
              <Text
                style={[styles.proveedorText, { color: colors.textMuted }]}
                numberOfLines={1}
              >
                {mueble.proveedor.nombre}
              </Text>
            ) : null}
          </View>

          <Text
            style={[styles.title, { color: colors.text }]}
            numberOfLines={2}
          >
            {mueble.nombre}
          </Text>

          <View style={styles.priceRow}>
            <Text style={[styles.price, { color: colors.accent }]}>
              {formatPrice(mueble.precio)}
            </Text>
            <Text style={[styles.currency, { color: colors.textMuted }]}>
              MXN
            </Text>
          </View>
        </View>
      </Pressable>

      {/* Botón de Favorito Flotante (hermano del botón de tarjeta para evitar <button> anidado en Web) */}
      <Pressable
        style={[styles.favoriteButton, { backgroundColor: colors.card }]}
        onPress={handleHeartPress}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel={
          favState ? "Quitar de favoritos" : "Agregar a favoritos"
        }
        accessibilityHint="Guarda o quita este mueble de tu lista de favoritos"
      >
        <Ionicons
          name={favState ? "heart" : "heart-outline"}
          size={20}
          color={favState ? colors.danger : colors.icon}
        />
      </Pressable>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    borderRadius: 14,
    borderWidth: 1,
    overflow: "hidden",
    marginBottom: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  cardGrid: {
    flex: 1,
  },
  cardPressableGrid: {
    flex: 1,
  },
  imageContainer: {
    width: "100%",
    height: 180,
    position: "relative",
  },
  imageContainerDesktop: {
    width: "100%",
    aspectRatio: 4 / 3,
    position: "relative",
  },
  image: {
    width: "100%",
    height: "100%",
  },
  placeholderImage: {
    width: "100%",
    height: "100%",
    justifyContent: "center",
    alignItems: "center",
  },
  placeholderText: {
    fontSize: 12,
    fontWeight: "600",
    marginTop: 4,
  },
  favoriteButton: {
    position: "absolute",
    top: 10,
    right: 10,
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 3,
    elevation: 3,
  },
  categoryBadgeContainer: {
    position: "absolute",
    bottom: 10,
    left: 10,
  },
  content: {
    padding: 14,
  },
  stockRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  proveedorText: {
    fontSize: 11,
    fontWeight: "500",
    flex: 1,
    textAlign: "right",
    marginLeft: 8,
  },
  title: {
    fontSize: 16,
    fontWeight: "700",
    lineHeight: 22,
    marginBottom: 8,
  },
  priceRow: {
    flexDirection: "row",
    alignItems: "baseline",
  },
  price: {
    fontSize: 18,
    fontWeight: "800",
  },
  currency: {
    fontSize: 12,
    fontWeight: "600",
    marginLeft: 4,
  },
});
