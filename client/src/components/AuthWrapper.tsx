import ClubsPokerAuth from './ClubsPokerAuth';

export default function AuthWrapper() {
  // Bypass all Clerk initialization and show the UI directly
  return <ClubsPokerAuth />;
}