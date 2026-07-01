import { guardClubTenant } from "../../tenant/guards/tenantGuard.js";
import { normalizeClubMatch } from "../models/clubMatch.js";
import { loadClubExtension, saveClubExtension } from "../storage/clubExtensionStorage.js";

export function getClubMatches(clubId, tenantId) {
  if (tenantId) {
    const check = guardClubTenant(clubId, tenantId);
    if (!check.ok) {
      return [];
    }
  }

  const ext = loadClubExtension(clubId);
  return ext.matches.sort(
    (a, b) => new Date(b.playedAt).getTime() - new Date(a.playedAt).getTime()
  );
}

export function addClubMatch(clubId, data, tenantId) {
  if (tenantId) {
    const check = guardClubTenant(clubId, tenantId);
    if (!check.ok) {
      return check;
    }
  }

  const ext = loadClubExtension(clubId);
  const match = normalizeClubMatch({
    ...data,
    tenantId,
    clubId,
  });

  const matches = [...ext.matches, match];
  saveClubExtension(clubId, { ...ext, matches });
  return { ok: true, match };
}

export function markClubMatchEloApplied(clubId, matchId) {
  const ext = loadClubExtension(clubId);
  const matches = ext.matches.map((m) =>
    m.id === matchId
      ? normalizeClubMatch({ ...m, eloApplied: true, updatedAt: new Date().toISOString() })
      : m
  );

  saveClubExtension(clubId, { ...ext, matches });
  return { ok: true };
}
