// OneSignal Web Push Notifications Client
declare global {
  interface Window {
    OneSignal: any;
  }
}

// Initialize OneSignal
export const initializeOneSignal = async (playerId?: number) => {
  console.log('🔔 [ONESIGNAL] Initializing OneSignal...');
  
  if (typeof window === 'undefined' || !window.OneSignal) {
    console.warn('⚠️ [ONESIGNAL] OneSignal not loaded, skipping initialization');
    return;
  }

  try {
    await window.OneSignal.init({
      appId: 'a2a7f8b8-93cf-4e4b-944b-7c0ee8b6d5c1',
      safari_web_id: "web.onesignal.auto.18ce29dc-92d9-4ad5-8c25-d67b3bb6cb9e",
      notifyButton: {
        enable: false, // Disable the default notification bell
      },
    });

    // Set external user ID for targeting specific players
    if (playerId) {
      await window.OneSignal.setExternalUserId(playerId.toString());
      console.log(`🔔 [ONESIGNAL] Set external user ID: ${playerId}`);
    }

    // Request notification permission
    const permission = await window.OneSignal.getNotificationPermission();
    console.log('🔔 [ONESIGNAL] Notification permission:', permission);

    if (permission !== 'granted') {
      console.log('🔔 [ONESIGNAL] Requesting notification permission...');
      await window.OneSignal.showSlidedownPrompt();
    }

    console.log('✅ [ONESIGNAL] OneSignal initialized successfully');
  } catch (error) {
    console.error('❌ [ONESIGNAL] Initialization error:', error);
  }
};

// Request notification permission
export const requestNotificationPermission = async () => {
  if (typeof window === 'undefined' || !window.OneSignal) {
    return false;
  }

  try {
    const permission = await window.OneSignal.getNotificationPermission();
    
    if (permission === 'granted') {
      return true;
    }

    await window.OneSignal.showSlidedownPrompt();
    const newPermission = await window.OneSignal.getNotificationPermission();
    
    console.log('🔔 [ONESIGNAL] Permission result:', newPermission);
    return newPermission === 'granted';
  } catch (error) {
    console.error('❌ [ONESIGNAL] Permission request error:', error);
    return false;
  }
};

// Set user ID for targeting
export const setPlayerId = async (playerId: number) => {
  if (typeof window === 'undefined' || !window.OneSignal) {
    return;
  }

  try {
    await window.OneSignal.setExternalUserId(playerId.toString());
    console.log(`🔔 [ONESIGNAL] Updated external user ID: ${playerId}`);
  } catch (error) {
    console.error('❌ [ONESIGNAL] Set player ID error:', error);
  }
};

// Add OneSignal script to page
export const loadOneSignalScript = () => {
  if (typeof window === 'undefined') return;

  const script = document.createElement('script');
  script.src = 'https://cdn.onesignal.com/sdks/OneSignalSDK.js';
  script.async = true;
  script.onload = () => {
    console.log('✅ [ONESIGNAL] Script loaded');
  };
  script.onerror = () => {
    console.error('❌ [ONESIGNAL] Script load error');
  };
  
  document.head.appendChild(script);
};

console.log('🚀 [ONESIGNAL] OneSignal client configuration loaded');