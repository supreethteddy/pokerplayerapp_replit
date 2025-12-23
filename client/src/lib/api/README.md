# Player Portal API Integration

This directory contains all API services for the Player Portal, integrated with the `poker-crm-backend` NestJS API.

## Structure

```
lib/api/
├── config.ts           # API configuration and endpoints
├── base.ts             # Base API service with error handling
├── auth.service.ts     # Player authentication (login, signup, profile)
├── balance.service.ts  # Balance and transaction management
├── waitlist.service.ts # Waitlist operations
├── tables.service.ts   # Table viewing and details
├── credit.service.ts   # Credit request management
├── stats.service.ts    # Player statistics and analytics
├── fnb.service.ts      # Food & Beverage orders
└── index.ts            # Central exports
```

## Usage

### Using Service Instances Directly

```typescript
import { api } from '@/lib/api';

// Login
const response = await api.auth.login({
  clubCode: 'ABC123',
  email: 'player@example.com',
  password: 'password123',
});

// Get balance
const balance = await api.balance.getBalance();

// Join waitlist
const entry = await api.waitlist.joinWaitlist({
  tableType: 'cash',
  partySize: 1,
});
```

### Using React Hooks (Recommended)

```typescript
import { 
  usePlayerLogin,
  usePlayerBalance,
  useJoinWaitlist,
} from '@/hooks/usePlayerAPI';

function MyComponent() {
  // Mutations
  const loginMutation = usePlayerLogin();
  const joinWaitlistMutation = useJoinWaitlist();
  
  // Queries
  const { data: balance, isLoading } = usePlayerBalance();
  
  const handleLogin = async () => {
    await loginMutation.mutateAsync({
      clubCode: 'ABC123',
      email: 'player@example.com',
      password: 'password123',
    });
  };
  
  return (
    <div>
      {isLoading ? 'Loading...' : `Balance: $${balance?.balance}`}
    </div>
  );
}
```

## Available Services

### Authentication Service (`api.auth`)

- `login(credentials)` - Player login
- `signup(signupData)` - Player signup
- `getProfile()` - Get player profile
- `updateProfile(profileData)` - Update player profile
- `changePassword(passwordData)` - Change password
- `logout()` - Logout player
- `isLoggedIn()` - Check if logged in
- `getStoredPlayerData()` - Get stored player data

### Balance Service (`api.balance`)

- `getBalance()` - Get current balance
- `getTransactions(limit, offset)` - Get transaction history
- `getTransactionsByType(type, limit, offset)` - Filter by type
- `getTransactionsByDateRange(start, end)` - Filter by date
- `getTotalEarnings()` - Calculate total earnings
- `getTotalDeposits()` - Calculate total deposits
- `getRecentTransactions()` - Get last 10 transactions

### Waitlist Service (`api.waitlist`)

- `joinWaitlist(data)` - Join waitlist
- `getWaitlistStatus()` - Get waitlist status
- `cancelWaitlist(entryId)` - Cancel waitlist entry
- `isOnWaitlist()` - Check if on waitlist
- `getCurrentPosition()` - Get position in queue
- `getEstimatedWaitTime()` - Get estimated wait time

### Tables Service (`api.tables`)

- `getAvailableTables()` - Get all available tables
- `getTableDetails(tableId)` - Get specific table details
- `getTablesByType(type)` - Filter by table type
- `getTablesByStatus(status)` - Filter by status
- `getTablesWithAvailableSeats(minSeats)` - Find available tables
- `getTableByNumber(number)` - Find table by number
- `hasAvailableSeats(tableId)` - Check seat availability
- `getTableOccupancyRate(tableId)` - Get occupancy percentage

### Credit Request Service (`api.credit`)

- `requestCredit(data)` - Request credit
- `getCreditRequests()` - Get all credit requests
- `getPendingCreditRequests()` - Get pending requests
- `hasPendingCreditRequest()` - Check for pending requests
- `getTotalCreditRequested()` - Total pending credit
- `getTotalCreditApproved()` - Total approved credit

### Stats Service (`api.stats`)

