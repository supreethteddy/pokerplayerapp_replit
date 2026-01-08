import { BaseAPIService } from './base';

/**
 * Tournaments Service
 * Handles tournament registration and information
 */
class TournamentsService extends BaseAPIService {
  /**
   * Register player for a tournament
   */
  async registerForTournament(data: {
    tournamentId: string;
    playerId?: string;
    buyIn?: number;
  }): Promise<{
    success: boolean;
    message: string;
    registrationId: string;
    seatNumber?: number;
  }> {
    return this.request('POST', '/tournaments/register', data);
  }

  /**
   * Get upcoming tournaments
   */
  async getUpcomingTournaments(): Promise<{
    tournaments: Array<{
      id: string;
      name: string;
      startTime: string;
      buyIn: number;
      prizePool: number;
      maxPlayers: number;
      registeredPlayers: number;
      status: 'upcoming' | 'registering' | 'in_progress' | 'completed';
    }>;
  }> {
    return this.request('GET', '/tournaments/upcoming');
  }

  /**
   * Get player's tournament registrations
   */
  async getMyRegistrations(): Promise<{
    registrations: Array<{
      tournamentId: string;
      tournamentName: string;
      startTime: string;
      status: 'registered' | 'checked_in' | 'playing' | 'eliminated' | 'finished';
      seatNumber?: number;
      position?: number;
      winnings?: number;
    }>;
  }> {
    return this.request('GET', '/tournaments/my-registrations');
  }

  /**
   * Cancel tournament registration
   */
  async cancelRegistration(tournamentId: string): Promise<{
    success: boolean;
    message: string;
    refundAmount?: number;
  }> {
    return this.request('POST', `/tournaments/${tournamentId}/cancel`);
  }

  /**
   * Get tournament details
   */
  async getTournamentDetails(tournamentId: string): Promise<{
    tournament: {
      id: string;
      name: string;
      description: string;
      startTime: string;
      buyIn: number;
      prizePool: number;
      structure: string;
      maxPlayers: number;
      registeredPlayers: number;
      payoutStructure: Array<{ position: number; percentage: number }>;
    };
  }> {
    return this.request('GET', `/tournaments/${tournamentId}`);
  }
}

export const tournamentsService = new TournamentsService();







