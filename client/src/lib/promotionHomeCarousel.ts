import { STORAGE_KEYS } from '@/lib/api/config';

const PREFIX = 'promo_home_carousel_hidden_v1';
const EVENT = 'promo-home-carousel-changed';

function storageKey(): string | null {
  const clubId =
    localStorage.getItem(STORAGE_KEYS.CLUB_ID) ||
    sessionStorage.getItem(STORAGE_KEYS.CLUB_ID);
  const playerId =
    localStorage.getItem(STORAGE_KEYS.PLAYER_ID) ||
    sessionStorage.getItem(STORAGE_KEYS.PLAYER_ID);
  if (!clubId || !playerId) return null;
  return `${PREFIX}:${clubId}:${playerId}`;
}

export function getHiddenPromotionIdsFromHomeCarousel(): Set<string> {
  const k = storageKey();
  if (!k) return new Set();
  try {
    const raw = localStorage.getItem(k);
    if (!raw) return new Set();
    const arr = JSON.parse(raw) as unknown;
    if (!Array.isArray(arr)) return new Set();
    return new Set(arr.map((x) => String(x)));
  } catch {
    return new Set();
  }
}

/** Hide from Game-tab carousel only; offers tab still lists the promotion until server expiry. */
export function hidePromotionFromHomeCarousel(promotionId: string) {
  const k = storageKey();
  if (!k || !promotionId) return;
  const s = getHiddenPromotionIdsFromHomeCarousel();
  s.add(String(promotionId));
  localStorage.setItem(k, JSON.stringify(Array.from(s)));
  window.dispatchEvent(new CustomEvent(EVENT));
}

export function unhidePromotionFromHomeCarousel(promotionId: string) {
  const k = storageKey();
  if (!k || !promotionId) return;
  const s = getHiddenPromotionIdsFromHomeCarousel();
  s.delete(String(promotionId));
  localStorage.setItem(k, JSON.stringify(Array.from(s)));
  window.dispatchEvent(new CustomEvent(EVENT));
}

export const PROMO_HOME_CAROUSEL_CHANGED_EVENT = EVENT;
