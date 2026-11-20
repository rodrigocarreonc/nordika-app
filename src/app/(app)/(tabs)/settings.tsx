import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
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
import { Badge } from "../../../components/Badge";
import { Colors } from "../../../constants/theme";
import { dialog } from "../../../context/DialogContext";
import { User } from "../../../types";
import {
  apiCrearCliente,
  apiGetMe,
  apiLogout,
  apiUpdateMe,
} from "../../../utils/api";
import {
  getStoredPageSize,
  getStoredTheme,
  saveStoredPageSize,
  saveStoredTheme,
} from "../../../utils/settingsStorage";
import { applyTheme } from "../../../utils/theme";
import { getUser, saveUser } from "../../../utils/tokenStorage";

export default function SettingsScreen() {
  const router = useRouter();
  const scheme = useColorScheme() ?? "light";
  const colors = Colors[scheme];

  // Datos del usuario
  const [user, setUser] = useState<Partial<User> | null>(null);
  const [loadingUser, setLoadingUser] = useState(true);

  // Ajustes de la app
  const [themePreference, setThemePreference] = useState<
    "light" | "dark" | "system"
  >("system");
  const [pageSize, setPageSize] = useState<number>(10);
  // Modal para editar perfil
  const [showEditProfileModal, setShowEditProfileModal] = useState(false);
  const [editFirstName, setEditFirstName] = useState("");
  const [editLastName, setEditLastName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [updatingProfile, setUpdatingProfile] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);

  // Modal para agregar nuevo cliente (Solo Admin)
  const [showAddClientModal, setShowAddClientModal] = useState(false);
  const [clientUsername, setClientUsername] = useState("");
  const [clientEmail, setClientEmail] = useState("");
  const [clientPassword, setClientPassword] = useState("");
  const [clientPasswordConfirm, setClientPasswordConfirm] = useState("");
  const [showClientPassword, setShowClientPassword] = useState(false);
  const [clientFirstName, setClientFirstName] = useState("");
  const [clientLastName, setClientLastName] = useState("");
  const [creatingClient, setCreatingClient] = useState(false);
  const [clientError, setClientError] = useState<string | null>(null);

  useEffect(() => {
    // Cargar perfil
    getUser().then((u) => {
      if (u) {
        setUser(u);
        setEditFirstName(u.first_name || "");
        setEditLastName(u.last_name || "");
        setEditEmail(u.email || "");
      }
    });

    apiGetMe()
      .then((fullUser) => {
        setUser(fullUser);
        setEditFirstName(fullUser.first_name || "");
        setEditLastName(fullUser.last_name || "");
        setEditEmail(fullUser.email || "");
        saveUser(fullUser);
      })
      .catch(() => {})
      .finally(() => setLoadingUser(false));

    // Cargar ajustes guardados
    getStoredTheme().then(setThemePreference);
    getStoredPageSize().then(setPageSize);
  }, []);

  const handleSelectPageSize = async (size: number) => {
    setPageSize(size);
    await saveStoredPageSize(size);
  };

  const handleSelectTheme = async (theme: "light" | "dark" | "system") => {
    setThemePreference(theme);
    await saveStoredTheme(theme);
    applyTheme(theme);
  };

  const handleSaveProfile = async () => {
    setProfileError(null);
    try {
      setUpdatingProfile(true);
      const updated = await apiUpdateMe({
        first_name: editFirstName.trim(),
        last_name: editLastName.trim(),
        email: editEmail.trim(),
      });
      setUser(updated);
      await saveUser(updated);
      setShowEditProfileModal(false);
      dialog.alert({
        title: "Éxito",
        message: "Tu información de perfil ha sido actualizada.",
      });
    } catch (e: any) {
      setProfileError(e.message || "No se pudo actualizar el perfil.");
    } finally {
      setUpdatingProfile(false);
    }
  };

  const handleCreateClient = async () => {
    setClientError(null);
    const trimmedUsername = clientUsername.trim();
    const trimmedEmail = clientEmail.trim();
    if (!trimmedUsername) {
      setClientError("El nombre de usuario es obligatorio.");
      return;
    }
    if (!trimmedEmail) {
      setClientError("El correo electrónico es obligatorio.");
      return;
    }
    if (!clientPassword || clientPassword.length < 6) {
      setClientError("La contraseña debe tener al menos 6 caracteres.");
      return;
    }
    if (clientPassword !== clientPasswordConfirm) {
      setClientError("Las contraseñas no coinciden.");
      return;
    }

    try {
      setCreatingClient(true);
      await apiCrearCliente({
        username: trimmedUsername,
        email: trimmedEmail,
        password: clientPassword,
        password_confirm: clientPasswordConfirm,
        first_name: clientFirstName.trim(),
        last_name: clientLastName.trim(),
      });
      setShowAddClientModal(false);
      setClientUsername("");
      setClientEmail("");
      setClientPassword("");
      setClientPasswordConfirm("");
      setClientFirstName("");
      setClientLastName("");
      dialog.alert({
        title: "Éxito",
        message: "Cliente registrado exitosamente.",
      });
    } catch (e: any) {
      setClientError(e.message || "No se pudo crear el cliente.");
    } finally {
      setCreatingClient(false);
    }
  };

  const handleLogout = async () => {
    const ok = await dialog.confirm({
      title: "Cerrar Sesión",
      message: "¿Estás seguro de que deseas salir de tu cuenta?",
      confirmText: "Cerrar Sesión",
      cancelText: "Cancelar",
      confirmStyle: "destructive",
    });
    if (!ok) return;

    await apiLogout();
    router.replace("/(auth)/login");
  };

  return (
    <SafeAreaView
      style={[styles.safeArea, { backgroundColor: colors.background }]}
      edges={["top", "left", "right"]}
    >
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <Text style={[styles.headerTitle, { color: colors.text }]}>
          Ajustes & Perfil
        </Text>
        <Text style={[styles.headerSubtitle, { color: colors.textMuted }]}>
          Configuración general de Nordika
        </Text>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Tarjeta de Perfil */}
        <View
          style={[
            styles.card,
            { backgroundColor: colors.card, borderColor: colors.border },
          ]}
        >
          <View style={styles.profileRow}>
            <View
              style={[styles.avatarCircle, { backgroundColor: colors.primary }]}
            >
              <Text style={[styles.avatarInitial, { color: colors.onPrimary }]}>
                {(
                  user?.first_name?.[0] ||
                  user?.username?.[0] ||
                  "U"
                ).toUpperCase()}
              </Text>
            </View>

            <View style={styles.profileInfo}>
              <View style={styles.nameRow}>
                <Text style={[styles.profileName, { color: colors.text }]}>
                  {user?.first_name
                    ? `${user.first_name} ${user.last_name || ""}`
                    : user?.username || "Usuario"}
                </Text>
                {user?.is_staff ? (
                  <Badge label="Admin" variant="warning" size="small" />
                ) : (
                  <Badge label="Cliente" variant="neutral" size="small" />
                )}
              </View>

              <Text
                style={[styles.profileUsername, { color: colors.textMuted }]}
              >
                @{user?.username}
              </Text>
              <Text style={[styles.profileEmail, { color: colors.textMuted }]}>
                {user?.email}
              </Text>
            </View>
          </View>

          <Pressable
            style={[styles.editProfileButton, { borderColor: colors.border }]}
            onPress={() => {
              setProfileError(null);
              setShowEditProfileModal(true);
            }}
            accessibilityRole="button"
            accessibilityLabel="Editar perfil"
            accessibilityHint="Abre el formulario para modificar nombre, apellido o correo"
          >
            <Ionicons
              name="pencil-outline"
              size={16}
              color={colors.text}
              style={{ marginRight: 6 }}
            />
            <Text
              style={[styles.editProfileButtonText, { color: colors.text }]}
            >
              Editar Perfil
            </Text>
          </Pressable>
        </View>

        {/* Sección: Paginación Configurable */}
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionHeaderText, { color: colors.textMuted }]}>
            PAGINACIÓN CONFIGURABLE
          </Text>
        </View>

        <View
          style={[
            styles.card,
            { backgroundColor: colors.card, borderColor: colors.border },
          ]}
        >
          <Text style={[styles.cardTitle, { color: colors.text }]}>
            Elementos por página
          </Text>
          <Text style={[styles.cardSubtitle, { color: colors.textMuted }]}>
            Cantidad de muebles mostrados por página en el catálogo, favoritos y
            apartados
          </Text>

          <View style={styles.optionsRow}>
            {[5, 10, 15, 20].map((size) => {
              const isSelected = pageSize === size;
              return (
                <Pressable
                  key={size}
                  style={[
                    styles.sizeChip,
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
                  onPress={() => handleSelectPageSize(size)}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: isSelected }}
                  accessibilityLabel={`${size} elementos por página`}
                >
                  <Text
                    style={[
                      styles.sizeChipText,
                      isSelected
                        ? { color: "#FFFFFF" }
                        : { color: colors.text },
                    ]}
                  >
                    {size}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* Sección: Tema Visual */}
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionHeaderText, { color: colors.textMuted }]}>
            APARIENCIA
          </Text>
        </View>

        <View
          style={[
            styles.card,
            { backgroundColor: colors.card, borderColor: colors.border },
          ]}
        >
          <Text style={[styles.cardTitle, { color: colors.text }]}>
            Modo de Tema
          </Text>
          <View style={styles.optionsRow}>
            {(["light", "dark", "system"] as const).map((t) => {
              const isSelected = themePreference === t;
              const labels = {
                light: "Claro",
                dark: "Oscuro",
                system: "Sistema",
              };
              return (
                <Pressable
                  key={t}
                  style={[
                    styles.themeChip,
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
                  onPress={() => handleSelectTheme(t)}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: isSelected }}
                  accessibilityLabel={`Tema ${labels[t]}`}
                >
                  <Text
                    style={[
                      styles.themeChipText,
                      isSelected
                        ? { color: colors.onPrimary }
                        : { color: colors.text },
                    ]}
                  >
                    {labels[t]}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* Sección: Administración (Solo Staff) */}
        {user?.is_staff ? (
          <>
            <View style={styles.sectionHeader}>
              <Text
                style={[styles.sectionHeaderText, { color: colors.textMuted }]}
              >
                ADMINISTRACIÓN
              </Text>
            </View>

            <View
              style={[
                styles.card,
                { backgroundColor: colors.card, borderColor: colors.border },
              ]}
            >
              <Text style={[styles.cardTitle, { color: colors.text }]}>
                Gestión de Clientes
              </Text>
              <Text style={[styles.cardSubtitle, { color: colors.textMuted }]}>
                Registra nuevos clientes en el sistema Nordika
              </Text>

              <Pressable
                style={[
                  styles.addClientButton,
                  { backgroundColor: colors.accent },
                ]}
                onPress={() => {
                  setClientError(null);
                  setShowClientPassword(false);
                  setShowAddClientModal(true);
                }}
                accessibilityRole="button"
                accessibilityLabel="Agregar nuevo cliente"
                accessibilityHint="Abre el formulario para registrar un nuevo cliente"
              >
                <Ionicons
                  name="person-add-outline"
                  size={18}
                  color="#FFFFFF"
                  style={{ marginRight: 8 }}
                />
                <Text style={styles.addClientButtonText}>
                  Agregar Nuevo Cliente
                </Text>
              </Pressable>
            </View>
          </>
        ) : null}

        {/* Botón de Logout */}
        <Pressable
          style={[
            styles.logoutButton,
            {
              backgroundColor: `${colors.danger}15`,
              borderColor: `${colors.danger}30`,
            },
          ]}
          onPress={handleLogout}
          accessibilityRole="button"
          accessibilityLabel="Cerrar sesión"
          accessibilityHint="Cierra tu sesión actual y regresa a la pantalla de inicio de sesión"
        >
          <Ionicons
            name="log-out-outline"
            size={20}
            color={colors.danger}
            style={{ marginRight: 8 }}
          />
          <Text style={[styles.logoutButtonText, { color: colors.danger }]}>
            Cerrar Sesión
          </Text>
        </Pressable>
      </ScrollView>

      {/* Modal para Editar Perfil (se cierra al hacer clic fuera) */}
      <Modal
        visible={showEditProfileModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowEditProfileModal(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={styles.modalBackdrop}
        >
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={() => setShowEditProfileModal(false)}
            accessibilityLabel="Cerrar ventana emergente"
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
                Editar Perfil
              </Text>
              <Pressable
                onPress={() => setShowEditProfileModal(false)}
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
              {profileError ? (
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
                    {profileError}
                  </Text>
                </View>
              ) : null}

              <Text style={[styles.inputLabel, { color: colors.text }]}>
                Nombre
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
                value={editFirstName}
                onChangeText={setEditFirstName}
                placeholder="Tu nombre"
                placeholderTextColor={colors.textMuted}
              />

              <Text
                style={[
                  styles.inputLabel,
                  { color: colors.text, marginTop: 12 },
                ]}
              >
                Apellido
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
                value={editLastName}
                onChangeText={setEditLastName}
                placeholder="Tu apellido"
                placeholderTextColor={colors.textMuted}
              />

              <Text
                style={[
                  styles.inputLabel,
                  { color: colors.text, marginTop: 12 },
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
                value={editEmail}
                onChangeText={setEditEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                placeholder="correo@ejemplo.com"
                placeholderTextColor={colors.textMuted}
              />

              <Pressable
                style={[
                  styles.confirmButton,
                  { backgroundColor: colors.accent },
                ]}
                onPress={handleSaveProfile}
                disabled={updatingProfile}
                accessibilityRole="button"
                accessibilityLabel="Guardar cambios de perfil"
              >
                {updatingProfile ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.confirmButtonText}>Guardar Cambios</Text>
                )}
              </Pressable>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Modal para Agregar Nuevo Cliente (se cierra al hacer clic fuera) */}
      <Modal
        visible={showAddClientModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowAddClientModal(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={styles.modalBackdrop}
        >
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={() => setShowAddClientModal(false)}
            accessibilityLabel="Cerrar ventana emergente"
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
                Registrar Nuevo Cliente
              </Text>
              <Pressable
                onPress={() => setShowAddClientModal(false)}
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
              {clientError ? (
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
                    {clientError}
                  </Text>
                </View>
              ) : null}

              <View style={{ flexDirection: "row", gap: 10 }}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.inputLabel, { color: colors.text }]}>
                    Nombre
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
                    value={clientFirstName}
                    onChangeText={setClientFirstName}
                    placeholder="Nombre"
                    placeholderTextColor={colors.textMuted}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.inputLabel, { color: colors.text }]}>
                    Apellido
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
                    value={clientLastName}
                    onChangeText={setClientLastName}
                    placeholder="Apellido"
                    placeholderTextColor={colors.textMuted}
                  />
                </View>
              </View>

              <Text
                style={[
                  styles.inputLabel,
                  { color: colors.text, marginTop: 10 },
                ]}
              >
                Nombre de Usuario *
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
                value={clientUsername}
                onChangeText={setClientUsername}
                placeholder="Ej. cliente123"
                placeholderTextColor={colors.textMuted}
                autoCapitalize="none"
              />

              <Text
                style={[
                  styles.inputLabel,
                  { color: colors.text, marginTop: 10 },
                ]}
              >
                Correo Electrónico *
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
                value={clientEmail}
                onChangeText={setClientEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                placeholder="cliente@nordika.com"
                placeholderTextColor={colors.textMuted}
              />

              <Text
                style={[
                  styles.inputLabel,
                  { color: colors.text, marginTop: 10 },
                ]}
              >
                Contraseña (mínimo 6 caracteres) *
              </Text>
              <View
                style={[
                  styles.modalInput,
                  styles.passwordWrapper,
                  {
                    backgroundColor: colors.background,
                    borderColor: colors.border,
                  },
                ]}
              >
                <TextInput
                  style={[styles.passwordInput, { color: colors.text }]}
                  value={clientPassword}
                  onChangeText={setClientPassword}
                  secureTextEntry={!showClientPassword}
                  autoCapitalize="none"
                  autoCorrect={false}
                  placeholder="Contraseña"
                  placeholderTextColor={colors.textMuted}
                />
                <Pressable
                  onPress={() => setShowClientPassword((v) => !v)}
                  hitSlop={8}
                  accessibilityRole="button"
                  accessibilityLabel={
                    showClientPassword
                      ? "Ocultar contraseñas"
                      : "Ver contraseñas"
                  }
                >
                  <Ionicons
                    name={
                      showClientPassword ? "eye-off-outline" : "eye-outline"
                    }
                    size={18}
                    color={colors.textMuted}
                  />
                </Pressable>
              </View>

              <Text
                style={[
                  styles.inputLabel,
                  { color: colors.text, marginTop: 10 },
                ]}
              >
                Confirmar contraseña *
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
                value={clientPasswordConfirm}
                onChangeText={setClientPasswordConfirm}
                secureTextEntry={!showClientPassword}
                autoCapitalize="none"
                autoCorrect={false}
                placeholder="Repite la contraseña"
                placeholderTextColor={colors.textMuted}
              />

              <Pressable
                style={[
                  styles.confirmButton,
                  { backgroundColor: colors.accent, marginTop: 16 },
                ]}
                onPress={handleCreateClient}
                disabled={creatingClient}
                accessibilityRole="button"
                accessibilityLabel="Registrar nuevo cliente"
              >
                {creatingClient ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.confirmButtonText}>
                    Registrar Cliente
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
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: "800",
  },
  headerSubtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  scrollContent: {
    padding: 18,
    paddingBottom: 40,
  },
  card: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 18,
    marginBottom: 16,
  },
  profileRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
  },
  avatarCircle: {
    width: 58,
    height: 58,
    borderRadius: 29,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 14,
  },
  avatarInitial: {
    fontSize: 24,
    fontWeight: "800",
  },
  profileInfo: {
    flex: 1,
  },
  nameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 2,
  },
  profileName: {
    fontSize: 17,
    fontWeight: "800",
  },
  profileUsername: {
    fontSize: 13,
  },
  profileEmail: {
    fontSize: 12,
    marginTop: 2,
  },
  editProfileButton: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 9,
    borderRadius: 10,
    borderWidth: 1,
  },
  editProfileButtonText: {
    fontSize: 13,
    fontWeight: "600",
  },
  sectionHeader: {
    marginTop: 8,
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  sectionHeaderText: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.8,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: "700",
    marginBottom: 2,
  },
  cardSubtitle: {
    fontSize: 12,
    marginBottom: 12,
  },
  optionsRow: {
    flexDirection: "row",
    gap: 10,
  },
  sizeChip: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: "center",
  },
  sizeChipText: {
    fontSize: 14,
    fontWeight: "700",
  },
  themeChip: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: "center",
  },
  themeChipText: {
    fontSize: 13,
    fontWeight: "600",
  },
  logoutButton: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    height: 48,
    borderRadius: 12,
    borderWidth: 1,
    marginTop: 8,
  },
  logoutButtonText: {
    fontSize: 15,
    fontWeight: "700",
  },
  modalBackdrop: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: "100%",
    height: "100%",
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
    zIndex: 9999,
  },
  modalContent: {
    width: "100%",
    maxWidth: 460,
    maxHeight: "90%",
    borderRadius: 20,
    borderWidth: 1,
    padding: 24,
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
  passwordWrapper: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  passwordInput: {
    flex: 1,
    height: "100%",
    fontSize: 14,
  },
  confirmButton: {
    height: 48,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 20,
  },
  confirmButtonText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "700",
  },
  addClientButton: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    height: 44,
    borderRadius: 10,
    marginTop: 8,
  },
  addClientButtonText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "700",
  },
});
