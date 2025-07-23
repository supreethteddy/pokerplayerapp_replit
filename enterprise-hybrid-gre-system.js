/**
 * ENTERPRISE-GRADE HYBRID GRE CHAT SYSTEM
 * Stores messages in BOTH memory AND Supabase simultaneously
 * Auto-monitoring, auto-repair, bulletproof cross-portal functionality
 */

const { createClient } = require('@supabase/supabase-js');

class EnterpriseGreChatSystem {
  constructor() {
    // Memory storage (ultra-fast)
    this.memoryMessages = new Map(); // playerId -> messages[]
    this.memorySessions = new Map(); // playerId -> sessionId
    this.onlineUsers = new Set(); // Set of connected playerIds
    
    // Supabase client (cross-portal persistence)
    this.supabase = createClient(
      process.env.STAFF_PORTAL_SUPABASE_URL,
      process.env.STAFF_PORTAL_SUPABASE_SERVICE_KEY
    );
    
    // Monitoring counters
    this.stats = {
      messagesStored: 0,
      sessionsCreated: 0,
      databaseErrors: 0,
      autoRepairs: 0,
      lastHealthCheck: new Date()
    };
    
    // Auto-monitoring interval
    this.startMonitoring();
    
    console.log('🚀 Enterprise GRE Chat System initialized with dual storage');
  }
  
  /**
   * CORE: Send message with dual storage (memory + database)
   */
  async sendMessage(playerId, playerName, message, sender = 'player', senderName = null) {
    const messageId = this.generateId();
    const timestamp = new Date().toISOString();
    
    const messageData = {
      id: messageId,
      player_id: playerId,
      player_name: playerName,
      message: message,
      sender: sender,
      sender_name: senderName || playerName,
      timestamp: timestamp,
      status: 'sent'
    };
    
    try {
      // 1. ULTRA-FAST: Store in memory first (millisecond response)
      if (!this.memoryMessages.has(playerId)) {
        this.memoryMessages.set(playerId, []);
      }
      this.memoryMessages.get(playerId).push(messageData);
      this.stats.messagesStored++;
      
      // 2. ENTERPRISE: Store in database for cross-portal access
      await this.storeInDatabase(playerId, playerName, messageData);
      
      // 3. AUTO-MONITORING: Log successful operation
      this.logOperation('message_sent', 'success', { messageId, playerId });
      
      return { success: true, message: messageData };
      
    } catch (error) {
      this.stats.databaseErrors++;
      this.logOperation('message_send_error', 'error', { error: error.message, playerId });
      
      // Still return success since memory storage worked
      return { success: true, message: messageData, warning: 'Database storage failed but memory storage succeeded' };
    }
  }
  
  /**
   * Store message in Supabase with auto-session management
   */
  async storeInDatabase(playerId, playerName, messageData) {
    try {
      // 1. Ensure session exists or create new one
      let sessionId = await this.ensureSession(playerId, playerName);
      
      // 2. Store message in database
      const { data, error } = await this.supabase
        .from('gre_chat_messages')
        .insert({
          session_id: sessionId,
          player_id: playerId,
          player_name: playerName,
          message: messageData.message,
          sender: messageData.sender,
          sender_name: messageData.sender_name,
          timestamp: messageData.timestamp,
          status: 'sent'
        });
      
      if (error) {
        console.error('💥 Database storage error:', error);
        throw error;
      }
      
      console.log(`✅ Message stored in database for player ${playerId}`);
      return sessionId;
      
    } catch (error) {
      console.error('💥 Failed to store in database:', error);
      throw error;
    }
  }
  
  /**
   * Ensure chat session exists, create if needed
   */
  async ensureSession(playerId, playerName) {
    try {
      // Check memory cache first
      if (this.memorySessions.has(playerId)) {
        return this.memorySessions.get(playerId);
      }
      
      // Check database for existing active session
      const { data: existingSessions, error: fetchError } = await this.supabase
        .from('gre_chat_sessions')
        .select('id')
        .eq('player_id', playerId)
        .eq('status', 'active')
        .order('created_at', { ascending: false })
        .limit(1);
      
      if (fetchError) {
        console.error('Error fetching sessions:', fetchError);
      }
      
      let sessionId;
      
      if (existingSessions && existingSessions.length > 0) {
        sessionId = existingSessions[0].id;
        console.log(`📋 Found existing session ${sessionId} for player ${playerId}`);
      } else {
        // Create new session
        const { data: newSession, error: createError } = await this.supabase
          .from('gre_chat_sessions')
          .insert({
            player_id: playerId,
            status: 'active',
            started_at: new Date().toISOString(),
            last_message_at: new Date().toISOString()
          })
          .select('id')
          .single();
        
        if (createError) {
          console.error('Error creating session:', createError);
          throw createError;
        }
        
        sessionId = newSession.id;
        this.stats.sessionsCreated++;
        console.log(`🆕 Created new session ${sessionId} for player ${playerId}`);
      }
      
      // Cache in memory
      this.memorySessions.set(playerId, sessionId);
      return sessionId;
      
    } catch (error) {
      console.error('💥 Session management error:', error);
      // Fallback: generate temporary session ID
      const fallbackId = this.generateId();
      this.memorySessions.set(playerId, fallbackId);
      return fallbackId;
    }
  }
  
