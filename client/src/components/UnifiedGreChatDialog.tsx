import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { MessageCircle, Send, X, Minimize2 } from 'lucide-react';
import { useUltraFastAuth } from '../hooks/useUltraFastAuth';

interface Message {
  id: string;
  content: string;
  sender: 'player' | 'staff';
  timestamp: string;
  sender_name?: string;
}

interface ChatSession {
  id: string;
  status: 'pending' | 'active' | 'resolved';
  messages: Message[];
}

export default function UnifiedGreChatDialog() {
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [message, setMessage] = useState('');
  const [session, setSession] = useState<ChatSession | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { user } = useUltraFastAuth();

  useEffect(() => {
    if (isOpen && user) {
      loadOrCreateSession();
    }
  }, [isOpen, user]);

  useEffect(() => {
    scrollToBottom();
  }, [session?.messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const loadOrCreateSession = async () => {
    if (!user) return;
    
    setIsLoading(true);
    try {
      const response = await fetch(`/api/gre-chat/session/${user.id}`);
      
      if (response.ok) {
        const data = await response.json();
        setSession(data);
      } else {
        // Create new session
        const createResponse = await fetch('/api/gre-chat/session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            playerId: user.id,
            playerName: user.firstName || user.email,
            playerEmail: user.email
          })
        });
        
        if (createResponse.ok) {
          const newSession = await createResponse.json();
          setSession(newSession);
        }
      }
    } catch (error) {
      console.error('Error loading chat session:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const sendMessage = async () => {
    if (!message.trim() || !session || !user) return;
    
    const messageData = {
      sessionId: session.id,
      content: message.trim(),
      senderId: user.id,
      senderName: user.firstName || user.email,
      senderType: 'player'
    };
    
    try {
      const response = await fetch('/api/gre-chat/message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(messageData)
      });
      
      if (response.ok) {
        const newMessage = await response.json();
        setSession(prev => prev ? {
          ...prev,
          messages: [...prev.messages, newMessage]
        } : null);
        setMessage('');
      }
    } catch (error) {
      console.error('Error sending message:', error);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  if (!user) return null;

  if (isMinimized) {
    return (
      <div className="fixed bottom-4 right-4 z-50">
        <Button
          onClick={() => setIsMinimized(false)}
          className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-full p-3 shadow-lg"
        >
          <MessageCircle className="w-6 h-6" />
        </Button>
      </div>
    );
  }

  return (
    <>
      <div className="fixed bottom-4 right-4 z-50">
        <Button
          onClick={() => setIsOpen(true)}
          className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-full p-3 shadow-lg"
        >
          <MessageCircle className="w-6 h-6" />
        </Button>
      </div>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="sm:max-w-md bg-slate-800 border-slate-700">
          <DialogHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <DialogTitle className="text-white">Guest Relations Chat</DialogTitle>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsMinimized(true)}
                className="text-slate-400 hover:text-white h-8 w-8 p-0"
              >
                <Minimize2 className="w-4 h-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsOpen(false)}
                className="text-slate-400 hover:text-white h-8 w-8 p-0"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          </DialogHeader>

          {isLoading ? (
            <div className="flex items-center justify-center h-48">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500"></div>
            </div>
          ) : (
            <>
              <ScrollArea className="h-64 w-full pr-4">
                <div className="space-y-3">
                  {session?.messages.map((msg) => (
                    <div
                      key={msg.id}
                      className={`flex ${msg.sender === 'player' ? 'justify-end' : 'justify-start'}`}
                    >
                      <div
                        className={`max-w-[80%] rounded-lg px-3 py-2 ${
                          msg.sender === 'player'
                            ? 'bg-emerald-600 text-white'
                            : 'bg-slate-600 text-white'
                        }`}
                      >
                        <p className="text-sm">{msg.content}</p>
                        <p className="text-xs opacity-70 mt-1">
                          {new Date(msg.timestamp).toLocaleTimeString()}
                        </p>
                      </div>
                    </div>
                  ))}
                  <div ref={messagesEndRef} />
                </div>
              </ScrollArea>

              <div className="flex items-center space-x-2 pt-2">
                <Input
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder="Type your message..."
                  className="bg-slate-700 border-slate-600 text-white placeholder:text-slate-400"
                />
                <Button
                  onClick={sendMessage}
                  disabled={!message.trim()}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white"
                >
                  <Send className="w-4 h-4" />
                </Button>
              </div>

              <div className="text-xs text-slate-400 mt-2">
                Status: {session?.status === 'active' ? 'Connected' : 'Waiting for staff...'}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}