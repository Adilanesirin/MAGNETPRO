import { Platform, Linking } from 'react-native';
import * as Application from 'expo-application';

const VERSION_API = 'https://ship.imcbs.com/api/v1/magnetpro/';

interface PlatformVersionInfo {
  latest_version: string;
  min_version: string;
  store_url: string;
}

interface VersionCheckResult {
  updateAvailable: boolean;
  forceUpdate: boolean;
  storeUrl: string;
  releaseNotes: string;
  currentVersion: string;
  latestVersion: string;
}

// Returns 1 if a > b, -1 if a < b, 0 if equal
function compareVersions(a: string, b: string): number {
  const pa = a.split('.').map(Number);
  const pb = b.split('.').map(Number);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const na = pa[i] || 0;
    const nb = pb[i] || 0;
    if (na > nb) return 1;
    if (na < nb) return -1;
  }
  return 0;
}

export async function checkAppVersion(): Promise<VersionCheckResult | null> {
  try {
    const res = await fetch(VERSION_API);
    const json = await res.json();
    if (json.status !== 'success') return null;

    const platformKey = Platform.OS === 'ios' ? 'ios' : 'android';
    const info: PlatformVersionInfo = json.data[platformKey];
    if (!info) return null;

    const currentVersion = Application.nativeApplicationVersion || '0.0.0';

    const updateAvailable = compareVersions(currentVersion, info.latest_version) < 0;
    const forceUpdate = compareVersions(currentVersion, info.min_version) < 0;

    return {
      updateAvailable,
      forceUpdate,
      storeUrl: info.store_url,
      releaseNotes: json.data.release_notes || '',
      currentVersion,
      latestVersion: info.latest_version,
    };
  } catch (e) {
    console.warn('Version check failed:', e);
    return null; // fail silently, don't block app usage on network error
  }
}

export function openStore(url: string) {
  Linking.openURL(url).catch(() => {});
}