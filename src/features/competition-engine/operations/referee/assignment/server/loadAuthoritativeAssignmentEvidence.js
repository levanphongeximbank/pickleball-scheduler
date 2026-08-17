/**
 * Authoritative lifecycle / schedule / referee evidence for trusted-server CORE-13.
 *
 * Topology:
 *   Identity/Auth domain
 *     → Canonical Competition Identity Contract #01 / Adapter B
 *     → RefereeDirectoryPort (translate only)
 *   Contract #08 Adapter B → match schedule / court / competition context
 *   CORE-13 ← snapshots (never browser-supplied)
 *
 * Adapter B (#08) does not own referee identity/qualification/availability.
 * Qualification and availability are classified NOT_CONFIGURED unless a
 * requirement profile explicitly requires them (then fail closed).
 * Referee identity is Contract #01 resolveSubjectIdentity only.
 */

import {
  createEmptySnapshotResult,
} from "../../../../../competition-core/referee-assignment/ports/portResult.js";
import { REFEREE_ROLE_CODE } from "../../../../../competition-core/referee-assignment/index.js";
import { ASSIGNMENT_COMMAND_ERROR_CODE } from "../constants.js";
import { failAssignmentCommand } from "../errors.js";
import { normalizeAssignmentLifecycleState } from "../evaluateLifecycleGate.js";
import { createIdentityBackedRefereeDirectoryPort } from "./createIdentityBackedRefereeDirectoryPort.js";
import { createTrustedServerIdentityAccessAdapter } from "./createTrustedServerIdentityAccessAdapter.js";
import {
  createNotConfiguredAvailabilitySnapshot,
  createNotConfiguredQualificationSnapshot,
  createRequiredMissingAvailabilitySnapshot,
  createRequiredMissingQualificationSnapshot,
  REFEREE_EVIDENCE_CAPABILITY,
} from "./createNotConfiguredRefereeEvidencePorts.js";
import { createTrustedServerRefereeAdapterB } from "./createTrustedServerRefereeAdapterB.js";
import {
  createUnscheduledMatchSnapshot,
  projectMatchScheduleFromAdapterB,
} from "./projectMatchScheduleFromAdapterB.js";

function mapLiveStatus(row) {
  if (!row) return { raw: "PRE_MATCH", scoringActive: false };
  const status = String(row.status || "").toLowerCase();
  const scoringActive =
    Number(row.last_event_sequence || 0) > 0 ||
    Number(row.team_a_score || 0) > 0 ||
    Number(row.team_b_score || 0) > 0;
  return { raw: status, scoringActive };
}

async function loadTournamentRows(serviceClient, tenantId) {
  const { data: canonicalRows } = await serviceClient
    .from("canonical_tournaments")
    .select("id, tenant_id, club_id, status, mode, payload, external_key")
    .eq("tenant_id", tenantId);

  const { data: teamRows } = await serviceClient
    .from("team_tournaments")
    .select("id, tenant_id, tournament_id, status, payload")
    .eq("tenant_id", tenantId);

  return { canonicalRows: canonicalRows || [], teamRows: teamRows || [] };
}

