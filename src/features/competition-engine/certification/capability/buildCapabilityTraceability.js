/**
 * E2E-00 capability register traceability for E2E-07 certification.
 */

import { CERTIFICATION_CHECK } from "../constants.js";
import { computeCertificationFingerprint, deepFreeze } from "../fingerprint.js";

export const CAPABILITY_TRACEABILITY_STATUS = Object.freeze({
  CERTIFIED: "CERTIFIED",
  CERTIFIED_WITH_CONDITION: "CERTIFIED_WITH_CONDITION",
  DEFERRED_REMOTE: "DEFERRED_REMOTE",
  OUT_OF_SCOPE: "OUT_OF_SCOPE",
  BLOCKED: "BLOCKED",
});

/** @type {Readonly<Record<string, { status: string, note?: string }>>} */
const CAPABILITY_MAP = Object.freeze({
  "OPS-01": { status: CAPABILITY_TRACEABILITY_STATUS.CERTIFIED },
  "OPS-02": { status: CAPABILITY_TRACEABILITY_STATUS.OUT_OF_SCOPE, note: "Team wave" },
  "OPS-03": { status: CAPABILITY_TRACEABILITY_STATUS.CERTIFIED },
  "OPS-04": { status: CAPABILITY_TRACEABILITY_STATUS.CERTIFIED },
  "OPS-05": { status: CAPABILITY_TRACEABILITY_STATUS.CERTIFIED },
  "OPS-06": {
    status: CAPABILITY_TRACEABILITY_STATUS.CERTIFIED_WITH_CONDITION,
    note: "Call Room deferred post-MVP",
  },
  "OPS-07": { status: CAPABILITY_TRACEABILITY_STATUS.OUT_OF_SCOPE, note: "Team lineup" },
  "OPS-08": { status: CAPABILITY_TRACEABILITY_STATUS.CERTIFIED },
  "OPS-09": { status: CAPABILITY_TRACEABILITY_STATUS.CERTIFIED },
  "OPS-10": { status: CAPABILITY_TRACEABILITY_STATUS.CERTIFIED },
  "OPS-11": { status: CAPABILITY_TRACEABILITY_STATUS.OUT_OF_SCOPE, note: "Incident workflow deferred" },
  "OPS-12": {
    status: CAPABILITY_TRACEABILITY_STATUS.CERTIFIED_WITH_CONDITION,
    note: "Dispute-reset only; formal protest deferred",
  },
  "OPS-13": { status: CAPABILITY_TRACEABILITY_STATUS.CERTIFIED },

  "EXP-01": { status: CAPABILITY_TRACEABILITY_STATUS.CERTIFIED },
  "EXP-02": { status: CAPABILITY_TRACEABILITY_STATUS.CERTIFIED },
  "EXP-03": { status: CAPABILITY_TRACEABILITY_STATUS.CERTIFIED },
  "EXP-04": {
    status: CAPABILITY_TRACEABILITY_STATUS.CERTIFIED_WITH_CONDITION,
    note: "Folded into schedule+live for IND MVP",
  },
  "EXP-05": { status: CAPABILITY_TRACEABILITY_STATUS.CERTIFIED },
  "EXP-06": { status: CAPABILITY_TRACEABILITY_STATUS.CERTIFIED },
  "EXP-07": { status: CAPABILITY_TRACEABILITY_STATUS.OUT_OF_SCOPE },
  "EXP-08": { status: CAPABILITY_TRACEABILITY_STATUS.OUT_OF_SCOPE },
  "EXP-09": { status: CAPABILITY_TRACEABILITY_STATUS.OUT_OF_SCOPE },

  "TPL-01": { status: CAPABILITY_TRACEABILITY_STATUS.OUT_OF_SCOPE },
  "TPL-02": { status: CAPABILITY_TRACEABILITY_STATUS.OUT_OF_SCOPE },
  "TPL-03": { status: CAPABILITY_TRACEABILITY_STATUS.CERTIFIED },
  "TPL-04": { status: CAPABILITY_TRACEABILITY_STATUS.OUT_OF_SCOPE },
  "TPL-05": { status: CAPABILITY_TRACEABILITY_STATUS.OUT_OF_SCOPE },
  "TPL-06": { status: CAPABILITY_TRACEABILITY_STATUS.OUT_OF_SCOPE },
  "TPL-07": { status: CAPABILITY_TRACEABILITY_STATUS.OUT_OF_SCOPE },
  "TPL-08": { status: CAPABILITY_TRACEABILITY_STATUS.OUT_OF_SCOPE },

  "FMT-01": { status: CAPABILITY_TRACEABILITY_STATUS.OUT_OF_SCOPE },
  "FMT-02": { status: CAPABILITY_TRACEABILITY_STATUS.OUT_OF_SCOPE },
  "FMT-03": { status: CAPABILITY_TRACEABILITY_STATUS.CERTIFIED },
  "FMT-04": { status: CAPABILITY_TRACEABILITY_STATUS.OUT_OF_SCOPE },
  "FMT-05": { status: CAPABILITY_TRACEABILITY_STATUS.OUT_OF_SCOPE },
  "FMT-06": {
    status: CAPABILITY_TRACEABILITY_STATUS.CERTIFIED,
    note: "GROUP_RR + SINGLE_ELIM composition for IND Pool+KO",
  },

  "INT-01": {
    status: CAPABILITY_TRACEABILITY_STATUS.DEFERRED_REMOTE,
    note: "Local adapter certified; production Identity wiring deferred",
  },
  "INT-02": {
    status: CAPABILITY_TRACEABILITY_STATUS.DEFERRED_REMOTE,
    note: "Local adapter certified; production venue wiring deferred",
  },
  "INT-03": { status: CAPABILITY_TRACEABILITY_STATUS.CERTIFIED },
  "INT-04": { status: CAPABILITY_TRACEABILITY_STATUS.CERTIFIED },
  "INT-05": {
    status: CAPABILITY_TRACEABILITY_STATUS.DEFERRED_REMOTE,
    note: "Rating snapshot local; production SoT wiring deferred",
  },
  "INT-06": { status: CAPABILITY_TRACEABILITY_STATUS.CERTIFIED },
  "INT-07": { status: CAPABILITY_TRACEABILITY_STATUS.CERTIFIED },
  "INT-08": { status: CAPABILITY_TRACEABILITY_STATUS.OUT_OF_SCOPE },
  "INT-09": {
    status: CAPABILITY_TRACEABILITY_STATUS.DEFERRED_REMOTE,
    note: "Notification events local; delivery infra deferred",
  },
  "INT-10": { status: CAPABILITY_TRACEABILITY_STATUS.OUT_OF_SCOPE },
  "INT-11": { status: CAPABILITY_TRACEABILITY_STATUS.OUT_OF_SCOPE },
  "INT-12": { status: CAPABILITY_TRACEABILITY_STATUS.OUT_OF_SCOPE },

  "GOV-01": { status: CAPABILITY_TRACEABILITY_STATUS.CERTIFIED },
  "GOV-02": { status: CAPABILITY_TRACEABILITY_STATUS.CERTIFIED },
  "GOV-03": { status: CAPABILITY_TRACEABILITY_STATUS.CERTIFIED },
  "GOV-04": { status: CAPABILITY_TRACEABILITY_STATUS.CERTIFIED },
  "GOV-05": { status: CAPABILITY_TRACEABILITY_STATUS.CERTIFIED },
  "GOV-06": { status: CAPABILITY_TRACEABILITY_STATUS.CERTIFIED },
  "GOV-07": { status: CAPABILITY_TRACEABILITY_STATUS.CERTIFIED_WITH_CONDITION, note: "Shadow diagnostics only" },
  "GOV-08": { status: CAPABILITY_TRACEABILITY_STATUS.CERTIFIED, note: "MVP local benchmark gate" },
  "GOV-09": { status: CAPABILITY_TRACEABILITY_STATUS.CERTIFIED },
  "GOV-10": { status: CAPABILITY_TRACEABILITY_STATUS.CERTIFIED },
  "GOV-11": { status: CAPABILITY_TRACEABILITY_STATUS.CERTIFIED_WITH_CONDITION, note: "Cutover plan documented" },
});

