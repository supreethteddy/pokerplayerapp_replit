# Player Portal API - Quick Reference Card

## 🚀 Getting Started

```typescript
import { api } from '@/lib/api';
import { usePlayerBalance, usePlayerLogin } from '@/hooks/usePlayerAPI';
```

## 🔐 Authentication

### Login
```typescript
const loginMutation = usePlayerLogin();
await loginMutation.mutateAsync({
  clubCode: 'ABC123',
  email: 'player@example.com',
  password: 'password123'
});
```

### Signup
```typescript
const signupMutation = usePlayerSignup();
await signupMutation.mutateAsync({
  clubCode: 'ABC123',
  firstName: 'John',
  lastName: 'Doe',
  email: 'john@example.com',
  password: 'password123',
  phoneNumber: '+1234567890',
  nickname: 'JohnnyPoker'
});
```

### Get Profile
```typescript
const { data: profile } = usePlayerProfile();
// profile.firstName, profile.email, etc.
```

### Update Profile
```typescript
const updateMutation = useUpdatePlayerProfile();
await updateMutation.mutateAsync({
  firstName: 'Jane',
  phoneNumber: '+0987654321'
});
```

### Change Password
```typescript
const changePwdMutation = useChangePlayerPassword();
await changePwdMutation.mutateAsync({
  currentPassword: 'old123',
  newPassword: 'new456'
});
```

### Logout
```typescript
api.auth.logout();
```

## 💰 Balance & Transactions

### Get Balance (Auto-refresh every 60s)
```typescript
const { data: balance } = usePlayerBalance();
// balance.balance, balance.creditLimit, balance.currency
```

### Get Transactions
```typescript
const { data: txns } = usePlayerTransactions(50, 0);
// txns.transactions[], txns.total, txns.hasMore
```

### Get Recent Transactions
```typescript
const recent = await api.balance.getRecentTransactions();
```

### Get Total Earnings
```typescript
const earnings = await api.balance.getTotalEarnings();
```

## 🎰 Waitlist

### Join Waitlist
```typescript
const joinMutation = useJoinWaitlist();
await joinMutation.mutateAsync({
  tableType: 'cash',
  partySize: 1
});
```

### Get Status (Auto-refresh every 30s)
```typescript
const { data: status } = useWaitlistStatus();
// status.currentEntry, status.totalWaiting
```

### Cancel Waitlist
```typescript
const cancelMutation = useCancelWaitlist();
await cancelMutation.mutateAsync(entryId);
```

### Check if On Waitlist
```typescript
const isOnWaitlist = await api.waitlist.isOnWaitlist();
```

## 🎲 Tables

### Get Available Tables (Auto-refresh every 60s)
```typescript
const { data: tables } = useAvailableTables();
// tables.tables[], tables.availableCount
```

### Get Table Details
```typescript
const { data: details } = useTableDetails(tableId);
// details.table, details.currentPlayers
```

### Find Tables with Seats
```typescript
const available = await api.tables.getTablesWithAvailableSeats(2);
```

### Get Table by Number
```typescript
const table = await api.tables.getTableByNumber('T-101');
```

## 💳 Credit Requests

### Request Credit
```typescript
const requestMutation = useRequestCredit();
await requestMutation.mutateAsync({
  amount: 500,
  notes: 'Need chips for cash game'
});
```

### Check Pending Requests
```typescript
const hasPending = await api.credit.hasPendingCreditRequest();
```

## 📊 Player Stats

### Get All Stats
```typescript
const { data: stats } = usePlayerStats();
// stats.gameStats, stats.sessionStats, stats.financialStats
```

### Get Specific Stats
```typescript
const gameStats = await api.stats.getGameStats();
// gameStats.totalGamesPlayed, gameStats.winRate

const financial = await api.stats.getFinancialStats();
// financial.netProfit, financial.roi

const ranking = await api.stats.getPlayerRanking();
// ranking.rank, ranking.points, ranking.level
```

### Get Achievements
```typescript
const achievements = await api.stats.getPlayerAchievements();
const badges = await api.stats.getPlayerBadges();
```

### Get Level Progress
```typescript
const progress = await api.stats.getLevelProgress();
// progress.currentLevel, progress.progressPercentage
```

## 🍔 Food & Beverage

### Get Menu
```typescript
const { data: menu } = useFNBMenu();
// menu.items[], menu.categories[]
```

### Get by Category
```typescript
const food = await api.fnb.getMenuByCategory('food');
const beverages = await api.fnb.getMenuByCategory('beverage');
```

### Search Menu
```typescript
const results = await api.fnb.searchMenuItems('burger');
```

### Create Order
```typescript
const createMutation = useCreateFNBOrder();
await createMutation.mutateAsync({
  tableId: 'table-123',
  items: [
    { menuItemId: 'item-1', quantity: 2 },
    { menuItemId: 'item-2', quantity: 1, specialInstructions: 'No onions' }
  ],
  specialInstructions: 'Deliver to Table 5'
});
```

### Get Orders
```typescript
const { data: orders } = useFNBOrders();
// orders.orders[]
```

### Get Active Orders
```typescript
const active = await api.fnb.getActiveOrders();
```

### Cancel Order
```typescript
const cancelMutation = useCancelFNBOrder();
await cancelMutation.mutateAsync(orderId);
```

### Get Total Spent
```typescript
const totalSpent = await api.fnb.getTotalSpent();
```

## 🎯 Common Patterns

### Loading State
```typescript
const { data, isLoading, error } = usePlayerBalance();

if (isLoading) return <Spinner />;
if (error) return <Error message={error.message} />;
return <BalanceDisplay balance={data.balance} />;
```

### Mutation with Loading
```typescript
const mutation = usePlayerLogin();

const handleLogin = async () => {
  try {
    await mutation.mutateAsync(credentials);
    // Success! Toast shown automatically
  } catch (error) {
    // Error! Toast shown automatically
  }
};

return (
  <button 
    onClick={handleLogin} 
    disabled={mutation.isPending}
  >
    {mutation.isPending ? 'Logging in...' : 'Login'}
  </button>
);
```

### Direct API Call
```typescript
// When you need to call API directly (not in React component)
async function checkBalance() {
  try {
    const balance = await api.balance.getBalance();
    console.log('Balance:', balance.balance);
  } catch (error) {
    console.error('Failed to fetch balance:', error);
  }
}
```

## 🔑 Storage Keys

```typescript
localStorage.getItem('playerId')     // Player ID
localStorage.getItem('clubId')       // Club ID
localStorage.getItem('clubCode')     // Club code
localStorage.getItem('playerToken')  // Auth token
localStorage.getItem('playerData')   // Full player data (JSON)
```

## ⚙️ Configuration

```env
# .env file
VITE_API_BASE_URL=http://localhost:3000/api
```

## 🎨 TypeScript Types

All services include full TypeScript types:

```typescript
import type { 
  PlayerProfile,
  PlayerBalance,
  Transaction,
  WaitlistEntry,
  Table,
  CreditRequest,
  PlayerStats,
  MenuItem,
  FNBOrder
} from '@/lib/api';
```

## 📚 Full Documentation

See `client/src/lib/api/README.md` for complete documentation.

---

**Quick Tip**: All mutation hooks automatically show toast notifications for success/error!




