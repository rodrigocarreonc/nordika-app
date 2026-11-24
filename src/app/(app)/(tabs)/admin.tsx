// Staff-only panel to manage furniture, category and supplier CRUD from a single view.

import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useFocusEffect, useRouter } from "expo-router";
import React, { useCallback, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useColorScheme,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Badge } from "../../../components/Badge";
import { EmptyView } from "../../../components/EmptyView";
import { ErrorView } from "../../../components/ErrorView";
import { Pagination } from "../../../components/Pagination";
import { AdminListSkeleton } from "../../../components/Skeleton";
import { Colors } from "../../../constants/theme";
import { dialog } from "../../../context/DialogContext";
import { useResponsive } from "../../../hooks/use-responsive";
import { Category, Furniture, Supplier } from "../../../types";
import {
  apiCreateCategory,
  apiCreateSupplier,
  apiDeleteCategory,
  apiDeleteFurniture,
  apiDeleteSupplier,
  apiGetCategories,
  apiGetFurnitureList,
  apiGetSuppliers,
  apiUpdateCategory,
  apiUpdateSupplier,
  resolveImageUrl,
} from "../../../utils/api";
import { getStoredPageSize } from "../../../utils/settingsStorage";
import { getUser } from "../../../utils/tokenStorage";

type AdminModule = "furniture" | "categories" | "suppliers";

