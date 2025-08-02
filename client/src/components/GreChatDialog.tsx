import { useState, useEffect, useRef } from "react";
import { createClient } from '@supabase/supabase-js';
import { useAuth } from "@/hooks/useAuth";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { 
  MessageCircle, 
  Send, 
  X, 
  User, 
  Headphones,
  Clock
} from "lucide-react";
import { apiRequest } from "@/lib/queryClient";

// Initialize Supabase client for UUID authentication
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL!;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

interface GreChatDialogProps {
  isOpen: boolean;
  onClose: () => void;
  messages?: any[];
  wsConnection?: WebSocket | null;
  wsConnected?: boolean;
}

interface ChatMessage {
  id: string;
  player_id: string; // Updated to UUID
  session_id?: string;
  player_name?: string;
  message: string;
  sender: 'player' | 'gre';
  sender_name?: string;
  timestamp: string;
  status: 'sent' | 'delivered' | 'read';
  created_at: string;
  updated_at: string;
}

export default function GreChatDialog({ isOpen, onClose, messages = [], wsConnection, wsConnected }: GreChatDialogProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [newMessage, setNewMessage] = useState("");
  const [uuidChatRequests, setUuidChatRequests] = useState<any[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Fetch UUID-based chat requests for current player
  const { data: chatRequests, isLoading: requestsLoading } = useQuery({
    queryKey: ['/api/uuid-chat/requests'],
    queryFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      const playerUUID = session?.user?.id;
      
      if (!playerUUID) return [];
      
      const response = await fetch('/api/uuid-chat/requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ playerUUID })
      });
      
      if (!response.ok) throw new Error('Failed to fetch chat requests');
      return response.json();
    },
    refetchInterval: 3000, // Poll every 3 seconds for updates
    enabled: isOpen && !!user
  });

  // Hybrid UUID/Legacy message fetching with smart fallback
  const { data: uuidMessages, isLoading: messagesLoading } = useQuery({
    queryKey: ['/api/hybrid-chat/messages'],
    queryFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      const playerUUID = session?.user?.id;
      
      if (!playerUUID) {
        console.log('⚠️ [HYBRID] No UUID available, trying legacy approach...');
        // Fallback to existing legacy message system
        if (messages && messages.length > 0) {
          console.log(`✅ [HYBRID] Using legacy messages: ${messages.length}`);
          return messages;
        }
        return [];
      }
      
      // Try UUID-based approach first
      try {
        console.log(`🔄 [HYBRID] Attempting UUID fetch for: ${playerUUID}`);
        const uuidResponse = await fetch('/api/uuid-chat/messages', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ playerUUID })
        });
        
        if (uuidResponse.ok) {
          const uuidData = await uuidResponse.json();
          console.log(`✅ [HYBRID] UUID success: ${uuidData?.length || 0} messages`);
          return uuidData || [];
        } else {
          console.log('⚠️ [HYBRID] UUID failed, status:', uuidResponse.status);
        }
      } catch (uuidError) {
        console.log('⚠️ [HYBRID] UUID error:', uuidError);
      }
      
      // Fallback to legacy system
      console.log('🔄 [HYBRID] Falling back to legacy messages...');
      if (messages && messages.length > 0) {
        console.log(`✅ [HYBRID] Legacy fallback: ${messages.length} messages`);
        return messages;
      }
      
      // Last resort: empty array
      console.log('⚠️ [HYBRID] No messages available from any source');
      return [];
    },
    refetchInterval: 3000, // Poll every 3 seconds for new messages
    enabled: isOpen && !!user
  });

  // HYBRID CHAT SYSTEM - UUID with Legacy Fallback
  const sendMessage = useMutation({
    mutationFn: async (message: string) => {
      console.log('🚀 [HYBRID CHAT] Attempting to send message...');
      
      // Try UUID-based system first
      const { data: { session } } = await supabase.auth.getSession();
      const playerUUID = session?.user?.id;
      
      if (playerUUID) {
        try {
          console.log('📋 [HYBRID] Trying UUID system with UUID:', playerUUID);
          
          const playerData = {
            playerUUID: playerUUID,
            playerName: `${user?.firstName} ${user?.lastName}`,
            message: message.trim(),
            senderType: 'player'
          };

          const response = await fetch('/api/uuid-chat/send', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Cache-Control': 'no-cache'
            },
            body: JSON.stringify(playerData)
          });

          if (response.ok) {
            const result = await response.json();
            console.log('✅ [HYBRID] UUID system success:', result.message?.id);
            return {
              success: true,
              messageId: result.message?.id,
              message: 'Message sent via UUID system',
              system: 'uuid'
            };
          } else {
            console.log('⚠️ [HYBRID] UUID system failed, status:', response.status);
          }
        } catch (uuidError) {
          console.log('⚠️ [HYBRID] UUID system error:', uuidError);
        }
      }
      
      // Fallback to legacy WebSocket/REST system
      console.log('🔄 [HYBRID] Falling back to legacy system...');
      
      if (wsConnection && wsConnected && wsConnection.readyState === WebSocket.OPEN) {
        // Use WebSocket for real-time messaging
        console.log('📤 [HYBRID] Using WebSocket legacy system');
        const playerMessage = {
          type: 'player_message',
          playerId: user?.id,
          playerName: `${user?.firstName} ${user?.lastName}`,
          playerEmail: user?.email,
          message: message.trim(),
          messageText: message.trim(),
          timestamp: new Date().toISOString(),
          universalId: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          portalOrigin: 'PokerRoomTracker', 
          targetPortal: 'PokerStaffPortal',
          messageFormat: 'universal'
        };
        
        wsConnection.send(JSON.stringify(playerMessage));
        return { 
          success: true, 
          message: 'Message sent via WebSocket', 
          system: 'websocket' 
        };
      } else {
        // REST API fallback
        console.log('🔄 [HYBRID] Using REST API legacy system');
        const result = await apiRequest("POST", "/api/gre-chat/send", {
          playerId: user?.id,
          playerName: `${user?.firstName} ${user?.lastName}`,
          message,
          timestamp: new Date().toISOString()
        });
        return { 
          success: true, 
          message: 'Message sent via REST API', 
          system: 'rest',
          ...result 
        };
      }
    },
    onSuccess: (result) => {
      setNewMessage("");
      
      const systemName = result.system === 'uuid' ? 'UUID System' : 
                        result.system === 'websocket' ? 'WebSocket' : 'REST API';
      
      toast({
        title: "Message Sent Successfully",
        description: `Message sent via ${systemName}${result.messageId ? ` (ID: ${result.messageId.substring(0, 8)})` : ''}`,
      });
      
      // Refresh both UUID and legacy message queries
      queryClient.invalidateQueries({ queryKey: ['/api/hybrid-chat/messages'] });
      queryClient.invalidateQueries({ queryKey: ['/api/uuid-chat/messages'] });
      queryClient.invalidateQueries({ queryKey: ['/api/gre-chat/messages'] });
    },
    onError: (error: Error) => {
      console.error('❌ [HYBRID CHAT] Failed to send message:', error);
      toast({
        title: "Message Send Failed",
        description: `All chat systems failed: ${error.message}`,
        variant: "destructive",
      });
    },
  });

  // LEGACY WebSocket system (kept for backwards compatibility)
  const sendLegacyMessage = useMutation({
    mutationFn: async (message: string) => {
      if (wsConnection && wsConnected && wsConnection.readyState === WebSocket.OPEN) {
        // Use WebSocket for real-time messaging
        console.log('📤 [WEBSOCKET] Sending message via WebSocket');
        // Staff Portal compatible message format - EXACT format from integration guide
        const playerMessage = {
          type: 'player_message',
          playerId: user?.id,
          playerName: `${user?.firstName} ${user?.lastName}`,
          playerEmail: user?.email,
          message: message.trim(),
          messageText: message.trim(),
          timestamp: new Date().toISOString(),
          // Universal System fields from integration guide
          universalId: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          portalOrigin: 'PokerRoomTracker', 
          targetPortal: 'PokerStaffPortal',
          messageFormat: 'universal'
        };
        
        console.log('📤 [POKER ROOM TRACKER] Sending to Staff Portal:', playerMessage);
        wsConnection.send(JSON.stringify(playerMessage));
        return { success: true };
      } else {
        // Fallback to REST API
        console.log('🔄 [API] Using REST API fallback for message send');
        return apiRequest("POST", "/api/gre-chat/send", {
          playerId: user?.id,
          playerName: `${user?.firstName} ${user?.lastName}`,
          message,
          timestamp: new Date().toISOString()
        });
      }
    },
    onSuccess: () => {
      setNewMessage("");
      toast({
        title: "Message Sent",
        description: "Your message has been sent to our support team.",
      });
    },
    onError: (error: any) => {
      console.error('❌ [CHAT] Error sending message:', error);
      toast({
        title: "Failed to Send Message",
        description: error.message || "Please try again.",
        variant: "destructive",
      });
    },
  });

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim()) return;
    sendMessage.mutate(newMessage.trim());
  };

  const formatTime = (timestamp: string) => {
    return new Date(timestamp).toLocaleTimeString([], { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  // Show online status based on WebSocket connection
  const onlineAgentsCount = wsConnected ? 1 : 0;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg h-[600px] flex flex-col bg-slate-900 border-slate-700">
        <DialogHeader className="flex flex-row items-center justify-between space-y-0 pb-4 border-b border-slate-700">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-emerald-500/20 rounded-full">
              <Headphones className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <DialogTitle className="text-white text-lg">
                Guest Relations Support
              </DialogTitle>
              <div className="flex items-center space-x-2 text-sm text-slate-400">
                <div className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse"></div>
                <span>{onlineAgentsCount} agents online</span>
              </div>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="text-slate-400 hover:text-white"
          >
            <X className="w-4 h-4" />
          </Button>
        </DialogHeader>

        {/* Messages Area */}
        <ScrollArea className="flex-1 px-4 py-4">
          <div className="space-y-4">
            {false ? (
              <div className="text-center text-slate-400 py-8">
                <MessageCircle className="w-8 h-8 mx-auto mb-2 animate-pulse" />
                Loading chat history...
              </div>
            ) : (uuidMessages || []).length === 0 ? (
              <div className="text-center text-slate-400 py-8">
                <MessageCircle className="w-12 h-12 mx-auto mb-4 text-slate-600" />
                <h3 className="text-lg font-medium text-slate-300 mb-2">
                  Start a Conversation
                </h3>
                <p className="text-sm">
                  Our Guest Relations team is here to help you with any questions or concerns.
                </p>
              </div>
            ) : (
              (uuidMessages || []).map((message: ChatMessage) => (
                <div
                  key={message.id}
                  className={`flex ${
                    message.sender === 'player' ? 'justify-end' : 'justify-start'
                  }`}
                >
                  <div className="flex items-end space-x-2 max-w-[80%]">
                    {message.sender === 'gre' && (
                      <div className="w-8 h-8 bg-emerald-500 rounded-full flex items-center justify-center">
                        <Headphones className="w-4 h-4 text-white" />
                      </div>
                    )}
                    <div>
                      <div
                        className={`rounded-lg px-3 py-2 ${
                          message.sender === 'player'
                            ? 'bg-blue-600 text-white'
                            : 'bg-slate-700 text-slate-100'
                        }`}
                      >
                        <p className="text-sm">{message.message}</p>
                      </div>
                      <div className="flex items-center mt-1 space-x-2">
                        <span className="text-xs text-slate-500">
                          {formatTime(message.timestamp || message.created_at)}
                        </span>
                        {message.sender === 'player' && (
                          <Badge variant="secondary" className="text-xs px-1 py-0">
                            {message.status === 'read' ? 'Read' : 'Sent'}
                          </Badge>
                        )}
                      </div>
                    </div>
                    {message.sender === 'player' && (
                      <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center">
                        <User className="w-4 h-4 text-white" />
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}
            <div ref={messagesEndRef} />
          </div>
        </ScrollArea>

        {/* Message Input */}
        <form onSubmit={handleSendMessage} className="flex space-x-2 p-4 border-t border-slate-700">
          <Input
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder="Type your message..."
            className="flex-1 bg-slate-800 border-slate-600 text-white placeholder-slate-400"
            disabled={sendMessage.isPending}
          />
          <Button
            type="submit"
            disabled={!newMessage.trim() || sendMessage.isPending}
            className="bg-emerald-600 hover:bg-emerald-700 text-white"
          >
            {sendMessage.isPending ? (
              <Clock className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
          </Button>
        </form>

        {/* Quick Actions */}
        <div className="px-4 pb-4">
          <div className="text-xs text-slate-500 mb-2">Quick Actions:</div>
          <div className="flex flex-wrap gap-2">
            {[
              "I need help with my account",
              "Technical support needed",
              "Payment inquiry",
              "Game assistance"
            ].map((quickMessage) => (
              <Button
                key={quickMessage}
                variant="outline"
                size="sm"
                onClick={() => setNewMessage(quickMessage)}
                className="text-xs border-slate-600 text-slate-300 hover:bg-slate-700"
              >
                {quickMessage}
              </Button>
            ))}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}