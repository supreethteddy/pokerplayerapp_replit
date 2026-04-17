/**
 * Player push inbox returns `imageUrl` / `image_url` from the CRM API.
 * Older UI paths expected `mediaUrl` / `media_url` — normalize here.
 */

export function getPushNotificationImageUrl(
  notif: Record<string, unknown> | null | undefined,
): string | undefined {
  if (!notif) return undefined;
  const raw =
    notif.imageUrl ??
    notif.image_url ??
    notif.mediaUrl ??
    notif.media_url;
  const s = typeof raw === 'string' ? raw.trim() : '';
  return s || undefined;
}

export function getPushNotificationVideoUrl(
  notif: Record<string, unknown> | null | undefined,
): string | undefined {
  if (!notif) return undefined;
  const raw = notif.videoUrl ?? notif.video_url;
  const s = typeof raw === 'string' ? raw.trim() : '';
  return s || undefined;
}
