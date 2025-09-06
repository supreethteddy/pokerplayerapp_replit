import { useQuery } from '@tanstack/react-query';
import { useUltraFastAuth } from './useUltraFastAuth';

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
}

export function usePlayerGameStatus(): GameStatusInfo {
  const { user } = useUltraFastAuth();

  // Get player's waitlist entries
  const { data: waitlistEntries = [] } = useQuery({
    queryKey: ['/api/seat-requests', user?.id],
    enabled: !!user?.id,
    refetchInterval: 15000,
  });

  // Get all tables to check status
  const { data: tables = [] } = useQuery({
    queryKey: ['/api/tables'],
    refetchInterval: 30000,
  });

  // Get player's seated info
  const { data: seatedInfo = [] } = useQuery({
    queryKey: ['/api/table-seats', user?.id],
    enabled: !!user?.id,
    refetchInterval: 10000,
  });

  // Process the game status
  let isInActiveGame = false;
  let isInInactiveGame = false;
  let activeGameInfo: GameStatusInfo['activeGameInfo'] = undefined;
  let canJoinWaitlists = true;
  let restrictionMessage: string | undefined = undefined;

  // Check for seated sessions first (higher priority)
  const seatedSessions = Array.isArray(seatedInfo) ? seatedInfo : [];
  const activeSeat = seatedSessions.find((seat: any) => seat.status === 'seated');

  if (activeSeat) {
    // Player is seated somewhere, check if the table is active
    const tableInfo = Array.isArray(tables) ? tables.find((t: any) => t.id === activeSeat.tableId) : null;
    
    if (tableInfo && tableInfo.status === 'active') {
      isInActiveGame = true;
      canJoinWaitlists = false;
      restrictionMessage = `You must cash out from your active table "${tableInfo.name}" before joining another game`;
      
      activeGameInfo = {
        tableId: activeSeat.tableId,
        tableName: tableInfo.name || activeSeat.tableName || 'Unknown Table',
        gameType: tableInfo.game_type || tableInfo.gameType || 'Texas Hold\'em',
        position: 0, // Seated players don't have waitlist position
        seatNumber: activeSeat.seatNumber,
        status: 'PLAYING NOW'
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
    waitlistEntries: (Array.isArray(waitlistEntries) ? waitlistEntries : []).length
  });

  return {
    isInActiveGame,
    isInInactiveGame,
    activeGameInfo,
    waitlistEntries: Array.isArray(waitlistEntries) ? waitlistEntries : [],
    canJoinWaitlists,
    restrictionMessage
  };
}