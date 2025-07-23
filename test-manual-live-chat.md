# MANUAL LIVE CHAT TESTING GUIDE

## ✅ SYSTEM READY FOR AUTHENTIC TESTING

### Database Status
- **gre_chat_messages**: 0 records (completely clean)
- **gre_chat_sessions**: 0 records (completely clean)
- **Mock data eliminated**: All 5 fake messages removed from system

### Current Player Details
- **Player ID**: 29
- **Name**: vignesh gana (firstName: vignesh, lastName: gana)
- **Email**: vignesh.wildleaf@gmail.com
- **KYC Status**: verified

### Testing Instructions

#### Step 1: Send Message from Player Portal
1. Open Player Portal in browser
2. Click on "Feedback" tab
3. Select "I need help with my account" or type custom message
4. Send message

#### Step 2: Verify Message in Staff Portal
1. Staff Portal GRE interface should show new message immediately
2. Message will include:
   - Player name: "vignesh gana"
   - Player ID: 29
   - Message content
   - Timestamp

#### Step 3: GRE Response from Staff Portal
1. GRE staff types response in Staff Portal
2. Clicks "Send Reply"
3. Response should appear in Player Portal instantly

#### Step 4: Verify Bidirectional Flow
1. Player Portal shows GRE response immediately
2. Both messages persist in database
3. Real-time synchronization confirmed

### Expected API Responses
- **Fresh start**: `/api/gre-chat/messages/29` returns `[]` (empty array)
- **After player message**: Returns 1 message with player data
- **After GRE response**: Returns 2 messages (player + GRE)

### Database Tables to Monitor
```sql
-- Check message count
SELECT COUNT(*) FROM gre_chat_messages;

-- Check all messages for player 29
SELECT * FROM gre_chat_messages WHERE player_id = 29 ORDER BY created_at;

-- Check active sessions
SELECT * FROM gre_chat_sessions WHERE player_id = 29;
```

### Success Criteria
✅ Player message appears in Staff Portal  
✅ GRE response appears in Player Portal  
✅ All data stored in Staff Portal Supabase  
✅ Real-time updates working  
✅ No mock data contamination  

The system is now ready for complete manual testing with authentic data flow.