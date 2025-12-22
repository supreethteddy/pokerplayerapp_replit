/**
 * Base API service with error handling and common utilities
 */

import { API_BASE_URL, getAuthHeaders, STORAGE_KEYS } from './config';

/**
 * API Error class for structured error handling
 */
export class APIError extends Error {
  constructor(
    message: string,
    public statusCode?: number,
    public response?: any
  ) {
    super(message);
    this.name = 'APIError';
  }
}

/**
 * Base API service class
 */
export class BaseAPIService {
  protected baseUrl: string;

  constructor(baseUrl: string = API_BASE_URL) {
    this.baseUrl = baseUrl;
  }

  /**
   * Get stored player session data
   */
  protected getPlayerSession() {
    const playerId = localStorage.getItem(STORAGE_KEYS.PLAYER_ID) || sessionStorage.getItem(STORAGE_KEYS.PLAYER_ID);
    let clubId = localStorage.getItem(STORAGE_KEYS.CLUB_ID) || sessionStorage.getItem(STORAGE_KEYS.CLUB_ID);
    
    // If clubId is not available, try to get it from stored player data
    if (!clubId) {
      const playerDataStr = localStorage.getItem(STORAGE_KEYS.PLAYER_DATA) || sessionStorage.getItem(STORAGE_KEYS.PLAYER_DATA);
      if (playerDataStr) {
        try {
          const playerData = JSON.parse(playerDataStr);
          if (playerData.clubId) {
            clubId = playerData.clubId;
            // Store it for future use
            localStorage.setItem(STORAGE_KEYS.CLUB_ID, clubId);
          }
        } catch (e) {
          // Ignore parse errors
        }
      }
    }
    
    return {
      playerId,
      clubId,
      clubCode: localStorage.getItem(STORAGE_KEYS.CLUB_CODE) || sessionStorage.getItem(STORAGE_KEYS.CLUB_CODE),
    };
  }

  /**
   * Make authenticated API request
   */
  protected async request<T>(
    endpoint: string,
    options: RequestInit = {},
    requiresAuth: boolean = true
  ): Promise<T> {
    const { playerId, clubId } = requiresAuth ? this.getPlayerSession() : { playerId: null, clubId: null };
    
    const headers = requiresAuth 
      ? getAuthHeaders(playerId || undefined, clubId || undefined)
      : { 'Content-Type': 'application/json' };

    const config: RequestInit = {
      ...options,
      headers: {
        ...headers,
        ...options.headers,
      },
    };

    try {
      const response = await fetch(`${this.baseUrl}${endpoint}`, config);
      
      // Handle non-JSON responses
      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        if (!response.ok) {
          throw new APIError(
            `Request failed with status ${response.status}`,
            response.status
          );
        }
        return {} as T;
      }

      const data = await response.json();

      if (!response.ok) {
        throw new APIError(
          data.message || `Request failed with status ${response.status}`,
          response.status,
          data
        );
      }

      return data;
    } catch (error) {
      if (error instanceof APIError) {
        throw error;
      }
      
      // Network or other errors
      throw new APIError(
        error instanceof Error ? error.message : 'An unexpected error occurred'
      );
    }
  }

  /**
   * GET request
   */
  protected async get<T>(endpoint: string, requiresAuth: boolean = true): Promise<T> {
    return this.request<T>(endpoint, { method: 'GET' }, requiresAuth);
  }

  /**
   * POST request
   */
  protected async post<T>(
    endpoint: string,
    body?: any,
    requiresAuth: boolean = true
  ): Promise<T> {
    return this.request<T>(
      endpoint,
      {
        method: 'POST',
        body: body ? JSON.stringify(body) : undefined,
      },
      requiresAuth
    );
  }

  /**
   * PUT request
   */
  protected async put<T>(
    endpoint: string,
    body?: any,
    requiresAuth: boolean = true
  ): Promise<T> {
    return this.request<T>(
      endpoint,
      {
        method: 'PUT',
        body: body ? JSON.stringify(body) : undefined,
      },
      requiresAuth
    );
  }

  /**
   * DELETE request
   */
  protected async delete<T>(endpoint: string, requiresAuth: boolean = true): Promise<T> {
    return this.request<T>(endpoint, { method: 'DELETE' }, requiresAuth);
  }
}




