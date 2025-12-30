/**
 * Player Authentication API Service
 * Handles all player authentication operations
 */

import { BaseAPIService } from './base';
import { API_ENDPOINTS, STORAGE_KEYS } from './config';

/**
 * Player login credentials
 */
export interface PlayerLoginDto {
  clubCode: string;
  email: string;
  password: string;
}

/**
 * Player signup data
 */
export interface PlayerSignupDto {
  clubCode: string;
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  phoneNumber?: string;
  nickname?: string;
  referralCode?: string;
}

/**
 * Player profile data
 */
export interface PlayerProfile {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phoneNumber?: string;
  nickname?: string;
  clubId: string;
  status: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Update player profile data
 */
export interface UpdatePlayerProfileDto {
  firstName?: string;
  lastName?: string;
  phoneNumber?: string;
  nickname?: string;
}

/**
 * Reset password data (first-time password reset)
 */
export interface ResetPlayerPasswordDto {
  email: string;
  currentPassword: string;  // Temporary/current password for verification
  newPassword: string;
  clubCode: string;
}

/**
 * Change password data (regular password change)
 */
export interface ChangePlayerPasswordDto {
  currentPassword: string;
  newPassword: string;
}

/**
 * Login/Signup response
 */
export interface AuthResponse {
  success: boolean;
  message: string;
  player?: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    clubId: string;
    clubCode: string;
  };
  token?: string;
}

/**
 * Player Authentication Service
 */
export class PlayerAuthService extends BaseAPIService {
  /**
   * Player login
   */
  async login(credentials: PlayerLoginDto): Promise<AuthResponse> {
    const response = await this.post<AuthResponse>(
      API_ENDPOINTS.auth.playerLogin,
      credentials,
      false // No auth required for login
    );

    // Store player session data
    if (response.success && response.player) {
      localStorage.setItem(STORAGE_KEYS.PLAYER_ID, response.player.id);
      localStorage.setItem(STORAGE_KEYS.CLUB_ID, response.player.clubId);
      localStorage.setItem(STORAGE_KEYS.CLUB_CODE, response.player.clubCode);
      if (response.token) {
        localStorage.setItem(STORAGE_KEYS.PLAYER_TOKEN, response.token);
      }
      localStorage.setItem(STORAGE_KEYS.PLAYER_DATA, JSON.stringify(response.player));
    }

    return response;
  }

  /**
   * Player signup
   */
  async signup(signupData: PlayerSignupDto): Promise<AuthResponse> {
    const response = await this.post<AuthResponse>(
      API_ENDPOINTS.auth.playerSignup,
      signupData,
      false // No auth required for signup
    );

    // Store player session data
    if (response.success && response.player) {
      localStorage.setItem(STORAGE_KEYS.PLAYER_ID, response.player.id);
      localStorage.setItem(STORAGE_KEYS.CLUB_ID, response.player.clubId);
      localStorage.setItem(STORAGE_KEYS.CLUB_CODE, response.player.clubCode);
      if (response.token) {
        localStorage.setItem(STORAGE_KEYS.PLAYER_TOKEN, response.token);
      }
      localStorage.setItem(STORAGE_KEYS.PLAYER_DATA, JSON.stringify(response.player));
    }

    return response;
  }

  /**
   * Get player profile
   */
  async getProfile(): Promise<PlayerProfile> {
    return this.get<PlayerProfile>(API_ENDPOINTS.auth.getProfile);
  }

  /**
   * Update player profile
   */
  async updateProfile(profileData: UpdatePlayerProfileDto): Promise<{ success: boolean; message: string; player: PlayerProfile }> {
    const response = await this.put<{ success: boolean; message: string; player: PlayerProfile }>(
      API_ENDPOINTS.auth.updateProfile,
      profileData
    );

    // Update stored player data
    if (response.success && response.player) {
      const storedData = localStorage.getItem(STORAGE_KEYS.PLAYER_DATA);
      if (storedData) {
        const playerData = JSON.parse(storedData);
        const updatedData = { ...playerData, ...response.player };
        localStorage.setItem(STORAGE_KEYS.PLAYER_DATA, JSON.stringify(updatedData));
      }
    }

    return response;
  }

  /**
   * Reset player password (first-time password reset)
   * Used when player has mustResetPassword flag set
   * No auth headers required - uses email + clubCode + currentPassword
   */
  async resetPassword(resetData: ResetPlayerPasswordDto): Promise<{ success: boolean; message: string }> {
    return this.post<{ success: boolean; message: string }>(
      API_ENDPOINTS.auth.resetPassword,
      resetData,
      false // No auth headers required
    );
  }

  /**
   * Change player password (regular password change)
   * Requires auth headers (x-player-id, x-club-id)
   */
  async changePassword(passwordData: ChangePlayerPasswordDto): Promise<{ success: boolean; message: string }> {
    return this.post<{ success: boolean; message: string }>(
      API_ENDPOINTS.auth.changePassword,
      passwordData
    );
  }

  /**
   * Logout player
   */
  logout(): void {
    localStorage.removeItem(STORAGE_KEYS.PLAYER_ID);
    localStorage.removeItem(STORAGE_KEYS.CLUB_ID);
    localStorage.removeItem(STORAGE_KEYS.CLUB_CODE);
    localStorage.removeItem(STORAGE_KEYS.PLAYER_TOKEN);
    localStorage.removeItem(STORAGE_KEYS.PLAYER_DATA);
    
    sessionStorage.removeItem(STORAGE_KEYS.PLAYER_ID);
    sessionStorage.removeItem(STORAGE_KEYS.CLUB_ID);
    sessionStorage.removeItem(STORAGE_KEYS.CLUB_CODE);
    sessionStorage.removeItem(STORAGE_KEYS.PLAYER_DATA);
  }

  /**
   * Check if player is logged in
   */
  isLoggedIn(): boolean {
    const playerId = localStorage.getItem(STORAGE_KEYS.PLAYER_ID) || 
                     sessionStorage.getItem(STORAGE_KEYS.PLAYER_ID);
    return !!playerId;
  }

  /**
   * Get stored player data
   */
  getStoredPlayerData(): any {
    const data = localStorage.getItem(STORAGE_KEYS.PLAYER_DATA) ||
                 sessionStorage.getItem(STORAGE_KEYS.PLAYER_DATA);
    return data ? JSON.parse(data) : null;
  }
}

// Export singleton instance
export const playerAuthService = new PlayerAuthService();









