// Poker Room Player Portal Server with Pusher/OneSignal Integration
import express from 'express';
import { registerRoutes } from './routes';
import { serveStatic, setupVite } from './vite';
import { createServer } from 'http';

const app = express();
const PORT = process.env.PORT || 5000;
const server = createServer(app);

console.log('🚀 Starting Poker Room Player Portal Server...');

// Parse JSON bodies
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Register API routes
registerRoutes(app);

// Setup Vite in development or serve static files in production
if (process.env.NODE_ENV === 'production') {
  serveStatic(app);
} else {
  setupVite(app, server);
}

// Start the server
server.listen(Number(PORT), '0.0.0.0', () => {
  console.log(`✅ Server running on http://0.0.0.0:${PORT}`);
  console.log('🔌 Pusher Channels integration active');
  console.log('🔔 OneSignal push notifications enabled');
  console.log('💬 Real-time chat system ready');
});

// Handle graceful shutdown
process.on('SIGTERM', () => {
  console.log('🛑 SIGTERM received, shutting down gracefully...');
  server.close(() => {
    console.log('✅ Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('🛑 SIGINT received, shutting down gracefully...');
  server.close(() => {
    console.log('✅ Server closed');
    process.exit(0);
  });
});

export default app;