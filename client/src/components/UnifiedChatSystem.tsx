import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  AlertTriangle,
  Wifi,
  WifiOff
} from "lucide-react";

interface ChatMessage {
  id: string;
  player_id: number;
  player_name: string;
  message: string;
  sender: 'player' | 'gre';
  sender_name: string;
  timestamp: string;
  status: 'sent' | 'delivered' | 'read';
  is_read?: boolean;
}

interface UnifiedChatSystemProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function UnifiedChatSystem({ isOpen, onClose }: UnifiedChatSystemProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'disconnected'>('disconnected');
  const wsRef = useRef<WebSocket | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // **ENTERPRISE-GRADE CONNECTION MANAGEMENT**
  const connectWebSocket = useCallback(() => {
    if (!user) return;

    try {
      setConnectionStatus('connecting');
      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      const wsUrl = `${protocol}//${window.location.host}/chat-ws`;
      
      console.log('🔗 [UNIFIED CHAT] Connecting to WebSocket:', wsUrl);
      
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log('✅ [UNIFIED CHAT] WebSocket connected');
        setConnectionStatus('connected');
        setIsConnected(true);
        
        // Authenticate with Staff Portal compatible format
        const authMessage = {
          type: 'authenticate',
          playerId: user.id,
          playerName: `${user.firstName} ${user.lastName}`,
          playerEmail: user.email,
          timestamp: new Date().toISOString()
        };
        
        ws.send(JSON.stringify(authMessage));
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          console.log('📨 [UNIFIED CHAT] Received:', data);
          
          switch (data.type) {
            case 'authenticated':
              console.log('🔐 [UNIFIED CHAT] Authentication successful');
              loadChatHistory();
              break;
              
            case 'chat_history':
              if (data.messages && Array.isArray(data.messages)) {
                setMessages(data.messages);
                console.log(`📋 [UNIFIED CHAT] Loaded ${data.messages.length} messages`);
              }
              break;
              
            case 'new_message':
              if (data.message) {
                setMessages(prev => [...prev, data.message]);
                console.log('💬 [UNIFIED CHAT] New message received');
              }
              break;
              
            case 'gre_response':
              if (data.message) {
                setMessages(prev => [...prev, data.message]);
                toast({
                  title: "New Response",
                  description: "Guest Relations has replied to your message",
                });
              }
              break;
              
            default:
              console.log('📨 [UNIFIED CHAT] Unknown message type:', data.type);
          }
        } catch (error) {
          console.error('❌ [UNIFIED CHAT] Error parsing message:', error);
        }
      };

      ws.onclose = (event) => {
        console.log('🔌 [UNIFIED CHAT] WebSocket closed:', event.code, event.reason);
        setConnectionStatus('disconnected');
        setIsConnected(false);
        wsRef.current = null;
        
        // Auto-reconnect after 3 seconds
        if (isOpen) {
          reconnectTimeoutRef.current = setTimeout(() => {
            console.log('🔄 [UNIFIED CHAT] Attempting to reconnect...');
            connectWebSocket();
          }, 3000);
        }
      };

      ws.onerror = (error) => {
        console.error('❌ [UNIFIED CHAT] WebSocket error:', error);
        setConnectionStatus('disconnected');
        setIsConnected(false);
      };

    } catch (error) {
      console.error('❌ [UNIFIED CHAT] Connection failed:', error);
      setConnectionStatus('disconnected');
      setIsConnected(false);
    }
  }, [user, isOpen]);

  // **LOAD CHAT HISTORY FROM STAFF PORTAL**
  const loadChatHistory = async () => {
    if (!user) return;
    
    try {
      console.log('📋 [UNIFIED CHAT] Loading chat history...');
      const response = await fetch(`/api/gre-chat/messages/${user.id}`);
      
      if (response.ok) {
        const data = await response.json();
        if (Array.isArray(data)) {
          setMessages(data);
          console.log(`✅ [UNIFIED CHAT] Loaded ${data.length} messages from history`);
        }
      }
    } catch (error) {
      console.error('❌ [UNIFIED CHAT] Failed to load chat history:', error);
    }
  };

  // **UNIFIED MESSAGE SENDING (WebSocket + REST Fallback)**
  const sendMessage = async () => {
    if (!message.trim() || !user || isSending) return;

    setIsSending(true);
    const messageText = message.trim();
    
    try {
      // **PRIMARY: WebSocket Real-time Sending**
      if (wsRef.current && isConnected && wsRef.current.readyState === WebSocket.OPEN) {
        console.log('📤 [UNIFIED CHAT] Sending via WebSocket');
        
        const messageData = {
          type: 'player_message',
          playerId: user.id,
          playerName: `${user.firstName} ${user.lastName}`,
          playerEmail: user.email,
          message: messageText,
          timestamp: new Date().toISOString(),
          // Staff Portal Integration Fields
          universalId: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          portalOrigin: 'PokerRoomTracker',
          targetPortal: 'PokerStaffPortal',
          messageFormat: 'unified'
        };
        
        // Add optimistic message to UI immediately
        const optimisticMessage: ChatMessage = {
          id: messageData.universalId,
          player_id: user.id,
          player_name: `${user.firstName} ${user.lastName}`,
          message: messageText,
          sender: 'player',
          sender_name: `${user.firstName} ${user.lastName}`,
          timestamp: new Date().toISOString(),
          status: 'sent'
        };
        
        setMessages(prev => [...prev, optimisticMessage]);
        setMessage('');
        
        wsRef.current.send(JSON.stringify(messageData));
        
        toast({
          title: "Message Sent",
          description: "Your message was sent via real-time connection",
        });
        
      } else {
        // **FALLBACK: REST API**
        console.log('🔄 [UNIFIED CHAT] WebSocket unavailable, using REST API');
        
        const response = await fetch('/api/gre-chat/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            playerId: user.id,
            playerName: `${user.firstName} ${user.lastName}`,
            playerEmail: user.email,
            message: messageText,
            timestamp: new Date().toISOString()
          })
        });
        
        if (response.ok) {
          const result = await response.json();
          console.log('✅ [UNIFIED CHAT] Message sent via REST API:', result);
          
          // Add message to local state
          if (result.message) {
            setMessages(prev => [...prev, result.message]);
          }
          
          setMessage('');
          toast({
            title: "Message Sent",
            description: "Your message was sent successfully",
          });
        } else {
          throw new Error('Failed to send message via REST API');
        }
      }
      
    } catch (error) {
      console.error('❌ [UNIFIED CHAT] Send failed:', error);
      toast({
        title: "Send Failed",
        description: "Failed to send message. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSending(false);
    }
  };

  // **LIFECYCLE MANAGEMENT**
  useEffect(() => {
    if (isOpen && user) {
      connectWebSocket();
    }
    
    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [isOpen, connectWebSocket]);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // **QUICK ACTION BUTTONS**
  const quickActions = [
    "I need help with my account",
    "Technical support",
    "Payment history",
    "Game assistance"
  ];

  const handleQuickAction = (actionText: string) => {
    setMessage(actionText);
  };

  const formatTime = (timestamp: string) => {
    return new Date(timestamp).toLocaleTimeString([], { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  const getConnectionIcon = () => {
    switch (connectionStatus) {
      case 'connected': return <Wifi className="w-4 h-4 text-emerald-500" />;
      case 'connecting': return <Clock className="w-4 h-4 text-yellow-500 animate-spin" />;
      default: return <WifiOff className="w-4 h-4 text-red-500" />;
    }
  };

  if (!isOpen) return null;

  return (
    <Card className="fixed inset-0 md:relative md:w-full md:max-w-2xl md:mx-auto z-50 bg-slate-900 border-slate-700">
      <CardHeader className="bg-emerald-600 text-white">
        <div className="flex justify-between items-center">
          <CardTitle className="flex items-center space-x-2">
            <Headphones className="w-5 h-5" />
            <span>Guest Relations Support</span>
            {getConnectionIcon()}
          </CardTitle>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="text-white hover:bg-emerald-700"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>
        <div className="text-emerald-100 text-sm">
          {connectionStatus === 'connected' ? '🟢 Real-time connection active' : 
           connectionStatus === 'connecting' ? '🟡 Connecting...' : 
           '🔴 Using fallback mode'}
        </div>
      </CardHeader>
      
      <CardContent className="p-0 flex flex-col h-[500px]">
        {/* Messages Area */}
        <ScrollArea className="flex-1 p-4">
          <div className="space-y-4">
            {messages.length === 0 ? (
              <div className="text-center text-slate-400 py-8">
                <MessageCircle className="w-12 h-12 mx-auto mb-4 text-slate-600" />
                <h3 className="text-lg font-medium text-slate-300 mb-2">
                  Start a Conversation
                </h3>
                <p className="text-sm">
                  Our Guest Relations team is here to help you 24/7.
                </p>
              </div>
            ) : (
              messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex ${msg.sender === 'player' ? 'justify-end' : 'justify-start'}`}
                >
                  <div className="flex items-end space-x-2 max-w-[80%]">
                    {msg.sender === 'gre' && (
                      <div className="w-8 h-8 bg-emerald-500 rounded-full flex items-center justify-center">
                        <Headphones className="w-4 h-4 text-white" />
                      </div>
                    )}
                    <div>
                      <div
                        className={`rounded-lg px-3 py-2 ${
                          msg.sender === 'player'
                            ? 'bg-blue-600 text-white'
                            : 'bg-slate-700 text-slate-100'
                        }`}
                      >
                        <p className="text-sm">{msg.message}</p>
                      </div>
                      <div className="flex items-center mt-1 space-x-2">
                        <span className="text-xs text-slate-500">
                          {formatTime(msg.timestamp)}
                        </span>
                        {msg.sender === 'player' && (
                          <Badge variant="secondary" className="text-xs px-1 py-0">
                            {msg.status === 'read' ? 'Read' : msg.status === 'delivered' ? 'Delivered' : 'Sent'}
                          </Badge>
                        )}
                      </div>
                    </div>
                    {msg.sender === 'player' && (
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

        {/* Quick Actions */}
        <div className="p-4 border-t border-slate-700">
          <div className="text-xs text-slate-500 mb-2">Quick Actions:</div>
          <div className="flex flex-wrap gap-2 mb-4">
            {quickActions.map((action) => (
              <Button
                key={action}
                variant="outline"
                size="sm"
                onClick={() => handleQuickAction(action)}
                className="text-xs border-slate-600 text-slate-300 hover:bg-slate-700"
              >
                {action}
              </Button>
            ))}
          </div>

          {/* Message Input */}
          <div className="flex space-x-2">
            <Input
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Type your message..."
              className="flex-1 bg-slate-800 border-slate-600 text-white placeholder-slate-400"
              disabled={isSending}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  sendMessage();
                }
              }}
            />
            <Button
              onClick={sendMessage}
              disabled={!message.trim() || isSending}
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              {isSending ? (
                <Clock className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}