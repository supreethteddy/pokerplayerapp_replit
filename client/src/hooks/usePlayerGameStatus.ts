import { useQuery } from '@tanstack/react-query';
import { useUltraFastAuth } from './useUltraFastAuth';
import { useGameStatusSync } from './useGameStatusSync';
import { waitlistService } from '../lib/api/waitlist.service';

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
  // Get player's waitlist status with aggressive refresh during active gaming
  const { data: waitlistStatusData } = useQuery({
    queryKey: ['/api/auth/player/waitlist', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      return await waitlistService.getWaitlistStatus();
    },
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

  // Process the game status
  let isInActiveGame = false;
  let isInInactiveGame = false;
  let activeGameInfo: GameStatusInfo['activeGameInfo'] = undefined;
  let canJoinWaitlists = true;
  let restrictionMessage: string | undefined = undefined;
  let seatedSessionFallback: GameStatusInfo['seatedSessionFallback'] = undefined;

  console.log('🎯 [GAME STATUS] Raw waitlistStatusData:', waitlistStatusData);

  // Check if player is seated (from the waitlist status API)
  // IMPORTANT: Also verify that the table still exists in the tables list
  // This prevents showing stale game status after table deletion or session end
  if (waitlistStatusData?.isSeated && waitlistStatusData?.entry && waitlistStatusData?.tableInfo) {
    const { entry, tableInfo } = waitlistStatusData as any;
    
    // Verify table still exists in the tables list
    const tableExists = Array.isArray(tables) && tables.some(
      (table: any) => String(table.id) === String(tableInfo.tableId)
    );
    
    // Only set as active game if table still exists
    if (tableExists && tableInfo.tableId) {
      // Player is seated at a table!
      isInActiveGame = true; // Treat all seated players as in active game
      canJoinWaitlists = false; // Can't join another waitlist while seated
      restrictionMessage = `You must call time from Table ${entry.tableNumber} before joining another game`;
      
      activeGameInfo = {
        tableId: tableInfo.tableId,
        tableName: tableInfo.tableName || `Table ${entry.tableNumber}`,
        gameType: tableInfo.gameType || 'Cash Game',
        position: 0, // Seated players don't have waitlist position
        seatNumber: entry.seatNumber || entry.tableNumber,
        status: 'PLAYING NOW'
      };

      // CREATE FALLBACK SESSION DATA for immediate PlaytimeTracker display
      seatedSessionFallback = {
        tableId: tableInfo.tableId,
        tableName: tableInfo.tableName || `Table ${entry.tableNumber}`,
        gameType: tableInfo.gameType || 'Cash Game',
        seatNumber: entry.seatNumber || entry.tableNumber,
        status: 'seated',
        sessionStartTime: entry.seatedAt
      };

      console.log('✅ [GAME STATUS] Player is SEATED:', activeGameInfo);
    } else {
      console.log('⚠️ [GAME STATUS] Player marked as seated but table no longer exists - clearing status');
      // Table was deleted or session ended - clear the status
      isInActiveGame = false;
      canJoinWaitlists = true;
      activeGameInfo = undefined;
      seatedSessionFallback = undefined;
    }
  } else if (waitlistStatusData?.onWaitlist && waitlistStatusData?.entry) {
    // Player is on waitlist (PENDING status)
    const { entry } = waitlistStatusData as any;
    
    activeGameInfo = {
      tableId: undefined as any,
      tableName: entry.tableType || 'Waiting for table',
      gameType: entry.tableType || 'Cash Game',
      position: (waitlistStatusData as any).position || 0,
      seatNumber: entry.seatNumber || undefined,
      status: 'ON WAITLIST'
    };
    canJoinWaitlists = false; // Already on a waitlist

    console.log('🎯 [GAME STATUS] Player is ON WAITLIST:', activeGameInfo);
  } else {
    console.log('ℹ️ [GAME STATUS] Player has NO active session or waitlist entry');
  }

  return {
    isInActiveGame,
    isInInactiveGame,
    activeGameInfo,
    waitlistEntries: [], // Legacy support
    canJoinWaitlists,
    restrictionMessage,
    seatedSessionFallback // Include fallback session data for immediate sync
  };
}