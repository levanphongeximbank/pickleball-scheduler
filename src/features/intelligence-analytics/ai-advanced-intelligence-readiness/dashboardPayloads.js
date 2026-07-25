/**
 * Presentation-neutral AI insight payloads via I&A-04-compatible shapes (I&A-12).
 * No React components. No dashboard UI wiring.
 */

import { fail, ok } from "../contracts/result.js";
import { analyticsError, ANALYTICS_ERROR_CODE } from "../contracts/errors.js";
import {
  deepFreeze,
  isPlainObject,
} from "../contracts/shared.js";
import {
  INTELLIGENCE_CANDIDATE_STATUS,
  INTELLIGENCE_PRESENTATION_DATA_STATE,
} from "./enums.js";
import { ANALYTICS_DATA_STATE } from "../dashboard-reporting/enums.js";

/**
 * @param {string} candidateStatus
 * @returns {string}
 */
function mapCandidateToPresentationState(candidateStatus) {
  switch (candidateStatus) {
    case INTELLIGENCE_CANDIDATE_STATUS.GENERATED:
    case INTELLIGENCE_CANDIDATE_STATUS.APPROVED_FOR_PRESENTATION:
      return INTELLIGENCE_PRESENTATION_DATA_STATE.GENERATED;
    case INTELLIGENCE_CANDIDATE_STATUS.REQUIRES_REVIEW:
      return INTELLIGENCE_PRESENTATION_DATA_STATE.REQUIRES_REVIEW;
    case INTELLIGENCE_CANDIDATE_STATUS.ABSTAINED:
      return INTELLIGENCE_PRESENTATION_DATA_STATE.ABSTAINED;
    case INTELLIGENCE_CANDIDATE_STATUS.REJECTED:
      return INTELLIGENCE_PRESENTATION_DATA_STATE.REJECTED;
    case INTELLIGENCE_CANDIDATE_STATUS.EXPIRED:
      return INTELLIGENCE_PRESENTATION_DATA_STATE.EMPTY;
    default:
      return INTELLIGENCE_PRESENTATION_DATA_STATE.ERROR;
  }
}

/**
 * @param {unknown} input
 * @returns {import("../contracts/result.js").Result}
 */
export function composeIntelligenceInsightPresentationPayloads(input) {
  if (!isPlainObject(input)) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.PAYLOAD_INVALID,
        "Presentation payload input must be a plain object",
        "payloads"
      )
    );
  }

  if (input.denied === true) {
    return ok(
      deepFreeze({
        dataState: INTELLIGENCE_PRESENTATION_DATA_STATE.DENIED,
        analyticsDataState: ANALYTICS_DATA_STATE.UNAVAILABLE,
        insightCard: null,
        confidencePayload: null,
        explanationPayload: null,
        evidenceTable: Object.freeze([]),
        humanReviewState: null,
        abstentionState: null,
        safetyRejectionState: deepFreeze({ rejected: true, reason: "DENIED" }),
      })
    );
  }

  if (input.suppressed === true) {
    return ok(
      deepFreeze({
        dataState: INTELLIGENCE_PRESENTATION_DATA_STATE.SUPPRESSED,
        analyticsDataState: ANALYTICS_DATA_STATE.EMPTY,
        insightCard: null,
        note: "Suppressed values are not coerced to zero",
      })
    );
  }

  const candidate = input.candidate;
  if (!isPlainObject(candidate)) {
    return ok(
      deepFreeze({
        dataState: INTELLIGENCE_PRESENTATION_DATA_STATE.EMPTY,
        analyticsDataState: ANALYTICS_DATA_STATE.EMPTY,
        insightCard: null,
      })
    );
  }

  const dataState = mapCandidateToPresentationState(candidate.status);

  return ok(
    deepFreeze({
      dataState,
      analyticsDataState:
        dataState === INTELLIGENCE_PRESENTATION_DATA_STATE.GENERATED
          ? ANALYTICS_DATA_STATE.READY
          : dataState === INTELLIGENCE_PRESENTATION_DATA_STATE.ERROR
            ? ANALYTICS_DATA_STATE.ERROR
            : dataState === INTELLIGENCE_PRESENTATION_DATA_STATE.REQUIRES_REVIEW
              ? ANALYTICS_DATA_STATE.PARTIAL
              : ANALYTICS_DATA_STATE.EMPTY,
      insightCard: deepFreeze({
        candidateId: candidate.candidateId,
        status: candidate.status,
        title: input.title ?? "Advisory intelligence candidate",
        body: candidate.structuredOutput ?? {},
        isCanonicalDomainState: false,
        isAdvisoryCandidate: true,
      }),
      confidencePayload: candidate.confidence
        ? deepFreeze({ ...candidate.confidence })
        : null,
      uncertaintyPayload: candidate.uncertainty
        ? deepFreeze({ ...candidate.uncertainty })
        : null,
      explanationPayload: candidate.explanation
        ? deepFreeze({ ...candidate.explanation })
        : null,
      evidenceTable: Object.freeze(
        Array.isArray(candidate.explanation?.evidence)
          ? candidate.explanation.evidence
          : []
      ),
      humanReviewState: deepFreeze({
        required: candidate.humanReviewRequired === true,
        status: candidate.status,
      }),
      abstentionState:
        candidate.status === INTELLIGENCE_CANDIDATE_STATUS.ABSTAINED
          ? deepFreeze({
              abstained: true,
              reason: candidate.structuredOutput?.abstentionReason,
            })
          : null,
      safetyRejectionState:
        candidate.status === INTELLIGENCE_CANDIDATE_STATUS.REJECTED
          ? deepFreeze({
              rejected: true,
              safetyDecisions: candidate.safetyDecisions ?? [],
            })
          : null,
      evaluationSummaryPayload: isPlainObject(input.evaluationSummary)
        ? deepFreeze({ ...input.evaluationSummary })
        : null,
      driftQualitySignalPayload: isPlainObject(input.driftSignal)
        ? deepFreeze({ ...input.driftSignal })
        : null,
    })
  );
}
