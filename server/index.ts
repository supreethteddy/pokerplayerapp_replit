import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import Pusher from 'pusher';

// Single Pusher instance for entire application
export const pusher = new Pusher({
  appId: process.env.PUSHER_APP_ID!,
  key: process.env.PUSHER_KEY!,
  secret: process.env.PUSHER_SECRET!,
  cluster: process.env.PUSHER_CLUSTER!,
  useTLS: true
});

console.log('🚀 [PUSHER] Single instance initialized for cross-portal communication');

// Single OneSignal client for push notifications
let oneSignalClient: any = null;

async function initializeOneSignal() {
  try {
    if (process.env.ONESIGNAL_APP_ID && process.env.ONESIGNAL_REST_API_KEY) {
      const OneSignal = await import('onesignal-node');
      if (OneSignal.default && OneSignal.default.Client) {
        oneSignalClient = new OneSignal.default.Client(
          process.env.ONESIGNAL_APP_ID,
          process.env.ONESIGNAL_REST_API_KEY
        );
        console.log('📱 [ONESIGNAL] Successfully initialized');
      } else {
        console.warn('⚠️ [ONESIGNAL] Client class not available in onesignal-node module');
      }
    } else {
      console.log('📱 [ONESIGNAL] Skipping initialization - missing environment variables');
    }
  } catch (error) {
    console.warn('⚠️ [ONESIGNAL] Failed to initialize OneSignal:', (error as Error).message);
  }
}

export { oneSignalClient };

console.log('📱 [ONESIGNAL] Single instance initialized for push notifications');

async function initializeApp() {
  // Initialize OneSignal first
  await initializeOneSignal();
  
  const app = express();
  // Increase payload limits for file uploads (10MB limit)
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: false, limit: '10mb' }));

  app.use((req, res, next) => {
    const start = Date.now();
    const path = req.path;
    let capturedJsonResponse: Record<string, any> | undefined = undefined;

    const originalResJson = res.json;
    res.json = function (bodyJson, ...args) {
      capturedJsonResponse = bodyJson;
      return originalResJson.apply(res, [bodyJson, ...args]);
    };

    res.on("finish", () => {
      const duration = Date.now() - start;
      if (path.startsWith("/api")) {
        let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
        if (capturedJsonResponse) {
          logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
        }

        if (logLine.length > 80) {
          logLine = logLine.slice(0, 79) + "…";
        }

        log(logLine);
      }
    });

    next();
  });

  // Initialize Supabase connection - no mock data in production
  const { supabaseStorage } = await import("./supabase-storage");
  await supabaseStorage.initializeSampleData();

  const server = await registerRoutes(app);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
    throw err;
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // ALWAYS serve the app on port 5000
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = 5000;
  server.listen({
    port,
    host: "0.0.0.0",
    reusePort: true,
  }, () => {
    log(`serving on port ${port}`);
  });
}

// Initialize the application
initializeApp().catch(console.error);