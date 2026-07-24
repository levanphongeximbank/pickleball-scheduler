/**
 * E2E-07 certification readiness projection (contract only — not certification itself).
 */

import { E2E06_CAPABILITY, RUNTIME_HEALTH_STATE } from "../constants.js";
import { computeGovernanceFingerprint, deepFreeze } from "../fingerprint.js";

/**
 * @param {object} record
 * @param {object} policyResult
 * @param {object} [extras]
 */
export function buildCertificationReadinessProjection(
  record,
  policyResult = {},
  extras = {}
) {
  const healthState = policyResult.healthState || RUNTIME_HEALTH_STATE.BLOCKED;
  const blocking = Array.isArray(policyResult.blockingIssues)
    ? policyResult.blockingIssues
    : [];

  const checklist = Object.freeze([
    Object.freeze({
      id: E2E06_CAPABILITY.GOV_02,
      name: "Audit & Event Log",
      ready: record?.audit?.evidencePresent === true,
    }),
    Object.freeze({
      id: E2E06_CAPABILITY.GOV_03,
      name: "Deterministic Seed & Replay",
      ready: Boolean(record?.replay?.seed),
    }),
    Object.freeze({
      id: E2E06_CAPABILITY.GOV_05,
      name: "Import / Export Governance",
      ready: record?.importExport?.ready === true,
    }),
    Object.freeze({
      id: E2E06_CAPABILITY.GOV_06,
      name: "Recovery & Resume",
      ready: record?.recovery?.checkpointPresent === true,
    }),
    Object.freeze({
      id: E2E06_CAPABILITY.GOV_09,
      name: "Security & Permission Enforcement",
      ready: extras.permissionEnforced === true,
    }),
    Object.freeze({
      id: E2E06_CAPABILITY.GOV_10,
      name: "Tenant / Venue Isolation",
      ready: Boolean(record?.tenantId) && Boolean(record?.competitionId),
    }),
  ]);

  const allReady =
    checklist.every((c) => c.ready === true) && blocking.length === 0;
  const certificationReady =
    allReady &&
    (healthState === RUNTIME_HEALTH_STATE.READY ||
      healthState === RUNTIME_HEALTH_STATE.COMPLETED ||
      healthState === RUNTIME_HEALTH_STATE.ARCHIVE_READY ||
      healthState === RUNTIME_HEALTH_STATE.ARCHIVED);

  const fingerprint = computeGovernanceFingerprint(
    {
      healthState,
      checklist: checklist.map((c) => ({ id: c.id, ready: c.ready })),
      certificationReady,
    },
    "e2e06-cert"
  );

  return deepFreeze({
    e2e07Ready: certificationReady,
    productionReadyClaimForbidden: true,
    healthState,
    checklist,
    openBlockers: blocking.map((i) =>
      Object.freeze({ code: i.code, message: i.message })
    ),
    deferredToE2E07: Object.freeze([
      "GOV-08 Benchmark & Diagnostics",
      "Full vertical certification pack",
      "Staging/Production remote evidence",
    ]),
    deferredCapabilities: Object.freeze([
      Object.freeze({
        id: "OPS-11",
        status: "DEFERRED",
        note: "Incident handling workflow post-MVP",
      }),
      Object.freeze({
        id: "OPS-12",
        status: "PARTIAL",
        note: "Dispute-reset only for MVP; formal protest deferred",
      }),
      Object.freeze({
        id: "GOV-08",
        status: "DEFERRED",
        note: "Owned by E2E-07 certification",
      }),
    ]),
    fingerprint,
  });
}
