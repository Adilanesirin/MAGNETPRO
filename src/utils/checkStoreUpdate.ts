import { Platform, Linking } from 'react-native';
import * as Application from 'expo-application';

// ─── CONFIG — fill these in for your app ───────────────────────────────────
const IOS_BUNDLE_ID     = 'com.magnet.MagnetPro';
const ANDROID_PACKAGE   = 'com.magnet.MagnetPro';

// TODO: once the app is live on the App Store, replace 0000000000 with your
// real numeric App Store ID (find it in the App Store Connect app URL, or in
// the public listing URL: apps.apple.com/app/idXXXXXXXXXX)
const IOS_STORE_URL     = 'https://apps.apple.com/app/id6769990169';
const ANDROID_STORE_URL = `https://play.google.com/store/apps/details?id=${ANDROID_PACKAGE}`;

export interface StoreUpdateInfo {
  updateAvailable: boolean;
  latestVersion: string | null;
  installedVersion: string;
  storeUrl: string;
}

// Compares two "1.2.3" style version strings. Returns 1 if a > b, -1 if a < b, 0 if equal.
const compareVersions = (a: string, b: string): number => {
  const pa = a.split('.').map(n => parseInt(n, 10) || 0);
  const pb = b.split('.').map(n => parseInt(n, 10) || 0);
  const len = Math.max(pa.length, pb.length);
  for (let i = 0; i < len; i++) {
    const na = pa[i] || 0;
    const nb = pb[i] || 0;
    if (na > nb) return 1;
    if (na < nb) return -1;
  }
  return 0;
};

const getInstalledVersion = (): string => Application.nativeApplicationVersion ?? '0.0.0';

// ── iOS: uses Apple's public lookup API — reliable ──────────────────────────
const checkIOS = async (): Promise<StoreUpdateInfo> => {
  const installedVersion = getInstalledVersion();
  try {
    const res = await fetch(`https://itunes.apple.com/lookup?bundleId=${IOS_BUNDLE_ID}`);
    const data = await res.json();
    const result = data?.results?.[0];
    const latestVersion: string | null = result?.version ?? null;
    const storeUrl: string = result?.trackViewUrl ?? IOS_STORE_URL;
    return {
      updateAvailable: !!latestVersion && compareVersions(latestVersion, installedVersion) > 0,
      latestVersion,
      installedVersion,
      storeUrl,
    };
  } catch {
    return { updateAvailable: false, latestVersion: null, installedVersion, storeUrl: IOS_STORE_URL };
  }
};

// ── Android: NO official API exists. This scrapes the public Play Store
// page's embedded JSON-LD for the version number. Best-effort only — if
// Google changes their page markup this silently stops finding a version
// (updateAvailable just comes back false, it won't crash).
const checkAndroid = async (): Promise<StoreUpdateInfo> => {
  const installedVersion = getInstalledVersion();
  try {
    const res = await fetch(ANDROID_STORE_URL);
    const html = await res.text();
    const match =
      html.match(/"softwareVersion":"([\d.]+)"/) ||
      html.match(/\[\[\["([\d.]+)"\]\]/); // fallback pattern seen in some page versions
    const latestVersion = match ? match[1] : null;
    return {
      updateAvailable: !!latestVersion && compareVersions(latestVersion, installedVersion) > 0,
      latestVersion,
      installedVersion,
      storeUrl: ANDROID_STORE_URL,
    };
  } catch {
    return { updateAvailable: false, latestVersion: null, installedVersion, storeUrl: ANDROID_STORE_URL };
  }
};

export const checkForStoreUpdate = async (): Promise<StoreUpdateInfo> => {
  if (Platform.OS === 'ios') return checkIOS();
  if (Platform.OS === 'android') return checkAndroid();
  return { updateAvailable: false, latestVersion: null, installedVersion: getInstalledVersion(), storeUrl: '' };
};

export const openStorePage = (url: string) => {
  if (url) Linking.openURL(url);
};