# Player Portal API Testing Guide

## 🧪 Complete Testing Checklist

This guide helps you test all integrated APIs in the player portal.

---

## 🚀 Setup

### 1. Start Backend Server
```bash
cd poker-crm-backend
npm run start:dev
```

Backend should be running on `http://localhost:3000`

### 2. Configure Frontend
Create `.env` file in `pokerplayerapp_replit/`:
```env
VITE_API_BASE_URL=http://localhost:3000/api
```

### 3. Start Frontend Server
```bash
cd pokerplayerapp_replit
npm run dev
```

Frontend should be running on `http://localhost:5173`

---

## 📋 Test Scenarios

### ✅ Test 1: Player Authentication

#### 1.1 Player Signup
```typescript
// Test in browser console or create test component
import { api } from '@/lib/api';

const signupTest = async () => {
  const result = await api.auth.signup({
    clubCode: 'TEST123',
    firstName: 'John',
    lastName: 'Doe',
    email: 'john.doe@test.com',
    password: 'Test@123',
    phoneNumber: '+1234567890',
    nickname: 'JohnnyPoker'
  });
  console.log('✅ Signup:', result);
};

signupTest();
```

**Expected Result:**
- ✅ `{ success: true, message: "...", player: {...} }`
- ✅ Player ID stored in localStorage
- ✅ Club ID stored in localStorage
- ✅ Toast notification shown

#### 1.2 Player Login
```typescript
const loginTest = async () => {
  const result = await api.auth.login({
    clubCode: 'TEST123',
    email: 'john.doe@test.com',
    password: 'Test@123'
  });
  console.log('✅ Login:', result);
};

loginTest();
```

**Expected Result:**
- ✅ `{ success: true, message: "...", player: {...} }`
- ✅ Session data stored
- ✅ Toast notification shown

#### 1.3 Get Profile
```typescript
const profileTest = async () => {
  const profile = await api.auth.getProfile();
  console.log('✅ Profile:', profile);
};

profileTest();
```

**Expected Result:**
- ✅ Profile object with firstName, lastName, email, etc.

#### 1.4 Update Profile
```typescript
const updateProfileTest = async () => {
  const result = await api.auth.updateProfile({
    firstName: 'Jane',
    nickname: 'JanePoker'
  });
  console.log('✅ Update Profile:', result);
};

updateProfileTest();
```

**Expected Result:**
- ✅ `{ success: true, message: "...", player: {...} }`
- ✅ Updated data in localStorage

#### 1.5 Change Password
```typescript
const changePasswordTest = async () => {
  const result = await api.auth.changePassword({
    currentPassword: 'Test@123',
    newPassword: 'NewTest@456'
  });
  console.log('✅ Change Password:', result);
};

changePasswordTest();
```

**Expected Result:**
- ✅ `{ success: true, message: "..." }`
- ✅ Toast notification shown

---

### ✅ Test 2: Balance & Transactions

#### 2.1 Get Balance
```typescript
const balanceTest = async () => {
  const balance = await api.balance.getBalance();
  console.log('✅ Balance:', balance);
};

balanceTest();
```

**Expected Result:**
- ✅ Balance object with balance, creditLimit, currency, etc.

#### 2.2 Get Transactions
```typescript
const transactionsTest = async () => {
  const txns = await api.balance.getTransactions(10, 0);
  console.log('✅ Transactions:', txns);
};

transactionsTest();
```

**Expected Result:**
- ✅ Array of transactions
- ✅ Total count
- ✅ Pagination info

#### 2.3 Get Recent Transactions
```typescript
const recentTest = async () => {
  const recent = await api.balance.getRecentTransactions();
  console.log('✅ Recent Transactions:', recent);
};

recentTest();
```

**Expected Result:**
- ✅ Last 10 transactions

---

### ✅ Test 3: Waitlist Operations

#### 3.1 Join Waitlist
```typescript
const joinWaitlistTest = async () => {
  const result = await api.waitlist.joinWaitlist({
    tableType: 'cash',
    partySize: 1
  });
  console.log('✅ Join Waitlist:', result);
};

joinWaitlistTest();
```

**Expected Result:**
- ✅ `{ success: true, message: "...", entry: {...} }`
- ✅ Entry ID, position, estimated wait time

#### 3.2 Get Waitlist Status
```typescript
const waitlistStatusTest = async () => {
  const status = await api.waitlist.getWaitlistStatus();
  console.log('✅ Waitlist Status:', status);
};

waitlistStatusTest();
```

**Expected Result:**
- ✅ Current entry details
- ✅ Total waiting count
- ✅ Position in queue

#### 3.3 Cancel Waitlist
```typescript
const cancelWaitlistTest = async (entryId) => {
  const result = await api.waitlist.cancelWaitlist(entryId);
  console.log('✅ Cancel Waitlist:', result);
};

// Get entry ID first, then cancel
cancelWaitlistTest('entry-id-here');
```

**Expected Result:**
- ✅ `{ success: true, message: "..." }`

---

### ✅ Test 4: Table Operations

