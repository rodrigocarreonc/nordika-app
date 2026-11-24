// Staff-only form to create or edit furniture, with Web/mobile-compatible image upload.

import { Ionicons } from "@expo/vector-icons";
import { File as FsFile } from "expo-file-system";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useColorScheme,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { FormSkeleton } from "../../../components/Skeleton";
import { Colors } from "../../../constants/theme";
import { dialog } from "../../../context/DialogContext";
import { useResponsive } from "../../../hooks/use-responsive";
import { Category, Supplier } from "../../../types";
import {
  apiCreateFurniture,
  apiGetCategories,
  apiGetFurniture,
  apiGetSuppliers,
  apiUpdateFurniture,
  resolveImageUrl,
} from "../../../utils/api";
import { safeBack } from "../../../utils/navigation";
import { getUser } from "../../../utils/tokenStorage";

export default function FurnitureFormScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const scheme = useColorScheme() ?? "light";
  const colors = Colors[scheme];
  const { isMobile, contentMaxWidth } = useResponsive("content");

  const editId = id ? Number(id) : null;
  const isEditing = !!editId;

  const [loadingInitial, setLoadingInitial] = useState(isEditing);
  const [submitting, setSubmitting] = useState(false);

  // Available categories and suppliers
  const [categories, setCategories] = useState<Category[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);

  // Form fields
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [stock, setStock] = useState("0");
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(
    null,
  );
  const [selectedSupplierId, setSelectedSupplierId] = useState<number | null>(
    null,
  );
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [imageAsset, setImageAsset] = useState<any>(null);

  // Role guard: keeps a customer from opening the form by typing the route directly on Web.
  useEffect(() => {
    getUser().then((u) => {
      if (!u?.is_staff) {
        router.replace("/(app)/(tabs)");
      }
    });
  }, [router]);

  // Loads the helper catalogs (categories/suppliers) and, when editing, preloads the furniture.
  useEffect(() => {
    Promise.all([apiGetCategories(), apiGetSuppliers()])
      .then(([categoryList, supplierList]) => {
        setCategories(categoryList);
        setSuppliers(supplierList);
        if (supplierList.length > 0) {
          setSelectedSupplierId((prev) => prev ?? supplierList[0].id);
        }
      })
      .catch(() => {});

    // When editing, load the existing furniture
    if (editId) {
      apiGetFurniture(editId)
        .then(async (m) => {
          setName(m.name);
          setDescription(m.description || "");
          setPrice(m.price.toString());
          setStock(m.stock.toString());
          if (m.category?.id) setSelectedCategoryId(m.category.id);
          if (m.supplier?.id) setSelectedSupplierId(m.supplier.id);
          if (m.image) {
            const url = await resolveImageUrl(m.image);
            setImageUri(url);
          }
        })
        .catch((err) => {
          dialog.alert({
            title: "Error",
            message: err.message || "No se pudo cargar el mueble",
          });
        })
        .finally(() => {
          setLoadingInitial(false);
        });
    }
  }, [editId]);

  const handlePickImage = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        setImageUri(asset.uri);
        setImageAsset(asset);
      }
    } catch {
      dialog.alert({
        title: "Error",
        message: "No se pudo abrir la galería de imágenes.",
      });
    }
  };

  const handleSubmit = async () => {
    const trimmedName = name.trim();
    if (!trimmedName) {
      dialog.alert({
        title: "Validación",
        message: "El nombre del mueble es obligatorio.",
      });
      return;
    }

    const numPrice = parseFloat(price);
    if (isNaN(numPrice) || numPrice <= 0) {
      dialog.alert({
        title: "Validación",
        message: "Ingresa un precio válido mayor a 0.",
      });
      return;
    }

    // parseInt accepted "2.5" as 2; only digits are allowed.
    const numStock = parseInt(stock.trim(), 10);
    if (!/^\d+$/.test(stock.trim())) {
      dialog.alert({
        title: "Validación",
        message: "El stock debe ser un número entero mayor o igual a 0.",
      });
      return;
    }

    if (!selectedSupplierId) {
      dialog.alert({
        title: "Validación",
        message: "Debes seleccionar un proveedor.",
      });
      return;
    }

    if (!isEditing && !imageAsset) {
      dialog.alert({
        title: "Validación",
        message: "La foto del mueble es obligatoria.",
      });
      return;
    }

    try {
      setSubmitting(true);

      // If a new image was picked, FormData is used
      if (imageAsset) {
        const formData = new FormData();
        formData.append("name", trimmedName);
        formData.append("description", description.trim());
        formData.append("price", numPrice.toFixed(2));
        formData.append("stock", numStock.toString());
        formData.append("supplier_id", selectedSupplierId.toString());
        if (selectedCategoryId) {
          formData.append("category_id", selectedCategoryId.toString());
        }

        // FormData only uploads Blobs: the browser's File on web, expo-file-system's File on the phone.
        // A {uri, name, type} object is sent as "[object Object]" (the global fetch in SDK 58 is expo/fetch).
        formData.append(
          "image",
          imageAsset.file ?? new FsFile(imageAsset.uri),
        );

        if (isEditing) {
          await apiUpdateFurniture(editId, formData);
        } else {
          await apiCreateFurniture(formData);
        }
      } else {
        // Send plain JSON
        const payload: Record<string, any> = {
          name: trimmedName,
          description: description.trim(),
          price: numPrice.toFixed(2),
          stock: numStock,
          supplier_id: selectedSupplierId,
          category_id: selectedCategoryId || null,
        };

        if (isEditing) {
          await apiUpdateFurniture(editId, payload);
        } else {
          await apiCreateFurniture(payload);
        }
      }

      await dialog.alert({
        title: "Operación exitosa",
        message: isEditing
          ? "Mueble actualizado con éxito."
          : "Mueble registrado exitosamente.",
      });
      safeBack(router, "/");
    } catch (err: any) {
      dialog.alert({
        title: "Error",
        message: err.message || "No se pudo guardar el mueble.",
      });
    } finally {
      setSubmitting(false);
    }
  };

  if (loadingInitial) {
    return (
      <SafeAreaView
        style={[styles.safeArea, { backgroundColor: colors.background }]}
        edges={["top", "left", "right"]}
      >
        <ScrollView showsVerticalScrollIndicator={false}>
          <FormSkeleton />
        </ScrollView>
      </SafeAreaView>
    );
  }

  // On tablet/desktop the form is centered to avoid overly wide fields.
  const desktopContainerStyle = !isMobile
    ? {
        maxWidth: contentMaxWidth,
        width: "100%" as const,
        alignSelf: "center" as const,
      }
    : undefined;

  return (
    <SafeAreaView
      style={[styles.safeArea, { backgroundColor: colors.background }]}
      edges={["top", "left", "right"]}
    >
      {/* Navigation bar with a full divider and centered content on desktop */}
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
            accessibilityLabel="Cerrar formulario"
            accessibilityHint="Cierra el formulario y regresa a la pantalla anterior"
          >
            <Ionicons name="close" size={20} color={colors.text} />
          </Pressable>
          <Text style={[styles.navTitle, { color: colors.text }]}>
            {isEditing ? "Editar Mueble" : "Nuevo Mueble"}
          </Text>
          <Pressable
            style={[
              styles.saveButton,
              {
                backgroundColor: colors.accent,
                opacity: submitting ? 0.7 : 1,
              },
            ]}
            onPress={handleSubmit}
            disabled={submitting}
            accessibilityRole="button"
            accessibilityLabel={
              isEditing ? "Guardar cambios del mueble" : "Guardar mueble"
            }
            accessibilityHint="Guarda los datos del mueble en el catálogo"
          >
            {submitting ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Text style={styles.saveButtonText}>Guardar</Text>
            )}
          </Pressable>
        </View>
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={[styles.scrollContent, desktopContainerStyle]}
          showsVerticalScrollIndicator={false}
        >
          {/* Image picker: on desktop uses contain on a neutral background to preview the whole photo */}
          <View style={styles.imageSection}>
            <Pressable
              style={[
                styles.imagePickerBox,
                !isMobile && styles.imagePickerBoxDesktop,
                { backgroundColor: colors.card, borderColor: colors.border },
              ]}
              onPress={handlePickImage}
              accessibilityRole="button"
              accessibilityLabel="Subir o cambiar foto del mueble"
              accessibilityHint="Abre la galería de imágenes para elegir una fotografía"
            >
              {imageUri ? (
                <View
                  style={[
                    styles.imagePreviewContainer,
                    !isMobile && { backgroundColor: colors.backgroundElement },
                  ]}
                >
                  <Image
                    source={{ uri: imageUri }}
                    style={styles.imagePreview}
                    contentFit={isMobile ? "cover" : "contain"}
                  />
                  <View style={styles.imageChangeOverlay}>
                    <Ionicons name="camera" size={20} color="#FFFFFF" />
                    <Text style={styles.imageChangeText}>Cambiar foto</Text>
                  </View>
                </View>
              ) : (
                <View style={styles.imagePlaceholder}>
                  <Ionicons
                    name="cloud-upload-outline"
                    size={40}
                    color={colors.accent}
                  />
                  <Text
                    style={[
                      styles.imagePlaceholderTitle,
                      { color: colors.text },
                    ]}
                  >
                    Subir foto del mueble
                  </Text>
                  <Text
                    style={[
                      styles.imagePlaceholderSubtitle,
                      { color: colors.textMuted },
                    ]}
                  >
                    PNG, JPG o WEBP
                  </Text>
                </View>
              )}
            </Pressable>
          </View>

          {/* Data form */}
          <View
            style={[
              styles.card,
              { backgroundColor: colors.card, borderColor: colors.border },
            ]}
          >
            {/* Name */}
            <View style={styles.inputGroup}>
              <Text style={[styles.label, { color: colors.text }]}>
                Nombre del mueble *
              </Text>
              <TextInput
                style={[
                  styles.input,
                  {
                    backgroundColor: colors.background,
                    borderColor: colors.border,
                    color: colors.text,
                  },
                ]}
                placeholder="Ej. Sofá Nórdico Oslo 3 Plazas"
                placeholderTextColor={colors.textMuted}
                value={name}
                onChangeText={setName}
              />
            </View>

            {/* Price & stock in a row */}
            <View style={styles.row}>
              <View style={[styles.inputGroup, { flex: 1, marginRight: 8 }]}>
                <Text style={[styles.label, { color: colors.text }]}>
                  Precio ($ MXN) *
                </Text>
                <TextInput
                  style={[
                    styles.input,
                    {
                      backgroundColor: colors.background,
                      borderColor: colors.border,
                      color: colors.text,
                    },
                  ]}
                  placeholder="Ej. 14999.00"
                  placeholderTextColor={colors.textMuted}
                  keyboardType="decimal-pad"
                  value={price}
                  onChangeText={setPrice}
                />
              </View>

              <View style={[styles.inputGroup, { flex: 1, marginLeft: 8 }]}>
                <Text style={[styles.label, { color: colors.text }]}>
                  Stock Inicial *
                </Text>
                <TextInput
                  style={[
                    styles.input,
                    {
                      backgroundColor: colors.background,
                      borderColor: colors.border,
                      color: colors.text,
                    },
                  ]}
                  placeholder="Ej. 5"
                  placeholderTextColor={colors.textMuted}
                  keyboardType="number-pad"
                  value={stock}
                  onChangeText={setStock}
                />
              </View>
            </View>

            {/* Category */}
            <View style={styles.inputGroup}>
              <Text style={[styles.label, { color: colors.text }]}>
                Categoría
              </Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.chipsScroll}
              >
                {categories.map((c) => {
                  const isSelected = selectedCategoryId === c.id;
                  return (
                    <Pressable
                      key={c.id}
                      style={[
                        styles.chip,
                        isSelected
                          ? {
                              backgroundColor: colors.primary,
                              borderColor: colors.primary,
                            }
                          : {
                              backgroundColor: colors.background,
                              borderColor: colors.border,
                            },
                      ]}
                      onPress={() =>
                        setSelectedCategoryId(isSelected ? null : c.id)
                      }
                      accessibilityRole="checkbox"
                      accessibilityState={{ checked: isSelected }}
                      accessibilityLabel={`Categoría ${c.name}`}
                    >
                      <Text
                        style={[
                          styles.chipText,
                          isSelected
                            ? { color: colors.onPrimary }
                            : { color: colors.text },
                        ]}
                      >
                        {c.name}
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
            </View>

            {/* Supplier */}
            <View style={styles.inputGroup}>
              <Text style={[styles.label, { color: colors.text }]}>
                Proveedor *
              </Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.chipsScroll}
              >
                {suppliers.map((p) => {
                  const isSelected = selectedSupplierId === p.id;
                  return (
                    <Pressable
                      key={p.id}
                      style={[
                        styles.chip,
                        isSelected
                          ? {
                              backgroundColor: colors.accent,
                              borderColor: colors.accent,
                            }
                          : {
                              backgroundColor: colors.background,
                              borderColor: colors.border,
                            },
                      ]}
                      onPress={() => setSelectedSupplierId(p.id)}
                      accessibilityRole="radio"
                      accessibilityState={{ selected: isSelected }}
                      accessibilityLabel={`Proveedor ${p.name}`}
                    >
                      <Text
                        style={[
                          styles.chipText,
                          isSelected
                            ? { color: "#FFFFFF" }
                            : { color: colors.text },
                        ]}
                      >
                        {p.name}
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
            </View>

            {/* Description */}
            <View style={styles.inputGroup}>
              <Text style={[styles.label, { color: colors.text }]}>
                Descripción detallada
              </Text>
              <TextInput
                style={[
                  styles.textArea,
                  {
                    backgroundColor: colors.background,
                    borderColor: colors.border,
                    color: colors.text,
                  },
                ]}
                placeholder="Escribe características, materiales, dimensiones..."
                placeholderTextColor={colors.textMuted}
                multiline
                numberOfLines={4}
                value={description}
                onChangeText={setDescription}
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
  },
  saveButton: {
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 8,
  },
  saveButtonText: {
    color: "#FFFFFF",
    fontWeight: "700",
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
    borderStyle: "dashed",
    overflow: "hidden",
    justifyContent: "center",
    alignItems: "center",
  },
  imagePickerBoxDesktop: {
    height: 280,
  },
  imagePreviewContainer: {
    width: "100%",
    height: "100%",
    position: "relative",
  },
  imagePreview: {
    width: "100%",
    height: "100%",
  },
  imageChangeOverlay: {
    position: "absolute",
    bottom: 12,
    right: 12,
    backgroundColor: "rgba(0,0,0,0.6)",
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 6,
  },
  imageChangeText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "600",
  },
  imagePlaceholder: {
    alignItems: "center",
    padding: 16,
  },
  imagePlaceholderTitle: {
    fontSize: 15,
    fontWeight: "700",
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
    flexDirection: "row",
  },
  label: {
    fontSize: 13,
    fontWeight: "600",
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
    fontWeight: "600",
  },
});
