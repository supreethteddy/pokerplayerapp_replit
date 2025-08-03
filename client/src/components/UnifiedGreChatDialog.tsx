
import React, { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Send, MessageCircle, X, Minimize2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/hooks/useAuth';

interface ChatMessage {
  id: string;
  message: string;
  sender: 'player' | 'gre';
  sender_name: string;
  timestamp: string;
  status: string;
}

interface UnifiedGreChatDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

export const UnifiedGreChatDialog: React.FC<UnifiedGreChatDialogProps> = ({ isOpen, onClose }) => {
  const { user } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [wsConnection, setWsConnection] = useState<WebSocket | null>(null);
  const [pusherConnection, setPusherConnection] = useState<any>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Initialize Pusher connection
  useEffect(() => {
    if (!isOpen || !user?.id) return;

    const initializePusher = async () => {
      try {
        // Dynamic import of Pusher
        const Pusher = (await import('pusher-js')).default;
        
        const pusher = new Pusher(import.meta.env.VITE_PUSHER_KEY || '81b98cb04ef7aeef2baa', {
          cluster: import.meta.env.VITE_PUSHER_CLUSTER || 'ap2',
          encrypted: true
        });

        const channel = pusher.subscribe(`player-${user.id}`);
        
        channel.bind('new-gre-message', (data: any) => {
          console.log('🔔 [PUSHER] New GRE message received:', data);
          
          const newMessage: ChatMessage = {
            id: data.messageId || Date.now().toString(),
            message: data.message,
            sender: 'gre',
            sender_name: data.senderName || 'Guest Relations Executive',
            timestamp: data.timestamp || new Date().toISOString(),
            status: 'received'
          };
          
          setMessages(prev => [...prev, newMessage]);
          scrollToBottom();
        });

        setPusherConnection(pusher);
        console.log(`✅ [PUSHER] Connected to player-${user.id} channel`);

      } catch (error) {
        console.error('❌ [PUSHER] Connection failed:', error);
      }
    };

    initializePusher();

    // Cleanup on unmount
    return () => {
      if (pusherConnection) {
        pusherConnection.disconnect();
        console.log('🔌 [PUSHER] Disconnected');
      }
    };
  }, [isOpen, user?.id]);

  // Initialize WebSocket connection
  useEffect(() => {
    if (!isOpen || !user?.id) return;

    const connectWebSocket = () => {
      try {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${protocol}//${window.location.host}/chat-ws`;
        
        console.log('🔗 [WEBSOCKET] Connecting to:', wsUrl);
        
        const ws = new WebSocket(wsUrl);
        
        ws.onopen = () => {
          console.log('✅ [WEBSOCKET] Connected successfully');
          
          // Send authentication message
          ws.send(JSON.stringify({
            type: 'auth',
            playerId: user.id,
            playerName: `${user.firstName} ${user.lastName}`
          }));
        };
        
        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            console.log('📨 [WEBSOCKET] Message received:', data);
            
            if (data.type === 'new-message') {
              const newMessage: ChatMessage = {
                id: data.id || Date.now().toString(),
                message: data.message,
                sender: data.sender,
                sender_name: data.sender_name,
                timestamp: data.timestamp,
                status: 'received'
              };
              
              setMessages(prev => [...prev, newMessage]);
              scrollToBottom();
            }
          } catch (error) {
            console.error('❌ [WEBSOCKET] Message parse error:', error);
          }
        };
        
        ws.onclose = (event) => {
          console.log('🔌 [WEBSOCKET] Connection closed:', event.code, event.reason);
          
          // Auto-reconnect after 3 seconds if not intentional close
          if (event.code !== 1000 && isOpen) {
            setTimeout(() => {
              console.log('🔄 [WEBSOCKET] Attempting reconnection...');
              connectWebSocket();
            }, 3000);
          }
        };
        
        ws.onerror = (error) => {
          console.error('❌ [WEBSOCKET] Connection error:', error);
        };
        
        setWsConnection(ws);
        
      } catch (error) {
        console.error('❌ [WEBSOCKET] Setup failed:', error);
      }
    };

    // Initial connection
    connectWebSocket();

    // Cleanup on unmount
    return () => {
      if (wsConnection) {
        wsConnection.close(1000, 'Component unmounting');
      }
    };
  }, [isOpen, user?.id]);

  // Load existing messages
  useEffect(() => {
    if (!isOpen || !user?.id) return;

    const loadMessages = async () => {
      try {
        setIsLoading(true);
        const response = await fetch(`/api/unified-chat/messages/${user.id}`);
        
        if (response.ok) {
          const messagesData = await response.json();
          setMessages(messagesData);
          console.log(`✅ [CHAT] Loaded ${messagesData.length} existing messages`);
          setTimeout(scrollToBottom, 100);
        } else {
          console.error('❌ [CHAT] Failed to load messages:', response.statusText);
        }
      } catch (error) {
        console.error('❌ [CHAT] Error loading messages:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadMessages();
  }, [isOpen, user?.id]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const sendMessage = async () => {
    if (!newMessage.trim() || !user?.id || isLoading) return;

    const messageText = newMessage.trim();
    setNewMessage('');
    setIsLoading(true);

    try {
      const response = await fetch('/api/unified-chat/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          playerId: user.id,
          playerName: `${user.firstName} ${user.lastName}`,
          message: messageText,
          senderType: 'player'
        }),
      });

      if (response.ok) {
        const result = await response.json();
        console.log('✅ [CHAT] Message sent successfully:', result);
        
        // Add message to local state immediately
        const newMsg: ChatMessage = {
          id: result.data?.id || Date.now().toString(),
          message: messageText,
          sender: 'player',
          sender_name: `${user.firstName} ${user.lastName}`,
          timestamp: new Date().toISOString(),
          status: 'sent'
        };
        
        setMessages(prev => [...prev, newMsg]);
        scrollToBottom();
        
      } else {
        const error = await response.json();
        console.error('❌ [CHAT] Send failed:', error);
        alert('Failed to send message. Please try again.');
      }
    } catch (error) {
      console.error('❌ [CHAT] Send error:', error);
      alert('Network error. Please check your connection.');
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
        initial={{ opacity: 0, scale: 0.8, y: 20 }}
        animate={{ 
          opacity: 1, 
          scale: 1, 
          y: 0,
          height: isMinimized ? 'auto' : '600px'
        }}
        exit={{ opacity: 0, scale: 0.8, y: 20 }}
        className="fixed bottom-4 right-4 z-50 w-96 bg-white dark:bg-gray-800 rounded-lg shadow-2xl border border-gray-200 dark:border-gray-700"
      >
        <Card className="h-full border-0 shadow-none">
          <CardHeader className="flex flex-row items-center justify-between p-4 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-t-lg">
            <div className="flex items-center space-x-2">
              <Avatar className="h-8 w-8">
                <AvatarFallback className="bg-white text-green-600 text-sm font-semibold">
                  GRE
                </AvatarFallback>
              </Avatar>
              <div>
                <CardTitle className="text-sm font-semibold">Guest Relations Executive</CardTitle>
                <p className="text-xs opacity-90">
                  {pusherConnection ? '🟢 Online' : '🔄 Connecting...'}
                </p>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <Button
                size="sm"
                variant="ghost"
                className="h-8 w-8 p-0 text-white hover:bg-white/20"
                onClick={() => setIsMinimized(!isMinimized)}
              >
                <Minimize2 className="h-4 w-4" />
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="h-8 w-8 p-0 text-white hover:bg-white/20"
                onClick={onClose}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>

          {!isMinimized && (
            <CardContent className="flex flex-col h-[500px] p-0">
              <ScrollArea className="flex-1 p-4" ref={scrollAreaRef}>
                <div className="space-y-4">
                  {isLoading && messages.length === 0 ? (
                    <div className="text-center text-gray-500 dark:text-gray-400 py-8">
                      Loading messages...
                    </div>
                  ) : messages.length === 0 ? (
                    <div className="text-center text-gray-500 dark:text-gray-400 py-8">
                      <MessageCircle className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p className="text-sm">Start a conversation with our Guest Relations Executive</p>
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
                    disabled={isLoading}
                    className="flex-1"
                  />
                  <Button
                    onClick={sendMessage}
                    disabled={isLoading || !newMessage.trim()}
                    size="sm"
                    className="bg-green-500 hover:bg-green-600 text-white"
                  >
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                  {wsConnection?.readyState === WebSocket.OPEN ? '🟢 Connected' : '🔄 Connecting...'}
                </p>
              </div>
            </CardContent>
          )}
        </Card>
      </motion.div>
    </AnimatePresence>
  );
};

export default UnifiedGreChatDialog;
