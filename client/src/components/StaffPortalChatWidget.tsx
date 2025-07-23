import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MessageCircle, Send, X, Clock, CheckCircle, AlertCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface ChatMessage {
  id: string;
  player_id: number;
  player_name: string;
  player_email: string;
  subject: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  status: 'waiting' | 'in_progress' | 'resolved' | 'closed';
  source: string;
  category?: string;
  created_at: string;
  updated_at: string;
}

interface StaffPortalChatWidgetProps {
  playerId: number;
  playerName: string;
  playerEmail: string;
}

export default function StaffPortalChatWidget({ playerId, playerName, playerEmail }: StaffPortalChatWidgetProps) {
  const [message, setMessage] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    testConnection();
    loadChatHistory();
    
    // Auto-refresh chat history every 5 seconds
    const interval = setInterval(loadChatHistory, 5000);
    return () => clearInterval(interval);
  }, [playerId]);

  const testConnection = async () => {
    try {
      console.log('🔌 Testing connection to chat_requests table (SAME AS STAFF PORTAL)...');
      const response = await fetch(`/api/chat/status/${playerId}`);
      const result = await response.json();
      
      if (result.success) {
        console.log('✅ Connected to chat_requests table - SYNCHRONIZED WITH STAFF PORTAL');
        console.log(`📊 Found ${result.messages?.length || 0} messages for player ${playerId}`);
        setIsConnected(true);
      } else {
        console.error('❌ Connection failed:', result.error);
        setIsConnected(false);
      }
    } catch (error) {
      console.error('❌ Connection test failed:', error);
      setIsConnected(false);
    }
  };

  const loadChatHistory = async () => {
    try {
      const response = await fetch(`/api/chat/status/${playerId}`);
      const result = await response.json();
      
      if (result.success) {
        setChatHistory(result.messages || []);
        console.log(`📋 Loaded ${result.messages?.length || 0} chat messages from Staff Portal`);
      }
    } catch (error) {
      console.error('❌ Failed to load chat history:', error);
    }
  };

  const sendMessage = async () => {
    if (!message.trim()) return;
    
    setIsSending(true);
    try {
      console.log('📤 SENDING TO EXACT SAME TABLE AS STAFF PORTAL...');
      console.log('   Table: chat_requests');
      console.log('   Player:', playerName);
      console.log('   Message:', message);
      
      const response = await fetch('/api/chat/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          playerId: playerId,
          playerName: playerName,
          playerEmail: playerEmail,
          message: message,
          priority: 'urgent'
        })
      });
      
      const result = await response.json();
      
      if (result.success) {
        console.log('✅ SUCCESS: Message sent to Staff Portal!');
        console.log('   Message ID:', result.request?.id);
        console.log('   Status:', result.request?.status);
        console.log('   🎯 CHECK STAFF PORTAL NOW - Should appear immediately');
        
        toast({
          title: "Message Sent Successfully!",
          description: "Your message has been sent to staff and should appear in Staff Portal immediately.",
        });
        
        setMessage('');
        await loadChatHistory(); // Reload to show new message
        
      } else {
        console.error('❌ Send failed:', result.error);
        toast({
          title: "Send Failed",
          description: result.error || "Failed to send message to staff",
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error('❌ Send error:', error);
      toast({
        title: "Error",
        description: "Network error - please try again",
        variant: "destructive"
      });
    }
    setIsSending(false);
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'waiting': return <Clock className="w-4 h-4 text-yellow-500" />;
      case 'in_progress': return <AlertCircle className="w-4 h-4 text-blue-500" />;
      case 'resolved': return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'closed': return <CheckCircle className="w-4 h-4 text-gray-500" />;
      default: return <Clock className="w-4 h-4 text-gray-400" />;
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent': return 'text-red-600 bg-red-50';
      case 'high': return 'text-orange-600 bg-orange-50';
      case 'medium': return 'text-yellow-600 bg-yellow-50';
      case 'low': return 'text-green-600 bg-green-50';
      default: return 'text-gray-600 bg-gray-50';
    }
  };

  if (!isOpen) {
    return (
      <div className="mb-4">
        <Button
          onClick={() => setIsOpen(true)}
          className="w-full bg-emerald-600 hover:bg-emerald-700 text-white"
          size="lg"
        >
          <MessageCircle className="w-5 h-5 mr-2" />
          Chat with Staff Portal ({chatHistory.length})
        </Button>
        
        <div className="text-center mt-2">
          <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs ${
            isConnected ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
          }`}>
            {isConnected ? '✅ Synchronized with Staff Portal' : '❌ Connection Issue'}
          </span>
        </div>
      </div>
    );
  }

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader className="bg-emerald-600 text-white">
        <div className="flex justify-between items-center">
          <CardTitle className="flex items-center">
            <MessageCircle className="w-5 h-5 mr-2" />
            Staff Portal Chat
          </CardTitle>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsOpen(false)}
            className="text-white hover:bg-emerald-700"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>
        <div className="text-emerald-100 text-sm">
          Real-time sync with Staff Portal • {isConnected ? 'Connected' : 'Disconnected'}
        </div>
      </CardHeader>
      
      <CardContent className="p-6">
        {/* Chat History */}
        {chatHistory.length > 0 && (
          <div className="mb-6">
            <h4 className="font-semibold text-gray-800 mb-3">Recent Messages ({chatHistory.length})</h4>
            <div className="space-y-3 max-h-64 overflow-y-auto">
              {chatHistory.slice(0, 5).map((msg) => (
                <div key={msg.id} className="bg-gray-50 p-3 rounded-lg border">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center space-x-2">
                      {getStatusIcon(msg.status)}
                      <span className="font-medium text-sm text-gray-800">You</span>
                      <span className={`px-2 py-1 rounded text-xs font-medium ${getPriorityColor(msg.priority)}`}>
                        {msg.priority.toUpperCase()}
                      </span>
                    </div>
                    <span className="text-xs text-gray-500">
                      {new Date(msg.created_at).toLocaleDateString()} {new Date(msg.created_at).toLocaleTimeString()}
                    </span>
                  </div>
                  <div className="text-gray-700 text-sm">
                    {msg.subject}
                  </div>
                  <div className="text-xs text-gray-500 mt-1">
                    Status: <span className="font-medium">{msg.status}</span> • ID: {msg.id.substring(0, 8)}...
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Message Input */}
        <div className="space-y-4">
          <div>
            <label htmlFor="staff-message" className="block text-sm font-medium text-gray-700 mb-2">
              Message to Staff Portal
            </label>
            <Textarea
              id="staff-message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Type your message to staff..."
              className="min-h-[100px] resize-none"
              disabled={isSending}
            />
          </div>
          
          <Button
            onClick={sendMessage}
            disabled={isSending || !message.trim() || !isConnected}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white"
            size="lg"
          >
            {isSending ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                Sending to Staff Portal...
              </>
            ) : (
              <>
                <Send className="w-4 h-4 mr-2" />
                Send to Staff Portal
              </>
            )}
          </Button>
          
          <div className="text-xs text-gray-500 text-center">
            Messages save to chat_requests table (same as Staff Portal)
            <br />
            Staff will see your message within seconds
          </div>
        </div>
      </CardContent>
    </Card>
  );
}