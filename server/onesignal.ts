// OneSignal configuration for push notifications
export const oneSignalConfig = {
  appId: process.env.ONESIGNAL_APP_ID!,
  restApiKey: process.env.ONESIGNAL_REST_API_KEY!
};

export async function sendPushNotification(
  playerId: string,
  title: string,
  message: string,
  data?: any
) {
  try {
    const response = await fetch('https://onesignal.com/api/v1/notifications', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${oneSignalConfig.restApiKey}`
      },
      body: JSON.stringify({
        app_id: oneSignalConfig.appId,
        include_external_user_ids: [`player-${playerId}`],
        headings: { en: title },
        contents: { en: message },
        data: data || {}
      })
    });

    const result = await response.json();
    console.log('Push notification sent:', result);
    return result;
  } catch (error) {
    console.error('Failed to send push notification:', error);
    throw error;
  }
}