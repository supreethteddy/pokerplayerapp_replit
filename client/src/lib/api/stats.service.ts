/**
 * Player Stats API Service
 * Handles player statistics and analytics
 */

import { BaseAPIService } from './base';
import { API_ENDPOINTS } from './config';

/**
 * Game statistics
 */
export interface GameStats {
  totalGamesPlayed: number;
  totalHandsPlayed: number;
  totalWins: number;
  totalLosses: number;
  winRate: number; // percentage
  averagePotSize: number;
  biggestWin: number;
  biggestLoss: number;
}

/**
 * Session statistics
 */
export interface SessionStats {
  totalSessions: number;
  totalPlayTime: number; // in minutes
  averageSessionDuration: number; // in minutes
  longestSession: number; // in minutes
  shortestSession: number; // in minutes
  lastSessionDate?: string;
}

/**
 * Financial statistics
 */
export interface FinancialStats {
  totalDeposits: number;
  totalWithdrawals: number;
  netProfit: number;
  currentBalance: number;
  averageBuyIn: number;
  averageCashOut: number;
  roi: number; // Return on Investment percentage
}

/**
 * Performance statistics
 */
export interface PerformanceStats {
  vpip: number; // Voluntarily Put Money In Pot percentage
  pfr: number; // Pre-Flop Raise percentage
  aggressionFactor: number;
  threeBetPercentage: number;
  foldToCBetPercentage: number;
}

/**
 * Ranking information
 */
export interface RankingInfo {
  clubRank?: number;
  globalRank?: number;
  points: number;
  level: number;
  nextLevelPoints: number;
  tier?: string; // e.g., "Bronze", "Silver", "Gold", "Platinum"
}

/**
 * Player stats response
 */
export interface PlayerStats {
  playerId: string;
  clubId: string;
  gameStats: GameStats;
  sessionStats: SessionStats;
  financialStats: FinancialStats;
  performanceStats?: PerformanceStats;
  ranking?: RankingInfo;
  badges?: string[];
  achievements?: {
    id: string;
    name: string;
    description: string;
    earnedAt: string;
  }[];
  lastUpdated: string;
}

/**
 * Leaderboard entry
 */
export interface LeaderboardEntry {
  rank: number;
  playerId: string;
  playerName: string;
  playerNickname?: string;
  points: number;
  gamesPlayed: number;
  winRate: number;
}

/**
 * Player Stats Service
 */
export class PlayerStatsService extends BaseAPIService {
  /**
   * Get player statistics
   */
  async getPlayerStats(): Promise<PlayerStats> {
    return this.get<PlayerStats>(API_ENDPOINTS.auth.getStats);
  }

  /**
   * Get game stats only
   */
  async getGameStats(): Promise<GameStats> {
    const stats = await this.getPlayerStats();
    return stats.gameStats;
  }

  /**
   * Get session stats only
   */
  async getSessionStats(): Promise<SessionStats> {
    const stats = await this.getPlayerStats();
    return stats.sessionStats;
  }

  /**
   * Get financial stats only
   */
  async getFinancialStats(): Promise<FinancialStats> {
    const stats = await this.getPlayerStats();
    return stats.financialStats;
  }

  /**
   * Get performance stats only
   */
  async getPerformanceStats(): Promise<PerformanceStats | undefined> {
    const stats = await this.getPlayerStats();
    return stats.performanceStats;
  }

  /**
   * Get player ranking
   */
  async getPlayerRanking(): Promise<RankingInfo | undefined> {
    const stats = await this.getPlayerStats();
    return stats.ranking;
  }

  /**
   * Get player badges
   */
  async getPlayerBadges(): Promise<string[]> {
    const stats = await this.getPlayerStats();
    return stats.badges || [];
  }

  /**
   * Get player achievements
   */
  async getPlayerAchievements(): Promise<PlayerStats['achievements']> {
    const stats = await this.getPlayerStats();
    return stats.achievements || [];
  }

  /**
   * Calculate win percentage
   */
  async getWinPercentage(): Promise<number> {
    const gameStats = await this.getGameStats();
    return gameStats.winRate;
  }

  /**
   * Calculate total profit/loss
   */
  async getTotalProfitLoss(): Promise<number> {
    const financialStats = await this.getFinancialStats();
    return financialStats.netProfit;
  }

  /**
   * Get player level progress
   */
  async getLevelProgress(): Promise<{
    currentLevel: number;
    currentPoints: number;
    pointsToNextLevel: number;
    progressPercentage: number;
  }> {
    const stats = await this.getPlayerStats();
    const ranking = stats.ranking;
    
    if (!ranking) {
      return {
        currentLevel: 1,
        currentPoints: 0,
        pointsToNextLevel: 100,
        progressPercentage: 0,
      };
    }
    
    const pointsInCurrentLevel = ranking.points % ranking.nextLevelPoints;
    const progressPercentage = (pointsInCurrentLevel / ranking.nextLevelPoints) * 100;
    
    return {
      currentLevel: ranking.level,
      currentPoints: ranking.points,
      pointsToNextLevel: ranking.nextLevelPoints - pointsInCurrentLevel,
      progressPercentage,
    };
  }
}

// Export singleton instance
export const playerStatsService = new PlayerStatsService();











