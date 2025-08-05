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
  private async sendNotifications(playerId: number, playerName: string, message: string, messageId: string, timestamp: string, senderType: 'player' | 'staff') {
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

      // Staff Portal notification (EXACT MATCH with staff portal channels)
      await this.pusher.trigger('staff-portal', 'new-player-message', payload);
      console.log('✅ [DIRECT CHAT] Staff portal notification sent via Pusher');

      // Player channel notification (EXACT MATCH format)
      await this.pusher.trigger(`player-${playerId}`, 'new-staff-message', payload);
      console.log('✅ [DIRECT CHAT] Player channel notification sent via Pusher');

      // Universal chat channel (EXACT MATCH)
      await this.pusher.trigger('universal-chat', 'new-message', {
        ...payload,
        player_id: playerId,
        playerId: playerId
      });
      console.log('✅ [DIRECT CHAT] Universal channel notification sent via Pusher');

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

  // Cleanup connection pool
  async close() {
    await this.pool.end();
  }
}

export const directChat = new DirectChatSystem();