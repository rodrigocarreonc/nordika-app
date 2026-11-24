// Persistencia segura de sesión (token y perfil): usa SecureStore en móvil y localStorage en Web.

import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";
import { User } from "../types";

const TOKEN_KEY = "nordika_auth_token";
const USER_KEY = "nordika_auth_user";

// SecureStore no existe en navegador; este guard evita errores en Web y en SSR de Expo.
function isWebStorageAvailable(): boolean {
  return Platform.OS === "web" && typeof localStorage !== "undefined";
}

export async function saveToken(token: string): Promise<void> {
  if (isWebStorageAvailable()) {
    localStorage.setItem(TOKEN_KEY, token);
    return;
  }
  await SecureStore.setItemAsync(TOKEN_KEY, token);
}

export async function getToken(): Promise<string | null> {
  if (isWebStorageAvailable()) {
    return localStorage.getItem(TOKEN_KEY);
  }
  return await SecureStore.getItemAsync(TOKEN_KEY);
}

// Limpia tanto el token como el perfil cacheado para evitar mostrar datos de una sesión anterior.
export async function deleteToken(): Promise<void> {
  if (isWebStorageAvailable()) {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    return;
  }
  await SecureStore.deleteItemAsync(TOKEN_KEY);
  await SecureStore.deleteItemAsync(USER_KEY);
}

export async function saveUser(user: Partial<User>): Promise<void> {
  const userJson = JSON.stringify(user);
  if (isWebStorageAvailable()) {
    localStorage.setItem(USER_KEY, userJson);
    return;
  }
  await SecureStore.setItemAsync(USER_KEY, userJson);
}

export async function getUser(): Promise<Partial<User> | null> {
  let userJson: string | null = null;
  if (isWebStorageAvailable()) {
    userJson = localStorage.getItem(USER_KEY);
  } else {
    userJson = await SecureStore.getItemAsync(USER_KEY);
  }
  if (!userJson) return null;
  try {
    return JSON.parse(userJson);
  } catch {
    return null;
  }
}
