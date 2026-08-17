/**
 * RefereeDirectoryPort backed by Canonical Competition Identity Contract #01.
 *
 * Contract #08 Adapter B must not own referee identity.
 * This port may only translate Contract #01 / Identity Adapter B evidence
 * into CORE-13 createRefereeCandidate(...).
 *
 * Contract #01 currently exposes actor-context methods only:
 *   resolveActorIdentity, getAuthorizationEvidence, getCapabilityEvidence
 * Those methods echo caller-supplied actor/role and do not look up an
 * arbitrary referee subject (role / active / tenant). Direct public.profiles
 * reads from Competition trusted-server are therefore forbidden.
 *
 * If Adapter B later grows a subject-directory method (Owner GO on Contract #01),
 * this port consumes it. Until then it fails closed.
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
import { ASSIGNMENT_COMMAND_ERROR_CODE } from "../constants.js";
import { failAssignmentCommand } from "../errors.js";
import { isUuid } from "./loadCanonicalCompetitionModeState.js";

export const CONTRACT_01_ID = IDENTITY_ACCESS_CONTRACT.contractId;

export const CONTRACT_01_CURRENT_METHODS = Object.freeze([
  ...IDENTITY_ACCESS_CONTRACT.requiredMethods,
]);

export const CONTRACT_01_SUBJECT_DIRECTORY_METHODS = Object.freeze([
  "resolveSubjectIdentity",
  "getSubjectIdentityEvidence",
  "lookupSubjectIdentity",
]);

export const IDENTITY_DIRECTORY_CAPABILITY = Object.freeze({
  NOT_CONFIGURED: "CONTRACT_01_SUBJECT_DIRECTORY_NOT_CONFIGURED",
  SUBJECT_IDENTITY: "CONTRACT_01_SUBJECT_IDENTITY",
});

function findSubjectDirectoryMethod(adapter) {
  if (!adapter || typeof adapter !== "object") return null;
  for (const name of CONTRACT_01_SUBJECT_DIRECTORY_METHODS) {
    if (typeof adapter[name] === "function") return name;
  }
  return null;
}

function readEvidenceData(evidence) {
  if (!evidence || typeof evidence !== "object") return {};
  if (evidence.data && typeof evidence.data === "object") return evidence.data;
  return evidence;
}

function isActiveStatus(value) {
  const raw = String(value ?? "active").trim().toLowerCase();
  return raw !== "inactive" && raw !== "disabled" && raw !== "suspended";
}

/**
 * @param {{
 *   identityAccessAdapter?: object,
 * }} [options]
 */
export function createIdentityBackedRefereeDirectoryPort(options = {}) {
  const identityAccessAdapter = options.identityAccessAdapter || null;
  const subjectMethod = findSubjectDirectoryMethod(identityAccessAdapter);
  const source = subjectMethod
    ? IDENTITY_DIRECTORY_CAPABILITY.SUBJECT_IDENTITY
    : IDENTITY_DIRECTORY_CAPABILITY.NOT_CONFIGURED;

  return Object.freeze({
    source,
    contractId: CONTRACT_01_ID,
    synthesizesQualification: false,
    synthesizesAvailability: false,
    queriesIdentityPrivatePersistence: false,
    subjectDirectoryMethod: subjectMethod,
    async resolveRefereeDirectory(request = {}) {
      const refereeId = String(request.refereeId || "").trim();
      const tenantId = String(request.tenantId || "").trim();
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

      if (!subjectMethod) {
        failAssignmentCommand(
          ASSIGNMENT_COMMAND_ERROR_CODE.NOT_CONFIGURED,
          "Contract #01 does not provide subject directory lookup for an arbitrary referee",
          {
            contractId: CONTRACT_01_ID,
            missingCapability: "resolveSubjectIdentityDirectory",
            currentContractCapabilities: CONTRACT_01_CURRENT_METHODS,
            whyRequired:
              "CORE-13 needs canonical subject id, Identity role, active/inactive, and tenant/scope for the assigned referee — not the authenticated actor",
            whyDirectProfilesReadIsNotAcceptable:
              "Competition must not query Identity private persistence; evidence must enter through Contract #01 / Identity Adapter B",
            ownerGoRequired: true,
            sharedContractCapabilityGap: true,
          }
        );
      }

      const evidence = await identityAccessAdapter[subjectMethod]({
        tenantId,
        actorId: refereeId,
        subjectId: refereeId,
        correlationId: request.correlationId || `core13-identity-${refereeId}`,
        contractVersion: IDENTITY_ACCESS_CONTRACT.contractVersion,
      });
      const data = readEvidenceData(evidence);
      const subjectId = String(
        data.subjectId || data.userId || data.actorId || ""
      ).trim();
      if (!subjectId || subjectId !== refereeId) {
        failAssignmentCommand(
          ASSIGNMENT_COMMAND_ERROR_CODE.CANONICAL_REFEREE_EVIDENCE_REQUIRED,
          "Canonical Identity subject evidence did not match refereeId",
          { refereeId, subjectId: subjectId || null }
        );
      }

      const evidenceTenant = String(
        data.tenantId || data.venueId || data.boundTenantId || ""
      ).trim();
      if (evidenceTenant && tenantId && evidenceTenant !== tenantId) {
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

      const active = isActiveStatus(data.status ?? data.active);
      return createPopulatedSnapshotResult([
        createRefereeCandidate({
          refereeId,
          active,
          userId: refereeId,
          displayLabel: data.displayLabel || data.displayName || undefined,
        }),
      ]);
    },
  });
}
