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
    
    // Subscribe to EXACT channels from staff portal spec
    const playerChannel = pusher.subscribe(`player-${playerId}`);
    const universalChannel = pusher.subscribe('universal-chat');
    
    console.log('📡 [PLAYER CHAT] Subscribed to channels:', `player-${playerId}`, 'universal-chat');
    
    // Listen for staff messages (EXACT event names from spec)
    playerChannel.bind('new-staff-message', handleIncomingMessage);
    playerChannel.bind('new-message', (data: any) => {
      if (data.senderType === 'staff' || data.sender === 'staff') {
        handleIncomingMessage(data);
      }
    });
    
    universalChannel.bind('new-message', (data: any) => {
      if ((data.player_id == playerId || data.playerId == playerId) && 
          (data.senderType === 'staff' || data.sender === 'staff')) {
        handleIncomingMessage(data);
      }
    });
    
    // Load existing messages
    loadExistingMessages();
    
    return () => {
      pusher.unsubscribe(`player-${playerId}`);
      pusher.unsubscribe('universal-chat');
      pusher.disconnect();
    };
  }, [playerId, playerName]);

  const handleIncomingMessage = (data: any) => {
    console.log('📨 [PLAYER CHAT] Received staff message:', data);
    
    const message: ChatMessage = {
      id: data.id || data.messageId || `msg-${Date.now()}`,
      message: data.message || data.messageText || data.message_text,
      sender: 'staff',
      sender_name: data.senderName || data.sender_name || 'Staff',
      timestamp: data.timestamp || new Date().toISOString(),
      isFromStaff: true
    };
    
    setMessages(prev => {
      const exists = prev.some(m => m.id === message.id);
      if (exists) return prev;
      return [...prev, message];
    });

    // Show notification if chat is closed
    if (!isOpen) {
      setHasUnread(true);
    }

    setSessionStatus('active');
  };

  const loadExistingMessages = async () => {
    try {
      console.log('📚 [PLAYER CHAT] Loading existing messages for player:', playerId);
      const response = await fetch(`/api/player-chat-integration/messages/${playerId}`);
      const data = await response.json();
      
      if (data.success && data.messages) {
        const formattedMessages: ChatMessage[] = data.messages.map((msg: any) => ({
          id: msg.id,
          message: msg.message || msg.messageText,
          sender: msg.isFromPlayer ? 'player' : 'staff',
          sender_name: msg.sender_name,
          timestamp: msg.timestamp,
          isFromStaff: !msg.isFromPlayer
        }));
        setMessages(formattedMessages);
        console.log('✅ [PLAYER CHAT] Loaded', formattedMessages.length, 'messages');
      }
    } catch (error) {
      console.error('❌ [PLAYER CHAT] Failed to load messages:', error);
    }
  };

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
          message: newMessage.trim(),
          isFromPlayer: true
        })
      });
      
      const result = await response.json();
      
      if (result.success) {
        const sentMessage: ChatMessage = {
          id: result.id,
          message: newMessage,
          sender: 'player',
          sender_name: playerName,
          timestamp: result.timestamp,
          isFromStaff: false
        };
        
        setMessages(prev => [...prev, sentMessage]);
        setNewMessage('');
        setSessionStatus('pending');
        console.log('✅ [PLAYER CHAT] Message sent successfully');
      }
    } catch (error) {
      console.error('❌ [PLAYER CHAT] Failed to send message:', error);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const openChat = () => {
    setIsOpen(true);
    setHasUnread(false);
  };

  const closeChat = () => {
    setIsOpen(false);
  };

  if (!isOpen) {
    return (
      <div className="fixed bottom-4 right-4 z-50">
        <button
          onClick={openChat}
          className="relative bg-blue-500 hover:bg-blue-600 text-white p-3 rounded-full shadow-lg transition-colors"
        >
          <MessageCircle size={24} />
          {hasUnread && (
            <div className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
              !
            </div>
          )}
        </button>
      </div>
    );
  }

  return (
    <div className="fixed bottom-4 right-4 z-50">
      <div className="flex flex-col h-96 w-80 bg-white border rounded-lg shadow-xl">
        {/* Header */}
        <div className="bg-blue-500 text-white p-4 rounded-t-lg flex justify-between items-center">
          <div>
            <h3 className="font-semibold">Customer Support</h3>
            <div className="flex items-center gap-2 text-sm">
              <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-300' : 'bg-red-300'}`}></div>
              {isConnected ? 'Connected' : 'Connecting...'}
              {sessionStatus !== 'none' && (
                <span className="ml-2 text-xs bg-blue-600 px-2 py-1 rounded">
                  {sessionStatus.toUpperCase()}
                </span>
              )}
            </div>
          </div>
          <button onClick={closeChat} className="text-white hover:text-gray-200">
            <X size={20} />
          </button>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50">
          {messages.length === 0 ? (
            <div className="text-center text-gray-500 text-sm">
              <MessageCircle className="mx-auto mb-2 opacity-50" size={32} />
              <p>Start a conversation with our support team</p>
            </div>
          ) : (
            messages.map(message => (
              <div key={message.id} className={`flex ${message.isFromStaff ? 'justify-start' : 'justify-end'}`}>
                <div className={`max-w-xs px-4 py-2 rounded-lg ${
                  message.isFromStaff
                    ? 'bg-white text-gray-800 border'
                    : 'bg-blue-500 text-white'
                }`}>
                  <div className="text-xs font-semibold mb-1 opacity-75">
                    {message.sender_name}
                  </div>
                  <p className="text-sm whitespace-pre-wrap">{message.message}</p>
                  <div className="text-xs opacity-60 mt-1">
                    {new Date(message.timestamp).toLocaleTimeString()}
                  </div>
                </div>
              </div>
            ))
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="border-t p-4 bg-white rounded-b-lg">
          <div className="flex gap-2">
            <input
              type="text"
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Type your message..."
              className="flex-1 px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              disabled={!isConnected}
            />
            <button
              onClick={sendMessage}
              disabled={!newMessage.trim() || !isConnected}
              className="px-3 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:bg-gray-400 transition-colors"
            >
              <Send size={16} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PlayerChatSystem;