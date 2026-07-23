/**
 * CORE-19 adapter — CORE-16 Scoring Engine signal mapping.
 *
 * Imports only from the CORE-16 public barrel.
 * Never records points or mutates scoring state.
 * A match-complete scoring signal may permit CORE-17 validation progression only.
 * Projections never imply a validated final result or standings readiness.
 */

import { SCORING_EVENT_TYPE } from "../../scoring/index.js";
import { WORKFLOW_ERROR_CODE } from "../errors/workflowErrorCodes.js";
import { createTransitionPrerequisiteResult } from "../contracts/workflowDecisions.js";
import {
  compareStableString,
  isPlainObject,
} from "../utils/canonicalizeWorkflowPayload.js";

const DEPENDENCY = "core-16:scoring";

/**
 * @param {unknown} value
 * @returns {boolean}
 */
function isProjection(value) {
  if (!isPlainObject(value)) return false;
  if (value.projectionKind != null) return true;
  if (value.validatedFinalResult === false && value.schemaVersion != null) {
    return true;
  }
  if (
    Object.prototype.hasOwnProperty.call(value, "calculatedMatchComplete") &&
    !Object.prototype.hasOwnProperty.call(value, "eventType")
  ) {
    return true;
  }
  return false;
}

/**
 * @param {unknown} value
 * @returns {boolean}
 */
function isMatchCompletedEvent(value) {
  if (!isPlainObject(value)) return false;
  return value.eventType === SCORING_EVENT_TYPE.MATCH_COMPLETED;
}

/**
 * Map canonical scoring output/events into a workflow prerequisite / dependency signal.
 *
 * @param {object} [input]
 * @param {unknown} [input.event]
 * @param {unknown} [input.events]
 * @param {unknown} [input.projection]
 * @param {unknown} [input.scoringOutput]
 * @param {string|null} [input.prerequisiteId]
 * @returns {Readonly<import('../contracts/workflowDecisions.js').TransitionPrerequisiteResult>}
 */
export function adaptCore16ScoringSignal(input = {}) {
  const source = isPlainObject(input) ? input : {};
  const events = [];
  if (Array.isArray(source.events)) events.push(...source.events);
  if (source.event != null) events.push(source.event);

  const projection =
    source.projection ||
    (isProjection(source.scoringOutput) ? source.scoringOutput : null);
  const scoringOutput =
    source.scoringOutput && !isProjection(source.scoringOutput)
      ? source.scoringOutput
      : null;

  if (scoringOutput != null && isPlainObject(scoringOutput)) {
    if (scoringOutput.eventType) events.push(scoringOutput);
    else if (Array.isArray(scoringOutput.events)) {
      events.push(...scoringOutput.events);
    }
  }

  const sortedEvents = [...events]
    .filter((e) => isPlainObject(e))
    .sort((a, b) =>
      compareStableString(String(a.eventId || ""), String(b.eventId || ""))
    );

  const matchCompletedEvents = sortedEvents.filter(isMatchCompletedEvent);
  const hasMatchCompletedSignal =
    matchCompletedEvents.length > 0 ||
    (isPlainObject(scoringOutput) &&
      (scoringOutput.matchComplete === true ||
        scoringOutput.eventType === SCORING_EVENT_TYPE.MATCH_COMPLETED));

  const projectionComplete =
    isPlainObject(projection) &&
    (projection.calculatedMatchComplete === true ||
      projection.matchComplete === true);

  // Projection alone never implies validated result or standings readiness.
  if (projection && !hasMatchCompletedSignal) {
    return createTransitionPrerequisiteResult({
      satisfied: false,
      code: WORKFLOW_ERROR_CODE.DEPENDENCY_NOT_READY,
      message:
        "Scoring projection does not imply a validated result or validation progression",
      dependencyRef: DEPENDENCY,
      details: {
        dependency: DEPENDENCY,
        dependencyCode: WORKFLOW_ERROR_CODE.DEPENDENCY_NOT_READY,
        prerequisiteId:
          source.prerequisiteId != null ? String(source.prerequisiteId) : null,
        signalKind: "PROJECTION",
        permitsValidationProgression: false,
        impliesValidatedResult: false,
        impliesStandingsReadiness: false,
        calculatedMatchComplete: projectionComplete,
        projectionKind: projection.projectionKind ?? null,
        validatedFinalResult: false,
        acceptedFinalResult: false,
        eventIds: Object.freeze([]),
        eventTypes: Object.freeze([]),
        blockingReasons: Object.freeze([
          "Scoring projection is not a validated final result",
        ]),
        warnings: Object.freeze(
          projectionComplete
            ? ["CALCULATED_MATCH_COMPLETE_PROJECTION_ONLY"].sort(
                compareStableString
              )
            : []
        ),
      },
    });
  }

  if (hasMatchCompletedSignal) {
    const eventIds = Object.freeze(
      matchCompletedEvents
        .map((e) => String(e.eventId || ""))
        .filter(Boolean)
        .sort(compareStableString)
    );
    const eventTypes = Object.freeze(
      matchCompletedEvents
        .map((e) => String(e.eventType || ""))
        .sort(compareStableString)
    );

    return createTransitionPrerequisiteResult({
      satisfied: true,
      code: "SCORING_MATCH_COMPLETED_SIGNAL",
      message:
        "Match-completed scoring signal permits progression to CORE-17 validation only",
      dependencyRef: DEPENDENCY,
      details: {
        dependency: DEPENDENCY,
        dependencyCode: "SCORING_MATCH_COMPLETED_SIGNAL",
        prerequisiteId:
          source.prerequisiteId != null ? String(source.prerequisiteId) : null,
        signalKind: "MATCH_COMPLETED_EVENT",
        permitsValidationProgression: true,
        impliesValidatedResult: false,
        impliesStandingsReadiness: false,
        eventIds,
        eventTypes,
        errorMetadata: Object.freeze(
          matchCompletedEvents
            .map((e) => e.errorCode || e.code || null)
            .filter(Boolean)
            .map(String)
            .sort(compareStableString)
        ),
        blockingReasons: Object.freeze([]),
        warnings: Object.freeze([]),
      },
    });
  }

  return createTransitionPrerequisiteResult({
    satisfied: false,
    code: WORKFLOW_ERROR_CODE.DEPENDENCY_NOT_READY,
    message: "No match-completed scoring signal available",
    dependencyRef: DEPENDENCY,
    details: {
      dependency: DEPENDENCY,
      dependencyCode: WORKFLOW_ERROR_CODE.DEPENDENCY_NOT_READY,
      prerequisiteId:
        source.prerequisiteId != null ? String(source.prerequisiteId) : null,
      signalKind: "ABSENT",
      permitsValidationProgression: false,
      impliesValidatedResult: false,
      impliesStandingsReadiness: false,
      eventIds: Object.freeze(
        sortedEvents
          .map((e) => String(e.eventId || ""))
          .filter(Boolean)
          .sort(compareStableString)
      ),
      eventTypes: Object.freeze(
        sortedEvents
          .map((e) => String(e.eventType || ""))
          .filter(Boolean)
          .sort(compareStableString)
      ),
      blockingReasons: Object.freeze([
        "No match-completed scoring signal available",
      ]),
      warnings: Object.freeze([]),
    },
  });
}
