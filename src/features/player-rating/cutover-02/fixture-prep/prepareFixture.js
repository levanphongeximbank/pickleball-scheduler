/**
 * Controlled Staging fixture preparation orchestrator (A3c).
 *
 * Trusted boundary only — Edge Function / Node runners.
 * Never embeds service-role secrets. Never requires candidate JWT/password.
 * Local unit tests inject ports; default executeMutations=false → zero Staging writes.
 */

import { assertTrustedRuntime } from "../../../pick-vn-rating-v5/server/trustedRuntimeMarker.js";
import { scoreAssessmentForPersistence } from "../../../pick-vn-rating-v5/server/scoreAssessmentCompletion.js";
import { hashPlayerIdForEvidence } from "../evidence/sanitizeEvidence.js";
import {
  FIXTURE_COHORT_LABEL,
  FIXTURE_PREP_OUTCOME,
  FIXTURE_PREP_VERSION,
  MAPPING_STATUS,
  NORMALIZED_EQUIVALENCE,
  MUTATION_BUDGET,
  SELECTED_ARCHITECTURE,
} from "./constants.js";
import {
  buildFixtureAnswers,
  scoreFixtureAnswers as defaultScoreFixtureAnswers,
  profileIdHash12,
} from "./fixtureManifest.js";
import {
  evaluateCallerGuard,
  evaluateCohortGuard,
  evaluateProjectGuard,
  evaluateTargetGuard,
  evaluateValueGuard,
} from "./guards.js";
import { classifyPreparationState, buildIdempotencyKey } from "./idempotency.js";
import { evaluateMutationBudget } from "./mutationBudget.js";
import { buildRedactedPrepAudit, buildStateFingerprint } from "./auditEvidence.js";
import { isFixturePrepPathEnabled } from "./featureFlag.js";

function emptyPorts() {
  return {
    loadTargetState: async () => ({
      hasEnrollment: false,
      hasV2Row: false,
      hasDraftAssessment: false,
      hasCompletedAssessment: false,
      hasV5ShadowProfile: false,
      hasConflictingCompletedV5OutsidePrep: false,
      prepAuditStatus: null,
      beforeParts: {},
      tenantId: "platform",
      phase4PilotUntouched: true,
      rolloutConfigFingerprint: "unchanged",
    }),
    upsertEnrollment: async () => ({ ok: true, wrote: 1 }),
    syncV2Rating: async () => ({ ok: true, wrote: 1 }),
    createDraftAssessment: async () => ({
      ok: true,
      assessment: null,
      wrote: 1,
    }),
    persistCompletion: async () => ({ ok: true, wrote: 3 }),
    recordAudit: async () => ({ ok: true, wrote: 1 }),
    rollbackTransaction: async () => ({ ok: true }),
  };
}

/**
 * Prepare one approved fixture candidate.
 *
 * @param {{
 *   env?: Record<string, unknown>,
 *   projectRef?: string|null,
 *   supabaseUrl?: string|null,
 *   enabled?: boolean,
 *   executeMutations?: boolean,
 *   cohortLabel?: string,
 *   preparationVersion?: string,
 *   caller?: object,
 *   target?: object,
 *   v2Raw?: number,
 *   v5TargetDisplay?: number,
 *   candidateLabel?: string,
 *   runningTally?: object,
 *   requireCandidateJwt?: boolean,
 *   requireCandidatePassword?: boolean,
 * }} input
 * @param {ReturnType<typeof emptyPorts>} [ports]
 */
