# Player Portal API Integration - Complete

## 🎉 Integration Complete

All player portal APIs from the `poker-crm-backend` have been successfully integrated into the player app.

## 📁 Files Created

### API Services (`client/src/lib/api/`)

1. **config.ts** - API configuration, endpoints, and helper functions
2. **base.ts** - Base API service class with error handling
3. **auth.service.ts** - Player authentication (login, signup, profile, password)
4. **balance.service.ts** - Balance and transaction management
5. **waitlist.service.ts** - Waitlist operations (join, status, cancel)
6. **tables.service.ts** - Table viewing and details
7. **credit.service.ts** - Credit request management
8. **stats.service.ts** - Player statistics and analytics
9. **fnb.service.ts** - Food & Beverage menu and orders
10. **index.ts** - Central exports for all services

### React Hooks (`client/src/hooks/`)

11. **usePlayerAPI.ts** - React Query hooks for all API operations

### Documentation

12. **client/src/lib/api/README.md** - Comprehensive API documentation

## 🚀 Quick Start

### 1. Configure Backend URL

Create or update your `.env` file:

```env
VITE_API_BASE_URL=http://localhost:3000/api
```

### 2. Start Backend Server

Make sure your NestJS backend is running:

```bash
cd poker-crm-backend
npm run start:dev
```

### 3. Use in Components

#### Option A: Using React Hooks (Recommended)

```typescript
import { 
  usePlayerLogin, 
  usePlayerBalance, 
  useAvailableTables 
} from '@/hooks/usePlayerAPI';

function MyComponent() {
  const loginMutation = usePlayerLogin();
  const { data: balance, isLoading } = usePlayerBalance();
  const { data: tables } = useAvailableTables();
  
  const handleLogin = async () => {
    await loginMutation.mutateAsync({
      clubCode: 'ABC123',
      email: 'player@example.com',
      password: 'password123',
    });
  };
  
  return (
    <div>
      <button onClick={handleLogin}>Login</button>
      {isLoading ? 'Loading...' : `Balance: $${balance?.balance}`}
    </div>
  );
}
```

#### Option B: Using Services Directly

```typescript
import { api } from '@/lib/api';

async function loginPlayer() {
  const response = await api.auth.login({
    clubCode: 'ABC123',
    email: 'player@example.com',
    password: 'password123',
  });
  
  if (response.success) {
    const balance = await api.balance.getBalance();
    console.log('Balance:', balance.balance);
  }
}
```

## 📚 Available APIs

### Authentication APIs
- ✅ Player Login (`POST /auth/player/login`)
- ✅ Player Signup (`POST /auth/player/signup`)
- ✅ Get Profile (`GET /auth/player/me`)
- ✅ Update Profile (`PUT /auth/player/profile`)
- ✅ Change Password (`POST /auth/player/change-password`)

### Balance & Transaction APIs
- ✅ Get Balance (`GET /auth/player/balance`)
- ✅ Get Transactions (`GET /auth/player/transactions`)
- ✅ Transaction filtering and analytics

### Waitlist APIs
- ✅ Join Waitlist (`POST /auth/player/waitlist`)
- ✅ Get Waitlist Status (`GET /auth/player/waitlist`)
- ✅ Cancel Waitlist (`DELETE /auth/player/waitlist/:entryId`)

### Table APIs
- ✅ Get Available Tables (`GET /auth/player/tables`)
- ✅ Get Table Details (`GET /auth/player/tables/:tableId`)

### Credit Request APIs
- ✅ Request Credit (`POST /auth/player/credit-request`)

### Player Stats APIs
- ✅ Get Player Stats (`GET /auth/player/stats`)
- ✅ Game statistics
- ✅ Session statistics
- ✅ Financial statistics
- ✅ Performance metrics
- ✅ Rankings and achievements

### Food & Beverage APIs
- ✅ Get Menu (`GET /clubs/:clubId/fnb/menu`)
- ✅ Create Order (`POST /clubs/:clubId/fnb/orders`)
- ✅ Get Orders (`GET /clubs/:clubId/fnb/orders`)
- ✅ Update Order (`PUT /clubs/:clubId/fnb/orders/:orderId`)
- ✅ Cancel Order

## 🎯 React Hooks Summary

### Query Hooks (Data Fetching)
```typescript
usePlayerProfile()           // Player profile with auto-refresh
usePlayerBalance()           // Balance (refreshes every 60s)
usePlayerTransactions()      // Transaction history
useWaitlistStatus()          // Waitlist status (refreshes every 30s)
useAvailableTables()         // Available tables (refreshes every 60s)
useTableDetails(tableId)     // Specific table details
usePlayerStats()             // Player statistics
useFNBMenu()                 // F&B menu
useFNBOrders()               // F&B orders
```

### Mutation Hooks (Actions)
```typescript
usePlayerLogin()             // Login with toast notifications
usePlayerSignup()            // Signup with toast notifications
useUpdatePlayerProfile()     // Update profile
useChangePlayerPassword()    // Change password
useJoinWaitlist()            // Join waitlist
useCancelWaitlist()          // Cancel waitlist entry
useRequestCredit()           // Request credit
useCreateFNBOrder()          // Create F&B order
useUpdateFNBOrder()          // Update F&B order
useCancelFNBOrder()          // Cancel F&B order
```

## 🔐 Authentication Flow

### Login/Signup
1. Player submits credentials via `usePlayerLogin()` or `usePlayerSignup()`
2. Backend validates and returns player data
3. Services automatically store:
   - Player ID
   - Club ID
   - Club Code
   - Player Token (if provided)
   - Player Data

### Authenticated Requests
All subsequent API calls automatically include:
- `x-player-id` header
- `x-club-id` header

### Logout
Call `api.auth.logout()` to clear all stored data

