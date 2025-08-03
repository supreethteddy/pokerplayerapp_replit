// Pusher Channels Configuration
import Pusher from 'pusher';

// Initialize Pusher with environment variables
export const pusher = new Pusher({
  appId: process.env.PUSHER_APP_ID!,
  key: process.env.PUSHER_KEY!,
  secret: process.env.PUSHER_SECRET!,
  cluster: process.env.PUSHER_CLUSTER!,
  useTLS: true
});

// Channel naming conventions
export const getPlayerChatChannel = (playerId: number) => `player-chat-${playerId}`;
export const getStaffChannel = () => 'staff-notifications';
export const getGlobalChannel = () => 'global-notifications';

// Message types
export interface ChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  senderType: 'player' | 'staff' | 'gre';
  message: string;
  timestamp: string;
  playerId?: number;
  sessionId?: string;
}

// Trigger chat message to specific player
export const broadcastToPlayer = async (playerId: number, message: ChatMessage) => {
  const channel = getPlayerChatChannel(playerId);
  
  console.log(`🚀 [PUSHER] Broadcasting to channel: ${channel}`, {
    messageId: message.id,
    sender: message.senderType,
    playerId
  });
  
  await pusher.trigger(channel, 'new-message', message);
};

// Trigger notification to staff
export const broadcastToStaff = async (notification: any) => {
  const channel = getStaffChannel();
  
  console.log(`🚀 [PUSHER] Broadcasting to staff: ${channel}`, notification);
  
  await pusher.trigger(channel, 'new-notification', notification);
};

// Trigger global notification
export const broadcastGlobal = async (notification: any) => {
  const channel = getGlobalChannel();
  
  console.log(`🚀 [PUSHER] Broadcasting globally: ${channel}`, notification);
  
  await pusher.trigger(channel, 'global-notification', notification);
};

console.log('✅ [PUSHER] Pusher service initialized with cluster:', process.env.PUSHER_CLUSTER);