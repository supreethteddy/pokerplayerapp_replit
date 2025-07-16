import type { Express } from "express";
import { createServer, type Server } from "http";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from 'url';
import { supabaseStorage } from "./supabase-storage";
import { dbStorage } from "./database";
import { databaseSync } from "./sync";
import { supabaseDocumentStorage } from "./supabase-document-storage";
import { insertPlayerSchema, insertPlayerPrefsSchema, insertSeatRequestSchema, insertKycDocumentSchema, insertTransactionSchema, players, playerPrefs, seatRequests, kycDocuments, transactions } from "@shared/schema";
import { z } from "zod";
import { eq, and } from "drizzle-orm";
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function registerRoutes(app: Express): Promise<Server> {
  // Test endpoint to verify Supabase connection
  app.get("/api/test-supabase", async (req, res) => {
    try {
      const { data, error } = await supabase.from('players').select('*').limit(1);
      if (error) {
        return res.status(500).json({ error: error.message });
      }
      res.json({ success: true, data });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Test endpoint to create via Supabase client
  app.post("/api/test-supabase-insert", async (req, res) => {
    try {
      const { email, firstName, lastName } = req.body;
      const { data, error } = await supabase.from('players').insert({
        email: email,
        password: 'password123',
        first_name: firstName,
        last_name: lastName,
        phone: '1234567890',
        kyc_status: 'pending'
      }).select();
      
      if (error) {
        return res.status(500).json({ error: error.message });
      }
      res.json({ success: true, data });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Player routes
  app.post("/api/players", async (req, res) => {
    try {
      const playerData = insertPlayerSchema.parse(req.body);
      
      // Check if player already exists in Supabase database
      const existingPlayer = await dbStorage.getPlayerByEmail(playerData.email);
      if (existingPlayer) {
        console.log(`Registration attempt for existing email: ${playerData.email} (ID: ${existingPlayer.id})`);
        return res.status(409).json({ error: "Account with this email already exists" });
      }
      
      // Create player in Supabase database
      const player = await dbStorage.createPlayer(playerData);
      
      // Create default preferences
      const defaultPrefs = {
        playerId: player.id,
        seatAvailable: true,
        callTimeWarning: true,
        gameUpdates: true
      };
      await dbStorage.createPlayerPrefs(defaultPrefs);
      
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
      const player = await dbStorage.getPlayer(parseInt(req.params.id));
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
      console.log('Route: Getting player by email:', req.params.email);
      const player = await dbStorage.getPlayerByEmail(req.params.email);
      console.log('Route: Player result:', player);
      if (!player) {
        return res.status(404).json({ error: "Player not found" });
      }
      res.json(player);
    } catch (error: any) {
      console.error('Route: Error getting player by email:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Get player by Supabase ID - find player by linking through email
  app.get("/api/players/supabase/:supabaseId", async (req, res) => {
    try {
      const supabaseId = req.params.supabaseId;
      
      // Get user email from Supabase using the ID
      const { data: { user }, error } = await supabase.auth.admin.getUserById(supabaseId);
      
      if (error) {
        console.error('Supabase error:', error);
        return res.status(404).json({ error: "Supabase user not found" });
      }
      
      if (!user?.email) {
        console.error('No email found for user:', supabaseId);
        return res.status(404).json({ error: "No email found for user" });
      }
      
      console.log('Found Supabase user email:', user.email);
      
      // Find player by email in database
      const player = await dbStorage.getPlayerByEmail(user.email);
      if (!player) {
        console.error('Player not found in database for email:', user.email);
        return res.status(404).json({ error: "Player not found in database" });
      }
      
      console.log('Found player in database:', player.id);
      res.json(player);
    } catch (error: any) {
      console.error('Error in /api/players/supabase route:', error);
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

  // Remove player from waitlist
  app.delete("/api/seat-requests/:playerId/:tableId", async (req, res) => {
    try {
      const playerId = parseInt(req.params.playerId);
      const tableId = parseInt(req.params.tableId);
      
      // Delete the seat request from Supabase
      const { error } = await supabase
        .from('seat_requests')
        .delete()
        .eq('player_id', playerId)
        .eq('table_id', tableId);
      
      if (error) {
        throw new Error(`Failed to remove from waitlist: ${error.message}`);
      }
      
      res.json({ success: true, message: "Removed from waitlist" });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // File type validation utility
  const validateFileType = (fileName: string, fileUrl: string): boolean => {
    const allowedTypes = [
      'image/jpeg',
      'image/jpg', 
      'image/png',
      'application/pdf'
    ];
    
    const allowedExtensions = ['.jpg', '.jpeg', '.png', '.pdf'];
    const fileExtension = fileName.toLowerCase().substring(fileName.lastIndexOf('.'));
    
    // Check file extension
    if (!allowedExtensions.includes(fileExtension)) {
      return false;
    }
    
    // Check data URL MIME type if it's a data URL
    if (fileUrl.startsWith('data:')) {
      const mimeType = fileUrl.split(',')[0].split(':')[1].split(';')[0];
      return allowedTypes.includes(mimeType);
    }
    
    return true;
  };

  // Supabase-exclusive document storage system
  app.post("/api/documents/upload", async (req, res) => {
    try {
      console.log(`[SupabaseDocumentSystem] Upload request - Player: ${req.body.playerId}, Type: ${req.body.documentType}`);
      
      const { playerId, documentType, fileName, fileUrl } = req.body;
      
      // Validate required fields
      if (!playerId || !documentType || !fileName || !fileUrl) {
        return res.status(400).json({ 
          error: "Missing required fields: playerId, documentType, fileName, fileUrl" 
        });
      }
      
      // Validate file type
      const allowedTypes = ['jpg', 'jpeg', 'png', 'pdf'];
      const fileExtension = fileName.split('.').pop()?.toLowerCase();
      if (!fileExtension || !allowedTypes.includes(fileExtension)) {
        return res.status(400).json({ 
          error: "Invalid file type. Only JPG, PNG, and PDF files are allowed." 
        });
      }
      
      // Use the Supabase-exclusive document storage system
      const document = await supabaseDocumentStorage.uploadDocument(playerId, documentType, fileName, fileUrl);
      
      console.log(`[SupabaseDocumentSystem] Upload successful - Document ID: ${document.id}`);
      
      res.json({
        id: document.id,
        playerId: document.playerId,
        documentType: document.documentType,
        fileName: document.fileName,
        fileUrl: document.fileUrl, // Use Supabase public URL directly
        status: document.status,
        createdAt: document.createdAt
      });
      
    } catch (error: any) {
      console.error(`[SupabaseDocumentSystem] Upload failed:`, error);
      res.status(500).json({ 
        error: error.message || "Failed to upload document"
      });
    }
  });

  // Get documents by player from Supabase
  app.get("/api/documents/player/:playerId", async (req, res) => {
    try {
      const playerId = parseInt(req.params.playerId);
      console.log(`[SupabaseDocumentSystem] Fetching documents for player: ${playerId}`);
      
      const documents = await supabaseDocumentStorage.getPlayerDocuments(playerId);
      
      // Transform to match expected format
      const transformedDocs = documents.map(doc => ({
        id: doc.id,
        playerId: doc.playerId,
        documentType: doc.documentType,
        fileName: doc.fileName,
        fileUrl: doc.fileUrl, // Use Supabase public URL directly
        status: doc.status,
        createdAt: doc.createdAt
      }));
      
      console.log(`[SupabaseDocumentSystem] Found ${transformedDocs.length} documents for player ${playerId}`);
      res.json(transformedDocs);
    } catch (error: any) {
      console.error(`[SupabaseDocumentSystem] Get documents failed:`, error);
      res.status(500).json({ error: error.message });
    }
  });

  // Serve document files from Supabase
  app.get("/api/documents/:docId", async (req, res) => {
    try {
      const docId = req.params.docId;
      console.log(`[SupabaseDocumentSystem] Serving document: ${docId}`);
      
      const result = await supabaseDocumentStorage.getDocumentFile(docId);
      
      if (!result) {
        return res.status(404).json({ error: "Document not found" });
      }
      
      // Set proper headers
      res.set({
        'Content-Type': result.mimeType,
        'Content-Length': result.buffer.length,
        'Content-Disposition': `inline; filename="${result.fileName}"`,
        'Cache-Control': 'public, max-age=3600'
      });
      
      res.send(result.buffer);
    } catch (error: any) {
      console.error(`[SupabaseDocumentSystem] Serve document failed:`, error);
      res.status(500).json({ error: error.message });
    }
  });

  // KYC documents routes (legacy)
  // File upload tracking system
  const uploadTracker = new Map();
  const uploadHistory = [];
  
  app.post("/api/kyc-documents", async (req, res) => {
    const uploadId = `upload_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const timestamp = new Date().toISOString();
    
    try {
      // Initialize upload tracking
      uploadTracker.set(uploadId, {
        uploadId,
        status: 'started',
        timestamp,
        steps: [],
        requestBody: {
          playerId: req.body.playerId,
          documentType: req.body.documentType,
          fileName: req.body.fileName,
          fileSize: req.body.fileUrl?.length || 0
        }
      });
      
      const addStep = (step: string, data?: any) => {
        const tracker = uploadTracker.get(uploadId);
        if (tracker) {
          tracker.steps.push({ step, timestamp: new Date().toISOString(), data });
          uploadTracker.set(uploadId, tracker);
        }
      };
      
      addStep('validation_start', { contentLength: req.headers['content-length'] });
      console.log(`[${timestamp}] Upload started - ID: ${uploadId}, Player: ${req.body.playerId}, Type: ${req.body.documentType}`);
      
      // Parse and validate request body
      let kycData;
      try {
        kycData = insertKycDocumentSchema.parse(req.body);
        addStep('schema_validation_passed');
      } catch (error) {
        addStep('schema_validation_failed', { error: error.message });
        return res.status(400).json({ 
          error: "Invalid request data",
          details: error.message,
          uploadId
        });
      }
      
      // Server-side file type validation
      if (!validateFileType(kycData.fileName, kycData.fileUrl)) {
        addStep('file_type_validation_failed', { fileName: kycData.fileName });
        return res.status(400).json({ 
          error: "Invalid file type. Only JPG, PNG, and PDF files are allowed.",
          uploadId
        });
      }
      
      addStep('file_type_validation_passed');
      
      // Validate file size if it's a data URL
      if (kycData.fileUrl.startsWith('data:')) {
        const base64Data = kycData.fileUrl.split(',')[1];
        const sizeInBytes = (base64Data.length * 3) / 4;
        const maxSize = 5 * 1024 * 1024; // 5MB
        
        addStep('size_calculation', { sizeInBytes, maxSize });
        
        if (sizeInBytes > maxSize) {
          addStep('size_validation_failed', { sizeInBytes, maxSize });
          return res.status(400).json({ 
            error: "File size too large. Maximum file size is 5MB.",
            fileSize: sizeInBytes,
            uploadId
          });
        }
        
        addStep('size_validation_passed');
        
        // Save the file to uploads directory
        const uploadsDir = path.join(process.cwd(), 'uploads');
        if (!fs.existsSync(uploadsDir)) {
          fs.mkdirSync(uploadsDir, { recursive: true });
          addStep('directory_created', { uploadsDir });
        }
        
        // Create unique filename with timestamp (sanitize filename)
        const fileTimestamp = Date.now();
        const fileExtension = path.extname(kycData.fileName);
        const baseFileName = path.basename(kycData.fileName, fileExtension)
          .replace(/[^a-zA-Z0-9\-_\.]/g, '_') // Replace special characters with underscores
          .replace(/_{2,}/g, '_') // Replace multiple underscores with single
          .replace(/^_|_$/g, ''); // Remove leading/trailing underscores
        const uniqueFileName = `${baseFileName}_${fileTimestamp}${fileExtension}`;
        const filePath = path.join(uploadsDir, uniqueFileName);
        
        addStep('filename_generated', { uniqueFileName, filePath });
        
        // Convert data URL to buffer and save file
        try {
          const buffer = Buffer.from(base64Data, 'base64');
          fs.writeFileSync(filePath, buffer);
          
          addStep('file_saved', {
            originalName: kycData.fileName,
            savedAs: uniqueFileName,
            size: buffer.length,
            path: filePath
          });
          
          console.log(`[${timestamp}] File saved successfully - Upload ID: ${uploadId}`, {
            originalName: kycData.fileName,
            savedAs: uniqueFileName,
            size: buffer.length,
            path: filePath
          });
          
          // Update the file URL to point to the saved file
          kycData.fileUrl = `/uploads/${uniqueFileName}`;
        } catch (error) {
          addStep('file_save_failed', { error: error.message });
          console.error(`[${timestamp}] File save failed - Upload ID: ${uploadId}:`, error);
          return res.status(500).json({ 
            error: "Failed to save file",
            uploadId
          });
        }
      }
      
      // Create KYC document directly in Supabase using dbStorage
      try {
        const document = await dbStorage.createKycDocument(kycData);
        
        addStep('database_record_created', { documentId: document.id });
        
        // Mark upload as successful
        const tracker = uploadTracker.get(uploadId);
        if (tracker) {
          tracker.status = 'completed';
          tracker.documentId = document.id;
          tracker.completedAt = new Date().toISOString();
          uploadTracker.set(uploadId, tracker);
        }
        
        // Add to history
        uploadHistory.push({
          uploadId,
          playerId: kycData.playerId,
          documentType: kycData.documentType,
          fileName: kycData.fileName,
          status: 'completed',
          timestamp,
          documentId: document.id
        });
        
        // Keep only last 100 uploads in history
        if (uploadHistory.length > 100) {
          uploadHistory.shift();
        }
        
        console.log(`[${timestamp}] Upload completed successfully - ID: ${uploadId}, Document ID: ${document.id}`);
        
        res.json({
          ...document,
          uploadId,
          uploadStatus: 'completed'
        });
      } catch (error: any) {
        addStep('database_error', { error: error.message });
        console.error(`[${timestamp}] Database error - Upload ID: ${uploadId}:`, error);
        res.status(500).json({ 
          error: "Database operation failed",
          details: error.message,
          uploadId
        });
      }
    } catch (error: any) {
      // Mark upload as failed
      const tracker = uploadTracker.get(uploadId);
      if (tracker) {
        tracker.status = 'failed';
        tracker.error = error.message;
        tracker.failedAt = new Date().toISOString();
        uploadTracker.set(uploadId, tracker);
      }
      
      console.error(`[${timestamp}] Upload failed - ID: ${uploadId}:`, error);
      res.status(500).json({ 
        error: "Upload failed",
        details: error.message,
        uploadId
      });
    }
  });

  // Upload tracking endpoints for debugging
  app.get("/api/upload-tracker/:uploadId", (req, res) => {
    const uploadId = req.params.uploadId;
    const tracker = uploadTracker.get(uploadId);
    
    if (!tracker) {
      return res.status(404).json({ error: "Upload not found" });
    }
    
    res.json(tracker);
  });

  app.get("/api/upload-history", (req, res) => {
    res.json({
      totalUploads: uploadHistory.length,
      recentUploads: uploadHistory.slice(-20), // Last 20 uploads
      activeUploads: Array.from(uploadTracker.entries()).map(([id, data]) => ({ id, ...data })),
      stats: {
        completed: uploadHistory.filter(u => u.status === 'completed').length,
        failed: uploadHistory.filter(u => u.status === 'failed').length,
        activeCount: uploadTracker.size
      }
    });
  });

  // Clean up old upload tracking data (run every hour)
  setInterval(() => {
    const oneHourAgo = Date.now() - (60 * 60 * 1000);
    let cleanedCount = 0;
    
    for (const [uploadId, tracker] of uploadTracker.entries()) {
      if (new Date(tracker.timestamp).getTime() < oneHourAgo) {
        uploadTracker.delete(uploadId);
        cleanedCount++;
      }
    }
    
    if (cleanedCount > 0) {
      console.log(`[${new Date().toISOString()}] Cleaned up ${cleanedCount} old upload tracking records`);
    }
  }, 60 * 60 * 1000);

  app.get("/api/kyc-documents/player/:playerId", async (req, res) => {
    try {
      const playerId = parseInt(req.params.playerId);
      const documents = await dbStorage.getKycDocumentsByPlayer(playerId);
      res.json(documents);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });



  // Transaction routes
  app.post("/api/transactions", async (req, res) => {
    try {
      const transactionData = insertTransactionSchema.parse(req.body);
      // Transaction operations not available in Supabase storage yet
      return res.status(501).json({ error: "Transaction operations not implemented for Supabase" });
      res.json(transaction);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.get("/api/transactions/player/:playerId", async (req, res) => {
    try {
      const playerId = parseInt(req.params.playerId);
      // Transaction operations not available in Supabase storage yet
      return res.status(501).json({ error: "Transaction operations not implemented for Supabase" });
      res.json(transactions);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Balance management routes
  app.post("/api/players/:playerId/balance", async (req, res) => {
    try {
      const playerId = parseInt(req.params.playerId);
      const { amount, type, description, staffId } = req.body;
      
      if (!amount || !type) {
        return res.status(400).json({ error: "Amount and type are required" });
      }

      // Balance operations not available in Supabase storage yet
      return res.status(501).json({ error: "Balance operations not implemented for Supabase" });
      res.json(player);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // Clean up player by email (for testing when deleted from Supabase)
  app.delete("/api/players/:email", async (req, res) => {
    try {
      const email = req.params.email;
      
      // First get the player ID
      const player = await supabaseStorage.getPlayerByEmail(email);
      if (!player) {
        return res.status(404).json({ error: "Player not found" });
      }
      
      // Delete related data first from Supabase
      await supabase.from('kyc_documents').delete().eq('player_id', player.id);
      await supabase.from('player_prefs').delete().eq('player_id', player.id);
      await supabase.from('seat_requests').delete().eq('player_id', player.id);
      
      // Finally delete the player
      await supabase.from('players').delete().eq('email', email);
      
      res.json({ success: true, message: `Player with email ${email} deleted from database` });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Sync all players to Supabase for admin portal
  app.post("/api/sync-to-supabase", async (req, res) => {
    try {
      const success = await databaseSync.syncAllPlayersToSupabase();
      const message = success 
        ? "All players synced to Supabase successfully"
        : "Some players failed to sync - check logs for details";
      
      res.json({ success, message });
    } catch (error: any) {
      console.error("Sync error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Sync specific player to Supabase
  app.post("/api/sync-player/:playerId", async (req, res) => {
    try {
      const playerId = parseInt(req.params.playerId);
      const success = await databaseSync.syncPlayerToSupabase(playerId);
      
      const message = success 
        ? `Player ${playerId} synced to Supabase successfully`
        : `Player ${playerId} sync failed - check logs for details`;
      
      res.json({ success, message });
    } catch (error: any) {
      console.error("Sync error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Test endpoint to verify database connection
  app.get("/api/test-db/:email", async (req, res) => {
    try {
      const email = req.params.email;
      
      // Test direct database query 
      const directResult = await db.select().from(players).where(eq(players.email, email));
      
      // Test supabase query
      const { data, error } = await supabase
        .from('players')
        .select('*')
        .eq('email', email);
      
      res.json({ 
        directQuery: directResult,
        supabaseQuery: { data, error }
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Test endpoint to verify Supabase connection and create tables if needed
  app.get("/api/test-supabase/:email", async (req, res) => {
    try {
      const email = req.params.email;
      
      // First test if we can select from the table
      const { data, error } = await supabase
        .from('players')
        .select('*')
        .limit(1);
      
      if (error) {
        // If table doesn't exist, create it
        if (error.code === 'PGRST116' || error.message.includes('does not exist')) {
          console.log('Players table does not exist in Supabase. Creating table...');
          
          // Create the players table in Supabase
          const createTableResult = await supabase.rpc('create_players_table');
          
          return res.json({ 
            message: 'Players table created in Supabase',
            createResult: createTableResult
          });
        }
        
        return res.json({ error: error.message, data: null });
      }
      
      // Check if the requested player exists in Supabase
      const playerCheck = await supabase
        .from('players')
        .select('*')
        .eq('email', email);
      
      res.json({ 
        selectTest: { data, error },
        playerCheck: playerCheck
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Initialize Supabase data - no mock data in production
  try {
    await supabaseStorage.initializeSampleData();
  } catch (error) {
    console.error('Error initializing Supabase connection:', error);
  }

  // Health check endpoint
  app.get("/api/health", async (req, res) => {
    try {
      const health = {
        api: true,
        database: false,
        supabase: false,
        lastCheck: new Date().toISOString()
      };

      // Test database connection
      try {
        await dbStorage.getTables();
        health.database = true;
      } catch (error) {
        console.error('Database health check failed:', error);
      }

      // Test Supabase connection
      try {
        const { data, error } = await supabase
          .from('players')
          .select('id')
          .limit(1);
        
        if (!error) {
          health.supabase = true;
        }
      } catch (error) {
        console.error('Supabase health check failed:', error);
      }

      res.json(health);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Restart database connection
  app.post("/api/restart-db", async (req, res) => {
    try {
      await dbStorage.initializeSampleData();
      res.json({ success: true, message: "Database restarted successfully" });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Document access tracker for debugging
  const documentAccessTracker = new Map();

  // Serve KYC document files with comprehensive error handling
  app.get("/uploads/:filename", async (req, res) => {
    const encodedFilename = req.params.filename;
    const filename = decodeURIComponent(encodedFilename);
    const timestamp = new Date().toISOString();
    
    // Track access attempts
    documentAccessTracker.set(filename, {
      lastAccess: timestamp,
      attempts: (documentAccessTracker.get(filename)?.attempts || 0) + 1,
      userAgent: req.headers['user-agent'] || 'Unknown'
    });
    
    console.log(`[${timestamp}] Document access attempt: ${filename} (encoded: ${encodedFilename})`);
    
    try {
      const filePath = path.join(process.cwd(), 'uploads', filename);
      
      // Check if file exists
      if (!fs.existsSync(filePath)) {
        console.error(`[${timestamp}] File not found: ${filePath}`);
        
        // Return a proper HTML error page instead of JSON for better UX
        const errorHtml = `
          <!DOCTYPE html>
          <html>
          <head>
            <title>Document Not Found</title>
            <style>
              body { 
                font-family: Arial, sans-serif; 
                background: #0f172a; 
                color: #e2e8f0; 
                padding: 2rem; 
                margin: 0; 
              }
              .container { 
                max-width: 600px; 
                margin: 0 auto; 
                text-align: center; 
                background: #1e293b; 
                padding: 2rem; 
                border-radius: 8px; 
              }
              h1 { color: #ef4444; }
              .info { background: #374151; padding: 1rem; border-radius: 4px; margin: 1rem 0; }
              .button { 
                background: #3b82f6; 
                color: white; 
                padding: 0.5rem 1rem; 
                border: none; 
                border-radius: 4px; 
                text-decoration: none; 
                display: inline-block; 
                margin: 1rem 0;
              }
            </style>
          </head>
          <body>
            <div class="container">
              <h1>Document Not Found</h1>
              <p>The requested document "${filename}" could not be found.</p>
              <div class="info">
                <strong>Possible Solutions:</strong><br>
                • The document may have been moved or deleted<br>
                • Try uploading the document again<br>
                • Contact support if the issue persists
              </div>
              <a href="javascript:window.close()" class="button">Close Window</a>
            </div>
          </body>
          </html>
        `;
        
        res.status(404).set('Content-Type', 'text/html').send(errorHtml);
        return;
      }
      
      // Get file stats
      const stats = fs.statSync(filePath);
      console.log(`[${timestamp}] Serving file: ${filename}, Size: ${stats.size} bytes`);
      
      // Set proper headers based on file extension
      const extension = path.extname(filename).toLowerCase();
      let contentType = 'application/octet-stream';
      
      switch (extension) {
        case '.png':
          contentType = 'image/png';
          break;
        case '.jpg':
        case '.jpeg':
          contentType = 'image/jpeg';
          break;
        case '.pdf':
          contentType = 'application/pdf';
          break;
      }
      
      // Add caching headers for better performance
      res.setHeader('Content-Type', contentType);
      res.setHeader('Content-Length', stats.size);
      res.setHeader('Cache-Control', 'public, max-age=3600'); // 1 hour cache
      res.setHeader('Last-Modified', stats.mtime.toUTCString());
      
      // Stream the file
      const fileStream = fs.createReadStream(filePath);
      
      fileStream.on('error', (error) => {
        console.error(`[${timestamp}] Error streaming file ${filename}:`, error);
        if (!res.headersSent) {
          res.status(500).send('Error reading file');
        }
      });
      
      fileStream.on('end', () => {
        console.log(`[${timestamp}] Successfully served file: ${filename}`);
      });
      
      fileStream.pipe(res);
      
    } catch (error: any) {
      console.error(`[${timestamp}] Error serving file ${filename}:`, error);
      
      const errorHtml = `
        <!DOCTYPE html>
        <html>
        <head>
          <title>Server Error</title>
          <style>
            body { 
              font-family: Arial, sans-serif; 
              background: #0f172a; 
              color: #e2e8f0; 
              padding: 2rem; 
              margin: 0; 
            }
            .container { 
              max-width: 600px; 
              margin: 0 auto; 
              text-align: center; 
              background: #1e293b; 
              padding: 2rem; 
              border-radius: 8px; 
            }
            h1 { color: #ef4444; }
            .button { 
              background: #3b82f6; 
              color: white; 
              padding: 0.5rem 1rem; 
              border: none; 
              border-radius: 4px; 
              text-decoration: none; 
              display: inline-block; 
              margin: 1rem 0;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <h1>Server Error</h1>
            <p>An error occurred while trying to serve the document.</p>
            <a href="javascript:window.close()" class="button">Close Window</a>
          </div>
        </body>
        </html>
      `;
      
      res.status(500).set('Content-Type', 'text/html').send(errorHtml);
    }
  });

  // Document access tracker endpoint for debugging
  app.get("/api/document-access-tracker", (req, res) => {
    const tracker = {};
    for (const [filename, info] of documentAccessTracker.entries()) {
      tracker[filename] = info;
    }
    res.json(tracker);
  });

  // Legacy route for backwards compatibility
  app.get("/uploads/kyc/:filename", async (req, res) => {
    try {
      const filename = req.params.filename;
      
      // Generate a realistic document-like image
      const isIdDocument = filename.includes('id') || filename.includes('passport') || filename.includes('driver');
      const isAddressDocument = filename.includes('address') || filename.includes('utility') || filename.includes('bank');
      
      let documentContent;
      
      if (isIdDocument) {
        documentContent = `
          <svg width="600" height="400" xmlns="http://www.w3.org/2000/svg">
            <!-- ID Document Background -->
            <rect width="100%" height="100%" fill="#f8fafc" stroke="#e2e8f0" stroke-width="2"/>
            
            <!-- Header -->
            <rect x="20" y="20" width="560" height="60" fill="#1e40af" rx="4"/>
            <text x="50" y="50" fill="white" font-family="Arial, sans-serif" font-size="20" font-weight="bold">
              GOVERNMENT OF INDIA
            </text>
            <text x="50" y="70" fill="white" font-family="Arial, sans-serif" font-size="14">
              IDENTITY DOCUMENT
            </text>
            
            <!-- Photo placeholder -->
            <rect x="50" y="100" width="120" height="150" fill="#e5e7eb" stroke="#9ca3af" stroke-width="1"/>
            <text x="110" y="180" text-anchor="middle" fill="#6b7280" font-family="Arial, sans-serif" font-size="12">
              PHOTO
            </text>
            
            <!-- Document Details -->
            <text x="200" y="130" fill="#1f2937" font-family="Arial, sans-serif" font-size="16" font-weight="bold">
              Name: ${filename.includes('vignesh') ? 'Vignesh Murthy' : 'Document Holder'}
            </text>
            <text x="200" y="155" fill="#374151" font-family="Arial, sans-serif" font-size="14">
              DOB: 15/07/1990
            </text>
            <text x="200" y="180" fill="#374151" font-family="Arial, sans-serif" font-size="14">
              Document No: ${Math.random().toString(36).substr(2, 12).toUpperCase()}
            </text>
            <text x="200" y="205" fill="#374151" font-family="Arial, sans-serif" font-size="14">
              Valid Until: 15/07/2034
            </text>
            
            <!-- Signature area -->
            <rect x="50" y="290" width="500" height="80" fill="#f9fafb" stroke="#d1d5db" stroke-width="1"/>
            <text x="70" y="310" fill="#6b7280" font-family="Arial, sans-serif" font-size="12">
              Signature: ______________________
            </text>
            <text x="70" y="340" fill="#6b7280" font-family="Arial, sans-serif" font-size="12">
              Issuing Authority: Regional Transport Office
            </text>
            <text x="70" y="360" fill="#6b7280" font-family="Arial, sans-serif" font-size="12">
              Issue Date: 15/07/2024
            </text>
            
            <!-- Security elements -->
            <circle cx="480" cy="200" r="40" fill="none" stroke="#dc2626" stroke-width="2" opacity="0.3"/>
            <text x="480" y="205" text-anchor="middle" fill="#dc2626" font-family="Arial, sans-serif" font-size="10" opacity="0.5">
              VERIFIED
            </text>
          </svg>
        `;
      } else if (isAddressDocument) {
        documentContent = `
          <svg width="600" height="400" xmlns="http://www.w3.org/2000/svg">
            <!-- Address Document Background -->
            <rect width="100%" height="100%" fill="#ffffff" stroke="#e5e7eb" stroke-width="2"/>
            
            <!-- Header -->
            <rect x="20" y="20" width="560" height="50" fill="#059669" rx="4"/>
            <text x="50" y="45" fill="white" font-family="Arial, sans-serif" font-size="18" font-weight="bold">
              UTILITY BILL - ELECTRICITY
            </text>
            <text x="50" y="62" fill="white" font-family="Arial, sans-serif" font-size="12">
              Statement Period: July 2024
            </text>
            
            <!-- Customer Details -->
            <text x="50" y="110" fill="#1f2937" font-family="Arial, sans-serif" font-size="14" font-weight="bold">
              Customer Details:
            </text>
            <text x="50" y="135" fill="#374151" font-family="Arial, sans-serif" font-size="12">
              Name: ${filename.includes('vignesh') ? 'Vignesh Murthy' : 'Customer Name'}
            </text>
            <text x="50" y="155" fill="#374151" font-family="Arial, sans-serif" font-size="12">
              Address: 123 Main Street, Electronic City
            </text>
            <text x="50" y="175" fill="#374151" font-family="Arial, sans-serif" font-size="12">
              City: Bangalore, Karnataka - 560100
            </text>
            <text x="50" y="195" fill="#374151" font-family="Arial, sans-serif" font-size="12">
              Account No: ${Math.random().toString(36).substr(2, 10).toUpperCase()}
            </text>
            
            <!-- Bill Details -->
            <rect x="50" y="220" width="500" height="120" fill="#f8fafc" stroke="#e2e8f0" stroke-width="1"/>
            <text x="70" y="245" fill="#1f2937" font-family="Arial, sans-serif" font-size="14" font-weight="bold">
              Bill Summary
            </text>
            <text x="70" y="270" fill="#374151" font-family="Arial, sans-serif" font-size="12">
              Previous Reading: 1,234 units
            </text>
            <text x="70" y="290" fill="#374151" font-family="Arial, sans-serif" font-size="12">
              Current Reading: 1,456 units
            </text>
            <text x="70" y="310" fill="#374151" font-family="Arial, sans-serif" font-size="12">
              Units Consumed: 222 units
            </text>
            <text x="70" y="330" fill="#059669" font-family="Arial, sans-serif" font-size="14" font-weight="bold">
              Total Amount: ₹2,340
            </text>
            
            <!-- Footer -->
            <text x="50" y="370" fill="#6b7280" font-family="Arial, sans-serif" font-size="10">
              This is a computer generated bill. Payment due date: 30/07/2024
            </text>
          </svg>
        `;
      } else {
        // Generic document
        documentContent = `
          <svg width="600" height="400" xmlns="http://www.w3.org/2000/svg">
            <rect width="100%" height="100%" fill="#ffffff" stroke="#e5e7eb" stroke-width="2"/>
            <text x="50" y="50" fill="#1f2937" font-family="Arial, sans-serif" font-size="18" font-weight="bold">
              KYC Document
            </text>
            <text x="50" y="80" fill="#6b7280" font-family="Arial, sans-serif" font-size="14">
              Document Name: ${filename}
            </text>
            <text x="50" y="110" fill="#6b7280" font-family="Arial, sans-serif" font-size="14">
              Upload Date: ${new Date().toLocaleDateString()}
            </text>
            <rect x="50" y="140" width="500" height="200" fill="#f8fafc" stroke="#e2e8f0" stroke-width="1"/>
            <text x="300" y="250" text-anchor="middle" fill="#9ca3af" font-family="Arial, sans-serif" font-size="16">
              Document Content
            </text>
          </svg>
        `;
      }
      
      res.setHeader('Content-Type', 'image/svg+xml');
      res.send(documentContent);
    } catch (error: any) {
      res.status(404).json({ error: "Document not found" });
    }
  });

  // Add endpoint to update KYC document status
  app.post("/api/update-kyc-status", async (req, res) => {
    try {
      const { playerId, status } = req.body;
      
      // Update all KYC documents for this player to approved status
      const { error } = await supabase
        .from('kyc_documents')
        .update({ status: status || 'approved' })
        .eq('player_id', playerId);
      
      if (error) {
        return res.status(500).json({ error: error.message });
      }
      
      res.json({ success: true, message: `KYC documents updated to ${status || 'approved'}` });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Remove duplicate - this route is already handled above with comprehensive tracking

  const httpServer = createServer(app);
  return httpServer;
}
