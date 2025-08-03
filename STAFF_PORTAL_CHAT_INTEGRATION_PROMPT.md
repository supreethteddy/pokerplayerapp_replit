# STAFF PORTAL CHAT INTEGRATION - COMPLETE CROSS-PORTAL REAL-TIME COMMUNICATION

## IMMEDIATE ACTION REQUIRED

Your Player Portal now has a **FULLY FUNCTIONAL green send button** with real-time bidirectional chat. This prompt will enable your Staff Portal to receive and respond to these messages instantly.

## TECHNICAL INTEGRATION STATUS

✅ **Player Portal**: Green send button working with Pusher + Supabase
✅ **Backend API**: `/api/unified-chat/send` endpoint operational  
✅ **Database Storage**: Messages stored in `push_notifications` table
✅ **Real-time**: Pusher Channels configured (us2 cluster)

## COPY-PASTE IMPLEMENTATION FOR STAFF PORTAL

### 1. Environment Variables (.env.local)
```bash
# Add these to your Staff Portal .env.local
VITE_PUSHER_KEY=4a89de838fee5a34eb20
VITE_PUSHER_CLUSTER=us2
PUSHER_APP_ID=1919992
PUSHER_KEY=4a89de838fee5a34eb20
PUSHER_SECRET=f8c9b5951b89cfb14b29
PUSHER_CLUSTER=us2
```

### 2. Real-time Chat Component (StaffChatWidget.tsx)
```typescript
import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { MessageCircle, Send, Users } from 'lucide-react';
import Pusher from 'pusher-js';

interface PlayerMessage {
  id: string;
  player_id: number;
  player_name: string;
  message: string;
  timestamp: string;
  sender: 'player' | 'gre';
}

export default function StaffChatWidget() {
  const [activeChats, setActiveChats] = useState<PlayerMessage[]>([]);
  const [selectedChat, setSelectedChat] = useState<number | null>(null);
  const [replyMessage, setReplyMessage] = useState('');

  useEffect(() => {
    // Initialize Pusher connection
    const pusher = new Pusher('4a89de838fee5a34eb20', {
      cluster: 'us2',
      forceTLS: true
    });

    // Listen for new player messages
    const staffChannel = pusher.subscribe('staff-portal');
    
    staffChannel.bind('new-player-message', (data: any) => {
      console.log('🚀 [STAFF CHAT] New player message:', data);
      
      const newMessage: PlayerMessage = {
        id: `msg-${Date.now()}`,
        player_id: data.player_id,
        player_name: data.player_name,
        message: data.message,
        timestamp: data.timestamp,
        sender: 'player'
      };
      
      setActiveChats(prev => [newMessage, ...prev]);
    });

    return () => {
      pusher.unsubscribe('staff-portal');
      pusher.disconnect();
    };
  }, []);

  const sendReply = async (playerId: number, playerName: string) => {
    if (!replyMessage.trim()) return;

    try {
      const response = await fetch('/api/unified-chat/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          player_id: playerId,
          player_name: `GRE Reply to ${playerName}`,
          message: replyMessage,
          sender: 'gre'
        })
      });

      if (response.ok) {
        setReplyMessage('');
        // Add reply to local chat
        const replyMsg: PlayerMessage = {
          id: `reply-${Date.now()}`,
          player_id: playerId,
          player_name: 'GRE',
          message: replyMessage,
          timestamp: new Date().toISOString(),
          sender: 'gre'
        };
        setActiveChats(prev => [replyMsg, ...prev]);
      }
    } catch (error) {
      console.error('Failed to send reply:', error);
    }
  };

  return (
    <Card className="w-full max-w-2xl">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MessageCircle className="h-5 w-5" />
          Live Player Chat ({activeChats.length})
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4 max-h-96 overflow-y-auto">
          {activeChats.map((chat) => (
            <div key={chat.id} className="p-3 border rounded-lg">
              <div className="flex justify-between items-center mb-2">
                <Badge variant={chat.sender === 'player' ? 'default' : 'secondary'}>
                  {chat.sender === 'player' ? chat.player_name : 'GRE'}
                </Badge>
                <span className="text-xs text-gray-500">
                  {new Date(chat.timestamp).toLocaleTimeString()}
                </span>
              </div>
              <p className="text-sm">{chat.message}</p>
              
              {chat.sender === 'player' && (
                <div className="mt-2 flex gap-2">
                  <Input
                    value={replyMessage}
                    onChange={(e) => setReplyMessage(e.target.value)}
                    placeholder="Type your reply..."
                    className="flex-1"
                  />
                  <Button 
                    onClick={() => sendReply(chat.player_id, chat.player_name)}
                    size="sm"
                  >
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
```

### 3. Add to Staff Portal Dashboard
```typescript
// In your main Staff Portal dashboard component
import StaffChatWidget from './StaffChatWidget';

// Add this to your dashboard JSX
<StaffChatWidget />
```

## SUPABASE DATABASE TABLES

Your messages are stored in these tables:
- **`push_notifications`**: Main storage for all cross-portal messages
- **`gre_chat_sessions`**: Session management for chat workflows
- **`gre_chat_messages`**: Dedicated GRE chat storage

## VERIFICATION CHECKLIST

### Player Portal (✅ COMPLETED)
- [x] Green send button functional
- [x] Messages save to Supabase
- [x] Pusher real-time delivery
- [x] Cross-portal ID mapping

### Staff Portal (🔄 YOUR TASK)
- [ ] Install Pusher credentials
- [ ] Add StaffChatWidget component
- [ ] Test bidirectional messaging
- [ ] Verify real-time notifications

## TESTING PROCEDURE

1. **Player Portal**: Click green send button, type "Test from Player"
2. **Staff Portal**: Should see message appear in real-time
3. **Staff Portal**: Type reply and send
4. **Player Portal**: Should see GRE reply instantly

## TROUBLESHOOTING

If messages don't appear:
1. Check browser console for Pusher connection logs
2. Verify environment variables are set correctly
3. Ensure both portals use same Pusher cluster (us2)
4. Check Supabase database for stored messages

## SUCCESS METRICS

When working correctly:
- Sub-second message delivery between portals
- Messages persist in Supabase database
- Real-time bidirectional communication
- Staff can manage multiple player conversations

---

**IMMEDIATE ACTION**: Copy the StaffChatWidget component into your Staff Portal and add the environment variables. Your real-time bidirectional chat system will be operational within minutes.