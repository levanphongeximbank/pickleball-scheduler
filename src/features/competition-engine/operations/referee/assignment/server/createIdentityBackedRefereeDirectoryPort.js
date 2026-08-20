/**
 * RefereeDirectoryPort backed by Canonical Competition Identity Contract #01.
 *
 * Contract #08 Adapter B must not own referee identity.
 * This port translates Contract #01 / Identity Adapter B
 * resolveSubjectIdentity evidence into CORE-13 createRefereeCandidate(...).
 *
 * Browser-supplied role / active / status / tenantId are not authority.
 * Tenant is not venue. Missing tenant or missing status fail closed.
 * Competition must not read public.profiles or import Identity persistence.
 */

import { isRefereeRole } from "../../../../../identity/constants/roles.js";
import {
  createRefereeCandidate,
} from "../../../../../competition-core/referee-assignment/index.js";
import {
  createMissingSnapshotResult,
  createPopulatedSnapshotResult,
} from "../../../../../competition-core/referee-assignment/ports/portResult.js";
import { IDENTITY_ACCESS_CONTRACT } from "../../../../integration/contracts/definitions.js";
import { SHARED_ADAPTER_ERROR_CODE } from "../../../../integration/contracts/kernel/constants.js";
import { isCompetitionAdapterContractError } from "../../../../integration/contracts/kernel/errors.js";
import { EVIDENCE_STATUS } from "../../../../integration/contracts/kernel/evidence.js";
import { ASSIGNMENT_COMMAND_ERROR_CODE } from "../constants.js";
import { failAssignmentCommand } from "../errors.js";
import { isUuid } from "./loadCanonicalCompetitionModeState.js";

export const CONTRACT_01_ID = IDENTITY_ACCESS_CONTRACT.contractId;

export const CONTRACT_01_CURRENT_METHODS = Object.freeze([
  ...IDENTITY_ACCESS_CONTRACT.requiredMethods,
]);

export const IDENTITY_DIRECTORY_CAPABILITY = Object.freeze({
  RESOLVE_SUBJECT_IDENTITY: "CONTRACT_01_RESOLVE_SUBJECT_IDENTITY",
  SUBJECT_IDENTITY: "CONTRACT_01_RESOLVE_SUBJECT_IDENTITY",
  MISSING_BINDING: "CONTRACT_01_RESOLVE_SUBJECT_IDENTITY_MISSING",
});

function readEvidenceData(evidence) {
  if (!evidence || typeof evidence !== "object") return {};
  if (evidence.data && typeof evidence.data === "object") return evidence.data;
  return evidence;
}

function mapIdentityAdapterError(err) {
  if (!isCompetitionAdapterContractError(err)) throw err;
  const code = err.code;
  if (code === SHARED_ADAPTER_ERROR_CODE.CROSS_TENANT_CONTEXT) {
    failAssignmentCommand(
      ASSIGNMENT_COMMAND_ERROR_CODE.FOREIGN_REFEREE_DENIED,
      err.message || "Referee identity is not bound to the authenticated tenant",
      err.details || {}
    );
  }
  if (code === SHARED_ADAPTER_ERROR_CODE.DISPLAY_NAME_IS_NOT_IDENTITY) {
    failAssignmentCommand(
      ASSIGNMENT_COMMAND_ERROR_CODE.DISPLAY_NAME_IDENTITY_DENIED,
      err.message || "Display name is never canonical referee identity",
      err.details || {}
    );
  }
  if (code === SHARED_ADAPTER_ERROR_CODE.FUZZY_IDENTITY_FORBIDDEN) {
    failAssignmentCommand(
      ASSIGNMENT_COMMAND_ERROR_CODE.EMAIL_AS_AUTHORITY_DENIED,
      err.message || "Email/phone is never canonical referee identity",
      err.details || {}
    );
  }
  failAssignmentCommand(
    ASSIGNMENT_COMMAND_ERROR_CODE.CANONICAL_REFEREE_EVIDENCE_REQUIRED,
    err.message || "Canonical referee Identity evidence is required",
    err.details || {}
  );
}

function denyUnknownSubject(refereeId, details = {}) {
  failAssignmentCommand(
    ASSIGNMENT_COMMAND_ERROR_CODE.CANONICAL_REFEREE_EVIDENCE_REQUIRED,
    "Canonical referee subject was not found",
    { refereeId, ...details }
  );
}

/**
 * @param {{
 *   identityAccessAdapter?: object,
 * }} [options]
 */