- `getPlayerStats()` - Get all player statistics
- `getGameStats()` - Get game statistics only
- `getSessionStats()` - Get session statistics
- `getFinancialStats()` - Get financial statistics
- `getPerformanceStats()` - Get performance metrics
- `getPlayerRanking()` - Get ranking information
- `getPlayerBadges()` - Get earned badges
- `getPlayerAchievements()` - Get achievements
- `getWinPercentage()` - Calculate win rate
- `getTotalProfitLoss()` - Calculate P/L
- `getLevelProgress()` - Get level progress

### F&B Service (`api.fnb`)

- `getMenu()` - Get F&B menu
- `getMenuByCategory(category)` - Filter by category
- `getAvailableMenuItems()` - Get available items only
- `searchMenuItems(term)` - Search menu items
- `createOrder(orderData)` - Create new order
- `getOrders()` - Get all orders
- `getOrderById(orderId)` - Get specific order
- `getActiveOrders()` - Get active orders
- `getOrderHistory()` - Get completed/cancelled orders
- `updateOrder(orderId, data)` - Update order
- `cancelOrder(orderId)` - Cancel order
- `calculateOrderTotal(items, menu)` - Calculate total
- `getTotalSpent()` - Get total F&B spending

## React Hooks

All services have corresponding React hooks in `/hooks/usePlayerAPI.ts`:

### Query Hooks (Data Fetching)
- `usePlayerProfile()` - Fetch player profile
- `usePlayerBalance()` - Fetch balance (auto-refresh)
- `usePlayerTransactions(limit, offset)` - Fetch transactions
- `useWaitlistStatus()` - Fetch waitlist status
- `useAvailableTables()` - Fetch available tables
- `useTableDetails(tableId)` - Fetch table details
- `usePlayerStats()` - Fetch player stats
- `useFNBMenu()` - Fetch F&B menu
- `useFNBOrders()` - Fetch F&B orders

### Mutation Hooks (Data Updates)
- `usePlayerLogin()` - Login mutation
- `usePlayerSignup()` - Signup mutation
- `useUpdatePlayerProfile()` - Update profile
- `useChangePlayerPassword()` - Change password
- `useJoinWaitlist()` - Join waitlist
- `useCancelWaitlist()` - Cancel waitlist
- `useRequestCredit()` - Request credit
- `useCreateFNBOrder()` - Create F&B order
- `useUpdateFNBOrder()` - Update F&B order
- `useCancelFNBOrder()` - Cancel F&B order

## Configuration

Set the backend API URL in your `.env` file:

```env
VITE_API_BASE_URL=http://localhost:3000/api
```

For production:

```env
VITE_API_BASE_URL=https://your-backend-domain.com/api
```

## Authentication

All API services automatically include authentication headers:

- `x-player-id` - Player ID from local storage
- `x-club-id` - Club ID from local storage

These are set during login/signup and cleared on logout.

## Error Handling

All services use the `APIError` class for structured error handling:

```typescript
import { APIError } from '@/lib/api';

try {
  const balance = await api.balance.getBalance();
} catch (error) {
  if (error instanceof APIError) {
    console.error('API Error:', error.message);
    console.error('Status Code:', error.statusCode);
    console.error('Response:', error.response);
  }
}
```

## Best Practices

1. **Use React Hooks** - Prefer hooks over direct service calls for automatic caching and state management
2. **Handle Loading States** - Always check `isLoading` and `isError` from hooks
3. **Invalidate Queries** - Mutations automatically invalidate related queries
4. **Error Feedback** - All mutation hooks show toast notifications automatically
5. **Type Safety** - All services and hooks are fully typed with TypeScript

## Backend Integration

This API integration connects to the NestJS backend at:
- Local: `http://localhost:3000/api`
- Production: Configure via `VITE_API_BASE_URL`

Make sure the backend is running before using the player portal.

## Testing

```typescript
// Test authentication
const loginResult = await api.auth.login({
  clubCode: 'TEST',
  email: 'test@example.com',
  password: 'test123',
});

console.log('Login successful:', loginResult.success);

// Test balance fetch
const balance = await api.balance.getBalance();
console.log('Current balance:', balance.balance);

// Test waitlist
const waitlist = await api.waitlist.joinWaitlist({
  partySize: 1,
});
console.log('Joined waitlist:', waitlist.entry.id);
```






