import React, { useState, useEffect, useRef } from 'react';
import Pusher from 'pusher-js';

interface ChatMessage {
  id: string;
  sessionId: string;
  senderType: 'player' | 'gre';
  senderName: string;
  messageText: string;
  timestamp: string;
}

interface PlayerChatProps {
  playerId: number;
  playerName: string;
  playerEmail: string;
}

export default function PlayerChat({ playerId, playerName, playerEmail }: PlayerChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [messageText, setMessageText] = useState('');
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [chatStatus, setChatStatus] = useState<'waiting' | 'active' | 'resolved'>('waiting');
  const [isLoading, setIsLoading] = useState(false);
  
  const pusherRef = useRef<Pusher | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Initialize Pusher connection
  useEffect(() => {
    console.log('🔌 Initializing Pusher connection...');
    
    pusherRef.current = new Pusher('81b98cb04ef7aeef2baa', {
      cluster: 'ap2',
      encrypted: true
    });

    pusherRef.current.connection.bind('connected', () => {
      setIsConnected(true);
      console.log('✅ Connected to Pusher');
    });

    pusherRef.current.connection.bind('disconnected', () => {
      setIsConnected(false);
      console.log('❌ Disconnected from Pusher');
    });

    return () => {
      if (pusherRef.current) {
        pusherRef.current.disconnect();
      }
    };
  }, []);

  // Subscribe to session channel when session is created
  useEffect(() => {
    if (!pusherRef.current || !sessionId) return;

    console.log('📡 Subscribing to session:', sessionId);
    const channel = pusherRef.current.subscribe(`chat-session-${sessionId}`);

    channel.bind('new-message', (data: ChatMessage) => {
      console.log('📨 New message received:', data);
      setMessages(prev => [...prev, data]);
    });

    channel.bind('status-update', (data: any) => {
      console.log('📊 Status update:', data);
      setChatStatus(data.status);
    });

    return () => {
      pusherRef.current?.unsubscribe(`chat-session-${sessionId}`);
    };
  }, [sessionId]);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Start new chat session
  const startChat = async (initialMessage: string) => {
    setIsLoading(true);
    try {
      console.log('🚀 Starting new chat session...');
      
      const response = await fetch(`/api/pusher-chat/create-session`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          playerId,
          playerName,
          playerEmail,
          message: initialMessage,
          priority: 'normal',
          category: 'general'
        })
      });

      const result = await response.json();
      if (result.success) {
        setSessionId(result.sessionId);
        setChatStatus('waiting');
        console.log('✅ Chat session created:', result.sessionId);
      } else {
        console.error('❌ Failed to create session:', result.error);
        alert('Failed to start chat. Please try again.');
      }
    } catch (error) {
      console.error('❌ Error starting chat:', error);
      alert('Connection error. Please check your internet connection.');
    } finally {
      setIsLoading(false);
    }
  };

  // Send message
  const sendMessage = async () => {
    if (!messageText.trim() || !sessionId || isLoading) return;

    setIsLoading(true);
    try {
      console.log('💬 Sending message...');
      
      const response = await fetch(`/api/pusher-chat/send-message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          playerId,
          playerName,
          senderType: 'player',
          messageText,
          messageType: 'text'
        })
      });

      const result = await response.json();
      if (result.success) {
        setMessageText('');
        console.log('✅ Message sent successfully');
      } else {
        console.error('❌ Failed to send message:', result.error);
        alert('Failed to send message. Please try again.');
      }
    } catch (error) {
      console.error('❌ Error sending message:', error);
      alert('Failed to send message. Please check your connection.');
    } finally {
      setIsLoading(false);
    }
  };

  // Handle Enter key
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <div className="flex flex-col h-96 border rounded-lg bg-white shadow-lg">
      {/* Header */}
      <div className="p-4 border-b bg-blue-50">
        <h3 className="font-semibold text-gray-800">Live Chat Support</h3>
        <div className="flex items-center gap-2 text-sm mt-1">
          <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`} />
          <span className="text-gray-600">
            {isConnected ? 'Connected' : 'Connecting...'}
          </span>
          {sessionId && (
            <>
              <span className="text-gray-400">•</span>
              <span className={`capitalize font-medium ${
                chatStatus === 'active' ? 'text-green-600' : 
                chatStatus === 'waiting' ? 'text-yellow-600' : 'text-gray-600'
              }`}>
                {chatStatus === 'waiting' ? 'Waiting for staff...' : 
                 chatStatus === 'active' ? 'Staff online' : 'Chat ended'}
              </span>
            </>
          )}
        </div>
      </div>

      {/* Chat Area */}
      <div className="flex-1 p-4 overflow-y-auto bg-gray-50">
        {!sessionId ? (
          <div className="text-center h-full flex flex-col justify-center">
            <div className="mb-4">
              <div className="w-16 h-16 mx-auto mb-3 bg-blue-100 rounded-full flex items-center justify-center">
                <svg className="w-8 h-8 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
              </div>
              <p className="text-gray-600 mb-4">Need help? Start a conversation with our support team.</p>
              <button
                onClick={() => startChat('Hi, I need assistance with my account.')}
                disabled={!isConnected || isLoading}
                className="px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isLoading ? 'Starting...' : 'Start Chat'}
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex ${message.senderType === 'player' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-xs px-4 py-2 rounded-lg ${
                    message.senderType === 'player'
                      ? 'bg-blue-500 text-white rounded-br-sm'
                      : 'bg-white text-gray-900 border rounded-bl-sm shadow-sm'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-medium text-sm">
                      {message.senderType === 'player' ? 'You' : message.senderName}
                    </span>
                    <span className={`text-xs ${
                      message.senderType === 'player' ? 'text-blue-100' : 'text-gray-500'
                    }`}>
                      {new Date(message.timestamp).toLocaleTimeString([], { 
                        hour: '2-digit', 
                        minute: '2-digit' 
                      })}
                    </span>
                  </div>
                  <p className="text-sm">{message.messageText}</p>
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Input Area */}
      {sessionId && (
        <div className="p-4 border-t bg-white">
          <div className="flex gap-2">
            <textarea
              value={messageText}
              onChange={(e) => setMessageText(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Type your message..."
              rows={1}
              className="flex-1 px-3 py-2 border rounded-lg focus:outline-none focus:border-blue-500 resize-none"
              disabled={isLoading}
            />
            <button
              onClick={sendMessage}
              disabled={!messageText.trim() || !isConnected || isLoading}
              className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
            >
              {isLoading ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                </svg>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}