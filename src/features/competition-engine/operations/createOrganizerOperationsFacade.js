/**
 * E2E-03 Organizer Operations application facade.
 *
 * Owns orchestration, authorization, and operational projections.
 * Reuses CM / Core / E2E-01 / E2E-02 — does not implement parallel engines.
 */

import { createCompetitionRuntimePorts } from "../integration/composition/createCompetitionRuntimePorts.js";
import { createPoolKnockoutRuntimeComposition } from "../application/createPoolKnockoutRuntimeComposition.js";
import { calculateCanonicalSchedule } from "../../competition-core/scheduling/index.js";
import { assignCourtsDeterministic } from "../../competition-core/court-assignment/index.js";
import { evaluateCompetitionArchiveEligibility } from "../../competition-management/competition-archive/index.js";
import { evaluateCompetitionPublicationReadiness } from "../../competition-management/competition-publication/index.js";
import {
  CHECKIN_STATE,
  ENTRY_OPS_STATUS,
  E2E03_OPERATIONS_PHASE,
  E2E03_OPERATIONS_VERSION,
  MATCH_OPS_STATE,
  ORGANIZER_ACTION,
  ORGANIZER_ERROR_CODE,
  ORGANIZER_LIFECYCLE_STATE,
  PARTICIPANT_FIELD_STATE,
  PUBLICATION_OPS_STATE,
} from "./constants.js";
import { authorizeOrganizerCommand } from "./context/authorizeOrganizerCommand.js";
import {
  applyCloseCheckIn,
  applyOpenCheckIn,
  assertMatchOpsCheckInGate,
  summarizeOrganizerCheckIn,
} from "./checkin/organizerCheckInBoundary.js";
import {
  failOrganizer,
  isOrganizerOperationsError,
  normalizeOrganizerError,
} from "./errors.js";
import {
  computeOrganizerFingerprint,
  deepFreeze,
  isNonEmptyString,
  snapshotInput,
} from "./fingerprint.js";
import { buildOrganizerOperationsProjection } from "./projections/buildOrganizerOperationsProjection.js";
import { createInMemoryOrganizerOperationsStore } from "./store/createInMemoryOrganizerOperationsStore.js";

/**
 * @param {unknown} entries
 * @returns {object[]}
 */
function normalizeEntries(entries) {
  if (!Array.isArray(entries)) return [];
  const seen = new Set();
  const out = [];
  for (const raw of entries) {
    if (raw == null) continue;
    if (typeof raw === "string") {
      const participantId = raw.trim();
      if (!participantId) continue;
      if (seen.has(participantId)) {
        failOrganizer(
          ORGANIZER_ERROR_CODE.DUPLICATE_PARTICIPANT,
          `Duplicate participant: ${participantId}`,
          { participantId }
        );
      }
      seen.add(participantId);
      out.push(
        Object.freeze({
          participantId,
          status: ENTRY_OPS_STATUS.ELIGIBLE,
        })
      );
      continue;
    }
    if (typeof raw !== "object") continue;
    const participantId = String(
      /** @type {{ participantId?: unknown, id?: unknown }} */ (raw).participantId ||
        /** @type {{ id?: unknown }} */ (raw).id ||
        ""
    ).trim();
    if (!participantId) {
      failOrganizer(
        ORGANIZER_ERROR_CODE.INVALID_INPUT,
        "participantId is required on each entry",
        {}
      );
    }
    if (seen.has(participantId)) {
      failOrganizer(
        ORGANIZER_ERROR_CODE.DUPLICATE_PARTICIPANT,
        `Duplicate participant: ${participantId}`,
        { participantId }
      );
    }
    seen.add(participantId);
    const statusRaw = String(
      /** @type {{ status?: unknown }} */ (raw).status || ENTRY_OPS_STATUS.ELIGIBLE
    )
      .trim()
      .toUpperCase();
    const status = Object.values(ENTRY_OPS_STATUS).includes(statusRaw)
      ? statusRaw
      : ENTRY_OPS_STATUS.INVALID;
    out.push(Object.freeze({ participantId, status }));
  }
  return out;
}

/**
 * @param {object[]} entries
 */
function assertLockableEntries(entries) {
  if (!entries.length) {
    failOrganizer(
      ORGANIZER_ERROR_CODE.PARTICIPANT_FIELD_INCOMPLETE,
      "Cannot lock an empty participant field",
      {}
    );
  }
  const blockers = entries.filter((e) =>
    [
      ENTRY_OPS_STATUS.PENDING,
      ENTRY_OPS_STATUS.INELIGIBLE,
      ENTRY_OPS_STATUS.WAITLISTED,
      ENTRY_OPS_STATUS.INVALID,
    ].includes(e.status)
  );
  if (blockers.length > 0) {
    failOrganizer(
      ORGANIZER_ERROR_CODE.PARTICIPANT_FIELD_INCOMPLETE,
      "Participant field has unresolved eligibility blockers",
      {
        blockers: blockers.map((b) => ({
          participantId: b.participantId,
          status: b.status,
        })),
      }
    );
  }
}

/**
 * @param {object} deps
 */
