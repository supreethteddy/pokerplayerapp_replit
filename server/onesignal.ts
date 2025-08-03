// OneSignal Push Notification Service
import fetch from 'node-fetch';

export interface PushNotification {
  title: string;
  message: string;
  playerId?: number;
  playerIds?: number[];
  url?: string;
  data?: any;
}

// Send push notification to specific player(s)
export const sendPushNotification = async (notification: PushNotification) => {
  const { title, message, playerId, playerIds, url, data } = notification;
  
  console.log('🔔 [ONESIGNAL] Sending push notification:', { title, playerId, playerIds });
  
  try {
    const body = {
      app_id: process.env.ONESIGNAL_APP_ID!,
      headings: { en: title },
      contents: { en: message },
      url: url || undefined,
      data: data || {},
      // Target specific players if provided
      ...(playerId && { include_external_user_ids: [playerId.toString()] }),
      ...(playerIds && { include_external_user_ids: playerIds.map(id => id.toString()) }),
      // If no specific targeting, send to all subscribed users
      ...(!playerId && !playerIds && { included_segments: ['All'] })
    };

    const response = await fetch('https://onesignal.com/api/v1/notifications', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${process.env.ONESIGNAL_REST_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    });

    const result = await response.json();
    
    if (response.ok) {
      console.log('✅ [ONESIGNAL] Push notification sent successfully:', result);
      return { success: true, data: result };
    } else {
      console.error('❌ [ONESIGNAL] Push notification failed:', result);
      return { success: false, error: result };
    }
  } catch (error) {
    console.error('❌ [ONESIGNAL] Push notification error:', error);
    return { success: false, error };
  }
};

// Send chat notification
export const sendChatNotification = async (playerId: number, senderName: string, message: string) => {
  return await sendPushNotification({
    title: `New message from ${senderName}`,
    message: message.length > 100 ? message.substring(0, 100) + '...' : message,
    playerId,
    data: {
      type: 'chat',
      playerId,
      senderName
    }
  });
};

// Send general notification to all players
export const sendGlobalNotification = async (title: string, message: string, url?: string) => {
  return await sendPushNotification({
    title,
    message,
    url,
    data: {
      type: 'global',
      timestamp: new Date().toISOString()
    }
  });
};

console.log('✅ [ONESIGNAL] OneSignal service initialized');