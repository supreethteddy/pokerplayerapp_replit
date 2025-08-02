import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

// COMPREHENSIVE UNIFIED CHAT SYSTEM - ZERO LEGACY DEPENDENCIES
// Complete elimination of: gre_chat_messages_uuid, gre_chat_sessions_uuid, chat_requests_uuid
// Uses ONLY: chat_requests and chat_messages tables

const staffPortalSupabase = createClient(
  process.env.STAFF_PORTAL_SUPABASE_URL!,
  process.env.STAFF_PORTAL_SUPABASE_SERVICE_KEY!
);

// Enhanced error handling with comprehensive audit logging
const handleChatError = (error: any, context: string, metadata: any = {}) => {
  const errorId = crypto.randomUUID();
  const timestamp = new Date().toISOString();
  
  console.error(`❌ [${context}] Error ${errorId}:`, {
    error: error.message || error,
    metadata,
    timestamp,
    stack: error.stack?.split('\n').slice(0, 3)
  });
  
  return {
    errorId,
    context,
    message: error.message || 'Unknown error',
    timestamp,
    metadata
  };
};

// Universal field transformation: snake_case ↔ camelCase
const transformFieldsToCamelCase = (data: any) => {
  if (!data) return data;
  
  const transformed = {
    id: data.id,
    requestId: data.request_id || data.requestId,
    playerId: data.player_id || data.playerId,
    playerName: data.player_name || data.playerName,
    playerEmail: data.player_email || data.playerEmail,
    messageText: data.message_text || data.messageText || data.message,
    sender: data.sender,
    senderName: data.sender_name || data.senderName,
    timestamp: data.timestamp || data.created_at,
    status: data.status,
    subject: data.subject,
    priority: data.priority,
    source: data.source,
    category: data.category,
    assignedTo: data.assigned_to || data.assignedTo,
    greStaffId: data.gre_staff_id || data.greStaffId,
    initialMessage: data.initial_message || data.initialMessage,
    notes: data.notes,
    createdAt: data.created_at || data.createdAt,
    updatedAt: data.updated_at || data.updatedAt,
    resolvedAt: data.resolved_at || data.resolvedAt,
    resolvedBy: data.resolved_by || data.resolvedBy
  };
  
  // Remove undefined fields
  Object.keys(transformed).forEach(key => {
    if (transformed[key] === undefined) {
      delete transformed[key];
    }
  });
  
  return transformed;
};

const transformFieldsToSnakeCase = (data: any) => {
  if (!data) return data;
  
  return {
    id: data.id,
    request_id: data.requestId || data.request_id,
    player_id: data.playerId || data.player_id,
    player_name: data.playerName || data.player_name,
    player_email: data.playerEmail || data.player_email,
    message_text: data.messageText || data.message_text || data.message,
    sender: data.sender,
    sender_name: data.senderName || data.sender_name,
    timestamp: data.timestamp,
    status: data.status,
    subject: data.subject,
    priority: data.priority,
    source: data.source,
    category: data.category,
    assigned_to: data.assignedTo || data.assigned_to,
    gre_staff_id: data.greStaffId || data.gre_staff_id,
    initial_message: data.initialMessage || data.initial_message,
    notes: data.notes,
    created_at: data.createdAt || data.created_at || new Date().toISOString(),
    updated_at: data.updatedAt || data.updated_at || new Date().toISOString(),
    resolved_at: data.resolvedAt || data.resolved_at,
    resolved_by: data.resolvedBy || data.resolved_by
  };
};

