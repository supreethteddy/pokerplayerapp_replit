# Poker Room Player Portal

## Overview

This is a React-based player portal for a poker room application that allows players to register, authenticate, join table waitlists, and manage their gaming preferences. The application features a modern dark theme UI built with shadcn/ui components and integrates with both Supabase for authentication and a custom backend API for game-related operations.

This player portal is designed to work alongside an existing admin dashboard, sharing the same Supabase database and authentication system for seamless integration and real-time data synchronization.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript
- **Build Tool**: Vite 5 for fast development and optimized builds
- **Styling**: Tailwind CSS with dark theme implementation
- **UI Components**: shadcn/ui component library with Radix UI primitives
- **State Management**: TanStack Query for server state and custom hooks for local state
- **Routing**: Wouter for lightweight client-side routing
- **Forms**: React Hook Form with Zod validation

### Backend Architecture
- **Framework**: Express.js with TypeScript
- **Database**: PostgreSQL with Drizzle ORM (fully migrated from in-memory storage)
- **Storage**: Database-backed persistence with sample data initialization
- **API Design**: RESTful endpoints for player management, table operations, and preferences

### Authentication Strategy
- **Primary**: Supabase Auth for user authentication and session management
- **Secondary**: Custom player data storage for game-specific information
- **Flow**: Supabase handles auth → Custom API manages player profiles and game data
- **Integration**: Shares same Supabase instance with admin dashboard for unified user management

## Key Components

### Authentication System
- **AuthLayout**: Handles login/signup with KYC document upload
- **useAuth Hook**: Manages authentication state and user data
- **Signup Cooldown**: Rate limiting with 60-second cooldown
- **KYC Integration**: Document upload for identity verification

### Player Dashboard
- **Live Tables**: Real-time table information with 5-second refresh
- **Wait List Management**: Join/leave table wait lists with position tracking
- **Preferences**: Toggle notifications and game settings
- **Profile Management**: Display player information and KYC status

### Data Models
- **Players**: Core user information with KYC status tracking
- **Player Preferences**: Notification and game settings
- **Tables**: Live game information with player counts and stakes
- **Seat Requests**: Wait list management with position tracking
- **KYC Documents**: Identity verification document storage

## Data Flow

1. **User Registration**: Supabase Auth → Custom API creates player profile → Default preferences created
2. **Authentication**: Supabase session → Fetch player data from custom API
3. **Table Operations**: Real-time table data fetching → Join wait list → Position updates
4. **Preferences**: Local UI changes → API updates → Query cache invalidation

## External Dependencies

### Core Services
- **Supabase**: Authentication, user management, and session handling
- **PostgreSQL**: Database hosting for application data with full persistence
- **Drizzle ORM**: Type-safe database operations and migrations

### UI and Styling
- **shadcn/ui**: Pre-built accessible components
- **Tailwind CSS**: Utility-first CSS framework with dark theme
- **Radix UI**: Unstyled, accessible UI primitives
- **Lucide React**: Icon library for consistent iconography

### Development Tools
- **Vite**: Fast development server and build tool
- **TypeScript**: Type safety across the entire application
- **ESBuild**: Fast TypeScript compilation for production

## Deployment Strategy

### Build Process
- **Frontend**: Vite builds React app to `dist/public`
- **Backend**: ESBuild compiles TypeScript server to `dist/index.js`
- **Database**: Drizzle migrations applied via `drizzle-kit push`

### Environment Configuration
- **Development**: Local development with hot reload via Vite
- **Production**: Single Node.js process serving both API and static files
- **Database**: PostgreSQL connection via `DATABASE_URL` environment variable

### Key Scripts
- `npm run dev`: Start development server with hot reload
- `npm run build`: Build both frontend and backend for production
- `npm run start`: Start production server
- `npm run db:push`: Apply database schema changes

The application follows a monorepo structure with shared TypeScript types and schemas, enabling type safety between frontend and backend while maintaining clear separation of concerns.

## Admin Dashboard Integration

### Shared Database Strategy
- **Single Supabase Instance**: Both admin and player portals use the same Supabase project
- **Unified Data Models**: Shared schema ensures consistency across both applications
- **Real-time Sync**: Changes in admin dashboard (table management, player approvals) reflect instantly in player portal
- **Cross-Application Features**: Admin can manage player KYC approvals, table assignments, and preferences

### Integration Benefits
- **Centralized User Management**: Single authentication system for all users
- **Consistent Data**: No data duplication or synchronization issues
- **Real-time Updates**: Live table data, seat requests, and player status updates
- **Unified Reporting**: Combined analytics and reporting across both dashboards

### Deployment Considerations
- **Environment Variables**: Same Supabase credentials used across both applications
- **API Endpoints**: Shared backend APIs can serve both admin and player interfaces
- **Database Migrations**: Schema changes apply to both applications simultaneously