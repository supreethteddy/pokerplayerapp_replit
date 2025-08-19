# Poker Room Player Portal

## Overview

This React-based player portal facilitates user registration, authentication, waitlist management, and personalized gaming preferences for a poker room application. It features a modern dark-themed UI and integrates with Supabase for authentication and a custom backend API for game operations. The portal shares a unified Supabase database with an existing admin dashboard, ensuring real-time data synchronization. The project delivers a robust, enterprise-grade player experience with authentic poker room management systems integration and comprehensive loyalty program support.

**Current Status**: All systems fully operational with surgically-fixed authentication gates enforcing EMAIL VERIFICATION → KYC UPLOAD → STAFF APPROVAL sequence. Backend signup/signin endpoints now properly enforce all security checkpoints with integrated email verification system.

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
- **Primary**: Supabase Auth for user authentication and session management, integrated with admin dashboards for unified user management.
- **Enterprise Security**: Clerk integration provides an invisible enterprise-grade security layer with audit logging, webhooks, and cross-portal synchronization for comprehensive player tracking.
- **Multi-Layer Security**: Email verification (Supabase) + KYC staff approval required before portal access. Users receive clear messages: "Please verify your email" and "Staff has not approved your account yet."
- **Crisis Resolution (Jan 2025)**: Implemented bulletproof cross-functionality system with deletion protection, automatic data repair, and zero-data-loss architecture preventing Clerk-Supabase cascade failures.
- **Authentication Gates Fixed (Aug 2025)**: Surgically repaired signup flow architectural flaws that were bypassing KYC verification. Backend endpoints now enforce proper sequence: Email Verification → KYC Upload → Staff Approval. Email verification system fully operational with automatic sending and token validation.

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