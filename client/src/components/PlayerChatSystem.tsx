import React, { useState, useEffect, useRef, useMemo } from 'react';
import Pusher from 'pusher-js';
import { MessageCircle, X, Send } from 'lucide-react';
import { apiRequest } from "@/lib/queryClient";

interface PlayerChatSystemProps {
  playerId: string;
  playerName: string;
  isInDialog?: boolean;
  onClose?: () => void;
}

interface ChatMessage {
  id: string;
  message: string;
  sender: 'player' | 'staff';
  sender_name: string;
  timestamp: string;
  isFromStaff: boolean;
}

const PlayerChatSystem: React.FC<PlayerChatSystemProps> = ({ playerId, playerName, isInDialog = false, onClose }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [isConnected, setIsConnected] = useState(true);
  const [sessionStatus, setSessionStatus] = useState<'none' | 'pending' | 'active' | 'recent'>('none');
  const [isOpen, setIsOpen] = useState(false);
  const [hasUnread, setHasUnread] = useState(false);
  const pusherRef = useRef<Pusher | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const storageKey = useMemo(
    () => (playerId ? `player_chat_${playerId}` : 'player_chat'),
    [playerId]
  );

  const messagesContainerRef = useRef<HTMLDivElement>(null);
  
  const scrollToBottom = (force: boolean = false) => {
    if (!messagesContainerRef.current) return;
    
    const container = messagesContainerRef.current;
    const isNearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 100;
    
    // Only auto-scroll if user is near bottom or if forced (e.g., new message sent)
    if (force || isNearBottom) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  };

  useEffect(() => {
    // Only auto-scroll when new messages arrive if user is near bottom
    // Don't force scroll on every message update to allow manual scrolling
    scrollToBottom(false);
  }, [messages]);

  // Load messages function that can be called whenever chat opens
  const loadChatHistory = async () => {
    try {
      console.log('📚 [PLAYER CHAT] Loading chat history for player:', playerId);

      const response = await apiRequest(
        'GET',
        `/api/player-chat/history?limit=50`
      );
      const data = await response.json();

      let loaded: ChatMessage[] =
        Array.isArray(data?.messages) && data.messages.length > 0
          ? data.messages.map((msg: any) => ({
              id: msg.id?.toString?.() ?? `msg-${msg.timestamp || Date.now()}`,
              message: msg.message || msg.message_text || '',
              sender: (msg.sender as 'player' | 'staff') || 'staff',
              sender_name: msg.sender_name || msg.sender || 'Staff',
              timestamp: msg.timestamp || new Date().toISOString(),
              isFromStaff:
                msg.sender === 'staff' ||
                msg.senderType === 'staff' ||
                msg.sender_name === 'Staff',
            }))
          : [];

      // Merge with any locally stored messages so the player can
      // still see their own recent messages even if the backend
      // doesn't yet return history (e.g. Supabase-only environments).
      try {
        let raw =
          localStorage.getItem(storageKey) ||
          localStorage.getItem("player_chat_NaN"); // migrate legacy key
        if (raw) {
          const localMessages: ChatMessage[] = JSON.parse(raw);
          if (Array.isArray(localMessages) && localMessages.length > 0) {
            const byId = new Map<string, ChatMessage>();
            [...loaded, ...localMessages].forEach((m) => {
              byId.set(m.id, m);
            });
            loaded = Array.from(byId.values());
          }
        }
      } catch (e) {
        console.warn("Unable to read cached chat messages", e);
      }

      // Merge with existing messages to prevent losing Pusher-delivered messages
      setMessages(prev => {
        const byId = new Map<string, ChatMessage>();
        const byContentAndTime = new Map<string, ChatMessage>();
        
        // Add existing messages first (these might include Pusher-delivered messages or optimistic updates)
        prev.forEach(msg => {
          byId.set(msg.id, msg);
          // Also track by content + timestamp for player messages to prevent duplicates
          if (!msg.isFromStaff) {
            const key = `${msg.message}-${new Date(msg.timestamp).getTime()}`;
            byContentAndTime.set(key, msg);
          }
        });
        
        // Add loaded messages (overwrite if same ID, but keep newer Pusher messages)
        loaded.forEach(msg => {
          // Skip player's own messages that are already in the list (from optimistic update)
          if (!msg.isFromStaff && msg.sender_name === playerName) {
            // Check if we already have this message (by content and approximate timestamp)
            const msgTime = new Date(msg.timestamp).getTime();
            let foundDuplicate = false;
            
            for (const [key, existingMsg] of byContentAndTime.entries()) {
              const existingTime = new Date(existingMsg.timestamp).getTime();
              // If same message content and within 10 seconds, it's a duplicate
              if (existingMsg.message === msg.message && 
                  Math.abs(msgTime - existingTime) < 10000) {
                // Update the existing optimistic message with server ID if different
                if (msg.id !== existingMsg.id) {
                  byId.delete(existingMsg.id);
                  byId.set(msg.id, msg);
                }
                foundDuplicate = true;
                break;
              }
            }
            
            if (foundDuplicate) {
              return; // Skip adding duplicate
            }
          }
          
          const existing = byId.get(msg.id);
          if (!existing || new Date(msg.timestamp).getTime() >= new Date(existing.timestamp).getTime()) {
            byId.set(msg.id, msg);
          }
        });
        
        const merged = Array.from(byId.values());
        merged.sort(
          (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
        );
        
        // Update session status based on merged messages
        const last = merged[merged.length - 1];
        if (!last) {
          setSessionStatus('none');
        } else if (last.isFromStaff) {
          setSessionStatus('active');
        } else {
          setSessionStatus('pending');
        }
        
        return merged;
      });
      
      console.log('✅ [PLAYER CHAT] Loaded', loaded.length, 'messages from history');
    } catch (error) {
      console.error('❌ [PLAYER CHAT] Failed to load messages:', error);
      setMessages([]);
      setSessionStatus('none');
    }
  };

  useEffect(() => {
    if (!playerId || !playerName) return;

    console.log('🚀 [PLAYER CHAT] Initializing for player:', playerId, playerName);

    // Initialize Pusher with environment variables to match Staff Portal.
    // If Pusher is not configured, fall back to HTTP-only mode so that
    // players can still view history and send messages without real-time updates.
    if (!import.meta.env.VITE_PUSHER_KEY) {
      console.error('❌ [PUSHER CONFIG] VITE_PUSHER_KEY not found in environment');
      // Fallback: still load history and allow sending messages
      loadChatHistory().then(() => {
        setIsConnected(true);
      });
      return;
    }

    const pusher = new Pusher(import.meta.env.VITE_PUSHER_KEY, {
      cluster: import.meta.env.VITE_PUSHER_CLUSTER || 'ap2',
      forceTLS: true
    });

    pusherRef.current = pusher;

    pusher.connection.bind('connected', () => {
      setIsConnected(true);
      console.log('✅ [PLAYER CHAT] Connected to Pusher');
    });

    pusher.connection.bind('disconnected', () => {
      setIsConnected(false);
      console.log('❌ [PLAYER CHAT] Disconnected from Pusher');
    });

    // Subscribe to UNIFIED channels for bidirectional communication
    const playerChannel = pusher.subscribe(`player-${playerId}`);
    const staffChannel = pusher.subscribe('staff-portal');

    console.log('📡 [PLAYER CHAT] Subscribed to channels:', `player-${playerId}`, 'staff-portal');

    // UNIFIED event handler for all message types - PREVENT DUPLICATION
    const handleIncomingMessage = (data: any) => {
      console.log('📨 [PLAYER CHAT] Message received:', data);

      // CRITICAL: Prevent duplicate messages from player confirmation or player's own messages
      if (data.type === 'player-confirmation' && data.player_id === playerId) {
        console.log('⚠️ [PLAYER CHAT] Skipping duplicate player confirmation message');
        return; // Don't add player's own messages back to chat
      }

      // Handle different data formats from staff portal
      const messageData = {
        id: data.id || data.messageId || `msg-${Date.now()}`,
        message: data.message || data.messageText || data.text || '',
        sender: data.sender || (data.isFromStaff ? 'staff' : 'player'),
        sender_name: data.sender_name || data.senderName || data.staffName || 'Staff Member',
        timestamp: data.timestamp || new Date().toISOString(),
        isFromStaff: data.sender === 'staff' || data.senderType === 'staff' || (data.sender_name !== playerName && data.sender !== 'player')
      };

      // CRITICAL: Skip player's own messages - they're already added optimistically
      if (messageData.sender === 'player' || 
          messageData.sender_name === playerName ||
          (!messageData.isFromStaff && data.player_id === playerId)) {
        console.log('⚠️ [PLAYER CHAT] Skipping player\'s own message to prevent duplication');
        return;
      }

      // ONLY add messages from staff - prevent player message echoing
      if (messageData.message && messageData.isFromStaff) {
        setMessages(prev => {
          // Prevent duplicate messages by ID or by content + timestamp
          const isDuplicate = prev.some(msg => 
            msg.id === messageData.id || 
            (msg.message === messageData.message && 
             msg.isFromStaff === messageData.isFromStaff &&
             Math.abs(new Date(msg.timestamp).getTime() - new Date(messageData.timestamp).getTime()) < 5000)
          );

          if (isDuplicate) {
            console.log('⚠️ [PLAYER CHAT] Duplicate staff message detected, ignoring');
            return prev;
          }

          return [...prev, messageData].sort((a, b) => 
            new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
          );
        });

        // Mark as unread if chat is closed
        if (!isInDialog) {
          setHasUnread(true);
        }

        setSessionStatus('active');
      }
    };

    // Listen for messages on player channel (staff → player)
    playerChannel.bind('chat-message-received', handleIncomingMessage);
    playerChannel.bind('new-staff-message', handleIncomingMessage);
    playerChannel.bind('new-message', handleIncomingMessage);

    // Listen for messages on staff channel (broadcast messages)
    staffChannel.bind('chat-message-received', (data: any) => {
      if (data.type === 'staff-to-player' && data.playerId == playerId) {
        handleIncomingMessage(data);
      }
    });

    // Listen for status updates
    playerChannel.bind('chat-status-updated', (data: any) => {
      console.log('📊 [PLAYER CHAT] Status updated:', data);
      if (data.playerId == playerId) {
        setSessionStatus(data.status || 'active');

        // If conversation is resolved, clear messages
        if (data.status === 'resolved') {
          console.log('✅ [PLAYER CHAT] Conversation resolved, clearing messages');
          setMessages([]);
          setSessionStatus('none');
        }
      }
    });

    // Load existing messages on initialization
    loadChatHistory();

    return () => {
      pusher.unsubscribe(`player-${playerId}`);
      pusher.unsubscribe('staff-portal');
      pusher.disconnect();
    };
  }, [playerId, playerName]);

  // Load messages whenever dialog opens (if in dialog mode) and set up polling for real-time updates
  useEffect(() => {
    if (isInDialog && playerId) {
      // Load chat history immediately when dialog opens
      loadChatHistory();
      
      // Set up polling interval to check for new messages every 2 seconds when dialog is open
      // This ensures messages from admin panel are received even if Pusher has issues
      const pollInterval = setInterval(() => {
        loadChatHistory();
      }, 2000);

      return () => {
        clearInterval(pollInterval);
      };
    }
  }, [isInDialog, playerId]);

  const sendMessage = async () => {
    if (!newMessage.trim()) return;

    const messageText = newMessage.trim();
    const messageId = `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const timestamp = new Date().toISOString();

    // Optimistic UI update
    const optimisticMsg: ChatMessage = {
      id: messageId,
      message: messageText,
      sender: 'player',
      sender_name: playerName,
      timestamp,
      isFromStaff: false,
    };

    setMessages((prev) => {
      const next = [...prev, optimisticMsg];
      try {
        localStorage.setItem(storageKey, JSON.stringify(next));
      } catch (e) {
        console.warn('Unable to persist chat messages', e);
      }
      return next;
    });
    setNewMessage('');
    setSessionStatus('pending');
    
    // Force scroll to bottom when user sends a message
    setTimeout(() => scrollToBottom(true), 100);

    try {
      console.log('⚡ [OPTIMIZED V1.2] Sending message to staff portal via /api/player-chat/send:', messageText);

      const response = await apiRequest('POST', '/api/player-chat/send', {
          message: messageText,
        playerName,
      });
      const result = await response.json().catch(() => null);

      if (!response.ok) {
        console.error('❌ [OPTIMIZED V1.2] Server error (non-critical):', result || response.statusText);
        setSessionStatus('none');
        return;
      }

      console.log('✅ [OPTIMIZED V1.2] Message accepted by backend:', result);
      // Mark session as active once backend accepts the message
      setSessionStatus('active');
    } catch (error) {
      console.error('❌ [OPTIMIZED V1.2] Send error:', error);
      setSessionStatus('none');
    }
  };

  const toggleChat = () => {
    setIsOpen(!isOpen);
    if (!isOpen) {
      setHasUnread(false);
    }
  };

  const closeChat = () => {
    setIsOpen(false);
  };

  // Status color mapping
  const getStatusColor = () => {
    switch (sessionStatus) {
      case 'pending': return 'text-yellow-500';
      case 'active': return 'text-green-500'; 
      case 'recent': return 'text-blue-500';
      default: return 'text-gray-500';
    }
  };

  // If in dialog mode, render chat content directly without the blue bubble
  if (isInDialog) {
    return (
      <div className="flex flex-col h-[600px] max-h-[80vh] overflow-hidden">
        {/* Status Bar */}
        <div className={`px-3 py-2 text-sm ${getStatusColor()} bg-slate-900 border-b border-slate-600 flex items-center justify-between`}>
          <span>
            Status:{" "}
            {sessionStatus === "none"
              ? "Ready to chat"
              : sessionStatus.charAt(0).toUpperCase() + sessionStatus.slice(1)}
          </span>
          <div className={`w-3 h-3 rounded-full ${
            sessionStatus === 'pending' ? 'bg-yellow-500' :
            sessionStatus === 'active' ? 'bg-green-500' :
            sessionStatus === 'recent' ? 'bg-blue-500' :
            'bg-gray-500'
          }`} />
        </div>

        {/* Messages */}
        <div 
          ref={messagesContainerRef}
          className="flex-1 overflow-y-auto overflow-x-hidden p-4 sm:p-6 space-y-4 bg-slate-750 min-h-0 scrollbar-thin scrollbar-thumb-slate-600 scrollbar-track-slate-800"
          style={{ overscrollBehavior: 'contain' }}
        >
          {messages.length === 0 ? (
            <div className="text-center text-slate-400 py-12">
              <MessageCircle size={48} className="mx-auto mb-4 opacity-50" />
              <p className="text-lg mb-2">No messages yet</p>
              <p className="text-sm opacity-75">Start a conversation with our Guest Relations team</p>
            </div>
          ) : (
            messages.map((msg, index) => (
              <div
                key={`${msg.id}-${index}`}
                className={`flex ${msg.isFromStaff ? 'justify-start' : 'justify-end'}`}
              >
                <div className={`max-w-[75%] p-3 rounded-lg ${
                  msg.isFromStaff
                    ? 'bg-gray-600 text-white'
                    : 'bg-blue-600 text-white'
                }`}>
                  <div className="text-xs opacity-75 mb-1 font-medium">
                    {msg.sender_name}
                  </div>
                  <div className="text-sm leading-relaxed">{msg.message}</div>
                  <div className="text-xs opacity-75 mt-2">
                    {new Date(msg.timestamp).toLocaleTimeString()}
                  </div>
                </div>
              </div>
            ))
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="p-4 sm:p-6 border-t border-slate-600 bg-slate-800 flex-shrink-0">
          <div className="flex gap-3 items-end">
            <input
              type="text"
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
              placeholder={isConnected ? "Type your message..." : "Type your message..."}
              disabled={false}
              className="flex-1 px-4 py-3 border border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-slate-700 text-white placeholder-slate-400 disabled:opacity-50 min-h-[44px]"
            />
            <button
              onClick={sendMessage}
              disabled={!newMessage.trim()}
              className="bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed text-white px-4 py-3 rounded-lg transition-colors font-medium min-h-[44px] min-w-[44px] flex items-center justify-center flex-shrink-0"
            >
              <Send size={18} />
            </button>
          </div>
          <div className="mt-3 text-xs text-slate-400">
            {sessionStatus === "active"
              ? "Connected to Guest Relations"
              : "Chat ready"}
          </div>
        </div>
      </div>
    );
  }

  // Original blue bubble functionality is removed - only dialog mode is supported
  return null;
};

export default PlayerChatSystem;