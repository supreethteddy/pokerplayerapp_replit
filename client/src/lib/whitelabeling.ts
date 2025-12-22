export interface WhitelabelConfig {
  // Player ID Configuration
  playerIdPrefix: string;
  playerIdNumberLength: number;
  
  // Portal Branding
  portalName: string;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  logoUrl?: string;
  clubCode?: string;
  
  // Company Information
  companyName: string;
  supportEmail: string;
  supportPhone?: string;
  
  // Feature Toggles
  features: {
    creditSystem: boolean;
    kycRequired: boolean;
    emailVerification: boolean;
    pushNotifications: boolean;
  };
}

export const whitelabelConfig: WhitelabelConfig = {
  // Player ID Configuration
  playerIdPrefix: "POKEPLAYER",
  playerIdNumberLength: 4, // Will generate numbers like 0001, 0002, etc.
  
  // Portal Branding
  portalName: "Poker Club",
  primaryColor: "#1a1a1a",
  secondaryColor: "#2d2d2d", 
  accentColor: "#3b82f6",
  logoUrl: "https://png.pngtree.com/png-clipart/20190611/original/pngtree-wolf-logo-png-image_2306634.jpg", // Placeholder logo - replace with your custom logo URL
  clubCode: undefined, // Club code should be provided by user during login/signup
  
  // Company Information
  companyName: "Poker Club",
  supportEmail: "support@pokerclub.com",
  supportPhone: "+1-800-POKER-CLUB",
  
  // Feature Toggles
  features: {
    creditSystem: true,
    kycRequired: true,
    emailVerification: true,
    pushNotifications: true
  }
};

// Helper function to generate next available player ID
export function generateNextPlayerId(existingPlayerIds: string[]): string {
  const { playerIdPrefix, playerIdNumberLength } = whitelabelConfig;
  
  // Extract numbers from existing player IDs with our prefix
  const existingNumbers = existingPlayerIds
    .filter(id => id && id.startsWith(playerIdPrefix + "-"))
    .map(id => {
      const numberPart = id.replace(playerIdPrefix + "-", "");
      return parseInt(numberPart, 10);
    })
    .filter(num => !isNaN(num))
    .sort((a, b) => a - b);
  
  // Find the next available number
  let nextNumber = 1;
  for (const num of existingNumbers) {
    if (num === nextNumber) {
      nextNumber++;
    } else {
      break;
    }
  }
  
  // Format with leading zeros
  const paddedNumber = nextNumber.toString().padStart(playerIdNumberLength, '0');
  return `${playerIdPrefix}-${paddedNumber}`;
}

// Helper function to validate player ID format
export function isValidPlayerId(playerId: string): boolean {
  const { playerIdPrefix, playerIdNumberLength } = whitelabelConfig;
  const expectedPattern = new RegExp(`^${playerIdPrefix}-\\d{${playerIdNumberLength}}$`);
  return expectedPattern.test(playerId);
}

