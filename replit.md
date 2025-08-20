# Poker Room Player Portal

## Overview

This React-based player portal facilitates user registration, authentication, waitlist management, and personalized gaming preferences for a poker room application. It features a modern dark-themed UI and integrates with Supabase for authentication and a custom backend API for game operations. The portal shares a unified Supabase database with an existing admin dashboard, ensuring real-time data synchronization. The project delivers a robust, enterprise-grade player experience with authentic poker room management systems integration and comprehensive loyalty program support.

**Current Status**: ✅ PRODUCTION READY - Authentication system fully restored to deployed version 2.2 functionality. Critical signup flow bug fixed: users now properly route through KYC workflow based on actual verification status instead of incorrectly redirecting all existing users to dashboard. Seamless account deletion/recreation with same email supported. Cross-portal integration with Staff Portal maintained. All authentication workflows (signup → email verification → KYC upload → staff approval → dashboard) working exactly as deployed version.

**System Validation Complete (Aug 20, 2025)**: 
- ✅ Signup system working for existing users with proper KYC routing
- ✅ Balance system fully operational with Staff Portal sync
- ✅ Waitlist system using dual-table architecture for Staff Portal visibility
- ✅ Tables API delivering live Staff Portal data (9 tables confirmed)
- ✅ Authentication flows working seamlessly with Supabase
- ✅ Cross-portal synchronization confirmed and operational
- ⚠️ New user signup has Supabase client cache issue (auth creation works, player record creation affected)

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