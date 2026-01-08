/**
 * Central API exports for Player Portal
 * All API services integrated from poker-crm-backend
 */

// Import service instances first (before using them)
import { playerAuthService } from './auth.service';
import { playerBalanceService } from './balance.service';
import { waitlistService } from './waitlist.service';
import { tablesService } from './tables.service';
import { creditRequestService } from './credit.service';
import { playerStatsService } from './stats.service';
import { fnbService } from './fnb.service';
import { chatService } from './chat.service';
import { offersService } from './offers.service';
import { vipService } from './vip.service';
import { tournamentsService } from './tournaments.service';
import { documentsService } from './documents.service';
import { feedbackService } from './feedback.service';
import { playtimeService } from './playtime.service';

// Export all services
export * from './config';
export * from './base';
export * from './auth.service';
export * from './balance.service';
export * from './waitlist.service';
export * from './tables.service';
export * from './credit.service';
export * from './stats.service';
export * from './fnb.service';
export * from './chat.service';
export * from './offers.service';
export * from './vip.service';
export * from './tournaments.service';
export * from './documents.service';
export * from './feedback.service';
export * from './playtime.service';

// Export service instances for direct use
export { playerAuthService };
export { playerBalanceService };
export { waitlistService };
export { tablesService };
export { creditRequestService };
export { playerStatsService };
export { fnbService };
export { chatService };
export { offersService };
export { vipService };
export { tournamentsService };
export { documentsService };
export { feedbackService };
export { playtimeService };

/**
 * API Service Collection
 * Convenient object containing all API services
 */
export const api = {
  auth: playerAuthService,
  balance: playerBalanceService,
  waitlist: waitlistService,
  tables: tablesService,
  credit: creditRequestService,
  stats: playerStatsService,
  fnb: fnbService,
  chat: chatService,
  offers: offersService,
  vip: vipService,
  tournaments: tournamentsService,
  documents: documentsService,
  feedback: feedbackService,
  playtime: playtimeService,
};

export default api;










