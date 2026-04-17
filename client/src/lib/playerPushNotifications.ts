/** Bump PlayerDashboard bell / counts when NotificationHistoryTab hides an item (same tab). */
export const PLAYER_PUSH_NOTIFICATION_UI_EVENT = 'player-push-notification-ui-changed';

export function isPlayerPushUnread(n: any): boolean {
  if (typeof n?.isRead === 'boolean') {
    return !n.isRead;
  }
  const d = n?.deliveryStatus ?? n?.delivery_status ?? 'unread';
  return String(d).toLowerCase() !== 'read';
}

export function getLocallyDeletedNotificationIds(): Set<string> {
  try {
    const raw = localStorage.getItem('deletedNotifications') || '[]';
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return new Set();
    return new Set(parsed.map((v) => String(v)));
  } catch {
    return new Set();
  }
}

/** Bell badge: unread only, excluding items the player hid from this device. */
export function countUnreadPlayerPushNotifications(notifications: unknown): number {
  if (!Array.isArray(notifications)) return 0;
  const deleted = getLocallyDeletedNotificationIds();
  return notifications.filter(
    (n: any) => n && !deleted.has(String(n.id)) && isPlayerPushUnread(n),
  ).length;
}
