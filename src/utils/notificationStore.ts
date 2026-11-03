import AsyncStorage from '@react-native-async-storage/async-storage';
import { NOTIFICATIONS, AppNotification } from '../data/notifications';
import { checkForStoreUpdate } from './checkStoreUpdate';

const SEEN_IDS_KEY = 'seenNotificationIds';

// Builds today's full notification list: an automatic "Update Available"
// entry (if the store has a newer version than what's installed) placed on
// top, followed by whatever you've manually added to notifications.ts.
export const getAllNotifications = async (): Promise<AppNotification[]> => {
  const list: AppNotification[] = [...NOTIFICATIONS];

  try {
    const storeInfo = await checkForStoreUpdate();
    if (storeInfo.updateAvailable && storeInfo.latestVersion) {
      list.unshift({
        id: `store-update-${storeInfo.latestVersion}`,
        title: 'New Update Available',
        message: `A newer version (v${storeInfo.latestVersion}) is available on the store. Update now for the latest features and fixes.`,
        date: 'Just now',
        type: 'update',
        actionUrl: storeInfo.storeUrl,
      });
    }
  } catch {
    // if the store check fails for any reason, just fall back to the manual list
  }

  return list;
};

// Returns how many notifications (manual + automatic store-update) have NOT been seen yet.
export const getUnreadCount = async (): Promise<number> => {
  try {
    const [raw, all] = await Promise.all([
      AsyncStorage.getItem(SEEN_IDS_KEY),
      getAllNotifications(),
    ]);
    const seenIds: string[] = raw ? JSON.parse(raw) : [];
    return all.filter(n => !seenIds.includes(n.id)).length;
  } catch {
    return 0;
  }
};

// Marks every current notification id (manual + automatic) as seen — call this
// when the user opens the Notifications screen.
export const markAllAsSeen = async (allNotifications?: AppNotification[]): Promise<void> => {
  try {
    const all = allNotifications ?? (await getAllNotifications());
    const allIds = all.map(n => n.id);
    await AsyncStorage.setItem(SEEN_IDS_KEY, JSON.stringify(allIds));
  } catch {
    // ignore write failures — badge will just recompute next time
  }
};