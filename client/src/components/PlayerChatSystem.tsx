import React, { useState, useEffect, useRef, useMemo } from 'react';
import { MessageCircle, X, Send } from 'lucide-react';
import { apiRequest } from "@/lib/queryClient";
import { io, Socket } from "socket.io-client";
import { API_BASE_URL, STORAGE_KEYS } from "@/lib/api/config";

interface PlayerChatSystemProps {
  playerId: string;
  playerName: string;
  isInDialog?: boolean;
  onClose?: () => void;
}

interface ChatMessage {
  id: string;
  message: string;
  sender: 'player' | 'staff';
  sender_name: string;
  timestamp: string;
  isFromStaff: boolean;
}

const PlayerChatSystem: React.FC<PlayerChatSystemProps> = ({ playerId, playerName, isInDialog = false, onClose }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [isConnected, setIsConnected] = useState(true);
  const [sessionStatus, setSessionStatus] = useState<'none' | 'pending' | 'active' | 'recent'>('none');
  const [isOpen, setIsOpen] = useState(false);
  const [hasUnread, setHasUnread] = useState(false);
  const socketRef = useRef<Socket | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const storageKey = useMemo(
    () => (playerId ? `player_chat_${playerId}` : 'player_chat'),
    [playerId]
  );

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Load messages function that can be called whenever chat opens
  const loadChatHistory = async () => {
    try {
      console.log('📚 [PLAYER CHAT] Loading chat history for player:', playerId);

      const response = await apiRequest(
        'GET',
        `/api/player-chat/history?limit=50`
      );
      const data = await response.json();

      let loaded: ChatMessage[] =
        Array.isArray(data?.messages) && data.messages.length > 0
          ? data.messages.map((msg: any) => ({
              id: msg.id?.toString?.() ?? `msg-${msg.timestamp || Date.now()}`,
              message: msg.message || msg.message_text || '',
              sender: (msg.sender as 'player' | 'staff') || 'staff',
              sender_name: msg.sender_name || msg.sender || 'Staff',
              timestamp: msg.timestamp || new Date().toISOString(),
              isFromStaff:
                msg.sender === 'staff' ||
                msg.senderType === 'staff' ||
                msg.sender_name === 'Staff',
            }))
          : [];

      // Merge with any locally stored messages so the player can
      // still see their own recent messages even if the backend
      // doesn't yet return history (e.g. Supabase-only environments).
      try {
        let raw =
          localStorage.getItem(storageKey) ||
          localStorage.getItem("player_chat_NaN"); // migrate legacy key
        if (raw) {
          const localMessages: ChatMessage[] = JSON.parse(raw);
          if (Array.isArray(localMessages) && localMessages.length > 0) {
            const byId = new Map<string, ChatMessage>();
            [...loaded, ...localMessages].forEach((m) => {
              byId.set(m.id, m);
            });
            loaded = Array.from(byId.values());
          }
        }
      } catch (e) {
        console.warn("Unable to read cached chat messages", e);
      }

      // Sort by time
      loaded.sort(
        (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
      );

      setMessages(loaded);
      console.log('✅ [PLAYER CHAT] Loaded', loaded.length, 'messages from history');

      const last = loaded[loaded.length - 1];
      if (!last) {
        setSessionStatus('none');
      } else if (last.isFromStaff) {
        setSessionStatus('active');
      } else {
        setSessionStatus('pending');
      }
    } catch (error) {
      console.error('❌ [PLAYER CHAT] Failed to load messages:', error);
      setMessages([]);
      setSessionStatus('none');
    }
  };

  useEffect(() => {
    if (!playerId || !playerName) return;

    console.log('🚀 [PLAYER CHAT] Initializing for player:', playerId, playerName);

    // Determine clubId from storage (matches headers used for API calls)
    const storedClubId =
      (typeof window !== "undefined" &&
        (localStorage.getItem(STORAGE_KEYS.CLUB_ID) ||
          sessionStorage.getItem(STORAGE_KEYS.CLUB_ID))) ||
      null;

    if (!storedClubId) {
      console.warn(
        "⚠️ [PLAYER CHAT] No clubId found in storage – falling back to HTTP-only mode",
      );
      loadChatHistory().then(() => {
        setIsConnected(false);
      });
      return;
    }

    // Derive WebSocket base URL from API_BASE_URL (same backend as staff portal)
    const websocketBase =
      import.meta.env.VITE_WEBSOCKET_URL ||
      (API_BASE_URL.endsWith("/api")
        ? API_BASE_URL.slice(0, -4)
        : API_BASE_URL.replace(/\/$/, ""));

    console.log(
      "🔌 [PLAYER CHAT] Connecting to WebSocket:",
      `${websocketBase}/realtime`,
      "playerId:",
      playerId,
      "clubId:",
      storedClubId,
    );

    const socket = io(`${websocketBase}/realtime`, {
      auth: { clubId: storedClubId, playerId },
      transports: ["websocket", "polling"],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 5,
    });

    socketRef.current = socket;

    socket.on("connect", () => {
      console.log("✅ [PLAYER CHAT] Connected to WebSocket");
      setIsConnected(true);
      // Subscribe exactly like staff-side chat, but for this player
      socket.emit("subscribe:club", { clubId: storedClubId, playerId });
      socket.emit("subscribe:player", { playerId, clubId: storedClubId });
    });

    socket.on("disconnect", (reason) => {
      console.warn("⚠️ [PLAYER CHAT] WebSocket disconnected:", reason);
      setIsConnected(false);
    });

    socket.on("error", (error) => {
      console.error("❌ [PLAYER CHAT] WebSocket error:", error);
    });

    // Real-time message updates from unified chat system (staff → player)
    socket.on("chat:new-message", (data: any) => {
      try {
        if (!data || data.playerId !== playerId || !data.message) {
          return;
        }

        const msg = data.message;
        const isFromStaff = msg.senderType === "staff";

        // Only show staff messages coming from backend (avoid echoing player messages)
        if (!isFromStaff) {
          return;
        }

        const messageData: ChatMessage = {
          id: msg.id?.toString?.() ?? `msg-${Date.now()}`,
          message: msg.message || "",
          sender: isFromStaff ? "staff" : "player",
          sender_name:
            msg.senderName ||
            msg.sender_name ||
            msg.staffName ||
            "Staff Member",
          timestamp: msg.createdAt || new Date().toISOString(),
          isFromStaff,
        };

        if (!messageData.message) return;

        setMessages((prev) => {
          const isDuplicate = prev.some(
            (m) =>
              m.id === messageData.id ||
              (m.message === messageData.message &&
                Math.abs(
                  new Date(m.timestamp).getTime() -
                    new Date(messageData.timestamp).getTime(),
                ) < 5000),
          );

          if (isDuplicate) {
            console.log(
              "⚠️ [PLAYER CHAT] Duplicate staff message detected, ignoring",
            );
            return prev;
          }

          const next = [...prev, messageData].sort(
            (a, b) =>
              new Date(a.timestamp).getTime() -
              new Date(b.timestamp).getTime(),
          );

          // Persist locally so chat history survives reloads
          try {
            localStorage.setItem(storageKey, JSON.stringify(next));
          } catch (e) {
            console.warn("Unable to persist chat messages", e);
          }

          return next;
        });

        if (!isInDialog) {
          setHasUnread(true);
        }

        setSessionStatus("active");
      } catch (e) {
        console.error("❌ [PLAYER CHAT] Error handling chat:new-message:", e);
      }
    });

    // Session status updates from backend (OPEN / IN_PROGRESS / RESOLVED / CLOSED)
    socket.on("chat:session-updated", (data: any) => {
      if (!data || data.playerId !== playerId) return;
      const rawStatus = (data.session?.status || "").toString().toLowerCase();

      if (rawStatus === "closed") {
        setSessionStatus("none");
      } else if (rawStatus === "resolved") {
        setSessionStatus("recent");
      } else if (rawStatus === "open" || rawStatus === "in_progress") {
        setSessionStatus("active");
      }
    });

    // Initial history load
    loadChatHistory();

    return () => {
      try {
        socket.emit("unsubscribe:player", { playerId });
      } catch (e) {
        // ignore
      }
      socket.disconnect();
    };
  }, [playerId, playerName, storageKey, isInDialog]);

  // Load messages whenever dialog opens (if in dialog mode)
  useEffect(() => {
    if (isInDialog && playerId) {
      loadChatHistory();
    }
  }, [isInDialog, playerId]);

  const sendMessage = async () => {
    if (!newMessage.trim()) return;

    const messageText = newMessage.trim();
    const messageId = `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const timestamp = new Date().toISOString();

    // Optimistic UI update
    const optimisticMsg: ChatMessage = {
      id: messageId,
      message: messageText,
      sender: 'player',
      sender_name: playerName,
      timestamp,
      isFromStaff: false,
    };

    setMessages((prev) => {
      const next = [...prev, optimisticMsg];
      try {
        localStorage.setItem(storageKey, JSON.stringify(next));
      } catch (e) {
        console.warn('Unable to persist chat messages', e);
      }
      return next;
    });
    setNewMessage('');
    setSessionStatus('pending');

    try {
      console.log('⚡ [OPTIMIZED V1.2] Sending message to staff portal via /api/player-chat/send:', messageText);

      const response = await apiRequest('POST', '/api/player-chat/send', {
          message: messageText,
        playerName,
      });
      const result = await response.json().catch(() => null);

      if (!response.ok) {
        console.error('❌ [OPTIMIZED V1.2] Server error (non-critical):', result || response.statusText);
        setSessionStatus('none');
        return;
      }

      console.log('✅ [OPTIMIZED V1.2] Message accepted by backend:', result);
      // Mark session as active once backend accepts the message
      setSessionStatus('active');
    } catch (error) {
      console.error('❌ [OPTIMIZED V1.2] Send error:', error);
      setSessionStatus('none');
    }
  };

  const toggleChat = () => {
    setIsOpen(!isOpen);
    if (!isOpen) {
      setHasUnread(false);
    }
  };

  const closeChat = () => {
    setIsOpen(false);
  };

  // Status color mapping
  const getStatusColor = () => {
    switch (sessionStatus) {
      case 'pending': return 'text-yellow-500';
      case 'active': return 'text-green-500'; 
      case 'recent': return 'text-blue-500';
      default: return 'text-gray-500';
    }
  };

  // If in dialog mode, render chat content directly without the blue bubble
  if (isInDialog) {
    return (
      <div className="flex flex-col h-[600px] max-h-[80vh]">
        {/* Status Bar */}
        <div className={`px-3 py-2 text-sm ${getStatusColor()} bg-slate-900 border-b border-slate-600 flex items-center justify-between`}>
          <span>
            Status:{" "}
            {sessionStatus === "none"
              ? "Ready to chat"
              : sessionStatus.charAt(0).toUpperCase() + sessionStatus.slice(1)}
          </span>
          <div className={`w-3 h-3 rounded-full ${
            sessionStatus === 'pending' ? 'bg-yellow-500' :
            sessionStatus === 'active' ? 'bg-green-500' :
            sessionStatus === 'recent' ? 'bg-blue-500' :
            'bg-gray-500'
          }`} />
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 bg-slate-750 min-h-0">
          {messages.length === 0 ? (
            <div className="text-center text-slate-400 py-12">
              <MessageCircle size={48} className="mx-auto mb-4 opacity-50" />
              <p className="text-lg mb-2">No messages yet</p>
              <p className="text-sm opacity-75">Start a conversation with our Guest Relations team</p>
            </div>
          ) : (
            messages.map((msg, index) => (
              <div
                key={`${msg.id}-${index}`}
                className={`flex ${msg.isFromStaff ? 'justify-start' : 'justify-end'}`}
              >
                <div className={`max-w-[75%] p-3 rounded-lg ${
                  msg.isFromStaff
                    ? 'bg-gray-600 text-white'
                    : 'bg-blue-600 text-white'
                }`}>
                  <div className="text-xs opacity-75 mb-1 font-medium">
                    {msg.sender_name}
                  </div>
                  <div className="text-sm leading-relaxed">{msg.message}</div>
                  <div className="text-xs opacity-75 mt-2">
                    {new Date(msg.timestamp).toLocaleTimeString()}
                  </div>
                </div>
              </div>
            ))
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="p-4 sm:p-6 border-t border-slate-600 bg-slate-800 flex-shrink-0">
          <div className="flex gap-3 items-end">
            <input
              type="text"
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
              placeholder={isConnected ? "Type your message..." : "Type your message..."}
              disabled={false}
              className="flex-1 px-4 py-3 border border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-slate-700 text-white placeholder-slate-400 disabled:opacity-50 min-h-[44px]"
            />
            <button
              onClick={sendMessage}
              disabled={!newMessage.trim()}
              className="bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed text-white px-4 py-3 rounded-lg transition-colors font-medium min-h-[44px] min-w-[44px] flex items-center justify-center flex-shrink-0"
            >
              <Send size={18} />
            </button>
          </div>
          <div className="mt-3 text-xs text-slate-400">
            {sessionStatus === "active"
              ? "Connected to Guest Relations"
              : "Chat ready"}
          </div>
        </div>
      </div>
    );
  }

  // Original blue bubble functionality is removed - only dialog mode is supported
  return null;
};

export default PlayerChatSystem;