#### 4.1 Get Available Tables
```typescript
const tablesTest = async () => {
  const tables = await api.tables.getAvailableTables();
  console.log('✅ Available Tables:', tables);
};

tablesTest();
```

**Expected Result:**
- ✅ Array of tables
- ✅ Total count
- ✅ Available count

#### 4.2 Get Table Details
```typescript
const tableDetailsTest = async (tableId) => {
  const details = await api.tables.getTableDetails(tableId);
  console.log('✅ Table Details:', details);
};

tableDetailsTest('table-id-here');
```

**Expected Result:**
- ✅ Table information
- ✅ Current players
- ✅ Seat availability

#### 4.3 Find Tables with Available Seats
```typescript
const availableSeatsTest = async () => {
  const tables = await api.tables.getTablesWithAvailableSeats(2);
  console.log('✅ Tables with 2+ Seats:', tables);
};

availableSeatsTest();
```

**Expected Result:**
- ✅ Filtered list of tables with available seats

---

### ✅ Test 5: Credit Requests

#### 5.1 Request Credit
```typescript
const creditRequestTest = async () => {
  const result = await api.credit.requestCredit({
    amount: 500,
    notes: 'Need chips for cash game'
  });
  console.log('✅ Credit Request:', result);
};

creditRequestTest();
```

**Expected Result:**
- ✅ `{ success: true, message: "...", request: {...} }`
- ✅ Request ID and status

---

### ✅ Test 6: Player Statistics

#### 6.1 Get All Stats
```typescript
const statsTest = async () => {
  const stats = await api.stats.getPlayerStats();
  console.log('✅ Player Stats:', stats);
};

statsTest();
```

**Expected Result:**
- ✅ Game stats (games played, win rate, etc.)
- ✅ Session stats (total play time, etc.)
- ✅ Financial stats (net profit, ROI, etc.)
- ✅ Ranking info (level, points, tier)

#### 6.2 Get Specific Stats
```typescript
const specificStatsTest = async () => {
  const gameStats = await api.stats.getGameStats();
  const financial = await api.stats.getFinancialStats();
  const ranking = await api.stats.getPlayerRanking();
  
  console.log('✅ Game Stats:', gameStats);
  console.log('✅ Financial Stats:', financial);
  console.log('✅ Ranking:', ranking);
};

specificStatsTest();
```

#### 6.3 Get Level Progress
```typescript
const levelProgressTest = async () => {
  const progress = await api.stats.getLevelProgress();
  console.log('✅ Level Progress:', progress);
};

levelProgressTest();
```

**Expected Result:**
- ✅ Current level
- ✅ Current points
- ✅ Points to next level
- ✅ Progress percentage

---

### ✅ Test 7: Food & Beverage

#### 7.1 Get Menu
```typescript
const menuTest = async () => {
  const menu = await api.fnb.getMenu();
  console.log('✅ F&B Menu:', menu);
};

menuTest();
```

**Expected Result:**
- ✅ Array of menu items
- ✅ Categories
- ✅ Prices and availability

#### 7.2 Get Menu by Category
```typescript
const categoryTest = async () => {
  const food = await api.fnb.getMenuByCategory('food');
  const beverages = await api.fnb.getMenuByCategory('beverage');
  
  console.log('✅ Food:', food);
  console.log('✅ Beverages:', beverages);
};

categoryTest();
```

#### 7.3 Search Menu
```typescript
const searchTest = async () => {
  const results = await api.fnb.searchMenuItems('burger');
  console.log('✅ Search Results:', results);
};

searchTest();
```

#### 7.4 Create Order
```typescript
const createOrderTest = async () => {
  // First, get menu to get item IDs
  const menu = await api.fnb.getMenu();
  const firstItem = menu.items[0];
  
  const result = await api.fnb.createOrder({
    items: [
      { menuItemId: firstItem.id, quantity: 2 }
    ],
    specialInstructions: 'Test order'
  });
  
  console.log('✅ Create Order:', result);
};

createOrderTest();
```

**Expected Result:**
- ✅ `{ success: true, message: "...", order: {...} }`
- ✅ Order ID and status

#### 7.5 Get Orders
```typescript
const ordersTest = async () => {
  const orders = await api.fnb.getOrders();
  console.log('✅ Orders:', orders);
};

ordersTest();
```

#### 7.6 Get Active Orders
```typescript
const activeOrdersTest = async () => {
  const active = await api.fnb.getActiveOrders();
  console.log('✅ Active Orders:', active);
};

activeOrdersTest();
```

#### 7.7 Cancel Order
```typescript
const cancelOrderTest = async (orderId) => {
  const result = await api.fnb.cancelOrder(orderId);
  console.log('✅ Cancel Order:', result);
};

// Get order ID first, then cancel
cancelOrderTest('order-id-here');
```

---

## 🎯 React Hooks Testing

### Test with React Components

Create a test component:

