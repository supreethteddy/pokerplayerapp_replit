import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { MessageCircle, Send, X, Trash2, ArrowUp } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface FreshGreChatBubbleProps {
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

export default function FreshGreChatBubble({ isOpen, onClose }: FreshGreChatBubbleProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();
  
  // Get user info from localStorage
  const userInfo = JSON.parse(localStorage.getItem('user') || '{}');
  const playerId = userInfo.id;
  const playerName = `${userInfo.firstName || ''} ${userInfo.lastName || ''}`.trim();

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // FRESH SEND MESSAGE FUNCTION - Direct Supabase connection
  const sendMessage = async () => {
    if (!newMessage.trim() || !playerId || !playerName) {
      toast({
        title: "Error",
        description: "Please enter a message",
        variant: "destructive"
      });
      return;
    }

    setIsLoading(true);
    const messageText = newMessage.trim();
    
    try {
      console.log('🚀 [FRESH CHAT] Sending message:', messageText);
      
      const payload = {
        player_id: parseInt(playerId),
        player_name: playerName,
        message: messageText,
        timestamp: new Date().toISOString()
      };
      
      console.log('📝 [FRESH CHAT] Sending payload:', payload);
      
      const response = await fetch('/api/unified-chat/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const result = await response.json();
      
      if (!response.ok) {
        console.error('❌ [FRESH CHAT] Server error:', result);
        throw new Error(result.error || `Server returned ${response.status}`);
      }

      console.log('✅ [FRESH CHAT] Success response:', result);
      
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
      
      console.log('🎉 [FRESH CHAT] Message added to UI and cleared input');
      
      toast({
        title: "Message Sent",
        description: "Your message has been delivered to Guest Relations",
      });
      
    } catch (error) {
      console.error('💥 [FRESH CHAT] Send failed:', error);
      
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

  const clearChat = () => {
    setMessages([]);
    toast({
      title: "Chat Cleared",
      description: "All messages have been cleared"
    });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <Card className="w-full max-w-md h-96 flex flex-col bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 border border-emerald-600/30 shadow-2xl shadow-emerald-500/10">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 bg-gradient-to-r from-emerald-600 to-teal-600">
          <CardTitle className="text-white flex items-center gap-2">
            <MessageCircle className="h-5 w-5" />
            Guest Relations Chat
          </CardTitle>
          <div className="flex items-center gap-2">
            <Badge variant="default" className="bg-green-500 text-white">
              Live Chat
            </Badge>
            <Button
              variant="ghost"
              size="sm"
              onClick={clearChat}
              className="text-white hover:text-red-400"
              title="Clear chat"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="text-white hover:text-gray-300"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        
        <CardContent className="flex-1 flex flex-col p-4">
          <div className="flex-1 overflow-y-auto space-y-2 mb-4">
            {messages.length === 0 ? (
              <div className="text-center text-gray-400 mt-8">
                <MessageCircle className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>Start a conversation with our Guest Relations team!</p>
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
                        ? 'bg-emerald-600 text-white'
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
              className="flex-1 bg-gray-800 border-gray-600 text-white placeholder:text-gray-400"
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
                <ArrowUp className="h-4 w-4" />
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}