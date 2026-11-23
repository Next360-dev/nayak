import { Platform } from 'react-native';
import * as NativeSecureStore from 'expo-secure-store';

// expo-secure-store has no web version. In a browser (local preview only, never a shipped build)
// fall back to localStorage so the app can still be tried out. Phones always use the secure store.
const web = () => (typeof localStorage !== 'undefined' ? localStorage : null);
export const SecureStore = {
  async getItemAsync(key: string): Promise<string | null> {
    if (Platform.OS === 'web') return web()?.getItem(key) ?? null;
    return NativeSecureStore.getItemAsync(key);
  },
  async setItemAsync(key: string, value: string): Promise<void> {
    if (Platform.OS === 'web') { web()?.setItem(key, value); return; }
    await NativeSecureStore.setItemAsync(key, value);
  },
  async deleteItemAsync(key: string): Promise<void> {
    if (Platform.OS === 'web') { web()?.removeItem(key); return; }
    await NativeSecureStore.deleteItemAsync(key);
  },
};

const ACCESS_KEY = 'aso_access_token';
const REFRESH_KEY = 'aso_refresh_token';
const PUSH_TOKEN_KEY = 'aso_push_token';

export async function getAccessToken(): Promise<string | null> {
  return SecureStore.getItemAsync(ACCESS_KEY);
}
export async function setAccessToken(token: string | null): Promise<void> {
  if (token) await SecureStore.setItemAsync(ACCESS_KEY, token);
  else await SecureStore.deleteItemAsync(ACCESS_KEY);
}
export async function getRefreshToken(): Promise<string | null> {
  return SecureStore.getItemAsync(REFRESH_KEY);
}
export async function setRefreshToken(token: string | null): Promise<void> {
  if (token) await SecureStore.setItemAsync(REFRESH_KEY, token);
  else await SecureStore.deleteItemAsync(REFRESH_KEY);
}
export async function getPushToken(): Promise<string | null> {
  return SecureStore.getItemAsync(PUSH_TOKEN_KEY);
}
export async function setPushToken(token: string | null): Promise<void> {
  if (token) await SecureStore.setItemAsync(PUSH_TOKEN_KEY, token);
  else await SecureStore.deleteItemAsync(PUSH_TOKEN_KEY);
}
export async function clearTokens(): Promise<void> {
  await SecureStore.deleteItemAsync(ACCESS_KEY);
  await SecureStore.deleteItemAsync(REFRESH_KEY);
  await SecureStore.deleteItemAsync(PUSH_TOKEN_KEY);
}