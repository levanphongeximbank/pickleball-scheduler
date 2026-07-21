/**
 * CORE-06 Phase 1D — missing-lineup resolution orchestration.
 * Policy decides strategy; Core records outcome only (no forfeit adjudication).
 * Randomization does not widen lineup lifecycle — no auto publish/reveal/score.
 */

import {
  createPermissiveLineupRandomPolicy,
  isLineupRandomPolicy,
} from "../contracts/lineupRandomPolicy.js";
import {
  createLineupRandomSelectRequest,
  createLineupRandomSelectResult,
} from "../contracts/lineupRandomRequest.js";
import {
  createMissingLineupResolution,
  MISSING_LINEUP_OUTCOME,
  MISSING_LINEUP_POLICY,
  MISSING_LINEUP_POLICY_VALUES,
} from "../contracts/missingLineupResolution.js";
import { LINEUP_RUNTIME_ERROR_CODE } from "../errors/runtimeErrorCodes.js";
import {
  matchesLineupIdempotencyPort,
  createInMemoryLineupIdempotencyPort,
} from "../ports/idempotencyPort.js";
import { LINEUP_RANDOM_ALGORITHM } from "../random/algorithm.js";
import { fingerprintValue, serializeCanonical } from "../random/fingerprint.js";
import { selectLineupDeterministic } from "../random/selectLineup.js";

/**
 * @param {unknown} strategy
 * @returns {string}
 */
function normalizeStrategy(strategy) {
  const raw = String(strategy || "").trim();
  if (MISSING_LINEUP_POLICY_VALUES.has(raw)) return raw;
  // ASCII-only fold for known aliases — no locale case mapping.
  let folded = "";
  for (let i = 0; i < raw.length; i += 1) {
    const code = raw.charCodeAt(i);
    folded +=
      code >= 65 && code <= 90
        ? String.fromCharCode(code + 32)
        : raw.charAt(i);
  }
  if (MISSING_LINEUP_POLICY_VALUES.has(folded)) return folded;
  return MISSING_LINEUP_POLICY.BLOCKED;
}

/**
 * Canonical payload hash for idempotency (no secrets / clock).
 * @param {import('../contracts/lineupRandomRequest.js').LineupRandomSelectRequest} request
 * @returns {string}
 */
export function buildMissingLineupPayloadHash(request) {
  const scope =
    request.scope && typeof request.scope === "object" ? request.scope : {};
  const roster = request.rosterSnapshot;
  const members =
    roster && typeof roster === "object" && Array.isArray(roster.members)
      ? roster.members
          .map((m) => {
            if (!m || typeof m !== "object") return null;
            const person = /** @type {{ person?: { kind?: unknown, id?: unknown } }} */ (
              m
            ).person;
            if (!person) return null;
            return `${String(person.kind || "").trim()}:${String(person.id || "").trim()}`;
          })
          .filter(Boolean)
          .sort()
      : [];
  const slots =
    request.slotTemplate &&
    typeof request.slotTemplate === "object" &&
    Array.isArray(
      /** @type {{ slots?: unknown }} */ (request.slotTemplate).slots
    )
      ? /** @type {{ slots: unknown[] }} */ (request.slotTemplate).slots
          .map((s) => {
            if (!s || typeof s !== "object") return null;
            const d = String(
              /** @type {{ disciplineOrSideKey?: unknown }} */ (s)
                .disciplineOrSideKey || ""
            ).trim();
            const idx = /** @type {{ index?: unknown }} */ (s).index;
            return `${d}::${String(idx)}`;
          })
          .filter(Boolean)
          .sort()
      : [];

  return fingerprintValue({
    kind: "MISSING_LINEUP_PAYLOAD_V1",
    seed: request.seed,
    lineupIdentityKey: request.lineupIdentityKey,
    scope: {
      tenantId: scope.tenantId ?? null,
      competitionId: scope.competitionId ?? null,
      teamId: scope.teamId ?? null,
      rosterId: scope.rosterId ?? null,
      rosterVersion:
        scope.rosterVersion != null ? String(scope.rosterVersion) : null,
      contextId: scope.contextId ?? null,
    },
    members,
    slots,
    policyId:
      request.policy && typeof request.policy === "object"
        ? /** @type {{ id?: unknown }} */ (request.policy).id ?? null
        : null,
    source: request.source ?? null,
    expectedVersion:
      request.expectedVersion != null ? String(request.expectedVersion) : null,
    lineupRevisionId: request.lineupRevisionId ?? null,
    commandId: request.commandId ?? null,
  });
}