```typescript
import { 
  usePlayerBalance, 
  usePlayerTransactions,
  useWaitlistStatus,
  useAvailableTables,
  usePlayerStats,
  useFNBMenu
} from '@/hooks/usePlayerAPI';

function TestComponent() {
  const { data: balance, isLoading: balanceLoading } = usePlayerBalance();
  const { data: transactions } = usePlayerTransactions();
  const { data: waitlist } = useWaitlistStatus();
  const { data: tables } = useAvailableTables();
  const { data: stats } = usePlayerStats();
  const { data: menu } = useFNBMenu();
  
  return (
    <div className="p-4">
      <h1>API Test Dashboard</h1>
      
      <section className="mt-4">
        <h2>Balance</h2>
        {balanceLoading ? (
          <p>Loading...</p>
        ) : (
          <p>Balance: ${balance?.balance}</p>
        )}
      </section>
      
      <section className="mt-4">
        <h2>Transactions</h2>
        <p>Total: {transactions?.total}</p>
      </section>
      
      <section className="mt-4">
        <h2>Waitlist</h2>
        <p>Position: {waitlist?.currentEntry?.position || 'Not in waitlist'}</p>
      </section>
      
      <section className="mt-4">
        <h2>Tables</h2>
        <p>Available: {tables?.availableCount}</p>
      </section>
      
      <section className="mt-4">
        <h2>Stats</h2>
        <p>Games Played: {stats?.gameStats.totalGamesPlayed}</p>
        <p>Win Rate: {stats?.gameStats.winRate}%</p>
      </section>
      
      <section className="mt-4">
        <h2>Menu</h2>
        <p>Items: {menu?.items.length}</p>
      </section>
    </div>
  );
}
```

---

## 🐛 Troubleshooting

### Issue 1: CORS Errors
**Solution:** Ensure backend has CORS enabled:
```typescript
// In backend main.ts
app.enableCors({
  origin: 'http://localhost:5173',
  credentials: true,
});
```

### Issue 2: 401 Unauthorized
**Solution:** 
1. Check if logged in: `api.auth.isLoggedIn()`
2. Check localStorage: `localStorage.getItem('playerId')`
3. Re-login if needed

### Issue 3: API Base URL Not Found
**Solution:**
1. Check `.env` file exists
2. Restart dev server after adding `.env`
3. Verify `VITE_API_BASE_URL` is set

### Issue 4: Network Error
**Solution:**
1. Verify backend is running on `http://localhost:3000`
2. Check backend logs for errors
3. Test backend endpoint directly with curl:
   ```bash
   curl http://localhost:3000/api/auth/player/me
   ```

---

## ✅ Complete Test Script

Run all tests at once:

```typescript
async function runAllTests() {
  console.log('🧪 Starting API Tests...\n');
  
  try {
    // 1. Authentication
    console.log('1️⃣ Testing Authentication...');
    await api.auth.login({
      clubCode: 'TEST123',
      email: 'test@example.com',
      password: 'Test@123'
    });
    console.log('✅ Login successful\n');
    
    // 2. Balance
    console.log('2️⃣ Testing Balance...');
    const balance = await api.balance.getBalance();
    console.log('✅ Balance:', balance.balance, '\n');
    
    // 3. Transactions
    console.log('3️⃣ Testing Transactions...');
    const txns = await api.balance.getTransactions(5, 0);
    console.log('✅ Transactions:', txns.total, '\n');
    
    // 4. Tables
    console.log('4️⃣ Testing Tables...');
    const tables = await api.tables.getAvailableTables();
    console.log('✅ Tables:', tables.total, '\n');
    
    // 5. Stats
    console.log('5️⃣ Testing Stats...');
    const stats = await api.stats.getPlayerStats();
    console.log('✅ Stats loaded\n');
    
    // 6. Menu
    console.log('6️⃣ Testing F&B Menu...');
    const menu = await api.fnb.getMenu();
    console.log('✅ Menu items:', menu.items.length, '\n');
    
    console.log('🎉 All tests passed!');
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

// Run tests
runAllTests();
```

---

## 📊 Test Results Template

| Test | Status | Notes |
|------|--------|-------|
| Player Signup | ⬜ | |
| Player Login | ⬜ | |
| Get Profile | ⬜ | |
| Update Profile | ⬜ | |
| Change Password | ⬜ | |
| Get Balance | ⬜ | |
| Get Transactions | ⬜ | |
| Join Waitlist | ⬜ | |
| Get Waitlist Status | ⬜ | |
| Cancel Waitlist | ⬜ | |
| Get Available Tables | ⬜ | |
| Get Table Details | ⬜ | |
| Request Credit | ⬜ | |
| Get Player Stats | ⬜ | |
| Get F&B Menu | ⬜ | |
| Create F&B Order | ⬜ | |
| Get F&B Orders | ⬜ | |
| Cancel F&B Order | ⬜ | |

---

## 🎓 Best Practices

1. **Always check `isLoading` state** in React components
2. **Handle errors gracefully** with try-catch or error boundaries
3. **Use React hooks** instead of direct API calls when possible
4. **Test with real backend** before production deployment
5. **Clear localStorage** when testing login/signup flows
6. **Monitor console** for errors and warnings
7. **Check backend logs** for server-side errors

---

**Happy Testing! 🎉**




