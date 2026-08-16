/**
 * Browser production composition.
 *
 * Authenticated user only. Never constructs privileged live RPC composition.
 * Commands require an injected Adapter B runtime (tests / future user-auth driver).
 * Reads may use the user Supabase client against CORE-13 tables (RLS).
 */

import { CANONICAL_REFEREE_PERSISTENCE_TABLES } from "../../competition-engine/integration/referee/constants.js";
import { REFEREE_UI_ERROR_CODE } from "../constants.js";
import { buildRefereeAssignmentCard } from "../projection/buildRefereeAssignmentCard.js";
import {
  assertRefereeUiSecurity,
  rejectProductionFixtureFallback,
} from "./assertProductionUiSecurity.js";
import { createCanonicalRefereeApplicationClient } from "./createCanonicalRefereeApplicationClient.js";

async function failClosedCommand() {
  const err = new Error(
    "Canonical Referee command requires Adapter B runtime; silent legacy/V5 scoring fallback is forbidden"
  );
  err.code = REFEREE_UI_ERROR_CODE.COMMAND_UNAVAILABLE;
  err.failClosed = true;
  err.silentLegacyFallback = false;
  throw err;
}

function mapAssignmentRow(row) {
  return {
    tenantId: row.tenant_id,
    competitionId: row.tournament_id || row.competition_id,
    matchId: row.match_id,
    refereeUserId: row.referee_user_id,
    courtId: row.court_id || null,
    status: row.status === "revoked" ? "RELEASED" : "ASSIGNED",
    opsStatus: row.status === "revoked" ? "RELEASED" : "ASSIGNED",
    assignedAt: row.assigned_at || null,
    scheduledAt: row.assigned_at || null,
  };
}

/**
 * @param {{
 *   runtime?: object,
 *   actor?: object,
 *   env?: Record<string, unknown>,
 *   userClient?: { from: Function }|null,
 *   modeStateResolver?: Function,
 *   participantNameResolver?: Function,
 * }} [options]
 */
export function createBrowserRefereeApplicationClient(options = {}) {
  assertRefereeUiSecurity(options.env);
  rejectProductionFixtureFallback(options);

  if (options.runtime) {
    return createCanonicalRefereeApplicationClient(options);
  }

  const userClient = options.userClient || null;
  const actor = options.actor || null;

  async function listMyAssignments(command = {}) {
    const tenantId = String(command.tenantId || "").trim();
    const refereeUserId = String(
      command.actor?.actorId || actor?.actorId || ""
    ).trim();
    if (!userClient || !tenantId || !refereeUserId) {
      return Object.freeze({
        ok: true,
        assignments: Object.freeze([]),
        usesAdapterB: true,
        silentLegacyFallback: false,
        locationStateRequired: false,
        productionFixtureFallback: false,
        readOnly: true,
      });
    }
    const { data, error } = await userClient
      .from(CANONICAL_REFEREE_PERSISTENCE_TABLES.ASSIGNMENTS)
      .select("*")
      .eq("tenant_id", tenantId)
      .eq("referee_user_id", refereeUserId)
      .eq("status", "active");
    if (error) {
      return Object.freeze({
        ok: false,
        error: error.message,
        assignments: Object.freeze([]),
        usesAdapterB: true,
        silentLegacyFallback: false,
        locationStateRequired: false,
        productionFixtureFallback: false,
      });
    }
    const cards = (data || []).map((row) => {
      const assignment = mapAssignmentRow(row);
      return buildRefereeAssignmentCard({
        assignment,
        competitionMode: row.competition_mode || "",
        competitionContext: { competitionId: assignment.competitionId },
        matchContext: { matchId: assignment.matchId, courtId: assignment.courtId },
        participants: { sides: [] },
      });
    });
    return Object.freeze({
      ok: true,
      assignments: Object.freeze(cards),
      usesAdapterB: true,
      silentLegacyFallback: false,
      locationStateRequired: false,
      productionFixtureFallback: false,
      readOnly: true,
    });
  }

  async function getMatchView() {
    const err = new Error(
      "Deep-link match view requires canonical Adapter B runtime; no location.state and no fixture fallback"
    );
    err.code = REFEREE_UI_ERROR_CODE.COMMAND_UNAVAILABLE;
    err.locationStateRequired = false;
    err.productionFixtureFallback = false;
    err.silentLegacyFallback = false;
    throw err;
  }

  return Object.freeze({
    kind: "browser-referee-application-client",
    usesAdapterB: true,
    silentLegacyFallback: false,
    productionFixtureFallback: false,
    locationStateRequired: false,
    serviceRoleInBrowser: false,
    directPrivilegedRpcFromBrowser: false,
    readOnly: true,
    listMyAssignments,
    getMatchView,
    acknowledgeAssignment: failClosedCommand,
    openAssignedMatch: failClosedCommand,
    startScoreSession: failClosedCommand,
    startMatch: failClosedCommand,
    submitPoint: failClosedCommand,
    suspendMatch: failClosedCommand,
    resumeMatch: failClosedCommand,
    confirmChangeEnds: failClosedCommand,
    switchPositions: failClosedCommand,
    submitResult: failClosedCommand,
    correctResult: failClosedCommand,
  });
}
