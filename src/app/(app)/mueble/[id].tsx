import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useColorScheme,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Badge } from '../../../components/Badge';
import { ErrorView } from '../../../components/ErrorView';
import { LoadingView } from '../../../components/LoadingView';
import { Colors } from '../../../constants/theme';
import { Mueble } from '../../../types';
import {
  apiCrearApartado,
  apiDeleteMueble,
  apiGetMueble,
  apiToggleFavorito,
  resolveImageUrl,
} from '../../../utils/api';

export default function MuebleDetailsScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const scheme = useColorScheme() ?? 'light';
  const colors = Colors[scheme];

  const muebleId = Number(id);

  const [mueble, setMueble] = useState<Mueble | null>(null);
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [favLoading, setFavLoading] = useState(false);
  const [cantidadApartar, setCantidadApartar] = useState(1);
  const [apartando, setApartando] = useState(false);

  const fetchDetails = async () => {
    if (!muebleId) return;
    try {
      setLoading(true);
      setError(null);
      const data = await apiGetMueble(muebleId);
      setMueble(data);
      setImageUri(await resolveImageUrl(data.imagen));
    } catch (err: any) {
      setError(err.message || 'Error al obtener detalles del mueble.');
    } finally {
      setLoading(false);
    }
  };

  // Recarga al volver a la pantalla (p. ej. después de editar el mueble).
  useFocusEffect(
    useCallback(() => {
      fetchDetails();
    }, [muebleId])
  );

  const handleToggleFav = async () => {
    if (!mueble) return;
    try {
      setFavLoading(true);
      const res = await apiToggleFavorito(mueble.id);
      setMueble({
        ...mueble,
        is_favorito: res.is_favorito,
        favoritos_count: res.total_favoritos,
      });
    } catch (err: any) {
      Alert.alert('Error', err.message || 'No se pudo actualizar favoritos.');
    } finally {
      setFavLoading(false);
    }
  };

  const handleDelete = () => {
    if (!mueble) return;
    Alert.alert(
      'Eliminar Mueble',
      `¿Estás seguro de que deseas eliminar "${mueble.nombre}"? Esta acción no se puede deshacer.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            try {
              await apiDeleteMueble(mueble.id);
              Alert.alert('Éxito', 'El mueble ha sido eliminado.', [
                { text: 'OK', onPress: () => router.back() },
              ]);
            } catch (err: any) {
              Alert.alert('Error al eliminar', err.message || 'No se pudo eliminar el mueble.');
            }
          },
        },
      ]
    );
  };

  const handleApartar = async () => {
    if (!mueble) return;
    try {
      setApartando(true);
      const apartado = await apiCrearApartado(mueble.id, cantidadApartar);
      setMueble({ ...mueble, stock: apartado.mueble.stock });
      setCantidadApartar(1);
      const vence = new Date(apartado.expira_en).toLocaleString('es-MX', { dateStyle: 'medium', timeStyle: 'short' });
      Alert.alert(
        'Mueble apartado',
        `Tu apartado ${apartado.codigo} quedó pendiente de revisión.

Tienes 5 días para concretarlo: vence el ${vence}. Si no se concreta antes, se cancelará automáticamente.`,
        [
          { text: 'Ver mis apartados', onPress: () => router.navigate('/(app)/(tabs)/apartados') },
          { text: 'OK' },
        ]
      );
    } catch (err: any) {
      Alert.alert('No se pudo apartar', err.message || 'Intenta de nuevo.');
    } finally {
      setApartando(false);
    }
  };

  const formatPrice = (price: string | number) => {
    const num = typeof price === 'number' ? price : parseFloat(price);
    return isNaN(num) ? '$0.00' : `$${num.toLocaleString('es-MX', { minimumFractionDigits: 2 })}`;
  };

  // Solo pantalla de carga completa la primera vez; al recargar se mantiene el contenido visible.
  if (loading && !mueble) {
    return <LoadingView message="Cargando detalles del mueble..." />;
  }

  if (error || !mueble) {
    return <ErrorView message={error || 'Mueble no encontrado'} onRetry={fetchDetails} />;
  }

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]} edges={['top', 'left', 'right']}>
      {/* Barra superior de navegación */}
      <View style={[styles.navBar, { borderBottomColor: colors.border }]}>
        <Pressable
          style={[styles.navButton, { backgroundColor: colors.card, borderColor: colors.border }]}
          onPress={() => router.back()}
        >
          <Ionicons name="arrow-back" size={20} color={colors.text} />
        </Pressable>

        <Text style={[styles.navTitle, { color: colors.text }]} numberOfLines={1}>
          Detalle de Producto
        </Text>

        <View style={styles.navRightActions}>
          {/* Botón Editar (CRUD) */}
          <Pressable
            style={[styles.navButton, { backgroundColor: colors.card, borderColor: colors.border }]}
            onPress={() => router.push(`/(app)/mueble/form?id=${mueble.id}`)}
          >
            <Ionicons name="create-outline" size={19} color={colors.text} />
          </Pressable>

          {/* Botón Eliminar (CRUD) */}
          <Pressable
            style={[styles.navButton, { backgroundColor: `${colors.danger}15`, borderColor: `${colors.danger}30` }]}
            onPress={handleDelete}
          >
            <Ionicons name="trash-outline" size={19} color={colors.danger} />
          </Pressable>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Imagen Principal Hero */}
        <View style={styles.heroImageContainer}>
          {imageUri ? (
            <Image source={{ uri: imageUri }} style={styles.heroImage} contentFit="cover" transition={300} />
          ) : (
            <View style={[styles.placeholderHero, { backgroundColor: colors.backgroundElement }]}>
              <Ionicons name="image-outline" size={60} color={colors.textMuted} />
              <Text style={[styles.placeholderHeroText, { color: colors.textMuted }]}>Nordika Mobiliario</Text>
            </View>
          )}

          {/* Botón de Favorito Flotante */}
          <Pressable
            style={[styles.heroFavoriteButton, { backgroundColor: colors.card }]}
            onPress={handleToggleFav}
            disabled={favLoading}
          >
            {favLoading ? (
              <ActivityIndicator size="small" color={colors.accent} />
            ) : (
              <Ionicons
                name={mueble.is_favorito ? 'heart' : 'heart-outline'}
                size={24}
                color={mueble.is_favorito ? colors.danger : colors.icon}
              />
            )}
          </Pressable>
        </View>

        {/* Información del Producto */}
        <View style={[styles.infoCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          {/* Categoría & Proveedor */}
          <View style={styles.tagsRow}>
            {mueble.categoria?.nombre ? (
              <Badge label={mueble.categoria.nombre} variant="info" size="medium" />
            ) : null}
            {mueble.stock > 3 ? (
              <Badge label={`En stock (${mueble.stock})`} variant="success" size="medium" />
            ) : mueble.stock > 0 ? (
              <Badge label={`Últimas ${mueble.stock} unidades`} variant="warning" size="medium" />
            ) : (
              <Badge label="Agotado" variant="danger" size="medium" />
            )}
          </View>

          {/* Título */}
          <Text style={[styles.title, { color: colors.text }]}>{mueble.nombre}</Text>

          {/* Precio */}
          <View style={styles.priceRow}>
            <Text style={[styles.price, { color: colors.accent }]}>
              {formatPrice(mueble.precio)}
            </Text>
            <Text style={[styles.currency, { color: colors.textMuted }]}>MXN</Text>
          </View>

          {/* Proveedor */}
          {mueble.proveedor?.nombre ? (
            <View style={[styles.supplierBox, { backgroundColor: colors.background, borderColor: colors.border }]}>
              <Ionicons name="business-outline" size={20} color={colors.textMuted} style={{ marginRight: 10 }} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.supplierLabel, { color: colors.textMuted }]}>Proveedor asociado</Text>
                <Text style={[styles.supplierName, { color: colors.text }]}>{mueble.proveedor.nombre}</Text>
                {mueble.proveedor.contacto ? (
                  <Text style={[styles.supplierContact, { color: colors.textMuted }]}>
                    Contacto: {mueble.proveedor.contacto} ({mueble.proveedor.telefono || mueble.proveedor.email})
                  </Text>
                ) : null}
              </View>
            </View>
          ) : null}

          {/* Descripción */}
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Descripción del Producto</Text>
            <Text style={[styles.description, { color: colors.textMuted }]}>
              {mueble.descripcion || 'Este artículo cuenta con los más altos estándares de carpintería y diseño nórdico.'}
            </Text>
          </View>

          {/* Apartar piezas */}
          {mueble.stock > 0 ? (
            <View style={[styles.apartarCard, { backgroundColor: colors.backgroundElement }]}>
              <View style={styles.stepper}>
                <Pressable
                  style={[styles.stepperButton, { backgroundColor: colors.card, borderColor: colors.border }]}
                  onPress={() => setCantidadApartar((c) => Math.max(1, c - 1))}
                  disabled={cantidadApartar <= 1}
                  accessibilityLabel="Quitar una pieza"
                >
                  <Ionicons name="remove" size={18} color={colors.text} />
                </Pressable>
                <Text style={[styles.stepperValue, { color: colors.text }]}>{cantidadApartar}</Text>
                <Pressable
                  style={[styles.stepperButton, { backgroundColor: colors.card, borderColor: colors.border }]}
                  onPress={() => setCantidadApartar((c) => Math.min(mueble.stock, c + 1))}
                  disabled={cantidadApartar >= mueble.stock}
                  accessibilityLabel="Agregar una pieza"
                >
                  <Ionicons name="add" size={18} color={colors.text} />
                </Pressable>
              </View>
              <Pressable
                style={[styles.apartarButton, { backgroundColor: colors.accent }]}
                onPress={handleApartar}
                disabled={apartando}
              >
                {apartando ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <>
                    <Ionicons name="bookmark" size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
                    <Text style={styles.apartarButtonText}>Apartar</Text>
                  </>
                )}
              </Pressable>
            </View>
          ) : null}

          {/* Datos de auditoría */}
          <View style={styles.auditRow}>
            <Text style={[styles.auditText, { color: colors.textMuted }]}>
              Registrado el: {new Date(mueble.creado_en).toLocaleDateString('es-MX')}
            </Text>
            <Text style={[styles.auditText, { color: colors.textMuted }]}>
              Favoritos: {mueble.favoritos_count || 0}
            </Text>
          </View>
        </View>
      </ScrollView>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  navBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  navButton: {
    width: 38,
    height: 38,
    borderRadius: 10,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  navTitle: {
    fontSize: 16,
    fontWeight: '700',
    flex: 1,
    marginHorizontal: 12,
    textAlign: 'center',
  },
  navRightActions: {
    flexDirection: 'row',
    gap: 8,
  },
  scrollContent: {
    paddingBottom: 32,
  },
  heroImageContainer: {
    width: '100%',
    height: 280,
    position: 'relative',
  },
  heroImage: {
    width: '100%',
    height: '100%',
  },
  placeholderHero: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeholderHeroText: {
    fontSize: 14,
    fontWeight: '600',
    marginTop: 8,
  },
  heroFavoriteButton: {
    position: 'absolute',
    bottom: 16,
    right: 16,
    width: 46,
    height: 46,
    borderRadius: 23,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
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
  tagsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    lineHeight: 28,
    marginBottom: 10,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: 16,
  },
  price: {
    fontSize: 26,
    fontWeight: '900',
  },
  currency: {
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 6,
  },
  supplierBox: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 20,
  },
  supplierLabel: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  supplierName: {
    fontSize: 14,
    fontWeight: '700',
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
    fontWeight: '700',
    marginBottom: 8,
  },
  description: {
    fontSize: 15,
    lineHeight: 22,
  },
  apartarCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 14,
    borderRadius: 14,
    marginBottom: 16,
  },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  stepperButton: {
    width: 34,
    height: 34,
    borderRadius: 8,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepperValue: {
    fontSize: 16,
    fontWeight: '800',
    minWidth: 24,
    textAlign: 'center',
  },
  apartarButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 110,
    height: 40,
    paddingHorizontal: 16,
    borderRadius: 10,
  },
  apartarButtonText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 14,
  },
  auditRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
  },
  auditText: {
    fontSize: 12,
  },
});
