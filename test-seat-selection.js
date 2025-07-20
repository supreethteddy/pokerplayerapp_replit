// Test script to verify seat selection functionality
// This simulates clicking seat 4 on table 56551992-75ac-4248-b5e1-65417d2e4047

const testSeatSelection = async () => {
  const tableId = '56551992-75ac-4248-b5e1-65417d2e4047';
  const playerId = 29;
  const seatNumber = 4;

  try {
    // Make a seat reservation request (simulating frontend seat click)
    const response = await fetch(`http://localhost:5000/api/seat-requests`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        playerId: playerId,
        tableId: tableId,
        seatNumber: seatNumber,
        gameType: 'Texas Hold\'em',
        minBuyIn: 1000,
        maxBuyIn: 10000
      })
    });

    const result = await response.json();
    console.log('Seat reservation result:', result);

    // Check if the player now appears in the table seats
    const seatsResponse = await fetch(`http://localhost:5000/api/table-seats/${tableId}`);
    const seatedPlayers = await seatsResponse.json();
    console.log('Seated players after reservation:', seatedPlayers);

  } catch (error) {
    console.error('Test failed:', error);
  }
};

// Run the test if this script is executed directly
if (typeof window === 'undefined') {
  testSeatSelection();
}