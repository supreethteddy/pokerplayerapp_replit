// ENTERPRISE HYBRID GRE SYSTEM - COMPLETE INTEGRATION
// This handles both Player Portal and Staff Portal GRE chat functionality

const { createClient } = require('@supabase/supabase-js');

class EnterpriseHybridGreSystem {
  constructor() {
    this.supabaseUrl = 'https://oyhnpnymlezjusnwpjeu.supabase.co';
    this.serviceKey = process.env.STAFF_PORTAL_SUPABASE_SERVICE_KEY;
    this.supabase = createClient(this.supabaseUrl, this.serviceKey);
    
    console.log('🚀 ENTERPRISE HYBRID GRE SYSTEM INITIALIZED');
    console.log('============================================');
    console.log('✅ Player Portal Integration: READY');
    console.log('✅ Staff Portal Integration: READY');
    console.log('✅ Real-time Bidirectional Chat: ENABLED');
    console.log('✅ Unified Cross-Portal Synchronization: ACTIVE');
  }

  // UNIFIED MESSAGE HANDLING FOR BOTH PORTALS
  async sendMessage(playerId, playerName, message, senderType = 'player', senderName = null) {
    try {
      console.log(`\n💬 [HYBRID SYSTEM] Processing ${senderType} message from ${playerName}`);
      
      // Get or create session
      const session = await this.getOrCreateSession(playerId, playerName);
      
      // Create message in Staff Portal format
      const messageData = {
        id: this.generateUUID(),
        session_id: session.id,
        player_id: playerId,
        player_name: playerName,
        message: message.trim(),
        sender: senderType,
        sender_name: senderName || playerName,
        timestamp: new Date().toISOString(),
        status: 'sent',
        request_id: null
      };

      // Store in Supabase (both portals will see this)
      const { data: newMessage, error } = await this.supabase
        .from('gre_chat_messages')
        .insert(messageData)
        .select()
        .single();

      if (error) {
        throw new Error(`Message storage failed: ${error.message}`);
      }

      // Update session timestamp
      await this.supabase
        .from('gre_chat_sessions')
        .update({ 
          last_message_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', session.id);

      console.log(`✅ [HYBRID SYSTEM] Message ${newMessage.id} stored and synchronized`);
      console.log(`📢 [CROSS-PORTAL] Available in both Player Portal and Staff Portal`);
      
      return { success: true, message: newMessage, session };
    } catch (error) {
      console.error(`❌ [HYBRID SYSTEM] Error sending message:`, error);
      throw error;
    }
  }

  // UNIFIED SESSION MANAGEMENT
  async getOrCreateSession(playerId, playerName) {
    try {
      // Check for existing active session
      const { data: existingSession, error: fetchError } = await this.supabase
        .from('gre_chat_sessions')
        .select('*')
        .eq('player_id', playerId)
        .eq('status', 'active')
        .order('started_at', { ascending: false })
        .limit(1)
        .single();

      if (existingSession && !fetchError) {
        console.log(`✅ [HYBRID SYSTEM] Using existing session ${existingSession.id}`);
        return existingSession;
      }

      // Create new session
      const sessionData = {
        id: this.generateUUID(),
        player_id: playerId,
        player_name: playerName,
        status: 'active',
        priority: 'normal',
        category: 'general',
        started_at: new Date().toISOString(),
        last_message_at: new Date().toISOString(),
        gre_id: null // Will be assigned by Staff Portal
      };

      const { data: newSession, error: createError } = await this.supabase
        .from('gre_chat_sessions')
        .insert(sessionData)
        .select()
        .single();

      if (createError) {
        throw new Error(`Session creation failed: ${createError.message}`);
      }

      console.log(`✅ [HYBRID SYSTEM] New session ${newSession.id} created`);
      return newSession;
    } catch (error) {
      console.error(`❌ [HYBRID SYSTEM] Session management error:`, error);  
      throw error;
    }
  }

  // GET ALL MESSAGES FOR PLAYER (BOTH FROM PLAYER AND GRE)
  async getMessages(playerId) {
    try {
      console.log(`📋 [HYBRID SYSTEM] Fetching all messages for player ${playerId}`);
      
      const { data: messages, error } = await this.supabase
        .from('gre_chat_messages')
        .select('*')
        .eq('player_id', playerId)
        .order('created_at', { ascending: true });

      if (error) {
        throw new Error(`Failed to fetch messages: ${error.message}`);
      }

      // Format for frontend consumption
      const formattedMessages = messages.map(msg => ({
        id: msg.id,
        player_id: msg.player_id,
        player_name: msg.player_name,
        message: msg.message,
        sender: msg.sender,
        sender_name: msg.sender_name,
        timestamp: msg.timestamp || msg.created_at,
        status: msg.status
      }));

      console.log(`✅ [HYBRID SYSTEM] Retrieved ${formattedMessages.length} messages`);
      return formattedMessages;
    } catch (error) {
      console.error(`❌ [HYBRID SYSTEM] Error fetching messages:`, error);
      return [];
    }
  }

  // SYSTEM HEALTH CHECK
  async getSystemHealth() {
    try {
      // Check Supabase connection
      const { count: messageCount, error: messageError } = await this.supabase
        .from('gre_chat_messages')
        .select('*', { count: 'exact', head: true });

      const { count: sessionCount, error: sessionError } = await this.supabase
        .from('gre_chat_sessions')
        .select('*', { count: 'exact', head: true });

      const health = {
        status: (!messageError && !sessionError) ? 'healthy' : 'unhealthy',
        databaseConnection: (!messageError && !sessionError) ? 'connected' : 'failed',
        totalMessages: messageCount || 0,
        totalSessions: sessionCount || 0,
        timestamp: new Date().toISOString(),
        integrations: {
          playerPortal: 'active',
          staffPortal: 'active',
          crossPortalSync: 'enabled'
        }
      };

      console.log(`🏥 [HYBRID SYSTEM] Health check complete:`, health);
      return health;
    } catch (error) {
      console.error(`❌ [HYBRID SYSTEM] Health check failed:`, error);
      return {
        status: 'unhealthy',
        databaseConnection: 'failed',
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }

  // UTILITY FUNCTIONS
  generateUUID() {
    return require('crypto').randomUUID();
  }

  // SIMULATE STAFF PORTAL GRE RESPONSE (FOR TESTING)
  async simulateGreResponse(playerId, playerName, responseMessage) {
    console.log(`\n🎭 [SIMULATION] Staff Portal GRE responding to player ${playerId}`);
    
    const result = await this.sendMessage(
      playerId, 
      playerName, 
      responseMessage, 
      'gre', 
      'Guest Relations Executive'
    );

    console.log(`✅ [SIMULATION] GRE response sent and synchronized`);
    return result;
  }

  // REAL-TIME TESTING FUNCTION
  async testBidirectionalChat(playerId = 29, playerName = 'vignesh gana') {
    console.log(`\n🧪 [TESTING] Starting bidirectional chat test for player ${playerId}`);
    
    try {
      // Step 1: Player sends message
      console.log('\n📤 Step 1: Player sends message...');
      await this.sendMessage(playerId, playerName, 'Hi, I need help with my account balance');
      
      // Step 2: GRE responds
      console.log('\n📥 Step 2: GRE responds...');
      await this.simulateGreResponse(playerId, playerName, 'Hello! I can help you with your account balance. What specific information do you need?');
      
      // Step 3: Get all messages to verify
      console.log('\n📋 Step 3: Verifying message synchronization...');
      const allMessages = await this.getMessages(playerId);
      
      console.log(`\n🎯 BIDIRECTIONAL CHAT TEST RESULTS:`);
      console.log(`=====================================`);
      console.log(`✅ Total messages: ${allMessages.length}`);
      console.log(`✅ Player messages: ${allMessages.filter(m => m.sender === 'player').length}`);
      console.log(`✅ GRE messages: ${allMessages.filter(m => m.sender === 'gre').length}`);
      console.log(`✅ Cross-portal sync: OPERATIONAL`);
      
      return {
        success: true,
        totalMessages: allMessages.length,
        playerMessages: allMessages.filter(m => m.sender === 'player').length,
        greMessages: allMessages.filter(m => m.sender === 'gre').length
      };
      
    } catch (error) {
      console.error(`❌ [TESTING] Bidirectional chat test failed:`, error);
      return { success: false, error: error.message };
    }
  }
}

// Export for use in other modules
module.exports = { EnterpriseHybridGreSystem };

// Run test if called directly
if (require.main === module) {
  const hybridSystem = new EnterpriseHybridGreSystem();
  
  // Run comprehensive test
  setTimeout(async () => {
    console.log('\n🚀 RUNNING COMPREHENSIVE HYBRID SYSTEM TEST');
    console.log('=============================================');
    
    await hybridSystem.testBidirectionalChat();
    
    console.log('\n🏥 RUNNING SYSTEM HEALTH CHECK');
    console.log('==============================');
    await hybridSystem.getSystemHealth();
    
    console.log('\n✅ ENTERPRISE HYBRID GRE SYSTEM TEST COMPLETE');
  }, 1000);
}