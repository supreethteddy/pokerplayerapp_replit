// Pusher Channels Client Configuration
import Pusher from 'pusher-js';

// Initialize Pusher client - using hardcoded values since secrets are server-side only
export const pusher = new Pusher('1c6b6c9d0ae6f2e2c6d4', {
  cluster: 'ap2',
  forceTLS: true
});

// Channel subscriptions
export const subscribeToPlayerChat = (playerId: number, onMessage: (data: any) => void) => {
  const channel = pusher.subscribe(`player-chat-${playerId}`);
  channel.bind('new-message', onMessage);
  
  console.log(`🔌 [PUSHER] Subscribed to player chat: player-chat-${playerId}`);
  
  return () => {
    channel.unbind('new-message', onMessage);
    pusher.unsubscribe(`player-chat-${playerId}`);
    console.log(`🔌 [PUSHER] Unsubscribed from player chat: player-chat-${playerId}`);
  };
};

export const subscribeToStaffNotifications = (onNotification: (data: any) => void) => {
  const channel = pusher.subscribe('staff-notifications');
  channel.bind('new-notification', onNotification);
  
  console.log('🔌 [PUSHER] Subscribed to staff notifications');
  
  return () => {
    channel.unbind('new-notification', onNotification);
    pusher.unsubscribe('staff-notifications');
    console.log('🔌 [PUSHER] Unsubscribed from staff notifications');
  };
};

export const subscribeToGlobalNotifications = (onNotification: (data: any) => void) => {
  const channel = pusher.subscribe('global-notifications');
  channel.bind('global-notification', onNotification);
  
  console.log('🔌 [PUSHER] Subscribed to global notifications');
  
  return () => {
    channel.unbind('global-notification', onNotification);
    pusher.unsubscribe('global-notifications');
    console.log('🔌 [PUSHER] Unsubscribed from global notifications');
  };
};

// Connection status handlers
pusher.connection.bind('connected', () => {
  console.log('✅ [PUSHER] Connected to Pusher Channels');
});

pusher.connection.bind('disconnected', () => {
  console.log('❌ [PUSHER] Disconnected from Pusher Channels');
});

pusher.connection.bind('error', (error: any) => {
  console.error('⚠️ [PUSHER] Connection error:', error);
});

console.log('🚀 [PUSHER] Pusher client initialized');