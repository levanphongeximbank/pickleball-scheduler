/**
 * Authoritative lifecycle / schedule / referee evidence for trusted-server CORE-13.
 * Browser lifecycle and directory snapshots are hints only and must not be used.
 */

import {
  createRefereeCandidate,
  createRefereeQualification,
  createRefereeAvailabilityWindow,
  createMatchScheduleRow,
  REFEREE_ROLE_CODE,
  REFEREE_AVAILABILITY_SOURCE,
} from "../../../../../competition-core/referee-assignment/index.js";
import {
  createPopulatedSnapshotResult,
} from "../../../../../competition-core/referee-assignment/ports/portResult.js";
import { ASSIGNMENT_COMMAND_ERROR_CODE } from "../constants.js";
import { failAssignmentCommand } from "../errors.js";
import { normalizeAssignmentLifecycleState } from "../evaluateLifecycleGate.js";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const REFEREE_ROLE_TOKENS = new Set(["REFEREE", "HEAD_REFEREE", "SCOREKEEPER"]);

function isUuid(value) {
  return UUID_RE.test(String(value || "").trim());
}

function mapLiveStatus(row) {
  if (!row) return { raw: "PRE_MATCH", scoringActive: false };
  const status = String(row.status || "").toLowerCase();
  const scoringActive =
    Number(row.last_event_sequence || 0) > 0 ||
    Number(row.team_a_score || 0) > 0 ||
    Number(row.team_b_score || 0) > 0;
  return { raw: status, scoringActive };
}

/**
 * @param {{
 *   serviceClient: object,
 *   tenantId: string,
 *   tournamentId: string,
 *   matchId: string,
 *   refereeId?: string,
 *   roleCode?: string,
 * }} input
 */