// UNIFIED CHAT REQUEST CREATION - No Legacy Dependencies
export const createUnifiedChatRequest = async (requestData: {
  playerId: number;
  playerName: string;
  playerEmail?: string;
  subject: string;
  initialMessage: string;
  priority?: string;
  category?: string;
}) => {
  const operationId = crypto.randomUUID();
  const startTime = Date.now();
  
  try {
    console.log(`🚀 [CREATE REQUEST] Starting unified chat request creation [${operationId}]`);
    
    // Create chat request in unified table
    const requestPayload = {
      id: crypto.randomUUID(),
      player_id: requestData.playerId,
      player_name: requestData.playerName,
      player_email: requestData.playerEmail,
      subject: requestData.subject,
      priority: requestData.priority || 'urgent',
      status: 'waiting',
      source: 'player_portal',
      category: requestData.category || 'support',
      initial_message: requestData.initialMessage,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    
    const { data: chatRequest, error: requestError } = await staffPortalSupabase
      .from('chat_requests')
      .insert(requestPayload)
      .select()
      .single();
    
    if (requestError) {
      throw new Error(`Chat request creation failed: ${requestError.message}`);
    }
    
    console.log(`✅ [CREATE REQUEST] Chat request created: ${chatRequest.id}`);
    
    // Create initial message in unified messages table
    const messagePayload = {
      id: crypto.randomUUID(),
      request_id: chatRequest.id,
      player_id: requestData.playerId,
      message_text: requestData.initialMessage,
      sender: 'player',
      sender_name: requestData.playerName,
      timestamp: new Date().toISOString(),
      status: 'sent',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    
    const { data: initialMessage, error: messageError } = await staffPortalSupabase
      .from('chat_messages')
      .insert(messagePayload)
      .select()
      .single();
    
    if (messageError) {
      console.error('⚠️ [CREATE REQUEST] Initial message creation failed:', messageError);
      // Don't fail the entire request if message fails
    }
    
    const duration = Date.now() - startTime;
    console.log(`✅ [CREATE REQUEST] Completed in ${duration}ms`);
    
    return {
      success: true,
      request: transformFieldsToCamelCase(chatRequest),
      initialMessage: initialMessage ? transformFieldsToCamelCase(initialMessage) : null,
      operationId,
      duration: `${duration}ms`
    };
    
  } catch (error: any) {
    const errorDetails = handleChatError(error, 'CREATE_UNIFIED_REQUEST', {
      operationId,
      playerId: requestData.playerId
    });
    
    return {
      success: false,
      error: errorDetails,
      operationId
    };
  }
};

// UNIFIED MESSAGE SENDING - No Legacy Dependencies
export const sendUnifiedChatMessage = async (messageData: {
  playerId: number;
  message: string;
  sender: 'player' | 'gre';
  senderName?: string;
  requestId?: string;
}) => {
  const operationId = crypto.randomUUID();
  const startTime = Date.now();
  
  try {
    console.log(`🚀 [SEND MESSAGE] Starting unified message send [${operationId}]`);
    
    let targetRequestId = messageData.requestId;
    
    // If no requestId provided, find or create active request for player
    if (!targetRequestId) {
      const { data: activeRequest, error: requestError } = await staffPortalSupabase
        .from('chat_requests')
        .select('*')
        .eq('player_id', messageData.playerId)
        .in('status', ['waiting', 'in_progress'])
        .order('created_at', { ascending: false })
        .limit(1)
        .single();
      
      if (requestError || !activeRequest) {
        // Create new request if none exists
        const newRequestResult = await createUnifiedChatRequest({
          playerId: messageData.playerId,
          playerName: messageData.senderName || `Player ${messageData.playerId}`,
          subject: 'Chat Support Request',
          initialMessage: messageData.message,
          priority: 'normal',
          category: 'support'
        });
        
        if (!newRequestResult.success) {
          throw new Error('Failed to create chat request for message');
        }
        
        return newRequestResult;
      }
      
      targetRequestId = activeRequest.id;
    }
    
    // Insert message into unified messages table
    const messagePayload = {
      id: crypto.randomUUID(),
      request_id: targetRequestId,
      player_id: messageData.playerId,
      message_text: messageData.message,
      sender: messageData.sender,
      sender_name: messageData.senderName || (messageData.sender === 'player' ? `Player ${messageData.playerId}` : 'GRE Support'),
      timestamp: new Date().toISOString(),
      status: 'sent',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    
    const { data: newMessage, error: messageError } = await staffPortalSupabase
      .from('chat_messages')
      .insert(messagePayload)
      .select()
      .single();
    
    if (messageError) {
      throw new Error(`Message insertion failed: ${messageError.message}`);
    }
    
    // Update request status and timestamp
    await staffPortalSupabase
      .from('chat_requests')
      .update({
        updated_at: new Date().toISOString(),
        status: messageData.sender === 'gre' ? 'in_progress' : 'waiting'
      })
      .eq('id', targetRequestId);
    
    const duration = Date.now() - startTime;
    console.log(`✅ [SEND MESSAGE] Message sent successfully in ${duration}ms`);
    
    return {
      success: true,
      message: transformFieldsToCamelCase(newMessage),
      requestId: targetRequestId,
      operationId,
      duration: `${duration}ms`
    };
    
  } catch (error: any) {
    const errorDetails = handleChatError(error, 'SEND_UNIFIED_MESSAGE', {
      operationId,
      playerId: messageData.playerId
    });
    
    return {
      success: false,
      error: errorDetails,
      operationId
    };
  }
};

// UNIFIED MESSAGE FETCHING - No Legacy Dependencies
export const getUnifiedChatMessages = async (playerId: number, requestId?: string) => {
  const operationId = crypto.randomUUID();
  const startTime = Date.now();
  
  try {
    console.log(`🚀 [GET MESSAGES] Fetching unified messages [${operationId}]`);
    
    let query = staffPortalSupabase
      .from('chat_messages')
      .select('*')
      .eq('player_id', playerId);
    
    if (requestId) {
      query = query.eq('request_id', requestId);
    }
    
    const { data: messages, error } = await query
      .order('timestamp', { ascending: true });
    
    if (error) {
      throw new Error(`Message fetch failed: ${error.message}`);
    }
    
    const transformedMessages = (messages || []).map(transformFieldsToCamelCase);
    
    const duration = Date.now() - startTime;
    console.log(`✅ [GET MESSAGES] Retrieved ${transformedMessages.length} messages in ${duration}ms`);
    
    return {
      success: true,
      messages: transformedMessages,
      total: transformedMessages.length,
      operationId,
      duration: `${duration}ms`
    };
    
  } catch (error: any) {
    const errorDetails = handleChatError(error, 'GET_UNIFIED_MESSAGES', {
      operationId,
      playerId
    });
    
    return {
      success: false,
      error: errorDetails,
      operationId
    };
  }
};

// UNIFIED REQUEST FETCHING - No Legacy Dependencies
export const getUnifiedChatRequests = async (playerId?: number, status?: string) => {
  const operationId = crypto.randomUUID();
  const startTime = Date.now();
  
  try {
    console.log(`🚀 [GET REQUESTS] Fetching unified chat requests [${operationId}]`);
    
    let query = staffPortalSupabase
      .from('chat_requests')
      .select('*');
    
    if (playerId) {
      query = query.eq('player_id', playerId);
    }
    
    if (status) {
      query = query.eq('status', status);
    }
    
    const { data: requests, error } = await query
      .order('created_at', { ascending: false });
    
    if (error) {
      throw new Error(`Request fetch failed: ${error.message}`);
    }
    
    const transformedRequests = (requests || []).map(transformFieldsToCamelCase);
    
    const duration = Date.now() - startTime;
    console.log(`✅ [GET REQUESTS] Retrieved ${transformedRequests.length} requests in ${duration}ms`);
    
    return {
      success: true,
      requests: transformedRequests,
      total: transformedRequests.length,
      operationId,
      duration: `${duration}ms`
    };
    
  } catch (error: any) {
    const errorDetails = handleChatError(error, 'GET_UNIFIED_REQUESTS', {
      operationId,
      playerId
    });
    
    return {
      success: false,
      error: errorDetails,
      operationId
    };
  }
};

export {
  handleChatError,
  transformFieldsToCamelCase,
  transformFieldsToSnakeCase
};