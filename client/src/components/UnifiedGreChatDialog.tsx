import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { X, Send, MessageCircle, Trash2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { createClient } from '@supabase/supabase-js';
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
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'disconnected'>('connected');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [chatEnabled, setChatEnabled] = useState(true);
  const [playerData, setPlayerData] = useState<any>(null);
  const { toast } = useToast();
  const { user, loading } = useAuth();
  
  // Enhanced debugging for authentication state
  console.log('🔍 [AUTH DEBUG] useAuth hook state:', { user, loading });
  console.log('🔍 [AUTH DEBUG] User object keys:', user ? Object.keys(user) : 'user is null');
  console.log('🔍 [AUTH DEBUG] Full user object:', JSON.stringify(user, null, 2));
  
  // Fallback: Get user data directly from Supabase if useAuth fails
  useEffect(() => {
    const fetchPlayerDataDirectly = async () => {
      if (user?.id) {
        console.log('✅ [AUTH DEBUG] useAuth working, using user data');
        setPlayerData(user);
        return;
      }
      
      console.log('🔄 [AUTH DEBUG] useAuth failed, trying Supabase session...');
      
      try {
        const supabase = createClient(
          import.meta.env.VITE_SUPABASE_URL!,
          import.meta.env.VITE_SUPABASE_ANON_KEY!
        );
        
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
          console.log('🔄 [AUTH DEBUG] Found Supabase session, fetching player data...');
          
          const response = await fetch(`/api/players/supabase/${session.user.id}`);
          if (response.ok) {
            const userData = await response.json();
            console.log('✅ [AUTH DEBUG] Direct API call successful:', userData);
            setPlayerData(userData);
          } else {
            console.log('❌ [AUTH DEBUG] Direct API call failed:', response.status);
          }
        } else {
          console.log('❌ [AUTH DEBUG] No Supabase session found');
        }
      } catch (error) {
        console.error('❌ [AUTH DEBUG] Error fetching player data:', error);
      }
    };
    
    if (isOpen) {
      fetchPlayerDataDirectly();
    }
  }, [isOpen, user]);
  
  // Get user info with robust fallback system
  const playerId = playerData?.id || user?.id;
  const playerName = playerData ? 
    `${playerData.firstName || ''} ${playerData.lastName || ''}`.trim() :
    `${user?.firstName || ''} ${user?.lastName || ''}`.trim();
  
  console.log('🔍 [AUTH DEBUG] Final playerId:', playerId);
  console.log('🔍 [AUTH DEBUG] Final playerName:', playerName);
  console.log('🔍 [AUTH DEBUG] PlayerData source:', playerData ? 'direct API' : 'useAuth');
  console.log('🔍 [AUTH DEBUG] Loading state:', loading);

  // Initialize Pusher connection
  useEffect(() => {
    if (!isOpen || !playerId) return;

    console.log('🚀 [PUSHER CHAT] Initializing Pusher connection for player:', playerId);
    
    setConnectionStatus('connecting');
    
    // Get Pusher credentials from environment - using fresh credentials
    const pusherKey = import.meta.env.VITE_PUSHER_KEY || '81b98cb04ef7aeef2baa';
    const pusherCluster = import.meta.env.VITE_PUSHER_CLUSTER || 'ap2';
    
    console.log('🔗 [PUSHER FRONTEND] Using credentials - Key:', pusherKey, 'Cluster:', pusherCluster);
    
    if (!pusherKey || !pusherCluster) {
      console.error('❌ [PUSHER CHAT] Missing Pusher credentials');
      setConnectionStatus('disconnected');
      toast({
        title: "Configuration Error",
        description: "Chat service not configured properly",
        variant: "destructive"
      });
      return;
    }

    const pusher = new Pusher(pusherKey, {
      cluster: pusherCluster,
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
      console.log('📋 [EXPERT CHAT] Loading comprehensive chat history for player:', playerId);
      const response = await fetch(`/api/unified-chat/messages/${playerId}`);
      if (response.ok) {
        const chatHistory = await response.json();
        console.log('✅ [EXPERT CHAT] Loaded enterprise chat history:', chatHistory.length, 'messages');
        setMessages(chatHistory);
        setTimeout(scrollToBottom, 100);
      }
    } catch (error) {
      console.error('❌ [EXPERT CHAT] Error loading chat history:', error);
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // ULTIMATE CHAT FIX: Unified send handler for button and enter key
  const sendMessage = async () => {
    console.log('🔥 [BUTTON DEBUG] Send button clicked!');
    console.log('🔥 [BUTTON DEBUG] newMessage:', newMessage);
    console.log('🔥 [BUTTON DEBUG] playerId:', playerId);
    console.log('🔥 [BUTTON DEBUG] playerName:', playerName);
    
    if (!newMessage.trim() || !playerId || !playerName) {
      console.log('❌ [BUTTON DEBUG] Validation failed - missing required data');
      return;
    }

    setIsLoading(true);
    const messageText = newMessage.trim();
    
    try {
      console.log('🚀 [ULTIMATE CHAT] Sending message:', messageText);
      
      const payload = {
        player_id: parseInt(playerId),
        player_name: playerName,
        message: messageText,
        timestamp: new Date().toISOString(),
        gre_id: null
      };
      
      console.log('📝 [ULTIMATE CHAT] Sending payload:', payload);
      
      const response = await fetch('/api/unified-chat/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const result = await response.json();
      
      if (!response.ok) {
        console.error('❌ [ULTIMATE CHAT] Server error:', result);
        throw new Error(result.error || `Server returned ${response.status}`);
      }

      console.log('✅ [ULTIMATE CHAT] Success response:', result);
      
      // Add message to local chat immediately
      const newMsg: ChatMessage = {
        id: result.data?.id || `local-${Date.now()}`,
        message: messageText,
        sender: 'player',
        sender_name: playerName,
        timestamp: new Date().toISOString(),
        status: 'sent'
      };
      
      setMessages(prev => [...prev, newMsg]);
      setNewMessage(''); // Clear input
      
      // Scroll to bottom
      setTimeout(() => {
        scrollToBottom();
      }, 100);
      
      console.log('🎉 [ULTIMATE CHAT] Message added to UI and cleared input');
      
      toast({
        title: "Message Sent",
        description: "Your message has been delivered to Guest Relations",
      });
      
    } catch (error) {
      console.error('💥 [ULTIMATE CHAT] Send failed:', error);
      
      toast({
        title: "Chat Error",
        description: `Failed to send: ${error instanceof Error ? error.message : 'Unknown error'}`,
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
            <Badge variant="default" className="bg-emerald-600">
              Chat Active
            </Badge>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setMessages([]);
                toast({
                  title: "Chat Cleared",
                  description: "All messages have been cleared"
                });
              }}
              className="text-gray-400 hover:text-red-400"
              title="Clear chat"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
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
              disabled={isLoading}
              className="flex-1 bg-gray-800 border-gray-600 text-white"
            />
            <Button
              onClick={sendMessage}
              disabled={!newMessage.trim() || isLoading}
              size="sm"
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              {isLoading ? (
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}