import * as SecureStore from 'expo-secure-store';

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