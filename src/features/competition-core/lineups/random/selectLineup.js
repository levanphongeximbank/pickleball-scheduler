/**
 * CORE-06 Phase 1D — deterministic lineup selection (no Math.random / clock).
 */

import {
  createPermissiveLineupRandomPolicy,
  isLineupRandomPolicy,
} from "../contracts/lineupRandomPolicy.js";
import {
  createLineupRandomSelectResult,
} from "../contracts/lineupRandomRequest.js";
import {
  createMissingLineupResolution,
  MISSING_LINEUP_OUTCOME,
  MISSING_LINEUP_POLICY,
} from "../contracts/missingLineupResolution.js";
import { LINEUP_RUNTIME_ERROR_CODE } from "../errors/runtimeErrorCodes.js";
import { LineupRuntimeError } from "../errors/LineupRuntimeError.js";
import { isLineupRuntimeError } from "../errors/LineupRuntimeError.js";
import {
  LINEUP_RANDOM_ALGORITHM,
  createRngFromMaterial,
  deterministicShuffle,
} from "./algorithm.js";
import {
  normalizeRosterCandidates,
  normalizeSlotTemplate,
} from "./candidates.js";
import {
  fingerprintInput,
  fingerprintSeed,
  fingerprintSelection,
  serializeCanonical,
} from "./fingerprint.js";
import { normalizeSeed } from "./seed.js";

/**
 * @param {unknown} scope
 * @param {string} lineupIdentityKey
 */
function assertScope(scope, lineupIdentityKey) {
  const key = String(lineupIdentityKey || "").trim();
  if (!key) {
    throw new LineupRuntimeError(
      LINEUP_RUNTIME_ERROR_CODE.INVALID_SCOPE,
      "lineupIdentityKey is required",
      {}
    );
  }
  if (scope == null) return;
  if (typeof scope !== "object" || Array.isArray(scope)) {
    throw new LineupRuntimeError(
      LINEUP_RUNTIME_ERROR_CODE.INVALID_SCOPE,
      "scope must be a plain object when provided",
      {}
    );
  }
  const s = /** @type {Record<string, unknown>} */ (scope);
  const required = ["tenantId", "competitionId", "teamId"];
  for (const field of required) {
    const v = s[field];
    if (v == null || String(v).trim() === "") {
      throw new LineupRuntimeError(
        LINEUP_RUNTIME_ERROR_CODE.INVALID_SCOPE,
        `scope.${field} is required`,
        { field }
      );
    }
  }
}

/**
 * @param {import('../contracts/lineupRandomRequest.js').LineupRandomSelectRequest} request
 * @returns {import('../contracts/lineupRandomRequest.js').LineupRandomSelectResult}
 */
