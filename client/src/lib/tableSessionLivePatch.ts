/**
 * Instant UI sync from `table:status-changed` payloads (table.notes match backend).
 * Patches React Query playtime cache without waiting for HTTP round-trip.
 */

import type { QueryClient } from '@tanstack/react-query';

export type TableStatusSocketPayload = {
  clubId?: string;
  table?: {
    id?: string;
    notes?: string | null;
    status?: string;
    tableNumber?: number;
  };
};

function isStaffPausedNotes(notes: string): boolean {
  return /Paused Elapsed:\s*\d+/i.test(notes) && !/Session Started:/i.test(notes);
}

function parsePausedElapsedTotal(notes: string): number {
  const m = notes.match(/Paused Elapsed:\s*(\d+)/i);
  return m ? Math.max(0, parseInt(m[1], 10) || 0) : 0;
}

/** PausedPlayers (pause) or PlayerCarry (running) blob */
function parsePlayerSnapSeconds(notes: string, playerId: string): number | null {
  const pid = playerId.toLowerCase();
  const block =
    notes.match(/PausedPlayers:([^|]+)/i)?.[1] ?? notes.match(/PlayerCarry:([^|]+)/i)?.[1];
  if (!block) return null;
  for (const part of block.split(',')) {
    const m = part.trim().match(/^([0-9a-f-]{36})=(\d+)$/i);
    if (m && m[1].toLowerCase() === pid) return Math.max(0, parseInt(m[2], 10) || 0);
  }
  return null;
}

function approxRunningDurationSec(notes: string, playerId: string): number | null {
  const startM = notes.match(/Session Started:\s*([^|]+)/i);
  if (!startM?.[1]) return null;
  const t = new Date(startM[1].trim());
  if (Number.isNaN(t.getTime())) return null;
  const carry = parsePausedElapsedTotal(notes);
  const base = parsePlayerSnapSeconds(notes, playerId);
  if (base != null) {
    return Math.max(0, base + Math.floor((Date.now() - t.getTime()) / 1000));
  }
  // No per-player carry in notes: table-level approximation until HTTP refetch.
  return Math.max(0, carry + Math.floor((Date.now() - t.getTime()) / 1000));
}

type PlaytimeCache = { hasActiveSession: boolean; session: Record<string, unknown> | null };

export function patchPlaytimeCachesFromTableSocket(
  queryClient: QueryClient,
  playerId: string,
  payload: TableStatusSocketPayload,
): void {
  const table = payload?.table;
  if (!table?.id || typeof table.notes !== 'string') return;

  const notes = table.notes;
  const staffPaused = isStaffPausedNotes(notes);

  const queries = queryClient.getQueriesData<PlaytimeCache>({
    queryKey: ['/api/player-playtime/current'],
  });

  for (const [queryKey, old] of queries) {
    if (!old?.hasActiveSession || !old.session) continue;
    if (String(old.session.tableId) !== String(table.id)) continue;

    const now = Date.now();
    if (staffPaused) {
      const duration =
        parsePlayerSnapSeconds(notes, playerId) ?? parsePausedElapsedTotal(notes);
      const sessionStartTime = new Date(now - duration * 1000).toISOString();
      queryClient.setQueryData<PlaytimeCache>(queryKey, {
        ...old,
        session: {
          ...old.session,
          staffSessionPaused: true,
          isLive: false,
          sessionDuration: duration,
          sessionStartTime,
          startedAt: sessionStartTime,
        },
      });
      continue;
    }

    const approx = approxRunningDurationSec(notes, playerId);
    const sessionStartTime =
      approx != null ? new Date(now - approx * 1000).toISOString() : (old.session.sessionStartTime as string);
    queryClient.setQueryData<PlaytimeCache>(queryKey, {
      ...old,
      session: {
        ...old.session,
        staffSessionPaused: false,
        isLive: true,
        ...(approx != null
          ? { sessionDuration: approx, sessionStartTime, startedAt: sessionStartTime }
          : {}),
      },
    });
  }
}
