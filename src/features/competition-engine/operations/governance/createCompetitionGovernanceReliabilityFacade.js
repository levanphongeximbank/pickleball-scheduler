/**
 * E2E-06 Competition Governance & Reliability application facade.
 *
 * Fail-closed, deterministic, no Supabase, no parallel engines,
 * no direct archive/lifecycle/match mutation.
 */

import { createCompetitionRuntimePorts } from "../../integration/composition/createCompetitionRuntimePorts.js";
import {
  E2E06_GOVERNANCE_PHASE,
  E2E06_GOVERNANCE_VERSION,
  GOVERNANCE_ACTION,
  GOVERNANCE_ERROR_CODE,
  GOVERNANCE_QUERY,
} from "./constants.js";
import {
  failGovernance,
  isGovernanceReliabilityError,
  normalizeGovernanceError,
} from "./errors.js";
import {
  computeGovernanceFingerprint,
  deepFreeze,
  snapshotInput,
} from "./fingerprint.js";
import { authorizeGovernanceCommand } from "./context/authorizeGovernanceCommand.js";
import { buildGovernanceStateProjection } from "./projections/buildGovernanceStateProjection.js";
import { buildIncidentProjection } from "./projections/buildIncidentProjection.js";
import { buildCertificationReadinessProjection } from "./projections/buildCertificationReadinessProjection.js";
import { buildDegradedModeProjection } from "./policy/degradedModePolicy.js";
import { evaluateReliabilityPolicy } from "./policy/reliabilityPolicy.js";
import { buildReliabilityEvidenceManifest } from "./evidence/buildReliabilityEvidenceManifest.js";
import { evaluateOperationReadiness } from "./readiness/evaluateOperationReadiness.js";
import { evaluateReplayReadiness } from "./adapters/handoffCore21Replay.js";
import {
  evaluateExportReadiness,
  evaluateImportReadiness,
} from "./adapters/handoffCore22ImportExport.js";
import { evaluateRecoveryReadiness } from "./adapters/handoffCore23Recovery.js";
import {
  evaluateArchiveGovernanceReadiness,
  evaluateCompletionReadiness,
  evaluatePublicationGovernanceReadiness,
} from "./adapters/handoffCmLifecycleArchive.js";

/**
 * @param {unknown} value
 * @returns {Record<string, unknown>}
 */
function asObject(value) {
  return value && typeof value === "object"
    ? /** @type {Record<string, unknown>} */ (value)
    : {};
}

/**
 * @param {object} deps
 */
