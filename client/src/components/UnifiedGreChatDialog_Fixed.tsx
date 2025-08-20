import { useState, useRef, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Send, MessageSquare } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { apiRequest } from "@/lib/queryClient";

interface ChatMessage {
  id: string;
  message: string;
  sender: 'player' | 'staff';
  sender_name: string;
  timestamp: string;
  status: string;
}

interface UnifiedGreChatDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onMessagesUpdate?: (messages: any[]) => void;
}

export function UnifiedGreChatDialog_Fixed({ 
  isOpen, 
  onOpenChange, 
  onMessagesUpdate 
}: UnifiedGreChatDialogProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'disconnected' | 'error'>('connecting');
  const [isSending, setIsSending] = useState(false);
  const [playerData, setPlayerData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [messagesLoaded, setMessagesLoaded] = useState(false);
  
  const { user } = useAuth();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const pusherRef = useRef<any>(null);

  // Get player ID - FIXED to use user.id which is the correct player ID (29)
  const playerId = user?.id; // user.id is 29 for vignesh
  const playerName = `${user?.firstName || ''} ${user?.lastName || ''}`.trim();
    
  console.log(`🔍 [CHAT PLAYER ID] Using player ID: ${playerId}`);
  console.log('🚀 [CHAT NUCLEAR] Component mounted, playerId:', playerId, 'isOpen:', isOpen);

  // PERSISTENT CHAT HISTORY - Load once and maintain across sessions
  useEffect(() => {
    console.log('🚀 [CHAT PERSISTENT] Check load - playerId:', playerId, 'loaded:', messagesLoaded);
    
    // Only load once when component first mounts with playerId
    if (playerId && !messagesLoaded) {
      const loadChatHistory = async () => {
        try {
          setLoading(true);
          console.log('🚀 [CHAT PERSISTENT] Loading chat history from /api/chat-history/' + playerId);
          
          const response = await fetch(`/api/chat-history/${playerId}`);
          const data = await response.json();
          
          console.log('🚀 [CHAT PERSISTENT] Response:', {
            success: data.success,
            conversationCount: data.conversations?.length || 0
          });
          
          if (data.success && data.conversations?.length > 0) {
            const allMessages: ChatMessage[] = [];
            
            data.conversations.forEach((conv: any, index: number) => {
              console.log(`🚀 [CHAT PERSISTENT] Processing conversation ${index + 1}: "${conv.subject}"`);
              
              // Add initial message if exists
              if (conv.initial_message) {
                allMessages.push({
                  id: `conv-${conv.id}`,
                  message: conv.initial_message,
                  sender: 'player',
                  sender_name: conv.player_name,
                  timestamp: conv.created_at,
                  status: 'sent'
                });
              }
              
              // Add all chat messages
              if (conv.chat_messages?.length > 0) {
                console.log(`🚀 [CHAT NUCLEAR] 📚 Found ${conv.chat_messages.length} messages in conversation`);
                conv.chat_messages.forEach((msg: any) => {
                  allMessages.push({
                    id: msg.id,
                    message: msg.message_text,
                    sender: msg.sender,
                    sender_name: msg.sender_name,
                    timestamp: msg.timestamp,
                    status: 'sent'
                  });
                });
              }
            });
            
            // Sort by timestamp
            allMessages.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
            setMessages(allMessages);
            setMessagesLoaded(true);
            
            console.log('🚀 [CHAT PERSISTENT] ✅ Messages loaded successfully:', {
              totalMessages: allMessages.length,
              firstMessage: allMessages[0]?.message?.substring(0, 50),
              lastMessage: allMessages[allMessages.length - 1]?.message?.substring(0, 50)
            });
            
            // Call the onMessagesUpdate callback if provided
            if (onMessagesUpdate) {
              onMessagesUpdate(allMessages);
            }
          } else {
            console.log('🚀 [CHAT PERSISTENT] 📚 No conversations found');
            setMessages([]);
            setMessagesLoaded(true);
          }
        } catch (error) {
          console.error('🚀 [CHAT PERSISTENT] ❌ Load error:', error);
          setMessages([]);
          setMessagesLoaded(true);
        } finally {
          setLoading(false);
        }
      };
      
      loadChatHistory();
    }
  }, [playerId, messagesLoaded]); // Only load once when component mounts

  // Initialize Pusher connection IMMEDIATELY when component mounts
  useEffect(() => {
    if (!playerId) {
      console.log('🚀 [CHAT NUCLEAR] No playerId, waiting...');
      return;
    }

    console.log('🚀 [CHAT NUCLEAR] INITIALIZING PUSHER CONNECTION NOW');
    console.log('🚀 [CHAT NUCLEAR] Player ID:', playerId);
    console.log('🚀 [CHAT NUCLEAR] Chat dialog open state:', isOpen);

    const initializePusher = async () => {
      try {
        console.log('🚀 [CHAT NUCLEAR] Loading Pusher library...');
        const Pusher = (await import('pusher-js')).default;

        const pusherKey = import.meta.env.VITE_PUSHER_KEY;
        const pusherCluster = import.meta.env.VITE_PUSHER_CLUSTER || 'ap2';
        
        if (!pusherKey) {
          console.warn('⚠️ [CHAT] VITE_PUSHER_KEY not configured, skipping chat functionality');
          setConnectionStatus('error');
          return;
        }
        
        console.log('🚀 [CHAT NUCLEAR] Creating Pusher instance with key:', pusherKey);
        console.log('🚀 [CHAT NUCLEAR] Using cluster:', pusherCluster);
        
        const pusher = new Pusher(pusherKey, {
          cluster: pusherCluster,
          forceTLS: true,
          enabledTransports: ['ws', 'wss'],
          disabledTransports: []
        });

        pusherRef.current = pusher;

        // Connection event handlers
        pusher.connection.bind('connected', () => {
          console.log('🚀 [CHAT NUCLEAR] ✅ PUSHER CONNECTED SUCCESSFULLY!');
          setConnectionStatus('connected');
        });

        pusher.connection.bind('connecting', () => {
          console.log('🚀 [CHAT NUCLEAR] 🔄 PUSHER CONNECTING...');
          setConnectionStatus('connecting');
        });

        pusher.connection.bind('unavailable', () => {
          console.log('🚀 [CHAT NUCLEAR] ⚠️ PUSHER UNAVAILABLE');
          setConnectionStatus('error');
        });

        pusher.connection.bind('failed', () => {
          console.error('🚀 [CHAT NUCLEAR] ❌ PUSHER CONNECTION FAILED');
          setConnectionStatus('error');
        });

        // Subscribe to channels
        console.log('🚀 [CHAT NUCLEAR] Subscribing to player channel:', `player-${playerId}`);
        const playerChannel = pusher.subscribe(`player-${playerId}`);
        
        console.log('🚀 [CHAT NUCLEAR] Subscribing to staff channel: staff-portal');
        const staffChannel = pusher.subscribe('staff-portal');

        // Player channel message handler
        playerChannel.bind('new-gre-message', (data: any) => {
          console.log('🚀 [CHAT NUCLEAR] 📨 PLAYER CHANNEL MESSAGE RECEIVED:', data);
          
          const newMsg: ChatMessage = {
            id: data.messageId || `gre-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            message: data.message,
            sender: 'staff',
            sender_name: data.senderName || data.sender_name || 'Guest Relations Executive',
            timestamp: data.timestamp || new Date().toISOString(),
            status: 'received'
          };

          // AUTO-OPEN CHAT WHEN MESSAGE ARRIVES
          if (!isOpen && onOpenChange) {
            console.log('🚀 [CHAT NUCLEAR] 🔥 AUTO-OPENING CHAT FOR NEW MESSAGE');
            onOpenChange(true);
          }

          setMessages(prev => {
            const exists = prev.some(msg => msg.id === newMsg.id);
            if (exists) {
              console.log('🚀 [CHAT NUCLEAR] ⚠️ Duplicate message prevented');
              return prev;
            }
            
            console.log('🚀 [CHAT NUCLEAR] ✅ ADDING MESSAGE TO CHAT UI');
            const updated = [...prev, newMsg];
            console.log('🚀 [CHAT NUCLEAR] Total messages now:', updated.length);
            
            // Trigger callback
            if (onMessagesUpdate) {
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

        // Staff channel message handler 
        staffChannel.bind('new-gre-message', (data: any) => {
          console.log('🚀 [CHAT NUCLEAR] 📨 STAFF CHANNEL MESSAGE RECEIVED:', data);
          
          // Only process messages for this player
          if (data.playerId === playerId || data.player_id === playerId) {
            const newMsg: ChatMessage = {
              id: data.messageId || `staff-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
              message: data.message,
              sender: 'staff',
              sender_name: data.senderName || data.sender_name || 'Guest Relations',
              timestamp: data.timestamp || new Date().toISOString(),
              status: 'received'
            };

            // AUTO-OPEN CHAT WHEN MESSAGE ARRIVES  
            if (!isOpen && onOpenChange) {
              console.log('🚀 [CHAT NUCLEAR] 🔥 AUTO-OPENING CHAT FOR STAFF MESSAGE');
              onOpenChange(true);
            }

            setMessages(prev => {
              const exists = prev.some(msg => msg.id === newMsg.id);
              if (exists) {
                console.log('🚀 [CHAT NUCLEAR] ⚠️ Duplicate staff message prevented');
                return prev;
              }
              
              console.log('🚀 [CHAT NUCLEAR] ✅ ADDING STAFF MESSAGE TO CHAT UI');
              const updated = [...prev, newMsg];
              console.log('🚀 [CHAT NUCLEAR] Total messages now:', updated.length);
              
              return updated;
            });
          }
        });

        console.log('🚀 [CHAT NUCLEAR] ✅ PUSHER SETUP COMPLETE!');

      } catch (error) {
        console.error('🚀 [CHAT NUCLEAR] ❌ PUSHER SETUP FAILED:', error);
        setConnectionStatus('error');
      }
    };

    initializePusher();

    // Cleanup function
    return () => {
      console.log('🚀 [CHAT NUCLEAR] 🧹 Cleaning up Pusher connection');
      if (pusherRef.current) {
        pusherRef.current.disconnect();
        pusherRef.current = null;
      }
    };
  }, [playerId]); // Only depend on playerId, not isOpen

  // Load chat history when component opens - CRITICAL FIX TO DISPLAY REAL DATA
  useEffect(() => {
    if (!isOpen || !playerId) {
      console.log('🚀 [CHAT NUCLEAR] 📚 Skipping chat history load - isOpen:', isOpen, 'playerId:', playerId);
      return;
    }
    
    console.log('🚀 [CHAT NUCLEAR] 📚 Loading chat history for player:', playerId);
    
    const loadChatHistory = async () => {
      try {
        const response = await fetch(`/api/chat-history/${playerId}`);
        const data = await response.json();
        
        console.log('🚀 [CHAT NUCLEAR] 📚 Raw API response:', data);
        
        if (data.success && data.conversations && data.conversations.length > 0) {
          console.log('🚀 [CHAT NUCLEAR] 📚 Processing', data.conversations.length, 'conversations');
          
          // Process conversations to extract messages
          const allMessages: ChatMessage[] = [];
          
          data.conversations.forEach((conv: any, convIndex: number) => {
            console.log(`🚀 [CHAT NUCLEAR] 📚 Processing conversation ${convIndex + 1}:`, conv.subject);
            
            // Add conversation start message if there's an initial message
            if (conv.initial_message) {
              allMessages.push({
                id: `conv-${conv.id}`,
                message: conv.initial_message,
                sender: 'player',
                sender_name: conv.player_name,
                timestamp: conv.created_at,
                status: 'sent'
              });
            }
            
            // Add all chat messages from this conversation
            if (conv.chat_messages && Array.isArray(conv.chat_messages)) {
              console.log(`🚀 [CHAT NUCLEAR] 📚 Found ${conv.chat_messages.length} messages in conversation ${convIndex + 1}`);
              conv.chat_messages.forEach((msg: any) => {
                allMessages.push({
                  id: msg.id,
                  message: msg.message_text,
                  sender: msg.sender,
                  sender_name: msg.sender_name,
                  timestamp: msg.timestamp,
                  status: 'sent'
                });
              });
            }
          });
          
          // Sort messages by timestamp
          allMessages.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
          
          setMessages(allMessages);
          console.log('🚀 [CHAT NUCLEAR] ✅ Successfully loaded', allMessages.length, 'total messages from all conversations');
          
          // Log first few messages to verify
          if (allMessages.length > 0) {
            console.log('🚀 [CHAT NUCLEAR] 📚 First 3 messages:', allMessages.slice(0, 3));
          }
        } else {
          console.log('🚀 [CHAT NUCLEAR] 📚 No conversations found in response');
          setMessages([]);
        }
      } catch (error) {
        console.error('🚀 [CHAT NUCLEAR] ❌ Failed to load chat history:', error);
        setMessages([]);
      }
    };
    
    loadChatHistory();
  }, [isOpen, playerId]);

  // Auto-scroll to bottom
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Send message function
  const handleSendMessage = async () => {
    if (!inputMessage.trim() || !playerId || !playerName) return;

    const messageToSend = inputMessage.trim();
    setInputMessage('');
    setIsSending(true);

    try {
      console.log('🚀 [CHAT NUCLEAR] 📤 SENDING MESSAGE:', messageToSend);
      
      // COMPREHENSIVE FIX: Use correct endpoint with proper payload structure
      const response = await apiRequest('POST', '/api/unified-chat/send', {
        playerId: playerId,
        playerName: playerName,
        message: messageToSend,
        senderType: 'player'
      });

      if (response.ok) {
        console.log('🚀 [CHAT NUCLEAR] ✅ MESSAGE SENT SUCCESSFULLY');
        
        // Add message to local state immediately
        const newMsg: ChatMessage = {
          id: `local-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          message: messageToSend,
          sender: 'player',
          sender_name: playerName,
          timestamp: new Date().toISOString(),
          status: 'sent'
        };

        setMessages(prev => [...prev, newMsg]);
      } else {
        console.error('🚀 [CHAT NUCLEAR] ❌ MESSAGE SEND FAILED');
      }
    } catch (error) {
      console.error('🚀 [CHAT NUCLEAR] ❌ MESSAGE SEND ERROR:', error);
    } finally {
      setIsSending(false);
    }
  };

  // Clear chat history function
  const clearChatHistory = async () => {
    try {
      console.log('🧹 [CHAT CLEAR] Clearing chat history for player:', playerId);
      
      const response = await apiRequest('DELETE', `/api/unified-chat/clear/${playerId}`);
      
      if (response.ok) {
        setMessages([]);
        setMessagesLoaded(false); // Allow reload after clear
        console.log('🧹 [CHAT CLEAR] ✅ Chat history cleared successfully');
      } else {
        console.error('🧹 [CHAT CLEAR] ❌ Failed to clear chat history');
      }
    } catch (error) {
      console.error('🧹 [CHAT CLEAR] ❌ Error clearing chat history:', error);
    }
  };

  // Handle Enter key
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="bg-slate-900 border-slate-700 text-white max-w-sm w-80">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <MessageSquare className="w-5 h-5 text-emerald-500" />
              <span>Guest Relations Chat</span>
              <div className={`w-2 h-2 rounded-full ${
                connectionStatus === 'connected' ? 'bg-green-500' :
                connectionStatus === 'connecting' ? 'bg-yellow-500' :
                'bg-red-500'
              }`} />
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={clearChatHistory}
              className="h-6 w-6 p-0 hover:bg-slate-700"
              title="Clear chat history"
            >
              <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </Button>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <ScrollArea className="h-56 w-full border border-slate-700 rounded-lg p-3">
            <div className="space-y-3">
              {messages.length === 0 && (
                <div className="text-center text-slate-400 py-8">
                  <MessageSquare className="w-8 h-8 mx-auto mb-2 text-slate-600" />
                  <p>Start a conversation with our Guest Relations team</p>
                </div>
              )}
              
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex ${msg.sender === 'player' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[80%] p-3 rounded-lg ${
                      msg.sender === 'player'
                        ? 'bg-emerald-600 text-white'
                        : 'bg-slate-700 text-slate-100'
                    }`}
                  >
                    <p className="text-sm">{msg.message}</p>
                    <p className="text-xs opacity-70 mt-1">
                      {msg.sender_name} • {new Date(msg.timestamp).toLocaleTimeString()}
                    </p>
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>
          </ScrollArea>

          <div className="flex space-x-2">
            <input
              type="text"
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Type your message..."
              className="flex-1 bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-white placeholder-slate-400 focus:outline-none focus:border-emerald-500"
              disabled={isSending || connectionStatus !== 'connected'}
            />
            <Button
              onClick={handleSendMessage}
              disabled={!inputMessage.trim() || isSending || connectionStatus !== 'connected'}
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              {isSending ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
            </Button>
          </div>

          <div className="text-xs text-slate-400 text-center">
            Connection: {connectionStatus} • Player ID: {playerId}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}