/**
 * Phase 3B — shadow resolve helper (non-Production).
 * Compares a resolve result against an optional legacy/canonical fixture.
 * Does NOT enable Shadow globally and does NOT call Production paths.
 */

import {
  createShadowComparisonResult,
} from "../../../runtime-control/shadow/contracts/shadowComparison.js";
import { createShadowDifference } from "../../../runtime-control/shadow/contracts/shadowDifference.js";
import { SHADOW_COMPARISON_STATUS } from "../../../runtime-control/shadow/constants/shadowComparisonStatuses.js";
import { SHADOW_REASON_CODE } from "../../../runtime-control/shadow/constants/shadowReasonCodes.js";
import {
  SHADOW_DIFFERENCE_KIND,
  SHADOW_DIFFERENCE_SEVERITY,
} from "../../../runtime-control/shadow/constants/shadowDifferenceKinds.js";
import { identityFromCompetitionParticipant } from "../../contracts/identity.js";
import { normalizeParticipantShadowPayload } from "./normalizers/participant.js";
import { compareParticipantShadowPayloads } from "./comparators/participant.js";

/**
 * @param {import('../contracts/resolveResult.js').ParticipantResolveResult} resolveResult
 * @param {{ legacyParticipant?: unknown, compareWith?: unknown }} [options]
 * @returns {{
 *   resolveResult: import('../contracts/resolveResult.js').ParticipantResolveResult,
 *   shadow: import('../../../runtime-control/shadow/contracts/shadowComparison.js').ShadowComparisonResult,
 * }}
 */
export function resolveShadow(resolveResult, options = {}) {
  if (!resolveResult?.ok || !resolveResult.participant) {
    return {
      resolveResult,
      shadow: createShadowComparisonResult({
        status: SHADOW_COMPARISON_STATUS.NOT_COMPARABLE,
        reasonCode: SHADOW_REASON_CODE.COMPARISON_SKIPPED,
        metadata: {
          phase: "3b",
          note: "resolve failed — shadow not comparable",
          resolveError: resolveResult?.error ?? null,
        },
      }),
    };
  }

  const canonicalNorm = normalizeParticipantShadowPayload(resolveResult.participant);
  const compareTarget =
    options.compareWith ?? options.legacyParticipant ?? null;

  if (compareTarget == null) {
    return {
      resolveResult,
      shadow: createShadowComparisonResult({
        status: SHADOW_COMPARISON_STATUS.SKIPPED,
        reasonCode: SHADOW_REASON_CODE.COMPARISON_SKIPPED,
        canonicalFingerprint: canonicalNorm.fingerprint,
        metadata: {
          phase: "3b",
          note: "no compare fixture provided — shadow skipped",
          identityKey: resolveResult.identity?.key ?? null,
        },
      }),
    };
  }

  const legacyNorm = normalizeParticipantShadowPayload(compareTarget);
  const comparison = compareParticipantShadowPayloads(legacyNorm, canonicalNorm);

  // Guest loss is always a blocker-class difference.
  const canonicalIdentity = identityFromCompetitionParticipant(
    resolveResult.participant
  );
  if (
    resolveResult.participant.person?.kind === "GUEST" &&
    (!canonicalIdentity || !resolveResult.participant.person.id)
  ) {
    comparison.differences.push(
      createShadowDifference({
        path: "person.id",
        kind: SHADOW_DIFFERENCE_KIND.MISSING_IN_CANONICAL,
        severity: SHADOW_DIFFERENCE_SEVERITY.CRITICAL,
        message: "Guest identity lost",
      })
    );
    comparison.status = SHADOW_COMPARISON_STATUS.NON_EQUIVALENT;
  }

  return {
    resolveResult,
    shadow: comparison,
  };
}
