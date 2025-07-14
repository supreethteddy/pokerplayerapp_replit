# Poker Room Integration Guide

## Current Status
✅ **Mock Data Removed**: All sample/test table data has been permanently deleted from the database.
✅ **Clean Database**: The system is now ready to connect to your real poker room management system.

## Tables Data Source
Currently, the `/api/tables` endpoint fetches data from the database `tables` table, but no live poker room system is connected.

### Required Integration
To display real live game data, you need to:

1. **Connect to your poker room management software** (e.g., PokerStars, GGPoker, custom solution)
2. **Provide the API endpoints or data source** for:
   - Active tables and games
   - Real-time player counts
   - Live pot amounts and stack sizes
   - Current game states and betting rounds
   - Table stakes and limits

### Integration Options

#### Option 1: External API Integration
Update `server/database.ts` → `getTables()` method to fetch from your poker room API:

```typescript
async getTables(): Promise<Table[]> {
  // Example: Connect to your poker room API
  const response = await fetch('https://your-poker-room-api.com/tables');
  const liveData = await response.json();
  
  // Transform the data to match your schema
  return liveData.map(table => ({
    id: table.id,
    name: table.name,
    gameType: table.gameType,
    stakes: table.stakes,
    maxPlayers: table.maxPlayers,
    currentPlayers: table.currentPlayers,
    pot: table.pot,
    avgStack: table.avgStack,
    isActive: table.isActive
  }));
}
```

#### Option 2: Database Sync Integration
If your poker room system uses a database, you can set up real-time sync:

```typescript
// Sync live data from poker room database
async getTables(): Promise<Table[]> {
  // Connect to your poker room database
  const liveData = await yourPokerRoomDB.select()
    .from(liveTablesTable)
    .where(eq(liveTablesTable.status, 'active'));
  
  return liveData;
}
```

#### Option 3: WebSocket Integration
For real-time updates, connect to your poker room's WebSocket feed:

```typescript
// Real-time WebSocket connection to poker room
const pokerRoomSocket = new WebSocket('wss://your-poker-room.com/live');
pokerRoomSocket.onmessage = (event) => {
  const liveTableData = JSON.parse(event.data);
  // Update database with live data
};
```

## Next Steps
1. **Provide your poker room management system details**
2. **Share API endpoints or database connection info**
3. **Specify the data format from your poker room system**
4. **Choose your preferred integration method**

Once you provide these details, I'll implement the real-time connection to your poker room management system.