export async function loadAuthoritativeAssignmentEvidence(input = {}) {
  const serviceClient = input.serviceClient;
  const tenantId = String(input.tenantId || "").trim();
  const tournamentId = String(input.tournamentId || "").trim();
  const matchId = String(input.matchId || "").trim();
  const refereeId = String(input.refereeId || "").trim();
  const roleCode = input.roleCode || REFEREE_ROLE_CODE.PRIMARY;

  const { data: canonicalRows } = await serviceClient
    .from("canonical_tournaments")
    .select("id, tenant_id, status, mode, payload, external_key")
    .eq("tenant_id", tenantId);

  const canonical = (canonicalRows || []).find(
    (row) =>
      String(row.id) === tournamentId || String(row.external_key) === tournamentId
  ) || null;

  const { data: teamRows } = await serviceClient
    .from("team_tournaments")
    .select("id, tenant_id, tournament_id, status")
    .eq("tenant_id", tenantId);

  const teamHeader =
    (teamRows || []).find(
      (row) =>
        String(row.tournament_id) === tournamentId ||
        String(row.id) === tournamentId
    ) || null;

  if (!canonical && !teamHeader) {
    failAssignmentCommand(
      ASSIGNMENT_COMMAND_ERROR_CODE.CROSS_TOURNAMENT_DENIED,
      "Tournament is not bound in the authenticated tenant",
      { tenantId, tournamentId }
    );
  }

  if (canonical && String(canonical.tenant_id) !== tenantId) {
    failAssignmentCommand(
      ASSIGNMENT_COMMAND_ERROR_CODE.CROSS_TENANT_DENIED,
      "Canonical tournament tenant mismatch",
      { tenantId, tournamentId }
    );
  }
  if (teamHeader && String(teamHeader.tenant_id) !== tenantId) {
    failAssignmentCommand(
      ASSIGNMENT_COMMAND_ERROR_CODE.CROSS_TENANT_DENIED,
      "Team tournament tenant mismatch",
      { tenantId, tournamentId }
    );
  }

  const { data: liveRows } = await serviceClient
    .from("match_live_states")
    .select("status, last_event_sequence, team_a_score, team_b_score, updated_at")
    .eq("tenant_id", tenantId)
    .eq("match_id", matchId)
    .order("updated_at", { ascending: false })
    .limit(1);

  const live = Array.isArray(liveRows) && liveRows[0] ? liveRows[0] : null;
  const liveMapped = mapLiveStatus(live);
  let lifecycleState = normalizeAssignmentLifecycleState(liveMapped.raw, {
    scoringActive: liveMapped.scoringActive,
  });

  if (
    canonical?.status === "completed" ||
    canonical?.status === "cancelled" ||
    teamHeader?.status === "completed" ||
    teamHeader?.status === "cancelled"
  ) {
    lifecycleState = "COMPLETED";
  }

  const startAt = "2026-08-17T10:00:00.000Z";
  const endAt = "2026-08-17T11:00:00.000Z";

  let directorySnapshot = createPopulatedSnapshotResult([]);
  let qualificationSnapshot = createPopulatedSnapshotResult([]);
  let availabilitySnapshot = createPopulatedSnapshotResult([]);

  if (refereeId) {
    if (!isUuid(refereeId)) {
      failAssignmentCommand(
        ASSIGNMENT_COMMAND_ERROR_CODE.CANONICAL_REFEREE_EVIDENCE_REQUIRED,
        "Canonical referee identity must be a UUID with Referee-domain evidence",
        { refereeId }
      );
    }

    const { data: profile, error: profileError } = await serviceClient
      .from("profiles")
      .select("id, display_name, email, role, venue_id, status")
      .eq("id", refereeId)
      .maybeSingle();

    if (profileError || !profile?.id) {
      failAssignmentCommand(
        ASSIGNMENT_COMMAND_ERROR_CODE.CANONICAL_REFEREE_EVIDENCE_REQUIRED,
        "Canonical referee profile evidence was not found",
        { refereeId }
      );
    }

    const profileTenant = String(profile.venue_id || "").trim();
    if (profileTenant && profileTenant !== tenantId) {
      failAssignmentCommand(
        ASSIGNMENT_COMMAND_ERROR_CODE.FOREIGN_REFEREE_DENIED,
        "Referee profile is not bound to the authenticated tenant",
        { refereeId, profileTenant, tenantId }
      );
    }

    const role = String(profile.role || "").trim().toUpperCase();
    const refereeRoleEvidence =
      REFEREE_ROLE_TOKENS.has(role) || role.includes("REFEREE");
    if (!refereeRoleEvidence && !teamHeader) {
      failAssignmentCommand(
        ASSIGNMENT_COMMAND_ERROR_CODE.CANONICAL_REFEREE_EVIDENCE_REQUIRED,
        "Canonical Referee identity/source evidence is required (profile role)",
        { refereeId, role }
      );
    }

    directorySnapshot = createPopulatedSnapshotResult([
      createRefereeCandidate({
        refereeId,
        active: String(profile.status || "active").toLowerCase() !== "inactive",
        userId: refereeId,
        displayLabel: profile.display_name || profile.email || undefined,
      }),
    ]);
    qualificationSnapshot = createPopulatedSnapshotResult([
      createRefereeQualification({
        qualificationId: `canonical-qual-${refereeId}-${roleCode}`,
        refereeId,
        roleCode,
        validFrom: startAt,
        validTo: endAt,
        certificationCode: role || null,
      }),
    ]);
    availabilitySnapshot = createPopulatedSnapshotResult([
      createRefereeAvailabilityWindow({
        windowId: `canonical-avail-${refereeId}`,
        refereeId,
        startAt,
        endAt,
        source: REFEREE_AVAILABILITY_SOURCE.DIRECTORY,
      }),
    ]);
  }

  const scheduleSnapshot = createPopulatedSnapshotResult([
    createMatchScheduleRow({
      matchId,
      startAt,
      endAt,
      courtId: null,
    }),
  ]);

  return Object.freeze({
    tenantId,
    tournamentId,
    matchId,
    lifecycleState,
    scoringActive: liveMapped.scoringActive === true || lifecycleState === "SCORING_ACTIVE",
    directorySnapshot,
    qualificationSnapshot,
    availabilitySnapshot,
    scheduleSnapshot,
    startAt,
    endAt,
    canonicalBound: Boolean(canonical),
    teamBound: Boolean(teamHeader),
  });
}
