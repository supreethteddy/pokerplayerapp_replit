/**
 * API Configuration for Player Portal
 * Integrates with poker-crm-backend NestJS API
 */

// Backend API base URL - update based on environment
// For mobile builds, detect if running in Capacitor and use appropriate URL
function getApiBaseUrl(): string {
  // Check if VITE_API_BASE_URL is set (highest priority)
  if (import.meta.env.VITE_API_BASE_URL) {
    return import.meta.env.VITE_API_BASE_URL;
  }
  
  // Check if running in Capacitor (mobile app)
  const isCapacitor = typeof window !== 'undefined' && 
    (window as any).Capacitor !== undefined;
  
  if (isCapacitor) {
    // For mobile builds, use your production API URL
    // TODO: Replace with your actual production API URL
    return 'https://poker-crm-backend.onrender.com/api';
  }
  
  // For web development, default to localhost
  if (typeof window !== 'undefined' && window.location.hostname === 'localhost') {
    return 'http://localhost:3000/api';
  }
  
  // Fallback - use current origin
  return typeof window !== 'undefined' 
    ? `${window.location.origin}/api`
    : 'http://localhost:3000/api';
}

export const API_BASE_URL = getApiBaseUrl();

/**
 * API endpoints for player portal
 */
export const API_ENDPOINTS = {
  // Authentication endpoints
  auth: {
    playerLogin: '/auth/player/login',
    playerSignup: '/auth/player/signup',
    getProfile: '/auth/player/me',
    updateProfile: '/auth/player/profile',
    changePassword: '/auth/player/change-password',
    getBalance: '/auth/player/balance',
    getTransactions: '/auth/player/transactions',
    getStats: '/auth/player/stats',
  },
  
  // Waitlist endpoints
  waitlist: {
    join: '/auth/player/waitlist',
    getStatus: '/auth/player/waitlist',
    cancel: (entryId: string) => `/auth/player/waitlist/${entryId}`,
  },
  
  // Table endpoints
  tables: {
    getAvailable: '/auth/player/tables',
    getDetails: (tableId: string) => `/auth/player/tables/${tableId}`,
  },
  
  // Credit request endpoints
  credit: {
    request: '/auth/player/credit-request',
  },
  
  // Club endpoints (for FNB and other operations)
  clubs: {
    getFNBMenu: (clubId: string) => `/clubs/${clubId}/fnb/menu`,
    createFNBOrder: (clubId: string) => `/clubs/${clubId}/fnb/orders`,
    getFNBOrders: (clubId: string) => `/clubs/${clubId}/fnb/orders`,
    updateFNBOrder: (clubId: string, orderId: string) => `/clubs/${clubId}/fnb/orders/${orderId}`,
  },
} as const;

/**
 * Get authentication headers for API requests
 */
export function getAuthHeaders(playerId?: string, clubId?: string): HeadersInit {
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
  };
  
  if (playerId) {
    headers['x-player-id'] = playerId;
  }
  
  if (clubId) {
    headers['x-club-id'] = clubId;
  }
  
  return headers;
}

/**
 * Storage keys for player session
 */
export const STORAGE_KEYS = {
  PLAYER_ID: 'playerId',
  CLUB_ID: 'clubId',
  CLUB_CODE: 'clubCode',
  PLAYER_TOKEN: 'playerToken',
  PLAYER_DATA: 'playerData',
} as const;