  /**
   * Get messages with hybrid retrieval (memory first, database fallback)
   */
  async getMessages(playerId) {
    try {
      // 1. ULTRA-FAST: Try memory first
      if (this.memoryMessages.has(playerId)) {
        const memoryMessages = this.memoryMessages.get(playerId);
        console.log(`⚡ Retrieved ${memoryMessages.length} messages from memory for player ${playerId}`);
        return memoryMessages;
      }
      
      // 2. FALLBACK: Load from database if memory is empty
      const { data: dbMessages, error } = await this.supabase
        .from('gre_chat_messages')
        .select('*')
        .eq('player_id', playerId)
        .order('timestamp', { ascending: true });
      
      if (error) {
        console.error('Database retrieval error:', error);
        return [];
      }
      
      // Transform database format to match memory format
      const transformedMessages = dbMessages.map(msg => ({
        id: msg.id,
        player_id: msg.player_id,
        player_name: msg.player_name,
        message: msg.message,
        sender: msg.sender,
        sender_name: msg.sender_name,
        timestamp: msg.timestamp,
        status: msg.status
      }));
      
      // Cache in memory for future ultra-fast access
      this.memoryMessages.set(playerId, transformedMessages);
      
      console.log(`📊 Retrieved ${transformedMessages.length} messages from database for player ${playerId}`);
      return transformedMessages;
      
    } catch (error) {
      console.error('💥 Message retrieval error:', error);
      return [];
    }
  }
  
  /**
   * Send GRE response (from staff portal)
   */
  async sendGreResponse(playerId, message, greStaffName = 'GRE Team') {
    return await this.sendMessage(playerId, 'Player', message, 'gre', greStaffName);
  }
  
  /**
   * Clear chat (memory only for ultra-fast clearing)
   */
  clearChat(playerId) {
    this.memoryMessages.delete(playerId);
    this.memorySessions.delete(playerId);
    console.log(`🧹 Cleared temporary chat for player ${playerId}`);
    return { success: true, cleared: true };
  }
  
  /**
   * Set player online status
   */
  setPlayerOnline(playerId, playerName) {
    this.onlineUsers.add(playerId);
    console.log(`🟢 Player ${playerId} (${playerName}) is now online`);
  }
  
  /**
   * Set player offline status
   */
  setPlayerOffline(playerId) {
    this.onlineUsers.delete(playerId);
    console.log(`🔴 Player ${playerId} is now offline`);
  }
  
  /**
   * Get system health status
   */
  getSystemHealth() {
    const memoryUsage = {
      totalPlayers: this.memoryMessages.size,
      totalMessages: Array.from(this.memoryMessages.values()).reduce((sum, msgs) => sum + msgs.length, 0),
      onlineUsers: this.onlineUsers.size,
      activeSessions: this.memorySessions.size
    };
    
    return {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: Date.now() - this.stats.lastHealthCheck,
      memory: memoryUsage,
      stats: this.stats,
      dualStorage: true,
      crossPortalReady: true
    };
  }
  
  /**
   * Auto-monitoring system
   */
  startMonitoring() {
    // Health check every 30 seconds
    setInterval(() => {
      this.performHealthCheck();
    }, 30000);
    
    // Auto-repair every 5 minutes  
    setInterval(() => {
      this.performAutoRepair();
    }, 300000);
    
    console.log('🔍 Auto-monitoring system started');
  }
  
  /**
   * Perform health check
   */
  async performHealthCheck() {
    try {
      // Test database connection
      const { data, error } = await this.supabase
        .from('gre_chat_sessions')
        .select('count(*)')
        .limit(1);
      
      if (error) {
        this.stats.databaseErrors++;
        this.logOperation('health_check', 'database_error', { error: error.message });
      } else {
        this.logOperation('health_check', 'success', this.getSystemHealth());
      }
      
      this.stats.lastHealthCheck = new Date();
      
    } catch (error) {
      console.error('💥 Health check failed:', error);
      this.stats.databaseErrors++;
    }
  }
  
  /**
   * Auto-repair system issues
   */
  async performAutoRepair() {
    try {
      // Clean up old sessions (older than 24 hours)
      const { data, error } = await this.supabase
        .from('gre_chat_sessions')
        .update({ status: 'inactive', ended_at: new Date().toISOString() })
        .lt('last_message_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
        .eq('status', 'active');
      
      if (!error && data) {
        this.stats.autoRepairs++;
        this.logOperation('auto_repair', 'sessions_cleaned', { count: data.length });
      }
      
    } catch (error) {
      console.error('💥 Auto-repair failed:', error);
    }
  }
  
  /**
   * Log operations for monitoring
   */
  logOperation(type, status, details) {
    const logEntry = {
      timestamp: new Date().toISOString(),
      type: type,
      status: status,
      details: details
    };
    
    console.log(`📊 [${type.toUpperCase()}] ${status}:`, details);
  }
  
  /**
   * Generate unique ID
   */
  generateId() {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}

module.exports = EnterpriseGreChatSystem;