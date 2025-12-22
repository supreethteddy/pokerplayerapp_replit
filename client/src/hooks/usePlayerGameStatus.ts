import { useQuery } from '@tanstack/react-query';
import { useUltraFastAuth } from './useUltraFastAuth';
import { useGameStatusSync } from './useGameStatusSync';

interface GameStatusInfo {
  isInActiveGame: boolean;
  isInInactiveGame: boolean;
  activeGameInfo?: {
    tableId: string;
    tableName: string;
    gameType: string;
    position: number;
    seatNumber?: number;
    status: string;
  };
  waitlistEntries: any[];
  canJoinWaitlists: boolean;
  restrictionMessage?: string;
  
  // ADD: Session fallback data for immediate synchronization
  seatedSessionFallback?: {
    tableId: string;
    tableName: string;
    gameType: string;
    seatNumber: number;
    status: 'seated';
    sessionStartTime?: string;
  };
}

export function usePlayerGameStatus(): GameStatusInfo {
  const { user } = useUltraFastAuth();
  
  // Use centralized synchronization for immediate updates on seat assignments
  useGameStatusSync();

  // UNIFIED FAST REFRESH INTERVALS (3 seconds) for immediate synchronization
  // Get player's waitlist entries with aggressive refresh during active gaming
  const { data: waitlistEntries = [] } = useQuery({
    queryKey: ['/api/seat-requests', user?.id],
    enabled: !!user?.id,
    refetchInterval: 3000, // Fast refresh for immediate seat assignment detection
    staleTime: 1000, // Consider fresh for 1 second only
  });

  // Get all tables to check status with fast refresh
  const { data: tables = [] } = useQuery({
    queryKey: ['/api/tables'],
    refetchInterval: 3000, // Fast refresh for table status changes
    staleTime: 2000, // Consider fresh for 2 seconds
  });

  // Get player's seated info with fast refresh  
  const { data: seatedInfo = [] } = useQuery({
    queryKey: ['/api/table-seats', user?.id],
    enabled: !!user?.id,
    refetchInterval: 3000, // Fast refresh for seated session detection
    staleTime: 1000, // Consider fresh for 1 second only
  });

  // Primary source: seat_requests data (contains both waitlist and seated status)
  const { data: seatRequestsData = [] } = useQuery({
    queryKey: ['/api/seat-requests', user?.id],
    enabled: !!user?.id,
    refetchInterval: 3000, // Fast refresh for real-time status
    staleTime: 1000, // Consider fresh for 1 second only
  });

  // Process the game status
  let isInActiveGame = false;
  let isInInactiveGame = false;
  let activeGameInfo: GameStatusInfo['activeGameInfo'] = undefined;
  let canJoinWaitlists = true;
  let restrictionMessage: string | undefined = undefined;
  let seatedSessionFallback: GameStatusInfo['seatedSessionFallback'] = undefined;

  // NO mock sessions - all data should come from backend API

  // Check for seated sessions first (higher priority)
  const seatedSessions = Array.isArray(seatedInfo) ? seatedInfo : [];
  const seatRequestsArray = Array.isArray(seatRequestsData) ? seatRequestsData : [];
  
  // Find active seated session from either source
  const activeSeat = seatedSessions.find((seat: any) => seat.status === 'seated') ||
                    seatRequestsArray.find((req: any) => req.status === 'seated');

  if (activeSeat) {
    // Player is seated somewhere, check if the table is active
    const tableInfo = Array.isArray(tables) ? tables.find((t: any) => t.id === activeSeat.tableId) : null;
    
    if (tableInfo && tableInfo.status === 'active') {
      isInActiveGame = true;
      canJoinWaitlists = false;
      restrictionMessage = `You must cash out from your active table "${tableInfo.name}" before joining another game`;
      
      activeGameInfo = {
        tableId: activeSeat.tableId || activeSeat.table_id,
        tableName: tableInfo.name || activeSeat.tableName || 'Unknown Table',
        gameType: tableInfo.game_type || tableInfo.gameType || activeSeat.game_type || 'Texas Hold\'em',
        position: 0, // Seated players don't have waitlist position
        seatNumber: activeSeat.seatNumber || activeSeat.seat_number,
        status: 'PLAYING NOW'
      };

      // CREATE FALLBACK SESSION DATA for immediate PlaytimeTracker display
      seatedSessionFallback = {
        tableId: activeSeat.tableId || activeSeat.table_id,
        tableName: tableInfo.name || activeSeat.tableName || 'Unknown Table',
        gameType: tableInfo.game_type || tableInfo.gameType || activeSeat.game_type || 'Texas Hold\'em',
        seatNumber: activeSeat.seatNumber || activeSeat.seat_number,
        status: 'seated',
        sessionStartTime: activeSeat.session_start_time || activeSeat.sessionStartTime
      };
    } else if (tableInfo && tableInfo.status !== 'active') {
      isInInactiveGame = true;
      canJoinWaitlists = true; // Can join other waitlists, will be removed from inactive table
    }
  } else {
    // Check waitlist entries
    const waitlistArray = Array.isArray(waitlistEntries) ? waitlistEntries : [];
    
    for (const entry of waitlistArray) {
      const tableInfo = Array.isArray(tables) ? tables.find((t: any) => t.id === entry.tableId) : null;
      
      if (tableInfo && tableInfo.status === 'active' && entry.status === 'waiting') {
        // Player is on waitlist for an active game
        activeGameInfo = {
          tableId: entry.tableId,
          tableName: tableInfo.name || entry.tableName || 'Unknown Table',
          gameType: tableInfo.game_type || tableInfo.gameType || entry.gameType || 'Texas Hold\'em',
          position: entry.position || 1,
          status: 'WAITING'
        };
        break;
      }
    }
  }

  console.log(`🎮 [GAME STATUS] Player ${user?.id} status:`, {
    isInActiveGame,
    isInInactiveGame,
    canJoinWaitlists,
    activeGameInfo,
    seatedSessions: seatedSessions.length,
    waitlistEntries: (Array.isArray(waitlistEntries) ? waitlistEntries : []).length,
    seatedSessionFallback
  });

  return {
    isInActiveGame,
    isInInactiveGame,
    activeGameInfo,
    waitlistEntries: Array.isArray(waitlistEntries) ? waitlistEntries : [],
    canJoinWaitlists,
    restrictionMessage,
    seatedSessionFallback // Include fallback session data for immediate sync
  };
}