## 🎨 Features

### ✅ Type Safety
- All services and hooks are fully typed with TypeScript
- Auto-completion in your IDE
- Compile-time error checking

### ✅ Error Handling
- Structured `APIError` class
- Automatic toast notifications on mutations
- Detailed error messages

### ✅ Caching & Performance
- React Query automatic caching
- Smart refetch intervals
- Optimistic updates

### ✅ Developer Experience
- Clean, intuitive API
- Comprehensive documentation
- Easy to extend

## 📝 Example Component Integration

### Balance Display Component

```typescript
import { usePlayerBalance } from '@/hooks/usePlayerAPI';

export function BalanceDisplay() {
  const { data: balance, isLoading, error } = usePlayerBalance();
  
  if (isLoading) return <div>Loading balance...</div>;
  if (error) return <div>Error loading balance</div>;
  
  return (
    <div className="p-4 bg-white rounded-lg shadow">
      <h3 className="text-lg font-semibold">Current Balance</h3>
      <p className="text-3xl font-bold text-green-600">
        ${balance?.balance.toFixed(2)}
      </p>
      {balance?.creditLimit && (
        <p className="text-sm text-gray-600">
          Credit Limit: ${balance.creditLimit.toFixed(2)}
        </p>
      )}
    </div>
  );
}
```

### Waitlist Component

```typescript
import { useWaitlistStatus, useJoinWaitlist, useCancelWaitlist } from '@/hooks/usePlayerAPI';

export function WaitlistComponent() {
  const { data: status } = useWaitlistStatus();
  const joinMutation = useJoinWaitlist();
  const cancelMutation = useCancelWaitlist();
  
  const handleJoin = () => {
    joinMutation.mutate({ partySize: 1 });
  };
  
  const handleCancel = (entryId: string) => {
    cancelMutation.mutate(entryId);
  };
  
  return (
    <div>
      {status?.currentEntry ? (
        <div>
          <p>Position: {status.currentEntry.position}</p>
          <button onClick={() => handleCancel(status.currentEntry!.id)}>
            Cancel Waitlist
          </button>
        </div>
      ) : (
        <button onClick={handleJoin}>Join Waitlist</button>
      )}
    </div>
  );
}
```

### F&B Order Component

```typescript
import { useFNBMenu, useCreateFNBOrder } from '@/hooks/usePlayerAPI';

export function FNBOrderComponent() {
  const { data: menu } = useFNBMenu();
  const createOrderMutation = useCreateFNBOrder();
  
  const handleOrder = (menuItemId: string, quantity: number) => {
    createOrderMutation.mutate({
      items: [{ menuItemId, quantity }],
    });
  };
  
  return (
    <div>
      {menu?.items.map((item) => (
        <div key={item.id}>
          <h4>{item.name}</h4>
          <p>${item.price}</p>
          <button onClick={() => handleOrder(item.id, 1)}>
            Order
          </button>
        </div>
      ))}
    </div>
  );
}
```

## 🔧 Configuration

### Environment Variables

```env
# Required
VITE_API_BASE_URL=http://localhost:3000/api

# Optional (for production)
VITE_API_BASE_URL=https://api.yourpokerclub.com/api
```

### Storage Keys

The following data is stored in localStorage:
- `playerId` - Player ID
- `clubId` - Club ID
- `clubCode` - Club code
- `playerToken` - Authentication token
- `playerData` - Full player data object

## 🚦 Next Steps

### For Existing Components

Update your existing components to use the new API services:

1. **AuthWrapper.tsx** - Update to use `usePlayerLogin()` and `usePlayerSignup()`
2. **PlayerBalanceDisplay.tsx** - Update to use `usePlayerBalance()`
3. **PlayerTransactionHistory.tsx** - Update to use `usePlayerTransactions()`
4. **TableView.tsx** - Update to use `useAvailableTables()`
5. **CreditRequestCard.tsx** - Update to use `useRequestCredit()`
6. **FoodBeverageTab.tsx** - Update to use `useFNBMenu()` and `useCreateFNBOrder()`

### Testing

1. Start the backend:
   ```bash
   cd poker-crm-backend
   npm run start:dev
   ```

2. Start the frontend:
   ```bash
   cd pokerplayerapp_replit
   npm run dev
   ```

3. Test authentication flow
4. Test balance and transactions
5. Test waitlist operations
6. Test F&B orders

## 📖 Documentation

For detailed API documentation, see:
- `client/src/lib/api/README.md` - Complete API reference
- Each service file has inline documentation
- All TypeScript types are documented

## ✅ Integration Checklist

- [x] Base API service with error handling
- [x] Authentication APIs (login, signup, profile, password)
- [x] Balance and transaction APIs
- [x] Waitlist APIs (join, status, cancel)
- [x] Table APIs (list, details)
- [x] Credit request APIs
- [x] Player stats APIs
- [x] Food & Beverage APIs
- [x] React Query hooks for all operations
- [x] TypeScript types for all data structures
- [x] Error handling and toast notifications
- [x] Automatic authentication headers
- [x] Caching and auto-refresh
- [x] Comprehensive documentation

## 🎊 Summary

All player portal APIs from the `poker-crm-backend` have been successfully integrated into the player app. The integration includes:

- **10 API service files** with comprehensive functionality
- **1 React hooks file** with 20+ hooks for easy integration
- **Full TypeScript support** with complete type definitions
- **Automatic error handling** with user-friendly notifications
- **Smart caching** with React Query
- **Complete documentation** with examples

You can now use these APIs throughout your player portal application with a clean, type-safe, and developer-friendly interface!

---

**Created:** December 12, 2025  
**Status:** ✅ Complete  
**Backend:** poker-crm-backend (NestJS)  
**Frontend:** pokerplayerapp_replit (React + Vite)











