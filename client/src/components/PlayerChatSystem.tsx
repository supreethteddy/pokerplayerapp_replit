import React, { useState, useEffect, useRef } from 'react';
import Pusher from 'pusher-js';
import { MessageCircle, X, Send } from 'lucide-react';

interface PlayerChatSystemProps {
  playerId: number;
  playerName: string;
}

interface ChatMessage {
  id: string;
  message: string;
  sender: 'player' | 'staff';
  sender_name: string;
  timestamp: string;
  isFromStaff: boolean;
}

const PlayerChatSystem: React.FC<PlayerChatSystemProps> = ({ playerId, playerName }) => {
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
    
    // Initialize Pusher with EXACT credentials from staff portal
    const pusher = new Pusher('81b98cb04ef7aeef2baa', {
      cluster: 'ap2',
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
    
    // UNIFIED event handler for all message types
    const handleIncomingMessage = (data: any) => {
      console.log('📨 [PLAYER CHAT] Message received:', data);
      
      // Handle different data formats from staff portal
      const messageData = {
        id: data.id || data.messageId || `msg-${Date.now()}`,
        message: data.message || data.messageText || data.text || '',
        sender: data.sender || (data.isFromPlayer ? 'player' : 'staff'),
        sender_name: data.sender_name || data.senderName || data.staffName || 'Staff Member',
        timestamp: data.timestamp || new Date().toISOString(),
        isFromStaff: data.sender === 'staff' || data.senderType === 'staff' || !data.isFromPlayer
      };
      
      if (messageData.message && messageData.sender) {
        setMessages(prev => {
          // Prevent duplicate messages
          if (prev.find(msg => msg.id === messageData.id)) {
            return prev;
          }
          return [...prev, messageData].sort((a, b) => 
            new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
          );
        });
        
        // Mark as unread if chat is closed and message is from staff
        if (!isOpen && messageData.isFromStaff) {
          setHasUnread(true);
        }
        
        // Update session status based on message activity
        if (messageData.isFromStaff) {
          setSessionStatus('active');
        }
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
    
    try {
      console.log('📤 [PLAYER CHAT] Sending message:', newMessage);
      const response = await fetch('/api/player-chat-integration/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          playerId: parseInt(playerId.toString()),
          playerName: playerName,
          message: newMessage,
          isFromPlayer: true
        })
      });

      if (response.ok) {
        const result = await response.json();
        console.log('✅ [PLAYER CHAT] Message sent successfully:', result);
        
        // Add message to local state immediately
        const newMsg: ChatMessage = {
          id: result.id || `msg-${Date.now()}`,
          message: newMessage,
          sender: 'player',
          sender_name: playerName,
          timestamp: new Date().toISOString(),
          isFromStaff: false
        };
        
        setMessages(prev => [...prev, newMsg]);
        setNewMessage('');
        setSessionStatus('pending');
      } else {
        console.error('❌ [PLAYER CHAT] Failed to send message:', response.statusText);
      }
    } catch (error) {
      console.error('❌ [PLAYER CHAT] Send error:', error);
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

  return (
    <div className="fixed bottom-4 right-4 z-50">
      {/* Chat Toggle Button */}
      {!isOpen && (
        <button
          onClick={toggleChat}
          className={`relative bg-blue-600 hover:bg-blue-700 text-white p-3 rounded-full shadow-lg transition-colors ${
            !isConnected ? 'opacity-50 cursor-not-allowed' : ''
          }`}
          disabled={!isConnected}
        >
          <MessageCircle size={24} />
          
          {/* Unread indicator */}
          {hasUnread && (
            <div className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center animate-pulse">
              !
            </div>
          )}
          
          {/* Status indicator */}
          <div className={`absolute -bottom-1 -right-1 w-3 h-3 rounded-full ${
            sessionStatus === 'pending' ? 'bg-yellow-500' :
            sessionStatus === 'active' ? 'bg-green-500' :
            sessionStatus === 'recent' ? 'bg-blue-500' :
            'bg-gray-500'
          }`} />
        </button>
      )}

      {/* Chat Window */}
      {isOpen && (
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-xl w-80 h-96 flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between p-3 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center space-x-2">
              <MessageCircle size={20} className="text-blue-600" />
              <span className="font-semibold text-gray-900 dark:text-white">Guest Relations</span>
              <div className={`w-2 h-2 rounded-full ${
                sessionStatus === 'pending' ? 'bg-yellow-500' :
                sessionStatus === 'active' ? 'bg-green-500' :
                sessionStatus === 'recent' ? 'bg-blue-500' :
                'bg-gray-500'
              }`} />
            </div>
            <button
              onClick={closeChat}
              className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            >
              <X size={20} />
            </button>
          </div>

          {/* Status Bar */}
          <div className={`px-3 py-1 text-xs ${getStatusColor()} bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700`}>
            Status: {sessionStatus === 'none' ? 'Ready to chat' : sessionStatus.charAt(0).toUpperCase() + sessionStatus.slice(1)}
            {!isConnected && ' • Disconnected'}
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {messages.length === 0 ? (
              <div className="text-center text-gray-500 dark:text-gray-400 py-8">
                <MessageCircle size={32} className="mx-auto mb-2 opacity-50" />
                <p>No messages yet</p>
                <p className="text-xs">Start a conversation with our team</p>
              </div>
            ) : (
              messages.map((msg, index) => (
                <div
                  key={`${msg.id}-${index}`}
                  className={`flex ${msg.isFromStaff ? 'justify-start' : 'justify-end'}`}
                >
                  <div className={`max-w-[80%] p-2 rounded-lg ${
                    msg.isFromStaff
                      ? 'bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white'
                      : 'bg-blue-600 text-white'
                  }`}>
                    <div className="text-xs opacity-75 mb-1">
                      {msg.sender_name}
                    </div>
                    <div className="text-sm">{msg.message}</div>
                    <div className="text-xs opacity-75 mt-1">
                      {new Date(msg.timestamp).toLocaleTimeString()}
                    </div>
                  </div>
                </div>
              ))
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="p-3 border-t border-gray-200 dark:border-gray-700">
            <div className="flex space-x-2">
              <input
                type="text"
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
                placeholder={isConnected ? "Type your message..." : "Connecting..."}
                disabled={!isConnected}
                className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white disabled:opacity-50"
              />
              <button
                onClick={sendMessage}
                disabled={!newMessage.trim() || !isConnected}
                className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white p-2 rounded-lg transition-colors"
              >
                <Send size={16} />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PlayerChatSystem;