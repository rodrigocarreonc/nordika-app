import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useColorScheme,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LoadingView } from '../../../components/LoadingView';
import { Colors } from '../../../constants/theme';
import { Categoria, Proveedor } from '../../../types';
import {
  apiCreateMueble,
  apiGetCategorias,
  apiGetMueble,
  apiGetProveedores,
  apiUpdateMueble,
  resolveImageUrl,
} from '../../../utils/api';

export default function MuebleFormScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const scheme = useColorScheme() ?? 'light';
  const colors = Colors[scheme];

  const editId = id ? Number(id) : null;
  const isEditing = !!editId;

  const [loadingInitial, setLoadingInitial] = useState(isEditing);
  const [submitting, setSubmitting] = useState(false);

  // Categorías y Proveedores disponibles
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [proveedores, setProveedores] = useState<Proveedor[]>([]);

  // Campos de formulario
  const [nombre, setNombre] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [precio, setPrecio] = useState('');
  const [stock, setStock] = useState('0');
  const [selectedCategoriaId, setSelectedCategoriaId] = useState<number | null>(null);
  const [selectedProveedorId, setSelectedProveedorId] = useState<number | null>(null);
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [imageAsset, setImageAsset] = useState<any>(null);

  useEffect(() => {
    // Cargar listas auxiliares
    Promise.all([apiGetCategorias(), apiGetProveedores()])
      .then(([cats, provs]) => {
        setCategorias(cats);
        setProveedores(provs);
        if (provs.length > 0 && !selectedProveedorId) {
          setSelectedProveedorId(provs[0].id);
        }
      })
      .catch(() => {});

    // Si es edición, cargar mueble existente
    if (editId) {
      apiGetMueble(editId)
        .then(async (m) => {
          setNombre(m.nombre);
          setDescripcion(m.descripcion || '');
          setPrecio(m.precio.toString());
          setStock(m.stock.toString());
          if (m.categoria?.id) setSelectedCategoriaId(m.categoria.id);
          if (m.proveedor?.id) setSelectedProveedorId(m.proveedor.id);
          if (m.imagen) {
            const url = await resolveImageUrl(m.imagen);
            setImageUri(url);
          }
        })
        .catch((err) => {
          Alert.alert('Error', err.message || 'No se pudo cargar el mueble');
        })
        .finally(() => {
          setLoadingInitial(false);
        });
    }
  }, [editId]);

  const handlePickImage = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        setImageUri(asset.uri);
        setImageAsset(asset);
      }
    } catch (err: any) {
      Alert.alert('Error', 'No se pudo abrir la galería de imágenes.');
    }
  };

  const handleSubmit = async () => {
    const trimmedNombre = nombre.trim();
    if (!trimmedNombre) {
      Alert.alert('Validación', 'El nombre del mueble es obligatorio.');
      return;
    }

    const numPrecio = parseFloat(precio);
    if (isNaN(numPrecio) || numPrecio <= 0) {
      Alert.alert('Validación', 'Ingresa un precio válido mayor a 0.');
      return;
    }

    const numStock = parseInt(stock, 10);
    if (isNaN(numStock) || numStock < 0) {
      Alert.alert('Validación', 'El stock debe ser un número entero mayor o igual a 0.');
      return;
    }

    if (!selectedProveedorId) {
      Alert.alert('Validación', 'Debes seleccionar un proveedor.');
      return;
    }

    try {
      setSubmitting(true);

      // Si hay una nueva imagen seleccionada, usamos FormData
      if (imageAsset) {
        const formData = new FormData();
        formData.append('nombre', trimmedNombre);
        formData.append('descripcion', descripcion.trim());
        formData.append('precio', numPrecio.toFixed(2));
        formData.append('stock', numStock.toString());
        formData.append('proveedor_id', selectedProveedorId.toString());
        if (selectedCategoriaId) {
          formData.append('categoria_id', selectedCategoriaId.toString());
        }

        const filename = imageAsset.uri.split('/').pop() || 'photo.jpg';
        const match = /\.(\w+)$/.exec(filename);
        const type = match ? `image/${match[1]}` : `image/jpeg`;

        formData.append('imagen', {
          uri: imageAsset.uri,
          name: filename,
          type,
        } as any);

        if (isEditing) {
          await apiUpdateMueble(editId, formData);
        } else {
          await apiCreateMueble(formData);
        }
      } else {
        // Enviar JSON convencional
        const payload: Record<string, any> = {
          nombre: trimmedNombre,
          descripcion: descripcion.trim(),
          precio: numPrecio.toFixed(2),
          stock: numStock,
          proveedor_id: selectedProveedorId,
          categoria_id: selectedCategoriaId || null,
        };

        if (isEditing) {
          await apiUpdateMueble(editId, payload);
        } else {
          await apiCreateMueble(payload);
        }
      }

      Alert.alert(
        'Operación exitosa',
        isEditing ? 'Mueble actualizado con éxito.' : 'Mueble registrado exitosamente.',
        [{ text: 'Aceptar', onPress: () => router.replace('/(app)') }]
      );
    } catch (err: any) {
      Alert.alert('Error', err.message || 'No se pudo guardar el mueble.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loadingInitial) {
    return <LoadingView message="Cargando datos del mueble..." />;
  }

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]} edges={['top', 'left', 'right']}>
      {/* Barra de navegación */}
      <View style={[styles.navBar, { borderBottomColor: colors.border }]}>
        <Pressable
          style={[styles.navButton, { backgroundColor: colors.card, borderColor: colors.border }]}
          onPress={() => router.back()}
        >
          <Ionicons name="close" size={20} color={colors.text} />
        </Pressable>
        <Text style={[styles.navTitle, { color: colors.text }]}>
          {isEditing ? 'Editar Mueble' : 'Nuevo Mueble'}
        </Text>
        <Pressable
          style={[styles.saveButton, { backgroundColor: colors.accent, opacity: submitting ? 0.7 : 1 }]}
          onPress={handleSubmit}
          disabled={submitting}
        >
          {submitting ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <Text style={styles.saveButtonText}>Guardar</Text>
          )}
        </Pressable>
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          {/* Selector de Imagen */}
          <View style={styles.imageSection}>
            <Pressable
              style={[
                styles.imagePickerBox,
                { backgroundColor: colors.card, borderColor: colors.border },
              ]}
              onPress={handlePickImage}
            >
              {imageUri ? (
                <View style={styles.imagePreviewContainer}>
                  <Image source={{ uri: imageUri }} style={styles.imagePreview} contentFit="cover" />
                  <View style={styles.imageChangeOverlay}>
                    <Ionicons name="camera" size={20} color="#FFFFFF" />
                    <Text style={styles.imageChangeText}>Cambiar foto</Text>
                  </View>
                </View>
              ) : (
                <View style={styles.imagePlaceholder}>
                  <Ionicons name="cloud-upload-outline" size={40} color={colors.accent} />
                  <Text style={[styles.imagePlaceholderTitle, { color: colors.text }]}>
                    Subir foto del mueble
                  </Text>
                  <Text style={[styles.imagePlaceholderSubtitle, { color: colors.textMuted }]}>
                    PNG, JPG o WEBP
                  </Text>
                </View>
              )}
            </Pressable>
          </View>

          {/* Formulario de Datos */}
          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            {/* Nombre */}
            <View style={styles.inputGroup}>
              <Text style={[styles.label, { color: colors.text }]}>Nombre del mueble *</Text>
              <TextInput
                style={[styles.input, { backgroundColor: colors.background, borderColor: colors.border, color: colors.text }]}
                placeholder="Ej. Sofá Nórdico Oslo 3 Plazas"
                placeholderTextColor={colors.textMuted}
                value={nombre}
                onChangeText={setNombre}
              />
            </View>

            {/* Precio & Stock en fila */}
            <View style={styles.row}>
              <View style={[styles.inputGroup, { flex: 1, marginRight: 8 }]}>
                <Text style={[styles.label, { color: colors.text }]}>Precio ($ MXN) *</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: colors.background, borderColor: colors.border, color: colors.text }]}
                  placeholder="Ej. 14999.00"
                  placeholderTextColor={colors.textMuted}
                  keyboardType="decimal-pad"
                  value={precio}
                  onChangeText={setPrecio}
                />
              </View>

              <View style={[styles.inputGroup, { flex: 1, marginLeft: 8 }]}>
                <Text style={[styles.label, { color: colors.text }]}>Stock Inicial *</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: colors.background, borderColor: colors.border, color: colors.text }]}
                  placeholder="Ej. 5"
                  placeholderTextColor={colors.textMuted}
                  keyboardType="number-pad"
                  value={stock}
                  onChangeText={setStock}
                />
              </View>
            </View>

            {/* Categoría */}
            <View style={styles.inputGroup}>
              <Text style={[styles.label, { color: colors.text }]}>Categoría</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsScroll}>
                {categorias.map((c) => {
                  const isSelected = selectedCategoriaId === c.id;
                  return (
                    <Pressable
                      key={c.id}
                      style={[
                        styles.chip,
                        isSelected
                          ? { backgroundColor: colors.primary, borderColor: colors.primary }
                          : { backgroundColor: colors.background, borderColor: colors.border },
                      ]}
                      onPress={() => setSelectedCategoriaId(isSelected ? null : c.id)}
                    >
                      <Text
                        style={[
                          styles.chipText,
                          isSelected ? { color: '#FFFFFF' } : { color: colors.text },
                        ]}
                      >
                        {c.nombre}
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
            </View>

            {/* Proveedor */}
            <View style={styles.inputGroup}>
              <Text style={[styles.label, { color: colors.text }]}>Proveedor *</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsScroll}>
                {proveedores.map((p) => {
                  const isSelected = selectedProveedorId === p.id;
                  return (
                    <Pressable
                      key={p.id}
                      style={[
                        styles.chip,
                        isSelected
                          ? { backgroundColor: colors.accent, borderColor: colors.accent }
                          : { backgroundColor: colors.background, borderColor: colors.border },
                      ]}
                      onPress={() => setSelectedProveedorId(p.id)}
                    >
                      <Text
                        style={[
                          styles.chipText,
                          isSelected ? { color: '#FFFFFF' } : { color: colors.text },
                        ]}
                      >
                        {p.nombre}
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
            </View>

            {/* Descripción */}
            <View style={styles.inputGroup}>
              <Text style={[styles.label, { color: colors.text }]}>Descripción detallada</Text>
              <TextInput
                style={[
                  styles.textArea,
                  { backgroundColor: colors.background, borderColor: colors.border, color: colors.text },
                ]}
                placeholder="Escribe características, materiales, dimensiones..."
                placeholderTextColor={colors.textMuted}
                multiline
                numberOfLines={4}
                value={descripcion}
                onChangeText={setDescripcion}
                textAlignVertical="top"
              />
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
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
  },
  saveButton: {
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 8,
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 14,
  },
  scrollContent: {
    padding: 18,
    paddingBottom: 40,
  },
  imageSection: {
    marginBottom: 16,
  },
  imagePickerBox: {
    height: 200,
    borderRadius: 14,
    borderWidth: 2,
    borderStyle: 'dashed',
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
  },
  imagePreviewContainer: {
    width: '100%',
    height: '100%',
    position: 'relative',
  },
  imagePreview: {
    width: '100%',
    height: '100%',
  },
  imageChangeOverlay: {
    position: 'absolute',
    bottom: 12,
    right: 12,
    backgroundColor: 'rgba(0,0,0,0.6)',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 6,
  },
  imageChangeText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  imagePlaceholder: {
    alignItems: 'center',
    padding: 16,
  },
  imagePlaceholderTitle: {
    fontSize: 15,
    fontWeight: '700',
    marginTop: 8,
  },
  imagePlaceholderSubtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  card: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 18,
  },
  inputGroup: {
    marginBottom: 16,
  },
  row: {
    flexDirection: 'row',
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 6,
  },
  input: {
    height: 46,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    fontSize: 14,
  },
  textArea: {
    height: 100,
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    fontSize: 14,
  },
  chipsScroll: {
    gap: 8,
    paddingVertical: 4,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
  },
  chipText: {
    fontSize: 13,
    fontWeight: '600',
  },
});
