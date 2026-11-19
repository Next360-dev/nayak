const appJson = require('./app.json');

// One base URL per build profile. Nothing here is a real host: the address is
// supplied at build/run time so a changing demo tunnel is never committed.
//   development -> local backend (or a tunnel passed in API_BASE_URL)
//   preview     -> PREVIEW_API_BASE_URL, required
//   production  -> PRODUCTION_API_BASE_URL, required
const LOCAL_API_BASE_URL = 'http://127.0.0.1:8000';

function resolveApiBaseUrl(profile) {
  const explicit =
    process.env.API_BASE_URL || process.env.EXPO_PUBLIC_API_BASE_URL;
  if (explicit) return explicit.replace(/\/+$/, '');

  if (profile === 'development') {
    return process.env.DEV_API_BASE_URL || LOCAL_API_BASE_URL;
  }

  const varName =
    profile === 'production' ? 'PRODUCTION_API_BASE_URL' : 'PREVIEW_API_BASE_URL';
  const value =
    profile === 'production' ? process.env.PRODUCTION_API_BASE_URL : process.env.PREVIEW_API_BASE_URL;
  if (!value) {
    throw new Error(
      `Missing ${varName} for the "${profile}" build profile. Pass the public HTTPS backend URL, e.g. ` +
        `${varName}=https://api.example.com eas build --profile ${profile}`
    );
  }
  if (!/^https:\/\//.test(value)) {
    throw new Error(`${varName} must be an https:// URL, got "${value}".`);
  }
  return value.replace(/\/+$/, '');
}

module.exports = () => {
  const profile = process.env.EAS_BUILD_PROFILE || process.env.APP_ENV || 'development';
  const apiBaseUrl = resolveApiBaseUrl(profile);

  return {
    ...appJson,
    expo: {
      ...appJson.expo,
      extra: {
        ...(appJson.expo?.extra || {}),
        apiBaseUrl,
        buildProfile: profile,
      },
    },
  };
};
