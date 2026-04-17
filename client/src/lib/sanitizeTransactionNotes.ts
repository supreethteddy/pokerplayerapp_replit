const LEGACY_CREDIT_REQUEST_UUID =
  /\s*[—–-]\s*request\s+[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;
const LEGACY_REQUEST_UUID = /\s+request\s+[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;

/** Strip internal credit-request UUIDs from notes shown to players/staff */
export function sanitizeTransactionNotesForDisplay(text: string | null | undefined): string {
  if (text == null || typeof text !== 'string') return '';
  return text
    .replace(LEGACY_CREDIT_REQUEST_UUID, '')
    .replace(LEGACY_REQUEST_UUID, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}
