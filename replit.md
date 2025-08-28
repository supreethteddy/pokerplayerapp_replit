# Poker Room Player Portal

## Overview

This React-based player portal facilitates user registration, authentication, waitlist management, and personalized gaming preferences for a poker room application. It features a modern dark-themed UI and integrates with Supabase for authentication and a custom backend API for game operations. The portal shares a unified Supabase database with an existing admin dashboard, ensuring real-time data synchronization. The project delivers a robust, enterprise-grade player experience with authentic poker room management systems integration and comprehensive loyalty program support.

**Current Status**: ✅ PRODUCTION READY - ENHANCED TRIPLE AUTHENTICATION COMPLETE (Aug 28, 2025). Successfully implemented comprehensive triple authentication system with Clerk + Supabase + PostgreSQL backend. **MAJOR ENHANCEMENT**: Complete signup/login/KYC flow with text-based player codes (POKERPLAYR-0001 format), enhanced schema validation, and full transaction-based document management. Authentication flow perfected: signup → player code generation → KYC upload (3 documents) → status progression → login with timestamp tracking.

**Enhanced Triple Authentication Complete (Aug 28, 2025)**:
- ✅ **CLERK INTEGRATION**: User creation with unique IDs (user_31ux4PH1mHl5VoFB4OsquEElPkA)
- ✅ **SUPABASE CONNECTION**: Database authentication resolved with proper credentials
- ✅ **POSTGRESQL BACKEND**: Direct PostgreSQL insertions with transaction safety
- ✅ **PLAYER CODES**: Text-based identifiers in POKERPLAYR-XXXX format (auto-generated)
- ✅ **ENHANCED SCHEMA**: Added full_name, nickname, credit_eligible, updated_at columns
- ✅ **KYC WORKFLOW**: 3-document requirement (government_id, address_proof, pan_card)
- ✅ **PAN VALIDATION**: Regex format checking (^[A-Z]{5}[0-9]{4}[A-Z]$)
- ✅ **STATUS PROGRESSION**: pending → submitted → approved/rejected
- ✅ **LOGIN TRACKING**: last_login_at timestamp updates on each login
- ✅ **TRANSACTION SAFETY**: All database operations wrapped in try-catch with cleanup

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript (Vite 5).
- **Styling**: Tailwind CSS with a dark theme, utilizing shadcn/ui components and Radix UI primitives.
- **State Management**: TanStack Query for server state; custom hooks for local state.
- **Routing**: Wouter for client-side routing.
- **Forms**: React Hook Form with Zod validation.
- **UI/UX Decisions**: Clean, minimalist design for signup; professional dark theme with specific branding for login; responsive layout optimized for mobile; horizontal tab navigation; visually engaging offer carousel; golden theme for VIP Club sections.

### Backend Architecture
- **Framework**: Express.js with TypeScript.
- **Database**: Supabase PostgreSQL as the unified database and single source of truth across all portals.
- **Storage**: Direct Supabase integration for all data operations (including KYC documents and chat messages).
- **API Design**: RESTful endpoints for managing players, tables, preferences, KYC, waitlists, VIP points, and chat.
- **Data Sync**: Real-time bidirectional synchronization across all connected portals via direct Supabase integration.

### Authentication Strategy
- **Double Authentication Security (Aug 2025)**: Successfully implemented Clerk-Supabase integrated system for maximum security across portals. Both authentication systems work together seamlessly with proper data synchronization.
- **Primary Layer**: Supabase Auth handles all player authentication with enhanced security tracking and email verification workflows.
- **Secondary Layer**: Clerk integration provides enterprise-grade audit logging, webhooks, and cross-portal synchronization for comprehensive Staff Portal integration.
- **Enhanced Database Schema**: Players table includes `supabase_id` and `clerk_user_id` linkage columns ensuring proper synchronization between systems.
- **Cross-Portal Sync**: Real-time bidirectional synchronization via `server/clerk-supabase-sync.ts` enabling seamless Staff Portal and Player Portal integration.
- **Security Compliance**: Complete audit trail with login tracking, sync operation logging, and authentication event monitoring for enterprise-grade security.
- **KYC Workflow Logic (FIXED Aug 2025)**: Proper verification status checking - only users with `kyc_status='approved'` AND `email_verified=true` bypass KYC workflow. All others route through appropriate verification steps (email → documents → approval).

### Key Features
- **Authentication**: Secure login/signup with KYC document upload, branded loading screens, and robust error handling.
- **Email Verification System**: Complete email verification workflow with token generation, secure links, and database integration. Supports both automated and manual verification processes.
- **Interactive Thank You Page**: Fully customizable branding system with logo upload, color customization, message personalization, and real-time preview capabilities. Includes export/import functionality for branding configurations.
- **Player Dashboard**: Displays real-time cash table and tournament information, allows waitlist management (join/leave, seat selection), shows simple cash balance (table operations managed by staff), and enables profile management including PAN card verification and transaction history.
- **KYC Document Management**: Comprehensive system for uploading, viewing, and managing KYC documents (government ID, utility bill, profile photo) with cross-portal status synchronization and file type validation.
- **Waitlist Management**: Bulletproof nanosecond synchronization system with dual-table architecture (seat_requests + waitlist) ensuring instant staff portal visibility and real-time Pusher notifications.
- **Offer System**: Dynamic, staff-managed offer carousel with analytics tracking.
- **VIP Club Loyalty Program**: Calculates VIP points based on game activity, with a dedicated VIP Shop for rewards redemption.
- **Guest Relations (GRE) Chat**: Enterprise-ready real-time bidirectional chat system with complete workflow management (Accept→Activate→Resolve), audit logging, and status transition tracking. Features unified ID mapping and comprehensive field transformation.
- **Tournament System**: Displays tournaments from the Staff Portal, allowing players to express interest or register.
- **Offline Poker Game Mode**: Configured to show only staff-added players for local operations.

### Data Models
- **Players**: Core user information including KYC status, PAN card details, and VIP points.
- **Player Preferences**: User-specific settings.
- **Tables**: Live game information.
- **Waitlist**: Manages player requests for tables.
- **KYC Documents**: Stores identity verification documents.
- **Offers**: Manages dynamic offers.
- **GRE Chat**: Comprehensive chat system with sessions, messages, requests, and events.
- **Push Notifications**: Advanced notification system.
- **Unified ID System**: Core tables include `universal_id` for cross-portal player identification.

## External Dependencies

### Core Services
- **Supabase**: Primary backend for authentication, PostgreSQL database, and file storage.
- **Drizzle ORM**: Used for type-safe database operations and migrations.

### UI and Styling
- **shadcn/ui**: Pre-built accessible UI components.
- **Tailwind CSS**: Utility-first CSS framework for styling.
- **Radix UI**: Unstyled, accessible UI primitives.
- **Lucide React**: Icon library.

### Development Tools
- **Vite**: Fast development server and build tool.
- **TypeScript**: Ensures type safety.
- **ESBuild**: Used for fast TypeScript compilation.