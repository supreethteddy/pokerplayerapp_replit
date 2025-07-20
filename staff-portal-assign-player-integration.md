# Staff Portal "Assign Player" Button Integration

## Overview
This guide enables the Staff Portal to properly assign players to seats and have those assignments appear in real-time in the Player Portal table view.

## Required API Endpoints

### 1. Assign Player to Seat
**POST** `/api/staff/assign-player`

**Request Body:**
```json
{
  "waitlistId": "uuid-of-waitlist-entry",
  "seatNumber": 1-9,
  "assignedBy": "staff-member-name"
}
```

**Response:**
```json
{
  "id": "uuid",
  "playerId": 123,
  "tableId": "table-uuid",
  "seatNumber": 5,
  "status": "seated",
  "seatedAt": "2025-07-20T10:42:00.000Z",
  "notes": "Assigned to seat 5 by Manager John",
  "player": {
    "firstName": "Vignesh",
    "lastName": "Gana",
    "email": "vignesh.wildleaf@gmail.com",
    "phone": "9999999999"
  }
}
```

### 2. Get Table Seated Players
**GET** `/api/table-seats/{tableId}`

**Response:**
```json
[
  {
    "seatNumber": 1,
    "playerId": 29,
    "player": {
      "firstName": "Vignesh",
      "lastName": "Gana",
      "email": "vignesh.wildleaf@gmail.com"
    },
    "seatedAt": "2025-07-20T10:42:00.000Z"
  }
]
```

## Staff Portal Implementation

### JavaScript Code for "Assign Player" Button

```javascript
// Add this to Staff Portal JavaScript
async function assignPlayerToSeat(waitlistId, seatNumber, staffName) {
  try {
    const response = await fetch('/api/staff/assign-player', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        waitlistId: waitlistId,
        seatNumber: seatNumber,
        assignedBy: staffName
      })
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const result = await response.json();
    
    // Update UI to show success
    alert(`Player ${result.player.firstName} ${result.player.lastName} assigned to seat ${result.seatNumber}`);
    
    // Refresh waitlist and table view
    location.reload();
    
    return result;
  } catch (error) {
    console.error('Error assigning player:', error);
    alert('Failed to assign player. Please try again.');
  }
}

// Add click handlers to "Assign Player" buttons
document.addEventListener('DOMContentLoaded', function() {
  // Find all assign player buttons
  const assignButtons = document.querySelectorAll('[data-assign-player]');
  
  assignButtons.forEach(button => {
    button.addEventListener('click', function() {
      const waitlistId = this.getAttribute('data-waitlist-id');
      const seatNumber = this.getAttribute('data-seat-number');
      const staffName = 'Staff Member'; // Replace with actual staff name
      
      if (waitlistId && seatNumber) {
        assignPlayerToSeat(waitlistId, parseInt(seatNumber), staffName);
      }
    });
  });
});
```

### HTML Structure for Assign Player Buttons

```html
<!-- In Staff Portal waitlist table -->
<tr data-waitlist-entry>
  <td>Player Name</td>
  <td>Requested Seat</td>
  <td>Status</td>
  <td>
    <button 
      data-assign-player
      data-waitlist-id="uuid-here"
      data-seat-number="5"
      class="btn btn-success"
    >
      Assign Player
    </button>
  </td>
</tr>
```

## Real-Time Synchronization

The Player Portal automatically:
1. Refreshes seated players every 2 seconds via `/api/table-seats/{tableId}`
2. Shows occupied seats with player initials in blue
3. Prevents seat selection for occupied seats
4. Updates player count in real-time

## Cross-Portal Data Flow

1. **Player Portal**: Player reserves seat preference → Waitlist entry created
2. **Staff Portal**: Manager sees waitlist → Clicks "Assign Player" → Calls `/api/staff/assign-player`
3. **Database**: Waitlist entry updated to "seated" status with seat number
4. **Player Portal**: Real-time refresh shows seated player in table view
5. **All Players**: Can see occupied seats when viewing table

## Testing Instructions

### Step 1: Create Waitlist Entry
1. Login to Player Portal
2. Click "Join Waitlist" on any table
3. Select a seat number and reserve

### Step 2: Assign Player (Staff Portal)
1. Open Staff Portal waitlist management
2. Find the player's waitlist entry
3. Click "Assign Player" button
4. Player should be marked as "seated"

### Step 3: Verify Real-Time Display
1. Return to Player Portal table view
2. Refresh page or wait 2 seconds
3. Assigned seat should show player initials in blue
4. Player count should increment

## Database Schema
The integration uses the existing `waitlist` table with these key fields:
- `status`: 'waiting' → 'seated'
- `seat_number`: Final assigned seat (1-9)
- `seated_at`: Timestamp of assignment
- `notes`: Assignment details

This creates a complete cross-portal seat management system where staff assignments instantly appear in all player views.