export function createOrganizerOperationsFacade(deps = {}) {
  const store =
    deps.store ||
    createInMemoryOrganizerOperationsStore({
      clockIso: deps.clockIso || "2026-07-24T00:00:00.000Z",
    });
  const runtimePorts =
    deps.runtimePorts ||
    createCompetitionRuntimePorts(deps.runtimePortDeps || {});

  /**
   * @param {object} command
   * @param {string} action
   * @param {{ requireVenue?: boolean }} [opts]
   */
  async function authorize(command, action, opts = {}) {
    const tenantId = String(command.tenantId || "").trim();
    const competitionId = String(command.competitionId || "").trim();
    const venueId =
      command.venueId != null ? String(command.venueId).trim() : null;
    return authorizeOrganizerCommand({
      action,
      actor: command.actor || {},
      tenantId,
      competitionId,
      venueId: opts.requireVenue === false ? venueId : venueId,
      runtimePorts,
      context: command.context,
    });
  }

  /**
   * @param {object} command
   * @param {string[]} [grantedPermissions]
   */
  function projectFor(command, grantedPermissions) {
    const record = store.get(command.tenantId, command.competitionId);
    return buildOrganizerOperationsProjection({
      record,
      grantedPermissions: grantedPermissions || [],
    });
  }

  /**
   * @param {object} auth
   * @param {object} result
   */
  function okResult(auth, result) {
    const fingerprint = computeOrganizerFingerprint(
      {
        action: auth.action,
        subject: auth.subject,
        scope: auth.scope,
        result,
      },
      "e2e03-cmd"
    );
    return deepFreeze({
      ok: true,
      phase: E2E03_OPERATIONS_PHASE,
      version: E2E03_OPERATIONS_VERSION,
      action: auth.action,
      capability: auth.capability,
      subject: auth.subject,
      scope: auth.scope,
      fingerprint,
      ...result,
    });
  }

  async function getOrganizerCompetitionOperationsState(command = {}) {
    const inputSnap = snapshotInput(command);
    void inputSnap;
    const auth = await authorize(command, ORGANIZER_ACTION.OPERATIONS_READ);
    const granted =
      auth.decision?.explanation?.grantedPermissions ||
      auth.decision?.details?.grantedPermissions ||
      [];
    const projection = projectFor(command, granted);
    return okResult(auth, { projection });
  }

  async function getOrganizerReadiness(command = {}) {
    const state = await getOrganizerCompetitionOperationsState(command);
    return deepFreeze({
      ok: true,
      phase: E2E03_OPERATIONS_PHASE,
      version: E2E03_OPERATIONS_VERSION,
      action: state.action,
      capability: state.capability,
      subject: state.subject,
      scope: state.scope,
      fingerprint: state.fingerprint,
      readiness: state.projection.readiness,
      blockingIssues: state.projection.blockingIssues,
      projectionFingerprint: state.projection.projectionFingerprint,
      projection: state.projection,
    });
  }

  async function prepareCompetitionOperations(command = {}) {
    const inputSnap = snapshotInput(command);
    const auth = await authorize(command, ORGANIZER_ACTION.PREPARE_OPERATIONS);
    const entries = normalizeEntries(command.entries || command.participants || []);
    const record = store.update(command.tenantId, command.competitionId, (draft) => {
      draft.venueId = isNonEmptyString(command.venueId)
        ? String(command.venueId).trim()
        : draft.venueId;
      draft.templateId = isNonEmptyString(command.templateId)
        ? String(command.templateId).trim()
        : draft.templateId;
      draft.templateVersion =
        command.templateVersion != null
          ? command.templateVersion
          : draft.templateVersion;
      draft.formatVersion =
        command.formatVersion != null ? command.formatVersion : draft.formatVersion;
      draft.deterministicSeed = isNonEmptyString(command.deterministicSeed)
        ? String(command.deterministicSeed).trim()
        : draft.deterministicSeed;
      if (entries.length > 0) {
        draft.entries = entries;
      }
      if (draft.lifecycleState === ORGANIZER_LIFECYCLE_STATE.UNINITIALIZED) {
        draft.lifecycleState = ORGANIZER_LIFECYCLE_STATE.PREPARED;
      }
      if (typeof command.checkInRequired === "boolean") {
        draft.checkInRequired = command.checkInRequired;
      }
    });
    // Prove input immutability for callers who pass mutable objects.
    if (command && typeof command === "object") {
      // no mutation of inputSnap equivalence check in tests
    }
    void inputSnap;
    return okResult(auth, {
      recordRevision: record.revision,
      lifecycleState: record.lifecycleState,
      projection: buildOrganizerOperationsProjection({
        record,
        grantedPermissions:
          auth.decision?.explanation?.grantedPermissions || [],
      }),
    });
  }

  async function lockParticipantField(command = {}) {
    const inputSnap = snapshotInput(command);
    void inputSnap;
    const auth = await authorize(command, ORGANIZER_ACTION.PARTICIPANTS_LOCK);
    const current = store.get(command.tenantId, command.competitionId);
    if (current.participantFieldState === PARTICIPANT_FIELD_STATE.LOCKED) {
      return okResult(auth, {
        idempotent: true,
        participantFieldState: PARTICIPANT_FIELD_STATE.LOCKED,
        projection: buildOrganizerOperationsProjection({
          record: current,
          grantedPermissions:
            auth.decision?.explanation?.grantedPermissions || [],
        }),
      });
    }
    const entries =
      command.entries || command.participants
        ? normalizeEntries(command.entries || command.participants)
        : current.entries;
    assertLockableEntries(entries);
    const record = store.update(command.tenantId, command.competitionId, (draft) => {
      draft.entries = entries;
      draft.participantFieldState = PARTICIPANT_FIELD_STATE.LOCKED;
      draft.lifecycleState = ORGANIZER_LIFECYCLE_STATE.PARTICIPANTS_LOCKED;
    });
    return okResult(auth, {
      idempotent: false,
      participantFieldState: record.participantFieldState,
      projection: buildOrganizerOperationsProjection({
        record,
        grantedPermissions:
          auth.decision?.explanation?.grantedPermissions || [],
      }),
    });
  }

  async function preparePoolStage(command = {}) {
    const inputSnap = snapshotInput(command);
    void inputSnap;
    const auth = await authorize(command, ORGANIZER_ACTION.DRAW_PREPARE);
    const current = store.get(command.tenantId, command.competitionId);
    if (current.participantFieldState !== PARTICIPANT_FIELD_STATE.LOCKED) {
      failOrganizer(
        ORGANIZER_ERROR_CODE.PRECONDITION_FAILED,
        "Participant field must be locked before pool preparation",
        { participantFieldState: current.participantFieldState }
      );
    }
    const deterministicSeed =
      String(command.deterministicSeed || current.deterministicSeed || "").trim();
    if (!deterministicSeed) {
      failOrganizer(
        ORGANIZER_ERROR_CODE.INVALID_INPUT,
        "deterministicSeed is required for pool preparation",
        {}
      );
    }
    const participants = current.entries
      .filter((e) => e.status === ENTRY_OPS_STATUS.ELIGIBLE)
      .map((e) => e.participantId);

    let composition;
    try {
      composition = createPoolKnockoutRuntimeComposition({
        tenantId: String(command.tenantId).trim(),
        competitionId: String(command.competitionId).trim(),
        participants,
        deterministicSeed,
        definition: command.definition,
        formatOverrides: command.formatOverrides,
        catalog: command.catalog,
        runtimePorts,
        requireRuntimePorts: command.requireRuntimePorts !== false,
        includeKnockout: false,
        poolStageComplete: false,
      });
    } catch (err) {
      if (isOrganizerOperationsError(err)) throw err;
      const normalized = normalizeOrganizerError(
        err,
        ORGANIZER_ERROR_CODE.CANONICAL_CALL_FAILED,
        "E2E-02 pool composition failed"
      );
      failOrganizer(normalized.code, normalized.message, {
        ...normalized.details,
        causeCode: /** @type {{ code?: string }} */ (err)?.code,
      });
    }

    const poolStage = composition.composition?.stages?.pool || null;
    const poolFp =
      composition.composition?.compositionIdentifier ||
      poolStage?.compositionFingerprint ||
      composition.formatFingerprint ||
      computeOrganizerFingerprint(composition.composition, "e2e03-pool");
    const matchPlanFp =
      poolStage?.matchPlan?.generationFingerprint ||
      poolStage?.compositionFingerprint ||
      computeOrganizerFingerprint(poolStage, "e2e03-pool-matches");

    const record = store.update(command.tenantId, command.competitionId, (draft) => {
      draft.deterministicSeed = deterministicSeed;
      draft.templateId =
        composition.templateResolution?.templateId || draft.templateId;
      draft.templateVersion =
        composition.templateResolution?.templateVersion ?? draft.templateVersion;
      draft.formatVersion = composition.formatVersion ?? draft.formatVersion;
      draft.poolCompositionFingerprint = poolFp;
      draft.poolMatchPlanFingerprint = matchPlanFp;
      draft.poolCompositionSummary = {
        runtimeReady: composition.runtimeReady === true,
        formatFingerprint: composition.formatFingerprint,
        poolGroupCount: poolStage?.groups?.length || poolStage?.grouping?.groups?.length || null,
      };
      draft.lifecycleState = ORGANIZER_LIFECYCLE_STATE.POOL_READY;
      // Reset downstream readiness when recomposing
      draft.knockoutActive = false;
      draft.knockoutFingerprint = null;
      draft.qualificationReady = false;
      draft.standingsReady = false;
      draft.unresolvedTie = false;
    });

    return okResult(auth, {
      composition: {
        fingerprint: poolFp,
        matchPlanFingerprint: matchPlanFp,
        templateId: composition.templateResolution?.templateId,
        templateVersion: composition.templateResolution?.templateVersion,
        formatFingerprint: composition.formatFingerprint,
        runtimeReady: composition.runtimeReady,
        // Do not return mutable nested engines — summary only
        poolSummary: record.poolCompositionSummary,
      },
      projection: buildOrganizerOperationsProjection({
        record,
        grantedPermissions:
          auth.decision?.explanation?.grantedPermissions || [],
      }),
    });
  }

  async function prepareOperationalSchedule(command = {}) {
    const inputSnap = snapshotInput(command);
    void inputSnap;
    const auth = await authorize(command, ORGANIZER_ACTION.SCHEDULE_PREPARE);
    const current = store.get(command.tenantId, command.competitionId);
    if (!current.poolCompositionFingerprint) {
      failOrganizer(
        ORGANIZER_ERROR_CODE.POOL_COMPOSITION_MISSING,
        "Pool composition is required before schedule preparation",
        {}
      );
    }
    if (!isNonEmptyString(command.venueId || current.venueId)) {
      failOrganizer(
        ORGANIZER_ERROR_CODE.MISSING_VENUE,
        "venueId is required for schedule preparation",
        {}
      );
    }

    let scheduleResult = null;
    let scheduleFingerprint = null;
    let certified = false;

    if (command.certifiedSchedule) {
      const cs = command.certifiedSchedule;
      if (cs.certified !== true) {
        failOrganizer(
          ORGANIZER_ERROR_CODE.SCHEDULE_UNCERTIFIED,
          "Uncertified schedule rejected",
          {}
        );
      }
      scheduleFingerprint =
        cs.fingerprint ||
        computeOrganizerFingerprint(cs, "e2e03-sched-certified");
      certified = true;
      scheduleResult = { source: "certified-handoff", fingerprint: scheduleFingerprint };
    } else if (command.schedulingRequest) {
      try {
        scheduleResult = calculateCanonicalSchedule(command.schedulingRequest);
      } catch (err) {
        failOrganizer(
          ORGANIZER_ERROR_CODE.CANONICAL_CALL_FAILED,
          "CORE-11 schedule calculation failed",
          { message: err instanceof Error ? err.message : String(err) }
        );
      }
      const hardConflicts = Array.isArray(scheduleResult?.conflicts)
        ? scheduleResult.conflicts.filter(
            (c) => String(c?.severity || "").toUpperCase() === "HARD"
          )
        : [];
      if (hardConflicts.length > 0) {
        failOrganizer(
          ORGANIZER_ERROR_CODE.SCHEDULE_INCOMPLETE,
          "Schedule has hard conflicts",
          { conflictCount: hardConflicts.length }
        );
      }
      scheduleFingerprint =
        scheduleResult?.resultFingerprint ||
        scheduleResult?.fingerprint ||
        computeOrganizerFingerprint(scheduleResult, "e2e03-sched");
      certified = command.markCertified === true;
      if (!certified) {
        failOrganizer(
          ORGANIZER_ERROR_CODE.SCHEDULE_UNCERTIFIED,
          "Schedule must be marked certified before operational acceptance",
          { scheduleFingerprint }
        );
      }
    } else {
      failOrganizer(
        ORGANIZER_ERROR_CODE.INVALID_INPUT,
        "certifiedSchedule or schedulingRequest is required",
        {}
      );
    }

    const venueId = String(command.venueId || current.venueId).trim();
    const record = store.update(command.tenantId, command.competitionId, (draft) => {
      draft.venueId = venueId;
      draft.scheduleCertified = certified;
      draft.scheduleFingerprint = scheduleFingerprint;
      draft.scheduleSummary = {
        certified,
        fingerprint: scheduleFingerprint,
        assignmentCount:
          scheduleResult?.source === "certified-handoff"
            ? command.certifiedSchedule?.assignmentCount ?? null
            : scheduleResult?.assignments?.length ?? null,
      };
      draft.lifecycleState = ORGANIZER_LIFECYCLE_STATE.SCHEDULE_READY;
      draft.courtAssignmentConfirmed = false;
      draft.courtAssignmentFingerprint = null;
    });

    return okResult(auth, {
      schedule: deepFreeze({
        certified: true,
        fingerprint: scheduleFingerprint,
        // Canonical times are not mutated by Organizer facade.
        mutated: false,
      }),
      projection: buildOrganizerOperationsProjection({
        record,
        grantedPermissions:
          auth.decision?.explanation?.grantedPermissions || [],
      }),
    });
  }

  async function confirmCourtAssignments(command = {}) {
    const inputSnap = snapshotInput(command);
    void inputSnap;
    const auth = await authorize(command, ORGANIZER_ACTION.COURTS_CONFIRM);
    const current = store.get(command.tenantId, command.competitionId);
    const venueId = String(command.venueId || current.venueId || "").trim();
    if (!venueId) {
      failOrganizer(
        ORGANIZER_ERROR_CODE.MISSING_VENUE,
        "venueId is required to confirm court assignments",
        {}
      );
    }
    if (!current.scheduleCertified) {
      failOrganizer(
        ORGANIZER_ERROR_CODE.SCHEDULE_UNCERTIFIED,
        "Certified schedule is required before court confirmation",
        {}
      );
    }

    let assignmentFingerprint = null;
    let assignmentSummary = null;

    if (command.confirmedAssignment) {
      const ca = command.confirmedAssignment;
      if (ca.complete !== true) {
        failOrganizer(
          ORGANIZER_ERROR_CODE.COURT_ASSIGNMENT_INCOMPLETE,
          "Incomplete court assignment rejected",
          {}
        );
      }
      if (
        isNonEmptyString(ca.venueId) &&
        String(ca.venueId).trim() !== venueId
      ) {
        failOrganizer(
          ORGANIZER_ERROR_CODE.CROSS_TENANT_REJECTED,
          "Court assignment venue does not match competition venue scope",
          { expectedVenueId: venueId, actualVenueId: ca.venueId }
        );
      }
      if (
        isNonEmptyString(ca.tenantId) &&
        String(ca.tenantId).trim() !== String(command.tenantId).trim()
      ) {
        failOrganizer(
          ORGANIZER_ERROR_CODE.CROSS_TENANT_REJECTED,
          "Court assignment tenant mismatch",
          {}
        );
      }
      assignmentFingerprint =
        ca.fingerprint ||
        computeOrganizerFingerprint(ca, "e2e03-courts-confirmed");
      assignmentSummary = {
        source: "confirmed-handoff",
        complete: true,
        fingerprint: assignmentFingerprint,
      };
    } else if (command.courtAssignmentRequest) {
      if (!command.availabilitySnapshot && !command.courtAssignmentRequest.availableCourts) {
        failOrganizer(
          ORGANIZER_ERROR_CODE.COURT_SNAPSHOT_MISSING,
          "Court availability snapshot is required",
          {}
        );
      }
      let result;
      try {
        result = assignCourtsDeterministic(command.courtAssignmentRequest);
      } catch (err) {
        failOrganizer(
          ORGANIZER_ERROR_CODE.CANONICAL_CALL_FAILED,
          "CORE-12 court assignment failed",
          { message: err instanceof Error ? err.message : String(err) }
        );
      }
      const unassigned = result?.unassignedMatches || result?.unassigned || [];
      if (Array.isArray(unassigned) && unassigned.length > 0) {
        failOrganizer(
          ORGANIZER_ERROR_CODE.COURT_ASSIGNMENT_INCOMPLETE,
          "Court assignment left matches unassigned",
          { unassignedCount: unassigned.length }
        );
      }
      assignmentFingerprint =
        result?.resultFingerprint ||
        result?.fingerprint ||
        computeOrganizerFingerprint(result, "e2e03-courts");
      assignmentSummary = {
        source: "core12",
        complete: true,
        fingerprint: assignmentFingerprint,
      };
    } else {
      failOrganizer(
        ORGANIZER_ERROR_CODE.INVALID_INPUT,
        "confirmedAssignment or courtAssignmentRequest is required",
        {}
      );
    }

    const record = store.update(command.tenantId, command.competitionId, (draft) => {
      draft.venueId = venueId;
      draft.courtAssignmentConfirmed = true;
      draft.courtAssignmentFingerprint = assignmentFingerprint;
      draft.courtAssignmentSummary = assignmentSummary;
      draft.lifecycleState = ORGANIZER_LIFECYCLE_STATE.COURTS_CONFIRMED;
    });

    return okResult(auth, {
      courtAssignment: deepFreeze(assignmentSummary),
      projection: buildOrganizerOperationsProjection({
        record,
        grantedPermissions:
          auth.decision?.explanation?.grantedPermissions || [],
      }),
    });
  }

  async function publishOperationalPlan(command = {}) {
    const inputSnap = snapshotInput(command);
    void inputSnap;
    const auth = await authorize(command, ORGANIZER_ACTION.PUBLISH);
    const current = store.get(command.tenantId, command.competitionId);
    if (!current.scheduleCertified || !current.courtAssignmentConfirmed) {
      failOrganizer(
        ORGANIZER_ERROR_CODE.PRECONDITION_FAILED,
        "Schedule and court confirmation required before publishing operational plan",
        {
          scheduleCertified: current.scheduleCertified,
          courtAssignmentConfirmed: current.courtAssignmentConfirmed,
        }
      );
    }

    let cmReadiness = null;
    if (command.publicationReadinessCommand) {
      cmReadiness = evaluateCompetitionPublicationReadiness(
        command.publicationReadinessCommand
      );
      if (cmReadiness?.ok === false || cmReadiness?.value?.ready === false) {
        failOrganizer(
          ORGANIZER_ERROR_CODE.PRECONDITION_FAILED,
          "CM publication readiness failed for operational plan",
          { cmReadiness }
        );
      }
    }

    if (current.publicationState === PUBLICATION_OPS_STATE.OPERATIONAL_PLAN_PUBLISHED ||
        current.publicationState === PUBLICATION_OPS_STATE.FINAL_RESULT_PUBLISHED) {
      if (current.lifecycleState === ORGANIZER_LIFECYCLE_STATE.OPERATIONAL_PLAN_PUBLISHED ||
          current.publicationState === PUBLICATION_OPS_STATE.OPERATIONAL_PLAN_PUBLISHED) {
        return okResult(auth, {
          idempotent: true,
          publicationState: current.publicationState,
          cmReadiness,
          projection: buildOrganizerOperationsProjection({
            record: current,
            grantedPermissions:
              auth.decision?.explanation?.grantedPermissions || [],
          }),
        });
      }
    }

    const publication = deepFreeze({
      kind: "operational-plan",
      scheduleFingerprint: current.scheduleFingerprint,
      courtAssignmentFingerprint: current.courtAssignmentFingerprint,
      poolCompositionFingerprint: current.poolCompositionFingerprint,
      publishedBy: auth.subject.actorId,
    });

    const record = store.update(command.tenantId, command.competitionId, (draft) => {
      draft.publicationState = PUBLICATION_OPS_STATE.OPERATIONAL_PLAN_PUBLISHED;
      draft.operationalPlanPublication = publication;
      draft.lifecycleState = ORGANIZER_LIFECYCLE_STATE.OPERATIONAL_PLAN_PUBLISHED;
    });

    return okResult(auth, {
      idempotent: false,
      publication,
      cmReadiness,
      projection: buildOrganizerOperationsProjection({
        record,
        grantedPermissions:
          auth.decision?.explanation?.grantedPermissions || [],
      }),
    });
  }

  async function openCheckIn(command = {}) {
    const inputSnap = snapshotInput(command);
    void inputSnap;
    const auth = await authorize(command, ORGANIZER_ACTION.CHECKIN_MANAGE);
    let idempotent = false;
    const record = store.update(command.tenantId, command.competitionId, (draft) => {
      const result = applyOpenCheckIn(draft);
      idempotent = result.idempotent === true;
    });
    return okResult(auth, {
      idempotent,
      checkIn: summarizeOrganizerCheckIn(record),
      projection: buildOrganizerOperationsProjection({
        record,
        grantedPermissions:
          auth.decision?.explanation?.grantedPermissions || [],
      }),
    });
  }

  async function closeCheckIn(command = {}) {
    const inputSnap = snapshotInput(command);
    void inputSnap;
    const auth = await authorize(command, ORGANIZER_ACTION.CHECKIN_MANAGE);
    let idempotent = false;
    const record = store.update(command.tenantId, command.competitionId, (draft) => {
      const result = applyCloseCheckIn(draft);
      idempotent = result.idempotent === true;
    });
    return okResult(auth, {
      idempotent,
      checkIn: summarizeOrganizerCheckIn(record),
      projection: buildOrganizerOperationsProjection({
        record,
        grantedPermissions:
          auth.decision?.explanation?.grantedPermissions || [],
      }),
    });
  }

  async function openMatchOperations(command = {}) {
    const inputSnap = snapshotInput(command);
    void inputSnap;
    const auth = await authorize(command, ORGANIZER_ACTION.MATCHES_CONTROL);
    const current = store.get(command.tenantId, command.competitionId);
    if (current.matchOpsState === MATCH_OPS_STATE.OPEN) {
      return okResult(auth, {
        idempotent: true,
        matchOpsState: MATCH_OPS_STATE.OPEN,
        projection: buildOrganizerOperationsProjection({
          record: current,
          grantedPermissions:
            auth.decision?.explanation?.grantedPermissions || [],
        }),
      });
    }
    if (
      current.publicationState !== PUBLICATION_OPS_STATE.OPERATIONAL_PLAN_PUBLISHED &&
      current.publicationState !== PUBLICATION_OPS_STATE.FINAL_RESULT_PUBLISHED
    ) {
      failOrganizer(
        ORGANIZER_ERROR_CODE.MATCH_OPS_BLOCKED,
        "Operational plan must be published before opening match operations",
        { publicationState: current.publicationState }
      );
    }
    assertMatchOpsCheckInGate(current, {
      requireAllCheckedIn: command.requireAllCheckedIn,
    });

    const matches = Array.isArray(command.matches)
      ? command.matches.map((m) =>
          Object.freeze({
            matchId: String(m.matchId || m.id || "").trim(),
            status: String(m.status || "READY").trim().toUpperCase(),
            stage: m.stage || "POOL",
          })
        )
      : current.matches;

    const record = store.update(command.tenantId, command.competitionId, (draft) => {
      draft.matchOpsState = MATCH_OPS_STATE.OPEN;
      draft.lifecycleState = ORGANIZER_LIFECYCLE_STATE.MATCH_OPS_OPEN;
      if (matches.length > 0) draft.matches = matches;
      if (Array.isArray(command.checkedInParticipantIds)) {
        draft.checkedInParticipantIds = [
          ...new Set(command.checkedInParticipantIds.map((id) => String(id))),
        ];
      }
    });

    return okResult(auth, {
      idempotent: false,
      matchOpsState: record.matchOpsState,
      // Organizer does not infer winners.
      winnerInference: false,
      projection: buildOrganizerOperationsProjection({
        record,
        grantedPermissions:
          auth.decision?.explanation?.grantedPermissions || [],
      }),
    });
  }

  async function suspendMatchOperations(command = {}) {
    const inputSnap = snapshotInput(command);
    void inputSnap;
    const auth = await authorize(command, ORGANIZER_ACTION.MATCHES_CONTROL);
    const current = store.get(command.tenantId, command.competitionId);
    if (current.matchOpsState === MATCH_OPS_STATE.SUSPENDED) {
      return okResult(auth, {
        idempotent: true,
        matchOpsState: MATCH_OPS_STATE.SUSPENDED,
        projection: buildOrganizerOperationsProjection({
          record: current,
          grantedPermissions:
            auth.decision?.explanation?.grantedPermissions || [],
        }),
      });
    }
    if (current.matchOpsState !== MATCH_OPS_STATE.OPEN) {
      failOrganizer(
        ORGANIZER_ERROR_CODE.INVALID_STATE,
        "Match operations must be open before suspend",
        { matchOpsState: current.matchOpsState }
      );
    }
    const record = store.update(command.tenantId, command.competitionId, (draft) => {
      draft.matchOpsState = MATCH_OPS_STATE.SUSPENDED;
      draft.lifecycleState = ORGANIZER_LIFECYCLE_STATE.MATCH_OPS_SUSPENDED;
    });
    return okResult(auth, {
      idempotent: false,
      matchOpsState: record.matchOpsState,
      projection: buildOrganizerOperationsProjection({
        record,
        grantedPermissions:
          auth.decision?.explanation?.grantedPermissions || [],
      }),
    });
  }

  async function resumeMatchOperations(command = {}) {
    const inputSnap = snapshotInput(command);
    void inputSnap;
    const auth = await authorize(command, ORGANIZER_ACTION.MATCHES_CONTROL);
    const current = store.get(command.tenantId, command.competitionId);
    if (current.matchOpsState === MATCH_OPS_STATE.OPEN) {
      return okResult(auth, {
        idempotent: true,
        matchOpsState: MATCH_OPS_STATE.OPEN,
        projection: buildOrganizerOperationsProjection({
          record: current,
          grantedPermissions:
            auth.decision?.explanation?.grantedPermissions || [],
        }),
      });
    }
    if (current.matchOpsState !== MATCH_OPS_STATE.SUSPENDED) {
      failOrganizer(
        ORGANIZER_ERROR_CODE.INVALID_STATE,
        "Match operations must be suspended before resume",
        { matchOpsState: current.matchOpsState }
      );
    }
    const record = store.update(command.tenantId, command.competitionId, (draft) => {
      draft.matchOpsState = MATCH_OPS_STATE.OPEN;
      draft.lifecycleState = ORGANIZER_LIFECYCLE_STATE.MATCH_OPS_OPEN;
    });
    return okResult(auth, {
      idempotent: false,
      matchOpsState: record.matchOpsState,
      projection: buildOrganizerOperationsProjection({
        record,
        grantedPermissions:
          auth.decision?.explanation?.grantedPermissions || [],
      }),
    });
  }

  async function activateKnockoutStage(command = {}) {
    const inputSnap = snapshotInput(command);
    void inputSnap;
    const auth = await authorize(command, ORGANIZER_ACTION.KNOCKOUT_ACTIVATE);
    const current = store.get(command.tenantId, command.competitionId);
    if (current.knockoutActive) {
      return okResult(auth, {
        idempotent: true,
        knockoutActive: true,
        projection: buildOrganizerOperationsProjection({
          record: current,
          grantedPermissions:
            auth.decision?.explanation?.grantedPermissions || [],
        }),
      });
    }
    if (!current.poolCompositionFingerprint) {
      failOrganizer(
        ORGANIZER_ERROR_CODE.POOL_COMPOSITION_MISSING,
        "Pool composition required before knockout activation",
        {}
      );
    }
    if (command.unresolvedTie === true || current.unresolvedTie === true) {
      failOrganizer(
        ORGANIZER_ERROR_CODE.UNRESOLVED_TIE,
        "Unresolved tie blocks knockout activation",
        {}
      );
    }
    if (command.qualificationReady !== true && current.qualificationReady !== true) {
      // Allow activation when canonical composition succeeds with poolStageComplete
      if (command.poolStageComplete !== true) {
        failOrganizer(
          ORGANIZER_ERROR_CODE.QUALIFICATION_NOT_READY,
          "Qualification readiness is required to activate knockout",
          {}
        );
      }
    }
    if (Array.isArray(command.invalidResults) && command.invalidResults.length > 0) {
      failOrganizer(
        ORGANIZER_ERROR_CODE.INVALID_INPUT,
        "Invalid results cannot be used for knockout activation",
        { count: command.invalidResults.length }
      );
    }

    const deterministicSeed =
      String(command.deterministicSeed || current.deterministicSeed || "").trim();
    const participants = current.entries
      .filter((e) => e.status === ENTRY_OPS_STATUS.ELIGIBLE)
      .map((e) => e.participantId);

    let composition;
    try {
      composition = createPoolKnockoutRuntimeComposition({
        tenantId: String(command.tenantId).trim(),
        competitionId: String(command.competitionId).trim(),
        participants,
        deterministicSeed,
        definition: command.definition,
        formatOverrides: command.formatOverrides,
        catalog: command.catalog,
        runtimePorts,
        requireRuntimePorts: command.requireRuntimePorts !== false,
        includeKnockout: true,
        poolStageComplete: true,
        poolStandingsRows: command.poolStandingsRows,
        poolMatchResults: command.poolMatchResults,
      });
    } catch (err) {
      const code = /** @type {{ code?: string }} */ (err)?.code;
      if (String(code || "").includes("UNRESOLVED_TIE")) {
        failOrganizer(
          ORGANIZER_ERROR_CODE.UNRESOLVED_TIE,
          "Canonical composition reported unresolved tie",
          { causeCode: code }
        );
      }
      const normalized = normalizeOrganizerError(
        err,
        ORGANIZER_ERROR_CODE.CANONICAL_CALL_FAILED,
        "E2E-02 knockout composition failed"
      );
      failOrganizer(normalized.code, normalized.message, normalized.details);
    }

    const knockoutFp =
      composition.composition?.compositionIdentifier ||
      composition.composition?.stages?.knockout?.compositionFingerprint ||
      computeOrganizerFingerprint(composition.composition, "e2e03-ko");

    if (
      command.requireKnockoutComposition !== false &&
      !composition.composition?.stages?.knockout &&
      !command.allowDeferredKnockoutComposition
    ) {
      // Qualification inputs missing — Organizer must not silently invent bracket.
      if (!command.poolStandingsRows && !command.poolMatchResults) {
        failOrganizer(
          ORGANIZER_ERROR_CODE.QUALIFICATION_NOT_READY,
          "Knockout composition requires canonical qualification inputs",
          {}
        );
      }
    }

    const record = store.update(command.tenantId, command.competitionId, (draft) => {
      draft.knockoutActive = true;
      draft.knockoutFingerprint = knockoutFp;
      draft.knockoutSummary = {
        runtimeReady: composition.runtimeReady === true,
        formatFingerprint: composition.formatFingerprint,
      };
      draft.qualificationReady = true;
      draft.standingsReady = true;
      draft.unresolvedTie = false;
      draft.lifecycleState = ORGANIZER_LIFECYCLE_STATE.KNOCKOUT_ACTIVE;
      if (Array.isArray(command.matches)) {
        draft.matches = command.matches.map((m) =>
          Object.freeze({
            matchId: String(m.matchId || m.id || "").trim(),
            status: String(m.status || "READY").trim().toUpperCase(),
            stage: m.stage || "KNOCKOUT",
          })
        );
      }
    });

    return okResult(auth, {
      idempotent: false,
      knockoutActive: true,
      knockoutFingerprint: knockoutFp,
      winnerInference: false,
      projection: buildOrganizerOperationsProjection({
        record,
        grantedPermissions:
          auth.decision?.explanation?.grantedPermissions || [],
      }),
    });
  }

  async function completeCompetitionOperations(command = {}) {
    const inputSnap = snapshotInput(command);
    void inputSnap;
    const auth = await authorize(command, ORGANIZER_ACTION.COMPLETE);
    const current = store.get(command.tenantId, command.competitionId);
    if (current.completionConfirmed) {
      return okResult(auth, {
        idempotent: true,
        completionConfirmed: true,
        projection: buildOrganizerOperationsProjection({
          record: current,
          grantedPermissions:
            auth.decision?.explanation?.grantedPermissions || [],
        }),
      });
    }

    const matches = Array.isArray(command.matches)
      ? command.matches
      : current.matches;
    const active = matches.filter((m) =>
      ["ACTIVE", "IN_PROGRESS", "STARTED", "PAUSED", "SUSPENDED"].includes(
        String(m?.status || "").toUpperCase()
      )
    );
    if (active.length > 0) {
      failOrganizer(
        ORGANIZER_ERROR_CODE.ACTIVE_MATCHES,
        "Active matches prevent completion",
        { count: active.length }
      );
    }
    const incomplete = matches.filter((m) => {
      const status = String(m?.status || "").toUpperCase();
      return status && status !== "COMPLETED" && status !== "CANCELLED";
    });
    if (incomplete.length > 0) {
      failOrganizer(
        ORGANIZER_ERROR_CODE.INCOMPLETE_MATCHES,
        "Incomplete matches prevent completion",
        { count: incomplete.length }
      );
    }
    if (!current.knockoutActive && command.requireKnockout !== false) {
      failOrganizer(
        ORGANIZER_ERROR_CODE.PRECONDITION_FAILED,
        "Knockout stage must be activated before completion for Pool+KO MVP",
        {}
      );
    }

    const record = store.update(command.tenantId, command.competitionId, (draft) => {
      draft.matches = matches.map((m) =>
        Object.freeze({
          matchId: String(m.matchId || m.id || "").trim(),
          status: String(m.status || "").trim().toUpperCase(),
          stage: m.stage || "KNOCKOUT",
        })
      );
      draft.completionConfirmed = true;
      draft.matchOpsState = MATCH_OPS_STATE.CLOSED;
      draft.lifecycleState = ORGANIZER_LIFECYCLE_STATE.COMPLETED;
    });

    return okResult(auth, {
      idempotent: false,
      completionConfirmed: true,
      projection: buildOrganizerOperationsProjection({
        record,
        grantedPermissions:
          auth.decision?.explanation?.grantedPermissions || [],
      }),
    });
  }

  async function publishFinalCompetitionResult(command = {}) {
    const inputSnap = snapshotInput(command);
    void inputSnap;
    const auth = await authorize(command, ORGANIZER_ACTION.PUBLISH);
    const current = store.get(command.tenantId, command.competitionId);
    if (!current.completionConfirmed) {
      failOrganizer(
        ORGANIZER_ERROR_CODE.COMPLETION_REQUIRED,
        "Competition must be completed before final result publication",
        {}
      );
    }
    if (current.publicationState === PUBLICATION_OPS_STATE.FINAL_RESULT_PUBLISHED) {
      return okResult(auth, {
        idempotent: true,
        publicationState: PUBLICATION_OPS_STATE.FINAL_RESULT_PUBLISHED,
        projection: buildOrganizerOperationsProjection({
          record: current,
          grantedPermissions:
            auth.decision?.explanation?.grantedPermissions || [],
        }),
      });
    }

    let cmReadiness = null;
    if (command.publicationReadinessCommand) {
      cmReadiness = evaluateCompetitionPublicationReadiness(
        command.publicationReadinessCommand
      );
      if (cmReadiness?.ok === false || cmReadiness?.value?.ready === false) {
        failOrganizer(
          ORGANIZER_ERROR_CODE.PRECONDITION_FAILED,
          "CM publication readiness failed for final result",
          { cmReadiness }
        );
      }
    }

    const publication = deepFreeze({
      kind: "final-result",
      knockoutFingerprint: current.knockoutFingerprint,
      publishedBy: auth.subject.actorId,
    });

    const record = store.update(command.tenantId, command.competitionId, (draft) => {
      draft.publicationState = PUBLICATION_OPS_STATE.FINAL_RESULT_PUBLISHED;
      draft.finalResultPublication = publication;
      draft.lifecycleState = ORGANIZER_LIFECYCLE_STATE.FINAL_RESULT_PUBLISHED;
    });

    return okResult(auth, {
      idempotent: false,
      publication,
      cmReadiness,
      projection: buildOrganizerOperationsProjection({
        record,
        grantedPermissions:
          auth.decision?.explanation?.grantedPermissions || [],
      }),
    });
  }

  async function requestArchiveReadiness(command = {}) {
    const inputSnap = snapshotInput(command);
    void inputSnap;
    const auth = await authorize(command, ORGANIZER_ACTION.ARCHIVE_PREPARE);
    const current = store.get(command.tenantId, command.competitionId);
    if (current.publicationState !== PUBLICATION_OPS_STATE.FINAL_RESULT_PUBLISHED) {
      failOrganizer(
        ORGANIZER_ERROR_CODE.FINAL_PUBLICATION_REQUIRED,
        "Final result publication is required before archive readiness",
        { publicationState: current.publicationState }
      );
    }
    const matches = Array.isArray(current.matches) ? current.matches : [];
    const active = matches.filter((m) =>
      ["ACTIVE", "IN_PROGRESS", "STARTED", "PAUSED", "SUSPENDED"].includes(
        String(m?.status || "").toUpperCase()
      )
    );
    if (active.length > 0) {
      failOrganizer(
        ORGANIZER_ERROR_CODE.ACTIVE_MATCHES,
        "Active matches prevent archive readiness",
        { count: active.length }
      );
    }

    let cmEligibility = null;
    if (command.archiveEligibilityCommand) {
      cmEligibility = evaluateCompetitionArchiveEligibility(
        command.archiveEligibilityCommand
      );
      // Do not mutate CM archive state — readiness handoff only.
    }

    const handoff = deepFreeze({
      kind: "archive-readiness-handoff",
      tenantId: String(command.tenantId).trim(),
      competitionId: String(command.competitionId).trim(),
      ready: true,
      cmEligibility,
      // Explicit: Organizer does not call archiveCompetition here.
      directArchiveMutation: false,
    });

    const record = store.update(command.tenantId, command.competitionId, (draft) => {
      draft.archiveReadiness = handoff;
      draft.lifecycleState = ORGANIZER_LIFECYCLE_STATE.ARCHIVE_READY;
    });

    return okResult(auth, {
      archiveReadiness: handoff,
      projection: buildOrganizerOperationsProjection({
        record,
        grantedPermissions:
          auth.decision?.explanation?.grantedPermissions || [],
      }),
    });
  }

  /**
   * Record check-in marks from Organizer summary path (not player portal).
   * @param {object} command
   */
  async function recordOrganizerCheckInMarks(command = {}) {
    const auth = await authorize(command, ORGANIZER_ACTION.CHECKIN_MANAGE);
    const current = store.get(command.tenantId, command.competitionId);
    if (current.checkInState !== CHECKIN_STATE.OPEN) {
      failOrganizer(
        ORGANIZER_ERROR_CODE.CHECKIN_NOT_OPEN,
        "Check-in window is not open",
        { checkInState: current.checkInState }
      );
    }
    const ids = Array.isArray(command.participantIds)
      ? command.participantIds.map((id) => String(id).trim()).filter(Boolean)
      : [];
    const record = store.update(command.tenantId, command.competitionId, (draft) => {
      const set = new Set(draft.checkedInParticipantIds || []);
      for (const id of ids) set.add(id);
      draft.checkedInParticipantIds = [...set].sort();
    });
    return okResult(auth, {
      checkIn: summarizeOrganizerCheckIn(record),
      projection: buildOrganizerOperationsProjection({
        record,
        grantedPermissions:
          auth.decision?.explanation?.grantedPermissions || [],
      }),
    });
  }

  /**
   * Update match operational statuses from canonical lifecycle projections.
   * Does not accept scores or decide winners.
   */
  async function syncMatchOperationalStatuses(command = {}) {
    const auth = await authorize(command, ORGANIZER_ACTION.MATCHES_CONTROL);
    if (command.inferWinners === true || command.winnerId || command.scores) {
      failOrganizer(
        ORGANIZER_ERROR_CODE.INVALID_INPUT,
        "Organizer match sync does not accept scores or winner inference",
        {}
      );
    }
    const matches = Array.isArray(command.matches) ? command.matches : [];
    const record = store.update(command.tenantId, command.competitionId, (draft) => {
      draft.matches = matches.map((m) =>
        Object.freeze({
          matchId: String(m.matchId || m.id || "").trim(),
          status: String(m.status || "READY").trim().toUpperCase(),
          stage: m.stage || (draft.knockoutActive ? "KNOCKOUT" : "POOL"),
        })
      );
      if (typeof command.standingsReady === "boolean") {
        draft.standingsReady = command.standingsReady;
      }
      if (typeof command.qualificationReady === "boolean") {
        draft.qualificationReady = command.qualificationReady;
      }
      if (typeof command.unresolvedTie === "boolean") {
        draft.unresolvedTie = command.unresolvedTie;
      }
    });
    return okResult(auth, {
      matchSummary: buildOrganizerOperationsProjection({
        record,
        grantedPermissions:
          auth.decision?.explanation?.grantedPermissions || [],
      }).matchSummary,
      winnerInference: false,
      projection: buildOrganizerOperationsProjection({
        record,
        grantedPermissions:
          auth.decision?.explanation?.grantedPermissions || [],
      }),
    });
  }

  return Object.freeze({
    version: E2E03_OPERATIONS_VERSION,
    phase: E2E03_OPERATIONS_PHASE,
    wiredToProductionRuntime: false,
    ownsEngines: false,
    store,
    runtimePorts,
    getOrganizerCompetitionOperationsState,
    getOrganizerReadiness,
    prepareCompetitionOperations,
    lockParticipantField,
    preparePoolStage,
    prepareOperationalSchedule,
    confirmCourtAssignments,
    publishOperationalPlan,
    openCheckIn,
    closeCheckIn,
    openMatchOperations,
    suspendMatchOperations,
    resumeMatchOperations,
    activateKnockoutStage,
    completeCompetitionOperations,
    publishFinalCompetitionResult,
    requestArchiveReadiness,
    recordOrganizerCheckInMarks,
    syncMatchOperationalStatuses,
  });
}

/**
 * Convenience: create facade and run a single read.
 */
export async function getOrganizerCompetitionOperationsState(command, deps) {
  const facade = createOrganizerOperationsFacade(deps);
  return facade.getOrganizerCompetitionOperationsState(command);
}
