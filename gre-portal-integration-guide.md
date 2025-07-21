# GRE Portal Real-Time Chat Integration Guide

## Overview

This guide provides complete instructions for integrating the **GRE (Guest Relations Executive) Portal** with the **Player Portal's real-time chat system**. The system enables bidirectional messaging between GRE staff and players with real-time updates using WebSocket technology.

## System Architecture

```
Player Portal ←→ Staff Portal Supabase ←→ GRE Portal
     ↑                    ↑                  ↑
WebSocket API        Database Storage    REST API + WebSocket
```

### Key Components:
- **Player Portal**: WebSocket client for real-time chat experience
- **Staff Portal Supabase**: Centralized message storage and session management
- **GRE Portal**: Administrative interface for staff to respond to player inquiries
- **WebSocket Server**: Real-time message delivery between portals

## API Endpoints for GRE Portal

### 1. Send Message to Player (GRE → Player)
```http
POST /api/gre-chat/send-to-player
Content-Type: application/json

{
  "playerId": 29,
  "message": "Hello! How can I assist you today?",
  "greStaffName": "Sarah Johnson"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Message sent to player via WebSocket",
  "stored": true
}
```

### 2. Get Chat Messages for Player
```http
GET /api/gre-chat/messages/:playerId
```

**Response:**
```json
[
  {
    "id": "msg-uuid",
    "session_id": "session-uuid", 
    "player_id": 29,
    "player_name": "vignesh gana",
    "message": "Hello, I need help with my account",
    "sender": "player",
    "sender_name": "vignesh gana",
    "timestamp": "2025-07-21T12:05:33.000Z",
    "status": "sent",
    "created_at": "2025-07-21T12:05:33.000Z"
  }
]
```

### 3. Close Chat Session
```http
POST /api/gre-chat/close-session/:playerId
Content-Type: application/json

{
  "greStaffName": "Sarah Johnson"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Chat session closed successfully",
  "session": {
    "id": "session-uuid",
    "status": "closed",
    "closed_by": "Sarah Johnson"
  }
}
```

### 4. Get All Active Chat Sessions
```http
GET /api/gre-chat/requests
```

**Response:**
```json
[
  {
    "id": "session-uuid",
    "player_id": 29,
    "player_name": "vignesh gana",
    "status": "active",
    "created_at": "2025-07-21T12:00:00.000Z",
    "last_message_at": "2025-07-21T12:05:00.000Z"
  }
]
```

## Real-Time Features

### WebSocket Integration
The system uses WebSocket connections for instant message delivery:

1. **Player sends message** → Stored in database → **WebSocket delivers to GRE Portal**
2. **GRE sends response** → Stored in database → **WebSocket delivers to Player Portal**

### Message Types
- `new_message`: New player message received
- `gre_response`: GRE staff response
- `chat_closed`: Session closed by GRE staff
- `quick_action`: Predefined GRE responses

## GRE Portal Implementation

### Frontend Components (React)

#### Chat Interface Component
```jsx
import React, { useState, useEffect } from 'react';

function GREChatInterface() {
  const [activeSessions, setActiveSessions] = useState([]);
  const [selectedPlayer, setSelectedPlayer] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');

  // Fetch active sessions
  useEffect(() => {
    fetchActiveSessions();
    const interval = setInterval(fetchActiveSessions, 5000); // Refresh every 5s
    return () => clearInterval(interval);
  }, []);

  const fetchActiveSessions = async () => {
    const response = await fetch('/api/gre-chat/requests');
    const sessions = await response.json();
    setActiveSessions(sessions);
  };

  const loadPlayerMessages = async (playerId) => {
    const response = await fetch(`/api/gre-chat/messages/${playerId}`);
    const playerMessages = await response.json();
    setMessages(playerMessages);
    setSelectedPlayer(playerId);
  };

  const sendMessage = async () => {
    if (!newMessage.trim() || !selectedPlayer) return;

    const response = await fetch('/api/gre-chat/send-to-player', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        playerId: selectedPlayer,
        message: newMessage,
        greStaffName: 'GRE Agent'
      })
    });

    if (response.ok) {
      setNewMessage('');
      loadPlayerMessages(selectedPlayer); // Refresh messages
    }
  };

  const closeSession = async (playerId) => {
    const response = await fetch(`/api/gre-chat/close-session/${playerId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ greStaffName: 'GRE Agent' })
    });

    if (response.ok) {
      fetchActiveSessions();
      if (selectedPlayer === playerId) {
        setSelectedPlayer(null);
        setMessages([]);
      }
    }
  };

  return (
    <div className="gre-chat-interface">
      {/* Active Sessions Panel */}
      <div className="sessions-panel">
        <h3>Active Chat Sessions</h3>
        {activeSessions.map(session => (
          <div 
            key={session.id}
            className="session-item"
            onClick={() => loadPlayerMessages(session.player_id)}
          >
            <h4>{session.player_name}</h4>
            <p>Player ID: {session.player_id}</p>
            <small>{new Date(session.last_message_at).toLocaleTimeString()}</small>
          </div>
        ))}
      </div>

      {/* Chat Messages Panel */}
      {selectedPlayer && (
        <div className="chat-panel">
          <div className="chat-header">
            <h3>Chat with Player {selectedPlayer}</h3>
            <button onClick={() => closeSession(selectedPlayer)}>
              Close Session
            </button>
          </div>
          
          <div className="messages-container">
            {messages.map(message => (
              <div 
                key={message.id}
                className={`message ${message.sender === 'player' ? 'player-message' : 'gre-message'}`}
              >
                <strong>{message.sender_name}:</strong>
                <p>{message.message}</p>
                <small>{new Date(message.timestamp).toLocaleString()}</small>
              </div>
            ))}
          </div>

          <div className="message-input">
            <input
              type="text"
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              placeholder="Type your response..."
              onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
            />
            <button onClick={sendMessage}>Send</button>
          </div>
        </div>
      )}
    </div>
  );
}

