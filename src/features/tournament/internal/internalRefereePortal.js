/**
 * Internal tournament-level referee portal (IT-E2E-BROWSER-018).
 * Reuses Team's tournament workspace pattern without MLP / parent-child /
 * Dreambreaker semantics. Scoring stays 016 ensure + shared live + 017 commit.
 */
import { MATCH_STATUS } from "../../../models/tournament/constants.js";
import { getRefereeSettings } from "../../../models/tournament/refereeRoster.js";
import { resolveCanonicalLoadPresentation } from "./internalWorkspaceSections.js";
import {
  isInternalRefereeAssignedToMatch,
  listInternalRefereeHubAssignments,
} from "./internalRefereeDiscovery.js";
import { buildInternalRefereePortalHref } from "./internalRefereeCanonicalPath.js";

export const INTERNAL_REFEREE_PORTAL_FILTER = Object.freeze({
  IN_PROGRESS: "in_progress",
  UPCOMING: "upcoming",
  COMPLETED: "completed",
});

const COMPLETED_STATUSES = new Set([
  MATCH_STATUS.COMPLETED,
  MATCH_STATUS.FORFEIT,
  "final",
  "locked",
]);

const IN_PROGRESS_STATUSES = new Set([
  MATCH_STATUS.PLAYING,
  "finalize_requested",
  "live",
]);

export function canAssignedInternalRefereeWriteMatch({
  user,
  match,
  roster = [],
  tournament,
} = {}) {
  if (!user?.id || !match) return false;
  const userTenant = String(user.venueId || user.tenantId || "").trim();
  const tournamentTenant = String(tournament?.tenantId || "").trim();
  if (userTenant && tournamentTenant && userTenant !== tournamentTenant) {
    return false;
  }
  return isInternalRefereeAssignedToMatch(user, match, roster);
}

export function classifyInternalRefereePortalBucket(match = {}) {
  const status = String(match.status || "").trim().toLowerCase();
  if (COMPLETED_STATUSES.has(status)) {
    return INTERNAL_REFEREE_PORTAL_FILTER.COMPLETED;
  }
  if (
    IN_PROGRESS_STATUSES.has(status) ||
    (Number(match.score1 || match.scoreA) > 0 || Number(match.score2 || match.scoreB) > 0)
  ) {
    return INTERNAL_REFEREE_PORTAL_FILTER.IN_PROGRESS;
  }
  return INTERNAL_REFEREE_PORTAL_FILTER.UPCOMING;
}

export function resolveInternalRefereePortalActionLabel(match = {}) {
  const bucket = classifyInternalRefereePortalBucket(match);
  if (bucket === INTERNAL_REFEREE_PORTAL_FILTER.COMPLETED) return "Xem kết quả";
  if (bucket === INTERNAL_REFEREE_PORTAL_FILTER.IN_PROGRESS) return "Tiếp tục";
  return "Chấm trận";
}

function scheduledMs(match) {
  const raw = match?.scheduledStart;
  if (!raw) return Number.MAX_SAFE_INTEGER;
  const value = Date.parse(raw);
  return Number.isFinite(value) ? value : Number.MAX_SAFE_INTEGER;
}

export function orderInternalRefereePortalMatches(matches = []) {
  const rank = {
    [INTERNAL_REFEREE_PORTAL_FILTER.IN_PROGRESS]: 0,
    [INTERNAL_REFEREE_PORTAL_FILTER.UPCOMING]: 1,
    [INTERNAL_REFEREE_PORTAL_FILTER.COMPLETED]: 2,
  };
  return [...(matches || [])].sort((left, right) => {
    const bucketDiff =
      rank[classifyInternalRefereePortalBucket(left)] -
      rank[classifyInternalRefereePortalBucket(right)];
    if (bucketDiff !== 0) return bucketDiff;
    const timeDiff = scheduledMs(left) - scheduledMs(right);
    if (timeDiff !== 0) return timeDiff;
    return String(left.matchId || "").localeCompare(String(right.matchId || ""), "vi");
  });
}

export function resolveNextInternalRefereeMatch(matches = []) {
  return (
    orderInternalRefereePortalMatches(matches).find(
      (match) =>
        classifyInternalRefereePortalBucket(match) !==
        INTERNAL_REFEREE_PORTAL_FILTER.COMPLETED
    ) || null
  );
}

