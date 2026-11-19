import Constants from 'expo-constants';

// Set by app.config.js from the build profile (development / preview / production).
// There is deliberately no fallback host: a build with no URL must fail loudly
// instead of quietly talking to the wrong server.
const configured =
  (Constants.expoConfig?.extra?.apiBaseUrl as string | undefined) ||
  ((Constants.manifest as { extra?: { apiBaseUrl?: string } } | undefined)?.extra
    ?.apiBaseUrl as string | undefined);

if (!configured) {
  throw new Error(
    'apiBaseUrl is missing from the app config. Run with API_BASE_URL set, or build with the profile env var (see mobile/README.md).'
  );
}

export const API_BASE_URL: string = configured.replace(/\/+$/, '');

export const BUILD_PROFILE: string =
  (Constants.expoConfig?.extra?.buildProfile as string | undefined) || 'development';

export const MAX_REPLY_CHARS = 2000;
export const PAGE_SIZE = 20;
export const UNREAD_POLL_MS = 60000;