export default GREChatInterface;
```

### Quick Actions Implementation
```jsx
const quickActions = [
  {
    id: 'account_status',
    label: 'Account Status',
    message: 'Your account is active and verified. Current balance: ₹{balance}. Is there anything specific you need help with?'
  },
  {
    id: 'kyc_help',
    label: 'KYC Help',
    message: 'I can help you with KYC document verification. Please ensure your documents are clear and valid.'
  },
  {
    id: 'technical_support',
    label: 'Technical Support', 
    message: 'I\'m here to help with technical issues. Can you describe the problem you\'re experiencing?'
  },
  {
    id: 'payment_help',
    label: 'Payment Help',
    message: 'I can assist with deposit and withdrawal questions. What payment-related help do you need?'
  }
];

const QuickActions = ({ onSendQuickMessage, selectedPlayer }) => (
  <div className="quick-actions">
    <h4>Quick Actions</h4>
    {quickActions.map(action => (
      <button
        key={action.id}
        onClick={() => onSendQuickMessage(action.message)}
        disabled={!selectedPlayer}
      >
        {action.label}
      </button>
    ))}
  </div>
);
```

## Database Schema (Staff Portal Supabase)

### Chat Sessions Table
```sql
CREATE TABLE gre_chat_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  player_id INTEGER NOT NULL,
  player_name VARCHAR(255) NOT NULL,
  status VARCHAR(20) DEFAULT 'active',
  created_at TIMESTAMP DEFAULT NOW(),
  last_message_at TIMESTAMP DEFAULT NOW(),
  closed_at TIMESTAMP,
  closed_by VARCHAR(255),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

### Chat Messages Table
```sql
CREATE TABLE gre_chat_messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id UUID REFERENCES gre_chat_sessions(id),
  player_id INTEGER NOT NULL,
  player_name VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  sender VARCHAR(10) NOT NULL, -- 'player' or 'gre'
  sender_name VARCHAR(255) NOT NULL,
  timestamp TIMESTAMP DEFAULT NOW(),
  status VARCHAR(20) DEFAULT 'sent',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  request_id INTEGER DEFAULT 0
);
```

## Testing the Integration

### Test Script Usage
```bash
# Run complete system test
node test-complete-gre-system.js

# Test individual components
curl -X POST http://localhost:5000/api/gre-chat/send-to-player \
  -H "Content-Type: application/json" \
  -d '{"playerId": 29, "message": "Test message", "greStaffName": "Test Agent"}'
```

### Expected Results
- ✅ Player messages appear in GRE interface instantly
- ✅ GRE responses appear in Player Portal without page refresh
- ✅ Chat sessions can be opened/closed by GRE staff
- ✅ Message history is preserved across sessions
- ✅ Real-time updates work bidirectionally

## Security Considerations

### Authentication
- GRE Portal should implement proper staff authentication
- Validate GRE staff permissions before allowing chat access
- Log all chat interactions for audit purposes

### Rate Limiting
- Implement message rate limiting to prevent spam
- Monitor for unusual chat patterns
- Set maximum concurrent sessions per GRE agent

### Data Privacy
- Encrypt sensitive customer information
- Implement chat history retention policies
- Ensure GDPR compliance for message storage

## Integration Checklist

- [ ] Set up Staff Portal Supabase connection
- [ ] Implement GRE Portal frontend components
- [ ] Configure WebSocket connections
- [ ] Set up authentication system
- [ ] Implement quick actions functionality
- [ ] Test bidirectional messaging
- [ ] Set up session management
- [ ] Configure logging and monitoring
- [ ] Implement security measures
- [ ] Deploy and test in production

## Support and Troubleshooting

### Common Issues
1. **Messages not appearing in real-time**: Check WebSocket connection status
2. **Database connection errors**: Verify Supabase credentials and connection string
3. **CORS issues**: Ensure proper CORS configuration for cross-origin requests
4. **Session management problems**: Check session creation and cleanup logic

### Debug Endpoints
- `GET /api/gre-chat/health` - System health check
- `GET /api/gre-chat/debug/:playerId` - Debug player connection status
- `POST /api/gre-chat/test-connection` - Test WebSocket connectivity

For additional support, please refer to the main project documentation or contact the development team.

---

**Last Updated**: July 21, 2025  
**Version**: 1.0  
**Status**: Production Ready