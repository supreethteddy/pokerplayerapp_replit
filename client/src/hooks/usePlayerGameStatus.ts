import { useQuery } from '@tanstack/react-query';
import { useUltraFastAuth } from './useUltraFastAuth';
import { useGameStatusSync } from './useGameStatusSync';
import { waitlistService } from '../lib/api/waitlist.service';
import { apiRequest } from '../lib/queryClient';

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
  isInActiveTournament: boolean;
  
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
    staleTime: 5000,
  });

  const { data: tables = [] } = useQuery({
    queryKey: ['/api/tables'],
    staleTime: 5000,
  });

  // Check if player is actively in a running tournament
  const { data: activeTournamentData } = useQuery({
    queryKey: ['/api/player-tournaments/active-session', user?.id],
    queryFn: async () => {
      if (!user?.id) return { inActiveTournament: false, tournamentName: null, tournamentId: null };
      const res = await apiRequest('GET', '/api/player-tournaments/active-session');
      if (!res.ok) return { inActiveTournament: false, tournamentName: null, tournamentId: null };
      return res.json();
    },
    enabled: !!user?.id,
    staleTime: 10000,
    refetchInterval: 15000,
  });

  // Process the game status
  let isInActiveGame = false;
  let isInInactiveGame = false;
  let activeGameInfo: GameStatusInfo['activeGameInfo'] = undefined;
  let canJoinWaitlists = true;
  let restrictionMessage: string | undefined = undefined;
  let seatedSessionFallback: GameStatusInfo['seatedSessionFallback'] = undefined;
  const isInActiveTournament = activeTournamentData?.inActiveTournament === true;

  console.log('🎯 [GAME STATUS] Raw waitlistStatusData:', waitlistStatusData);

  // Check if player is seated (from the waitlist status API)
  if (waitlistStatusData?.isSeated && waitlistStatusData?.entry && waitlistStatusData?.tableInfo) {
    const { entry, tableInfo } = waitlistStatusData as any;
    
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
  } else if (isInActiveTournament) {
    // Player is actively playing in a tournament — block table joins
    canJoinWaitlists = false;
    restrictionMessage = `You are currently playing in tournament "${activeTournamentData?.tournamentName || 'a tournament'}". You cannot join a table while in an active tournament.`;
    console.log('🏆 [GAME STATUS] Player is IN ACTIVE TOURNAMENT - blocking table joins');
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
    isInActiveTournament,
    seatedSessionFallback // Include fallback session data for immediate sync
  };
}