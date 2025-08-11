import { useState, useRef, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Send, MessageSquare, Clock, CheckCircle2, Archive, ArrowLeft } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { apiRequest } from "@/lib/queryClient";

interface ChatMessage {
  id: string;
  message_text: string;
  sender: 'player' | 'gre';
  sender_name: string;
  timestamp: string;
  status: string;
}

interface ChatRequest {
  id: string;
  subject: string;
  status: 'waiting' | 'active' | 'resolved';
  created_at: string;
  resolved_at?: string;
  chat_messages: ChatMessage[];
}

interface EnhancedChatDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onMessagesUpdate?: (messages: any[]) => void;
}

export function EnhancedChatDialog({ 
  isOpen, 
  onOpenChange, 
  onMessagesUpdate 
}: EnhancedChatDialogProps) {
  const [currentView, setCurrentView] = useState<'history' | 'chat'>('history');
  const [selectedRequest, setSelectedRequest] = useState<ChatRequest | null>(null);
  const [conversations, setConversations] = useState<ChatRequest[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [playerData, setPlayerData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  
  const { user } = useAuth();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const pusherRef = useRef<any>(null);

  // Fetch player data from the API
  useEffect(() => {
    const fetchPlayerData = async () => {
      if (user?.id && !playerData) {
        try {
          const response = await fetch(`/api/players/supabase/${user.id}`);
          if (response.ok) {
            const data = await response.json();
            setPlayerData(data);
          }
        } catch (error) {
          console.error('Failed to fetch player data:', error);
        }
      }
    };
    fetchPlayerData();
  }, [user?.id, playerData]);

  // Get player ID with robust fallback
  const playerId = playerData?.id || 29; // Use 29 as fallback for testing
  const playerName = playerData ? 
    `${playerData.firstName || ''} ${playerData.lastName || ''}`.trim() :
    'vignesh gana';

  // Load chat history when dialog opens
  useEffect(() => {
    if (isOpen && playerId) {
      loadChatHistory();
    }
  }, [isOpen, playerId]);

  // Setup Pusher for real-time updates
  useEffect(() => {
    if (isOpen && playerId) {
      setupPusherConnection();
    }
    return () => {
      if (pusherRef.current) {
        pusherRef.current.disconnect();
      }
    };
  }, [isOpen, playerId]);

  const loadChatHistory = async () => {
    try {
      setLoading(true);
      console.log(`🔄 [CHAT HISTORY] Loading for player ${playerId}`);
      
      const response = await fetch(`/api/chat-history/${playerId}`);
      if (response.ok) {
        const data = await response.json();
        setConversations(data.conversations || []);
        console.log(`✅ [CHAT HISTORY] Loaded ${data.conversations?.length || 0} conversations`);
      }
    } catch (error) {
      console.error('❌ [CHAT HISTORY] Failed to load:', error);
    } finally {
      setLoading(false);
    }
  };

  const setupPusherConnection = async () => {
    try {
      const { default: Pusher } = await import('pusher-js');
      
      console.log('🔑 [PUSHER] Using key:', import.meta.env.VITE_PUSHER_KEY);
      console.log('🌐 [PUSHER] Using cluster:', import.meta.env.VITE_PUSHER_CLUSTER);
      
      const pusher = new Pusher(import.meta.env.VITE_PUSHER_KEY, {
        cluster: import.meta.env.VITE_PUSHER_CLUSTER,
        forceTLS: true,
      });

      // Subscribe to player-specific channel
      const playerChannel = pusher.subscribe(`player-${playerId}`);
      
      playerChannel.bind('new-gre-message', (data: any) => {
        console.log('🚀 [PUSHER] New GRE message received:', data);
        const newMessage: ChatMessage = {
          id: data.messageId || Date.now().toString(),
          message_text: data.message,
          sender: 'gre',
          sender_name: data.senderName || 'Guest Relations Executive',
          timestamp: data.timestamp || new Date().toISOString(),
          status: 'sent'
        };
        
        setMessages(prev => [...prev, newMessage]);
        if (onMessagesUpdate) {
          onMessagesUpdate([newMessage]);
        }
      });

      pusherRef.current = pusher;
      console.log('✅ [PUSHER] Connected for player', playerId);
      
    } catch (error) {
      console.error('❌ [PUSHER] Connection failed:', error);
    }
  };

  const sendMessage = async () => {
    if (!inputMessage.trim() || isSending || !playerId) return;

    setIsSending(true);
    try {
      console.log('🚀 [SEND MESSAGE] Sending:', inputMessage);
      
      const newMessage: ChatMessage = {
        id: Date.now().toString(),
        message_text: inputMessage,
        sender: 'player',
        sender_name: playerName,
        timestamp: new Date().toISOString(),
        status: 'sending'
      };

      // Add message to UI immediately
      setMessages(prev => [...prev, newMessage]);
      setInputMessage('');

      // Send to backend using EXACT Staff Portal Integration endpoint
      const sessionId = `player-session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const response = await fetch('/api/staff-chat-integration/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          requestId: sessionId,
          playerId,
          playerName,
          message: inputMessage,
          staffId: 151,
          staffName: "Guest Relation Executive"
        })
      });

      if (response.ok) {
        const result = await response.json();
        console.log('✅ [SEND MESSAGE] Success');
        // Update message status
        setMessages(prev => prev.map(msg => 
          msg.id === newMessage.id 
            ? { ...msg, status: 'sent', id: result.data?.id || newMessage.id }
            : msg
        ));
      } else {
        throw new Error('Failed to send message');
      }
      
    } catch (error) {
      console.error('❌ [SEND MESSAGE] Error:', error);
      // Mark message as failed
      setMessages(prev => prev.map(msg => 
        msg.id === newMessage.id 
          ? { ...msg, status: 'failed' }
          : msg
      ));
    } finally {
      setIsSending(false);
    }
  };

  const startNewChat = () => {
    setSelectedRequest(null);
    setMessages([]);
    setCurrentView('chat');
  };

  const openConversation = (request: ChatRequest) => {
    setSelectedRequest(request);
    setMessages(request.chat_messages || []);
    setCurrentView('chat');
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'waiting': return <Clock className="w-4 h-4 text-yellow-500" />;
      case 'active': return <CheckCircle2 className="w-4 h-4 text-green-500" />;
      case 'resolved': return <Archive className="w-4 h-4 text-gray-500" />;
      default: return <MessageSquare className="w-4 h-4" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'waiting': return 'text-yellow-500 bg-yellow-500/10';
      case 'active': return 'text-green-500 bg-green-500/10';
      case 'resolved': return 'text-gray-500 bg-gray-500/10';
      default: return 'text-blue-500 bg-blue-500/10';
    }
  };

  const formatTime = (timestamp: string) => {
    return new Date(timestamp).toLocaleString();
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="bg-slate-900 border-slate-700 text-white max-w-sm w-80">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2">
            {currentView === 'chat' && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setCurrentView('history')}
                className="p-1 mr-2"
              >
                <ArrowLeft className="w-4 h-4" />
              </Button>
            )}
            <MessageSquare className="w-5 h-5 text-emerald-500" />
            <span>
              {currentView === 'history' ? 'Chat History' : 
               selectedRequest ? `Chat: ${selectedRequest.subject}` : 'New Chat'}
            </span>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {currentView === 'history' ? (
            // Chat History View
            <div className="space-y-3">
              <Button
                onClick={startNewChat}
                className="w-full bg-emerald-600 hover:bg-emerald-700"
              >
                Start New Chat
              </Button>
              
              <ScrollArea className="h-64 w-full">
                {loading ? (
                  <div className="text-center text-slate-400 py-8">
                    <MessageSquare className="w-8 h-8 mx-auto mb-2 text-slate-600" />
                    <p>Loading chat history...</p>
                  </div>
                ) : conversations.length === 0 ? (
                  <div className="text-center text-slate-400 py-8">
                    <MessageSquare className="w-8 h-8 mx-auto mb-2 text-slate-600" />
                    <p>No previous conversations</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {conversations.map((request) => (
                      <div
                        key={request.id}
                        onClick={() => openConversation(request)}
                        className="p-3 border border-slate-700 rounded-lg cursor-pointer hover:bg-slate-800 transition-colors"
                      >
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-medium text-sm">{request.subject}</span>
                          <div className={`px-2 py-1 rounded text-xs flex items-center space-x-1 ${getStatusColor(request.status)}`}>
                            {getStatusIcon(request.status)}
                            <span className="capitalize">{request.status}</span>
                          </div>
                        </div>
                        <p className="text-xs text-slate-400">
                          {formatTime(request.created_at)}
                        </p>
                        {request.chat_messages && request.chat_messages.length > 0 && (
                          <p className="text-xs text-slate-300 mt-1 truncate">
                            Last: {request.chat_messages[request.chat_messages.length - 1]?.message_text}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </div>
          ) : (
            // Chat Messages View
            <>
              <ScrollArea className="h-56 w-full border border-slate-700 rounded-lg p-3">
                <div className="space-y-3">
                  {messages.length === 0 ? (
                    <div className="text-center text-slate-400 py-8">
                      <MessageSquare className="w-8 h-8 mx-auto mb-2 text-slate-600" />
                      <p>Start a conversation with Guest Relations</p>
                    </div>
                  ) : (
                    messages.map((message) => (
                      <div
                        key={message.id}
                        className={`flex ${message.sender === 'player' ? 'justify-end' : 'justify-start'}`}
                      >
                        <div
                          className={`max-w-[80%] p-3 rounded-lg ${
                            message.sender === 'player'
                              ? 'bg-emerald-600 text-white'
                              : 'bg-slate-700 text-slate-100'
                          }`}
                        >
                          <div className="text-xs font-medium mb-1 opacity-80">
                            {message.sender_name}
                          </div>
                          <div className="text-sm">{message.message_text}</div>
                          <div className="text-xs mt-1 opacity-60">
                            {formatTime(message.timestamp)}
                            {message.status === 'sending' && ' • Sending...'}
                            {message.status === 'failed' && ' • Failed'}
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                  <div ref={messagesEndRef} />
                </div>
              </ScrollArea>

              <div className="flex space-x-2">
                <input
                  type="text"
                  value={inputMessage}
                  onChange={(e) => setInputMessage(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
                  placeholder="Type your message..."
                  className="flex-1 px-3 py-2 bg-slate-800 border border-slate-600 rounded-md text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  disabled={isSending}
                />
                <Button
                  onClick={sendMessage}
                  disabled={!inputMessage.trim() || isSending}
                  className="px-3 bg-emerald-600 hover:bg-emerald-700"
                >
                  <Send className="w-4 h-4" />
                </Button>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}