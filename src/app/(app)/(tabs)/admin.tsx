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
import { LoadingView } from "../../../components/LoadingView";
import { Pagination } from "../../../components/Pagination";
import { Colors } from "../../../constants/theme";
import { dialog } from "../../../context/DialogContext";
import { Categoria, Mueble, Proveedor } from "../../../types";
import {
  apiCreateCategoria,
  apiCreateProveedor,
  apiDeleteCategoria,
  apiDeleteMueble,
  apiDeleteProveedor,
  apiGetCategorias,
  apiGetMuebles,
  apiGetProveedores,
  apiUpdateCategoria,
  apiUpdateProveedor,
  resolveImageUrl,
} from "../../../utils/api";
import { getStoredPageSize } from "../../../utils/settingsStorage";
import { getUser } from "../../../utils/tokenStorage";

type AdminModule = "muebles" | "categorias" | "proveedores";

export default function AdminScreen() {
  const router = useRouter();
  const scheme = useColorScheme() ?? "light";
  const colors = Colors[scheme];

  // ==========================================
  // ESTADO DE AUTENTICACIÓN / STAFF GUARD
  // ==========================================
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [isStaff, setIsStaff] = useState(false);

  // Módulo seleccionado (3 botones principales)
  const [modulo, setModulo] = useState<AdminModule>("muebles");

  // ==========================================
  // ESTADOS DEL MÓDULO MUEBLES
  // ==========================================
  const [muebles, setMuebles] = useState<Mueble[]>([]);
  const [loadingMuebles, setLoadingMuebles] = useState(false);
  const [refreshingMuebles, setRefreshingMuebles] = useState(false);
  const [mueblesSearch, setMueblesSearch] = useState("");
  const [mueblesPage, setMueblesPage] = useState(1);
  const [mueblesTotalPages, setMueblesTotalPages] = useState(1);
  const [mueblesTotalCount, setMueblesTotalCount] = useState(0);
  const [mueblesImages, setMueblesImages] = useState<
    Record<number, string | null>
  >({});

  // ==========================================
  // ESTADOS DEL MÓDULO CATEGORÍAS
  // ==========================================
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [loadingCategorias, setLoadingCategorias] = useState(false);
  const [refreshingCategorias, setRefreshingCategorias] = useState(false);

  // Modal Categoría
  const [catModalVisible, setCatModalVisible] = useState(false);
  const [catModalMode, setCatModalMode] = useState<"create" | "edit">("create");
  const [editingCatId, setEditingCatId] = useState<number | null>(null);
  const [catNombre, setCatNombre] = useState("");
  const [catDescripcion, setCatDescripcion] = useState("");
  const [submittingCat, setSubmittingCat] = useState(false);
  const [catFormError, setCatFormError] = useState<string | null>(null);

  // ==========================================
  // ESTADOS DEL MÓDULO PROVEEDORES
  // ==========================================
  const [proveedores, setProveedores] = useState<Proveedor[]>([]);
  const [loadingProveedores, setLoadingProveedores] = useState(false);
  const [refreshingProveedores, setRefreshingProveedores] = useState(false);

  // Modal Proveedor
  const [provModalVisible, setProvModalVisible] = useState(false);
  const [provModalMode, setProvModalMode] = useState<"create" | "edit">(
    "create",
  );
  const [editingProvId, setEditingProvId] = useState<number | null>(null);
  const [provNombre, setProvNombre] = useState("");
  const [provContacto, setProvContacto] = useState("");
  const [provTelefono, setProvTelefono] = useState("");
  const [provEmail, setProvEmail] = useState("");
  const [submittingProv, setSubmittingProv] = useState(false);
  const [provFormError, setProvFormError] = useState<string | null>(null);

  // Error genérico por pestaña
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // ==========================================
  // VERIFICACIÓN DE ACCESO STAFF
  // ==========================================
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
  // CARGA DE DATOS: MUEBLES
  // ==========================================
  const fetchMuebles = useCallback(
    async (pageToLoad = mueblesPage, isRefresh = false) => {
      try {
        if (!isRefresh) setLoadingMuebles(true);
        setErrorMsg(null);
        const storedSize = await getStoredPageSize();

        const data = await apiGetMuebles({
          page: pageToLoad,
          page_size: storedSize,
          search: mueblesSearch.trim() || undefined,
        });

        setMuebles(data.results || []);
        setMueblesTotalCount(data.count || 0);
        setMueblesTotalPages(data.total_pages || 1);
        setMueblesPage(data.current_page || pageToLoad);

        // Resolver URLs de imágenes para las miniaturas
        const urlMap: Record<number, string | null> = {};
        await Promise.all(
          (data.results || []).map(async (m) => {
            if (m.imagen) {
              urlMap[m.id] = await resolveImageUrl(m.imagen);
            } else {
              urlMap[m.id] = null;
            }
          }),
        );
        setMueblesImages(urlMap);
      } catch (err: any) {
        setErrorMsg(err.message || "Error al obtener los muebles.");
      } finally {
        setLoadingMuebles(false);
        setRefreshingMuebles(false);
      }
    },
    [mueblesPage, mueblesSearch],
  );

  // ==========================================
  // CARGA DE DATOS: CATEGORÍAS
  // ==========================================
  const fetchCategorias = useCallback(async (isRefresh = false) => {
    try {
      if (!isRefresh) setLoadingCategorias(true);
      setErrorMsg(null);
      const data = await apiGetCategorias();
      setCategorias(data);
    } catch (err: any) {
      setErrorMsg(err.message || "Error al cargar las categorías.");
    } finally {
      setLoadingCategorias(false);
      setRefreshingCategorias(false);
    }
  }, []);

  // ==========================================
  // CARGA DE DATOS: PROVEEDORES
  // ==========================================
  const fetchProveedores = useCallback(async (isRefresh = false) => {
    try {
      if (!isRefresh) setLoadingProveedores(true);
      setErrorMsg(null);
      const data = await apiGetProveedores();
      setProveedores(data);
    } catch (err: any) {
      setErrorMsg(err.message || "Error al cargar los proveedores.");
    } finally {
      setLoadingProveedores(false);
      setRefreshingProveedores(false);
    }
  }, []);

  // Carga inicial y al enfocar la pantalla
  useFocusEffect(
    useCallback(() => {
      let active = true;
      (async () => {
        const ok = await verifyStaffAccess();
        if (ok && active) {
          if (modulo === "muebles") fetchMuebles(1);
          if (modulo === "categorias") fetchCategorias();
          if (modulo === "proveedores") fetchProveedores();
        }
      })();
      return () => {
        active = false;
      };
    }, [
      verifyStaffAccess,
      modulo,
      fetchMuebles,
      fetchCategorias,
      fetchProveedores,
    ]),
  );

  // Al cambiar de pestaña manual
  const handleSelectModulo = (newModulo: AdminModule) => {
    setModulo(newModulo);
    setErrorMsg(null);
    if (newModulo === "muebles") fetchMuebles(1);
    if (newModulo === "categorias") fetchCategorias();
    if (newModulo === "proveedores") fetchProveedores();
  };

  // ==========================================
  // ACCIONES CRUD: MUEBLES
  // ==========================================
  const handleDeleteMueble = async (mueble: Mueble) => {
    const ok = await dialog.confirm({
      title: "Eliminar Mueble",
      message: `¿Estás seguro de que deseas eliminar permanentemente "${mueble.nombre}"?`,
      confirmText: "Eliminar",
      cancelText: "Cancelar",
      confirmStyle: "destructive",
    });
    if (!ok) return;

    try {
      await apiDeleteMueble(mueble.id);
      dialog.alert({ title: "Éxito", message: "El mueble ha sido eliminado." });
      fetchMuebles(mueblesPage);
    } catch (err: any) {
      dialog.alert({
        title: "No se pudo eliminar",
        message: err.message || "Error al eliminar el mueble.",
      });
    }
  };

  // ==========================================
  // ACCIONES CRUD: CATEGORÍAS
  // ==========================================
  const handleOpenCreateCategoria = () => {
    setCatModalMode("create");
    setEditingCatId(null);
    setCatNombre("");
    setCatDescripcion("");
    setCatFormError(null);
    setCatModalVisible(true);
  };

  const handleOpenEditCategoria = (cat: Categoria) => {
    setCatModalMode("edit");
    setEditingCatId(cat.id);
    setCatNombre(cat.nombre);
    setCatDescripcion(cat.descripcion || "");
    setCatFormError(null);
    setCatModalVisible(true);
  };

  const handleSaveCategoria = async () => {
    setCatFormError(null);
    if (!catNombre.trim()) {
      setCatFormError("El nombre de la categoría no puede estar vacío.");
      return;
    }

    try {
      setSubmittingCat(true);
      let successMsg = "";
      if (catModalMode === "create") {
        await apiCreateCategoria({
          nombre: catNombre.trim(),
          descripcion: catDescripcion.trim() || undefined,
        });
        successMsg = "Categoría creada exitosamente.";
      } else if (editingCatId) {
        await apiUpdateCategoria(editingCatId, {
          nombre: catNombre.trim(),
          descripcion: catDescripcion.trim() || "",
        });
        successMsg = "Categoría actualizada exitosamente.";
      }
      setCatModalVisible(false);
      fetchCategorias();
      if (successMsg) {
        dialog.alert({ title: "Éxito", message: successMsg });
      }
    } catch (err: any) {
      setCatFormError(err.message || "No se pudo guardar la categoría.");
    } finally {
      setSubmittingCat(false);
    }
  };

  const handleDeleteCategoria = async (cat: Categoria) => {
    const count = cat.muebles_count ?? 0;
    const countText =
      count === 1 ? "1 mueble asociado" : `${count} muebles asociados`;
    const message =
      count > 0
        ? `Esta categoría tiene ${countText}. Si la eliminas, esos muebles quedarán sin categoría asignada.\n\n¿Deseas continuar?`
        : `¿Estás seguro de que deseas eliminar la categoría "${cat.nombre}"?`;

    const ok = await dialog.confirm({
      title: "Eliminar Categoría",
      message,
      confirmText: "Eliminar",
      cancelText: "Cancelar",
      confirmStyle: "destructive",
    });
    if (!ok) return;

    try {
      await apiDeleteCategoria(cat.id);
      dialog.alert({ title: "Éxito", message: "Categoría eliminada." });
      fetchCategorias();
    } catch (err: any) {
      dialog.alert({
        title: "No se pudo eliminar",
        message: err.message || "Error al eliminar categoría.",
      });
    }
  };

  // ==========================================
  // ACCIONES CRUD: PROVEEDORES
  // ==========================================
  const handleOpenCreateProveedor = () => {
    setProvModalMode("create");
    setEditingProvId(null);
    setProvNombre("");
    setProvContacto("");
    setProvTelefono("");
    setProvEmail("");
    setProvFormError(null);
    setProvModalVisible(true);
  };

  const handleOpenEditProveedor = (prov: Proveedor) => {
    setProvModalMode("edit");
    setEditingProvId(prov.id);
    setProvNombre(prov.nombre);
    setProvContacto(prov.contacto || "");
    setProvTelefono(prov.telefono || "");
    setProvEmail(prov.email || "");
    setProvFormError(null);
    setProvModalVisible(true);
  };

  const handleSaveProveedor = async () => {
    setProvFormError(null);
    if (!provNombre.trim()) {
      setProvFormError("El nombre del proveedor es obligatorio.");
      return;
    }
    if (!provContacto.trim() || !provTelefono.trim()) {
      setProvFormError("La persona de contacto y el teléfono son obligatorios.");
      return;
    }

    try {
      setSubmittingProv(true);
      let successMsg = "";
      if (provModalMode === "create") {
        await apiCreateProveedor({
          nombre: provNombre.trim(),
          contacto: provContacto.trim() || undefined,
          telefono: provTelefono.trim() || undefined,
          email: provEmail.trim() || undefined,
        });
        successMsg = "Proveedor registrado exitosamente.";
      } else if (editingProvId) {
        await apiUpdateProveedor(editingProvId, {
          nombre: provNombre.trim(),
          contacto: provContacto.trim() || "",
          telefono: provTelefono.trim() || "",
          email: provEmail.trim() || "",
        });
        successMsg = "Proveedor actualizado exitosamente.";
      }
      setProvModalVisible(false);
      fetchProveedores();
      if (successMsg) {
        dialog.alert({ title: "Éxito", message: successMsg });
      }
    } catch (err: any) {
      setProvFormError(err.message || "No se pudo guardar el proveedor.");
    } finally {
      setSubmittingProv(false);
    }
  };

  const handleDeleteProveedor = async (prov: Proveedor) => {
    const count = prov.muebles_count ?? 0;
    const countText =
      count === 1 ? "1 mueble asociado" : `${count} muebles asociados`;
    const message =
      count > 0
        ? `El proveedor "${prov.nombre}" tiene ${countText}.\n\nNo se puede eliminar mientras tenga muebles en el catálogo.\n\n¿Deseas intentar eliminarlo?`
        : `¿Estás seguro de que deseas eliminar permanentemente el proveedor "${prov.nombre}"?`;

    const ok = await dialog.confirm({
      title: "Eliminar Proveedor",
      message,
      confirmText: "Eliminar",
      cancelText: "Cancelar",
      confirmStyle: "destructive",
    });
    if (!ok) return;

    try {
      await apiDeleteProveedor(prov.id);
      dialog.alert({ title: "Éxito", message: "Proveedor eliminado." });
      fetchProveedores();
    } catch (err: any) {
      dialog.alert({
        title: "No se pudo eliminar",
        message: err.message || "Error al eliminar proveedor.",
      });
    }
  };

  // Helper para formato de precios
  const formatPrice = (price: string | number) => {
    const num = typeof price === "number" ? price : parseFloat(price);
    return isNaN(num)
      ? "$0.00"
      : `$${num.toLocaleString("es-MX", { minimumFractionDigits: 2 })}`;
  };

  // ==========================================
  // RENDER CONDICIONAL: AUTH CHECK
  // ==========================================
  if (checkingAuth) {
    return <LoadingView message="Verificando permisos de administración..." />;
  }

  if (!isStaff) {
    return null; // Redirige por useEffect
  }

  // ==========================================
  // RENDER DEL CONTENIDO
  // ==========================================
  return (
    <SafeAreaView
      style={[styles.safeArea, { backgroundColor: colors.background }]}
      edges={["top", "left", "right"]}
    >
      {/* Encabezado Superior */}
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <View style={styles.headerTitleRow}>
          <View>
            <Text style={[styles.headerTitle, { color: colors.text }]}>
              Administración
            </Text>
            <Text style={[styles.headerSubtitle, { color: colors.textMuted }]}>
              Gestión centralizada de catálogo y catálogos auxiliares
            </Text>
          </View>
          <Badge label="STAFF" variant="warning" size="medium" />
        </View>

        {/* 3 Botones Principales (Selector de Módulo) */}
        <View
          style={[
            styles.moduleSelector,
            { backgroundColor: colors.card, borderColor: colors.border },
          ]}
        >
          <Pressable
            style={[
              styles.moduleButton,
              modulo === "muebles" && [
                styles.moduleButtonActive,
                { backgroundColor: colors.accent },
              ],
            ]}
            onPress={() => handleSelectModulo("muebles")}
            accessibilityRole="tab"
            accessibilityState={{ selected: modulo === "muebles" }}
            accessibilityLabel="Módulo de muebles"
          >
            <Ionicons
              name={modulo === "muebles" ? "cube" : "cube-outline"}
              size={18}
              color={modulo === "muebles" ? "#FFFFFF" : colors.text}
            />
            <Text
              style={[
                styles.moduleButtonText,
                { color: modulo === "muebles" ? "#FFFFFF" : colors.text },
              ]}
            >
              Muebles
            </Text>
          </Pressable>

          <Pressable
            style={[
              styles.moduleButton,
              modulo === "categorias" && [
                styles.moduleButtonActive,
                { backgroundColor: colors.accent },
              ],
            ]}
            onPress={() => handleSelectModulo("categorias")}
            accessibilityRole="tab"
            accessibilityState={{ selected: modulo === "categorias" }}
            accessibilityLabel="Módulo de categorías"
          >
            <Ionicons
              name={modulo === "categorias" ? "folder" : "folder-outline"}
              size={18}
              color={modulo === "categorias" ? "#FFFFFF" : colors.text}
            />
            <Text
              style={[
                styles.moduleButtonText,
                { color: modulo === "categorias" ? "#FFFFFF" : colors.text },
              ]}
            >
              Categorías
            </Text>
          </Pressable>

          <Pressable
            style={[
              styles.moduleButton,
              modulo === "proveedores" && [
                styles.moduleButtonActive,
                { backgroundColor: colors.accent },
              ],
            ]}
            onPress={() => handleSelectModulo("proveedores")}
            accessibilityRole="tab"
            accessibilityState={{ selected: modulo === "proveedores" }}
            accessibilityLabel="Módulo de proveedores"
          >
            <Ionicons
              name={modulo === "proveedores" ? "business" : "business-outline"}
              size={18}
              color={modulo === "proveedores" ? "#FFFFFF" : colors.text}
            />
            <Text
              style={[
                styles.moduleButtonText,
                { color: modulo === "proveedores" ? "#FFFFFF" : colors.text },
              ]}
            >
              Proveedores
            </Text>
          </Pressable>
        </View>
      </View>

      {/* Vista de Error si falló alguna petición */}
      {errorMsg ? (
        <View style={{ padding: 16 }}>
          <ErrorView
            message={errorMsg}
            onRetry={() => {
              if (modulo === "muebles") fetchMuebles(mueblesPage);
              if (modulo === "categorias") fetchCategorias();
              if (modulo === "proveedores") fetchProveedores();
            }}
          />
        </View>
      ) : null}

      {/* ======================================================== */}
      {/* VISTA 1: MÓDULO MUEBLES                                   */}
      {/* ======================================================== */}
      {modulo === "muebles" && (
        <View style={styles.contentContainer}>
          {/* Barra de Acciones y Búsqueda */}
          <View style={styles.actionsBar}>
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
                value={mueblesSearch}
                onChangeText={setMueblesSearch}
                onSubmitEditing={() => fetchMuebles(1)}
                returnKeyType="search"
              />
              {mueblesSearch ? (
                <Pressable
                  onPress={() => {
                    setMueblesSearch("");
                    fetchMuebles(1);
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
              onPress={() => router.push("/(app)/mueble/form")}
              accessibilityRole="button"
              accessibilityLabel="Nuevo mueble"
              accessibilityHint="Abre el formulario para registrar un nuevo mueble"
            >
              <Ionicons name="add" size={18} color="#FFFFFF" />
              <Text style={styles.createButtonText}>Nuevo</Text>
            </Pressable>
          </View>

          {/* Contador de Muebles */}
          <View style={styles.countRow}>
            <Text style={[styles.countText, { color: colors.textMuted }]}>
              {mueblesTotalCount}{" "}
              {mueblesTotalCount === 1
                ? "mueble encontrado"
                : "muebles encontrados"}
            </Text>
          </View>

          {loadingMuebles && !refreshingMuebles ? (
            <LoadingView message="Cargando muebles..." />
          ) : (
            <FlatList
              data={muebles}
              keyExtractor={(item) => item.id.toString()}
              contentContainerStyle={styles.listContent}
              refreshControl={
                <RefreshControl
                  refreshing={refreshingMuebles}
                  onRefresh={() => {
                    setRefreshingMuebles(true);
                    fetchMuebles(1, true);
                  }}
                  colors={[colors.accent]}
                  tintColor={colors.accent}
                />
              }
              ListEmptyComponent={
                <EmptyView
                  title="No se encontraron muebles"
                  description={
                    mueblesSearch
                      ? "Intenta con otro término de búsqueda."
                      : "Aún no hay muebles registrados en el catálogo."
                  }
                  actionLabel="+ Crear primer mueble"
                  onAction={() => router.push("/(app)/mueble/form")}
                />
              }
              renderItem={({ item }) => {
                const imgUri = mueblesImages[item.id];
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
                      style={styles.muebleItemMain}
                      onPress={() => router.push(`/(app)/mueble/${item.id}`)}
                    >
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
                            contentFit="cover"
                          />
                        ) : (
                          <Ionicons
                            name="image-outline"
                            size={26}
                            color={colors.textMuted}
                          />
                        )}
                      </View>

                      <View style={styles.muebleItemInfo}>
                        <Text
                          style={[
                            styles.muebleItemTitle,
                            { color: colors.text },
                          ]}
                          numberOfLines={1}
                        >
                          {item.nombre}
                        </Text>
                        <Text
                          style={[
                            styles.muebleItemCategory,
                            { color: colors.textMuted },
                          ]}
                          numberOfLines={1}
                        >
                          {item.categoria?.nombre || "Sin categoría"} •{" "}
                          {item.proveedor?.nombre || "Proveedor"}
                        </Text>
                        <View style={styles.muebleItemPriceRow}>
                          <Text
                            style={[
                              styles.muebleItemPrice,
                              { color: colors.accent },
                            ]}
                          >
                            {formatPrice(item.precio)}
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

                    {/* Acciones Editar y Eliminar */}
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
                          router.push(`/(app)/mueble/form?id=${item.id}`)
                        }
                        accessibilityRole="button"
                        accessibilityLabel={`Editar mueble ${item.nombre}`}
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
                        onPress={() => handleDeleteMueble(item)}
                        accessibilityRole="button"
                        accessibilityLabel={`Eliminar mueble ${item.nombre}`}
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
                  page={mueblesPage}
                  totalPages={mueblesTotalPages}
                  onPageChange={(p) => fetchMuebles(p)}
                />
              }
            />
          )}
        </View>
      )}

      {/* ======================================================== */}
      {/* VISTA 2: MÓDULO CATEGORÍAS                                */}
      {/* ======================================================== */}
      {modulo === "categorias" && (
        <View style={styles.contentContainer}>
          <View style={styles.actionsBar}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.countText, { color: colors.textMuted }]}>
                {categorias.length}{" "}
                {categorias.length === 1
                  ? "categoría registrada"
                  : "categorías registradas"}
              </Text>
            </View>

            <Pressable
              style={[styles.createButton, { backgroundColor: colors.accent }]}
              onPress={handleOpenCreateCategoria}
              accessibilityRole="button"
              accessibilityLabel="Nueva categoría"
            >
              <Ionicons name="add" size={18} color="#FFFFFF" />
              <Text style={styles.createButtonText}>Nueva</Text>
            </Pressable>
          </View>

          {loadingCategorias && !refreshingCategorias ? (
            <LoadingView message="Cargando categorías..." />
          ) : (
            <FlatList
              data={categorias}
              keyExtractor={(item) => item.id.toString()}
              contentContainerStyle={styles.listContent}
              refreshControl={
                <RefreshControl
                  refreshing={refreshingCategorias}
                  onRefresh={() => {
                    setRefreshingCategorias(true);
                    fetchCategorias(true);
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
                  onAction={handleOpenCreateCategoria}
                />
              }
              renderItem={({ item }) => {
                const count = item.muebles_count ?? 0;
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
                    <View style={styles.catProvHeader}>
                      <View style={{ flex: 1, marginRight: 8 }}>
                        <Text
                          style={[styles.cardItemTitle, { color: colors.text }]}
                        >
                          {item.nombre}
                        </Text>
                        {item.descripcion ? (
                          <Text
                            style={[
                              styles.cardItemDesc,
                              { color: colors.textMuted },
                            ]}
                          >
                            {item.descripcion}
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

                    {/* Acciones Editar y Eliminar */}
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
                        onPress={() => handleOpenEditCategoria(item)}
                        accessibilityRole="button"
                        accessibilityLabel={`Editar categoría ${item.nombre}`}
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
                        onPress={() => handleDeleteCategoria(item)}
                        accessibilityRole="button"
                        accessibilityLabel={`Eliminar categoría ${item.nombre}`}
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
      {/* VISTA 3: MÓDULO PROVEEDORES                               */}
      {/* ======================================================== */}
      {modulo === "proveedores" && (
        <View style={styles.contentContainer}>
          <View style={styles.actionsBar}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.countText, { color: colors.textMuted }]}>
                {proveedores.length}{" "}
                {proveedores.length === 1
                  ? "proveedor registrado"
                  : "proveedores registrados"}
              </Text>
            </View>

            <Pressable
              style={[styles.createButton, { backgroundColor: colors.accent }]}
              onPress={handleOpenCreateProveedor}
              accessibilityRole="button"
              accessibilityLabel="Nuevo proveedor"
            >
              <Ionicons name="add" size={18} color="#FFFFFF" />
              <Text style={styles.createButtonText}>Nuevo</Text>
            </Pressable>
          </View>

          {loadingProveedores && !refreshingProveedores ? (
            <LoadingView message="Cargando proveedores..." />
          ) : (
            <FlatList
              data={proveedores}
              keyExtractor={(item) => item.id.toString()}
              contentContainerStyle={styles.listContent}
              refreshControl={
                <RefreshControl
                  refreshing={refreshingProveedores}
                  onRefresh={() => {
                    setRefreshingProveedores(true);
                    fetchProveedores(true);
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
                  onAction={handleOpenCreateProveedor}
                />
              }
              renderItem={({ item }) => {
                const count = item.muebles_count ?? 0;
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
                    <View style={styles.catProvHeader}>
                      <View style={{ flex: 1, marginRight: 8 }}>
                        <Text
                          style={[styles.cardItemTitle, { color: colors.text }]}
                        >
                          {item.nombre}
                        </Text>

                        {/* Datos de contacto */}
                        {item.contacto ? (
                          <View style={styles.provInfoRow}>
                            <Ionicons
                              name="person-outline"
                              size={14}
                              color={colors.textMuted}
                            />
                            <Text
                              style={[
                                styles.provInfoText,
                                { color: colors.textMuted },
                              ]}
                            >
                              {item.contacto}
                            </Text>
                          </View>
                        ) : null}

                        {item.telefono ? (
                          <View style={styles.provInfoRow}>
                            <Ionicons
                              name="call-outline"
                              size={14}
                              color={colors.textMuted}
                            />
                            <Text
                              style={[
                                styles.provInfoText,
                                { color: colors.textMuted },
                              ]}
                            >
                              {item.telefono}
                            </Text>
                          </View>
                        ) : null}

                        {item.email ? (
                          <View style={styles.provInfoRow}>
                            <Ionicons
                              name="mail-outline"
                              size={14}
                              color={colors.textMuted}
                            />
                            <Text
                              style={[
                                styles.provInfoText,
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

                    {/* Acciones Editar y Eliminar */}
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
                        onPress={() => handleOpenEditProveedor(item)}
                        accessibilityRole="button"
                        accessibilityLabel={`Editar proveedor ${item.nombre}`}
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
                        onPress={() => handleDeleteProveedor(item)}
                        accessibilityRole="button"
                        accessibilityLabel={`Eliminar proveedor ${item.nombre}`}
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
      {/* MODAL: FORMULARIO DE CATEGORÍA                           */}
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
                value={catNombre}
                onChangeText={setCatNombre}
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
                value={catDescripcion}
                onChangeText={setCatDescripcion}
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
                onPress={handleSaveCategoria}
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
      {/* MODAL: FORMULARIO DE PROVEEDOR                           */}
      {/* ======================================================== */}
      <Modal
        visible={provModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setProvModalVisible(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={styles.modalBackdrop}
        >
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={() => setProvModalVisible(false)}
            accessibilityRole="button"
            accessibilityLabel="Cerrar modal de proveedor"
          />
          <View
            style={[
              styles.modalContent,
              { backgroundColor: colors.card, borderColor: colors.border },
            ]}
            onStartShouldSetResponder={() => true}
          >
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitleText, { color: colors.text }]}>
                {provModalMode === "create"
                  ? "Nuevo Proveedor"
                  : "Editar Proveedor"}
              </Text>
              <Pressable
                onPress={() => setProvModalVisible(false)}
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
              {provFormError ? (
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
                    {provFormError}
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
                value={provNombre}
                onChangeText={setProvNombre}
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
                value={provContacto}
                onChangeText={setProvContacto}
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
                value={provTelefono}
                onChangeText={setProvTelefono}
                keyboardType="phone-pad"
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
                value={provEmail}
                onChangeText={setProvEmail}
                keyboardType="email-address"
                autoCapitalize="none"
              />

              <Pressable
                style={[
                  styles.confirmButton,
                  {
                    backgroundColor: colors.accent,
                    opacity: submittingProv ? 0.7 : 1,
                  },
                ]}
                onPress={handleSaveProveedor}
                disabled={submittingProv}
                accessibilityRole="button"
                accessibilityLabel={
                  provModalMode === "create"
                    ? "Registrar proveedor"
                    : "Guardar cambios de proveedor"
                }
              >
                {submittingProv ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.confirmButtonText}>
                    {provModalMode === "create"
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
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 14,
    borderBottomWidth: 1,
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
  muebleItemMain: {
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
  muebleItemInfo: {
    flex: 1,
  },
  muebleItemTitle: {
    fontSize: 15,
    fontWeight: "700",
    marginBottom: 2,
  },
  muebleItemCategory: {
    fontSize: 12,
    marginBottom: 6,
  },
  muebleItemPriceRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  muebleItemPrice: {
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
  catProvHeader: {
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
  provInfoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 4,
  },
  provInfoText: {
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
