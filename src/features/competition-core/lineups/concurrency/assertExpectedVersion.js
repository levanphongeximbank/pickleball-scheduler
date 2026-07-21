/**
 * CORE-06 Phase 1E — optimistic concurrency helpers.
 * No silent rebase / merge of concurrent lineup edits.
 */

import { createLineupPolicyResult } from "../contracts/lineupPolicy.js";
import { LINEUP_RUNTIME_ERROR_CODE } from "../errors/runtimeErrorCodes.js";
import { fingerprintValue } from "../random/fingerprint.js";

/**
 * @param {object} params
 * @param {unknown} params.expectedVersion
 * @param {unknown} params.currentVersion
 * @param {boolean} [params.required]
 * @param {string|null} [params.aggregateIdentity]
 * @returns {import('../contracts/lineupPolicy.js').LineupPolicyResult}
 */
export function assertExpectedVersion({
  expectedVersion,
  currentVersion,
  required = false,
  aggregateIdentity = null,
}) {
  const hasExpected =
    expectedVersion != null &&
    expectedVersion !== "" &&
    Number.isInteger(Number(expectedVersion));

  if (!hasExpected) {
    if (required) {
      return createLineupPolicyResult({
        ok: false,
        code: LINEUP_RUNTIME_ERROR_CODE.LINEUP_EXPECTED_VERSION_REQUIRED,
        message: "expectedVersion is required by policy",
        details: { aggregateIdentity, currentVersion },
      });
    }
    return createLineupPolicyResult({
      ok: true,
      details: { skipped: true, currentVersion, aggregateIdentity },
    });
  }

  const expected = Number(expectedVersion);
  const current =
    currentVersion != null && Number.isInteger(Number(currentVersion))
      ? Number(currentVersion)
      : null;

  if (current == null) {
    return createLineupPolicyResult({
      ok: false,
      code: LINEUP_RUNTIME_ERROR_CODE.LINEUP_VERSION_CONFLICT,
      message: "Current aggregate version is unavailable",
      details: { expectedVersion: expected, currentVersion, aggregateIdentity },
    });
  }

  if (expected !== current) {
    return createLineupPolicyResult({
      ok: false,
      code:
        expected < current
          ? LINEUP_RUNTIME_ERROR_CODE.LINEUP_STALE_COMMAND
          : LINEUP_RUNTIME_ERROR_CODE.LINEUP_VERSION_CONFLICT,
      message:
        expected < current
          ? "Stale command: expectedVersion is behind currentVersion"
          : "expectedVersion does not match currentVersion",
      details: {
        expectedVersion: expected,
        currentVersion: current,
        aggregateIdentity,
      },
    });
  }

  return createLineupPolicyResult({
    ok: true,
    details: { expectedVersion: expected, currentVersion: current },
  });
}

/**
 * Canonical command fingerprint for idempotency / audit.
 * Excludes secrets and hidden opponent contents.
 * @param {object} command
 * @returns {string}
 */
export function buildCommandFingerprint(command = {}) {
  return fingerprintValue({
    kind: "LINEUP_COMMAND_V1",
    commandType: command.commandType ?? command.op ?? null,
    aggregateIdentity: command.aggregateIdentity ?? command.lineupIdentityKey ?? null,
    expectedVersion:
      command.expectedVersion != null ? Number(command.expectedVersion) : null,
    slots: Array.isArray(command.slots)
      ? command.slots.map((s) =>
          s && typeof s === "object"
            ? {
                disciplineOrSideKey: s.disciplineOrSideKey ?? null,
                index: s.index ?? null,
                personKind: s.person?.kind ?? null,
                personId: s.person?.id ?? null,
              }
            : null
        )
      : null,
    reason: command.reason ?? null,
    visibilityState: command.visibilityState ?? null,
    source: command.source ?? null,
    actorId: command.actorId ?? command.actor?.actorId ?? null,
    actorRole: command.actorRole ?? command.actor?.actorRole ?? null,
  });
}

/**
 * @param {unknown} result
 * @returns {string}
 */
export function buildResultFingerprint(result) {
  if (!result || typeof result !== "object") {
    return fingerprintValue({ kind: "LINEUP_RESULT_V1", result: null });
  }
  const value =
    /** @type {{ value?: { id?: unknown, revision?: unknown, status?: unknown, visibilityState?: unknown, identityKey?: unknown } }} */ (
      result
    ).value;
  return fingerprintValue({
    kind: "LINEUP_RESULT_V1",
    ok: /** @type {{ ok?: unknown }} */ (result).ok === true,
    code: /** @type {{ code?: unknown }} */ (result).code ?? null,
    id: value?.id ?? null,
    identityKey: value?.identityKey ?? null,
    revision: value?.revision ?? null,
    status: value?.status ?? null,
    visibilityState: value?.visibilityState ?? null,
  });
}
