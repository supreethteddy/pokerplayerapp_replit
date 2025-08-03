import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { X, Send, MessageCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import Pusher from 'pusher-js';

interface UnifiedGreChatDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

interface ChatMessage {
  id: string;
  message: string;
  sender: 'player' | 'gre';
  sender_name: string;
  timestamp: string;
  status: string;
}

export default function UnifiedGreChatDialog({ isOpen, onClose }: UnifiedGreChatDialogProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'disconnected'>('disconnected');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();
  
  // Get user info from localStorage
  const userInfo = JSON.parse(localStorage.getItem('user') || '{}');
  const playerId = userInfo.id;
  const playerName = `${userInfo.firstName || ''} ${userInfo.lastName || ''}`.trim();

  // Initialize Pusher connection
  useEffect(() => {
    if (!isOpen || !playerId) return;

    console.log('🚀 [PUSHER CHAT] Initializing Pusher connection for player:', playerId);
    
    setConnectionStatus('connecting');
    
    const pusher = new Pusher(import.meta.env.VITE_PUSHER_KEY!, {
      cluster: import.meta.env.VITE_PUSHER_CLUSTER!,
      forceTLS: true
    });

    const channel = pusher.subscribe(`player-${playerId}`);
    
    channel.bind('pusher:subscription_succeeded', () => {
      console.log('🚀 [PUSHER CHAT] Connected to player channel');
      setConnectionStatus('connected');
    });

    channel.bind('new-message', (data: any) => {
      console.log('🚀 [PUSHER CHAT] Received new message:', data);
      if (data.message) {
        setMessages(prev => [...prev, data.message]);
        scrollToBottom();
      }
    });

    channel.bind('message-sent', (data: any) => {
      console.log('🚀 [PUSHER CHAT] Message confirmed sent');
      // Message already added optimistically, no need to add again
    });

    pusher.connection.bind('error', (error: any) => {
      console.error('❌ [PUSHER CHAT] Connection error:', error);
      setConnectionStatus('disconnected');
      toast({
        title: "Connection Error",
        description: "Unable to connect to chat service",
        variant: "destructive"
      });
    });

    // Load existing messages
    loadChatHistory();

    return () => {
      pusher.unsubscribe(`player-${playerId}`);
      pusher.disconnect();
    };
  }, [isOpen, playerId]);

  const loadChatHistory = async () => {
    if (!playerId) return;

    try {
      const response = await fetch(`/api/production-chat/messages/${playerId}`);
      if (response.ok) {
        const chatHistory = await response.json();
        console.log('📋 [PRODUCTION CHAT] Loaded chat history:', chatHistory.length, 'messages');
        setMessages(chatHistory);
        setTimeout(scrollToBottom, 100);
      }
    } catch (error) {
      console.error('❌ [PRODUCTION CHAT] Error loading chat history:', error);
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const sendMessage = async () => {
    if (!newMessage.trim() || !playerId || !playerName) return;

    setIsLoading(true);
    const messageText = newMessage.trim();
    
    // Add message optimistically
    const tempMessage: ChatMessage = {
      id: `temp-${Date.now()}`,
      message: messageText,
      sender: 'player',
      sender_name: playerName,
      timestamp: new Date().toISOString(),
      status: 'sending'
    };
    
    setMessages(prev => [...prev, tempMessage]);
    setNewMessage('');
    scrollToBottom();

    try {
      const response = await fetch('/api/production-chat/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          playerId: playerId,
          message: messageText,
          playerName: playerName
        }),
      });

      if (response.ok) {
        const result = await response.json();
        console.log('✅ [PUSHER CHAT] Message sent successfully:', result);
        
        // Replace temp message with real one from data
        setMessages(prev => prev.map(msg => 
          msg.id === tempMessage.id ? {
            id: result.data.id,
            message: result.data.message,
            sender: result.data.sender,
            sender_name: playerName,
            timestamp: result.data.timestamp,
            status: result.data.status
          } : msg
        ));
        
        toast({
          title: "Message Sent",
          description: "Your message has been sent to Guest Relations",
        });
      } else {
        throw new Error('Failed to send message');
      }
    } catch (error) {
      console.error('❌ [PUSHER CHAT] Error sending message:', error);
      
      // Remove temp message on error
      setMessages(prev => prev.filter(msg => msg.id !== tempMessage.id));
      
      toast({
        title: "Send Failed",
        description: "Unable to send message. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <Card className="w-full max-w-md h-96 flex flex-col bg-gray-900 border-gray-700">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-white flex items-center gap-2">
            <MessageCircle className="h-5 w-5" />
            Guest Relations
          </CardTitle>
          <div className="flex items-center gap-2">
            <Badge variant={connectionStatus === 'connected' ? 'default' : 'destructive'}>
              {connectionStatus}
            </Badge>
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="text-gray-400 hover:text-white"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        
        <CardContent className="flex-1 flex flex-col p-4">
          <div className="flex-1 overflow-y-auto space-y-2 mb-4">
            {messages.length === 0 ? (
              <div className="text-center text-gray-500 mt-8">
                <MessageCircle className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>No messages yet. Start a conversation!</p>
              </div>
            ) : (
              messages.map((message) => (
                <div
                  key={message.id}
                  className={`flex ${message.sender === 'player' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-xs px-3 py-2 rounded-lg ${
                      message.sender === 'player'
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-700 text-gray-100'
                    }`}
                  >
                    <p className="text-sm">{message.message}</p>
                    <p className="text-xs opacity-70 mt-1">
                      {new Date(message.timestamp).toLocaleTimeString()}
                      {message.status === 'sending' && ' • Sending...'}
                    </p>
                  </div>
                </div>
              ))
            )}
            <div ref={messagesEndRef} />
          </div>
          
          <div className="flex gap-2">
            <Input
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Type your message..."
              disabled={isLoading || connectionStatus !== 'connected'}
              className="flex-1 bg-gray-800 border-gray-600 text-white"
            />
            <Button
              onClick={sendMessage}
              disabled={!newMessage.trim() || isLoading || connectionStatus !== 'connected'}
              size="sm"
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}