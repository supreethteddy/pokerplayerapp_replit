import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useMutation, useQueryClient } from "@tanstack/react-query";
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

interface GreChatDialogProps {
  isOpen: boolean;
  onClose: () => void;
  messages?: any[];
  wsConnection?: WebSocket | null;
  wsConnected?: boolean;
}

interface ChatMessage {
  id: string;
  player_id: number;
  gre_id?: string;
  message: string;
  sender_type: 'player' | 'gre';
  timestamp: string;
  is_read: boolean;
}

export default function GreChatDialog({ isOpen, onClose, messages = [], wsConnection, wsConnected }: GreChatDialogProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [newMessage, setNewMessage] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Send message via WebSocket or API fallback
  const sendMessage = useMutation({
    mutationFn: async (message: string) => {
      if (wsConnection && wsConnected && wsConnection.readyState === WebSocket.OPEN) {
        // Use WebSocket for real-time messaging
        console.log('📤 [WEBSOCKET] Sending message via WebSocket');
        wsConnection.send(JSON.stringify({
          type: 'send_message',
          playerId: user?.id,
          playerName: `${user?.firstName} ${user?.lastName}`,
          message,
          sender: 'player'
        }));
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
            ) : messages.length === 0 ? (
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
              messages.map((message: ChatMessage) => (
                <div
                  key={message.id}
                  className={`flex ${
                    message.sender_type === 'player' ? 'justify-end' : 'justify-start'
                  }`}
                >
                  <div className="flex items-end space-x-2 max-w-[80%]">
                    {message.sender_type === 'gre' && (
                      <div className="w-8 h-8 bg-emerald-500 rounded-full flex items-center justify-center">
                        <Headphones className="w-4 h-4 text-white" />
                      </div>
                    )}
                    <div>
                      <div
                        className={`rounded-lg px-3 py-2 ${
                          message.sender_type === 'player'
                            ? 'bg-blue-600 text-white'
                            : 'bg-slate-700 text-slate-100'
                        }`}
                      >
                        <p className="text-sm">{message.message}</p>
                      </div>
                      <div className="flex items-center mt-1 space-x-2">
                        <span className="text-xs text-slate-500">
                          {formatTime(message.timestamp)}
                        </span>
                        {message.sender_type === 'player' && (
                          <Badge variant="secondary" className="text-xs px-1 py-0">
                            {message.is_read ? 'Read' : 'Sent'}
                          </Badge>
                        )}
                      </div>
                    </div>
                    {message.sender_type === 'player' && (
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