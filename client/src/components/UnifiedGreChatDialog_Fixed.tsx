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
  
  const { user } = useAuth();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const pusherRef = useRef<any>(null);

  // Get player ID with robust fallback
  const playerId = playerData?.id || user?.id;
  const playerName = playerData ? 
    `${playerData.firstName || ''} ${playerData.lastName || ''}`.trim() :
    `${user?.firstName || ''} ${user?.lastName || ''}`.trim();

  console.log('🚀 [CHAT NUCLEAR] Component mounted, playerId:', playerId, 'isOpen:', isOpen);

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

        const pusherKey = import.meta.env.VITE_PUSHER_KEY || '81b98cb04ef7aeef2baa';
        const pusherCluster = import.meta.env.VITE_PUSHER_CLUSTER || 'ap2';
        
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
            id: data.messageId || `player-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            message: data.message,
            sender: 'staff',
            sender_name: data.senderName || data.sender_name || 'Guest Relations',
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

  // Handle Enter key
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="bg-slate-900 border-slate-700 text-white max-w-sm fixed right-4 top-4 bottom-4 transform-none">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2">
            <MessageSquare className="w-5 h-5 text-emerald-500" />
            <span>Guest Relations Chat</span>
            <div className={`w-2 h-2 rounded-full ${
              connectionStatus === 'connected' ? 'bg-green-500' :
              connectionStatus === 'connecting' ? 'bg-yellow-500' :
              'bg-red-500'
            }`} />
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <ScrollArea className="h-80 w-full border border-slate-700 rounded-lg p-3">
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