/**
 * @param {object} [options]
 * @param {import('../ports/idempotencyPort.js').LineupIdempotencyPort} [options.idempotency]
 * @returns {{
 *   resolveMissingLineup: (request: import('../contracts/lineupRandomRequest.js').LineupRandomSelectRequest) => Promise<import('../contracts/lineupRandomRequest.js').LineupRandomSelectResult>,
 *   selectLineup: (request: import('../contracts/lineupRandomRequest.js').LineupRandomSelectRequest) => Promise<import('../contracts/lineupRandomRequest.js').LineupRandomSelectResult>,
 * }}
 */
export function createMissingLineupResolver(options = {}) {
  const idempotency = matchesLineupIdempotencyPort(options.idempotency)
    ? options.idempotency
    : createInMemoryLineupIdempotencyPort();

  /**
   * @param {import('../contracts/lineupRandomRequest.js').LineupRandomSelectRequest} raw
   */
  async function resolveMissingLineup(raw) {
    const request = createLineupRandomSelectRequest(raw || {});
    const policy = isLineupRandomPolicy(request.policy)
      ? request.policy
      : createPermissiveLineupRandomPolicy();

    const idempotencyKey = request.idempotencyKey;
    const payloadHash = buildMissingLineupPayloadHash(request);

    if (idempotencyKey) {
      const lookup = await idempotency.lookup(idempotencyKey, payloadHash);
      if (lookup.conflict) {
        return createLineupRandomSelectResult({
          ok: false,
          deterministic: true,
          selectedSlots: [],
          algorithmId: LINEUP_RANDOM_ALGORITHM.id,
          algorithmVersion: LINEUP_RANDOM_ALGORITHM.version,
          code: LINEUP_RUNTIME_ERROR_CODE.LINEUP_IDEMPOTENCY_CONFLICT,
          message: "Idempotency key reused with different payload",
          resolution: createMissingLineupResolution({
            policy: MISSING_LINEUP_POLICY.BLOCKED,
            outcome: MISSING_LINEUP_OUTCOME.BLOCKED,
            reason: "Idempotency key reused with different payload",
            reasonCodes: [
              LINEUP_RUNTIME_ERROR_CODE.LINEUP_IDEMPOTENCY_CONFLICT,
            ],
            details: { idempotencyKey },
          }),
          metadata: { idempotencyKey, payloadHash },
        });
      }
      if (lookup.found && lookup.record?.result) {
        return /** @type {import('../contracts/lineupRandomRequest.js').LineupRandomSelectResult} */ (
          lookup.record.result
        );
      }
    }

    const strategy = normalizeStrategy(
      policy.decideMissingStrategy({
        tenantId: request.scope?.tenantId ?? null,
        competitionId: request.scope?.competitionId ?? null,
        teamId: request.scope?.teamId ?? null,
        rosterId: request.scope?.rosterId ?? null,
        rosterVersion: request.scope?.rosterVersion ?? null,
        contextId: request.scope?.contextId ?? null,
        lineupIdentityKey: request.lineupIdentityKey,
        rosterSnapshot: request.rosterSnapshot,
        slotTemplate: request.slotTemplate,
        scope: request.scope,
        actor: request.actor,
        source: request.source,
        extras: request.extras || {},
      })
    );

    /** @type {import('../contracts/lineupRandomRequest.js').LineupRandomSelectResult} */
    let result;

    if (strategy === MISSING_LINEUP_POLICY.MANUAL_PENDING) {
      result = createLineupRandomSelectResult({
        ok: true,
        deterministic: true,
        selectedSlots: [],
        algorithmId: LINEUP_RANDOM_ALGORITHM.id,
        algorithmVersion: LINEUP_RANDOM_ALGORITHM.version,
        resolution: createMissingLineupResolution({
          policy: MISSING_LINEUP_POLICY.MANUAL_PENDING,
          outcome: MISSING_LINEUP_OUTCOME.MANUAL_PENDING,
          reason: "Manual resolution required",
          reasonCodes: [
            LINEUP_RUNTIME_ERROR_CODE.MANUAL_RESOLUTION_REQUIRED,
          ],
          details: { lifecycleAutoTransition: false },
        }),
        code: LINEUP_RUNTIME_ERROR_CODE.MANUAL_RESOLUTION_REQUIRED,
        message: "Manual resolution required",
        metadata: {
          source: request.source,
          actor: request.actor,
          idempotencyKey,
        },
      });
    } else if (strategy === MISSING_LINEUP_POLICY.FORFEIT_PENDING) {
      result = createLineupRandomSelectResult({
        ok: true,
        deterministic: true,
        selectedSlots: [],
        algorithmId: LINEUP_RANDOM_ALGORITHM.id,
        algorithmVersion: LINEUP_RANDOM_ALGORITHM.version,
        resolution: createMissingLineupResolution({
          policy: MISSING_LINEUP_POLICY.FORFEIT_PENDING,
          outcome: MISSING_LINEUP_OUTCOME.FORFEIT_PENDING,
          reason: "Forfeit review required — CORE-06 records only",
          reasonCodes: [
            LINEUP_RUNTIME_ERROR_CODE.FORFEIT_REVIEW_REQUIRED,
          ],
          details: {
            lifecycleAutoTransition: false,
            forfeitAdjudicationOwnedBy: "Format/competition workflow",
          },
        }),
        code: LINEUP_RUNTIME_ERROR_CODE.FORFEIT_REVIEW_REQUIRED,
        message: "Forfeit review required",
        metadata: {
          source: request.source,
          actor: request.actor,
          idempotencyKey,
        },
      });
    } else if (strategy === MISSING_LINEUP_POLICY.BLOCKED) {
      result = createLineupRandomSelectResult({
        ok: false,
        deterministic: true,
        selectedSlots: [],
        algorithmId: LINEUP_RANDOM_ALGORITHM.id,
        algorithmVersion: LINEUP_RANDOM_ALGORITHM.version,
        resolution: createMissingLineupResolution({
          policy: MISSING_LINEUP_POLICY.BLOCKED,
          outcome: MISSING_LINEUP_OUTCOME.BLOCKED,
          reason: "Randomization not allowed by policy",
          reasonCodes: [
            LINEUP_RUNTIME_ERROR_CODE.RANDOMIZATION_NOT_ALLOWED,
          ],
          details: { lifecycleAutoTransition: false },
        }),
        code: LINEUP_RUNTIME_ERROR_CODE.RANDOMIZATION_NOT_ALLOWED,
        message: "Randomization not allowed by policy",
        metadata: {
          source: request.source,
          actor: request.actor,
          idempotencyKey,
        },
      });
    } else {
      // RANDOM
      result = selectLineupDeterministic({
        ...request,
        policy,
      });
      if (!result.ok && !result.resolution) {
        result = createLineupRandomSelectResult({
          ...result,
          resolution: createMissingLineupResolution({
            policy: MISSING_LINEUP_POLICY.BLOCKED,
            outcome: MISSING_LINEUP_OUTCOME.BLOCKED,
            reason: result.message,
            reasonCodes: result.code ? [result.code] : [],
          }),
        });
      }
    }

    if (idempotencyKey) {
      await idempotency.remember({
        key: idempotencyKey,
        payloadHash,
        result,
        at: null,
      });
    }

    return result;
  }

  return {
    resolveMissingLineup,
    selectLineup: resolveMissingLineup,
  };
}

/**
 * @param {import('../contracts/lineupRandomRequest.js').LineupRandomSelectRequest} request
 * @returns {string}
 */
export function debugCanonicalPayload(request) {
  return serializeCanonical({
    hash: buildMissingLineupPayloadHash(request),
  });
}
