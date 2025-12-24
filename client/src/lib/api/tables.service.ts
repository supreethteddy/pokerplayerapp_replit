/**
 * Table Operations API Service
 * Handles table viewing and details for players
 */

import { BaseAPIService } from './base';
import { API_ENDPOINTS } from './config';

/**
 * Table status
 */
export enum TableStatus {
  AVAILABLE = 'available',
  IN_USE = 'in_use',
  RESERVED = 'reserved',
  MAINTENANCE = 'maintenance',
  CLOSED = 'closed',
}

/**
 * Table type
 */
export enum TableType {
  CASH = 'cash',
  TOURNAMENT = 'tournament',
  SIT_AND_GO = 'sit_and_go',
}

/**
 * Seat information
 */
export interface Seat {
  seatNumber: number;
  playerId?: string;
  playerName?: string;
  playerNickname?: string;
  isOccupied: boolean;
  chipCount?: number;
}

/**
 * Table information
 */
export interface Table {
  id: string;
  clubId: string;
  name: string;
  tableNumber: string;
  type: TableType;
  status: TableStatus;
  capacity: number;
  occupiedSeats: number;
  availableSeats: number;
  seats?: Seat[];
  minBuyIn?: number;
  maxBuyIn?: number;
  smallBlind?: number;
  bigBlind?: number;
  gameVariant?: string; // e.g., "Texas Hold'em", "Omaha", etc.
  createdAt: string;
  updatedAt: string;
}

/**
 * Available tables response
 */
export interface AvailableTablesResponse {
  tables: Table[];
  total: number;
  availableCount: number;
}

/**
 * Table details response
 */
export interface TableDetailsResponse {
  table: Table;
  currentPlayers: {
    id: string;
    name: string;
    nickname?: string;
    seatNumber: number;
    chipCount: number;
  }[];
  waitingPlayers?: number;
}

/**
 * Table Operations Service
 */
export class TablesService extends BaseAPIService {
  /**
   * Get available tables
   */
  async getAvailableTables(): Promise<AvailableTablesResponse> {
    return this.get<AvailableTablesResponse>(API_ENDPOINTS.tables.getAvailable);
  }

  /**
   * Get table details
   */
  async getTableDetails(tableId: string): Promise<TableDetailsResponse> {
    return this.get<TableDetailsResponse>(API_ENDPOINTS.tables.getDetails(tableId));
  }

  /**
   * Get tables by type
   */
  async getTablesByType(type: TableType): Promise<Table[]> {
    const response = await this.getAvailableTables();
    return response.tables.filter((table) => table.type === type);
  }

  /**
   * Get tables by status
   */
  async getTablesByStatus(status: TableStatus): Promise<Table[]> {
    const response = await this.getAvailableTables();
    return response.tables.filter((table) => table.status === status);
  }

  /**
   * Find tables with available seats
   */
  async getTablesWithAvailableSeats(minSeats: number = 1): Promise<Table[]> {
    const response = await this.getAvailableTables();
    return response.tables.filter(
      (table) =>
        table.status === TableStatus.AVAILABLE &&
        table.availableSeats >= minSeats
    );
  }

  /**
   * Get table by number
   */
  async getTableByNumber(tableNumber: string): Promise<Table | null> {
    const response = await this.getAvailableTables();
    return (
      response.tables.find((table) => table.tableNumber === tableNumber) || null
    );
  }

  /**
   * Check if table has available seats
   */
  async hasAvailableSeats(tableId: string): Promise<boolean> {
    try {
      const details = await this.getTableDetails(tableId);
      return details.table.availableSeats > 0;
    } catch (error) {
      return false;
    }
  }

  /**
   * Get table occupancy rate
   */
  async getTableOccupancyRate(tableId: string): Promise<number> {
    try {
      const details = await this.getTableDetails(tableId);
      return (details.table.occupiedSeats / details.table.capacity) * 100;
    } catch (error) {
      return 0;
    }
  }
}

// Export singleton instance
export const tablesService = new TablesService();