export function createCompetitionGovernanceReliabilityFacade(deps = {}) {
  const runtimePorts =
    deps.runtimePorts ||
    createCompetitionRuntimePorts(deps.runtimePortDeps || {});

  /**
   * @param {object} query
   */
  function loadRecord(query) {
    const tenantId = String(query.tenantId || "").trim();
    const competitionId = String(query.competitionId || "").trim();
    if (!tenantId) {
      failGovernance(
        GOVERNANCE_ERROR_CODE.MISSING_TENANT,
        "tenantId is required",
        {}
      );
    }
    if (!competitionId) {
      failGovernance(
        GOVERNANCE_ERROR_CODE.MISSING_COMPETITION,
        "competitionId is required",
        {}
      );
    }

    const record = query.governanceRecord || query.record || deps.governanceRecord;
    if (!record || typeof record !== "object") {
      failGovernance(
        GOVERNANCE_ERROR_CODE.RECORD_NOT_FOUND,
        "governanceRecord is required",
        { tenantId, competitionId }
      );
    }

    const recTenant = String(record.tenantId || "").trim();
    const recCompetition = String(record.competitionId || "").trim();
    if (recTenant && recTenant !== tenantId) {
      failGovernance(
        GOVERNANCE_ERROR_CODE.CROSS_TENANT_REJECTED,
        "governanceRecord tenant mismatch",
        { tenantId, recordTenantId: recTenant }
      );
    }
    if (recCompetition && recCompetition !== competitionId) {
      failGovernance(
        GOVERNANCE_ERROR_CODE.CROSS_TENANT_REJECTED,
        "governanceRecord competition mismatch",
        { competitionId, recordCompetitionId: recCompetition }
      );
    }

    return deepFreeze({
      ...asObject(record),
      tenantId,
      competitionId,
    });
  }

  /**
   * @param {string} queryKind
   * @param {object} query
   * @param {object} authz
   * @param {object} result
   */
  function okResult(queryKind, query, authz, result) {
    const fingerprint = computeGovernanceFingerprint(
      {
        queryKind,
        tenantId: query.tenantId,
        competitionId: query.competitionId,
        capability: authz.capability,
        result,
      },
      "e2e06-query"
    );
    return deepFreeze({
      ok: true,
      phase: E2E06_GOVERNANCE_PHASE,
      version: E2E06_GOVERNANCE_VERSION,
      queryKind,
      capability: authz.capability,
      fingerprint,
      result,
    });
  }

  /**
   * @param {object} query
   * @param {string} action
   */
  async function authorize(query, action) {
    return authorizeGovernanceCommand({
      action,
      actor: query.actor,
      tenantId: query.tenantId,
      competitionId: query.competitionId,
      venueId: query.venueId,
      runtimePorts,
      context: query.context,
    });
  }

  /**
   * @param {Function} fn
   * @param {object} query
   * @param {string} action
   * @param {string} queryKind
   */
  async function runAuthorized(fn, query, action, queryKind) {
    const inputSnap = snapshotInput(query);
    void inputSnap;
    try {
      const authz = await authorize(query, action);
      const record = loadRecord(query);
      const result = fn(record, query, authz);
      return okResult(queryKind, query, authz, result);
    } catch (err) {
      if (isGovernanceReliabilityError(err)) throw err;
      throw normalizeGovernanceError(err);
    }
  }

  async function getGovernanceState(query = {}) {
    return runAuthorized(
      (record, _q, authz) => buildGovernanceStateProjection(record, authz),
      query,
      GOVERNANCE_ACTION.GOVERNANCE_READ,
      GOVERNANCE_QUERY.GOVERNANCE_STATE
    );
  }

  async function evaluateOperationReadinessQuery(query = {}) {
    return runAuthorized(
      (record, q) => evaluateOperationReadiness(record, q),
      query,
      GOVERNANCE_ACTION.RELIABILITY_EVALUATE,
      GOVERNANCE_QUERY.OPERATION_READINESS
    );
  }

  async function evaluatePublicationReadiness(query = {}) {
    return runAuthorized(
      (record, q) => evaluatePublicationGovernanceReadiness(record, q),
      query,
      GOVERNANCE_ACTION.RELIABILITY_EVALUATE,
      GOVERNANCE_QUERY.PUBLICATION_READINESS
    );
  }

  async function evaluateCompletionReadinessQuery(query = {}) {
    return runAuthorized(
      (record) => evaluateCompletionReadiness(record),
      query,
      GOVERNANCE_ACTION.RELIABILITY_EVALUATE,
      GOVERNANCE_QUERY.COMPLETION_READINESS
    );
  }

  async function evaluateArchiveReadiness(query = {}) {
    return runAuthorized(
      (record) => evaluateArchiveGovernanceReadiness(record),
      query,
      GOVERNANCE_ACTION.ARCHIVE_EVALUATE,
      GOVERNANCE_QUERY.ARCHIVE_READINESS
    );
  }

  async function evaluateRecoveryReadinessQuery(query = {}) {
    return runAuthorized(
      (record, q, authz) => evaluateRecoveryReadiness(record, q, authz),
      query,
      GOVERNANCE_ACTION.RECOVERY_EVALUATE,
      GOVERNANCE_QUERY.RECOVERY_READINESS
    );
  }

  async function evaluateReplayReadinessQuery(query = {}) {
    return runAuthorized(
      (record, q) => evaluateReplayReadiness(record, q),
      query,
      GOVERNANCE_ACTION.REPLAY_EVALUATE,
      GOVERNANCE_QUERY.REPLAY_READINESS
    );
  }

  async function evaluateImportReadinessQuery(query = {}) {
    return runAuthorized(
      (record, q) => evaluateImportReadiness(record, q),
      query,
      GOVERNANCE_ACTION.IMPORT_EVALUATE,
      GOVERNANCE_QUERY.IMPORT_READINESS
    );
  }

  async function evaluateExportReadinessQuery(query = {}) {
    return runAuthorized(
      (record, q) => evaluateExportReadiness(record, q),
      query,
      GOVERNANCE_ACTION.EXPORT_EVALUATE,
      GOVERNANCE_QUERY.EXPORT_READINESS
    );
  }

  async function buildReliabilityEvidence(query = {}) {
    return runAuthorized(
      (record, q, authz) => {
        const policy = evaluateReliabilityPolicy(record);
        return buildReliabilityEvidenceManifest({
          record,
          action: q.operation || GOVERNANCE_ACTION.EVIDENCE_BUILD,
          actor: q.actor,
          authz,
          decision: {
            allowed: true,
            healthState: policy.healthState,
            ready: policy.ready,
          },
          issues: policy.issues,
          occurredAt: q.occurredAt || "2026-07-24T00:00:00.000Z",
          sequence: Number.isFinite(q.sequence) ? q.sequence : 1,
        });
      },
      query,
      GOVERNANCE_ACTION.EVIDENCE_BUILD,
      GOVERNANCE_QUERY.RELIABILITY_EVIDENCE
    );
  }

  async function createIncidentProjection(query = {}) {
    return runAuthorized(
      (record) => {
        const policy = evaluateReliabilityPolicy(record);
        return buildIncidentProjection(record, policy);
      },
      query,
      GOVERNANCE_ACTION.GOVERNANCE_READ,
      GOVERNANCE_QUERY.INCIDENT_PROJECTION
    );
  }

  async function createDegradedModeProjection(query = {}) {
    return runAuthorized(
      (record) => {
        const policy = evaluateReliabilityPolicy(record);
        return buildDegradedModeProjection(record, policy);
      },
      query,
      GOVERNANCE_ACTION.RELIABILITY_EVALUATE,
      GOVERNANCE_QUERY.DEGRADED_MODE
    );
  }

  async function createCertificationReadinessProjection(query = {}) {
    return runAuthorized(
      (record, _q, authz) => {
        const policy = evaluateReliabilityPolicy(record);
        return buildCertificationReadinessProjection(record, policy, {
          permissionEnforced: authz.allowed === true,
        });
      },
      query,
      GOVERNANCE_ACTION.CERTIFICATION_READ,
      GOVERNANCE_QUERY.CERTIFICATION_READINESS
    );
  }

  return Object.freeze({
    kind: "competition-governance-reliability-facade",
    phase: E2E06_GOVERNANCE_PHASE,
    version: E2E06_GOVERNANCE_VERSION,
    wiredToProductionRuntime: false,
    ownsEngines: false,
    getGovernanceState,
    evaluateOperationReadiness: evaluateOperationReadinessQuery,
    evaluatePublicationReadiness,
    evaluateCompletionReadiness: evaluateCompletionReadinessQuery,
    evaluateArchiveReadiness,
    evaluateRecoveryReadiness: evaluateRecoveryReadinessQuery,
    evaluateReplayReadiness: evaluateReplayReadinessQuery,
    evaluateImportReadiness: evaluateImportReadinessQuery,
    evaluateExportReadiness: evaluateExportReadinessQuery,
    buildReliabilityEvidence,
    createIncidentProjection,
    createDegradedModeProjection,
    createCertificationReadinessProjection,
  });
}

/**
 * Convenience query helper.
 * @param {object} query
 * @param {object} [deps]
 */
export async function getCompetitionGovernanceState(query, deps) {
  const facade = createCompetitionGovernanceReliabilityFacade(deps || {});
  return facade.getGovernanceState(query);
}
