// Real-time GRE Chat with Pusher Channels Integration
import { useState, useEffect, useRef } from 'react';
import { Send, X, Clock, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import { subscribeToPlayerChat } from '@/lib/pusher';
import { initializeOneSignal, requestNotificationPermission } from '@/lib/onesignal';

interface ChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  senderType: 'player' | 'staff' | 'gre';
  message: string;
  timestamp: string;
  playerId?: number;
}

interface UnifiedGreChatDialogProps {
  isOpen: boolean;
  onClose: () => void;
  playerId: number;
  playerName: string;
}

export default function UnifiedGreChatDialog({ isOpen, onClose, playerId, playerName }: UnifiedGreChatDialogProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  // Initialize Pusher subscription and OneSignal
  useEffect(() => {
    if (!isOpen || !playerId) return;

    console.log('🔌 [CHAT] Initializing Pusher subscription for player:', playerId);
    
    // Initialize OneSignal for push notifications
    initializeOneSignal(playerId).then(() => {
      requestNotificationPermission();
    });

    // Subscribe to real-time messages via Pusher
    const unsubscribe = subscribeToPlayerChat(playerId, (data: any) => {
      console.log('📨 [PUSHER] Received real-time message:', data);
      
      if (data.type === 'new-chat-message' && data.data) {
        const chatMessage: ChatMessage = data.data;
        setMessages(prev => [...prev, chatMessage]);
        
        // Show toast for staff messages
        if (chatMessage.senderType === 'staff' || chatMessage.senderType === 'gre') {
          toast({
            title: `Message from ${chatMessage.senderName}`,
            description: chatMessage.message,
          });
        }
      }
    });

    setIsConnected(true);
    
    // Load existing messages
    loadChatHistory();

    return () => {
      unsubscribe();
      setIsConnected(false);
    };
  }, [isOpen, playerId]);

  // Scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const loadChatHistory = async () => {
    try {
      const response = await fetch(`/api/unified-chat/messages/${playerId}`);
      const data = await response.json();
      
      if (data.success && data.messages) {
        const formattedMessages: ChatMessage[] = data.messages.map((msg: any) => ({
          id: msg.id?.toString() || msg.messageId,
          senderId: msg.sent_by || msg.senderId,
          senderName: msg.sent_by_name || msg.senderName,
          senderType: msg.sent_by_role || msg.senderType,
          message: msg.message,
          timestamp: msg.created_at || msg.timestamp,
          playerId: playerId
        }));
        
        setMessages(formattedMessages);
        console.log('📚 [CHAT] Loaded chat history:', formattedMessages.length, 'messages');
      }
    } catch (error) {
      console.error('❌ [CHAT] Failed to load chat history:', error);
    }
  };

  const sendMessage = async () => {
    if (!newMessage.trim() || isLoading) return;

    setIsLoading(true);
    const messageText = newMessage.trim();
    setNewMessage('');

    try {
      const response = await fetch('/api/unified-chat/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          playerId,
          playerName,
          message: messageText,
          senderType: 'player'
        }),
      });

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || 'Failed to send message');
      }

      console.log('✅ [CHAT] Message sent successfully:', result.messageId);
      
      // Add message to local state immediately for better UX
      const localMessage: ChatMessage = {
        id: result.messageId?.toString() || Date.now().toString(),
        senderId: `player_${playerId}`,
        senderName: playerName,
        senderType: 'player',
        message: messageText,
        timestamp: new Date().toISOString(),
        playerId: playerId
      };
      
      setMessages(prev => [...prev, localMessage]);

      toast({
        title: 'Message sent',
        description: 'Your message has been sent to our support team.',
      });

    } catch (error) {
      console.error('❌ [CHAT] Failed to send message:', error);
      toast({
        title: 'Error',
        description: 'Failed to send message. Please try again.',
        variant: 'destructive',
      });
      setNewMessage(messageText); // Restore message on error
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
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px] h-[600px] flex flex-col bg-gray-900 border-gray-700">
        <DialogHeader className="pb-4 border-b border-gray-700">
          <DialogTitle className="flex items-center justify-between text-white">
            <div className="flex items-center gap-2">
              <span>Guest Relations Chat</span>
              <Badge variant={isConnected ? "default" : "secondary"} className="text-xs">
                {isConnected ? '🟢 Connected' : '🔴 Connecting...'}
              </Badge>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="text-gray-400 hover:text-white"
            >
              <X className="h-4 w-4" />
            </Button>
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="flex-1 p-4 space-y-4">
          {messages.length === 0 ? (
            <div className="text-center text-gray-400 py-8">
              <Clock className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>No messages yet. Start a conversation with our support team!</p>
            </div>
          ) : (
            <div className="space-y-4">
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={`flex ${message.senderType === 'player' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[80%] rounded-lg p-3 ${
                      message.senderType === 'player'
                        ? 'bg-blue-600 text-white'
                        : message.senderType === 'staff' || message.senderType === 'gre'
                        ? 'bg-gray-700 text-white'
                        : 'bg-gray-600 text-white'
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-medium">
                        {message.senderName}
                      </span>
                      <Badge variant="outline" className="text-xs">
                        {message.senderType.toUpperCase()}
                      </Badge>
                    </div>
                    <p className="text-sm">{message.message}</p>
                    <p className="text-xs opacity-70 mt-1">
                      {new Date(message.timestamp).toLocaleTimeString()}
                    </p>
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>
          )}
        </ScrollArea>

        <div className="border-t border-gray-700 p-4">
          <div className="flex gap-2">
            <Input
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Type your message..."
              disabled={isLoading}
              className="flex-1 bg-gray-800 border-gray-600 text-white placeholder-gray-400"
            />
            <Button
              onClick={sendMessage}
              disabled={isLoading || !newMessage.trim()}
              size="sm"
              className="bg-blue-600 hover:bg-blue-700"
            >
              {isLoading ? (
                <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
          </div>
          <p className="text-xs text-gray-400 mt-2">
            Press Enter to send • Real-time powered by Pusher Channels
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}