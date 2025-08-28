import { pgTable, text, serial, integer, boolean, timestamp, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const players = pgTable("players", {
  id: serial("id").primaryKey(),
  playerCode: text("player_code").unique(), // Text-based player identifier like POKERPLAYR-0001
  supabaseId: text("supabase_id"), // Link to Supabase auth.users.id (now optional for Clerk users)
  universalId: text("universal_id").unique(), // Enterprise-grade universal ID for cross-portal sync
  clerkUserId: text("clerk_user_id").unique(), // Link to Clerk user ID for new authentication
  email: text("email").notNull().unique(),
  password: text("password"), // Optional for Clerk users
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  phone: text("phone").notNull(),

  kycStatus: text("kyc_status").notNull().default("pending"), // pending, approved, rejected
  balance: text("balance").notNull().default("0.00"), // Current balance
  totalDeposits: text("total_deposits").notNull().default("0.00"), // Total deposits
  totalWithdrawals: text("total_withdrawals").notNull().default("0.00"), // Total withdrawals
  totalWinnings: text("total_winnings").notNull().default("0.00"), // Total winnings
  totalLosses: text("total_losses").notNull().default("0.00"), // Total losses
  gamesPlayed: integer("games_played").notNull().default(0), // Games played
  hoursPlayed: text("hours_played").notNull().default("0.00"), // Hours played
  creditEligible: boolean("credit_eligible").default(false), // Credit system eligibility
  creditLimit: text("credit_limit").notNull().default("0.00"), // Maximum credit allowed
  currentCredit: text("current_credit").notNull().default("0.00"), // Current credit balance
  panCardNumber: text("pan_card_number"), // PAN card number (10 characters)
  panCardDocumentUrl: text("pan_card_document_url"), // URL to uploaded PAN card document
  panCardStatus: text("pan_card_status").default("missing"), // missing, pending, approved, rejected
  panCardVerified: boolean("pan_card_verified").default(false), // PAN card verification status
  panCardUploadedAt: timestamp("pan_card_uploaded_at"), // PAN card upload timestamp
  isActive: boolean("is_active").default(true), // Player active status
  emailVerified: boolean("email_verified").default(false), // Email verification status
  lastLoginAt: timestamp("last_login_at"), // Last login timestamp
  clerkSyncedAt: timestamp("clerk_synced_at"), // Last Clerk sync timestamp
  fullName: text("full_name"), // Computed full name (first_name + last_name)
  nickname: text("nickname"), // Player nickname
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const playerPrefs = pgTable("player_prefs", {
  id: serial("id").primaryKey(),
  playerId: text("player_id").references(() => players.id),
  seatAvailable: boolean("seat_available").default(true),
  callTimeWarning: boolean("call_time_warning").default(true),
  gameUpdates: boolean("game_updates").default(false),
});

export const tables = pgTable("tables", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  gameType: text("game_type").notNull(),
  stakes: text("stakes").notNull(),
  maxPlayers: integer("max_players").notNull(),
  currentPlayers: integer("current_players").default(0),
  pot: integer("pot").default(0),
  avgStack: integer("avg_stack").default(0),
  isActive: boolean("is_active").default(true),
});

export const seatRequests = pgTable("seat_requests", {
  id: serial("id").primaryKey(),
  universalId: text("universal_id").unique(), // Enterprise-grade universal ID
  playerId: text("player_id").references(() => players.id),
  tableId: text("table_id").notNull(), // Changed to text to support UUID table IDs from poker_tables
  status: text("status").notNull().default("waiting"), // waiting, approved, rejected, seated, active
  position: integer("position").default(0),
  seatNumber: integer("seat_number"), // Preferred seat number (1-9)
  notes: text("notes"), // Additional notes for seat reservation
  estimatedWait: integer("estimated_wait").default(0), // in minutes

  // === PLAYTIME TRACKING EXTENSIONS ===
  sessionStartTime: timestamp("session_start_time"), // When player was seated at table
  minPlayTime: integer("min_play_time_minutes").default(30), // Minimum play time required (from table config)
  callTimeWindow: integer("call_time_window_minutes").default(10), // Call time window duration
  callTimePlayPeriod: integer("call_time_play_period_minutes").default(5), // Required play period before next call time
  cashoutWindow: integer("cashout_window_minutes").default(3), // Cashout window after call time

  // Session state tracking
  callTimeStarted: timestamp("call_time_started"), // When call time was initiated
  callTimeEnds: timestamp("call_time_ends"), // When current call time window ends
  cashoutWindowActive: boolean("cashout_window_active").default(false), // Is cashout window currently open
  cashoutWindowEnds: timestamp("cashout_window_ends"), // When cashout window closes
  lastCashoutAttempt: timestamp("last_cashout_attempt"), // Last time player tried to cash out

  // Financial tracking
  sessionBuyInAmount: text("session_buy_in_amount").default("0.00"), // Total buy-in for this session
  sessionCashOutAmount: text("session_cash_out_amount").default("0.00"), // Total cash-out for this session
  sessionRakeAmount: text("session_rake_amount").default("0.00"), // Total rake for this session
  sessionTipAmount: text("session_tip_amount").default("0.00"), // Total tips for this session

  createdAt: timestamp("created_at").defaultNow(),
});

export const kycDocuments = pgTable("kyc_documents", {
  id: serial("id").primaryKey(),
  playerId: text("player_id").references(() => players.id),
  documentType: text("document_type").notNull(), // id, address, photo
  fileName: text("file_name").notNull(),
  fileUrl: text("file_url").notNull(),
  status: text("status").notNull().default("pending"), // pending, approved, rejected
  createdAt: timestamp("created_at").defaultNow(),
});

// Player feedback messages directed to admins
export const playerFeedback = pgTable("player_feedback", {
  id: serial("id").primaryKey(),
  playerId: text("player_id").references(() => players.id),
  message: text("message").notNull(),
  status: text("status").notNull().default("unread"), // unread, read, responded
  response: text("response"), // Admin response to feedback
  respondedBy: text("responded_by"), // Admin who responded
  respondedAt: timestamp("responded_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Push notifications from staff to players
export const pushNotifications = pgTable("push_notifications", {
  id: serial("id").primaryKey(),
  senderId: text("sender_id").notNull(), // ID of staff member sending
  senderName: text("sender_name").notNull(), // Name of sender
  senderRole: text("sender_role").notNull(), // admin, manager, gre
  targetPlayerId: text("target_player_id").references(() => players.id), // null for broadcast
  title: text("title").notNull(),
  message: text("message").notNull(),
  messageType: text("message_type").notNull().default("text"), // text, image, video
  mediaUrl: text("media_url"), // URL for image/video content
  priority: text("priority").notNull().default("normal"), // low, normal, high, urgent
  status: text("status").notNull().default("sent"), // sent, delivered, read
  broadcastToAll: boolean("broadcast_to_all").default(false),
  readAt: timestamp("read_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const transactions = pgTable("transactions", {
  id: serial("id").primaryKey(),
  universalId: text("universal_id").unique(), // Enterprise-grade universal ID
  playerId: text("player_id").references(() => players.id),
  type: text("type").notNull(), // deposit, withdrawal, win, loss, buy_in, cash_out, rake, tip, call_time, session_start, session_end
  amount: text("amount").notNull(),
  description: text("description"),
  staffId: text("staff_id"), // For cashier transactions
  status: text("status").notNull().default("completed"), // completed, pending, cancelled

  // === SESSION EVENT TRACKING EXTENSIONS ===
  sessionId: integer("session_id").references(() => seatRequests.id), // Link to seat request/session
  tableId: text("table_id"), // Table where transaction occurred
  tableName: text("table_name"), // Table name for quick reference
  sessionEventType: text("session_event_type"), // session_join, buy_in, call_time_start, call_time_end, cashout_attempt, session_end
  sessionDuration: integer("session_duration_minutes"), // Duration in minutes (for session_end events)
  rakePercentage: text("rake_percentage"), // Rake percentage applied
  tipRecipient: text("tip_recipient"), // Dealer name or staff who received tip

  createdAt: timestamp("created_at").defaultNow(),
});

export const averageStackData = pgTable("average_stack_data", {
  id: serial("id").primaryKey(),
  tableId: text("table_id").notNull(),
  averageStack: text("average_stack").notNull().default("0.00"),
  updatedBy: integer("updated_by"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});



export const offerBanners = pgTable("offer_banners", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  imageUrl: text("image_url").notNull(),
  offerDescription: text("offer_description"),
  redirectUrl: text("redirect_url"),
  isActive: boolean("is_active").default(true),
  displayOrder: integer("display_order").default(0),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// === OFFER MANAGEMENT SYSTEM ===

export const staffOffers = pgTable("staff_offers", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  offerType: text("offer_type").notNull(), // welcome_bonus, deposit_bonus, cashback, free_spins, tournament
  terms: text("terms"), // Terms and conditions
  isActive: boolean("is_active").default(true),
  startDate: timestamp("start_date"),
  endDate: timestamp("end_date"),
  targetAudience: text("target_audience").default("all"), // all, new_players, vip, etc.
  createdBy: text("created_by").notNull(), // Staff member who created the offer
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const carouselItems = pgTable("carousel_items", {
  id: serial("id").primaryKey(),
  offerId: integer("offer_id").references(() => staffOffers.id),
  mediaUrl: text("media_url").notNull(), // URL to video or image
  mediaType: text("media_type").notNull(), // video, image
  position: integer("position").notNull().default(0), // Order in carousel
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

export const offerViews = pgTable("offer_views", {
  id: serial("id").primaryKey(),
  playerId: text("player_id").references(() => players.id),
  viewType: text("view_type").notNull(), // carousel, offers_page
  viewedAt: timestamp("viewed_at").defaultNow(),
});

// === UNIFIED CHAT SYSTEM - TWO-TABLE ARCHITECTURE ===

export const chatRequests = pgTable("chat_requests", {
  id: text("id").primaryKey().default("gen_random_uuid()"), // UUID
  playerId: integer("player_id").notNull(),
  playerName: text("player_name").notNull(),
  playerEmail: text("player_email"),
  subject: text("subject").notNull(),
  priority: text("priority").default("urgent"),
  status: text("status").default("waiting"), // waiting, in_progress, resolved
  source: text("source").default("player_portal"),
  category: text("category").default("support"),
  assignedTo: text("assigned_to"),
  greStaffId: text("gre_staff_id"),
  initialMessage: text("initial_message"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
  resolvedAt: timestamp("resolved_at"),
  resolvedBy: text("resolved_by"),
});

export const chatMessages = pgTable("chat_messages", {
  id: text("id").primaryKey().default("gen_random_uuid()"), // UUID
  requestId: text("request_id").references(() => chatRequests.id, { onDelete: "cascade" }),
  playerId: text("player_id").notNull(),
  messageText: text("message_text").notNull(),
  sender: text("sender").notNull(), // 'player' or 'gre'
  senderName: text("sender_name"),
  timestamp: timestamp("timestamp").defaultNow(),
  status: text("status").default("sent"), // sent, delivered, read
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Enterprise-grade sync activity log for cross-portal integration
export const syncActivityLog = pgTable("sync_activity_log", {
  id: serial("id").primaryKey(),
  entityType: text("entity_type").notNull(), // player, transaction, seat_request, etc.
  action: text("action").notNull(), // create, update, delete, sync
  entityUniversalId: text("entity_universal_id"),
  entityData: jsonb("entity_data"),
  portalOrigin: text("portal_origin").notNull().default("player_portal"),
  createdAt: timestamp("created_at").defaultNow(),
});

// === FOOD & BEVERAGE SYSTEM ===
export const foodBeverageItems = pgTable("food_beverage_items", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description").notNull(),
  price: text("price").notNull().default("0.00"), // Free if 0.00
  imageUrl: text("image_url"),
  category: text("category").notNull(), // food, beverage, snack, dessert
  isAvailable: boolean("is_available").default(true),
  displayOrder: integer("display_order").default(0),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const adsOffers = pgTable("ads_offers", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description"),
  imageUrl: text("image_url"),
  videoUrl: text("video_url"),
  targetUrl: text("target_url"), // Link to open when ad is clicked
  adType: text("ad_type").notNull().default("banner"), // banner, video, carousel
  isActive: boolean("is_active").default(true),
  displayOrder: integer("display_order").default(0),
  startDate: timestamp("start_date"),
  endDate: timestamp("end_date"),
  createdBy: text("created_by").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const orders = pgTable("orders", {
  id: serial("id").primaryKey(),
  playerId: text("player_id").references(() => players.id),
  playerName: text("player_name").notNull(),
  items: jsonb("items").notNull(), // Array of {itemId, name, price, quantity}
  totalAmount: text("total_amount").notNull().default("0.00"),
  status: text("status").notNull().default("pending"), // pending, preparing, ready, delivered, cancelled
  notes: text("notes"), // Special instructions
  tableNumber: text("table_number"), // Table where player is seated
  orderSource: text("order_source").notNull().default("player_portal"),
  staffAssignedId: text("staff_assigned_id"), // Staff member handling the order
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertPlayerSchema = createInsertSchema(players).omit({
  id: true,
  createdAt: true,
}).extend({
  supabaseId: z.string().optional(),
});

export const insertPlayerPrefsSchema = createInsertSchema(playerPrefs).omit({
  id: true,
});

export const insertSeatRequestSchema = createInsertSchema(seatRequests).omit({
  id: true,
  createdAt: true,
}).extend({
  playerId: z.string(), // Override to accept UUID strings
  tableId: z.string(), // Override to accept UUID strings from poker_tables
  seatNumber: z.number().optional(), // Preferred seat number (1-9)
  notes: z.string().optional(), // Additional notes for seat reservation
});

export const insertKycDocumentSchema = createInsertSchema(kycDocuments).omit({
  id: true,
  createdAt: true,
});

export const insertTransactionSchema = createInsertSchema(transactions).omit({
  id: true,
  createdAt: true,
});

export const insertSyncActivityLogSchema = createInsertSchema(syncActivityLog).omit({
  id: true,
  createdAt: true,
});

export type Player = typeof players.$inferSelect;
export type InsertPlayer = z.infer<typeof insertPlayerSchema>;
export type PlayerPrefs = typeof playerPrefs.$inferSelect;
export type InsertPlayerPrefs = z.infer<typeof insertPlayerPrefsSchema>;
export type Table = typeof tables.$inferSelect;
export type SeatRequest = typeof seatRequests.$inferSelect;
export type InsertSeatRequest = z.infer<typeof insertSeatRequestSchema>;
export type KycDocument = typeof kycDocuments.$inferSelect;
export type InsertKycDocument = z.infer<typeof insertKycDocumentSchema>;
export type Transaction = typeof transactions.$inferSelect;

export const insertAverageStackDataSchema = createInsertSchema(averageStackData).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertAverageStackData = z.infer<typeof insertAverageStackDataSchema>;
export type AverageStackData = typeof averageStackData.$inferSelect;

export const insertOfferBannerSchema = createInsertSchema(offerBanners).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertOfferBanner = z.infer<typeof insertOfferBannerSchema>;
export type OfferBanner = typeof offerBanners.$inferSelect;
export type InsertTransaction = z.infer<typeof insertTransactionSchema>;
export type SyncActivityLog = typeof syncActivityLog.$inferSelect;
export type InsertSyncActivityLog = z.infer<typeof insertSyncActivityLogSchema>;

// Staff offers system
export const insertStaffOfferSchema = createInsertSchema(staffOffers).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertStaffOffer = z.infer<typeof insertStaffOfferSchema>;
export type StaffOffer = typeof staffOffers.$inferSelect;

// === UNIFIED CHAT SYSTEM TYPES ===
export const insertChatRequestSchema = createInsertSchema(chatRequests).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertChatRequest = z.infer<typeof insertChatRequestSchema>;
export type ChatRequest = typeof chatRequests.$inferSelect;

// === FOOD & BEVERAGE SYSTEM TYPES ===
export const insertFoodBeverageItemSchema = createInsertSchema(foodBeverageItems).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertFoodBeverageItem = z.infer<typeof insertFoodBeverageItemSchema>;
export type FoodBeverageItem = typeof foodBeverageItems.$inferSelect;

export const insertAdsOfferSchema = createInsertSchema(adsOffers).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertAdsOffer = z.infer<typeof insertAdsOfferSchema>;
export type AdsOffer = typeof adsOffers.$inferSelect;

export const insertOrderSchema = createInsertSchema(orders).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertOrder = z.infer<typeof insertOrderSchema>;
export type Order = typeof orders.$inferSelect;

export const insertChatMessageSchema = createInsertSchema(chatMessages).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertChatMessage = z.infer<typeof insertChatMessageSchema>;
export type ChatMessage = typeof chatMessages.$inferSelect;

export const insertCarouselItemSchema = createInsertSchema(carouselItems).omit({ id: true, createdAt: true });
export type InsertCarouselItem = z.infer<typeof insertCarouselItemSchema>;
export type CarouselItem = typeof carouselItems.$inferSelect;

export const insertOfferViewSchema = createInsertSchema(offerViews).omit({ id: true });
export type InsertOfferView = z.infer<typeof insertOfferViewSchema>;
export type OfferView = typeof offerViews.$inferSelect;

// Feedback and Push Notification Schemas
export const insertPlayerFeedbackSchema = createInsertSchema(playerFeedback).omit({ id: true, createdAt: true });
export type InsertPlayerFeedback = z.infer<typeof insertPlayerFeedbackSchema>;
export type PlayerFeedback = typeof playerFeedback.$inferSelect;

export const insertPushNotificationSchema = createInsertSchema(pushNotifications).omit({ id: true, createdAt: true });
export type InsertPushNotification = z.infer<typeof insertPushNotificationSchema>;
export type PushNotification = typeof pushNotifications.$inferSelect;

// Table sessions for tracking player time spent at tables
export const tableSessions = pgTable("table_sessions", {
  id: serial("id").primaryKey(),
  universalId: text("universal_id").unique(), // Enterprise-grade universal ID
  playerId: text("player_id").references(() => players.id),
  tableId: text("table_id").notNull(), // Table UUID from staff portal
  tableName: text("table_name").notNull(), // Table name for reference
  sessionStatus: text("session_status").notNull().default("active"), // active, ended
  seatNumber: integer("seat_number"), // Actual seat number at table
  joinedAt: timestamp("joined_at").defaultNow(), // When player joined table
  leftAt: timestamp("left_at"), // When player left table
  duration: integer("duration"), // Session duration in minutes
  totalBuyIns: text("total_buy_ins").notNull().default("0.00"), // Total amount bought in
  totalCashOuts: text("total_cash_outs").notNull().default("0.00"), // Total amount cashed out
  netResult: text("net_result").notNull().default("0.00"), // Final profit/loss
  createdBy: text("created_by"), // Staff member who seated the player
  endedBy: text("ended_by"), // Staff member who ended the session
  notes: text("notes"), // Additional session notes
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Buy-in transactions for tracking multiple buy-ins during table sessions
export const buyInTransactions = pgTable("buy_in_transactions", {
  id: serial("id").primaryKey(),
  universalId: text("universal_id").unique(), // Enterprise-grade universal ID
  sessionId: integer("session_id").references(() => tableSessions.id),
  playerId: text("player_id").references(() => players.id),
  tableId: text("table_id").notNull(), // Table UUID
  transactionType: text("transaction_type").notNull(), // buy_in, cash_out, rebuy
  amount: text("amount").notNull(), // Transaction amount
  balanceBefore: text("balance_before").notNull(), // Player balance before transaction
  balanceAfter: text("balance_after").notNull(), // Player balance after transaction
  paymentMethod: text("payment_method").notNull().default("cash"), // cash, credit, transfer
  processedBy: text("processed_by").notNull(), // Staff member who processed
  staffPortalReference: text("staff_portal_reference"), // Reference ID from staff portal
  notes: text("notes"), // Transaction notes
  timestamp: timestamp("timestamp").defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
});

// Account ledger for comprehensive financial tracking
export const accountLedger = pgTable("account_ledger", {
  id: serial("id").primaryKey(),
  universalId: text("universal_id").unique(), // Enterprise-grade universal ID
  playerId: text("player_id").references(() => players.id),
  sessionId: integer("session_id").references(() => tableSessions.id), // Optional: link to table session
  entryType: text("entry_type").notNull(), // table_entry, table_exit, buy_in, cash_out, deposit, withdrawal
  description: text("description").notNull(), // Human-readable description
  amount: text("amount").notNull(), // Transaction amount (positive or negative)
  balanceBefore: text("balance_before").notNull(), // Balance before transaction
  balanceAfter: text("balance_after").notNull(), // Balance after transaction
  creditBefore: text("credit_before").notNull().default("0.00"), // Credit before transaction
  creditAfter: text("credit_after").notNull().default("0.00"), // Credit after transaction
  relatedTableId: text("related_table_id"), // Table ID if related to table activity
  relatedTableName: text("related_table_name"), // Table name for reference
  processedBy: text("processed_by"), // Staff member who processed the transaction
  staffPortalSync: boolean("staff_portal_sync").default(false), // Synced with staff portal
  managerNotes: text("manager_notes"), // Manager notes for oversight
  timestamp: timestamp("timestamp").defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
});

// Insert schemas for new tables
export const insertTableSessionSchema = createInsertSchema(tableSessions).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertTableSession = z.infer<typeof insertTableSessionSchema>;
export type TableSession = typeof tableSessions.$inferSelect;

export const insertBuyInTransactionSchema = createInsertSchema(buyInTransactions).omit({ id: true, createdAt: true });
export type InsertBuyInTransaction = z.infer<typeof insertBuyInTransactionSchema>;
export type BuyInTransaction = typeof buyInTransactions.$inferSelect;

export const insertAccountLedgerSchema = createInsertSchema(accountLedger).omit({ id: true, createdAt: true });
export type InsertAccountLedger = z.infer<typeof insertAccountLedgerSchema>;
export type AccountLedger = typeof accountLedger.$inferSelect;