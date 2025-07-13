import type { Express } from "express";
import { createServer, type Server } from "http";
import { supabaseStorage } from "./supabase-storage";
import { insertPlayerSchema, insertPlayerPrefsSchema, insertSeatRequestSchema, insertKycDocumentSchema } from "@shared/schema";
import { z } from "zod";

export async function registerRoutes(app: Express): Promise<Server> {
  // Player routes
  app.post("/api/players", async (req, res) => {
    try {
      const playerData = insertPlayerSchema.parse(req.body);
      
      // Check if player already exists in Supabase
      const existingPlayer = await supabaseStorage.getPlayerByEmail(playerData.email);
      if (existingPlayer) {
        return res.status(409).json({ error: "Account with this email already exists" });
      }
      
      // Create player in Supabase
      const player = await supabaseStorage.createPlayer(playerData);
      
      // Create default preferences
      const defaultPrefs = {
        playerId: player.id,
        seatAvailable: true,
        callTimeWarning: true,
        gameUpdates: true
      };
      await supabaseStorage.createPlayerPrefs(defaultPrefs);
      
      res.json(player);
    } catch (error: any) {
      // Handle database constraint errors
      if (error.message.includes('duplicate key value')) {
        return res.status(409).json({ error: "Account with this email already exists" });
      }
      res.status(400).json({ error: error.message });
    }
  });

  app.get("/api/players/:id", async (req, res) => {
    try {
      const player = await supabaseStorage.getPlayer(parseInt(req.params.id));
      if (!player) {
        return res.status(404).json({ error: "Player not found" });
      }
      res.json(player);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/players/email/:email", async (req, res) => {
    try {
      const player = await supabaseStorage.getPlayerByEmail(req.params.email);
      if (!player) {
        return res.status(404).json({ error: "Player not found" });
      }
      res.json(player);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Player preferences routes
  app.post("/api/player-prefs", async (req, res) => {
    try {
      const prefsData = insertPlayerPrefsSchema.parse(req.body);
      const prefs = await supabaseStorage.createPlayerPrefs(prefsData);
      res.json(prefs);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.get("/api/player-prefs/:playerId", async (req, res) => {
    try {
      const prefs = await supabaseStorage.getPlayerPrefs(parseInt(req.params.playerId));
      if (!prefs) {
        return res.status(404).json({ error: "Player preferences not found" });
      }
      res.json(prefs);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.patch("/api/player-prefs/:playerId", async (req, res) => {
    try {
      const playerId = parseInt(req.params.playerId);
      const updates = req.body;
      const prefs = await supabaseStorage.updatePlayerPrefs(playerId, updates);
      res.json(prefs);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // Tables routes
  app.get("/api/tables", async (req, res) => {
    try {
      const tables = await supabaseStorage.getTables();
      res.json(tables);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Seat requests routes
  app.post("/api/seat-requests", async (req, res) => {
    try {
      const requestData = insertSeatRequestSchema.parse(req.body);
      const request = await supabaseStorage.createSeatRequest(requestData);
      res.json(request);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.get("/api/seat-requests/:playerId", async (req, res) => {
    try {
      const requests = await supabaseStorage.getSeatRequestsByPlayer(parseInt(req.params.playerId));
      res.json(requests);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // KYC documents routes
  app.post("/api/kyc-documents", async (req, res) => {
    try {
      const kycData = insertKycDocumentSchema.parse(req.body);
      const document = await supabaseStorage.createKycDocument(kycData);
      res.json(document);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // Initialize sample data if needed
  app.post("/api/initialize-data", async (req, res) => {
    try {
      await supabaseStorage.initializeSampleData();
      res.json({ success: true, message: "Sample data initialized" });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Test endpoint to verify Supabase connection
  app.get("/api/test-supabase/:playerId", async (req, res) => {
    try {
      const playerId = parseInt(req.params.playerId);
      const supabaseData = await databaseSync.getSupabasePlayerData(playerId);
      res.json({ supabaseData });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
