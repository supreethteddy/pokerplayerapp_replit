# GRE Admin Portal Integration Guide

## Overview

This guide details the integration between the Player Portal and the GRE (Guest Relation Executive) Admin Portal for live chat functionality with multi-GRE assignment capabilities.

## Database Tables Created

### 1. gre_chat_messages
```sql
CREATE TABLE gre_chat_messages (
  id SERIAL PRIMARY KEY,
  player_id INTEGER NOT NULL,
  player_name VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  sender VARCHAR(50) NOT NULL CHECK (sender IN ('player', 'gre', 'staff')),
  sender_name VARCHAR(255), -- Name of the GRE/staff member responding
  request_id INTEGER REFERENCES gre_chat_requests(id),
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  status VARCHAR(50) DEFAULT 'sent' CHECK (status IN ('sent', 'delivered', 'read')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 2. gre_chat_requests
```sql
CREATE TABLE gre_chat_requests (
  id SERIAL PRIMARY KEY,
  player_id INTEGER NOT NULL,
  player_name VARCHAR(255) NOT NULL,
  status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'assigned', 'active', 'completed', 'closed')),
  assigned_gre_id INTEGER, -- ID of the GRE who took the request
  assigned_gre_name VARCHAR(255), -- Name of the assigned GRE
  priority VARCHAR(50) DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
  subject VARCHAR(255), -- Optional subject/topic
  created_at TIMESTAMPTZ DEFAULT NOW(),
  assigned_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

## API Endpoints for GRE Portal

### 1. Player Chat Endpoints (Already implemented)
- `POST /api/gre-chat` - Send message from player
- `GET /api/gre-chat/messages/:playerId` - Get chat history

### 2. GRE Staff Portal Endpoints

#### Get Chat Requests
```
GET /api/gre-chat/requests
```
Returns all pending, assigned, and active chat requests for GREs to see and take.

#### Assign Request to GRE
```
POST /api/gre-chat/assign/:requestId
Body: {
  "greId": 1,
  "greName": "Sarah Johnson"
}
```
Assigns a pending chat request to a specific GRE. Only works if request is still pending.

#### Send GRE Message
```
POST /api/gre-chat/gre-message
Body: {
  "requestId": 1,
  "greId": 1,
  "greName": "Sarah Johnson",
  "message": "Hello! How can I help you today?"
}
```

## Chat Request Workflow

1. **Player starts chat**: When player sends first message, system automatically creates a chat request
2. **Request appears in GRE portal**: All available GREs can see pending requests
3. **GRE takes request**: One GRE clicks "Take Request" - system assigns request to that GRE
4. **Active conversation**: GRE and player can exchange messages
5. **Other GREs blocked**: Once assigned, other GREs cannot take the same request

## Multi-GRE Assignment System

### Features
- **Conflict Prevention**: Only one GRE can take each request
- **Real-time Updates**: Request status updates immediately when taken
- **Queue Management**: Pending requests visible to all GREs
- **Assignment Tracking**: Full audit trail of who took which request when

### GRE Portal Implementation

For the GRE Admin Portal, implement these components:

1. **Chat Request Queue**
```javascript
// Fetch pending requests
fetch('/api/gre-chat/requests')
  .then(res => res.json())
  .then(requests => {
    // Display requests with "Take Request" button
  });
```

2. **Take Request Function**
```javascript
function takeRequest(requestId) {
  fetch(`/api/gre-chat/assign/${requestId}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      greId: currentGreId,
      greName: currentGreName
    })
  }).then(res => {
    if (res.status === 409) {
      alert('Request already taken by another GRE');
    } else {
      // Open chat interface
    }
  });
}
```

3. **Send Message Function**
```javascript
function sendGreMessage(requestId, message) {
  fetch('/api/gre-chat/gre-message', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      requestId,
      greId: currentGreId,
      greName: currentGreName,
      message
    })
  });
}
```

## Request Status Flow

- **pending**: New request, available for any GRE to take
- **assigned**: GRE has taken the request but hasn't sent first message yet
- **active**: Active conversation between GRE and player
- **completed**: Chat resolved, marked complete by GRE
- **closed**: Conversation ended

## Integration Benefits

1. **No Chat Conflicts**: Multiple GREs can work simultaneously without taking same requests
2. **Efficient Queue Management**: Clear visibility of pending requests
3. **Audit Trail**: Complete tracking of assignments and conversations
4. **Real-time Updates**: Instant updates when requests are taken or messages sent
5. **Scalable**: Supports unlimited number of GREs working together

## Chatbot Integration

The system is ready for chatbot integration in the GRE Portal:
- Chatbot can monitor pending requests
- Automatically assign requests to chatbot or human GREs
- Seamless handoff between chatbot and human agents
- Message format compatible with both human and AI responses

## Database Connection

Both portals use the same Supabase database:
- URL: `process.env.VITE_SUPABASE_URL`
- Service Key: `process.env.SUPABASE_SERVICE_ROLE_KEY`

The GRE Portal should use identical connection settings for real-time synchronization.