export function selectLineupDeterministic(request) {
  try {
    const seed = normalizeSeed(request?.seed);
    const lineupIdentityKey = String(request?.lineupIdentityKey || "").trim();
    assertScope(request?.scope, lineupIdentityKey);

    const policy = isLineupRandomPolicy(request?.policy)
      ? request.policy
      : createPermissiveLineupRandomPolicy();

    const { candidates, rosterId, rosterVersion } = normalizeRosterCandidates(
      request?.rosterSnapshot
    );
    const slots = normalizeSlotTemplate(request?.slotTemplate);

    const scope = request?.scope && typeof request.scope === "object"
      ? /** @type {Record<string, unknown>} */ (request.scope)
      : {};

    if (
      scope.rosterVersion != null &&
      rosterVersion != null &&
      String(scope.rosterVersion) !== String(rosterVersion)
    ) {
      throw new LineupRuntimeError(
        LINEUP_RUNTIME_ERROR_CODE.ROSTER_VERSION_MISMATCH,
        "scope.rosterVersion does not match roster snapshot",
        {
          scopeRosterVersion: scope.rosterVersion,
          snapshotRosterVersion: rosterVersion,
        }
      );
    }

    if (
      scope.rosterId != null &&
      rosterId != null &&
      String(scope.rosterId).trim() !== String(rosterId).trim()
    ) {
      throw new LineupRuntimeError(
        LINEUP_RUNTIME_ERROR_CODE.INVALID_SCOPE,
        "scope.rosterId does not match roster snapshot",
        { scopeRosterId: scope.rosterId, snapshotRosterId: rosterId }
      );
    }

    const policyCtx = {
      tenantId: scope.tenantId != null ? String(scope.tenantId) : null,
      competitionId:
        scope.competitionId != null ? String(scope.competitionId) : null,
      teamId: scope.teamId != null ? String(scope.teamId) : null,
      rosterId: rosterId,
      rosterVersion: rosterVersion,
      contextId: scope.contextId != null ? String(scope.contextId) : null,
      lineupIdentityKey,
      rosterSnapshot: request.rosterSnapshot,
      slotTemplate: request.slotTemplate,
      scope: request.scope,
      actor: request.actor,
      source: request.source ?? null,
      extras: request.extras || {},
    };

    const allowDup =
      typeof policy.allowsDuplicateParticipants === "function"
        ? policy.allowsDuplicateParticipants(policyCtx) === true
        : false;

    const seedFingerprint = fingerprintSeed(seed);
    const inputFingerprint = fingerprintInput({
      seedFingerprint,
      lineupIdentityKey,
      algorithmId: LINEUP_RANDOM_ALGORITHM.id,
      algorithmVersion: LINEUP_RANDOM_ALGORITHM.version,
      scope: {
        tenantId: policyCtx.tenantId,
        competitionId: policyCtx.competitionId,
        teamId: policyCtx.teamId,
        rosterId: policyCtx.rosterId,
        rosterVersion:
          policyCtx.rosterVersion != null
            ? String(policyCtx.rosterVersion)
            : null,
        contextId: policyCtx.contextId,
      },
      candidateTokens: candidates.map((c) => c.identityToken),
      slots: slots.map((s) => ({
        disciplineOrSideKey: s.disciplineOrSideKey,
        index: s.index,
      })),
      policyId: policy.id,
      allowDup,
      source: request.source ?? null,
    });

    /** @type {Set<string>} */
    const used = new Set();
    /** @type {Array<{ disciplineOrSideKey: string, index: number, identityToken: string, person: { kind: string, id: string } }>} */
    const selectedSlots = [];

    for (const slot of slots) {
      let pool = candidates.filter((c) => {
        if (!allowDup && used.has(c.identityToken)) return false;
        if (typeof policy.filterEligible === "function") {
          if (policy.filterEligible(c, policyCtx) !== true) return false;
        }
        if (typeof policy.validateCandidateUse === "function") {
          const use = policy.validateCandidateUse(c, policyCtx);
          if (!use || use.ok !== true) return false;
        }
        return true;
      });

      if (pool.length === 0) {
        throw new LineupRuntimeError(
          LINEUP_RUNTIME_ERROR_CODE.INSUFFICIENT_ELIGIBLE_PARTICIPANTS,
          "No eligible participants remain for slot",
          {
            disciplineOrSideKey: slot.disciplineOrSideKey,
            index: slot.index,
          }
        );
      }

      const slotSeedMaterial = [
        seed,
        inputFingerprint,
        slot.disciplineOrSideKey,
        String(slot.index),
      ].join("\u001f");
      const rng = createRngFromMaterial(slotSeedMaterial);
      pool = deterministicShuffle(pool, rng);

      let picked = null;
      for (const candidate of pool) {
        if (typeof policy.validateSlotAssignment === "function") {
          const check = policy.validateSlotAssignment(
            {
              disciplineOrSideKey: slot.disciplineOrSideKey,
              index: slot.index,
              candidate,
              selectedSoFar: selectedSlots.map((s) => ({
                identityToken: s.identityToken,
                person: s.person,
                attrs: {},
              })),
            },
            policyCtx
          );
          if (!check || check.ok !== true) {
            continue;
          }
        }
        picked = candidate;
        break;
      }

      if (!picked) {
        throw new LineupRuntimeError(
          LINEUP_RUNTIME_ERROR_CODE.UNSATISFIABLE_POLICY,
          "Policy rejected all candidates for slot",
          {
            disciplineOrSideKey: slot.disciplineOrSideKey,
            index: slot.index,
          }
        );
      }

      selectedSlots.push({
        disciplineOrSideKey: slot.disciplineOrSideKey,
        index: slot.index,
        identityToken: picked.identityToken,
        person: { kind: picked.person.kind, id: picked.person.id },
      });
      used.add(picked.identityToken);
    }

    const rosterTokenSet = new Set(candidates.map((c) => c.identityToken));
    for (const selected of selectedSlots) {
      if (!rosterTokenSet.has(selected.identityToken)) {
        throw new LineupRuntimeError(
          LINEUP_RUNTIME_ERROR_CODE.NON_DETERMINISTIC_INPUT,
          "Selected participant is not in roster snapshot",
          { identityToken: selected.identityToken }
        );
      }
    }

    const selectionFingerprint = fingerprintSelection(selectedSlots);
    const resolution = createMissingLineupResolution({
      policy: MISSING_LINEUP_POLICY.RANDOM,
      outcome: MISSING_LINEUP_OUTCOME.RANDOMIZED,
      seed,
      seedFingerprint,
      algorithmId: LINEUP_RANDOM_ALGORITHM.id,
      algorithmVersion: LINEUP_RANDOM_ALGORITHM.version,
      reason: null,
      reasonCodes: [],
      details: {
        inputFingerprint,
        selectionFingerprint,
        // Explicit: does not auto-publish / reveal / forfeit.
        lifecycleAutoTransition: false,
      },
    });

    return createLineupRandomSelectResult({
      ok: true,
      deterministic: true,
      selectedSlots,
      normalizedSeed: seed,
      seedFingerprint,
      algorithmId: LINEUP_RANDOM_ALGORITHM.id,
      algorithmVersion: LINEUP_RANDOM_ALGORITHM.version,
      inputFingerprint,
      selectionFingerprint,
      resolution,
      code: null,
      message: null,
      metadata: {
        actor:
          request.actor && typeof request.actor === "object"
            ? {
                actorId:
                  /** @type {{ actorId?: unknown }} */ (request.actor)
                    .actorId != null
                    ? String(
                        /** @type {{ actorId?: unknown }} */ (request.actor)
                          .actorId
                      )
                    : null,
                actorRole:
                  /** @type {{ actorRole?: unknown }} */ (request.actor)
                    .actorRole != null
                    ? String(
                        /** @type {{ actorRole?: unknown }} */ (request.actor)
                          .actorRole
                      )
                    : null,
              }
            : null,
        source: request.source ?? null,
        idempotencyKey: request.idempotencyKey ?? null,
        expectedVersion: request.expectedVersion ?? null,
        payloadCanonical: serializeCanonical({
          seedFingerprint,
          inputFingerprint,
          selectionFingerprint,
        }),
      },
    });
  } catch (err) {
    if (isLineupRuntimeError(err)) {
      const resolution = createMissingLineupResolution({
        policy: MISSING_LINEUP_POLICY.BLOCKED,
        outcome: MISSING_LINEUP_OUTCOME.BLOCKED,
        seed: null,
        reason: err.message,
        reasonCodes: [err.code],
        details: { ...(err.details || {}) },
      });
      return createLineupRandomSelectResult({
        ok: false,
        deterministic: true,
        selectedSlots: [],
        algorithmId: LINEUP_RANDOM_ALGORITHM.id,
        algorithmVersion: LINEUP_RANDOM_ALGORITHM.version,
        resolution,
        code: err.code,
        message: err.message,
        metadata: { details: err.details || {} },
      });
    }
    throw err;
  }
}
