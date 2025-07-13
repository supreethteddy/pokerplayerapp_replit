import type { Express } from "express";
import { createServer, type Server } from "http";
import { dbStorage } from "./database";
import { insertPlayerSchema, insertPlayerPrefsSchema, insertSeatRequestSchema, insertKycDocumentSchema } from "@shared/schema";
import { z } from "zod";

export async function registerRoutes(app: Express): Promise<Server> {
  // Player routes
  app.post("/api/players", async (req, res) => {
    try {
      const playerData = insertPlayerSchema.parse(req.body);
      const player = await dbStorage.createPlayer(playerData);
      res.json(player);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.get("/api/players/:id", async (req, res) => {
    try {
      const player = await dbStorage.getPlayer(parseInt(req.params.id));
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
      const prefs = await dbStorage.createPlayerPrefs(prefsData);
      res.json(prefs);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.get("/api/player-prefs/:playerId", async (req, res) => {
    try {
      const prefs = await dbStorage.getPlayerPrefs(parseInt(req.params.playerId));
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
      const prefs = await dbStorage.updatePlayerPrefs(playerId, updates);
      res.json(prefs);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // Tables routes
  app.get("/api/tables", async (req, res) => {
    try {
      const tables = await dbStorage.getTables();
      res.json(tables);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Seat requests routes
  app.post("/api/seat-requests", async (req, res) => {
    try {
      const requestData = insertSeatRequestSchema.parse(req.body);
      const request = await dbStorage.createSeatRequest(requestData);
      res.json(request);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.get("/api/seat-requests/:playerId", async (req, res) => {
    try {
      const requests = await dbStorage.getSeatRequestsByPlayer(parseInt(req.params.playerId));
      res.json(requests);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // KYC documents routes
  app.post("/api/kyc-documents", async (req, res) => {
    try {
      const kycData = insertKycDocumentSchema.parse(req.body);
      const document = await dbStorage.createKycDocument(kycData);
      res.json(document);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
