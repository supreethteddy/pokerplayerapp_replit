import React, { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Send, MessageCircle, X, Minimize2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { createClient } from '@supabase/supabase-js';
import { motion, AnimatePresence } from "framer-motion";

interface ChatMessage {
  id: number | string;
  message: string;
  sender: 'player' | 'staff';
  sender_name: string;
  timestamp: string;
  status: 'sent' | 'delivered' | 'read' | 'received';
}





interface UnifiedGreChatDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

const UnifiedGreChatDialog: React.FC<UnifiedGreChatDialogProps> = ({ isOpen, onClose }) => {
  const { user, loading } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [isMinimized, setIsMinimized] = useState(false);
  const [playerData, setPlayerData] = useState<any>(null);
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'disconnected' | 'error'>('connecting');
  const pusherRef = useRef<any>(null);

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

  // Initialize Pusher connection for real-time messaging
  useEffect(() => {
    if (!isOpen || !playerId) return;

    const initializePusher = async () => {
      try {
        const Pusher = (await import('pusher-js')).default;

        const pusher = new Pusher('81b98cb04ef7aeef2baa', {
          cluster: 'ap2',
          forceTLS: true
        });

        // Store pusher reference for cleanup
        pusherRef.current = pusher;

        // Add comprehensive connection state listeners
        pusher.connection.bind('connected', () => {
          console.log('✅ [PUSHER] Connected successfully');
          setConnectionStatus('connected');
        });

        pusher.connection.bind('connecting', () => {
          console.log('🔄 [PUSHER] Connecting...');
          setConnectionStatus('connecting');
        });

        pusher.connection.bind('unavailable', () => {
          console.log('⚠️ [PUSHER] Connection unavailable');
          setConnectionStatus('error');
        });

        pusher.connection.bind('failed', () => {
          console.error('❌ [PUSHER] Connection failed');
          setConnectionStatus('error');
        });

        pusher.connection.bind('error', (error: any) => {
          console.error('❌ [PUSHER] Connection error:', error);
          setConnectionStatus('error');
        });

        pusher.connection.bind('disconnected', () => {
          console.log('🔌 [PUSHER] Disconnected');
          setConnectionStatus('disconnected');
        });

        const channel = pusher.subscribe(`player-${playerId}`);

        channel.bind('pusher:subscription_error', (error: any) => {
          console.error('❌ [PUSHER] Subscription error:', error);
        });

        channel.bind('pusher:subscription_succeeded', () => {
          console.log(`✅ [PUSHER] Successfully subscribed to player-${playerId} channel`);
        });

        channel.bind('new-gre-message', (data: any) => {
          console.log('🔔 [PUSHER] New GRE message received:', data);

          const newMsg: ChatMessage = {
            id: data.messageId || Date.now().toString(),
            message: data.message,
            sender: 'staff',
            sender_name: data.senderName || 'Guest Relations Executive',
            timestamp: data.timestamp || new Date().toISOString(),
            status: 'received'
          };

          setMessages(prev => [...prev, newMsg]);
          scrollToBottom();
        });

        channel.bind('new-player-message', (data: any) => {
          console.log('🔔 [PUSHER] Echo of player message:', data);
        });

        console.log(`✅ [PUSHER] Connected to player-${playerId} channel`);

      } catch (error) {
        console.error('❌ [PUSHER] Connection failed:', error);
        setConnectionStatus('error');
      }
    };

    initializePusher();
  }, [isOpen, playerId]);

  // Load existing messages
  useEffect(() => {
    if (!isOpen || !playerId) return;

    const loadMessages = async () => {
      try {
        const response = await fetch(`/api/unified-chat/messages/${playerId}`);
        if (response.ok) {
          const data = await response.json();
          console.log('📨 [MESSAGES] Loaded existing messages:', data.length);

          const formattedMessages: ChatMessage[] = data.map((msg: any) => ({
            id: msg.id,
            message: msg.message,
            sender: msg.sender === 'gre' ? 'staff' : 'player',
            sender_name: msg.sender_name || 'System',
            timestamp: msg.timestamp,
            status: msg.status || 'received'
          }));

          setMessages(formattedMessages);
        }
      } catch (error) {
        console.error('❌ [MESSAGES] Failed to load messages:', error);
      }
    };

    loadMessages();
  }, [isOpen, playerId]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const testConnection = async () => {
    if (!playerId) return;

    try {
      console.log('🧪 [CONNECTION TEST] Testing real-time connectivity...');

      const response = await fetch('/api/unified-chat/test-connection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ playerId })
      });

      if (response.ok) {
        const result = await response.json();
        console.log('✅ [CONNECTION TEST] Test completed:', result);
      } else {
        console.error('❌ [CONNECTION TEST] Test failed:', response.status);
      }
    } catch (error) {
      console.error('❌ [CONNECTION TEST] Error:', error);
    }
  };

  const sendMessage = async () => {
    if (!newMessage.trim() || !playerId || !playerName) {
      console.log('❌ [SEND] Missing required data:', { playerId, playerName, message: newMessage.trim() });
      return;
    }

    setIsLoading(true);

    try {
      console.log('📤 [SEND] Sending message:', { playerId, playerName, message: newMessage });

      const response = await fetch('/api/unified-chat/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          playerId: playerId,
          playerName: playerName,
          message: newMessage,
          senderType: 'player'
        }),
      });

      if (response.ok) {
        const result = await response.json();
        console.log('✅ [SEND] Message sent successfully:', result);

        // Add message to local state immediately
        const sentMessage: ChatMessage = {
          id: result.data?.id || Date.now().toString(),
          message: newMessage,
          sender: 'player',
          sender_name: playerName,
          timestamp: new Date().toISOString(),
          status: 'sent'
        };

        setMessages(prev => [...prev, sentMessage]);
        setNewMessage('');
        scrollToBottom();
      } else {
        console.error('❌ [SEND] Failed to send message:', response.status);
      }
    } catch (error) {
      console.error('❌ [SEND] Error sending message:', error);
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
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.8 }}
        className="fixed bottom-4 right-4 z-50 w-80"
      >
        <Card className="shadow-xl border-green-500/20">
          <CardHeader className="bg-green-600 text-white p-3 rounded-t-lg">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <MessageCircle className="h-5 w-5" />
                <CardTitle className="text-sm font-medium">Guest Relations</CardTitle>
                <div className={`w-2 h-2 rounded-full ${
                  connectionStatus === 'connected' ? 'bg-green-400' :
                  connectionStatus === 'connecting' ? 'bg-yellow-400 animate-pulse' :
                  connectionStatus === 'disconnected' ? 'bg-gray-400' :
                  'bg-red-400'
                }`} title={`Connection: ${connectionStatus}`} />
              </div>
              <div className="flex items-center space-x-1">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsMinimized(!isMinimized)}
                  className="text-white hover:bg-green-700 p-1 h-6 w-6"
                >
                  <Minimize2 className="h-3 w-3" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onClose}
                  className="text-white hover:bg-green-700 p-1 h-6 w-6"
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>
            </div>
          </CardHeader>

          {!isMinimized && (
            <CardContent className="p-0">
              <ScrollArea className="h-64 p-4">
                <div className="space-y-4">
                  {messages.length === 0 ? (
                    <div className="text-center text-gray-500 text-sm py-8">
                      <MessageCircle className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      <p>Start a conversation with our team!</p>
                    </div>
                  ) : (
                    messages.map((message) => (
                      <div
                        key={message.id}
                        className={`flex ${message.sender === 'player' ? 'justify-end' : 'justify-start'}`}
                      >
                        <div
                          className={`max-w-[80%] rounded-lg px-3 py-2 ${
                            message.sender === 'player'
                              ? 'bg-green-500 text-white'
                              : 'bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-gray-100'
                          }`}
                        >
                          <p className="text-sm">{message.message}</p>
                          <p className={`text-xs mt-1 ${
                            message.sender === 'player'
                              ? 'text-green-100'
                              : 'text-gray-500 dark:text-gray-400'
                          }`}>
                            {new Date(message.timestamp).toLocaleTimeString([], {
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </p>
                        </div>
                      </div>
                    ))
                  )}
                  <div ref={messagesEndRef} />
                </div>
              </ScrollArea>

              <div className="border-t border-gray-200 dark:border-gray-700 p-4">
                <div className="flex space-x-2">
                  <Input
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    onKeyPress={handleKeyPress}
                    placeholder="Type your message..."
                    disabled={isLoading || !playerId}
                    className="flex-1"
                  />
                  <Button
                    onClick={sendMessage}
                    disabled={isLoading || !newMessage.trim() || !playerId}
                    size="sm"
                    className="bg-green-500 hover:bg-green-600 text-white"
                  >
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
                <div className="flex items-center justify-between mt-2">
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Player: {playerName || 'Loading...'} (ID: {playerId || 'Loading...'})
                  </p>
                  <button
                    onClick={testConnection}
                    className="text-xs text-blue-500 hover:text-blue-600 underline"
                    disabled={!playerId}
                  >
                    Test Connection
                  </button>
                </div>
              </div>
            </CardContent>
          )}
        </Card>
      </motion.div>
    </AnimatePresence>
  );
};

export default UnifiedGreChatDialog;