export function createIdentityBackedRefereeDirectoryPort(options = {}) {
  const identityAccessAdapter = options.identityAccessAdapter || null;
  const hasResolveSubject =
    Boolean(identityAccessAdapter) &&
    typeof identityAccessAdapter.resolveSubjectIdentity === "function";
  const source = hasResolveSubject
    ? IDENTITY_DIRECTORY_CAPABILITY.RESOLVE_SUBJECT_IDENTITY
    : IDENTITY_DIRECTORY_CAPABILITY.MISSING_BINDING;

  return Object.freeze({
    source,
    contractId: CONTRACT_01_ID,
    synthesizesQualification: false,
    synthesizesAvailability: false,
    queriesIdentityPrivatePersistence: false,
    subjectDirectoryMethod: hasResolveSubject ? "resolveSubjectIdentity" : null,
    async resolveRefereeDirectory(request = {}) {
      const refereeId = String(request.refereeId || "").trim();
      const tenantId = String(request.tenantId || "").trim();
      const actorId = String(request.actorId || "").trim();
      if (!refereeId) {
        return createMissingSnapshotResult(
          "No refereeId supplied for Identity directory lookup",
          { contractId: CONTRACT_01_ID }
        );
      }
      if (!isUuid(refereeId)) {
        failAssignmentCommand(
          ASSIGNMENT_COMMAND_ERROR_CODE.CANONICAL_REFEREE_EVIDENCE_REQUIRED,
          "Canonical referee identity must be a UUID with Identity-domain evidence",
          { refereeId }
        );
      }

      if (!hasResolveSubject) {
        failAssignmentCommand(
          ASSIGNMENT_COMMAND_ERROR_CODE.NOT_CONFIGURED,
          "Contract #01 resolveSubjectIdentity binding is required",
          {
            contractId: CONTRACT_01_ID,
            missingCapability: "resolveSubjectIdentity",
            currentContractCapabilities: CONTRACT_01_CURRENT_METHODS,
          }
        );
      }

      let evidence;
      try {
        evidence = await identityAccessAdapter.resolveSubjectIdentity({
          tenantId,
          actorId: actorId || request.actorId,
          subjectId: refereeId,
          correlationId: request.correlationId || `core13-identity-${refereeId}`,
          contractVersion: IDENTITY_ACCESS_CONTRACT.contractVersion,
        });
      } catch (err) {
        mapIdentityAdapterError(err);
      }

      if (!evidence || evidence.status === EVIDENCE_STATUS.NOT_FOUND) {
        denyUnknownSubject(refereeId, {
          status: evidence?.status || null,
          reasonCodes: evidence?.reasonCodes || [],
        });
      }
      if (evidence.status !== EVIDENCE_STATUS.OK) {
        failAssignmentCommand(
          ASSIGNMENT_COMMAND_ERROR_CODE.CANONICAL_REFEREE_EVIDENCE_REQUIRED,
          "Canonical Identity subject evidence is not OK",
          { refereeId, status: evidence.status || null }
        );
      }

      const data = readEvidenceData(evidence);
      const subjectId = String(
        data.canonicalSubjectId || data.subjectId || ""
      ).trim();
      if (!subjectId || subjectId !== refereeId) {
        failAssignmentCommand(
          ASSIGNMENT_COMMAND_ERROR_CODE.CANONICAL_REFEREE_EVIDENCE_REQUIRED,
          "Canonical Identity subject evidence did not match refereeId",
          { refereeId, subjectId: subjectId || null }
        );
      }

      const evidenceTenant = String(data.tenantId || "").trim();
      const evidenceVenue = String(data.venueId || "").trim();
      if (evidenceVenue && evidenceVenue === tenantId && evidenceTenant !== tenantId) {
        failAssignmentCommand(
          ASSIGNMENT_COMMAND_ERROR_CODE.CANONICAL_REFEREE_EVIDENCE_REQUIRED,
          "venueId is not tenant proof",
          { refereeId, venueId: evidenceVenue, tenantId }
        );
      }
      if (!evidenceTenant) {
        failAssignmentCommand(
          ASSIGNMENT_COMMAND_ERROR_CODE.CANONICAL_REFEREE_EVIDENCE_REQUIRED,
          "Authoritative tenant evidence is required",
          { refereeId, venueId: evidenceVenue || null }
        );
      }
      if (evidenceTenant !== tenantId) {
        failAssignmentCommand(
          ASSIGNMENT_COMMAND_ERROR_CODE.FOREIGN_REFEREE_DENIED,
          "Referee identity is not bound to the authenticated tenant",
          { refereeId, evidenceTenant, tenantId }
        );
      }

      if (!isRefereeRole(data.role)) {
        failAssignmentCommand(
          ASSIGNMENT_COMMAND_ERROR_CODE.CANONICAL_REFEREE_EVIDENCE_REQUIRED,
          "Canonical Referee identity/source evidence is required (Identity role)",
          { refereeId, role: data.role || null }
        );
      }

      const status = String(data.status || "").trim().toLowerCase();
      if (!status) {
        failAssignmentCommand(
          ASSIGNMENT_COMMAND_ERROR_CODE.CANONICAL_REFEREE_EVIDENCE_REQUIRED,
          "Identity subject status is required",
          { refereeId }
        );
      }
      const active = status === "active" && data.active !== false;

      return createPopulatedSnapshotResult([
        createRefereeCandidate({
          refereeId,
          active,
          userId: refereeId,
        }),
      ]);
    },
  });
}
