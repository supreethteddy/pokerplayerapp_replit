import React, { useState, useEffect, useRef } from 'react';
import Pusher from 'pusher-js';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MessageCircle, X, Send } from 'lucide-react';
import { useToast } from "@/hooks/use-toast";

interface UnifiedChatDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
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

const UnifiedChatDialog: React.FC<UnifiedChatDialogProps> = ({
  isOpen,
  onOpenChange,
  playerId,
  playerName
}) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [isConnected, setIsConnected] = useState(false);
  const [sessionStatus, setSessionStatus] = useState<'none' | 'pending' | 'active' | 'recent'>('none');
  const [isSending, setIsSending] = useState(false);
  const pusherRef = useRef<Pusher | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Initialize Pusher connection with bidirectional logic
  useEffect(() => {
    if (!playerId || !playerName) return;
    
    console.log('🚀 [UNIFIED CHAT] Initializing for player:', playerId, playerName);
    
    // Initialize Pusher with exact credentials
    const pusher = new Pusher('81b98cb04ef7aeef2baa', {
      cluster: 'ap2',
      forceTLS: true
    });
    
    pusherRef.current = pusher;
    
    pusher.connection.bind('connected', () => {
      setIsConnected(true);
      console.log('✅ [UNIFIED CHAT] Connected to Pusher');
    });

    pusher.connection.bind('disconnected', () => {
      setIsConnected(false);
      console.log('❌ [UNIFIED CHAT] Disconnected from Pusher');
    });
    
    // Subscribe to bidirectional channels
    const playerChannel = pusher.subscribe(`player-${playerId}`);
    const staffChannel = pusher.subscribe('staff-portal');
    
    console.log('📡 [UNIFIED CHAT] Subscribed to channels:', `player-${playerId}`, 'staff-portal');
    
    // Unified message handler for all message types
    const handleIncomingMessage = (data: any) => {
      console.log('📨 [UNIFIED CHAT] Message received:', data);
      
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
        
        // Update session status based on message activity
        if (messageData.isFromStaff) {
          setSessionStatus('active');
        }
      }
    };
    
    // Listen for all message event types
    playerChannel.bind('chat-message-received', handleIncomingMessage);
    playerChannel.bind('new-staff-message', handleIncomingMessage);
    playerChannel.bind('new-message', handleIncomingMessage);
    
    // Listen for staff channel broadcasts
    staffChannel.bind('chat-message-received', (data: any) => {
      if (data.type === 'staff-to-player' && data.playerId == playerId) {
        handleIncomingMessage(data);
      }
    });
    
    // Listen for status updates
    playerChannel.bind('chat-status-updated', (data: any) => {
      console.log('📊 [UNIFIED CHAT] Status updated:', data);
      if (data.playerId == playerId) {
        setSessionStatus(data.status || 'active');
      }
    });

    // Load existing messages
    const loadExistingMessages = async () => {
      try {
        console.log('📚 [UNIFIED CHAT] Loading existing messages for player:', playerId);
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
          console.log('✅ [UNIFIED CHAT] Loaded', formattedMessages.length, 'messages');
        }
      } catch (error) {
        console.error('❌ [UNIFIED CHAT] Failed to load messages:', error);
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
    if (!newMessage.trim() || !isConnected || isSending) return;
    
    setIsSending(true);
    try {
      console.log('📤 [UNIFIED CHAT] Sending message:', newMessage);
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
        console.log('✅ [UNIFIED CHAT] Message sent successfully:', result);
        
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
        
        toast({
          title: "Message Sent",
          description: "Your message has been sent to our support team"
        });
      } else {
        console.error('❌ [UNIFIED CHAT] Failed to send message:', response.statusText);
        toast({
          title: "Error",
          description: "Failed to send message. Please try again.",
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error('❌ [UNIFIED CHAT] Send error:', error);
      toast({
        title: "Error",
        description: "Failed to send message. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsSending(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
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
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] h-[600px] flex flex-col p-0 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
        {/* Header */}
        <DialogHeader className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-emerald-500/20 rounded-full">
                <MessageCircle className="w-5 h-5 text-emerald-400" />
              </div>
              <div>
                <DialogTitle className="text-gray-900 dark:text-white text-lg">
                  Guest Relations Support
                </DialogTitle>
                <div className="flex items-center space-x-2 text-sm text-gray-500 dark:text-gray-400">
                  <div className={`w-2 h-2 rounded-full ${
                    sessionStatus === 'pending' ? 'bg-yellow-500' :
                    sessionStatus === 'active' ? 'bg-green-500' :
                    sessionStatus === 'recent' ? 'bg-blue-500' :
                    'bg-gray-500'
                  }`} />
                  <span>Status: {sessionStatus === 'none' ? 'Ready' : sessionStatus.charAt(0).toUpperCase() + sessionStatus.slice(1)}</span>
                  {!isConnected && <span className="text-red-500">• Disconnected</span>}
                </div>
              </div>
            </div>
          </div>
        </DialogHeader>

        {/* Messages Area */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-gray-50 dark:bg-gray-900">
          {messages.length === 0 ? (
            <div className="text-center py-8">
              <MessageCircle className="w-12 h-12 mx-auto mb-4 text-emerald-400 opacity-50" />
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                Start Conversation
              </h3>
              <p className="text-gray-500 dark:text-gray-400 mb-4">
                Connect with our Guest Relations team for immediate assistance with any questions or concerns.
              </p>
              <div className="text-emerald-500 text-sm font-medium">
                Type your message below to begin
              </div>
            </div>
          ) : (
            messages.map((msg, index) => (
              <div
                key={`${msg.id}-${index}`}
                className={`flex ${msg.isFromStaff ? 'justify-start' : 'justify-end'}`}
              >
                <div className={`max-w-[80%] p-3 rounded-lg ${
                  msg.isFromStaff
                    ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white border border-gray-200 dark:border-gray-600'
                    : 'bg-emerald-600 text-white'
                }`}>
                  <div className="text-xs opacity-75 mb-1 font-medium">
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

        {/* Input Area */}
        <div className="p-4 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
          <div className="flex space-x-2">
            <Input
              type="text"
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder={isConnected ? "Type your message..." : "Connecting..."}
              disabled={!isConnected || isSending}
              className="flex-1 bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 focus:ring-emerald-500 focus:border-emerald-500"
            />
            <Button
              onClick={sendMessage}
              disabled={!newMessage.trim() || !isConnected || isSending}
              className="bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed text-white px-4"
            >
              {isSending ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <Send size={16} />
              )}
            </Button>
          </div>
          
          {/* Connection Status */}
          <div className="mt-2 flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
            <div className="flex items-center space-x-2">
              <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`} />
              <span>{isConnected ? 'Connected' : 'Connecting...'}</span>
            </div>
            <span className={getStatusColor()}>
              {sessionStatus === 'none' ? 'Ready to chat' : `Session ${sessionStatus}`}
            </span>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default UnifiedChatDialog;