export default function AdminScreen() {
  const router = useRouter();
  const scheme = useColorScheme() ?? "light";
  const colors = Colors[scheme];
  const { isMobile, contentMaxWidth } = useResponsive("content");

  // On tablet/desktop it limits the width of the header, controls and lists; mobile keeps the original layout.
  const desktopContainerStyle = !isMobile
    ? {
        maxWidth: contentMaxWidth,
        width: "100%" as const,
        alignSelf: "center" as const,
      }
    : undefined;

  // ==========================================
  // AUTH STATE / STAFF GUARD
  // ==========================================
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [isStaff, setIsStaff] = useState(false);

  // Selected module (3 main buttons)
  const [selectedModule, setSelectedModule] = useState<AdminModule>("furniture");

  // ==========================================
  // FURNITURE MODULE STATE
  // ==========================================
  const [furnitureList, setFurnitureList] = useState<Furniture[]>([]);
  const [loadingFurniture, setLoadingFurniture] = useState(false);
  const [refreshingFurniture, setRefreshingFurniture] = useState(false);
  const [furnitureSearch, setFurnitureSearch] = useState("");
  const [furniturePage, setFurniturePage] = useState(1);
  const [furnitureTotalPages, setFurnitureTotalPages] = useState(1);
  const [furnitureTotalCount, setFurnitureTotalCount] = useState(0);
  const [furnitureImages, setFurnitureImages] = useState<
    Record<number, string | null>
  >({});

  // ==========================================
  // CATEGORIES MODULE STATE
  // ==========================================
  const [categories, setCategories] = useState<Category[]>([]);
  const [loadingCategories, setLoadingCategories] = useState(false);
  const [refreshingCategories, setRefreshingCategories] = useState(false);

  // Category modal
  const [catModalVisible, setCatModalVisible] = useState(false);
  const [catModalMode, setCatModalMode] = useState<"create" | "edit">("create");
  const [editingCatId, setEditingCatId] = useState<number | null>(null);
  const [catName, setCatName] = useState("");
  const [catDescription, setCatDescription] = useState("");
  const [submittingCat, setSubmittingCat] = useState(false);
  const [catFormError, setCatFormError] = useState<string | null>(null);

  // ==========================================
  // SUPPLIERS MODULE STATE
  // ==========================================
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loadingSuppliers, setLoadingSuppliers] = useState(false);
  const [refreshingSuppliers, setRefreshingSuppliers] = useState(false);

  // Supplier modal
  const [supplierModalVisible, setSupplierModalVisible] = useState(false);
  const [supplierModalMode, setSupplierModalMode] = useState<"create" | "edit">(
    "create",
  );
  const [editingSupplierId, setEditingSupplierId] = useState<number | null>(null);
  const [supplierName, setSupplierName] = useState("");
  const [supplierContactName, setSupplierContactName] = useState("");
  const [supplierPhone, setSupplierPhone] = useState("");
  const [supplierEmail, setSupplierEmail] = useState("");
  const [submittingSupplier, setSubmittingSupplier] = useState(false);
  const [supplierFormError, setSupplierFormError] = useState<string | null>(null);

  // Generic error per tab
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // ==========================================
  // STAFF ACCESS CHECK
  // ==========================================
  // Blocks direct URL access on Web even though the tab is hidden from customers.
  const verifyStaffAccess = useCallback(async () => {
    try {
      const user = await getUser();
      if (!user?.is_staff) {
        router.replace("/(app)/(tabs)");
        return false;
      }
      setIsStaff(true);
      return true;
    } catch {
      router.replace("/(app)/(tabs)");
      return false;
    } finally {
      setCheckingAuth(false);
    }
  }, [router]);

  // ==========================================
  // DATA LOADING: FURNITURE
  // ==========================================
  const fetchFurniture = useCallback(
    async (pageToLoad = furniturePage, isRefresh = false) => {
      try {
        if (!isRefresh) setLoadingFurniture(true);
        setErrorMsg(null);
        const storedSize = await getStoredPageSize();

        const data = await apiGetFurnitureList({
          page: pageToLoad,
          page_size: storedSize,
          search: furnitureSearch.trim() || undefined,
        });

        setFurnitureList(data.results || []);
        setFurnitureTotalCount(data.count || 0);
        setFurnitureTotalPages(data.total_pages || 1);
        setFurniturePage(data.current_page || pageToLoad);

        // Resolve image URLs for the thumbnails
        const urlMap: Record<number, string | null> = {};
        await Promise.all(
          (data.results || []).map(async (m) => {
            if (m.image) {
              urlMap[m.id] = await resolveImageUrl(m.image);
            } else {
              urlMap[m.id] = null;
            }
          }),
        );
        setFurnitureImages(urlMap);
      } catch (err: any) {
        setErrorMsg(err.message || "Error al obtener los muebles.");
      } finally {
        setLoadingFurniture(false);
        setRefreshingFurniture(false);
      }
    },
    [furniturePage, furnitureSearch],
  );

  // ==========================================
  // DATA LOADING: CATEGORIES
  // ==========================================
  const fetchCategories = useCallback(async (isRefresh = false) => {
    try {
      if (!isRefresh) setLoadingCategories(true);
      setErrorMsg(null);
      const data = await apiGetCategories();
      setCategories(data);
    } catch (err: any) {
      setErrorMsg(err.message || "Error al cargar las categorías.");
    } finally {
      setLoadingCategories(false);
      setRefreshingCategories(false);
    }
  }, []);

  // ==========================================
  // DATA LOADING: SUPPLIERS
  // ==========================================
  const fetchSuppliers = useCallback(async (isRefresh = false) => {
    try {
      if (!isRefresh) setLoadingSuppliers(true);
      setErrorMsg(null);
      const data = await apiGetSuppliers();
      setSuppliers(data);
    } catch (err: any) {
      setErrorMsg(err.message || "Error al cargar los proveedores.");
    } finally {
      setLoadingSuppliers(false);
      setRefreshingSuppliers(false);
    }
  }, []);

  // Initial load and on screen focus
  useFocusEffect(
    useCallback(() => {
      let active = true;
      (async () => {
        const ok = await verifyStaffAccess();
        if (ok && active) {
          if (selectedModule === "furniture") fetchFurniture(1);
          if (selectedModule === "categories") fetchCategories();
          if (selectedModule === "suppliers") fetchSuppliers();
        }
      })();
      return () => {
        active = false;
      };
    }, [
      verifyStaffAccess,
      selectedModule,
      fetchFurniture,
      fetchCategories,
      fetchSuppliers,
    ]),
  );

  // When the tab is switched manually
  const handleSelectModule = (newModule: AdminModule) => {
    setSelectedModule(newModule);
    setErrorMsg(null);
    if (newModule === "furniture") fetchFurniture(1);
    if (newModule === "categories") fetchCategories();
    if (newModule === "suppliers") fetchSuppliers();
  };

  // ==========================================
  // CRUD ACTIONS: FURNITURE
  // ==========================================
  const handleDeleteFurniture = async (furniture: Furniture) => {
    const ok = await dialog.confirm({
      title: "Eliminar Mueble",
      message: `¿Estás seguro de que deseas eliminar permanentemente "${furniture.name}"?`,
      confirmText: "Eliminar",
      cancelText: "Cancelar",
      confirmStyle: "destructive",
    });
    if (!ok) return;

    try {
      await apiDeleteFurniture(furniture.id);
      dialog.alert({ title: "Éxito", message: "El mueble ha sido eliminado." });
      fetchFurniture(furniturePage);
    } catch (err: any) {
      dialog.alert({
        title: "No se pudo eliminar",
        message: err.message || "Error al eliminar el mueble.",
      });
    }
  };

  // ==========================================
  // CRUD ACTIONS: CATEGORIES
  // ==========================================
  const handleOpenCreateCategory = () => {
    setCatModalMode("create");
    setEditingCatId(null);
    setCatName("");
    setCatDescription("");
    setCatFormError(null);
    setCatModalVisible(true);
  };

  const handleOpenEditCategory = (cat: Category) => {
    setCatModalMode("edit");
    setEditingCatId(cat.id);
    setCatName(cat.name);
    setCatDescription(cat.description || "");
    setCatFormError(null);
    setCatModalVisible(true);
  };

  const handleSaveCategory = async () => {
    setCatFormError(null);
    if (!catName.trim()) {
      setCatFormError("El nombre de la categoría no puede estar vacío.");
      return;
    }

    try {
      setSubmittingCat(true);
      let successMsg = "";
      if (catModalMode === "create") {
        await apiCreateCategory({
          name: catName.trim(),
          description: catDescription.trim() || undefined,
        });
        successMsg = "Categoría creada exitosamente.";
      } else if (editingCatId) {
        await apiUpdateCategory(editingCatId, {
          name: catName.trim(),
          description: catDescription.trim() || "",
        });
        successMsg = "Categoría actualizada exitosamente.";
      }
      setCatModalVisible(false);
      fetchCategories();
      if (successMsg) {
        dialog.alert({ title: "Éxito", message: successMsg });
      }
    } catch (err: any) {
      setCatFormError(err.message || "No se pudo guardar la categoría.");
    } finally {
      setSubmittingCat(false);
    }
  };

  // Warns before deleting: Category uses SET_NULL in the backend, so the furniture is not lost.
  const handleDeleteCategory = async (cat: Category) => {
    const count = cat.furniture_count ?? 0;
    const countText =
      count === 1 ? "1 mueble asociado" : `${count} muebles asociados`;
    const message =
      count > 0
        ? `Esta categoría tiene ${countText}. Si la eliminas, esos muebles quedarán sin categoría asignada.\n\n¿Deseas continuar?`
        : `¿Estás seguro de que deseas eliminar la categoría "${cat.name}"?`;

    const ok = await dialog.confirm({
      title: "Eliminar Categoría",
      message,
      confirmText: "Eliminar",
      cancelText: "Cancelar",
      confirmStyle: "destructive",
    });
    if (!ok) return;

    try {
      await apiDeleteCategory(cat.id);
      dialog.alert({ title: "Éxito", message: "Categoría eliminada." });
      fetchCategories();
    } catch (err: any) {
      dialog.alert({
        title: "No se pudo eliminar",
        message: err.message || "Error al eliminar categoría.",
      });
    }
  };

  // ==========================================
  // CRUD ACTIONS: SUPPLIERS
  // ==========================================
  const handleOpenCreateSupplier = () => {
    setSupplierModalMode("create");
    setEditingSupplierId(null);
    setSupplierName("");
    setSupplierContactName("");
    setSupplierPhone("");
    setSupplierEmail("");
    setSupplierFormError(null);
    setSupplierModalVisible(true);
  };

  const handleOpenEditSupplier = (sup: Supplier) => {
    setSupplierModalMode("edit");
    setEditingSupplierId(sup.id);
    setSupplierName(sup.name);
    setSupplierContactName(sup.contact_name || "");
    setSupplierPhone(sup.phone || "");
    setSupplierEmail(sup.email || "");
    setSupplierFormError(null);
    setSupplierModalVisible(true);
  };

  const handleSaveSupplier = async () => {
    setSupplierFormError(null);
    if (!supplierName.trim()) {
      setSupplierFormError("El nombre del proveedor es obligatorio.");
      return;
    }
    if (!supplierContactName.trim() || !supplierPhone.trim()) {
      setSupplierFormError(
        "La persona de contacto y el teléfono son obligatorios.",
      );
      return;
    }
    if (!/^\d{1,10}$/.test(supplierPhone.trim())) {
      setSupplierFormError("El teléfono no puede tener más de 10 dígitos.");
      return;
    }

    try {
      setSubmittingSupplier(true);
      let successMsg = "";
      if (supplierModalMode === "create") {
        await apiCreateSupplier({
          name: supplierName.trim(),
          contact_name: supplierContactName.trim() || undefined,
          phone: supplierPhone.trim() || undefined,
          email: supplierEmail.trim() || undefined,
        });
        successMsg = "Proveedor registrado exitosamente.";
      } else if (editingSupplierId) {
        await apiUpdateSupplier(editingSupplierId, {
          name: supplierName.trim(),
          contact_name: supplierContactName.trim() || "",
          phone: supplierPhone.trim() || "",
          email: supplierEmail.trim() || "",
        });
        successMsg = "Proveedor actualizado exitosamente.";
      }
      setSupplierModalVisible(false);
      fetchSuppliers();
      if (successMsg) {
        dialog.alert({ title: "Éxito", message: successMsg });
      }
    } catch (err: any) {
      setSupplierFormError(err.message || "No se pudo guardar el proveedor.");
    } finally {
      setSubmittingSupplier(false);
    }
  };

  // Supplier uses PROTECT in the backend: with linked furniture it answers 409 Conflict.
  const handleDeleteSupplier = async (sup: Supplier) => {
    const count = sup.furniture_count ?? 0;
    const countText =
      count === 1 ? "1 mueble asociado" : `${count} muebles asociados`;
    const message =
      count > 0
        ? `El proveedor "${sup.name}" tiene ${countText}.\n\nNo se puede eliminar mientras tenga muebles en el catálogo.\n\n¿Deseas intentar eliminarlo?`
        : `¿Estás seguro de que deseas eliminar permanentemente el proveedor "${sup.name}"?`;

    const ok = await dialog.confirm({
      title: "Eliminar Proveedor",
      message,
      confirmText: "Eliminar",
      cancelText: "Cancelar",
      confirmStyle: "destructive",
    });
    if (!ok) return;

    try {
      await apiDeleteSupplier(sup.id);
      dialog.alert({ title: "Éxito", message: "Proveedor eliminado." });
      fetchSuppliers();
    } catch (err: any) {
      dialog.alert({
        title: "No se pudo eliminar",
        message: err.message || "Error al eliminar proveedor.",
      });
    }
  };

  // Price formatting helper
  const formatPrice = (price: string | number) => {
    const num = typeof price === "number" ? price : parseFloat(price);
    return isNaN(num)
      ? "$0.00"
      : `$${num.toLocaleString("es-MX", { minimumFractionDigits: 2 })}`;
  };

  // ==========================================
  // CONDITIONAL RENDER: AUTH CHECK
  // ==========================================
  if (checkingAuth) {
    return (
      <SafeAreaView
        style={[styles.safeArea, { backgroundColor: colors.background }]}
        edges={["top", "left", "right"]}
      >
        <AdminListSkeleton />
      </SafeAreaView>
    );
  }

  if (!isStaff) {
    return null; // Redirects via useEffect
  }

  // ==========================================
  // CONTENT RENDER
  // ==========================================
  return (
    <SafeAreaView
      style={[styles.safeArea, { backgroundColor: colors.background }]}
      edges={["top", "left", "right"]}
    >
      {/* Top header */}
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <View style={[styles.headerInner, desktopContainerStyle]}>
          <View style={styles.headerTitleRow}>
            <View>
              <Text style={[styles.headerTitle, { color: colors.text }]}>
                Administración
              </Text>
              <Text
                style={[styles.headerSubtitle, { color: colors.textMuted }]}
              >
                Gestión centralizada de catálogo y catálogos auxiliares
              </Text>
            </View>
            <Badge label="STAFF" variant="warning" size="medium" />
          </View>

          {/* 3 main buttons (module selector) */}
          <View
            style={[
              styles.moduleSelector,
              { backgroundColor: colors.card, borderColor: colors.border },
            ]}
          >
            <Pressable
              style={[
                styles.moduleButton,
                selectedModule === "furniture" && [
                  styles.moduleButtonActive,
                  { backgroundColor: colors.accent },
                ],
              ]}
              onPress={() => handleSelectModule("furniture")}
              accessibilityRole="tab"
              accessibilityState={{ selected: selectedModule === "furniture" }}
              accessibilityLabel="Módulo de muebles"
            >
              <Ionicons
                name={selectedModule === "furniture" ? "cube" : "cube-outline"}
                size={18}
                color={selectedModule === "furniture" ? "#FFFFFF" : colors.text}
              />
              <Text
                style={[
                  styles.moduleButtonText,
                  { color: selectedModule === "furniture" ? "#FFFFFF" : colors.text },
                ]}
              >
                Muebles
              </Text>
            </Pressable>

            <Pressable
              style={[
                styles.moduleButton,
                selectedModule === "categories" && [
                  styles.moduleButtonActive,
                  { backgroundColor: colors.accent },
                ],
              ]}
              onPress={() => handleSelectModule("categories")}
              accessibilityRole="tab"
              accessibilityState={{ selected: selectedModule === "categories" }}
              accessibilityLabel="Módulo de categorías"
            >
              <Ionicons
                name={selectedModule === "categories" ? "folder" : "folder-outline"}
                size={18}
                color={selectedModule === "categories" ? "#FFFFFF" : colors.text}
              />
              <Text
                style={[
                  styles.moduleButtonText,
                  { color: selectedModule === "categories" ? "#FFFFFF" : colors.text },
                ]}
              >
                Categorías
              </Text>
            </Pressable>

            <Pressable
              style={[
                styles.moduleButton,
                selectedModule === "suppliers" && [
                  styles.moduleButtonActive,
                  { backgroundColor: colors.accent },
                ],
              ]}
              onPress={() => handleSelectModule("suppliers")}
              accessibilityRole="tab"
              accessibilityState={{ selected: selectedModule === "suppliers" }}
              accessibilityLabel="Módulo de proveedores"
            >
              <Ionicons
                name={
                  selectedModule === "suppliers" ? "business" : "business-outline"
                }
                size={18}
                color={selectedModule === "suppliers" ? "#FFFFFF" : colors.text}
              />
              <Text
                style={[
                  styles.moduleButtonText,
                  { color: selectedModule === "suppliers" ? "#FFFFFF" : colors.text },
                ]}
              >
                Proveedores
              </Text>
            </Pressable>
          </View>
        </View>
      </View>

      {/* Error view if a request failed */}
      {errorMsg ? (
        <View style={[{ padding: 16 }, desktopContainerStyle]}>
          <ErrorView
            message={errorMsg}
            onRetry={() => {
              if (selectedModule === "furniture") fetchFurniture(furniturePage);
              if (selectedModule === "categories") fetchCategories();
              if (selectedModule === "suppliers") fetchSuppliers();
            }}
          />
        </View>
      ) : null}

      {/* ======================================================== */}
      {/* VIEW 1: FURNITURE MODULE                                 */}
      {/* ======================================================== */}
      {selectedModule === "furniture" && (
        <View style={styles.contentContainer}>
          {/* Actions and search bar */}
          <View style={[styles.actionsBar, desktopContainerStyle]}>
            <View
              style={[
                styles.searchBox,
                { backgroundColor: colors.card, borderColor: colors.border },
              ]}
            >
              <Ionicons
                name="search-outline"
                size={18}
                color={colors.textMuted}
              />
              <TextInput
                style={[styles.searchInput, { color: colors.text }]}
                placeholder="Buscar por nombre o descripción..."
                placeholderTextColor={colors.textMuted}
                value={furnitureSearch}
                onChangeText={setFurnitureSearch}
                onSubmitEditing={() => fetchFurniture(1)}
                returnKeyType="search"
              />
              {furnitureSearch ? (
                <Pressable
                  onPress={() => {
                    setFurnitureSearch("");
                    fetchFurniture(1);
                  }}
                  hitSlop={8}
                  accessibilityRole="button"
                  accessibilityLabel="Limpiar búsqueda"
                >
                  <Ionicons
                    name="close-circle"
                    size={18}
                    color={colors.textMuted}
                  />
                </Pressable>
              ) : null}
            </View>

            <Pressable
              style={[styles.createButton, { backgroundColor: colors.accent }]}
              onPress={() => router.push("/(app)/furniture/form")}
              accessibilityRole="button"
              accessibilityLabel="Nuevo mueble"
              accessibilityHint="Abre el formulario para registrar un nuevo mueble"
            >
              <Ionicons name="add" size={18} color="#FFFFFF" />
              <Text style={styles.createButtonText}>Nuevo</Text>
            </Pressable>
          </View>

          {/* Furniture counter */}
          <View style={[styles.countRow, desktopContainerStyle]}>
            <Text style={[styles.countText, { color: colors.textMuted }]}>
              {furnitureTotalCount}{" "}
              {furnitureTotalCount === 1
                ? "mueble encontrado"
                : "muebles encontrados"}
            </Text>
          </View>

          {loadingFurniture && !refreshingFurniture ? (
            <AdminListSkeleton />
          ) : (
            <FlatList
              data={furnitureList}
              keyExtractor={(item) => item.id.toString()}
              contentContainerStyle={[
                styles.listContent,
                desktopContainerStyle,
              ]}
              refreshControl={
                <RefreshControl
                  refreshing={refreshingFurniture}
                  onRefresh={() => {
                    setRefreshingFurniture(true);
                    fetchFurniture(1, true);
                  }}
                  colors={[colors.accent]}
                  tintColor={colors.accent}
                />
              }
              ListEmptyComponent={
                <EmptyView
                  title="No se encontraron muebles"
                  description={
                    furnitureSearch
                      ? "Intenta con otro término de búsqueda."
                      : "Aún no hay muebles registrados en el catálogo."
                  }
                  actionLabel="+ Crear primer mueble"
                  onAction={() => router.push("/(app)/furniture/form")}
                />
              }
              renderItem={({ item }) => {
                const imgUri = furnitureImages[item.id];
                return (
                  <View
                    style={[
                      styles.itemCard,
                      {
                        backgroundColor: colors.card,
                        borderColor: colors.border,
                      },
                    ]}
                  >
                    <Pressable
                      style={styles.furnitureItemMain}
                      onPress={() => router.push(`/(app)/furniture/${item.id}`)}
                    >
                      {/* On desktop uses contain over backgroundElement so the furniture thumbnail is not cropped. */}
                      <View
                        style={[
                          styles.thumbContainer,
                          { backgroundColor: colors.backgroundElement },
                        ]}
                      >
                        {imgUri ? (
                          <Image
                            source={{ uri: imgUri }}
                            style={styles.thumbImage}
                            contentFit={isMobile ? "cover" : "contain"}
                          />
                        ) : (
                          <Ionicons
                            name="image-outline"
                            size={26}
                            color={colors.textMuted}
                          />
                        )}
                      </View>

                      <View style={styles.furnitureItemInfo}>
                        <Text
                          style={[
                            styles.furnitureItemTitle,
                            { color: colors.text },
                          ]}
                          numberOfLines={1}
                        >
                          {item.name}
                        </Text>
                        <Text
                          style={[
                            styles.furnitureItemCategory,
                            { color: colors.textMuted },
                          ]}
                          numberOfLines={1}
                        >
                          {item.category?.name || "Sin categoría"} •{" "}
                          {item.supplier?.name || "Proveedor"}
                        </Text>
                        <View style={styles.furnitureItemPriceRow}>
                          <Text
                            style={[
                              styles.furnitureItemPrice,
                              { color: colors.accent },
                            ]}
                          >
                            {formatPrice(item.price)}
                          </Text>
                          <Badge
                            label={
                              item.stock <= 0
                                ? "Agotado"
                                : `Stock: ${item.stock}`
                            }
                            variant={
                              item.stock <= 0
                                ? "danger"
                                : item.stock <= 3
                                  ? "warning"
                                  : "success"
                            }
                          />
                        </View>
                      </View>
                    </Pressable>

                    {/* Edit and delete actions */}
                    <View
                      style={[
                        styles.itemActions,
                        { borderTopColor: colors.border },
                      ]}
                    >
                      <Pressable
                        style={[
                          styles.actionBtn,
                          { borderColor: colors.border },
                        ]}
                        onPress={() =>
                          router.push(`/(app)/furniture/form?id=${item.id}`)
                        }
                        accessibilityRole="button"
                        accessibilityLabel={`Editar mueble ${item.name}`}
                      >
                        <Ionicons
                          name="create-outline"
                          size={16}
                          color={colors.text}
                        />
                        <Text
                          style={[styles.actionBtnText, { color: colors.text }]}
                        >
                          Editar
                        </Text>
                      </Pressable>

                      <Pressable
                        style={[
                          styles.actionBtn,
                          {
                            borderColor: `${colors.danger}40`,
                            backgroundColor: `${colors.danger}10`,
                          },
                        ]}
                        onPress={() => handleDeleteFurniture(item)}
                        accessibilityRole="button"
                        accessibilityLabel={`Eliminar mueble ${item.name}`}
                      >
                        <Ionicons
                          name="trash-outline"
                          size={16}
                          color={colors.danger}
                        />
                        <Text
                          style={[
                            styles.actionBtnText,
                            { color: colors.danger },
                          ]}
                        >
                          Eliminar
                        </Text>
                      </Pressable>
                    </View>
                  </View>
                );
              }}
              ListFooterComponent={
                <Pagination
                  page={furniturePage}
                  totalPages={furnitureTotalPages}
                  onPageChange={(p) => fetchFurniture(p)}
                />
              }
            />
          )}
        </View>
      )}

      {/* ======================================================== */}
      {/* VIEW 2: CATEGORIES MODULE                                */}
      {/* ======================================================== */}
      {selectedModule === "categories" && (
        <View style={styles.contentContainer}>
          <View style={[styles.actionsBar, desktopContainerStyle]}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.countText, { color: colors.textMuted }]}>
                {categories.length}{" "}
                {categories.length === 1
                  ? "categoría registrada"
                  : "categorías registradas"}
              </Text>
            </View>

            <Pressable
              style={[styles.createButton, { backgroundColor: colors.accent }]}
              onPress={handleOpenCreateCategory}
              accessibilityRole="button"
              accessibilityLabel="Nueva categoría"
            >
              <Ionicons name="add" size={18} color="#FFFFFF" />
              <Text style={styles.createButtonText}>Nueva</Text>
            </Pressable>
          </View>

          {loadingCategories && !refreshingCategories ? (
            <AdminListSkeleton />
          ) : (
            <FlatList
              data={categories}
              keyExtractor={(item) => item.id.toString()}
              contentContainerStyle={[
                styles.listContent,
                desktopContainerStyle,
              ]}
              refreshControl={
                <RefreshControl
                  refreshing={refreshingCategories}
                  onRefresh={() => {
                    setRefreshingCategories(true);
                    fetchCategories(true);
                  }}
                  colors={[colors.accent]}
                  tintColor={colors.accent}
                />
              }
              ListEmptyComponent={
                <EmptyView
                  title="No hay categorías"
                  description="Crea la primera categoría para organizar los muebles del catálogo."
                  actionLabel="+ Crear categoría"
                  onAction={handleOpenCreateCategory}
                />
              }
              renderItem={({ item }) => {
                const count = item.furniture_count ?? 0;
                return (
                  <View
                    style={[
                      styles.itemCard,
                      {
                        backgroundColor: colors.card,
                        borderColor: colors.border,
                      },
                    ]}
                  >
                    <View style={styles.catSupplierHeader}>
                      <View style={{ flex: 1, marginRight: 8 }}>
                        <Text
                          style={[styles.cardItemTitle, { color: colors.text }]}
                        >
                          {item.name}
                        </Text>
                        {item.description ? (
                          <Text
                            style={[
                              styles.cardItemDesc,
                              { color: colors.textMuted },
                            ]}
                          >
                            {item.description}
                          </Text>
                        ) : (
                          <Text
                            style={[
                              styles.cardItemDesc,
                              { color: colors.textMuted, fontStyle: "italic" },
                            ]}
                          >
                            Sin descripción
                          </Text>
                        )}
                      </View>
                      <Badge
                        label={`${count} ${count === 1 ? "mueble" : "muebles"}`}
                        variant={count > 0 ? "info" : "neutral"}
                      />
                    </View>

                    {/* Edit and delete actions */}
                    <View
                      style={[
                        styles.itemActions,
                        { borderTopColor: colors.border },
                      ]}
                    >
                      <Pressable
                        style={[
                          styles.actionBtn,
                          { borderColor: colors.border },
                        ]}
                        onPress={() => handleOpenEditCategory(item)}
                        accessibilityRole="button"
                        accessibilityLabel={`Editar categoría ${item.name}`}
                      >
                        <Ionicons
                          name="create-outline"
                          size={16}
                          color={colors.text}
                        />
                        <Text
                          style={[styles.actionBtnText, { color: colors.text }]}
                        >
                          Editar
                        </Text>
                      </Pressable>

                      <Pressable
                        style={[
                          styles.actionBtn,
                          {
                            borderColor: `${colors.danger}40`,
                            backgroundColor: `${colors.danger}10`,
                          },
                        ]}
                        onPress={() => handleDeleteCategory(item)}
                        accessibilityRole="button"
                        accessibilityLabel={`Eliminar categoría ${item.name}`}
                      >
                        <Ionicons
                          name="trash-outline"
                          size={16}
                          color={colors.danger}
                        />
                        <Text
                          style={[
                            styles.actionBtnText,
                            { color: colors.danger },
                          ]}
                        >
                          Eliminar
                        </Text>
                      </Pressable>
                    </View>
                  </View>
                );
              }}
            />
          )}
        </View>
      )}

      {/* ======================================================== */}
      {/* VIEW 3: SUPPLIERS MODULE                                 */}
      {/* ======================================================== */}
      {selectedModule === "suppliers" && (
        <View style={styles.contentContainer}>
          <View style={[styles.actionsBar, desktopContainerStyle]}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.countText, { color: colors.textMuted }]}>
                {suppliers.length}{" "}
                {suppliers.length === 1
                  ? "proveedor registrado"
                  : "proveedores registrados"}
              </Text>
            </View>

            <Pressable
              style={[styles.createButton, { backgroundColor: colors.accent }]}
              onPress={handleOpenCreateSupplier}
              accessibilityRole="button"
              accessibilityLabel="Nuevo proveedor"
            >
              <Ionicons name="add" size={18} color="#FFFFFF" />
              <Text style={styles.createButtonText}>Nuevo</Text>
            </Pressable>
          </View>

          {loadingSuppliers && !refreshingSuppliers ? (
            <AdminListSkeleton />
          ) : (
            <FlatList
              data={suppliers}
              keyExtractor={(item) => item.id.toString()}
              contentContainerStyle={[
                styles.listContent,
                desktopContainerStyle,
              ]}
              refreshControl={
                <RefreshControl
                  refreshing={refreshingSuppliers}
                  onRefresh={() => {
                    setRefreshingSuppliers(true);
                    fetchSuppliers(true);
                  }}
                  colors={[colors.accent]}
                  tintColor={colors.accent}
                />
              }
              ListEmptyComponent={
                <EmptyView
                  title="No hay proveedores"
                  description="Registra proveedores para asociarlos a los muebles del inventario."
                  actionLabel="+ Registrar proveedor"
                  onAction={handleOpenCreateSupplier}
                />
              }
              renderItem={({ item }) => {
                const count = item.furniture_count ?? 0;
                return (
                  <View
                    style={[
                      styles.itemCard,
                      {
                        backgroundColor: colors.card,
                        borderColor: colors.border,
                      },
                    ]}
                  >
                    <View style={styles.catSupplierHeader}>
                      <View style={{ flex: 1, marginRight: 8 }}>
                        <Text
                          style={[styles.cardItemTitle, { color: colors.text }]}
                        >
                          {item.name}
                        </Text>

                        {/* Contact details */}
                        {item.contact_name ? (
                          <View style={styles.supplierInfoRow}>
                            <Ionicons
                              name="person-outline"
                              size={14}
                              color={colors.textMuted}
                            />
                            <Text
                              style={[
                                styles.supplierInfoText,
                                { color: colors.textMuted },
                              ]}
                            >
                              {item.contact_name}
                            </Text>
                          </View>
                        ) : null}

                        {item.phone ? (
                          <View style={styles.supplierInfoRow}>
                            <Ionicons
                              name="call-outline"
                              size={14}
                              color={colors.textMuted}
                            />
                            <Text
                              style={[
                                styles.supplierInfoText,
                                { color: colors.textMuted },
                              ]}
                            >
                              {item.phone}
                            </Text>
                          </View>
                        ) : null}

                        {item.email ? (
                          <View style={styles.supplierInfoRow}>
                            <Ionicons
                              name="mail-outline"
                              size={14}
                              color={colors.textMuted}
                            />
                            <Text
                              style={[
                                styles.supplierInfoText,
                                { color: colors.textMuted },
                              ]}
                            >
                              {item.email}
                            </Text>
                          </View>
                        ) : null}
                      </View>
                      <Badge
                        label={`${count} ${count === 1 ? "mueble" : "muebles"}`}
                        variant={count > 0 ? "info" : "neutral"}
                      />
                    </View>

                    {/* Edit and delete actions */}
                    <View
                      style={[
                        styles.itemActions,
                        { borderTopColor: colors.border },
                      ]}
                    >
                      <Pressable
                        style={[
                          styles.actionBtn,
                          { borderColor: colors.border },
                        ]}
                        onPress={() => handleOpenEditSupplier(item)}
                        accessibilityRole="button"
                        accessibilityLabel={`Editar proveedor ${item.name}`}
                      >
                        <Ionicons
                          name="create-outline"
                          size={16}
                          color={colors.text}
                        />
                        <Text
                          style={[styles.actionBtnText, { color: colors.text }]}
                        >
                          Editar
                        </Text>
                      </Pressable>

                      <Pressable
                        style={[
                          styles.actionBtn,
                          {
                            borderColor: `${colors.danger}40`,
                            backgroundColor: `${colors.danger}10`,
                          },
                        ]}
                        onPress={() => handleDeleteSupplier(item)}
                        accessibilityRole="button"
                        accessibilityLabel={`Eliminar proveedor ${item.name}`}
                      >
                        <Ionicons
                          name="trash-outline"
                          size={16}
                          color={colors.danger}
                        />
                        <Text
                          style={[
                            styles.actionBtnText,
                            { color: colors.danger },
                          ]}
                        >
                          Eliminar
                        </Text>
                      </Pressable>
                    </View>
                  </View>
                );
              }}
            />
          )}
        </View>
      )}

      {/* ======================================================== */}
      {/* MODAL: CATEGORY FORM                                    */}
      {/* ======================================================== */}
      <Modal
        visible={catModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setCatModalVisible(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={styles.modalBackdrop}
        >
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={() => setCatModalVisible(false)}
            accessibilityRole="button"
            accessibilityLabel="Cerrar modal de categoría"
          />
          <View
            style={[
              styles.modalContent,
              !isMobile && styles.modalContentDesktop,
              { backgroundColor: colors.card, borderColor: colors.border },
            ]}
            onStartShouldSetResponder={() => true}
          >
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitleText, { color: colors.text }]}>
                {catModalMode === "create"
                  ? "Nueva Categoría"
                  : "Editar Categoría"}
              </Text>
              <Pressable
                onPress={() => setCatModalVisible(false)}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel="Cerrar"
              >
                <Ionicons name="close" size={22} color={colors.textMuted} />
              </Pressable>
            </View>

            <ScrollView
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              {catFormError ? (
                <View
                  style={[
                    styles.inlineErrorBox,
                    {
                      backgroundColor: `${colors.danger}15`,
                      borderColor: `${colors.danger}40`,
                    },
                  ]}
                >
                  <Text
                    style={[styles.inlineErrorText, { color: colors.danger }]}
                  >
                    {catFormError}
                  </Text>
                </View>
              ) : null}
              <Text style={[styles.inputLabel, { color: colors.text }]}>
                Nombre de la categoría *
              </Text>
              <TextInput
                style={[
                  styles.modalInput,
                  {
                    backgroundColor: colors.background,
                    borderColor: colors.border,
                    color: colors.text,
                  },
                ]}
                placeholder="Ej. Salas y Sofás"
                placeholderTextColor={colors.textMuted}
                value={catName}
                onChangeText={setCatName}
                autoCapitalize="words"
              />

              <Text
                style={[
                  styles.inputLabel,
                  { color: colors.text, marginTop: 14 },
                ]}
              >
                Descripción (opcional)
              </Text>
              <TextInput
                style={[
                  styles.modalInput,
                  styles.modalInputMultiline,
                  {
                    backgroundColor: colors.background,
                    borderColor: colors.border,
                    color: colors.text,
                  },
                ]}
                placeholder="Breve detalle sobre los muebles de esta categoría..."
                placeholderTextColor={colors.textMuted}
                value={catDescription}
                onChangeText={setCatDescription}
                multiline
                numberOfLines={3}
                textAlignVertical="top"
              />

              <Pressable
                style={[
                  styles.confirmButton,
                  {
                    backgroundColor: colors.accent,
                    opacity: submittingCat ? 0.7 : 1,
                  },
                ]}
                onPress={handleSaveCategory}
                disabled={submittingCat}
                accessibilityRole="button"
                accessibilityLabel={
                  catModalMode === "create"
                    ? "Crear categoría"
                    : "Guardar cambios de categoría"
                }
              >
                {submittingCat ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.confirmButtonText}>
                    {catModalMode === "create"
                      ? "Crear Categoría"
                      : "Guardar Cambios"}
                  </Text>
                )}
              </Pressable>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ======================================================== */}
      {/* MODAL: SUPPLIER FORM                                    */}
      {/* ======================================================== */}
      <Modal
        visible={supplierModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setSupplierModalVisible(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={styles.modalBackdrop}
        >
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={() => setSupplierModalVisible(false)}
            accessibilityRole="button"
            accessibilityLabel="Cerrar modal de proveedor"
          />
          <View
            style={[
              styles.modalContent,
              !isMobile && styles.modalContentDesktop,
              { backgroundColor: colors.card, borderColor: colors.border },
            ]}
            onStartShouldSetResponder={() => true}
          >
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitleText, { color: colors.text }]}>
                {supplierModalMode === "create"
                  ? "Nuevo Proveedor"
                  : "Editar Proveedor"}
              </Text>
              <Pressable
                onPress={() => setSupplierModalVisible(false)}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel="Cerrar"
              >
                <Ionicons name="close" size={22} color={colors.textMuted} />
              </Pressable>
            </View>

            <ScrollView
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              {supplierFormError ? (
                <View
                  style={[
                    styles.inlineErrorBox,
                    {
                      backgroundColor: `${colors.danger}15`,
                      borderColor: `${colors.danger}40`,
                    },
                  ]}
                >
                  <Text
                    style={[styles.inlineErrorText, { color: colors.danger }]}
                  >
                    {supplierFormError}
                  </Text>
                </View>
              ) : null}
              <Text style={[styles.inputLabel, { color: colors.text }]}>
                Nombre del Proveedor *
              </Text>
              <TextInput
                style={[
                  styles.modalInput,
                  {
                    backgroundColor: colors.background,
                    borderColor: colors.border,
                    color: colors.text,
                  },
                ]}
                placeholder="Ej. Mobiliaria Nórdica de México"
                placeholderTextColor={colors.textMuted}
                value={supplierName}
                onChangeText={setSupplierName}
                autoCapitalize="words"
              />

              <Text
                style={[
                  styles.inputLabel,
                  { color: colors.text, marginTop: 14 },
                ]}
              >
                Persona de Contacto *
              </Text>
              <TextInput
                style={[
                  styles.modalInput,
                  {
                    backgroundColor: colors.background,
                    borderColor: colors.border,
                    color: colors.text,
                  },
                ]}
                placeholder="Ej. Ing. Carlos Mendoza"
                placeholderTextColor={colors.textMuted}
                value={supplierContactName}
                onChangeText={setSupplierContactName}
                autoCapitalize="words"
              />

              <Text
                style={[
                  styles.inputLabel,
                  { color: colors.text, marginTop: 14 },
                ]}
              >
                Teléfono *
              </Text>
              <TextInput
                style={[
                  styles.modalInput,
                  {
                    backgroundColor: colors.background,
                    borderColor: colors.border,
                    color: colors.text,
                  },
                ]}
                placeholder="Ej. 4491234567"
                placeholderTextColor={colors.textMuted}
                value={supplierPhone}
                onChangeText={setSupplierPhone}
                keyboardType="phone-pad"
                maxLength={10}
              />

              <Text
                style={[
                  styles.inputLabel,
                  { color: colors.text, marginTop: 14 },
                ]}
              >
                Correo Electrónico
              </Text>
              <TextInput
                style={[
                  styles.modalInput,
                  {
                    backgroundColor: colors.background,
                    borderColor: colors.border,
                    color: colors.text,
                  },
                ]}
                placeholder="Ej. ventas@proveedor.com"
                placeholderTextColor={colors.textMuted}
                value={supplierEmail}
                onChangeText={setSupplierEmail}
                keyboardType="email-address"
                autoCapitalize="none"
              />

              <Pressable
                style={[
                  styles.confirmButton,
                  {
                    backgroundColor: colors.accent,
                    opacity: submittingSupplier ? 0.7 : 1,
                  },
                ]}
                onPress={handleSaveSupplier}
                disabled={submittingSupplier}
                accessibilityRole="button"
                accessibilityLabel={
                  supplierModalMode === "create"
                    ? "Registrar proveedor"
                    : "Guardar cambios de proveedor"
                }
              >
                {submittingSupplier ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.confirmButtonText}>
                    {supplierModalMode === "create"
                      ? "Registrar Proveedor"
                      : "Guardar Cambios"}
                  </Text>
                )}
              </Pressable>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
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
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 14,
    width: "100%",
  },
  headerTitleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: "800",
    letterSpacing: -0.3,
  },
  headerSubtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  moduleSelector: {
    flexDirection: "row",
    borderRadius: 12,
    borderWidth: 1,
    padding: 4,
    gap: 4,
  },
  moduleButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 8,
    borderRadius: 8,
    gap: 6,
  },
  moduleButtonActive: {
    elevation: 2,
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 3,
  },
  moduleButtonText: {
    fontSize: 13,
    fontWeight: "700",
  },
  contentContainer: {
    flex: 1,
  },
  actionsBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
    gap: 10,
  },
  searchBox: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 10,
    height: 42,
  },
  searchInput: {
    flex: 1,
    marginLeft: 8,
    fontSize: 13,
    height: "100%",
  },
  createButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    height: 42,
    borderRadius: 10,
    gap: 4,
  },
  createButtonText: {
    color: "#FFFFFF",
    fontWeight: "700",
    fontSize: 13,
  },
  countRow: {
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  countText: {
    fontSize: 12,
    fontWeight: "600",
  },
  listContent: {
    padding: 16,
    paddingBottom: 32,
    gap: 12,
  },
  itemCard: {
    borderRadius: 12,
    borderWidth: 1,
    overflow: "hidden",
  },
  furnitureItemMain: {
    flexDirection: "row",
    padding: 12,
    alignItems: "center",
  },
  thumbContainer: {
    width: 64,
    height: 64,
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
    overflow: "hidden",
    marginRight: 12,
  },
  thumbImage: {
    width: "100%",
    height: "100%",
  },
  furnitureItemInfo: {
    flex: 1,
  },
  furnitureItemTitle: {
    fontSize: 15,
    fontWeight: "700",
    marginBottom: 2,
  },
  furnitureItemCategory: {
    fontSize: 12,
    marginBottom: 6,
  },
  furnitureItemPriceRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  furnitureItemPrice: {
    fontSize: 15,
    fontWeight: "800",
  },
  itemActions: {
    flexDirection: "row",
    borderTopWidth: 1,
    padding: 8,
    gap: 8,
    justifyContent: "flex-end",
  },
  actionBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    gap: 4,
  },
  actionBtnText: {
    fontSize: 12,
    fontWeight: "700",
  },
  catSupplierHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    padding: 14,
  },
  cardItemTitle: {
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 4,
  },
  cardItemDesc: {
    fontSize: 13,
    lineHeight: 18,
  },
  supplierInfoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 4,
  },
  supplierInfoText: {
    fontSize: 12,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  modalContent: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderWidth: 1,
    padding: 24,
    maxHeight: "85%",
  },
  modalContentDesktop: {
    maxWidth: 560,
    width: "100%",
    alignSelf: "center",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  modalTitleText: {
    fontSize: 18,
    fontWeight: "800",
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: "600",
    marginBottom: 6,
  },
  modalInput: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    height: 44,
    fontSize: 14,
  },
  modalInputMultiline: {
    height: 72,
    paddingTop: 8,
  },
  confirmButton: {
    height: 48,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 20,
    marginBottom: 12,
  },
  confirmButtonText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "700",
  },
  inlineErrorBox: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 10,
    marginBottom: 12,
  },
  inlineErrorText: {
    fontSize: 13,
    fontWeight: "600",
  },
});
