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
  tableId: integer("table_id").references(() => tables.id),
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
export type InsertTransaction = z.infer<typeof insertTransactionSchema>;
export type SyncActivityLog = typeof syncActivityLog.$inferSelect;
export type InsertSyncActivityLog = z.infer<typeof insertSyncActivityLogSchema>;
