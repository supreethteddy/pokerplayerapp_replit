import { useState, useEffect, useRef } from "react";
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
  Clock,
  CheckCircle,
  AlertCircle
} from "lucide-react";
import { apiRequest } from "@/lib/queryClient";

// UNIFIED CHAT SYSTEM - STAFF PORTAL ALIGNED TYPES (snake_case)
interface UnifiedMessage {
  id: string;
  player_id: number;
  player_name: string;
  message_text: string;
  sender: 'player' | 'gre';
  sender_name: string;
  timestamp: string;
  status: string;
  chat_request_id?: string;
  created_at: string;
}

interface UnifiedChatRequest {
  id: string;
  player_id: number;
  player_name: string;
  subject: string;
  status: 'waiting' | 'active' | 'resolved';
  priority: string;
  category: string;
  created_at: string;
  updated_at: string;
}

interface UnifiedGreChatDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function UnifiedGreChatDialog({ isOpen, onClose }: UnifiedGreChatDialogProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [newMessage, setNewMessage] = useState("");
  const [activeRequestId, setActiveRequestId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Fetch unified chat requests for current player
  const { data: chatRequests, isLoading: requestsLoading } = useQuery({
    queryKey: ['/api/unified-chat/requests', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      
      const response = await fetch('/api/unified-chat/requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          player_id: user.id,
          status: null // Get all requests
        })
      });
      
      if (!response.ok) throw new Error('Failed to fetch chat requests');
      const data = await response.json();
      console.log('📋 [UNIFIED] Chat requests fetched:', data?.length || 0);
      return data || [];
    },
    refetchInterval: 3000,
    enabled: isOpen && !!user?.id
  });

  // Fetch unified messages for current player
  const { data: messages, isLoading: messagesLoading } = useQuery({
    queryKey: ['/api/unified-chat/messages', user?.id, activeRequestId],
    queryFn: async () => {
      if (!user?.id) return [];
      
      const response = await fetch('/api/unified-chat/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          player_id: user.id,
          chat_request_id: activeRequestId || undefined
        })
      });
      
      if (!response.ok) throw new Error('Failed to fetch messages');
      const data = await response.json();
      console.log('💬 [UNIFIED] Messages fetched:', data?.length || 0);
      return data || [];
    },
    refetchInterval: 2000,
    enabled: isOpen && !!user?.id
  });

  // Send unified message mutation
  const sendMessageMutation = useMutation({
    mutationFn: async ({ message_text, chat_request_id }: { message_text: string; chat_request_id?: string }) => {
      if (!user?.id || !message_text.trim()) {
        throw new Error('Invalid message data');
      }

      const response = await fetch('/api/unified-chat/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          player_id: user.id,
          message_text: message_text.trim(),
          sender: 'player',
          sender_name: `${user.firstName} ${user.lastName}`,
          chat_request_id
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to send message');
      }

      return response.json();
    },
    onSuccess: (data) => {
      console.log('✅ [UNIFIED] Message sent successfully:', data);
      setNewMessage("");
      
      // Update active request if new one was created
      if (data.requestId && !activeRequestId) {
        setActiveRequestId(data.requestId);
      }
      
      // Invalidate queries to refresh data
      queryClient.invalidateQueries({ queryKey: ['/api/unified-chat/messages'] });
      queryClient.invalidateQueries({ queryKey: ['/api/unified-chat/requests'] });
      
      toast({
        title: "Message Sent",
        description: "Your message has been sent to support.",
      });
    },
    onError: (error: any) => {
      console.error('❌ [UNIFIED] Message send failed:', error);
      toast({
        title: "Send Failed", 
        description: error.message || "Failed to send message. Please try again.",
        variant: "destructive",
      });
    }
  });

  // Handle sending message
  const handleSendMessage = () => {
    if (!newMessage.trim() || sendMessageMutation.isPending) return;
    
    console.log('📤 [UNIFIED] Sending message:', {
      player_id: user?.id,
      message_text: newMessage.trim(),
      chat_request_id: activeRequestId
    });
    
    sendMessageMutation.mutate({
      message_text: newMessage,
      chat_request_id: activeRequestId
    });
  };

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Set active request if available
  useEffect(() => {
    if (chatRequests && chatRequests.length > 0 && !activeRequestId) {
      const activeRequest = chatRequests.find((req: UnifiedChatRequest) => 
        req.status === 'waiting' || req.status === 'active'
      );
      if (activeRequest) {
        setActiveRequestId(activeRequest.id);
      }
    }
  }, [chatRequests, activeRequestId]);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'waiting':
        return <Badge variant="secondary" className="text-yellow-600"><Clock className="w-3 h-3 mr-1" />Waiting</Badge>;
      case 'active':
        return <Badge variant="default" className="text-green-600"><Headphones className="w-3 h-3 mr-1" />Active</Badge>;
      case 'resolved':
        return <Badge variant="outline" className="text-blue-600"><CheckCircle className="w-3 h-3 mr-1" />Resolved</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const formatTime = (timestamp: string) => {
    return new Date(timestamp).toLocaleTimeString([], { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md h-[600px] flex flex-col p-0">
        <DialogHeader className="px-6 py-4 border-b">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Headphones className="h-5 w-5 text-blue-600" />
              <DialogTitle>Guest Relations Support</DialogTitle>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
          
          {/* Chat Request Status */}
          {chatRequests && chatRequests.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-2">
              {chatRequests.slice(0, 2).map((request: UnifiedChatRequest) => (
                <div key={request.id} className="flex items-center space-x-2">
                  {getStatusBadge(request.status)}
                  <span className="text-sm text-muted-foreground">
                    {request.subject.substring(0, 20)}...
                  </span>
                </div>
              ))}
            </div>
          )}
        </DialogHeader>

        {/* Messages Area */}
        <ScrollArea className="flex-1 px-6 py-4">
          {messagesLoading ? (
            <div className="flex items-center justify-center h-32">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          ) : messages && messages.length > 0 ? (
            <div className="space-y-4">
              {messages.map((message: UnifiedMessage) => (
                <div
                  key={message.id}
                  className={`flex ${message.sender === 'player' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[80%] rounded-lg px-3 py-2 ${
                      message.sender === 'player'
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-100 text-gray-900'
                    }`}
                  >
                    <div className="flex items-center space-x-2 mb-1">
                      {message.sender === 'gre' && <User className="w-4 h-4" />}
                      <span className="font-semibold text-sm">
                        {message.sender === 'player' ? 'You' : message.sender_name || 'Support'}
                      </span>
                      <span className="text-xs opacity-75">
                        {formatTime(message.timestamp || message.created_at)}
                      </span>
                    </div>
                    <p className="text-sm">{message.message_text}</p>
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-32 text-center">
              <MessageCircle className="h-12 w-12 text-gray-400 mb-2" />
              <p className="text-gray-500">No messages yet</p>
              <p className="text-sm text-gray-400">Send a message to start the conversation</p>
            </div>
          )}
        </ScrollArea>

        {/* Message Input */}
        <div className="border-t p-4">
          <div className="flex space-x-2">
            <Input
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              placeholder="Type your message..."
              onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
              disabled={sendMessageMutation.isPending}
              className="flex-1"
            />
            <Button
              onClick={handleSendMessage}
              disabled={!newMessage.trim() || sendMessageMutation.isPending}
              size="sm"
            >
              {sendMessageMutation.isPending ? (
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
          </div>
          
          {/* Connection Status */}
          <div className="flex items-center justify-between mt-2 text-xs text-muted-foreground">
            <span>
              {chatRequests?.length > 0 
                ? `${chatRequests.length} request${chatRequests.length !== 1 ? 's' : ''}`
                : 'Ready to send'
              }
            </span>
            <span className="flex items-center space-x-1">
              <div className="w-2 h-2 bg-green-500 rounded-full"></div>
              <span>Connected</span>
            </span>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}