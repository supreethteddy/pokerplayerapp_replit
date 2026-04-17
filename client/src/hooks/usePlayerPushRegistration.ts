import { useEffect, useRef } from 'react';
import { Capacitor } from '@capacitor/core';
import { PushNotifications } from '@capacitor/push-notifications';
import { API_BASE_URL, getAuthHeaders } from '@/lib/api/config';

/**
 * Registers the device FCM token with the CRM backend (device_tokens.player_uuid + club_id).
 * No-op on web; runs on Capacitor iOS/Android only.
 */
export function usePlayerPushRegistration(
  playerId: string | number | null | undefined,
  clubId: string | null | undefined,
) {
  const lastSentToken = useRef<string | null>(null);

  useEffect(() => {
    if (!playerId || !clubId) return;
    if (!Capacitor.isNativePlatform()) return;

    let cancelled = false;
    let removeRegistration: (() => void) | undefined;
    let removeError: (() => void) | undefined;

    void (async () => {
      try {
        const perm = await PushNotifications.requestPermissions();
        if (perm.receive !== 'granted') return;

        await PushNotifications.register();

        const regHandle = await PushNotifications.addListener('registration', async (info) => {
          if (cancelled || !info?.value) return;
          if (lastSentToken.current === info.value) return;
          lastSentToken.current = info.value;
          try {
            const res = await fetch(`${API_BASE_URL}/auth/player/device-token`, {
              method: 'POST',
              headers: getAuthHeaders(String(playerId), String(clubId)),
              body: JSON.stringify({
                token: info.value,
                platform: Capacitor.getPlatform(),
              }),
            });
            if (!res.ok) {
              console.warn('[push] device-token register failed', res.status);
            }
          } catch (e) {
            console.warn('[push] device-token register error', e);
          }
        });
        removeRegistration = () => {
          void regHandle.remove();
        };

        const errHandle = await PushNotifications.addListener('registrationError', (err) => {
          console.warn('[push] registrationError', err);
        });
        removeError = () => {
          void errHandle.remove();
        };
      } catch (e) {
        console.warn('[push] setup failed', e);
      }
    })();

    return () => {
      cancelled = true;
      removeRegistration?.();
      removeError?.();
    };
  }, [playerId, clubId]);
}
