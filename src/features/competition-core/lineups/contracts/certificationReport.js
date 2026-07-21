/**
 * CORE-06 Phase 1F — certification report contract.
 *
 * Distinguishes capability / adapter / shadow / writer-cutover / legacy-retirement.
 * CORE-06 capability completion does NOT mean Team Tournament V6 is replaced.
 */

export const LINEUP_CERTIFICATION_VERDICT = Object.freeze({
  CERTIFIED_FOR_ADAPTER_IMPLEMENTATION:
    "CERTIFIED_FOR_ADAPTER_IMPLEMENTATION",
  BLOCKED: "BLOCKED",
});

export const LINEUP_CERT_AXIS = Object.freeze({
  PASS: "PASS",
  FAIL: "FAIL",
  PARTIAL: "PARTIAL",
  PASS_WITH_KNOWN_DIFFERENCES: "PASS_WITH_KNOWN_DIFFERENCES",
  BLOCKED: "BLOCKED",
  BLOCKED_PENDING_RNG_DECISION: "BLOCKED_PENDING_RNG_DECISION",
  NOT_PERFORMED: "NOT_PERFORMED",
});

/**
 * @param {object} [partial]
 */
export function createLineupCertificationReport(partial = {}) {
  const parity = partial.parityScenarios || {};
  const total = Number(parity.total || 0);
  const blocking = Number(parity.blockingDifferences || 0);
  const accepted = Number(parity.acceptedDifferences || 0);

  const axes = {
    adapterBoundary: partial.adapterBoundary || LINEUP_CERT_AXIS.FAIL,
    legacyMapping: partial.legacyMapping || LINEUP_CERT_AXIS.FAIL,
    canonicalMapping: partial.canonicalMapping || LINEUP_CERT_AXIS.FAIL,
    persistenceContract: partial.persistenceContract || LINEUP_CERT_AXIS.FAIL,
    concurrencyReadiness:
      partial.concurrencyReadiness || LINEUP_CERT_AXIS.FAIL,
    idempotencyReadiness:
      partial.idempotencyReadiness || LINEUP_CERT_AXIS.FAIL,
    visibilityReadiness: partial.visibilityReadiness || LINEUP_CERT_AXIS.FAIL,
    deadlineReadiness: partial.deadlineReadiness || LINEUP_CERT_AXIS.FAIL,
    auditReadiness: partial.auditReadiness || LINEUP_CERT_AXIS.FAIL,
  };

  const axisFail = Object.values(axes).some(
    (v) => v === LINEUP_CERT_AXIS.FAIL
  );
  const zeroScenarios = total === 0;
  const catalogInvalid = parity.validation?.ok === false;

  const capabilityReadiness =
    partial.capabilityReadiness ||
    (!axisFail && !zeroScenarios && !catalogInvalid && blocking === 0
      ? LINEUP_CERT_AXIS.PASS
      : LINEUP_CERT_AXIS.FAIL);

  const adapterImplementationReadiness =
    partial.adapterImplementationReadiness ||
    (capabilityReadiness === LINEUP_CERT_AXIS.PASS &&
    axes.adapterBoundary === LINEUP_CERT_AXIS.PASS
      ? LINEUP_CERT_AXIS.PASS
      : LINEUP_CERT_AXIS.FAIL);

  const shadowReadiness =
    partial.shadowReadiness ||
    (blocking > 0 || zeroScenarios || catalogInvalid
      ? LINEUP_CERT_AXIS.FAIL
      : accepted > 0
        ? LINEUP_CERT_AXIS.PASS_WITH_KNOWN_DIFFERENCES
        : LINEUP_CERT_AXIS.PASS);

  // RNG semantic-only difference blocks writer cutover until Owner decision.
  const writerCutoverReadiness =
    partial.writerCutoverReadiness ||
    LINEUP_CERT_AXIS.BLOCKED_PENDING_RNG_DECISION;

  const legacyRetirementReadiness =
    partial.legacyRetirementReadiness || LINEUP_CERT_AXIS.BLOCKED;

  const blocked =
    blocking > 0 ||
    axisFail ||
    zeroScenarios ||
    catalogInvalid ||
    capabilityReadiness === LINEUP_CERT_AXIS.FAIL;

  const finalVerdict = blocked
    ? LINEUP_CERTIFICATION_VERDICT.BLOCKED
    : partial.finalVerdict &&
        Object.values(LINEUP_CERTIFICATION_VERDICT).includes(
          partial.finalVerdict
        )
      ? partial.finalVerdict
      : LINEUP_CERTIFICATION_VERDICT.CERTIFIED_FOR_ADAPTER_IMPLEMENTATION;

  return Object.freeze({
    capability: "CORE-06",
    phase: "1F",
    ...axes,
    capabilityReadiness,
    adapterImplementationReadiness,
    shadowReadiness,
    writerCutoverReadiness,
    legacyRetirementReadiness,
    parityScenarios: Object.freeze({
      total,
      matched: Number(parity.matched || 0),
      acceptedDifferences: accepted,
      blockingDifferences: blocking,
      insufficientData: Number(parity.insufficientData || 0),
      validation: parity.validation
        ? Object.freeze({ ...parity.validation })
        : null,
    }),
    productionWiring: LINEUP_CERT_AXIS.NOT_PERFORMED,
    finalVerdict,
    details: Object.freeze({
      note:
        "CORE-06 capability certification does not mean Team Tournament V6 has been replaced.",
      rngParityClass: "SEMANTIC_ONLY",
      ...(partial.details && typeof partial.details === "object"
        ? partial.details
        : {}),
    }),
  });
}
