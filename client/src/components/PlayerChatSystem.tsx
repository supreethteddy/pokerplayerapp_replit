import React, { useState, useEffect, useRef, useCallback } from 'react';
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
  /** When set (from API/socket), avoids ambiguous parsing of `timestamp`. */
  createdAtUtcMs?: number;
  isFromStaff: boolean;
}

interface ChatSession {
  id: string;
  subject: string | null;
  status: string;
  messageCount: number;
  lastMessage: string | null;
  lastMessageSender: string;
  assignedStaffName?: string | null;
  createdAt: string;
  lastMessageAt: string;
  closedAt: string | null;
}

/** India Standard Time — fixed +5:30 from UTC (no DST). Same math as staff portal. */
const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

function naiveUtcComponentsToMs(s: string): number | null {
  const t = String(s).trim();
  if (/[zZ]/.test(t) || /[+-]\d{2}:?\d{2}$/.test(t)) return null;
  const re = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2}):(\d{2})(\.\d+)?/;
  const m = t.match(re);
  if (!m) return null;
  const frac = m[7] ? parseFloat(m[7]) : 0;
  const msInSecond = Math.min(999, Math.round(frac * 1000));
  return Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6], msInSecond);
}

function parseChatInstantMs(value: string | Date | number | null | undefined): number {
  if (value == null || value === '') return Date.now();
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value < 1e12 ? value * 1000 : value;
  }
  if (value instanceof Date) {
    const t = value.getTime();
    return Number.isNaN(t) ? Date.now() : t;
  }
  let s = String(value).trim();
  const manual = naiveUtcComponentsToMs(s);
  if (manual != null) return manual;
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?$/.test(s) && !/[zZ+]/.test(s) && !/-\d{2}:\d{2}$/.test(s)) {
    s = `${s}Z`;
  } else if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}(\.\d+)?$/.test(s)) {
    s = `${s.replace(' ', 'T')}Z`;
  }
  const ms = Date.parse(s);
  return Number.isNaN(ms) ? Date.now() : ms;
}

function rowUtcMs(m: Pick<ChatMessage, 'timestamp' | 'createdAtUtcMs'>): number {
  if (typeof m.createdAtUtcMs === 'number' && Number.isFinite(m.createdAtUtcMs)) {
    return m.createdAtUtcMs;
  }
  return parseChatInstantMs(m.timestamp);
}

function toUtcMs(value: string | Date | number | null | undefined): number {
  return parseChatInstantMs(value);
}

