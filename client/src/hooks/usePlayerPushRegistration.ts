import { useEffect, useRef } from 'react';
import { Capacitor } from '@capacitor/core';
import { PushNotifications } from '@capacitor/push-notifications';
import { API_BASE_URL, getAuthHeaders } from '@/lib/api/config';

/**
 * Registers the device FCM token with the CRM backend (device_tokens.player_uuid + club_id).
 * No-op on web; runs on Capacitor iOS/Android only.
 *
 * FIX: listeners MUST be attached BEFORE calling PushNotifications.register().
 * On some Android devices the registration callback fires immediately and any
 * listener added afterwards misses the event — causing the token to never be
 * saved and notifications to never arrive on the device.
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
    let removeForeground: (() => void) | undefined;

    void (async () => {
      try {
        // ── Step 1: Check / request permission ──────────────────────────────
        // On Android 13+ (API 33+) POST_NOTIFICATIONS must be declared in the
        // manifest AND the user must grant it at runtime.  Without the manifest
        // entry the call to requestPermissions() CRASHES on API 33+ devices.
        let permStatus = await PushNotifications.checkPermissions();

        if (permStatus.receive === 'prompt') {
          permStatus = await PushNotifications.requestPermissions();
        }

        if (permStatus.receive !== 'granted') {
          console.warn('[push] Permission not granted:', permStatus.receive);
          return;
        }

        // ── Step 2: Attach listeners BEFORE register() ──────────────────────
        // This is critical: on many Android devices the 'registration' event
        // fires synchronously or immediately after register(), before async
        // code below could attach a listener.  Attaching first guarantees we
        // always capture the token.

        const sendToken = async (token: string) => {
          if (cancelled || !token) return;
          if (lastSentToken.current === token) return;
          lastSentToken.current = token;

          try {
            const res = await fetch(`${API_BASE_URL}/auth/player/device-token`, {
              method: 'POST',
              headers: getAuthHeaders(String(playerId), String(clubId)),
              body: JSON.stringify({
                token,
                platform: Capacitor.getPlatform(),
              }),
            });
            if (res.ok) {
              console.log('[push] ✅ FCM token registered with backend');
            } else {
              console.warn('[push] device-token register failed', res.status);
            }
          } catch (e) {
            console.warn('[push] device-token register error', e);
          }
        };

        // Registration success listener
        const regHandle = await PushNotifications.addListener('registration', async (info) => {
          console.log('[push] 🎯 FCM token received:', info?.value?.substring(0, 20) + '...');
          await sendToken(info.value);
        });
        removeRegistration = () => { void regHandle.remove(); };

        // Registration error listener
        const errHandle = await PushNotifications.addListener('registrationError', (err) => {
          console.warn('[push] registrationError', err);
        });
        removeError = () => { void errHandle.remove(); };

        // Foreground notification received listener
        // Without this, notifications are silently dropped when the app is in
        // the foreground on Android.  We surface them as in-app toasts via
        // a custom DOM event that NotificationBubbleManager can listen to.
        const fgHandle = await PushNotifications.addListener(
          'pushNotificationReceived',
          (notification) => {
            console.log('[push] 📩 Foreground notification received:', notification.title);
            // Dispatch a custom event so the in-app bubble manager can show it
            window.dispatchEvent(
              new CustomEvent('fcm-foreground-notification', { detail: notification }),
            );
          },
        );
        removeForeground = () => { void fgHandle.remove(); };

        // ── Step 3: Call register() after listeners are set up ───────────────
        await PushNotifications.register();
        console.log('[push] register() called — awaiting FCM token...');

      } catch (e) {
        // Catch-all: never let push registration crash the app
        console.warn('[push] setup failed', e);
      }
    })();

    return () => {
      cancelled = true;
      removeRegistration?.();
      removeError?.();
      removeForeground?.();
    };
  }, [playerId, clubId]);
}
