import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { MessageCircle, X, Send, Clock, ChevronLeft, ChevronRight } from 'lucide-react';
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

interface ChatSession {
  id: string;
  subject: string | null;
  status: string;
  messageCount: number;
  lastMessage: string | null;
  lastMessageSender: string;
  assignedStaffName: string | null;
  createdAt: string;
  lastMessageAt: string;
  closedAt: string | null;
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

  // Chat history state
  const [chatTab, setChatTab] = useState<'active' | 'history'>('active');
  const [pastSessions, setPastSessions] = useState<ChatSession[]>([]);
  const [pastSessionsPage, setPastSessionsPage] = useState(1);
  const [pastSessionsTotalPages, setPastSessionsTotalPages] = useState(1);
  const [pastSessionsLoading, setPastSessionsLoading] = useState(false);
  const [viewingSession, setViewingSession] = useState<ChatSession | null>(null);
  const [viewingMessages, setViewingMessages] = useState<ChatMessage[]>([]);
  const [viewingMessagesLoading, setViewingMessagesLoading] = useState(false);
  const [viewingMessagesPage, setViewingMessagesPage] = useState(1);
  const [viewingMessagesTotalPages, setViewingMessagesTotalPages] = useState(1);

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
  const loadChatHistory = useCallback(async () => {
    try {
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

      // Merge with any locally stored messages
      try {
        let raw =
          localStorage.getItem(storageKey) ||
          localStorage.getItem("player_chat_NaN");
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
        // ignore
      }

      loaded.sort(
        (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
      );

      setMessages(loaded);

      const last = loaded[loaded.length - 1];
      if (!last) {
        setSessionStatus('none');
      } else if (last.isFromStaff) {
        setSessionStatus('active');
      } else {
        setSessionStatus('pending');
      }
    } catch (error) {
      console.error('[PLAYER CHAT] Failed to load messages:', error);
      setMessages([]);
      setSessionStatus('none');
    }
  }, [storageKey]);

  // Load past chat sessions (history tab)
  const loadPastSessions = useCallback(async (page: number = 1) => {
    if (!playerId) return;
    setPastSessionsLoading(true);
    try {
      const response = await apiRequest(
        'GET',
        `/api/player-chat/sessions?page=${page}&limit=10`
      );
      const data = await response.json();
      setPastSessions(data.sessions || []);
      setPastSessionsTotalPages(data.totalPages || 1);
      setPastSessionsPage(data.page || 1);
    } catch (error) {
      console.error('[PLAYER CHAT] Failed to load past sessions:', error);
      setPastSessions([]);
    } finally {
      setPastSessionsLoading(false);
    }
  }, [playerId]);

  // Load messages for a specific past session
  const loadSessionMessages = useCallback(async (sessionId: string, page: number = 1) => {
    setViewingMessagesLoading(true);
    try {
      const response = await apiRequest(
        'GET',
        `/api/player-chat/sessions/${sessionId}/messages?page=${page}&limit=50`
      );
      const data = await response.json();
      const loaded: ChatMessage[] = (data.messages || []).map((msg: any) => ({
        id: msg.id,
        message: msg.message,
        sender: msg.sender,
        sender_name: msg.sender_name,
        timestamp: msg.timestamp,
        isFromStaff: msg.isFromStaff,
      }));
      setViewingMessages(loaded);
      setViewingMessagesPage(data.page || 1);
      setViewingMessagesTotalPages(data.totalPages || 1);
    } catch (error) {
      console.error('[PLAYER CHAT] Failed to load session messages:', error);
      setViewingMessages([]);
    } finally {
      setViewingMessagesLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!playerId || !playerName) return;

    const storedClubId =
      (typeof window !== "undefined" &&
        (localStorage.getItem(STORAGE_KEYS.CLUB_ID) ||
          sessionStorage.getItem(STORAGE_KEYS.CLUB_ID))) ||
      null;

    if (!storedClubId) {
      loadChatHistory().then(() => {
        setIsConnected(false);
      });
      return;
    }

    const websocketBase =
      import.meta.env.VITE_WEBSOCKET_URL ||
      (API_BASE_URL.endsWith("/api")
        ? API_BASE_URL.slice(0, -4)
        : API_BASE_URL.replace(/\/$/, ""));

    const socket = io(`${websocketBase}/realtime`, {
      auth: { clubId: storedClubId, playerId },
      transports: ["websocket", "polling"],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 10000,
      reconnectionAttempts: Infinity,
    });

    socketRef.current = socket;

    socket.on("connect", () => {
      setIsConnected(true);
      socket.emit("subscribe:club", { clubId: storedClubId, playerId });
      socket.emit("subscribe:player", { playerId, clubId: storedClubId });
    });

    socket.on("disconnect", () => {
      setIsConnected(false);
    });

    socket.on("chat:new-message", (data: any) => {
      try {
        if (!data || data.playerId !== playerId || !data.message) return;

        const msg = data.message;
        const isFromStaff = msg.senderType === "staff";
        if (!isFromStaff) return;

        const messageData: ChatMessage = {
          id: msg.id?.toString?.() ?? `msg-${Date.now()}`,
          message: msg.message || "",
          sender: "staff",
          sender_name: msg.senderName || msg.sender_name || msg.staffName || "Staff Member",
          timestamp: msg.createdAt || new Date().toISOString(),
          isFromStaff: true,
        };

        if (!messageData.message) return;

        setMessages((prev) => {
          const isDuplicate = prev.some(
            (m) =>
              m.id === messageData.id ||
              (m.message === messageData.message &&
                Math.abs(new Date(m.timestamp).getTime() - new Date(messageData.timestamp).getTime()) < 5000),
          );
          if (isDuplicate) return prev;

          const next = [...prev, messageData].sort(
            (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
          );

          try {
            localStorage.setItem(storageKey, JSON.stringify(next));
          } catch (e) {
            // ignore
          }

          return next;
        });

        if (!isInDialog) {
          setHasUnread(true);
        }
        setSessionStatus("active");
      } catch (e) {
        console.error("[PLAYER CHAT] Error handling chat:new-message:", e);
      }
    });

    socket.on("chat:session-updated", (data: any) => {
      if (!data || data.playerId !== playerId) return;
      const rawStatus = (data.session?.status || "").toString().toLowerCase();
      if (rawStatus === "closed") setSessionStatus("none");
      else if (rawStatus === "resolved") setSessionStatus("recent");
      else if (rawStatus === "open" || rawStatus === "in_progress") setSessionStatus("active");
    });

    loadChatHistory();

    return () => {
      try { socket.emit("unsubscribe:player", { playerId }); } catch (e) { /* ignore */ }
      socket.disconnect();
    };
  }, [playerId, playerName, storageKey, isInDialog, loadChatHistory]);

  // Load messages whenever dialog opens
  useEffect(() => {
    if (isInDialog && playerId) {
      loadChatHistory();
    }
  }, [isInDialog, playerId, loadChatHistory]);

  // Polling fallback: fetch new messages every 5 seconds
  useEffect(() => {
    if (!playerId) return;
    const pollInterval = setInterval(() => {
      if (chatTab === 'active') {
        loadChatHistory();
      }
    }, 5000);
    return () => clearInterval(pollInterval);
  }, [playerId, storageKey, chatTab, loadChatHistory]);

  // Load past sessions when switching to history tab
  useEffect(() => {
    if (chatTab === 'history') {
      loadPastSessions(1);
    }
  }, [chatTab, loadPastSessions]);

  const sendMessage = async () => {
    if (!newMessage.trim()) return;

    const messageText = newMessage.trim();
    const messageId = `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const timestamp = new Date().toISOString();

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
      try { localStorage.setItem(storageKey, JSON.stringify(next)); } catch (e) { /* ignore */ }
      return next;
    });
    setNewMessage('');
    setSessionStatus('pending');

    try {
      const response = await apiRequest('POST', '/api/player-chat/send', {
        message: messageText,
        playerName,
      });
      const result = await response.json().catch(() => null);
      if (!response.ok) {
        setSessionStatus('none');
        return;
      }
      setSessionStatus('active');
    } catch (error) {
      console.error('[PLAYER CHAT] Send error:', error);
      setSessionStatus('none');
    }
  };

  const getStatusColor = () => {
    switch (sessionStatus) {
      case 'pending': return 'text-yellow-500';
      case 'active': return 'text-green-500';
      case 'recent': return 'text-blue-500';
      default: return 'text-gray-500';
    }
  };

  const getStatusBadge = (status: string) => {
    const map: Record<string, { bg: string; text: string; label: string }> = {
      open: { bg: 'bg-blue-500/20', text: 'text-blue-400', label: 'Open' },
      in_progress: { bg: 'bg-yellow-500/20', text: 'text-yellow-400', label: 'In Progress' },
      resolved: { bg: 'bg-green-500/20', text: 'text-green-400', label: 'Resolved' },
      closed: { bg: 'bg-gray-500/20', text: 'text-gray-400', label: 'Closed' },
    };
    const s = map[status] || map['closed'];
    return (
      <span className={`text-xs px-2 py-0.5 rounded ${s.bg} ${s.text}`}>
        {s.label}
      </span>
    );
  };

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) +
      ' ' + d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
  };

  if (isInDialog) {
    return (
      <div className="flex flex-col h-[600px] max-h-[80vh]">
        {/* Tab Bar */}
        <div className="flex bg-slate-900 border-b border-slate-600">
          <button
            onClick={() => { setChatTab('active'); setViewingSession(null); }}
            className={`flex-1 px-4 py-2.5 text-sm font-medium transition-colors ${
              chatTab === 'active'
                ? 'text-emerald-400 border-b-2 border-emerald-400 bg-slate-800'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <div className="flex items-center justify-center gap-2">
              <MessageCircle size={14} />
              Active Chat
            </div>
          </button>
          <button
            onClick={() => setChatTab('history')}
            className={`flex-1 px-4 py-2.5 text-sm font-medium transition-colors ${
              chatTab === 'history'
                ? 'text-emerald-400 border-b-2 border-emerald-400 bg-slate-800'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <div className="flex items-center justify-center gap-2">
              <Clock size={14} />
              Chat History
            </div>
          </button>
        </div>

        {/* Active Chat Tab */}
        {chatTab === 'active' && (
          <>
            {/* Status Bar */}
            <div className={`px-3 py-2 text-sm ${getStatusColor()} bg-slate-900 border-b border-slate-700 flex items-center justify-between`}>
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
                  placeholder="Type your message..."
                  className="flex-1 px-4 py-3 border border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-slate-700 text-white placeholder-slate-400 min-h-[44px]"
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
          </>
        )}

        {/* Chat History Tab */}
        {chatTab === 'history' && !viewingSession && (
          <div className="flex-1 overflow-y-auto min-h-0">
            {pastSessionsLoading ? (
              <div className="text-center text-slate-400 py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500 mx-auto mb-4"></div>
                <p className="text-sm">Loading chat history...</p>
              </div>
            ) : pastSessions.length === 0 ? (
              <div className="text-center text-slate-400 py-12">
                <Clock size={48} className="mx-auto mb-4 opacity-50" />
                <p className="text-lg mb-2">No chat history</p>
                <p className="text-sm opacity-75">Your past conversations will appear here</p>
              </div>
            ) : (
              <>
                <div className="divide-y divide-slate-700">
                  {pastSessions.map((session) => (
                    <button
                      key={session.id}
                      onClick={() => {
                        setViewingSession(session);
                        setViewingMessagesPage(1);
                        loadSessionMessages(session.id, 1);
                      }}
                      className="w-full text-left px-4 py-3 hover:bg-slate-700/50 transition-colors"
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-white text-sm font-medium truncate flex-1 mr-2">
                          {session.subject || 'Support Chat'}
                        </span>
                        {getStatusBadge(session.status)}
                      </div>
                      {session.lastMessage && (
                        <p className="text-slate-400 text-xs truncate mb-1">
                          {session.lastMessageSender === 'staff' ? 'Staff: ' : 'You: '}
                          {session.lastMessage}
                        </p>
                      )}
                      <div className="flex items-center justify-between text-[11px] text-slate-500">
                        <span>{session.messageCount} message{session.messageCount !== 1 ? 's' : ''}</span>
                        <span>{formatDate(session.lastMessageAt)}</span>
                      </div>
                      {session.assignedStaffName && (
                        <div className="text-[11px] text-slate-500 mt-0.5">
                          Handled by: {session.assignedStaffName}
                        </div>
                      )}
                    </button>
                  ))}
                </div>

                {/* Pagination */}
                {pastSessionsTotalPages > 1 && (
                  <div className="flex items-center justify-center gap-3 py-3 border-t border-slate-700">
                    <button
                      onClick={() => loadPastSessions(pastSessionsPage - 1)}
                      disabled={pastSessionsPage <= 1}
                      className="p-1.5 rounded bg-slate-700 text-white disabled:opacity-30 hover:bg-slate-600 transition-colors"
                    >
                      <ChevronLeft size={16} />
                    </button>
                    <span className="text-xs text-slate-400">
                      Page {pastSessionsPage} of {pastSessionsTotalPages}
                    </span>
                    <button
                      onClick={() => loadPastSessions(pastSessionsPage + 1)}
                      disabled={pastSessionsPage >= pastSessionsTotalPages}
                      className="p-1.5 rounded bg-slate-700 text-white disabled:opacity-30 hover:bg-slate-600 transition-colors"
                    >
                      <ChevronRight size={16} />
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* Viewing a Past Session's Messages */}
        {chatTab === 'history' && viewingSession && (
          <div className="flex-1 flex flex-col min-h-0">
            {/* Session Header */}
            <div className="px-4 py-2.5 bg-slate-800 border-b border-slate-700 flex items-center gap-3">
              <button
                onClick={() => { setViewingSession(null); setViewingMessages([]); }}
                className="text-slate-400 hover:text-white transition-colors"
              >
                <ChevronLeft size={20} />
              </button>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-white text-sm font-medium truncate">
                    {viewingSession.subject || 'Support Chat'}
                  </span>
                  {getStatusBadge(viewingSession.status)}
                </div>
                <div className="text-[11px] text-slate-500">
                  {formatDate(viewingSession.createdAt)}
                  {viewingSession.closedAt && ` — Closed ${formatDate(viewingSession.closedAt)}`}
                </div>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 min-h-0">
              {viewingMessagesLoading ? (
                <div className="text-center text-slate-400 py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500 mx-auto mb-4"></div>
                  <p className="text-sm">Loading messages...</p>
                </div>
              ) : viewingMessages.length === 0 ? (
                <div className="text-center text-slate-400 py-8">
                  <p className="text-sm">No messages in this conversation</p>
                </div>
              ) : (
                viewingMessages.map((msg, index) => (
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
                        {formatDate(msg.timestamp)}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Message Pagination */}
            {viewingMessagesTotalPages > 1 && (
              <div className="flex items-center justify-center gap-3 py-2 border-t border-slate-700 bg-slate-800">
                <button
                  onClick={() => loadSessionMessages(viewingSession.id, viewingMessagesPage - 1)}
                  disabled={viewingMessagesPage <= 1}
                  className="p-1.5 rounded bg-slate-700 text-white disabled:opacity-30 hover:bg-slate-600 transition-colors"
                >
                  <ChevronLeft size={16} />
                </button>
                <span className="text-xs text-slate-400">
                  Page {viewingMessagesPage} of {viewingMessagesTotalPages}
                </span>
                <button
                  onClick={() => loadSessionMessages(viewingSession.id, viewingMessagesPage + 1)}
                  disabled={viewingMessagesPage >= viewingMessagesTotalPages}
                  className="p-1.5 rounded bg-slate-700 text-white disabled:opacity-30 hover:bg-slate-600 transition-colors"
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  return null;
};

export default PlayerChatSystem;