function istCalendarKey(ms: number): string {
  const d = new Date(ms + IST_OFFSET_MS);
  const y = d.getUTCFullYear();
  const mo = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${mo}-${day}`;
}

function istCalendarDiffDays(msMsg: number, msNow: number): number {
  const km = istCalendarKey(msMsg);
  const kn = istCalendarKey(msNow);
  if (km === kn) return 0;
  const [ym, mm, dm] = km.split('-').map(Number);
  const [yn, mn, dn] = kn.split('-').map(Number);
  const tm = Date.UTC(ym, mm - 1, dm);
  const tn = Date.UTC(yn, mn - 1, dn);
  return Math.round((tn - tm) / 86400000);
}

function formatIstHm(ms: number): string {
  const d = new Date(ms + IST_OFFSET_MS);
  const h = String(d.getUTCHours()).padStart(2, '0');
  const m = String(d.getUTCMinutes()).padStart(2, '0');
  return `${h}:${m}`;
}

function formatIstDateLong(ms: number): string {
  const d = new Date(ms + IST_OFFSET_MS);
  const day = String(d.getUTCDate()).padStart(2, '0');
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const mon = months[d.getUTCMonth()];
  const y = d.getUTCFullYear();
  return `${day} ${mon} ${y}`;
}

function formatMessageTime(msgOrTs: ChatMessage | string | Date | number): string {
  const ms =
    msgOrTs && typeof msgOrTs === 'object' && 'timestamp' in msgOrTs
      ? rowUtcMs(msgOrTs as ChatMessage)
      : parseChatInstantMs(msgOrTs as string | Date | number);
  const now = Date.now();
  const diffDays = istCalendarDiffDays(ms, now);

  if (diffDays <= 0) {
    return formatIstHm(ms);
  }
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;
  return formatIstDateLong(ms);
}

function coerceTimestampIso(v: string | number | undefined | null): string {
  try {
    return new Date(parseChatInstantMs(v)).toISOString();
  } catch {
    return new Date().toISOString();
  }
}

/** Prefer server `createdAtUtcMs` so history matches socket payloads (IST display). */
function coerceTimestampFromApi(msg: any): string {
  if (msg && typeof msg.createdAtUtcMs === 'number' && Number.isFinite(msg.createdAtUtcMs)) {
    return new Date(msg.createdAtUtcMs).toISOString();
  }
  return coerceTimestampIso(msg?.timestamp ?? msg?.createdAt);
}

function mapHistoryMessage(msg: any): ChatMessage {
  const ts = coerceTimestampFromApi(msg);
  const isStaff =
    msg.sender === 'staff' ||
    msg.senderType === 'staff' ||
    msg.isFromStaff === true;
  const createdAtUtcMs =
    typeof msg.createdAtUtcMs === 'number' && Number.isFinite(msg.createdAtUtcMs)
      ? msg.createdAtUtcMs
      : parseChatInstantMs(ts);
  return {
    id: msg.id?.toString?.() ?? `msg-${ts}`,
    message: msg.message || msg.message_text || '',
    sender: (msg.sender as 'player' | 'staff') || 'staff',
    sender_name: isStaff
      ? (msg.sender_name || 'GRE team')
      : (msg.sender_name || msg.sender || 'You'),
    timestamp: ts,
    createdAtUtcMs,
    isFromStaff: isStaff,
  };
}

function dedupeMessagesById(list: ChatMessage[]): ChatMessage[] {
  const byId = new Map<string, ChatMessage>();
  for (const m of list) {
    byId.set(m.id, m);
  }
  return Array.from(byId.values());
}

/** Collapse optimistic + API/socket copies (same sender, text, ~same time). Prefer real UUID over msg-* temp id. */
function dedupeNearDuplicateChatRows(list: ChatMessage[]): ChatMessage[] {
  const sorted = [...list].sort((a, b) => rowUtcMs(a) - rowUtcMs(b));
  const out: ChatMessage[] = [];
  for (const m of sorted) {
    const t = rowUtcMs(m);
    const idx = out.findIndex(
      (o) =>
        o.isFromStaff === m.isFromStaff &&
        (o.message || '').trim() === (m.message || '').trim() &&
        Math.abs(rowUtcMs(o) - t) < 120000,
    );
    if (idx < 0) {
      out.push(m);
      continue;
    }
    const o = out[idx];
    const oTemp = String(o.id).startsWith('msg-');
    const mTemp = String(m.id).startsWith('msg-');
    out[idx] = oTemp && !mTemp ? m : mTemp && !oTemp ? o : t >= rowUtcMs(o) ? m : o;
  }
  return out;
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
  const activeMessagesScrollRef = useRef<HTMLDivElement>(null);
  const historyMessagesScrollRef = useRef<HTMLDivElement>(null);

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

  const scrollActiveToBottom = useCallback(() => {
    const el = activeMessagesScrollRef.current;
    if (el) {
      el.scrollTop = el.scrollHeight;
    }
  }, []);

  const scrollHistoryToBottom = useCallback(() => {
    const el = historyMessagesScrollRef.current;
    if (el) {
      el.scrollTop = el.scrollHeight;
    }
  }, []);

  useEffect(() => {
    if (chatTab !== 'active') return;
    scrollActiveToBottom();
    requestAnimationFrame(() => scrollActiveToBottom());
  }, [messages, chatTab, scrollActiveToBottom]);

  useEffect(() => {
    if (chatTab !== 'history' || !viewingSession) return;
    scrollHistoryToBottom();
    requestAnimationFrame(() => scrollHistoryToBottom());
  }, [viewingMessages, chatTab, viewingSession, scrollHistoryToBottom]);

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
          ? data.messages.map(mapHistoryMessage)
          : [];

      loaded = dedupeMessagesById(loaded);
      loaded = dedupeNearDuplicateChatRows(loaded);
      loaded.sort((a, b) => rowUtcMs(a) - rowUtcMs(b));

      setMessages(loaded);

      const apiSession = data?.session as { id?: string; status?: string } | null | undefined;
      const last = loaded[loaded.length - 1];
      const st = apiSession?.status?.toLowerCase();
      const anyStaffReply = loaded.some((m) => m.isFromStaff);

      if (st === 'closed') {
        setSessionStatus('none');
      } else if (st === 'resolved') {
        setSessionStatus('recent');
      } else if (st === 'in_progress') {
        setSessionStatus('active');
      } else if (st === 'open') {
        if (!last) setSessionStatus('none');
        else if (anyStaffReply) setSessionStatus('active');
        else setSessionStatus(!last.isFromStaff ? 'pending' : 'active');
      } else if (!last) {
        setSessionStatus('none');
      } else if (anyStaffReply || last.isFromStaff) {
        setSessionStatus('active');
      } else {
        setSessionStatus('pending');
      }
    } catch (error) {
      console.error('[PLAYER CHAT] Failed to load messages:', error);
      setMessages([]);
      setSessionStatus('none');
    }
  }, []);

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
      let loaded: ChatMessage[] = dedupeMessagesById(
        (data.messages || []).map(mapHistoryMessage),
      );
      loaded = dedupeNearDuplicateChatRows(loaded);
      loaded.sort((a, b) => rowUtcMs(a) - rowUtcMs(b));
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
      auth: {
        clubId: storedClubId,
        playerId,
        token: localStorage.getItem('auth_token') || localStorage.getItem('playerToken'),
      },
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

        const ts = coerceTimestampFromApi(msg);
        const createdAtUtcMs =
          typeof msg.createdAtUtcMs === 'number' && Number.isFinite(msg.createdAtUtcMs)
            ? msg.createdAtUtcMs
            : parseChatInstantMs(ts);
        const messageData: ChatMessage = {
          id: msg.id?.toString?.() ?? `msg-${Date.now()}`,
          message: msg.message || "",
          sender: "staff",
          sender_name: msg.senderName || msg.sender_name || "GRE team",
          timestamp: ts,
          createdAtUtcMs,
          isFromStaff: true,
        };

        if (!messageData.message) return;

        setMessages((prev) => {
          const tNew = rowUtcMs(messageData);
          const isDuplicate = prev.some((m) => {
            if (m.id === messageData.id) return true;
            if (
              m.isFromStaff &&
              m.message === messageData.message &&
              Math.abs(rowUtcMs(m) - tNew) < 120000
            ) {
              return true;
            }
            return false;
          });
          if (isDuplicate) return prev;

          const next = dedupeNearDuplicateChatRows(
            dedupeMessagesById([...prev, messageData]),
          ).sort((a, b) => rowUtcMs(a) - rowUtcMs(b));

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
      else if (rawStatus === "in_progress") setSessionStatus("active");
      else if (rawStatus === "open") {
        void loadChatHistory();
      }
    });

    loadChatHistory();

    return () => {
      try { socket.emit("unsubscribe:player", { playerId }); } catch (e) { /* ignore */ }
      socket.disconnect();
    };
  }, [playerId, playerName, isInDialog, loadChatHistory]);

  // Load messages whenever dialog opens
  useEffect(() => {
    if (isInDialog && playerId) {
      loadChatHistory();
    }
  }, [isInDialog, playerId, loadChatHistory]);

  // Polling removed — WebSocket chat:new-message drives live message delivery.

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
    const createdAtUtcMs = Date.parse(timestamp);

    const optimisticMsg: ChatMessage = {
      id: messageId,
      message: messageText,
      sender: 'player',
      sender_name: playerName,
      timestamp,
      createdAtUtcMs,
      isFromStaff: false,
    };

    setMessages((prev) => [...prev, optimisticMsg]);
    setNewMessage('');
    setSessionStatus('pending');

    try {
      const response = await apiRequest('POST', '/api/player-chat/send', {
        message: messageText,
        playerName,
      });
      const result = await response.json().catch(() => null);
      if (!response.ok) {
        setMessages((prev) => prev.filter((m) => m.id !== messageId));
        setSessionStatus('none');
        return;
      }
      await loadChatHistory();
    } catch (error) {
      console.error('[PLAYER CHAT] Send error:', error);
      setMessages((prev) => prev.filter((m) => m.id !== messageId));
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
    return d.toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'Asia/Kolkata' }) +
      ' ' + d.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'Asia/Kolkata' });
  };

  if (isInDialog) {
    return (
      <div className="flex flex-col flex-1 min-h-0 h-[min(560px,calc(85vh-7rem))] max-h-full">
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
                  : sessionStatus === "active"
                    ? "In Progress"
                    : sessionStatus === "pending"
                      ? "Pending"
                      : sessionStatus === "recent"
                        ? "Resolved"
                        : sessionStatus.charAt(0).toUpperCase() + sessionStatus.slice(1)}
              </span>
              <div className={`w-3 h-3 rounded-full ${
                sessionStatus === 'pending' ? 'bg-yellow-500' :
                sessionStatus === 'active' ? 'bg-green-500' :
                sessionStatus === 'recent' ? 'bg-blue-500' :
                'bg-gray-500'
              }`} />
            </div>

            {/* Messages — scroll only this pane (matches staff ChatWindow) */}
            <div
              ref={activeMessagesScrollRef}
              className="flex-1 overflow-y-auto overflow-x-hidden p-4 space-y-4 bg-slate-900 min-h-0 overscroll-contain"
              style={{
                scrollbarWidth: 'thin',
                scrollbarColor: '#64748b #0f172a',
              }}
            >
              {messages.length === 0 ? (
                <div className="text-center text-slate-400 py-12">
                  <MessageCircle size={48} className="mx-auto mb-4 opacity-50" />
                  <p className="text-lg mb-2">No messages yet</p>
                  <p className="text-sm opacity-75">Start a conversation with our Guest Relations team</p>
                </div>
              ) : (
                messages.map((msg) => (
                  <div key={msg.id} className="flex w-full min-w-0">
                    <div
                      className={`flex w-fit max-w-[85%] sm:max-w-sm min-w-0 shrink-0 flex-col gap-1 ${
                        msg.isFromStaff ? 'mr-auto items-start' : 'ml-auto items-end'
                      }`}
                    >
                      <span
                        className={`text-[11px] text-slate-400 font-medium px-0.5 tracking-wide uppercase max-w-full truncate ${
                          msg.isFromStaff ? 'text-left' : 'text-right'
                        }`}
                      >
                        {msg.sender_name}
                      </span>
                      <div
                        className={`min-w-0 rounded-xl border px-3 pt-2.5 pb-2.5 ${
                          msg.isFromStaff
                            ? 'bg-slate-700 text-slate-100 border-slate-600'
                            : 'bg-blue-600 text-white border-blue-500/50'
                        }`}
                      >
                        <div className="text-sm leading-relaxed whitespace-pre-wrap break-words">
                          {msg.message}
                        </div>
                        <div className="mt-2 text-[11px] opacity-80 tabular-nums leading-normal">
                          {formatMessageTime(msg)}
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              )}
              <div ref={messagesEndRef} className="h-px shrink-0" aria-hidden />
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
                {sessionStatus === "active" || sessionStatus === "pending"
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
            <div
              ref={historyMessagesScrollRef}
              className="flex-1 overflow-y-auto overflow-x-hidden p-4 space-y-4 min-h-0 bg-slate-900 overscroll-contain"
              style={{
                scrollbarWidth: 'thin',
                scrollbarColor: '#64748b #0f172a',
              }}
            >
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
                viewingMessages.map((msg) => (
                  <div key={msg.id} className="flex w-full min-w-0">
                    <div
                      className={`flex w-fit max-w-[85%] sm:max-w-sm min-w-0 shrink-0 flex-col gap-1 ${
                        msg.isFromStaff ? 'mr-auto items-start' : 'ml-auto items-end'
                      }`}
                    >
                      <span
                        className={`text-[11px] text-slate-400 font-medium px-0.5 tracking-wide uppercase max-w-full truncate ${
                          msg.isFromStaff ? 'text-left' : 'text-right'
                        }`}
                      >
                        {msg.sender_name}
                      </span>
                      <div
                        className={`min-w-0 rounded-xl border px-3 pt-2.5 pb-2.5 ${
                          msg.isFromStaff
                            ? 'bg-slate-700 text-slate-100 border-slate-600'
                            : 'bg-blue-600 text-white border-blue-500/50'
                        }`}
                      >
                        <div className="text-sm leading-relaxed whitespace-pre-wrap break-words">
                          {msg.message}
                        </div>
                        <div className="mt-2 text-[11px] opacity-80 tabular-nums leading-normal">
                          {formatMessageTime(msg)}
                        </div>
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