import React, { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Send, MessageCircle, X, Minimize2, History, Trash2 } from "lucide-react";
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
  onOpenChange?: (open: boolean) => void;
  externalMessages?: any[];
  onMessagesUpdate?: (messages: any[]) => void;
}

const UnifiedGreChatDialog: React.FC<UnifiedGreChatDialogProps> = ({ 
  isOpen, 
  onClose, 
  onOpenChange,
  externalMessages = [], 
  onMessagesUpdate 
}) => {
  const { user, loading } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [showingHistory, setShowingHistory] = useState(false);
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

  // Initialize Pusher connection for real-time messaging - ALWAYS ACTIVE
  useEffect(() => {
    if (!playerId) {
      console.log('🔥 [NUCLEAR] No playerId, skipping Pusher initialization');
      return;
    }
    
    console.log('🔥 [NUCLEAR] Initializing Pusher for playerId:', playerId, 'Chat open:', isOpen);

    const initializePusher = async () => {
      try {
        const Pusher = (await import('pusher-js')).default;

        // Use environment variables for Pusher configuration
        const pusherKey = import.meta.env.VITE_PUSHER_KEY || '81b98cb04ef7aeef2baa';
        const pusherCluster = import.meta.env.VITE_PUSHER_CLUSTER || 'ap2';
        
        console.log('🔍 [PUSHER] Environment variables:', { pusherKey, pusherCluster });
        
        const pusher = new Pusher(pusherKey, {
          cluster: pusherCluster,
          forceTLS: true,
          enabledTransports: ['ws', 'wss'],
          disabledTransports: []
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

        // Subscribe to BOTH player-specific channel AND staff-portal channel for complete coverage
        const playerChannel = pusher.subscribe(`player-${playerId}`);
        const staffChannel = pusher.subscribe('staff-portal');

        playerChannel.bind('pusher:subscription_error', (error: any) => {
          console.error('❌ [PUSHER] Player channel subscription error:', error);
        });

        playerChannel.bind('pusher:subscription_succeeded', () => {
          console.log(`✅ [PUSHER] Successfully subscribed to player-${playerId} channel`);
        });

        staffChannel.bind('pusher:subscription_error', (error: any) => {
          console.error('❌ [PUSHER] Staff channel subscription error:', error);
        });

        staffChannel.bind('pusher:subscription_succeeded', () => {
          console.log(`✅ [PUSHER] Successfully subscribed to staff-portal channel`);
        });

        // Listen for GRE messages on player channel - NANOSECOND DELIVERY
        playerChannel.bind('new-gre-message', (data: any) => {
          console.log('🚀 [NANOSECOND] New GRE message received:', data);

          const newMsg: ChatMessage = {
            id: data.messageId || `gre-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            message: data.message,
            sender: 'staff',
            sender_name: data.senderName || 'Guest Relations Executive',
            timestamp: data.timestamp || new Date().toISOString(),
            status: 'received'
          };

          // FORCE CHAT OPEN IMMEDIATELY WHEN MESSAGE ARRIVES - NUCLEAR IMPLEMENTATION
          if (!isOpen && onOpenChange) {
            console.log('🔥 [NUCLEAR] Auto-opening chat for incoming message');
            onOpenChange(true);
          } else if (!isOpen) {
            console.log('🔥 [NUCLEAR] WARNING: Chat is closed, message added but not visible!');
            console.log('🔥 [NUCLEAR] User must manually open chat to see messages');
          }

          setMessages(prev => {
            // Check if message already exists to prevent duplicates (exact ID match only)
            const exists = prev.some(msg => msg.id === newMsg.id);
            
            if (exists) {
              console.log('⚠️ [PUSHER] Duplicate message prevented (same ID):', newMsg.id);
              return prev;
            }
            
            console.log('🚀 [NUCLEAR] INSTANT UI UPDATE - Message added');
            console.log('🚀 [NUCLEAR] Previous messages count:', prev.length);
            console.log('🚀 [NUCLEAR] New message being added:', newMsg);
            const updated = [...prev, newMsg];
            console.log('🚀 [NUCLEAR] Updated messages count:', updated.length);
            console.log('🚀 [NUCLEAR] All messages after update:', updated);
            
            // FORCE RE-RENDER IMMEDIATELY WITH MULTIPLE APPROACHES
            setTimeout(() => {
              scrollToBottom();
              console.log('🚀 [NUCLEAR] Scroll triggered, final count:', updated.length);
            }, 0);
            
            // ALSO FORCE EXTERNAL CALLBACK UPDATE
            if (onMessagesUpdate) {
              console.log('🚀 [NUCLEAR] Triggering external message update callback');
              onMessagesUpdate(updated.map(msg => ({
                id: msg.id,
                player_id: playerId,
                message: msg.message,
                sender: msg.sender === 'staff' ? 'gre' : 'player',
                sender_name: msg.sender_name,
                timestamp: msg.timestamp,
                status: msg.status
              })));
            }
            
            return updated;
          });
        });

        playerChannel.bind('new-player-message', (data: any) => {
          console.log('🔔 [PUSHER] Echo of player message:', data);
        });

        // CRITICAL: Listen for GRE messages on staff-portal channel - NANOSECOND PRIORITY
        staffChannel.bind('new-gre-message', (data: any) => {
          console.log('🚀 [NANOSECOND] Staff portal GRE message received:', data);
          
          // Only process messages for this specific player
          if (data.playerId === playerId || data.player_id === playerId) {
            const newMsg: ChatMessage = {
              id: data.messageId || `staff-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
              message: data.message,
              sender: 'staff',
              sender_name: data.senderName || data.sender_name || 'Guest Relations Executive',
              timestamp: data.timestamp || new Date().toISOString(),
              status: 'received'
            };

            // FORCE CHAT OPEN IMMEDIATELY WHEN MESSAGE ARRIVES - NUCLEAR IMPLEMENTATION  
            if (!isOpen && onOpenChange) {
              console.log('🔥 [NUCLEAR] Auto-opening chat for staff message');
              onOpenChange(true);
            } else if (!isOpen) {
              console.log('🔥 [NUCLEAR] WARNING: Staff message received but chat is closed!');
              console.log('🔥 [NUCLEAR] User must manually open chat to see messages');
            }

            setMessages(prev => {
              // Check if message already exists to prevent duplicates (exact ID match only)
              const exists = prev.some(msg => msg.id === newMsg.id);
              
              if (exists) {
                console.log('⚠️ [PUSHER] Duplicate staff message prevented (same ID):', newMsg.id);
                return prev;
              }
              
              console.log('🚀 [NUCLEAR] INSTANT STAFF MESSAGE DISPLAY');
              console.log('🚀 [NUCLEAR] Staff channel - Previous messages:', prev.length);
              console.log('🚀 [NUCLEAR] Staff channel - New message:', newMsg);
              const updated = [...prev, newMsg];
              console.log('🚀 [NUCLEAR] Staff channel - Updated count:', updated.length);
              console.log('🚀 [NUCLEAR] Staff channel - All messages:', updated);
              
              // Also update external messages if callback provided
              if (onMessagesUpdate) {
                console.log('🚀 [NUCLEAR] Staff channel - Triggering external callback');
                onMessagesUpdate(updated.map(msg => ({
                  id: msg.id,
                  player_id: playerId,
                  message: msg.message,
                  sender: msg.sender === 'staff' ? 'gre' : 'player',
                  sender_name: msg.sender_name,
                  timestamp: msg.timestamp,
                  status: msg.status
                })));
              }
              
              // IMMEDIATE VISUAL FEEDBACK
              setTimeout(() => {
                scrollToBottom();
                console.log('🚀 [NUCLEAR] Staff message scroll triggered, final count:', updated.length);
              }, 0);
              
              return updated;
            });
          } else {
            console.log('🔍 [PUSHER] Ignoring message for different player:', data.playerId, 'vs', playerId);
          }
        });

        console.log(`✅ [PUSHER] Connected to player-${playerId} and staff-portal channels`);

        // Add cleanup function
        return () => {
          if (pusherRef.current) {
            console.log('🧹 [PUSHER] Cleaning up connections');
            pusherRef.current.unsubscribe(`player-${playerId}`);
            pusherRef.current.unsubscribe('staff-portal');
            pusherRef.current.disconnect();
          }
        };

      } catch (error) {
        console.error('❌ [PUSHER] Connection failed:', error);
        setConnectionStatus('error');
      }
    };

    initializePusher();
  }, [isOpen, playerId]);

  // Sync with external messages from PlayerDashboard WebSocket
  useEffect(() => {
    if (externalMessages && externalMessages.length > 0) {
      console.log('🔄 [SYNC] Syncing with external messages:', externalMessages.length);
      
      const formattedMessages: ChatMessage[] = externalMessages.map((msg: any, index: number) => ({
        id: msg.id || `external-${index}-${Date.now()}`,
        message: msg.message,
        sender: msg.sender === 'gre' ? 'staff' : 'player',
        sender_name: msg.sender_name || 'System',
        timestamp: msg.timestamp,
        status: msg.status || 'received'
      }));

      setMessages(formattedMessages);
      console.log('✅ [SYNC] Messages synced from PlayerDashboard WebSocket');
      
      // Scroll to bottom when messages update
      setTimeout(() => scrollToBottom(), 100);
    }
  }, [externalMessages]);

  // Load existing messages ONLY ONCE when chat opens and no external messages
  const messagesLoadedRef = useRef(false);
  
  useEffect(() => {
    if (!isOpen || !playerId || messagesLoadedRef.current || (externalMessages && externalMessages.length > 0)) return;

    const loadMessages = async () => {
      try {
        const response = await fetch(`/api/unified-chat/messages/${playerId}`);
        if (response.ok) {
          const data = await response.json();
          console.log('📨 [MESSAGES] Initial load - existing messages:', data.length);

          const formattedMessages: ChatMessage[] = data.map((msg: any, index: number) => ({
            id: msg.id || `loaded-${index}-${Date.now()}`,
            message: msg.message,
            sender: msg.sender === 'gre' ? 'staff' : 'player',
            sender_name: msg.sender_name || 'System',
            timestamp: msg.timestamp,
            status: msg.status || 'received'
          }));

          setMessages(formattedMessages);
          messagesLoadedRef.current = true; // Mark as loaded to prevent re-loading
          console.log('✅ [MESSAGES] Initial load complete - messages preserved for real-time updates');
          
          // Instant scroll to bottom when messages load
          setTimeout(() => scrollToBottom(), 0);
        }
      } catch (error) {
        console.error('❌ [MESSAGES] Failed to load messages:', error);
      }
    };

    loadMessages();
  }, [isOpen, playerId, externalMessages]);

  // Reset loaded flag when chat closes to allow fresh load next time
  useEffect(() => {
    if (!isOpen) {
      messagesLoadedRef.current = false;
    }
  }, [isOpen]);

  const scrollToBottom = () => {
    // Instant scroll for real-time chat feel
    messagesEndRef.current?.scrollIntoView({ behavior: 'instant' });
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

  const clearChatHistory = async () => {
    if (!playerId || !confirm('Are you sure you want to clear all chat history? This cannot be undone.')) return;
    
    try {
      setIsLoading(true);
      const response = await fetch(`/api/unified-chat/clear/${playerId}`, {
        method: 'DELETE'
      });
      
      if (response.ok) {
        setMessages([]);
        console.log('✅ [CLEAR] Chat history cleared successfully');
      } else {
        console.error('❌ [CLEAR] Failed to clear chat history:', response.status);
      }
    } catch (error) {
      console.error('❌ [CLEAR] Error clearing chat history:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const showChatHistory = () => {
    setShowingHistory(!showingHistory);
    console.log(`📚 [HISTORY] ${showingHistory ? 'Hiding' : 'Showing'} chat history view`);
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
          id: result.data?.id || `player-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          message: newMessage,
          sender: 'player',
          sender_name: playerName,
          timestamp: new Date().toISOString(),
          status: 'sent'
        };

        setMessages(prev => {
          // Check if message already exists to prevent duplicates
          const exists = prev.some(msg => msg.id === sentMessage.id || 
            (msg.message === sentMessage.message && msg.sender === sentMessage.sender && 
             Math.abs(new Date(msg.timestamp).getTime() - new Date(sentMessage.timestamp).getTime()) < 5000));
          
          if (exists) {
            console.log('⚠️ [SEND] Duplicate message prevented:', sentMessage.id);
            return prev;
          }
          
          console.log('✅ [SEND] Adding sent message to UI instantly');
          return [...prev, sentMessage];
        });
        
        setNewMessage('');
        // Instant scroll with no animation for real-time feel
        setTimeout(() => scrollToBottom(), 10);
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
                  onClick={showChatHistory}
                  className="text-white hover:bg-green-700 p-1 h-6 w-6"
                  title="View Chat History"
                >
                  <History className="h-3 w-3" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearChatHistory}
                  className="text-white hover:bg-red-700 p-1 h-6 w-6"
                  title="Clear Chat History"
                  disabled={isLoading}
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
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
                  <div className="text-xs text-center text-blue-400 mb-2 bg-blue-900/20 p-2 rounded">
                    💬 {messages.length} message{messages.length !== 1 ? 's' : ''} • Player {playerId} • Real-time active
                  </div>
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