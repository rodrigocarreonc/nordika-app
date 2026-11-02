import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const PAGE_SIZE_KEY = 'nordika_page_size';
const THEME_KEY = 'nordika_theme';
const API_URL_KEY = 'nordika_api_url';

export const DEFAULT_PAGE_SIZE = 10;
export const DEFAULT_API_URL = Platform.OS === 'web' 
  ? 'http://127.0.0.1:8000' 
  : 'http://192.168.1.65:8000'; // IP local para dispositivo móvil físico / Expo Go

function isWebStorage(): boolean {
  return Platform.OS === 'web' && typeof localStorage !== 'undefined';
}

async function getItem(key: string): Promise<string | null> {
  if (isWebStorage()) {
    return localStorage.getItem(key);
  }
  return await SecureStore.getItemAsync(key);
}

async function setItem(key: string, value: string): Promise<void> {
  if (isWebStorage()) {
    localStorage.setItem(key, value);
    return;
  }
  await SecureStore.setItemAsync(key, value);
}

export async function getStoredPageSize(): Promise<number> {
  const val = await getItem(PAGE_SIZE_KEY);
  if (!val) return DEFAULT_PAGE_SIZE;
  const num = parseInt(val, 10);
  return isNaN(num) || num <= 0 ? DEFAULT_PAGE_SIZE : num;
}

export async function saveStoredPageSize(size: number): Promise<void> {
  await setItem(PAGE_SIZE_KEY, size.toString());
}

export async function getStoredTheme(): Promise<'light' | 'dark' | 'system'> {
  const val = await getItem(THEME_KEY);
  if (val === 'light' || val === 'dark' || val === 'system') {
    return val;
  }
  return 'system';
}

export async function saveStoredTheme(theme: 'light' | 'dark' | 'system'): Promise<void> {
  await setItem(THEME_KEY, theme);
}

export async function getStoredApiUrl(): Promise<string> {
  const val = await getItem(API_URL_KEY);
  return val || DEFAULT_API_URL;
}

export async function saveStoredApiUrl(url: string): Promise<void> {
  // Asegura que no termine con '/'
  const cleanUrl = url.trim().replace(/\/+$/, '');
  await setItem(API_URL_KEY, cleanUrl);
}