export async function prepareStagingFixtureCandidate(input = {}, ports = {}) {
  assertTrustedRuntime("prepareStagingFixtureCandidate");

  const mergedPorts = { ...emptyPorts(), ...ports };
  const scoreFixtureAnswers =
    typeof ports.scoreFixtureAnswers === "function"
      ? ports.scoreFixtureAnswers
      : defaultScoreFixtureAnswers;
  const executeMutations = input.executeMutations === true;
  const env = input.env && typeof input.env === "object" ? input.env : {};

  if (!isFixturePrepPathEnabled(env, { explicitEnabled: input.enabled })) {
    return deny(FIXTURE_PREP_OUTCOME.FEATURE_DISABLED, {
      message: "A3c fixture prep path unavailable by default",
    });
  }

  if (input.requireCandidateJwt === true || input.requireCandidatePassword === true) {
    return deny(FIXTURE_PREP_OUTCOME.UNAUTHORIZED_CALLER, {
      message: "Candidate JWT/password handling is prohibited",
      candidateJwtRequired: false,
      candidatePasswordRequired: false,
    });
  }

  const project = evaluateProjectGuard(env, {
    projectRef: input.projectRef,
    supabaseUrl: input.supabaseUrl,
  });
  if (!project.ok) {
    return deny(project.code, { project });
  }

  const caller = evaluateCallerGuard(input.caller || {});
  if (!caller.ok) {
    return deny(caller.code, { caller });
  }

  const cohort = evaluateCohortGuard(input.cohortLabel ?? FIXTURE_COHORT_LABEL);
  if (!cohort.ok) {
    return deny(cohort.code, { cohort });
  }

  const target = evaluateTargetGuard(input.target || {});
  if (!target.ok) {
    return deny(target.code, { target });
  }

  const value = evaluateValueGuard({
    fixture: target.fixture,
    v2Raw: input.v2Raw ?? target.fixture.v2Raw,
    v5TargetDisplay: input.v5TargetDisplay ?? target.fixture.v5TargetDisplay,
  });
  if (!value.ok) {
    return deny(value.code, { value });
  }

  const scoreCheck = scoreFixtureAnswers(target.fixture);
  if (!scoreCheck.matches) {
    return deny(FIXTURE_PREP_OUTCOME.SCORE_OUTPUT_MISMATCH, {
      expectedDisplay: scoreCheck.expectedDisplay,
      actualDisplay: scoreCheck.display,
      message:
        "Canonical scorer output does not match fixture target — revise fixture inputs; do not override",
      mappingStatus: MAPPING_STATUS,
      normalizedEquivalence: NORMALIZED_EQUIVALENCE,
    });
  }

  const state = await mergedPorts.loadTargetState({
    cohortLabel: cohort.cohortLabel,
    preparationVersion: input.preparationVersion || FIXTURE_PREP_VERSION,
    profileId: input.target.profileId,
    idHash: target.idHash,
  });

  const classification = classifyPreparationState({
    ...state,
    cohortLabel: cohort.cohortLabel,
    prepVersion: input.preparationVersion || FIXTURE_PREP_VERSION,
    fingerprintMatch: true,
  });

  if (!classification.proceed) {
    const audit = buildRedactedPrepAudit({
      candidateLabel: target.label,
      candidateIdHash: target.idHash,
      cohortLabel: cohort.cohortLabel,
      preparationVersion: input.preparationVersion || FIXTURE_PREP_VERSION,
      projectRef: project.projectRef,
      outcome: classification.outcome,
      beforeStateFingerprint: buildStateFingerprint(state.beforeParts || {}),
      afterStateFingerprint: buildStateFingerprint(state.beforeParts || {}),
      v2Raw: value.v2Raw,
      v5ScorerOutput: scoreCheck.display,
      idempotencyOutcome: classification.outcome,
      rollbackHandle: null,
      callerIdHash: hashPlayerIdForEvidence(caller.callerId),
      createdUpdatedRowCounts: { durable: 0 },
    });

    if (classification.outcome === FIXTURE_PREP_OUTCOME.ALREADY_PREPARED && executeMutations) {
      await mergedPorts.recordAudit({
        kind: "idempotent_attempt",
        payload: audit.payload,
      });
    }

    return {
      ok: classification.outcome === FIXTURE_PREP_OUTCOME.ALREADY_PREPARED,
      code: classification.outcome,
      idempotent: classification.idempotent === true,
      architecture: SELECTED_ARCHITECTURE,
      candidateJwtRequired: false,
      candidatePasswordRequired: false,
      mappingStatus: MAPPING_STATUS,
      normalizedEquivalence: NORMALIZED_EQUIVALENCE,
      isShadow: true,
      publishedAuthority: "V2",
      rolloutConfigMutated: false,
      phase4PilotUntouched: state.phase4PilotUntouched !== false,
      stagingMutations: 0,
      audit: audit.payload,
      executeMutations,
    };
  }

  const predictedWrites = {
    enrollmentRows: 1,
    v2PrimaryRows: state.hasV2Row ? 0 : 1,
    v5ProfileRows: 1,
    evidenceRows: 4,
    totalDurableWrites: state.hasV2Row ? 6 : 7,
    authUserCreations: 0,
    profileCreations: 0,
    rolloutConfigChanges: 0,
    phase4PilotChanges: 0,
  };

  const tally = {
    enrollmentRows: Number(input.runningTally?.enrollmentRows || 0) + predictedWrites.enrollmentRows,
    v2PrimaryRows: Number(input.runningTally?.v2PrimaryRows || 0) + predictedWrites.v2PrimaryRows,
    v5ProfileRows: Number(input.runningTally?.v5ProfileRows || 0) + predictedWrites.v5ProfileRows,
    evidenceRows: Number(input.runningTally?.evidenceRows || 0) + predictedWrites.evidenceRows,
    totalDurableWrites:
      Number(input.runningTally?.totalDurableWrites || 0) + predictedWrites.totalDurableWrites,
    authUserCreations: Number(input.runningTally?.authUserCreations || 0),
    profileCreations: Number(input.runningTally?.profileCreations || 0),
    rolloutConfigChanges: Number(input.runningTally?.rolloutConfigChanges || 0),
    phase4PilotChanges: Number(input.runningTally?.phase4PilotChanges || 0),
  };

  const budget = evaluateMutationBudget(tally);
  if (!budget.ok) {
    return deny(FIXTURE_PREP_OUTCOME.MUTATION_BUDGET_EXCEEDED, {
      violations: budget.violations,
      ceiling: MUTATION_BUDGET.TOTAL_DURABLE_WRITE_CEILING,
    });
  }

  // Dry-run / unit default: validate path without any durable write
  if (!executeMutations) {
    const audit = buildRedactedPrepAudit({
      candidateLabel: target.label,
      candidateIdHash: target.idHash,
      cohortLabel: cohort.cohortLabel,
      preparationVersion: input.preparationVersion || FIXTURE_PREP_VERSION,
      projectRef: project.projectRef,
      outcome: FIXTURE_PREP_OUTCOME.PREPARED,
      beforeStateFingerprint: buildStateFingerprint(state.beforeParts || {}),
      afterStateFingerprint: "dry_run_no_mutation",
      v2Raw: value.v2Raw,
      v5ScorerOutput: scoreCheck.display,
      idempotencyOutcome: FIXTURE_PREP_OUTCOME.PREPARED,
      rollbackHandle: buildRollbackHandle(project.projectRef, target.idHash),
      callerIdHash: hashPlayerIdForEvidence(caller.callerId),
      createdUpdatedRowCounts: predictedWrites,
    });

    return {
      ok: true,
      code: FIXTURE_PREP_OUTCOME.PREPARED,
      dryRun: true,
      architecture: SELECTED_ARCHITECTURE,
      candidateJwtRequired: false,
      candidatePasswordRequired: false,
      mappingStatus: MAPPING_STATUS,
      normalizedEquivalence: NORMALIZED_EQUIVALENCE,
      isShadow: true,
      publishedAuthority: "V2",
      v5ScorerOutput: scoreCheck.display,
      v2Raw: value.v2Raw,
      rolloutConfigMutated: false,
      phase4PilotUntouched: true,
      stagingMutations: 0,
      predictedWrites,
      audit: audit.payload,
      idempotencyKey: buildIdempotencyKey({
        projectRef: project.projectRef,
        cohortLabel: cohort.cohortLabel,
        targetIdHash: target.idHash,
      }),
      executeMutations: false,
    };
  }

  // Mutating path (Owner GO later) — still no candidate JWT
  let wrote = 0;
  try {
    const enroll = await mergedPorts.upsertEnrollment({
      playerId: input.target.profileId,
      tenantId: state.tenantId,
      cohortLabel: cohort.cohortLabel,
      status: "active",
      notes: `a3c:${FIXTURE_PREP_VERSION}:${target.idHash}`,
    });
    if (!enroll.ok) throw new Error(enroll.code || "ENROLLMENT_FAILED");
    wrote += enroll.wrote || 0;

    const v2 = await mergedPorts.syncV2Rating({
      authUserId: input.target.profileId,
      currentRating: value.v2Raw,
    });
    if (!v2.ok) throw new Error(v2.code || "V2_SYNC_FAILED");
    wrote += v2.wrote || 0;

    const draft = await mergedPorts.createDraftAssessment({
      playerId: input.target.profileId,
      tenantId: state.tenantId,
      callerId: caller.callerId,
      cohortLabel: cohort.cohortLabel,
      preparationVersion: FIXTURE_PREP_VERSION,
      idHash: target.idHash,
    });
    if (!draft.ok || !draft.assessment) {
      throw new Error(draft.code || "DRAFT_CREATE_FAILED");
    }
    wrote += draft.wrote || 0;

    const answers = buildFixtureAnswers(target.fixture);
    const scored = scoreAssessmentForPersistence(
      {
        assessment_id: draft.assessment.id,
        answers,
        ratingMode: "doubles",
        userId: input.target.profileId,
        tenantId: draft.assessment.tenant_id || state.tenantId,
      },
      draft.assessment
    );
    if (!scored.ok || scored.code !== "SCORED") {
      throw Object.assign(new Error(scored.code || "SCORE_FAILED"), { scored });
    }
    const display = scored.response.provisional_display_rating;
    if (Math.abs(display - target.fixture.v5TargetDisplay) > 1e-9) {
      await mergedPorts.rollbackTransaction({ reason: "SCORE_OUTPUT_MISMATCH" });
      return deny(FIXTURE_PREP_OUTCOME.SCORE_OUTPUT_MISMATCH, {
        expectedDisplay: target.fixture.v5TargetDisplay,
        actualDisplay: display,
      });
    }
    if (scored.persistence?.profile_patch?.is_shadow !== true) {
      await mergedPorts.rollbackTransaction({ reason: "SHADOW_INVARIANT" });
      return deny(FIXTURE_PREP_OUTCOME.INTERNAL_ERROR_ROLLED_BACK, {
        reason: "is_shadow must be true",
      });
    }

    const persist = await mergedPorts.persistCompletion({
      assessmentId: draft.assessment.id,
      payload: scored.persistence,
      callerId: caller.callerId,
    });
    if (!persist.ok) throw new Error(persist.code || "PERSIST_FAILED");
    wrote += persist.wrote || 0;

    const afterParts = {
      enrollment: "present",
      v2: "present",
      assessment: "completed",
      event: "present",
      profile: "shadow",
      prepAudit: "PREPARED",
    };

    const audit = buildRedactedPrepAudit({
      candidateLabel: target.label,
      candidateIdHash: target.idHash,
      cohortLabel: cohort.cohortLabel,
      preparationVersion: FIXTURE_PREP_VERSION,
      projectRef: project.projectRef,
      outcome: FIXTURE_PREP_OUTCOME.PREPARED,
      beforeStateFingerprint: buildStateFingerprint(state.beforeParts || {}),
      afterStateFingerprint: buildStateFingerprint(afterParts),
      v2Raw: value.v2Raw,
      v5ScorerOutput: display,
      idempotencyOutcome: FIXTURE_PREP_OUTCOME.PREPARED,
      rollbackHandle: buildRollbackHandle(project.projectRef, target.idHash),
      callerIdHash: hashPlayerIdForEvidence(caller.callerId),
      createdUpdatedRowCounts: { durable: wrote },
    });

    await mergedPorts.recordAudit({ kind: "prepared", payload: audit.payload });
    wrote += 1;

    return {
      ok: true,
      code: FIXTURE_PREP_OUTCOME.PREPARED,
      dryRun: false,
      architecture: SELECTED_ARCHITECTURE,
      candidateJwtRequired: false,
      candidatePasswordRequired: false,
      mappingStatus: MAPPING_STATUS,
      normalizedEquivalence: NORMALIZED_EQUIVALENCE,
      isShadow: true,
      publishedAuthority: "V2",
      v5ScorerOutput: display,
      v2Raw: value.v2Raw,
      rolloutConfigMutated: false,
      phase4PilotUntouched: true,
      stagingMutations: wrote,
      audit: audit.payload,
      executeMutations: true,
    };
  } catch (err) {
    await mergedPorts.rollbackTransaction({
      reason: String(err?.message || err),
    });
    return deny(FIXTURE_PREP_OUTCOME.INTERNAL_ERROR_ROLLED_BACK, {
      message: String(err?.message || err),
      stagingMutationsRolledBack: true,
    });
  }
}

function buildRollbackHandle(projectRef, idHash) {
  return `rb:${projectRef}:${FIXTURE_COHORT_LABEL}:${FIXTURE_PREP_VERSION}:${idHash}`;
}

function deny(code, extra = {}) {
  return {
    ok: false,
    code,
    candidateJwtRequired: false,
    candidatePasswordRequired: false,
    mappingStatus: MAPPING_STATUS,
    normalizedEquivalence: NORMALIZED_EQUIVALENCE,
    stagingMutations: 0,
    ...extra,
  };
}

export function resolveTargetIdHash(profileId) {
  return profileIdHash12(profileId);
}
