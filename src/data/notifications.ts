// ─── App Notifications ─────────────────────────────────────────────────────
// Add a new object to the TOP of NOTIFICATIONS every time you release an
// update or want to notify parents about something new. Each item needs a
// UNIQUE `id` — the badge on the Home screen bell counts any notification
// whose id hasn't been "seen" yet by the user (tracked locally on-device).
//
// type controls the icon/color shown in the Notifications screen:
//   'update' -> app update           (blue)
//   'info'   -> general announcement (teal)
//   'alert'  -> important/urgent     (amber)

export interface AppNotification {
  id: string;        // must be unique, e.g. version number or a slug + date
  title: string;
  message: string;
  date: string;       // display string, e.g. '08 Jul 2026'
  type: 'update' | 'info' | 'alert';
  actionUrl?: string; // optional — if set, notification shows an action button that opens this URL
}

export const NOTIFICATIONS: AppNotification[] = [

];