/**
 * Dynamic Club Branding System
 * Loads club branding (logo, colors, gradient) from backend based on player's club
 * 
 * SECURITY: All data fetched from backend API only.
 * No direct database or storage access from frontend.
 */

export interface ClubBranding {
  clubId: string;
  clubName: string;
  clubCode: string;
  logoUrl: string | null;
  videoUrl: string | null;
  skinColor: string;
  gradient: string;
  termsAndConditions: string | null;
}

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3333/api';

let cachedBranding: ClubBranding | null = null;

/**
 * Fetch club branding from backend
 */
export async function fetchClubBranding(clubId: string): Promise<ClubBranding | null> {
  try {
    // Check cache first
    if (cachedBranding && cachedBranding.clubId === clubId) {
      return cachedBranding;
    }

    const response = await fetch(`${API_BASE_URL}/clubs/${clubId}/branding`, {
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      console.error(`❌ Failed to fetch club branding: ${response.status}`);
      const errorData = await response.json().catch(() => null);
      console.error('❌ Error details:', errorData);
      return null;
    }

    const club = await response.json();
    
    const branding: ClubBranding = {
      clubId: club.id,
      clubName: club.name,
      clubCode: club.code,
      logoUrl: club.logoUrl || null,
      videoUrl: club.videoUrl || null,
      skinColor: club.skinColor || '#10b981', // Default emerald
      gradient: club.gradient || 'from-emerald-600 via-green-500 to-teal-500',
      termsAndConditions: club.termsAndConditions || null,
    };

    // Cache it
    cachedBranding = branding;
    
    return branding;
  } catch (error) {
    console.error('Error fetching club branding:', error);
    return null;
  }
}

/**
 * Apply club branding to the player app
 */
export function applyClubBranding(branding: ClubBranding) {
  // Apply to document root for CSS variables
  const root = document.documentElement;
  
  // Set CSS custom properties
  root.style.setProperty('--club-primary-color', branding.skinColor);
  root.style.setProperty('--club-gradient', branding.gradient);
  
  // Update favicon if logo exists
  if (branding.logoUrl) {
    const favicon = document.querySelector("link[rel='icon']") as HTMLLinkElement;
    if (favicon) {
      favicon.href = branding.logoUrl;
    }
  }
  
  // Update page title
  document.title = `${branding.clubName} - Player Portal`;
  
  console.log(`✅ Applied branding for club: ${branding.clubName} (${branding.clubCode})`);
}

/**
 * Get gradient Tailwind classes from gradient value
 */
export function getGradientClasses(gradient: string): string {
  // If it's already a Tailwind class string, return it
  if (gradient.startsWith('from-')) {
    return `bg-gradient-to-br ${gradient}`;
  }
  
  // Map gradient value to Tailwind classes
  const gradientMap: Record<string, string> = {
    'emerald-green-teal': 'bg-gradient-to-br from-emerald-600 via-green-500 to-teal-500',
    'teal-cyan-blue': 'bg-gradient-to-br from-teal-500 via-cyan-500 to-blue-500',
    'cyan-blue-indigo': 'bg-gradient-to-br from-cyan-500 via-blue-500 to-indigo-600',
    'blue-indigo-purple': 'bg-gradient-to-br from-blue-600 via-indigo-500 to-purple-600',
    'purple-pink-rose': 'bg-gradient-to-br from-purple-600 via-pink-500 to-rose-500',
    'pink-red-orange': 'bg-gradient-to-br from-pink-500 via-red-500 to-orange-500',
    'red-orange-yellow': 'bg-gradient-to-br from-red-600 via-orange-500 to-yellow-500',
    'orange-yellow-lime': 'bg-gradient-to-br from-orange-500 via-yellow-500 to-lime-500',
    'yellow-lime-green': 'bg-gradient-to-br from-yellow-500 via-lime-500 to-green-500',
    'indigo-purple-pink': 'bg-gradient-to-br from-indigo-600 via-purple-500 to-pink-500',
    'gray-slate-zinc': 'bg-gradient-to-br from-gray-600 via-slate-500 to-zinc-500',
    'slate-gray-neutral': 'bg-gradient-to-br from-slate-600 via-gray-500 to-neutral-500',
  };
  
  return gradientMap[gradient] || 'bg-gradient-to-br from-emerald-600 via-green-500 to-teal-500';
}

/**
 * Clear cached branding (useful when switching clubs or logging out)
 */
export function clearBrandingCache() {
  cachedBranding = null;
}