export function resolveInternalRefereePortalStatusLabel(match = {}) {
  const bucket = classifyInternalRefereePortalBucket(match);
  if (bucket === INTERNAL_REFEREE_PORTAL_FILTER.COMPLETED) return "Đã chốt";
  if (bucket === INTERNAL_REFEREE_PORTAL_FILTER.IN_PROGRESS) return "Đang diễn ra";
  return "Sẵn sàng";
}

export function formatInternalRefereePortalScore(match = {}) {
  const scoreA = Number(match.score1 ?? match.scoreA) || 0;
  const scoreB = Number(match.score2 ?? match.scoreB) || 0;
  if (
    classifyInternalRefereePortalBucket(match) ===
      INTERNAL_REFEREE_PORTAL_FILTER.COMPLETED ||
    scoreA > 0 ||
    scoreB > 0
  ) {
    return `${scoreA}–${scoreB}`;
  }
  return "—";
}

export function decorateInternalRefereePortalMatch(match = {}, { nextMatchId } = {}) {
  const bucket = classifyInternalRefereePortalBucket(match);
  return {
    ...match,
    bucket,
    actionLabel: resolveInternalRefereePortalActionLabel(match),
    statusLabel: resolveInternalRefereePortalStatusLabel(match),
    scoreLabel: formatInternalRefereePortalScore(match),
    isNext: Boolean(nextMatchId) && String(match.matchId) === String(nextMatchId),
    canWrite: bucket !== INTERNAL_REFEREE_PORTAL_FILTER.COMPLETED,
  };
}

export function listInternalRefereePortalAssignments({
  tournament,
  user,
} = {}) {
  if (!user?.id) {
    return { ok: false, code: "NOT_AUTHENTICATED", matches: [], nextMatch: null };
  }
  if (!tournament) {
    return { ok: false, code: "NOT_FOUND", matches: [], nextMatch: null };
  }
  const userTenant = String(user.venueId || user.tenantId || "").trim();
  const tournamentTenant = String(tournament.tenantId || "").trim();
  if (userTenant && tournamentTenant && userTenant !== tournamentTenant) {
    return { ok: false, code: "CROSS_TENANT", matches: [], nextMatch: null };
  }

  const roster = getRefereeSettings(tournament).roster || [];
  const discovered = listInternalRefereeHubAssignments({
    tournaments: [tournament],
    user,
    clubId: tournament.clubId,
    tenantId: tournament.tenantId,
  });
  if (!discovered.ok) {
    return { ...discovered, nextMatch: null };
  }

  const assigned = (discovered.matches || []).filter((item) => {
    const event = tournament.events?.[0];
    const match = (event?.matches || []).find(
      (row) => String(row.id) === String(item.matchId)
    );
    return canAssignedInternalRefereeWriteMatch({
      user,
      match,
      roster,
      tournament,
    });
  });
  const ordered = orderInternalRefereePortalMatches(assigned);
  const nextMatch = resolveNextInternalRefereeMatch(ordered);
  return {
    ok: true,
    tournamentId: tournament.id,
    tournamentName: tournament.name || tournament.id,
    portalHref: buildInternalRefereePortalHref({
      tournamentId: tournament.id,
      clubId: tournament.clubId,
    }),
    matches: ordered.map((match) =>
      decorateInternalRefereePortalMatch(match, { nextMatchId: nextMatch?.matchId })
    ),
    nextMatch,
  };
}

export function resolveInternalRefereePortalLoadPresentation({ hasPortal } = {}) {
  return resolveCanonicalLoadPresentation({ hasTournament: Boolean(hasPortal) });
}

export function projectInternalRefereePortalAfterCommit({
  tournament,
  user,
  completedMatchId,
  scoreA,
  scoreB,
} = {}) {
  if (!tournament) return { ok: false };
  const event = tournament.events?.[0];
  const nextEvent = {
    ...event,
    matches: (event?.matches || []).map((match) =>
      String(match.id) === String(completedMatchId)
        ? {
            ...match,
            scoreA,
            scoreB,
            status: MATCH_STATUS.COMPLETED,
          }
        : match
    ),
  };
  const nextTournament = { ...tournament, events: [nextEvent] };
  return {
    ok: true,
    tournament: nextTournament,
    portal: listInternalRefereePortalAssignments({
      tournament: nextTournament,
      user,
    }),
  };
}
