import { getActiveClubIdPreference, loadClubs } from "../../../data/club.js";
import { CLUB_DATA_KEY } from "../../../domain/clubStorage.js";
import { eventMatchToRecord } from "../../../tournament/engines/playerHistoryEngine.js";
import { resolveTenantIdForClub } from "../../tenant/guards/tenantGuard.js";
import { CLUB_MATCH_TYPES } from "../models/clubMatch.js";
import { addClubMatch } from "./clubMatchService.js";
import { applyClubMatchEloById } from "./clubEloService.js";
import { loadClubExtension } from "../storage/clubExtensionStorage.js";

function resolveWinnerTeam(scoreA, scoreB) {
  if (scoreA == null || scoreB == null) {
    return null;
  }
  if (Number(scoreA) > Number(scoreB)) {
    return "A";
  }
  if (Number(scoreB) > Number(scoreA)) {
    return "B";
  }
  return null;
}

function findExistingClubMatch(clubId, matchKey) {
  const ext = loadClubExtension(clubId);
  return (
    ext.matches.find(
      (m) => m.matchId === matchKey || m.id === matchKey
    ) || null
  );
}

/**
 * Ghi nhận trận giải nội bộ CLB + cập nhật ELO theo CLB (không đụng ELO blob).
 */
export function processClubInternalMatchCompletion(
  clubId,
  tournament,
  match,
  event,
  tenantId
) {
  if (!clubId || !tournament || !match) {
    return { ok: true, skipped: true, reason: "missing-data" };
  }

  const isClubInternal =
    tournament.type === "club_internal" ||
    (tournament.clubId && tournament.clubId === clubId);

  if (!isClubInternal) {
    return { ok: true, skipped: true, reason: "not-club-internal" };
  }

  const record = eventMatchToRecord(match, tournament, event);
  if (!record) {
    return { ok: true, skipped: true, reason: "match-not-finished" };
  }

  const matchKey = String(match.id);
  const existing = findExistingClubMatch(clubId, matchKey);
  if (existing?.eloApplied) {
    return { ok: true, skipped: true, reason: "already-processed", match: existing };
  }

  const effectiveTenantId = tenantId || tournament.tenantId || resolveTenantIdForClub(clubId);
  const winnerTeam = resolveWinnerTeam(record.scoreA, record.scoreB);

  let clubMatch = existing;
  if (!clubMatch) {
    const created = addClubMatch(
      clubId,
      {
        id: `cmatch-t-${matchKey}`,
        tournamentId: tournament.id,
        matchId: matchKey,
        type: CLUB_MATCH_TYPES.INTERNAL_TOURNAMENT,
        playedAt: record.date || match.completedAt || new Date().toISOString(),
        teamAPlayerIds: record.teamAPlayerIds,
        teamBPlayerIds: record.teamBPlayerIds,
        teamAScore: record.scoreA,
        teamBScore: record.scoreB,
        winnerTeam,
        eloApplied: false,
      },
      effectiveTenantId
    );
    if (!created.ok) {
      return created;
    }
    clubMatch = created.match;
  }

  if (winnerTeam && !clubMatch.eloApplied) {
    return applyClubMatchEloById(clubMatch.id, clubId, effectiveTenantId);
  }

  return { ok: true, match: clubMatch, skipped: !winnerTeam };
}

/**
 * Raw localStorage check — never call loadClubData here (that migrates/writes empty blobs).
 */
function rawClubBlobContainsTournament(clubId, tournamentId) {
  const resolvedClubId = String(clubId || "").trim();
  const id = String(tournamentId || "").trim();
  if (!resolvedClubId || !id || typeof localStorage === "undefined") {
    return false;
  }
  try {
    const raw = localStorage.getItem(`${CLUB_DATA_KEY}::${resolvedClubId}`);
    if (!raw) {
      return false;
    }
    const parsed = JSON.parse(raw);
    return (parsed?.tournaments || []).some((item) => String(item?.id) === id);
  } catch {
    return false;
  }
}

function listLocalClubBlobIds() {
  if (typeof localStorage === "undefined") {
    return [];
  }
  const prefix = `${CLUB_DATA_KEY}::`;
  const ids = [];
  for (let index = 0; index < localStorage.length; index += 1) {
    const key = localStorage.key(index);
    if (!key || !key.startsWith(prefix)) {
      continue;
    }
    const clubId = key.slice(prefix.length).trim();
    if (clubId) {
      ids.push(clubId);
    }
  }
  return ids;
}

export function findTournamentClubId(tournamentId) {
  const id = String(tournamentId || "").trim();
  if (!id) {
    return null;
  }

  const scanned = new Set();

  for (const club of loadClubs()) {
    const clubId = String(club?.id || "").trim();
    if (!clubId || scanned.has(clubId)) {
      continue;
    }
    scanned.add(clubId);
    if (rawClubBlobContainsTournament(clubId, id)) {
      return clubId;
    }
  }

  // Canonical preference may point at a club outside pickleball-clubs-v1.
  const preferredClubId = String(getActiveClubIdPreference() || "").trim();
  if (preferredClubId && !scanned.has(preferredClubId)) {
    scanned.add(preferredClubId);
    if (rawClubBlobContainsTournament(preferredClubId, id)) {
      return preferredClubId;
    }
  }

  // Preview/canonical: hosting blob may exist under an id not in registry/preference
  // (e.g. after refreshClubs coerces activeClub). Scan every local club blob key.
  for (const clubId of listLocalClubBlobIds()) {
    if (scanned.has(clubId)) {
      continue;
    }
    scanned.add(clubId);
    if (rawClubBlobContainsTournament(clubId, id)) {
      return clubId;
    }
  }

  return null;
}

/**
 * Resolve which club blob holds a tournament id.
 * Prefer the caller's club when it actually contains the tournament; otherwise scan
 * all clubs (parity with InternalTournamentSetup deep-link behavior).
 * Never returns a club that does not contain the tournament.
 *
 * @param {string|null|undefined} preferredClubId
 * @param {string|null|undefined} tournamentId
 * @returns {string|null}
 */
export function resolveTournamentClubId(preferredClubId, tournamentId) {
  const id = String(tournamentId || "").trim();
  if (!id) {
    return null;
  }

  const preferred = String(preferredClubId || "").trim();
  if (preferred && rawClubBlobContainsTournament(preferred, id)) {
    return preferred;
  }

  return findTournamentClubId(id);
}

/**
 * Empty-state copy when a tournament id is missing from the active origin's storage.
 * Preview/localStorage is origin-scoped — do not invent cross-origin lookups.
 * @param {string} tournamentId
 * @param {{ kind?: string }} [options]
 */
export function buildTournamentNotFoundMessage(tournamentId, options = {}) {
  const id = String(tournamentId || "").trim() || "(thiếu id)";
  const kind = options.kind || "giải";
  return (
    `Không tìm thấy ${kind} này trên CLB/blob hiện tại. ` +
    `Preview thường lưu dữ liệu theo trình duyệt — ID cũ (\`${id}\`) có thể đã mất sau khi redeploy, đổi domain Preview, hoặc đổi CLB. ` +
    `Hãy tạo lại giải trên Preview hiện tại (không dùng deep-link từ Preview cũ).`
  );
}
