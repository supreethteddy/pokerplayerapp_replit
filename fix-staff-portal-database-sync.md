# STAFF PORTAL DATABASE SYNC FIX

## PROBLEM IDENTIFIED
The Player Portal and Staff Portal are using **different databases**:

- **Player Portal**: Connected to Staff Portal Supabase (`https://oyhnpnymlezjusnwpjeu.supabase.co`)
  - Shows: "REST API TEST", "WEBSOCKET TEST" messages ✅
- **Staff Portal**: Connected to **unknown/different database**
  - Shows: "Account Balance Issue - Urgent Help Needed" ❌

## ROOT CAUSE
The Staff Portal is NOT using the same Supabase database URL that the Player Portal is configured to use.

## SOLUTION REQUIRED
The Staff Portal needs to be configured to use the EXACT same database connection:

### Staff Portal Environment Variables Needed:
```
SUPABASE_URL=https://oyhnpnymlezjusnwpjeu.supabase.co
SUPABASE_SERVICE_KEY=[STAFF_PORTAL_SUPABASE_SERVICE_KEY value]
```

### Database Tables That Must Be Shared:
1. `gre_chat_messages` - All chat messages
2. `gre_chat_sessions` - Chat session management
3. `gre_online_status` - Player online status
4. `players` - Player information
5. `push_notifications` - System notifications

## VERIFICATION
Once Staff Portal uses the correct database, both portals should show:
- Same 2 test messages for player 29
- Same session ID: `f4560670-cfce-4331-97d6-9daa06d3ee8e`
- Same message timestamps

## CURRENT DATABASE CONTENTS
Staff Portal Supabase currently contains:
- 1 session for player 29 (Vignesh Gana)
- 2 messages: 
  1. "REST API TEST: Staff Portal integration check"
  2. "WEBSOCKET TEST: Real-time Staff Portal integration"

The Staff Portal should show these EXACT messages once properly connected.

## STATUS
❌ **INTEGRATION INCOMPLETE** - Database synchronization required
✅ Player Portal correctly connected
❌ Staff Portal using wrong database source