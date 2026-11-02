import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
  useColorScheme,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Badge } from '../../components/Badge';
import { Colors } from '../../constants/theme';
import { User } from '../../types';
import { apiGetMe, apiLogout, apiUpdateMe } from '../../utils/api';
import {
  DEFAULT_API_URL,
  getStoredApiUrl,
  getStoredPageSize,
  getStoredTheme,
  saveStoredApiUrl,
  saveStoredPageSize,
  saveStoredTheme,
} from '../../utils/settingsStorage';
import { getUser, saveUser } from '../../utils/tokenStorage';

export default function SettingsScreen() {
  const router = useRouter();
  const scheme = useColorScheme() ?? 'light';
  const colors = Colors[scheme];

  // Datos del usuario
  const [user, setUser] = useState<Partial<User> | null>(null);
  const [loadingUser, setLoadingUser] = useState(true);

  // Ajustes de la app
  const [themePreference, setThemePreference] = useState<'light' | 'dark' | 'system'>('system');
  const [pageSize, setPageSize] = useState<number>(10);
  const [apiUrl, setApiUrl] = useState<string>(DEFAULT_API_URL);
  const [pingStatus, setPingStatus] = useState<string | null>(null);
  const [testingPing, setTestingPing] = useState<boolean>(false);

  // Modal para editar perfil
  const [showEditProfileModal, setShowEditProfileModal] = useState(false);
  const [editFirstName, setEditFirstName] = useState('');
  const [editLastName, setEditLastName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [updatingProfile, setUpdatingProfile] = useState(false);

  useEffect(() => {
    // Cargar perfil
    getUser().then((u) => {
      if (u) {
        setUser(u);
        setEditFirstName(u.first_name || '');
        setEditLastName(u.last_name || '');
        setEditEmail(u.email || '');
      }
    });

    apiGetMe()
      .then((fullUser) => {
        setUser(fullUser);
        setEditFirstName(fullUser.first_name || '');
        setEditLastName(fullUser.last_name || '');
        setEditEmail(fullUser.email || '');
        saveUser(fullUser);
      })
      .catch(() => {})
      .finally(() => setLoadingUser(false));

    // Cargar ajustes guardados
    getStoredTheme().then(setThemePreference);
    getStoredPageSize().then(setPageSize);
    getStoredApiUrl().then(setApiUrl);
  }, []);

  const handleSelectPageSize = async (size: number) => {
    setPageSize(size);
    await saveStoredPageSize(size);
  };

  const handleSelectTheme = async (theme: 'light' | 'dark' | 'system') => {
    setThemePreference(theme);
    await saveStoredTheme(theme);
  };

  const handleSaveApiUrl = async (newUrl: string) => {
    setApiUrl(newUrl);
    await saveStoredApiUrl(newUrl);
    setPingStatus(null);
  };

  const handleTestConnection = async () => {
    setTestingPing(true);
    setPingStatus(null);
    try {
      const start = Date.now();
      const res = await fetch(`${apiUrl}/muebles/?page_size=1`, {
        method: 'GET',
        headers: { Accept: 'application/json' },
      });
      const elapsed = Date.now() - start;
      if (res.ok) {
        setPingStatus(`✅ Conectado exitosamente (${elapsed} ms)`);
      } else {
        setPingStatus(`⚠️ Servidor respondió con código ${res.status}`);
      }
    } catch (e: any) {
      setPingStatus(`❌ No se pudo conectar: ${e.message}`);
    } finally {
      setTestingPing(false);
    }
  };

  const handleSaveProfile = async () => {
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
      Alert.alert('Éxito', 'Tu información de perfil ha sido actualizada.');
    } catch (e: any) {
      Alert.alert('Error', e.message || 'No se pudo actualizar el perfil.');
    } finally {
      setUpdatingProfile(false);
    }
  };

  const handleLogout = () => {
    Alert.alert(
      'Cerrar Sesión',
      '¿Estás seguro de que deseas salir de tu cuenta?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Cerrar Sesión',
          style: 'destructive',
          onPress: async () => {
            await apiLogout();
            router.replace('/(auth)/login');
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]} edges={['top', 'left', 'right']}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Ajustes & Perfil</Text>
        <Text style={[styles.headerSubtitle, { color: colors.textMuted }]}>
          Configuración general de Nordika
        </Text>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Tarjeta de Perfil */}
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.profileRow}>
            <View style={[styles.avatarCircle, { backgroundColor: colors.primary }]}>
              <Text style={styles.avatarInitial}>
                {(user?.first_name?.[0] || user?.username?.[0] || 'U').toUpperCase()}
              </Text>
            </View>

            <View style={styles.profileInfo}>
              <View style={styles.nameRow}>
                <Text style={[styles.profileName, { color: colors.text }]}>
                  {user?.first_name ? `${user.first_name} ${user.last_name || ''}` : user?.username || 'Usuario'}
                </Text>
                {user?.is_staff ? (
                  <Badge label="Admin" variant="warning" size="small" />
                ) : (
                  <Badge label="Cliente" variant="neutral" size="small" />
                )}
              </View>

              <Text style={[styles.profileUsername, { color: colors.textMuted }]}>
                @{user?.username}
              </Text>
              <Text style={[styles.profileEmail, { color: colors.textMuted }]}>
                {user?.email}
              </Text>
            </View>
          </View>

          <Pressable
            style={[styles.editProfileButton, { borderColor: colors.border }]}
            onPress={() => setShowEditProfileModal(true)}
          >
            <Ionicons name="pencil-outline" size={16} color={colors.text} style={{ marginRight: 6 }} />
            <Text style={[styles.editProfileButtonText, { color: colors.text }]}>Editar Perfil</Text>
          </Pressable>
        </View>

        {/* Sección: Paginación Configurable */}
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionHeaderText, { color: colors.textMuted }]}>
            PAGINACIÓN CONFIGURABLE
          </Text>
        </View>

        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.cardTitle, { color: colors.text }]}>Elementos por página</Text>
          <Text style={[styles.cardSubtitle, { color: colors.textMuted }]}>
            Cantidad de muebles mostrados por página en el catálogo
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
                      ? { backgroundColor: colors.accent, borderColor: colors.accent }
                      : { backgroundColor: colors.background, borderColor: colors.border },
                  ]}
                  onPress={() => handleSelectPageSize(size)}
                >
                  <Text
                    style={[
                      styles.sizeChipText,
                      isSelected ? { color: '#FFFFFF' } : { color: colors.text },
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

        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.cardTitle, { color: colors.text }]}>Modo de Tema</Text>
          <View style={styles.optionsRow}>
            {(['light', 'dark', 'system'] as const).map((t) => {
              const isSelected = themePreference === t;
              const labels = { light: 'Claro', dark: 'Oscuro', system: 'Sistema' };
              return (
                <Pressable
                  key={t}
                  style={[
                    styles.themeChip,
                    isSelected
                      ? { backgroundColor: colors.primary, borderColor: colors.primary }
                      : { backgroundColor: colors.background, borderColor: colors.border },
                  ]}
                  onPress={() => handleSelectTheme(t)}
                >
                  <Text
                    style={[
                      styles.themeChipText,
                      isSelected ? { color: '#FFFFFF' } : { color: colors.text },
                    ]}
                  >
                    {labels[t]}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* Sección: Conexión Servidor / IP Local */}
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionHeaderText, { color: colors.textMuted }]}>
            CONEXIÓN CON LA API (BACKEND)
          </Text>
        </View>

        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.cardTitle, { color: colors.text }]}>URL del Servidor API</Text>
          <Text style={[styles.cardSubtitle, { color: colors.textMuted }]}>
            Cambia entre Localhost, tu IP de Wi-Fi local o Azure
          </Text>

          <TextInput
            style={[styles.apiInput, { backgroundColor: colors.background, borderColor: colors.border, color: colors.text }]}
            value={apiUrl}
            onChangeText={handleSaveApiUrl}
            autoCapitalize="none"
            autoCorrect={false}
          />

          {/* Atajos rápidos de IP */}
          <View style={styles.ipQuickRow}>
            <Pressable
              style={[styles.ipQuickChip, { backgroundColor: colors.backgroundElement }]}
              onPress={() => handleSaveApiUrl('http://127.0.0.1:8000')}
            >
              <Text style={[styles.ipQuickText, { color: colors.text }]}>Localhost</Text>
            </Pressable>
            <Pressable
              style={[styles.ipQuickChip, { backgroundColor: colors.backgroundElement }]}
              onPress={() => handleSaveApiUrl('http://192.168.1.65:8000')}
            >
              <Text style={[styles.ipQuickText, { color: colors.text }]}>IP Wi-Fi (192.168.1.65)</Text>
            </Pressable>
            <Pressable
              style={[styles.ipQuickChip, { backgroundColor: colors.backgroundElement }]}
              onPress={() =>
                handleSaveApiUrl('https://topicos-epfmfpaxbadrghhj.mexicocentral-01.azurewebsites.net')
              }
            >
              <Text style={[styles.ipQuickText, { color: colors.text }]}>Azure Web</Text>
            </Pressable>
          </View>

          <Pressable
            style={[styles.pingButton, { borderColor: colors.accent }]}
            onPress={handleTestConnection}
            disabled={testingPing}
          >
            {testingPing ? (
              <ActivityIndicator size="small" color={colors.accent} />
            ) : (
              <>
                <Ionicons name="pulse-outline" size={18} color={colors.accent} style={{ marginRight: 6 }} />
                <Text style={[styles.pingButtonText, { color: colors.accent }]}>Probar Conexión</Text>
              </>
            )}
          </Pressable>

          {pingStatus ? (
            <Text style={[styles.pingResultText, { color: colors.text }]}>{pingStatus}</Text>
          ) : null}
        </View>

        {/* Botón de Logout */}
        <Pressable
          style={[styles.logoutButton, { backgroundColor: `${colors.danger}15`, borderColor: `${colors.danger}30` }]}
          onPress={handleLogout}
        >
          <Ionicons name="log-out-outline" size={20} color={colors.danger} style={{ marginRight: 8 }} />
          <Text style={[styles.logoutButtonText, { color: colors.danger }]}>Cerrar Sesión</Text>
        </Pressable>
      </ScrollView>

      {/* Modal para Editar Perfil */}
      <Modal visible={showEditProfileModal} transparent animationType="slide">
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalContent, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitleText, { color: colors.text }]}>Editar Perfil</Text>
              <Pressable onPress={() => setShowEditProfileModal(false)} hitSlop={8}>
                <Ionicons name="close" size={22} color={colors.textMuted} />
              </Pressable>
            </View>

            <Text style={[styles.inputLabel, { color: colors.text }]}>Nombre</Text>
            <TextInput
              style={[styles.modalInput, { backgroundColor: colors.background, borderColor: colors.border, color: colors.text }]}
              value={editFirstName}
              onChangeText={setEditFirstName}
            />

            <Text style={[styles.inputLabel, { color: colors.text, marginTop: 12 }]}>Apellido</Text>
            <TextInput
              style={[styles.modalInput, { backgroundColor: colors.background, borderColor: colors.border, color: colors.text }]}
              value={editLastName}
              onChangeText={setEditLastName}
            />

            <Text style={[styles.inputLabel, { color: colors.text, marginTop: 12 }]}>Correo Electrónico</Text>
            <TextInput
              style={[styles.modalInput, { backgroundColor: colors.background, borderColor: colors.border, color: colors.text }]}
              value={editEmail}
              onChangeText={setEditEmail}
              keyboardType="email-address"
              autoCapitalize="none"
            />

            <Pressable
              style={[styles.confirmButton, { backgroundColor: colors.accent }]}
              onPress={handleSaveProfile}
              disabled={updatingProfile}
            >
              {updatingProfile ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.confirmButtonText}>Guardar Cambios</Text>
              )}
            </Pressable>
          </View>
        </View>
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
    fontWeight: '800',
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
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  avatarCircle: {
    width: 58,
    height: 58,
    borderRadius: 29,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  avatarInitial: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: '800',
  },
  profileInfo: {
    flex: 1,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 2,
  },
  profileName: {
    fontSize: 17,
    fontWeight: '800',
  },
  profileUsername: {
    fontSize: 13,
  },
  profileEmail: {
    fontSize: 12,
    marginTop: 2,
  },
  editProfileButton: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 9,
    borderRadius: 10,
    borderWidth: 1,
  },
  editProfileButtonText: {
    fontSize: 13,
    fontWeight: '600',
  },
  sectionHeader: {
    marginTop: 8,
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  sectionHeaderText: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 2,
  },
  cardSubtitle: {
    fontSize: 12,
    marginBottom: 12,
  },
  optionsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  sizeChip: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
  },
  sizeChipText: {
    fontSize: 14,
    fontWeight: '700',
  },
  themeChip: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
  },
  themeChipText: {
    fontSize: 13,
    fontWeight: '600',
  },
  apiInput: {
    height: 44,
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 12,
    fontSize: 13,
    marginBottom: 10,
  },
  ipQuickRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 12,
  },
  ipQuickChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  ipQuickText: {
    fontSize: 11,
    fontWeight: '600',
  },
  pingButton: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    height: 40,
    borderRadius: 10,
    borderWidth: 1,
  },
  pingButtonText: {
    fontSize: 13,
    fontWeight: '700',
  },
  pingResultText: {
    fontSize: 12,
    fontWeight: '600',
    marginTop: 8,
    textAlign: 'center',
  },
  logoutButton: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    height: 48,
    borderRadius: 12,
    borderWidth: 1,
    marginTop: 8,
  },
  logoutButtonText: {
    fontSize: 15,
    fontWeight: '700',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderWidth: 1,
    padding: 24,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitleText: {
    fontSize: 18,
    fontWeight: '800',
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 6,
  },
  modalInput: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    height: 44,
    fontSize: 14,
  },
  confirmButton: {
    height: 48,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 20,
  },
  confirmButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
});