/**
 * @param {object} [input]
 */
export function buildCapabilityTraceability(input = {}) {
  const gov08Certified = input.gov08Passed === true;
  const rows = Object.entries(CAPABILITY_MAP).map(([code, meta]) => {
    let status = meta.status;
    if (code === "GOV-08" && !gov08Certified) {
      status = CAPABILITY_TRACEABILITY_STATUS.BLOCKED;
    }
    return Object.freeze({
      code,
      status,
      note: meta.note ?? null,
    });
  });

  const blocked = rows.filter((r) => r.status === CAPABILITY_TRACEABILITY_STATUS.BLOCKED);
  const ok = blocked.length === 0;

  const traceability = deepFreeze({
    registerVersion: "e2e-00-capability-register",
    rows: Object.freeze(rows),
    summary: Object.freeze({
      certified: rows.filter((r) => r.status === CAPABILITY_TRACEABILITY_STATUS.CERTIFIED).length,
      certifiedWithCondition: rows.filter(
        (r) => r.status === CAPABILITY_TRACEABILITY_STATUS.CERTIFIED_WITH_CONDITION
      ).length,
      deferredRemote: rows.filter((r) => r.status === CAPABILITY_TRACEABILITY_STATUS.DEFERRED_REMOTE)
        .length,
      outOfScope: rows.filter((r) => r.status === CAPABILITY_TRACEABILITY_STATUS.OUT_OF_SCOPE).length,
      blocked: blocked.length,
      total: rows.length,
    }),
    fingerprint: computeCertificationFingerprint(
      rows.map((r) => ({ code: r.code, status: r.status })),
      "e2e07-cap"
    ),
  });

  return deepFreeze({
    ok,
    checkId: CERTIFICATION_CHECK.CAPABILITY_TRACEABILITY,
    traceability,
    checks: Object.freeze([
      Object.freeze({
        id: CERTIFICATION_CHECK.CAPABILITY_TRACEABILITY,
        ok,
        detail: `${traceability.summary.total} capabilities mapped`,
      }),
    ]),
    deterministicFingerprint: traceability.fingerprint,
  });
}

export { CAPABILITY_MAP };
