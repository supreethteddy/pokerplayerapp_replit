import { pgTable, text, serial, integer, boolean, timestamp, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const players = pgTable("players", {
  id: serial("id").primaryKey(),
  supabaseId: text("supabase_id").notNull().unique(), // Link to Supabase auth.users.id
  universalId: text("universal_id").unique(), // Enterprise-grade universal ID for cross-portal sync
  email: text("email").notNull().unique(),
  password: text("password").notNull(),
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
  creditApproved: boolean("credit_approved").default(false), // Credit system approval
  panCardNumber: text("pan_card_number"), // PAN card number (10 characters)
  panCardDocumentUrl: text("pan_card_document_url"), // URL to uploaded PAN card document
  panCardStatus: text("pan_card_status").default("missing"), // missing, pending, approved, rejected
  panCardVerified: boolean("pan_card_verified").default(false), // PAN card verification status
  panCardUploadedAt: timestamp("pan_card_uploaded_at"), // PAN card upload timestamp
  createdAt: timestamp("created_at").defaultNow(),
});

export const playerPrefs = pgTable("player_prefs", {
  id: serial("id").primaryKey(),
  playerId: integer("player_id").references(() => players.id),
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
  playerId: integer("player_id").references(() => players.id),
  tableId: text("table_id").notNull(), // Changed to text to support UUID table IDs from poker_tables
  status: text("status").notNull().default("waiting"), // waiting, approved, rejected
  position: integer("position").default(0),
  estimatedWait: integer("estimated_wait").default(0), // in minutes
  createdAt: timestamp("created_at").defaultNow(),
});

export const kycDocuments = pgTable("kyc_documents", {
  id: serial("id").primaryKey(),
  playerId: integer("player_id").references(() => players.id),
  documentType: text("document_type").notNull(), // id, address, photo
  fileName: text("file_name").notNull(),
  fileUrl: text("file_url").notNull(),
  status: text("status").notNull().default("pending"), // pending, approved, rejected
  createdAt: timestamp("created_at").defaultNow(),
});

// Player feedback messages directed to admins
export const playerFeedback = pgTable("player_feedback", {
  id: serial("id").primaryKey(),
  playerId: integer("player_id").references(() => players.id),
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
  targetPlayerId: integer("target_player_id").references(() => players.id), // null for broadcast
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
  playerId: integer("player_id").references(() => players.id),
  type: text("type").notNull(), // deposit, withdrawal, win, loss
  amount: text("amount").notNull(),
  description: text("description"),
  staffId: text("staff_id"), // For cashier transactions
  status: text("status").notNull().default("completed"), // completed, pending, cancelled
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
  offerId: integer("offer_id").references(() => staffOffers.id),
  playerId: integer("player_id").references(() => players.id),
  viewType: text("view_type").notNull(), // carousel, offers_page
  viewedAt: timestamp("viewed_at").defaultNow(),
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
  tableId: z.string(), // Override to accept UUID strings from poker_tables
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
