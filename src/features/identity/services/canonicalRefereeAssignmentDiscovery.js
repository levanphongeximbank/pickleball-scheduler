/**
 * Shared CORE-13 discovery for authenticated referee hub (/referee).
 * Filters durable active assignments by auth.uid — no fuzzy name/email.
 */

import { loadAIData } from "../../../ai/storage.js";
import { getCurrentUser } from "../../../auth/authService.js";
import { ROLES, normalizeRole } from "../constants/roles.js";
import { PERMISSIONS } from "../constants/permissions.js";
import { can } from "../../../auth/rbac.js";
import { isRbacEnabled } from "../../../auth/authService.js";
import {
  ASSIGNMENT_COMPETITION_MODE,
  createCompetitionRefereeAssignmentTrustedClient,
  resolveCompetitionAssignmentEdgeBaseUrl,
} from "../../competition-engine/operations/referee/assignment/index.js";
import { getSupabaseAuthClient } from "../../../auth/supabaseClient.js";
import { collectEventMatches } from "../../individual-tournament/engines/refereeAssignEngine.js";
import { resolveMatchLabels } from "../../../tournament/engines/refereeEngine.js";

function collectTournaments(aiData) {
  const tournaments = aiData?.tournaments || {};
  return Object.entries(tournaments).map(([id, tournament]) => ({
    id,
    ...tournament,
  }));
}

function resolveCompetitionMode(tournament) {
  const type = String(tournament?.type || tournament?.competitionType || "").toLowerCase();
  if (type.includes("official") || type.includes("open")) {
    return ASSIGNMENT_COMPETITION_MODE.OFFICIAL_OPEN;
  }
  if (type.includes("daily")) {
    return ASSIGNMENT_COMPETITION_MODE.DAILY_PLAY;
  }
  if (type.includes("team")) {
    return ASSIGNMENT_COMPETITION_MODE.TEAM;
  }
  return ASSIGNMENT_COMPETITION_MODE.INTERNAL;
}

function createAssignmentClient() {
  return createCompetitionRefereeAssignmentTrustedClient({
    edgeBaseUrl: resolveCompetitionAssignmentEdgeBaseUrl(),
    getAccessToken: async () => {
      const client = getSupabaseAuthClient();
      const { data } = (await client?.auth.getSession()) || {};
      return data?.session?.access_token || null;
    },
  });
}

function findMatchPresentation(tournament, matchId) {
  const matches = collectEventMatches(tournament);
  const match = matches.find((m) => String(m.id) === String(matchId));
  if (!match) return null;
  const entries = [];
  (tournament.events || []).forEach((event) => {
    (event.entries || []).forEach((entry) => entries.push(entry));
  });
  const labels = resolveMatchLabels(match, { entries });
  return {
    match,
    team1Name: labels.entryALabel || match.team1Name || "Đội A",
    team2Name: labels.entryBLabel || match.team2Name || "Đội B",
    courtId: match.courtId || null,
    scheduledStart: match.scheduledStart || match.scheduledAt || null,
    status: match.status || "scheduled",
  };
}

/**
 * Canonical discovery: CORE-13 listActiveAssignments filtered by actor uid.
 */
export async function listCanonicalRefereeAssignmentsForActor({ clubId } = {}) {
  const user = getCurrentUser();
  if (!user?.id) {
    return { ok: false, error: "Chưa đăng nhập.", code: "NOT_AUTHENTICATED", matches: [] };
  }

  const rbacOn = { rbacEnabled: isRbacEnabled() };
  const isReferee =
    normalizeRole(user.role) === ROLES.REFEREE ||
    can(user, PERMISSIONS.MATCH_UPDATE, { clubId, venueId: user.venueId }, rbacOn);

  if (isRbacEnabled() && !isReferee) {
    return { ok: false, error: "Chỉ dành cho trọng tài.", code: "FORBIDDEN", matches: [] };
  }

  if (!clubId) {
    return { ok: true, matches: [], source: "core13" };
  }

  const aiData = loadAIData(clubId);
  const tournaments = collectTournaments(aiData);
  const api = createAssignmentClient();
  const actorId = String(user.id);
  const matches = [];

  for (const tournament of tournaments) {
    const tenantId = String(tournament.tenantId || tournament.clubId || clubId || "").trim();
    const tournamentId = String(tournament.id || tournament.tournamentId || "").trim();
    if (!tenantId || !tournamentId) continue;

    let listRes;
    try {
      listRes = await api.listActiveAssignments({
        tenantId,
        tournamentId,
        competitionMode: resolveCompetitionMode(tournament),
        refereeFeatureEnabled: true,
      });
    } catch {
      continue;
    }
    if (listRes?.ok === false) continue;
    const assignments = Array.isArray(listRes?.assignments)
      ? listRes.assignments
      : Array.isArray(listRes)
        ? listRes
        : [];

    for (const row of assignments) {
      const refereeId = String(row.refereeId || row.refereeUserId || "").trim();
      if (!refereeId || refereeId !== actorId) continue;
      if (row.status && String(row.status).toLowerCase() !== "active") continue;

      const presentation = findMatchPresentation(tournament, row.matchId);
      matches.push({
        matchId: String(row.matchId),
        tournamentId,
        tournamentName: tournament.name || tournamentId,
        tenantId,
        courtId: presentation?.courtId || null,
        refereeToken: presentation?.match?.referee?.token || null,
        refereeName: row.refereeDisplayName || user.displayName || "",
        team1Name: presentation?.team1Name || "Đội A",
        team2Name: presentation?.team2Name || "Đội B",
        score1: presentation?.match?.score1 ?? 0,
        score2: presentation?.match?.score2 ?? 0,
        status: presentation?.status || "assigned",
        scheduledStart: presentation?.scheduledStart || null,
        assignmentId: row.id || row.assignmentId || null,
        source: "core13",
      });
    }
  }

  return { ok: true, matches, source: "core13" };
}
