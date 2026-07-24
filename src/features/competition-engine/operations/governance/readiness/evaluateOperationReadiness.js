/**
 * Operation readiness — aggregates reliability policy for a named operation.
 */

import { evaluateReliabilityPolicy } from "../policy/reliabilityPolicy.js";
import { deepFreeze } from "../fingerprint.js";

/**
 * @param {object} record
 * @param {object} [query]
 */
export function evaluateOperationReadiness(record, query = {}) {
  const operation = String(query.operation || "default");
  const requiredPorts = Array.isArray(query.requiredPorts)
    ? query.requiredPorts
    : undefined;

  // Clone record with operation-specific required flags when provided.
  const overlay = {
    ...record,
    ...(query.requireParticipantLock
      ? {
          participantLock: {
            ...(record.participantLock || {}),
            required: true,
          },
        }
      : {}),
    ...(query.requireScheduleCourt
      ? {
          scheduleCourt: {
            ...(record.scheduleCourt || {}),
            required: true,
          },
        }
      : {}),
    ...(query.requireScoring
      ? {
          scoring: { ...(record.scoring || {}), required: true },
          resultValidation: {
            ...(record.resultValidation || {}),
            required: true,
          },
        }
      : {}),
    ...(query.requireStandings
      ? {
          standings: { ...(record.standings || {}), required: true },
          qualification: {
            ...(record.qualification || {}),
            required: true,
          },
        }
      : {}),
    ...(query.requireFinalResult
      ? {
          finalResult: { ...(record.finalResult || {}), required: true },
        }
      : {}),
    ...(query.requireReplay
      ? { replay: { ...(record.replay || {}), required: true } }
      : {}),
    ...(query.requireRecovery
      ? { recovery: { ...(record.recovery || {}), required: true } }
      : {}),
  };

  const policy = evaluateReliabilityPolicy(overlay, { requiredPorts });

  return deepFreeze({
    operation,
    ready: policy.ready === true,
    blocked: policy.blocked === true,
    degraded: policy.degraded === true,
    healthState: policy.healthState,
    issues: policy.issues,
    blockingIssues: policy.blockingIssues,
    warnings: policy.warnings,
    policyFingerprint: policy.fingerprint,
  });
}
