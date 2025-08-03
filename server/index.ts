// Poker Room Player Portal Server with Pusher/OneSignal Integration
import express from 'express';
import { registerRoutes } from './routes';
import { serve } from './vite';

const app = express();
const PORT = process.env.PORT || 5000;

console.log('🚀 Starting Poker Room Player Portal Server...');

// Register API routes
registerRoutes(app);

// Serve the frontend in production
app.use(serve);

// Start the server
const server = app.listen(PORT, '0.0.0.0', () => {
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