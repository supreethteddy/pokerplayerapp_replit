# STAFF PORTAL CHAT INTEGRATION - COMPLETE SETUP

## 🚀 PLAYER PORTAL CHAT SYSTEM STATUS: FULLY OPERATIONAL

The Player Portal chat system is **100% working** with the following verified components:

### ✅ Backend API Status
- **Endpoint**: `/api/unified-chat/send` - Returns 200 OK
- **Database Storage**: Messages stored in `push_notifications` table
- **Pusher Integration**: Events triggered on `player-29` and `staff-portal` channels
- **Authentication**: Uses Supabase Auth with Player ID 29 (vignesh gana)

### ✅ Current Working Configuration

#### Pusher Credentials (VERIFIED WORKING)
```
App ID: 2031604
Key: 81b98cb04ef7aeef2baa
Secret: 6e3b7d709ee1fd09937e
Cluster: ap2
```

#### Database Schema (CONFIRMED ACTIVE)
- **push_notifications**: Stores all chat messages
- **gre_chat_sessions**: Manages chat sessions  
- **gre_chat_messages**: Alternative message storage
- **chat_events**: Audit trail for status changes

#### Player Authentication (VERIFIED)
- **Player ID**: 29
- **Player Name**: "vignesh gana"
- **Email**: vignesh.wildleaf@gmail.com
- **Supabase UUID**: e0953527-a5d5-402c-9e00-8ed590d19cde

## 🎯 STAFF PORTAL INTEGRATION REQUIREMENTS

Your Staff Portal needs to implement the following to receive and display player messages:

### 1. Pusher Client Setup
```javascript
import Pusher from 'pusher-js';

const pusher = new Pusher('81b98cb04ef7aeef2baa', {
  cluster: 'ap2',
  forceTLS: true
});

// Subscribe to staff portal channel
const channel = pusher.subscribe('staff-portal');

// Listen for new player messages
channel.bind('new-message', (data) => {
  console.log('New player message:', data);
  // Add message to your chat UI
  addMessageToChat(data);
});
```

### 2. Message Data Format
Player messages arrive in this format:
```json
{
  "id": "9a75b4da-37d9-4d79-96b0-8a75a56d7ffa",
  "message": "Player message text",
  "sender": "player", 
  "sender_name": "vignesh gana",
  "player_id": 29,
  "timestamp": "2025-08-03T15:48:05+00:00",
  "status": "sent"
}
```

### 3. API Endpoints for Staff Portal

#### Get Chat Messages
```
GET /api/push-notifications/29
Returns: Array of player messages
```

#### Send Staff Reply
```javascript
POST /api/unified-chat/send
{
  "player_id": 29,
  "player_name": "Staff Member",
  "message": "Staff reply text",
  "timestamp": new Date().toISOString(),
  "sender": "staff"
}
```

### 4. Database Queries
```sql
-- Get all player messages
SELECT * FROM push_notifications 
WHERE title = 'Player Message' 
ORDER BY created_at DESC;

-- Get messages for specific player  
SELECT * FROM push_notifications 
WHERE sent_by = 'player_29@pokerroom.com'
ORDER BY created_at DESC;
```

### 5. Real-Time Integration Code
```javascript
// Complete Staff Portal Chat Component
function StaffChatWidget() {
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  
  useEffect(() => {
    // Initialize Pusher
    const pusher = new Pusher('81b98cb04ef7aeef2baa', {
      cluster: 'ap2',
      forceTLS: true
    });
    
    const channel = pusher.subscribe('staff-portal');
    
    channel.bind('new-message', (data) => {
      setMessages(prev => [...prev, data]);
    });
    
    // Fetch existing messages
    fetch('/api/push-notifications/29')
      .then(res => res.json())
      .then(data => setMessages(data));
      
    return () => pusher.disconnect();
  }, []);
  
  const sendReply = async () => {
    const response = await fetch('/api/unified-chat/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        player_id: 29,
        player_name: 'Staff Member',
        message: newMessage,
        timestamp: new Date().toISOString(),
        sender: 'staff'
      })
    });
    
    if (response.ok) {
      setNewMessage('');
    }
  };
  
  return (
    <div className="chat-widget">
      <div className="messages">
        {messages.map(msg => (
          <div key={msg.id} className={`message ${msg.sender}`}>
            <strong>{msg.sender_name}:</strong> {msg.message}
          </div>
        ))}
      </div>
      <div className="input-area">
        <input 
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          placeholder="Type your reply..."
        />
        <button onClick={sendReply}>Send</button>
      </div>
    </div>
  );
}
```

## 🔧 Environment Variables Needed

Add these to your Staff Portal `.env`:
```
VITE_PUSHER_KEY=81b98cb04ef7aeef2baa
VITE_PUSHER_CLUSTER=ap2
PUSHER_APP_ID=2031604
PUSHER_KEY=81b98cb04ef7aeef2baa  
PUSHER_SECRET=6e3b7d709ee1fd09937e
PUSHER_CLUSTER=ap2

# Supabase (same as Player Portal)
VITE_SUPABASE_URL=https://oyhnpnymlezjusnwpjeu.supabase.co
VITE_SUPABASE_ANON_KEY=[your_anon_key]
SUPABASE_SERVICE_ROLE_KEY=[your_service_key]
```

## ✅ Verification Steps

1. **Test Pusher Connection**: Subscribe to `staff-portal` channel
2. **Test API Access**: Call `/api/push-notifications/29`
3. **Test Real-Time**: Send message from Player Portal, verify it appears in Staff Portal
4. **Test Bidirectional**: Send reply from Staff Portal, verify it appears in Player Portal

## 🚨 Important Notes

- Player Portal is sending messages to Pusher channel `staff-portal`
- All messages are stored in `push_notifications` table with `title = 'Player Message'`
- Player authentication is working with ID 29 and name "vignesh gana"
- Backend API is confirmed working with 200 OK responses
- Pusher events are successfully triggered on both channels

Your Staff Portal just needs to subscribe to the `staff-portal` Pusher channel and implement the message display/reply functionality using the provided code examples.