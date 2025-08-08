// DIRECT CHAT SYSTEM - Bypasses Supabase cache issues with raw SQL
import Pusher from 'pusher';
import { Pool } from 'pg';

export class DirectChatSystem {
  private pusher: Pusher;
  private pool: Pool;

  constructor() {
    this.pusher = new Pusher({
      appId: process.env.PUSHER_APP_ID!,
      key: process.env.PUSHER_KEY!,
      secret: process.env.PUSHER_SECRET!,
      cluster: process.env.PUSHER_CLUSTER!,
      useTLS: true,
    });

    // Direct PostgreSQL connection bypassing Supabase client cache
    this.pool = new Pool({
      connectionString: process.env.DATABASE_URL!,
      ssl: { rejectUnauthorized: false }
    });

    console.log('🚀 [DIRECT CHAT] System initialized with direct PostgreSQL connection');
  }

  // SEND MESSAGE - Direct SQL insert
  async sendMessage(playerId: number, playerName: string, message: string, senderType: 'player' | 'staff') {
    const client = await this.pool.connect();
    
    try {
      const { v4: uuidv4 } = await import('uuid');
      const messageId = uuidv4();
      const timestamp = new Date().toISOString();

      console.log(`🚀 [DIRECT CHAT] Sending ${senderType} message from ${playerName}`);

      // Direct SQL insert bypassing Supabase cache
      const query = `
        INSERT INTO chat_messages (id, request_id, player_id, sender, sender_name, message_text, timestamp, status)
        VALUES ($1, NULL, $2, $3, $4, $5, $6, 'sent')
        RETURNING id, message_text, timestamp
      `;

      const result = await client.query(query, [
        messageId, playerId, senderType, playerName, message, timestamp
      ]);

      console.log('✅ [DIRECT CHAT] Message saved to database:', result.rows[0]);

      // Send real-time notifications
      await this.sendNotifications(playerId, playerName, message, messageId, timestamp, senderType);

      return {
        success: true,
        data: {
          id: messageId,
          playerId,
          message,
          senderType,
          timestamp
        }
      };

    } catch (error) {
      console.error('❌ [DIRECT CHAT] Send error:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  // GET CHAT HISTORY - Direct SQL query
  async getChatHistory(playerId: number) {
    const client = await this.pool.connect();
    
    try {
      console.log(`📋 [DIRECT CHAT] Getting chat history for player: ${playerId}`);

      const query = `
        SELECT id, request_id, player_id, sender, sender_name, message_text, timestamp, status
        FROM chat_messages 
        WHERE player_id = $1 
        ORDER BY timestamp ASC
      `;

      const result = await client.query(query, [playerId]);

      console.log(`✅ [DIRECT CHAT] Retrieved ${result.rows.length} messages for player ${playerId}`);
      
      return { 
        success: true, 
        conversations: result.rows.length ? [{
          id: `conv-${playerId}`,
          subject: `Chat History`,
          status: 'active',
          chat_messages: result.rows
        }] : []
      };

    } catch (error) {
      console.error('❌ [DIRECT CHAT] History error:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  // CLEAR CHAT - Direct SQL delete
  async clearPlayerChat(playerId: number) {
    const client = await this.pool.connect();
    
    try {
      console.log(`🧹 [DIRECT CHAT] Clearing chat for player: ${playerId}`);

      const query = `DELETE FROM chat_messages WHERE player_id = $1`;
      const result = await client.query(query, [playerId]);

      console.log(`✅ [DIRECT CHAT] Deleted ${result.rowCount} messages for player ${playerId}`);
      
      return { 
        success: true, 
        message: `Chat history cleared successfully (${result.rowCount} messages deleted)` 
      };

    } catch (error) {
      console.error('❌ [DIRECT CHAT] Clear error:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  // REAL-TIME NOTIFICATIONS
  private async sendNotifications(playerId: number, playerName: string, message: string, messageId: string, timestamp: string, senderType: 'player' | 'staff' | 'gre') {
    try {
      const payload = {
        id: messageId,
        message: message,
        sender: senderType,
        sender_name: playerName,
        player_id: playerId,
        timestamp: timestamp,
        status: 'sent'
      };

      // UNIFIED BIDIRECTIONAL BRIDGE - Staff Portal Integration
      if (senderType === 'player') {
        // Player → Staff: Send to multiple event types for Staff Portal compatibility
        await Promise.all([
          // Primary event for Staff Portal
          this.pusher.trigger('staff-portal', 'chat-message-received', {
            ...payload,
            type: 'player-to-staff'
          }),
          // Alternative event format that Staff Portal might be listening to
          this.pusher.trigger('staff-portal', 'new-player-message', {
            ...payload,
            type: 'player-to-staff'
          }),
          // Player confirmation (echo prevention)
          this.pusher.trigger(`player-${playerId}`, 'chat-message-received', {
            ...payload,
            type: 'player-confirmation'
          })
        ]);
        console.log('✅ [BIDIRECTIONAL BRIDGE] Player message broadcasted with multiple event types');
        console.log('🎯 [STAFF PORTAL DEBUG] Message details for Staff Portal:');
        console.log(`   Player ID: ${playerId}`);
        console.log(`   Player Name: ${playerName}`);
        console.log(`   Message: ${message}`);
        console.log(`   Events Sent: chat-message-received, new-player-message`);
      } else {
        // GRE → Player: Send to multiple event types for compatibility
        await Promise.all([
          this.pusher.trigger(`player-${playerId}`, 'chat-message-received', {
            ...payload,
            type: 'staff-to-player'
          }),
          this.pusher.trigger(`player-${playerId}`, 'new-gre-message', {
            ...payload,
            type: 'staff-to-player'
          }),
          this.pusher.trigger('staff-portal', 'chat-message-received', {
            ...payload,
            type: 'staff-confirmation'
          })
        ]);
        console.log('✅ [BIDIRECTIONAL BRIDGE] Staff message broadcasted with multiple event types');
        console.log('🎯 [PLAYER PORTAL DEBUG] GRE message details for Player Portal:');
        console.log(`   Player ID: ${playerId}`);
        console.log(`   GRE Name: ${playerName}`);
        console.log(`   Message: ${message}`);
        console.log(`   Events Sent: chat-message-received, new-gre-message`);
      }

      // OneSignal push notification (optional)
      if (process.env.ONESIGNAL_API_KEY && process.env.ONESIGNAL_APP_ID) {
        try {
          const fetch = (await import('node-fetch')).default;
          const notificationPayload = {
            app_id: process.env.ONESIGNAL_APP_ID,
            included_segments: ['All'],
            headings: { en: 'New Chat Message' },
            contents: { en: `${playerName}: ${message.substring(0, 100)}` },
            data: { type: 'chat_message', playerId: playerId }
          };

          const response = await fetch('https://onesignal.com/api/v1/notifications', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Basic ${process.env.ONESIGNAL_API_KEY}`
            },
            body: JSON.stringify(notificationPayload)
          });

          if (response.ok) {
            console.log('✅ [DIRECT CHAT] OneSignal notification sent');
          }
        } catch (error) {
          console.warn('⚠️ [DIRECT CHAT] OneSignal error (non-critical):', error);
        }
      }

    } catch (error) {
      console.error('❌ [DIRECT CHAT] Notification error (non-critical):', error);
      // Don't throw - message was saved successfully
    }
  }

  // STAFF PORTAL INTEGRATION METHODS
  
  // Get all chat requests for Staff Portal visibility
  async getAllChatRequests() {
    const client = await this.pool.connect();
    
    try {
      console.log('🚀 [STAFF PORTAL] Getting all chat requests...');

      const query = `
        SELECT 
          cr.id,
          cr.player_id,
          cr.player_name,
          cr.player_email,
          cr.subject,
          cr.status,
          cr.priority,
          cr.source,
          cr.category,
          cr.initial_message,
          cr.assigned_to,
          cr.created_at,
          cr.updated_at,
          COUNT(cm.id) as message_count,
          MAX(cm.timestamp) as last_message_time
        FROM chat_requests cr
        LEFT JOIN chat_messages cm ON cr.id = cm.request_id
        GROUP BY cr.id, cr.player_id, cr.player_name, cr.player_email, 
                 cr.subject, cr.status, cr.priority, cr.source, cr.category,
                 cr.initial_message, cr.assigned_to, cr.created_at, cr.updated_at
        ORDER BY cr.created_at DESC
      `;
      
      const result = await client.query(query);
      const requests = result.rows.map(request => ({
        ...request,
        messageCount: parseInt(request.message_count) || 0,
        lastActivity: request.last_message_time || request.updated_at || request.created_at
      }));
      
      console.log(`✅ [STAFF PORTAL] Found ${requests.length} chat requests`);
      
      return { 
        success: true, 
        requests: requests 
      };

    } catch (error) {
      console.error('❌ [STAFF PORTAL] Error getting all requests:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  // Get conversation by request ID for Staff Portal
  async getConversationByRequestId(requestId: string) {
    const client = await this.pool.connect();
    
    try {
      console.log(`🚀 [STAFF PORTAL] Getting conversation: ${requestId}`);

      // Get request details
      const requestQuery = `
        SELECT * FROM chat_requests WHERE id = $1
      `;
      const requestResult = await client.query(requestQuery, [requestId]);
      
      if (requestResult.rows.length === 0) {
        return { success: false, request: null, messages: [] };
      }
      
      // Get all messages for this request
      const messagesQuery = `
        SELECT * FROM chat_messages 
        WHERE request_id = $1 
        ORDER BY timestamp ASC
      `;
      const messagesResult = await client.query(messagesQuery, [requestId]);
      
      console.log(`✅ [STAFF PORTAL] Request ${requestId}: ${messagesResult.rows.length} messages`);
      
      return {
        success: true,
        request: requestResult.rows[0],
        messages: messagesResult.rows
      };

    } catch (error) {
      console.error('❌ [STAFF PORTAL] Error getting conversation:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  // Send staff reply to existing chat request
  async sendStaffReply(data: { requestId: string, message: string, staffId: string, staffName: string }) {
    const client = await this.pool.connect();
    
    try {
      const { requestId, message, staffId, staffName } = data;
      console.log(`💬 [STAFF PORTAL] Staff reply from ${staffName} to request ${requestId}`);

      // Get the chat request to find player_id
      const requestQuery = `SELECT player_id, player_name FROM chat_requests WHERE id = $1`;
      const requestResult = await client.query(requestQuery, [requestId]);
      
      if (requestResult.rows.length === 0) {
        throw new Error('Chat request not found');
      }
      
      const { player_id, player_name } = requestResult.rows[0];
      const { v4: uuidv4 } = await import('uuid');
      const messageId = uuidv4();
      const timestamp = new Date().toISOString();

      // Save the staff reply message
      const messageQuery = `
        INSERT INTO chat_messages (id, request_id, player_id, sender, sender_name, message_text, timestamp, status)
        VALUES ($1, $2, $3, 'staff', $4, $5, $6, 'sent')
        RETURNING *
      `;

      const messageResult = await client.query(messageQuery, [
        messageId, requestId, player_id, staffName, message, timestamp
      ]);

      // Update request status and timestamp
      const updateQuery = `
        UPDATE chat_requests 
        SET status = 'in_progress', assigned_to = $1, updated_at = $2
        WHERE id = $3
      `;
      await client.query(updateQuery, [staffId, timestamp, requestId]);

      // Send real-time notifications
      await this.sendStaffReplyNotifications(player_id, player_name, message, messageId, timestamp, staffName, requestId);

      console.log(`✅ [STAFF PORTAL] Staff reply sent: ${messageId}`);
      
      return {
        success: true,
        messageId: messageId,
        data: messageResult.rows[0]
      };

    } catch (error) {
      console.error('❌ [STAFF PORTAL] Error sending staff reply:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  // Send notifications for staff replies
  private async sendStaffReplyNotifications(playerId: number, playerName: string, message: string, messageId: string, timestamp: string, staffName: string, requestId: string) {
    try {
      const payload = {
        id: messageId,
        message: message,
        sender: 'staff',
        sender_name: staffName,
        player_id: playerId,
        timestamp: timestamp,
        status: 'sent',
        type: 'staff-reply',
        request_id: requestId
      };

      // Send to player
      await this.pusher.trigger(`player-${playerId}`, 'new-message', payload);
      
      // Send to all staff portals
      await this.pusher.trigger('staff-portal', 'chat-request-updated', {
        requestId: requestId,
        status: 'in_progress',
        lastMessage: message,
        assignedTo: staffName
      });

      console.log('✅ [STAFF PORTAL] Staff reply notifications sent');

    } catch (error) {
      console.error('❌ [STAFF PORTAL] Notification error:', error);
      // Don't throw - message was saved successfully
    }
  }

  // Cleanup connection pool
  async close() {
    await this.pool.end();
  }
}

export const directChat = new DirectChatSystem();