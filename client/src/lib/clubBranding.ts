/**
 * Dynamic Club Branding System
 * Loads club branding (logo, colors, gradient) from backend based on player's club
 * 
 * SECURITY: All data fetched from backend API only.
 * No direct database or storage access from frontend.
 */

import { API_BASE_URL } from './api/config';

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

let cachedBranding: ClubBranding | null = null;

/**
 * Fetch club branding from backend by club ID
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
    
    // Console log gradient and skinColor for verification
    console.log('🎨 [BRANDING] Fetched club branding:', {
      clubCode: club.code,
      gradient: club.gradient || 'default',
      skinColor: club.skinColor || 'default',
    });
    
    const branding: ClubBranding = {
      clubId: club.id,
      clubName: club.name,
      clubCode: club.code,
      logoUrl: club.logoUrl || null,
      videoUrl: club.videoUrl || null,
      skinColor: club.skinColor || '#10b981', // Default emerald
      gradient: club.gradient || '#1a1a1a', // Default dark background
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
 * Fetch club branding from backend by club code
 */
export async function fetchClubBrandingByCode(clubCode: string): Promise<ClubBranding | null> {
  try {
    // Check cache first
    if (cachedBranding && cachedBranding.clubCode === clubCode) {
      return cachedBranding;
    }

    const response = await fetch(`${API_BASE_URL}/clubs/verify-code`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ code: clubCode }),
    });

    if (!response.ok) {
      console.error(`❌ Failed to verify club code: ${response.status}`);
      return null;
    }

    const result = await response.json();
    
    if (!result.valid || !result.clubId) {
      console.error('❌ Invalid club code');
      return null;
    }

    // Fetch branding using club ID
    return await fetchClubBranding(result.clubId);
  } catch (error) {
    console.error('Error fetching club branding by code:', error);
    return null;
  }
}

/**
 * Create branding from verify-code API response
 */
export function createBrandingFromVerifyResponse(result: any, clubCode: string): ClubBranding | null {
  try {
    const clubId = result.clubId || result.id;
    if (!result || !result.valid || !clubId) {
      console.warn('⚠️ [BRANDING] Invalid verify response:', result);
      return null;
    }

    // Console log gradient and skinColor for verification
    console.log('🎨 [BRANDING] Creating branding from verify response:', {
      clubCode: clubCode,
      clubId: clubId,
      gradient: result.gradient || 'default',
      skinColor: result.skinColor || result.skin_color || 'default',
    });

    const branding: ClubBranding = {
      clubId: clubId,
      clubName: result.clubName || result.name || 'Club',
      clubCode: clubCode,
      logoUrl: result.logoUrl || null,
      videoUrl: result.videoUrl || null,
      skinColor: result.skinColor || result.skin_color || '#10b981', // Default emerald
      gradient: result.gradient || '#1a1a1a', // Default dark background
      termsAndConditions: result.termsAndConditions || result.terms_and_conditions || null,
    };

    // Cache it
    cachedBranding = branding;
    
    return branding;
  } catch (error) {
    console.error('Error creating branding from verify response:', error);
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
  
  // If gradient is a hex color, apply it as background color
  if (isHexColor(branding.gradient)) {
    root.style.setProperty('--club-background-color', branding.gradient);
  }
  
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
  console.log(`🎨 Gradient: ${branding.gradient}`);
  console.log(`🎨 Skin Color: ${branding.skinColor}`);
}

/**
 * Check if a string is a hex color
 */
function isHexColor(color: string): boolean {
  return /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/.test(color);
}

/**
 * Get gradient Tailwind classes or inline style from gradient value
 * Returns either Tailwind classes or an empty string (for inline styles)
 */
export function getGradientClasses(gradient: string): string {
  // If it's a hex color, return empty string (will use inline style)
  if (isHexColor(gradient)) {
    return '';
  }
  
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
 * Get gradient style object for inline styles (for hex colors)
 */
export function getGradientStyle(gradient: string): { backgroundColor?: string } {
  if (isHexColor(gradient)) {
    return { backgroundColor: gradient };
  }
  return {};
}

/**
 * Clear cached branding (useful when switching clubs or logging out)
 */
export function clearBrandingCache() {
  cachedBranding = null;
}

