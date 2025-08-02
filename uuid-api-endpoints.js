// 🚀 UUID-Based API Endpoints for Cross-Portal Chat Integration
// This file contains the new UUID-compatible endpoints as per the migration guide

// UUID-based chat messages endpoint (replaces integer-based)
const getUUIDChatMessages = async (req, res) => {
  try {
    const { playerUUID } = req.params; // Use UUID instead of integer
    
    console.log(`📨 [UUID CHAT] Fetching messages for player UUID: ${playerUUID}`);
    
    const { data: messages, error } = await staffPortalSupabase
      .from('gre_chat_messages_uuid')  // Use UUID table
      .select('*')
      .eq('player_id', playerUUID)  // UUID comparison
      .order('created_at', { ascending: true });
    
    if (error) {
      console.error('[UUID CHAT] Error fetching messages:', error);
      return res.status(500).json({ error: error.message });
    }
    
    console.log(`✅ [UUID CHAT] Found ${messages?.length || 0} messages for UUID ${playerUUID}`);
    res.json(messages || []);
    
  } catch (error) {
    console.error('[UUID CHAT] Exception:', error);
    res.status(500).json({ error: error.message });
  }
};

// UUID-based send message endpoint
const sendUUIDChatMessage = async (req, res) => {
  try {
    const { message, senderType = 'player' } = req.body;
    const { playerUUID } = req.params;
    
    // Get or create session for UUID player
    let { data: session, error: sessionError } = await staffPortalSupabase
      .from('gre_chat_sessions_uuid')
      .select('*')
      .eq('player_id', playerUUID)
      .eq('status', 'active')
      .limit(1)
      .single();
    
    if (sessionError || !session) {
      // Create new session
      const { data: newSession, error: createError } = await staffPortalSupabase
        .from('gre_chat_sessions_uuid')
        .insert({
          player_id: playerUUID,
          status: 'active',
          priority: 'normal',
          category: 'support'
        })
        .select()
        .single();
      
      if (createError) {
        console.error('[UUID CHAT] Session creation failed:', createError);
        return res.status(500).json({ error: createError.message });
      }
      
      session = newSession;
    }
    
    // Insert message with UUID
    const { data: newMessage, error: messageError } = await staffPortalSupabase
      .from('gre_chat_messages_uuid')
      .insert({
        session_id: session.id,
        player_id: playerUUID,
        player_name: 'Player', // This should come from auth.users lookup
        message,
        sender: senderType,
        sender_name: senderType === 'player' ? 'Player' : 'GRE Support',
        status: 'sent'
      })
      .select()
      .single();
    
    if (messageError) {
      console.error('[UUID CHAT] Message insert failed:', messageError);
      return res.status(500).json({ error: messageError.message });
    }
    
    console.log(`✅ [UUID CHAT] Message sent for UUID ${playerUUID}: ${message.substring(0, 50)}...`);
    res.json({ success: true, message: newMessage });
    
  } catch (error) {
    console.error('[UUID CHAT] Send message exception:', error);
    res.status(500).json({ error: error.message });
  }
};

// UUID-based chat requests endpoint
const getUUIDChatRequests = async (req, res) => {
  try {
    const { data: requests, error } = await staffPortalSupabase
      .from('chat_requests_uuid')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (error) {
      console.error('[UUID CHAT] Error fetching requests:', error);
      return res.status(500).json({ error: error.message });
    }
    
    console.log(`✅ [UUID CHAT] Found ${requests?.length || 0} chat requests`);
    res.json(requests || []);
    
  } catch (error) {
    console.error('[UUID CHAT] Exception:', error);
    res.status(500).json({ error: error.message });
  }
};

// Export the endpoints for integration
module.exports = {
  getUUIDChatMessages,
  sendUUIDChatMessage,
  getUUIDChatRequests
};

/* 
INTEGRATION INSTRUCTIONS:

1. Add these routes to server/routes.ts:
   app.get('/api/uuid/chat-messages/:playerUUID', getUUIDChatMessages);
   app.post('/api/uuid/chat-messages/:playerUUID', sendUUIDChatMessage);
   app.get('/api/uuid/chat-requests', getUUIDChatRequests);

2. Update frontend to use:
   - supabase.auth.user().id as playerUUID
   - UUID-based API endpoints
   - No more integer player IDs

3. Test with current user UUID: e0953527-a5d5-402c-9e00-8ed590d19cde
*/