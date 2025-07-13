import { pgTable, text, serial, integer, boolean, timestamp, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const players = pgTable("players", {
  id: serial("id").primaryKey(),
  email: text("email").notNull().unique(),
  password: text("password").notNull(),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  phone: text("phone").notNull(),
  kycStatus: text("kyc_status").notNull().default("pending"), // pending, approved, rejected
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

export const insertPlayerSchema = createInsertSchema(players).omit({
  id: true,
  createdAt: true,
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

export type Player = typeof players.$inferSelect;
export type InsertPlayer = z.infer<typeof insertPlayerSchema>;
export type PlayerPrefs = typeof playerPrefs.$inferSelect;
export type InsertPlayerPrefs = z.infer<typeof insertPlayerPrefsSchema>;
export type Table = typeof tables.$inferSelect;
export type SeatRequest = typeof seatRequests.$inferSelect;
export type InsertSeatRequest = z.infer<typeof insertSeatRequestSchema>;
export type KycDocument = typeof kycDocuments.$inferSelect;
export type InsertKycDocument = z.infer<typeof insertKycDocumentSchema>;
