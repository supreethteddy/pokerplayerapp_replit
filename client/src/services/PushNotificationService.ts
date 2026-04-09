import { PushNotifications, Token, ActionPerformed, PushNotificationSchema } from '@capacitor/push-notifications';
import { supabase } from '@/lib/supabase';
import { Capacitor } from '@capacitor/core';

export const PushNotificationService = {
  /**
   * Initialize Push Notifications
   * @param userId Optional player ID (integer)
   */
  async init(userId?: string | number) {
    if (!Capacitor.isNativePlatform()) {
      console.log('ℹ️ [PUSH] Not on a native platform. Skipping push registration.');
      return;
    }

    try {
      // 1. Request permission
      let permStatus = await PushNotifications.checkPermissions();

      if (permStatus.receive === 'prompt') {
        permStatus = await PushNotifications.requestPermissions();
      }

      if (permStatus.receive !== 'granted') {
        console.warn('⚠️ [PUSH] Permission not granted.');
        return;
      }

      // 2. Register with FCM/APNS
      await PushNotifications.register();

      // 3. Add Listeners
      this.addListeners(userId?.toString() || null);

      console.log('✅ [PUSH] Registration process completed.');
    } catch (error) {
      console.error('❌ [PUSH] Initialization error:', error);
    }
  },

  /**
   * Add push notification listeners
   */
  addListeners(userId: string | null) {
    // Registration success - Get FCM Token
    PushNotifications.addListener('registration', async (token: Token) => {
      console.log('📱 [PUSH] FCM Token:', token.value);
      
      // Save token to Supabase device_tokens table
      const { error } = await supabase
        .from('device_tokens')
        .upsert({
          player_id: userId ? parseInt(userId) : null, // Made optional
          token: token.value,
          platform: Capacitor.getPlatform(),
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'token'
        });

      if (error) {
        console.error('❌ [PUSH] Failed to save token to Supabase:', error.message);
      } else {
        console.log('✅ [PUSH] Token saved to Supabase for user:', userId || 'anonymous');
      }
    });

    // Registration error
    PushNotifications.addListener('registrationError', (error: any) => {
      console.error('❌ [PUSH] Registration error:', error);
    });

    // Notification received (app in foreground)
    PushNotifications.addListener('pushNotificationReceived', (notification: PushNotificationSchema) => {
      console.log('🔔 [PUSH] Notification received:', notification);
      
      // Optional: You can trigger a local toast or update UI state here
      // But standard push behavior handles the system notification
    });

    // Notification clicked (action performed)
    PushNotifications.addListener('pushNotificationActionPerformed', (action: ActionPerformed) => {
      const { notification } = action;
      console.log('🖱️ [PUSH] Action performed:', action);
      
      // Handle navigation based on notification data
      if (notification.data && notification.data.url) {
        // window.location.href = notification.data.url;
        // Or use your router
      }
    });
  },

  /**
   * Remove all listeners
   */
  async removeAllListeners() {
    if (Capacitor.isNativePlatform()) {
      await PushNotifications.removeAllListeners();
    }
  }
};