function bindTournament(canonicalRows, teamRows, tenantId, tournamentId) {
  const canonical =
    canonicalRows.find(
      (row) =>
        String(row.id) === tournamentId || String(row.external_key) === tournamentId
    ) || null;
  const teamHeader =
    teamRows.find(
      (row) =>
        String(row.tournament_id) === tournamentId || String(row.id) === tournamentId
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
  return { canonical, teamHeader };
}

function resolveScheduleFromAdapterB({
  adapterRuntime,
  tenantId,
  tournamentId,
  matchId,
}) {
  const request = {
    tenantId,
    competitionId: tournamentId,
    matchId,
  };
  try {
    const matchContext = adapterRuntime.adapter.getMatchContext(request);
    const modeMatch =
      adapterRuntime.modeState?.matches?.[matchId] ||
      adapterRuntime.modeState?.matchups?.[matchId] ||
      null;
    return projectMatchScheduleFromAdapterB({
      matchContext,
      modeMatch,
      matchId,
    });
  } catch (err) {
    if (adapterRuntime.isRefereeAdapterContractError(err)) {
      return createUnscheduledMatchSnapshot(matchId);
    }
    throw err;
  }
}

/**
 * @param {{
 *   serviceClient: object,
 *   tenantId: string,
 *   tournamentId: string,
 *   matchId: string,
 *   refereeId?: string,
 *   roleCode?: string,
 *   competitionMode?: string,
 *   requireQualification?: boolean,
 *   requireAvailability?: boolean,
 *   identityAccessAdapter?: object,
 *   actorId?: string,
 *   loadIdentitySubjectById?: Function,
 *   getAuthClient?: Function,
 * }} input
 */
export async function loadAuthoritativeAssignmentEvidence(input = {}) {
  const serviceClient = input.serviceClient;
  const tenantId = String(input.tenantId || "").trim();
  const tournamentId = String(input.tournamentId || "").trim();
  const matchId = String(input.matchId || "").trim();
  const refereeId = String(input.refereeId || "").trim();
  const actorId = String(input.actorId || "").trim();
  const roleCode = input.roleCode || REFEREE_ROLE_CODE.PRIMARY;
  const competitionMode = String(input.competitionMode || "INTERNAL").toUpperCase();
  const requireQualification = input.requireQualification === true;
  const requireAvailability = input.requireAvailability === true;

  const { canonicalRows, teamRows } = await loadTournamentRows(
    serviceClient,
    tenantId
  );
  const { canonical, teamHeader } = bindTournament(
    canonicalRows,
    teamRows,
    tenantId,
    tournamentId
  );

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

  const adapterRuntime = createTrustedServerRefereeAdapterB({
    tenantId,
    tournamentId,
    competitionMode: teamHeader ? "TEAM" : competitionMode,
    canonical,
    teamHeader,
  });

  const schedule = matchId
    ? resolveScheduleFromAdapterB({
        adapterRuntime,
        tenantId,
        tournamentId,
        matchId,
      })
    : createUnscheduledMatchSnapshot("missing-match");

  const identityAccessAdapter =
    input.identityAccessAdapter ||
    createTrustedServerIdentityAccessAdapter({
      tenantId,
      getAuthClient:
        typeof input.getAuthClient === "function"
          ? input.getAuthClient
          : () => serviceClient,
      loadIdentitySubjectById: input.loadIdentitySubjectById,
    });
  const directoryPort = createIdentityBackedRefereeDirectoryPort({
    identityAccessAdapter,
  });
  let directorySnapshot = createEmptySnapshotResult(
    "No refereeId supplied for Identity directory lookup"
  );
  if (refereeId) {
    directorySnapshot = await directoryPort.resolveRefereeDirectory({
      tenantId,
      tournamentId,
      refereeId,
      actorId,
      roleCode,
    });
  }

  const qualificationSnapshot = requireQualification
    ? createRequiredMissingQualificationSnapshot()
    : createNotConfiguredQualificationSnapshot();
  const availabilitySnapshot = requireAvailability
    ? createRequiredMissingAvailabilitySnapshot()
    : createNotConfiguredAvailabilitySnapshot();

  return Object.freeze({
    tenantId,
    tournamentId,
    matchId,
    lifecycleState,
    scoringActive:
      liveMapped.scoringActive === true || lifecycleState === "SCORING_ACTIVE",
    directorySnapshot,
    qualificationSnapshot,
    availabilitySnapshot,
    scheduleSnapshot: schedule.scheduleSnapshot,
    startAt: schedule.startAt,
    endAt: schedule.endAt,
    courtId: schedule.courtId,
    scheduled: schedule.scheduled === true,
    assignmentBeforeSchedule: schedule.assignmentBeforeSchedule === true,
    canonicalBound: Boolean(canonical),
    teamBound: Boolean(teamHeader),
    clubId: canonical?.club_id || null,
    canonicalId: canonical?.id || null,
    adapterBReused: true,
    adapterBContractId: adapterRuntime.contractId,
    adapterBOwnsRefereeIdentity: false,
    refereeIdentityEvidence: directoryPort.source || REFEREE_EVIDENCE_CAPABILITY.IDENTITY,
    refereeActiveStatusEvidence: directoryPort.source || REFEREE_EVIDENCE_CAPABILITY.ACTIVE_STATUS,
    refereeQualificationEvidence: REFEREE_EVIDENCE_CAPABILITY.QUALIFICATION,
    refereeAvailabilityEvidence: REFEREE_EVIDENCE_CAPABILITY.AVAILABILITY,
    requireQualification,
    requireAvailability,
    requireScheduleWindowForMandatoryRoles: schedule.scheduled === true,
    authoritativeScheduleSource: schedule.source,
  });
}
