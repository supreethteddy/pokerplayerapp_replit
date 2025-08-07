# Poker Room Player Portal

## Overview

This React-based player portal enables users to register, authenticate, manage waitlist entries, and personalize gaming preferences for a poker room application. It features a modern dark-themed UI built with shadcn/ui and integrates seamlessly with Supabase for authentication and a custom backend API for game operations. The portal is designed to work in conjunction with an existing admin dashboard, sharing a unified Supabase database for real-time data synchronization. The vision is to provide a robust, enterprise-grade player experience, preparing the system for integration with authentic poker room management systems and supporting a comprehensive loyalty program.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript, built using Vite 5.
- **Styling**: Tailwind CSS with a dark theme, utilizing shadcn/ui components and Radix UI primitives.
- **State Management**: TanStack Query for server state and custom hooks for local state.
- **Routing**: Wouter for client-side routing.
- **Forms**: React Hook Form with Zod validation.
- **UI/UX Decisions**: Incorporates a clean, minimalist design for signup, a professional dark theme with Tilt branding for login, and a responsive layout optimized for mobile devices. It features a horizontal tab layout for navigation and a visually engaging offer carousel. VIP Club sections use a golden theme.

### Backend Architecture
- **Framework**: Express.js with TypeScript.
- **Database**: Supabase PostgreSQL serves as the unified database for both player and staff portals, acting as the single source of truth.
- **Storage**: Direct Supabase integration for all data operations, including KYC documents and chat messages.
- **API Design**: RESTful endpoints for managing players, tables, preferences, KYC, waitlists, VIP points, and chat.
- **Data Sync**: Achieved through direct Supabase integration, ensuring real-time bidirectional synchronization across all connected portals (Player, Staff, Admin, Cashier, Manager, Master Admin).

### Authentication Strategy
- **Primary**: Supabase Auth for user authentication and session management.
- **Integration**: Shares the same Supabase instance with admin dashboards for unified user management and consistent player identification (Supabase `auth.users.id` and application `players.id`).
- **Clerk Ready**: Hybrid authentication system prepared with clerk_user_id field in database. Requires valid Clerk API keys to activate enhanced Google sign-in and phone authentication features.

### Recent Achievements (August 7, 2025) - SIMPLIFIED BALANCE SYSTEM COMPLETE ✅  
- **🔐 AUTHENTICATION FIXED**: Resolved "Loading your dashboard" spinner - authentication now works seamlessly
- **💰 SIMPLIFIED BALANCE SYSTEM**: Replaced three-tier complexity with simple cash balance display
- **🎯 PLAYER PORTAL OPERATIONAL**: Player ID 29 (Vignesh Gana) successfully authenticates with ₹77,000 balance
- **📱 REAL-TIME FEATURES ACTIVE**: Chat, notifications, table interactions all functioning
- **🏆 BIDIRECTIONAL MESSAGING**: Player Portal ↔ Staff Portal communication maintained
- **🚀 PUSHER INTEGRATION**: Multi-channel real-time delivery confirmed working
- **💾 PRODUCTION DATA**: Using authentic Supabase database with real player data
- **🔧 MANAGER-ONLY TABLE OPERATIONS**: Table buy-ins/cash-outs handled exclusively by managers
- **⚡ CLEAN BALANCE DISPLAY**: Players see only available cash balance (table operations hidden)
- **✅ CASHIER WORKFLOW**: Simple flow - deposit with cashier → play at tables → cash out with cashier

### Key Features
- **Authentication**: Secure login/signup with KYC document upload. Features branded loading screens and robust error handling.
- **Player Dashboard**: Displays real-time cash table and tournament information, allows joining/leaving waitlists with seat selection, shows simple cash balance (table operations managed by staff), and enables profile management including PAN card verification and transaction history.
- **KYC Document Management**: Comprehensive system for uploading, viewing, and managing KYC documents (government ID, utility bill, profile photo) with cross-portal status synchronization and file type validation.
- **Waitlist Management**: Unified waitlist system with interactive seat selection, real-time updates, and integration with staff-managed table assignments.
- **Offer System**: Dynamic display of offers via a scrollable carousel, managed by staff with analytics tracking.
- **VIP Club Loyalty Program**: Calculates VIP points based on game activity, with a dedicated VIP Shop for redemption of rewards.
- **Guest Relations (GRE) Chat**: Enterprise-ready real-time bidirectional chat system with complete workflow management (Accept→Activate→Resolve), comprehensive audit logging, advanced status transition tracking, and production-grade Staff Portal integration endpoints. Features unified ID mapping, enterprise-grade debug logging, comprehensive field transformation handling both camelCase/snake_case formats, and god-level diagnostic capabilities. Includes complete workflow automation with fail-safe backend operations, comprehensive audit trail (`chat_events` table), and expert-level troubleshooting infrastructure. **STATUS: 🏆 ENTERPRISE COMPLETE - FULLY OPERATIONAL** - All 8 enterprise checklist items successfully implemented and verified August 2, 2025 at 12:42 PM. Complete workflow tested: Request ID `6d89dfdd-28ba-4e44-9187-518eab242896` (waiting→in_progress→resolved) with full audit trail and session management.
- **Tournament System**: Displays tournaments from the Staff Portal, allowing players to express interest or register.
- **Offline Poker Game Mode**: Configured to show only staff-added players for local, offline poker room operations.

### Data Models
- **Players**: Core user information including KYC status, PAN card details, and VIP points.
- **Player Preferences**: User-specific settings.
- **Tables**: Live game information, including seated players and stakes.
- **Waitlist**: Manages player requests for tables, including seat preferences.
- **KYC Documents**: Stores identity verification documents.
- **staff_offers, carousel_items, offer_views**: Manages the dynamic offers system.
- **gre_chat_sessions, gre_chat_messages, chat_requests, chat_events**: Complete enterprise GRE system with workflow management, audit logging, and status transitions.
- **push_notifications**: Advanced notification system with media support.
- **Unified ID System**: All core tables include `universal_id` columns for seamless cross-portal player identification.

## External Dependencies

### Core Services
- **Supabase**: Primary backend for authentication, database (PostgreSQL), and file storage (kyc-documents bucket).
- **Drizzle ORM**: Used for type-safe database operations and migrations.

### UI and Styling
- **shadcn/ui**: Pre-built accessible UI components.
- **Tailwind CSS**: Utility-first CSS framework for styling, including dark theme.
- **Radix UI**: Unstyled, accessible UI primitives.
- **Lucide React**: Icon library.

### Development Tools
- **Vite**: Fast development server and build tool.
- **TypeScript**: Ensures type safety across the application.
- **ESBuild**: Used for fast TypeScript compilation.