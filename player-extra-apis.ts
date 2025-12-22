import type { Express, Request, Response } from "express";

/**
 * In-memory storage for demo / local development.
 * Replace with real database integration in production.
 */
interface Feedback {
  id: number;
  playerId: number;
  clubId?: string;
  type: string;
  targetRole: string;
  message: string;
  status: "received" | "in_review" | "resolved" | "rejected";
  createdAt: string;
}

interface KycDocument {
  id: number;
  playerId: number;
  documentType: "government_id" | "utility_bill" | "profile_photo" | "pan_card";
  fileName: string;
  fileSize: number;
  fileData: string; // data URL or storage URL
  status: "uploaded" | "in_review" | "approved" | "rejected";
  createdAt: string;
}

interface NotificationHistoryEntry {
  id: number;
  notificationId: number;
  playerId: number;
  action: string;
  createdAt: string;
}

const feedbackStore: Feedback[] = [];
const kycDocumentsStore: KycDocument[] = [];
const notificationHistoryStore: NotificationHistoryEntry[] = [];

let feedbackIdCounter = 1;
let kycDocumentIdCounter = 1;
let notificationHistoryIdCounter = 1;

function parsePlayerId(raw: unknown): number | null {
  if (typeof raw === "string" && raw.trim() !== "" && !Number.isNaN(Number(raw))) {
    const n = Number(raw);
    return n > 0 ? n : null;
  }
  if (typeof raw === "number" && Number.isFinite(raw) && raw > 0) {
    return raw;
  }
  return null;
}

function sendBadRequest(res: Response, message: string) {
  return res.status(400).json({ error: message });
}

/**
 * Register extra player-portal APIs that are used by the frontend but
 * not covered by the main backend yet.
 *
 * This is written as a pure Express extension so you can plug it into
 * whatever server file currently does:
 *
 *   const app = express();
 *   registerPlayerPortalExtraApis(app);
 */
