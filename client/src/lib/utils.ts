import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Safely parses a date string, ensuring compatibility with iOS Safari.
 * iOS Safari requires ISO 8601 strict format (e.g. replacing ' ' with 'T').
 */
export function parseSafeDate(dateStr: string | Date | number | null | undefined): Date {
  if (!dateStr) return new Date();
  if (dateStr instanceof Date) return dateStr;
  if (typeof dateStr === 'number') return new Date(dateStr);

  // If it's a string, replace space with 'T' if it's a typical SQL datetime "YYYY-MM-DD HH:mm:ss"
  const str = String(dateStr);
  if (str.includes(' ') && !str.includes('T') && !str.match(/[a-zA-Z]{3}/)) {
    return new Date(str.replace(' ', 'T'));
  }

  return new Date(str);
}
