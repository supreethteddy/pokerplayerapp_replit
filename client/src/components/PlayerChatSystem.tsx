import React, { useState, useEffect, useRef } from 'react';
import Pusher from 'pusher-js';
import { MessageCircle, X, Send } from 'lucide-react';

interface PlayerChatSystemProps {
  playerId: number;
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
  const [isConnected, setIsConnected] = useState(false);
  const [sessionStatus, setSessionStatus] = useState<'none' | 'pending' | 'active' | 'recent'>('none');
  const [isOpen, setIsOpen] = useState(false);
  const [hasUnread, setHasUnread] = useState(false);
  const pusherRef = useRef<Pusher | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    if (!playerId || !playerName) return;
    
    console.log('🚀 [PLAYER CHAT] Initializing for player:', playerId, playerName);
    
    // Initialize Pusher with environment variables to match Staff Portal
    if (!import.meta.env.VITE_PUSHER_KEY) {
      console.error('❌ [PUSHER CONFIG] VITE_PUSHER_KEY not found in environment');
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
      
      // CRITICAL: Prevent duplicate messages from player confirmation
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
        isFromStaff: data.sender === 'staff' || data.senderType === 'staff' || data.sender_name !== playerName
      };
      
      // ONLY add messages from staff - prevent player message echoing
      if (messageData.message && messageData.isFromStaff) {
        setMessages(prev => {
          // Prevent duplicate messages
          const isDuplicate = prev.some(msg => 
            msg.id === messageData.id || 
            (msg.message === messageData.message && 
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
      }
    });

    // Load existing messages
    const loadExistingMessages = async () => {
      try {
        console.log('📚 [PLAYER CHAT] Loading existing messages for player:', playerId);
        const response = await fetch(`/api/chat-history/${playerId}`);
        const data = await response.json();
        
        if (data.success && data.conversations && data.conversations[0]) {
          const formattedMessages: ChatMessage[] = data.conversations[0].chat_messages.map((msg: any) => ({
            id: msg.id,
            message: msg.message_text,
            sender: msg.sender as 'player' | 'staff',
            sender_name: msg.sender_name,
            timestamp: msg.timestamp,
            isFromStaff: msg.sender === 'staff'
          }));
          setMessages(formattedMessages);
          console.log('✅ [PLAYER CHAT] Loaded', formattedMessages.length, 'messages');
        }
      } catch (error) {
        console.error('❌ [PLAYER CHAT] Failed to load messages:', error);
      }
    };
    
    loadExistingMessages();
    
    return () => {
      pusher.unsubscribe(`player-${playerId}`);
      pusher.unsubscribe('staff-portal');
      pusher.disconnect();
    };
  }, [playerId, playerName]);

  const sendMessage = async () => {
    if (!newMessage.trim() || !isConnected) return;
    
    const messageText = newMessage.trim();
    const messageId = `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const timestamp = new Date().toISOString();
    
    // Immediate UI update (optimistic) - ZERO delay for user
    const optimisticMsg: ChatMessage = {
      id: messageId,
      message: messageText,
      sender: 'player',
      sender_name: playerName,
      timestamp: timestamp,
      isFromStaff: false
    };
    
    setMessages(prev => [...prev, optimisticMsg]);
    setNewMessage('');
    setSessionStatus('pending');
    
    try {
      console.log('⚡ [OPTIMIZED V1.2] Sending message to staff portal:', messageText);
      
      // Fire and forget - don't wait for response
      fetch('/api/staff-chat-integration/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          playerId: parseInt(playerId.toString()),
          playerName: playerName,
          message: messageText,
          requestId: `player-${playerId}-${Date.now()}`
        })
      }).then(async (response) => {
        if (response.ok) {
          const result = await response.json();
          console.log('✅ [OPTIMIZED V1.2] Background confirmation:', result);
        } else {
          console.error('❌ [OPTIMIZED V1.2] Server error (non-critical):', response.statusText);
        }
      }).catch((error) => {
        console.error('❌ [OPTIMIZED V1.2] Network error (non-critical):', error);
      });
      
    } catch (error) {
      console.error('❌ [OPTIMIZED V1.2] Send error:', error);
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
      <div className="flex flex-col h-[500px]">
        {/* Status Bar */}
        <div className={`px-3 py-2 text-sm ${getStatusColor()} bg-slate-900 border-b border-slate-600 flex items-center justify-between`}>
          <span>
            Status: {sessionStatus === 'none' ? 'Ready to chat' : sessionStatus.charAt(0).toUpperCase() + sessionStatus.slice(1)}
            {!isConnected && ' • Connecting...'}
          </span>
          <div className={`w-3 h-3 rounded-full ${
            sessionStatus === 'pending' ? 'bg-yellow-500' :
            sessionStatus === 'active' ? 'bg-green-500' :
            sessionStatus === 'recent' ? 'bg-blue-500' :
            'bg-gray-500'
          }`} />
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-750">
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
        <div className="p-4 border-t border-slate-600 bg-slate-800">
          <div className="flex space-x-3">
            <input
              type="text"
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
              placeholder={isConnected ? "Type your message..." : "Connecting..."}
              disabled={!isConnected}
              className="flex-1 px-4 py-3 border border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-slate-700 text-white placeholder-slate-400 disabled:opacity-50"
            />
            <button
              onClick={sendMessage}
              disabled={!newMessage.trim() || !isConnected}
              className="bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed text-white px-6 py-3 rounded-lg transition-colors font-medium"
            >
              <Send size={18} />
            </button>
          </div>
          <div className="mt-2 text-xs text-slate-400">
            {isConnected ? 'Connected to Guest Relations' : 'Connecting...'}
          </div>
        </div>
      </div>
    );
  }

  // Original blue bubble functionality is removed - only dialog mode is supported
  return null;
};

export default PlayerChatSystem;