export function registerPlayerPortalExtraApis(app: Express) {
  /**
   * POST /api/feedback
   * Body: { playerId, message, type?, targetRole?, clubId? }
   *
   * Used by PlayerDashboard feedback form. Routes feedback to club / super admin.
   */
  app.post("/api/feedback", (req: Request, res: Response) => {
    try {
      const { playerId, message, type, targetRole, clubId } = req.body || {};

      const parsedPlayerId = parsePlayerId(playerId);
      if (!parsedPlayerId) {
        return sendBadRequest(res, "playerId is required and must be a positive number");
      }

      if (typeof message !== "string" || message.trim().length === 0) {
        return sendBadRequest(res, "message is required");
      }
      if (message.length > 2000) {
        return sendBadRequest(res, "message is too long (max 2000 characters)");
      }

      const safeType =
        typeof type === "string" && type.trim().length > 0
          ? type.trim()
          : "player_feedback";

      const safeTargetRole =
        typeof targetRole === "string" && targetRole.trim().length > 0
          ? targetRole.trim()
          : "SUPER_ADMIN";

      if (clubId && typeof clubId !== "string") {
        return sendBadRequest(res, "clubId must be a string when provided");
      }

      const now = new Date().toISOString();
      const feedback: Feedback = {
        id: feedbackIdCounter++,
        playerId: parsedPlayerId,
        clubId,
        type: safeType,
        targetRole: safeTargetRole,
        message: message.trim(),
        status: "received",
        createdAt: now,
      };

      feedbackStore.unshift(feedback);

      // In a real implementation you would also:
      // - Persist this to DB
      // - Notify staff / super admin via email / push / chat etc.

      return res.status(201).json({
        success: true,
        feedback,
      });
    } catch (err) {
      console.error("❌ [FEEDBACK] Unexpected error:", err);
      return res
        .status(500)
        .json({ error: "Failed to submit feedback. Please try again." });
    }
  });

  /**
   * GET /api/feedback?playerId=123
   *
   * Used by RecentFeedbackList to show a player's own feedback history.
   */
  app.get("/api/feedback", (req: Request, res: Response) => {
    try {
      const { playerId } = req.query;
      const parsedPlayerId = parsePlayerId(playerId as any);
      if (!parsedPlayerId) {
        return sendBadRequest(res, "playerId query parameter is required");
      }

      const items = feedbackStore
        .filter((f) => f.playerId === parsedPlayerId)
        .slice(0, 50);

      return res.json(items);
    } catch (err) {
      console.error("❌ [FEEDBACK LIST] Unexpected error:", err);
      return res
        .status(500)
        .json({ error: "Failed to load feedback history. Please try again." });
    }
  });

  /**
   * POST /api/documents/upload
   *
   * Body: { playerId, documentType, fileName, fileData, fileSize }
   *
   * This matches the usage in PlayerDashboard where files are sent as
   * base64 data URLs. In production you should switch to stream / multipart
   * upload to object storage.
   */
  app.post("/api/documents/upload", async (req: Request, res: Response) => {
    try {
      const { playerId, documentType, fileName, fileData, fileSize } =
        req.body || {};

      const parsedPlayerId = parsePlayerId(playerId);
      if (!parsedPlayerId) {
        return sendBadRequest(res, "playerId is required and must be a positive number");
      }

      const allowedTypes: KycDocument["documentType"][] = [
        "government_id",
        "utility_bill",
        "profile_photo",
        "pan_card",
      ];

      if (typeof documentType !== "string" || !allowedTypes.includes(documentType)) {
        return sendBadRequest(
          res,
          `documentType must be one of: ${allowedTypes.join(", ")}`
        );
      }

      if (typeof fileName !== "string" || fileName.trim().length === 0) {
        return sendBadRequest(res, "fileName is required");
      }

      if (typeof fileData !== "string" || fileData.trim().length === 0) {
        return sendBadRequest(res, "fileData is required (base64 or URL)");
      }

      const sizeNumber =
        typeof fileSize === "number" && fileSize >= 0 ? fileSize : undefined;

      // 5 MB hard limit (same as frontend)
      const MAX_BYTES = 5 * 1024 * 1024;
      if (sizeNumber !== undefined && sizeNumber > MAX_BYTES) {
        return sendBadRequest(res, "File size must be less than 5MB");
      }

      const now = new Date().toISOString();
      const doc: KycDocument = {
        id: kycDocumentIdCounter++,
        playerId: parsedPlayerId,
        documentType,
        fileName: fileName.trim(),
        fileSize: sizeNumber ?? 0,
        fileData: fileData,
        status: "uploaded",
        createdAt: now,
      };

      kycDocumentsStore.push(doc);

      // In a real implementation you would:
      // - Upload fileData to storage (e.g., S3 / Supabase storage)
      // - Store only the storage URL in DB
      // - Create KYC review task for staff

      return res.status(201).json({
        success: true,
        message: "Document uploaded successfully",
        document: doc,
      });
    } catch (err) {
      console.error("❌ [DOCUMENT UPLOAD] Unexpected error:", err);
      return res.status(500).json({
        error:
          "Failed to upload document. Please check the file and try again.",
      });
    }
  });

  /**
   * GET /api/documents/player/:playerId
   *
   * Returns all documents for the given player. Used by PlayerDashboard
   * to show KYC status and list of submitted docs.
   */
  app.get(
    "/api/documents/player/:playerId",
    (req: Request, res: Response): void => {
      try {
        const { playerId } = req.params;
        const parsedPlayerId = parsePlayerId(playerId);
        if (!parsedPlayerId) {
          res
            .status(400)
            .json({ error: "playerId must be a positive integer path param" });
          return;
        }

        const docs = kycDocumentsStore.filter(
          (d) => d.playerId === parsedPlayerId
        );
        res.json(docs);
      } catch (err) {
        console.error("❌ [DOCUMENT LIST] Unexpected error:", err);
        res.status(500).json({
          error: "Failed to load documents. Please try again.",
        });
      }
    }
  );

  /**
   * GET /api/documents/view/:id
   *
   * For now this returns JSON metadata; in a real deployment you can:
   * - redirect to the storage URL
   * - or stream the file with correct content-type.
   */
  app.get("/api/documents/view/:id", (req: Request, res: Response) => {
    try {
      const idNum = parsePlayerId(req.params.id);
      if (!idNum) {
        return sendBadRequest(res, "id must be a positive integer");
      }

      const doc = kycDocumentsStore.find((d) => d.id === idNum);
      if (!doc) {
        return res.status(404).json({ error: "Document not found" });
      }

      // For safety, do not echo large fileData back here.
      const { fileData: _ignored, ...safe } = doc;

      return res.json({
        ...safe,
        // Indicate that the raw file data exists; client can request download
        hasFileData: true,
      });
    } catch (err) {
      console.error("❌ [DOCUMENT VIEW] Unexpected error:", err);
      return res
        .status(500)
        .json({ error: "Failed to load document. Please try again." });
    }
  });

  /**
   * POST /api/notification-history
   *
   * Body: { notificationId, playerId, action }
   *
   * This endpoint allows the frontend to record when a notification was
   * dismissed / archived to history. For now it only stores a lightweight
   * audit entry.
   */
  app.post("/api/notification-history", (req: Request, res: Response) => {
    try {
      const { notificationId, playerId, action } = req.body || {};

      const parsedNotificationId = parsePlayerId(notificationId);
      if (!parsedNotificationId) {
        return sendBadRequest(
          res,
          "notificationId is required and must be a positive number"
        );
      }

      const parsedPlayerId = parsePlayerId(playerId);
      if (!parsedPlayerId) {
        return sendBadRequest(
          res,
          "playerId is required and must be a positive number"
        );
      }

      if (typeof action !== "string" || action.trim().length === 0) {
        return sendBadRequest(res, "action is required");
      }

      const entry: NotificationHistoryEntry = {
        id: notificationHistoryIdCounter++,
        notificationId: parsedNotificationId,
        playerId: parsedPlayerId,
        action: action.trim(),
        createdAt: new Date().toISOString(),
      };

      notificationHistoryStore.push(entry);

      return res.json({
        success: true,
        entry,
      });
    } catch (err) {
      console.error("❌ [NOTIFICATION HISTORY] Unexpected error:", err);
      return res.status(500).json({
        error: "Failed to save notification history. Please try again.",
      });
    }
  });
}




