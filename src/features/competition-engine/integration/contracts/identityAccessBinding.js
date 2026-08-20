/**
 * Contract #01 Identity Access Adapter B.
 * Isolated from the remaining workstream bindings so trusted-server CORE-13
 * can consume resolveSubjectIdentity without bundling unrelated adapters.
 */

import { createIdentityEvidenceFromIdentityAdapter } from "../adapters/identityEvidenceFromIdentityAdapter.js";
import {
  resolveSubjectIdentityRecord,
  SUBJECT_IDENTITY_LOOKUP_CODE,
} from "../../../identity/services/subjectIdentityLookupService.js";
import { IntegrationError } from "../errors.js";
import { IDENTITY_ACCESS_CONTRACT } from "./definitions.js";
import { createContractAdapter } from "./kernel/assertContract.js";
import {
  PRODUCTION_BINDING_STATUS,
  SHARED_ADAPTER_ERROR_CODE,
} from "./kernel/constants.js";
import { requireAdapterContext } from "./kernel/context.js";
import { failCompetitionAdapter } from "./kernel/errors.js";
import { freezeEvidence, EVIDENCE_STATUS } from "./kernel/evidence.js";
import { isNonEmptyString } from "./kernel/helpers.js";

function mapIntegrationError(err) {
  if (err && err.name === "CompetitionAdapterContractError") throw err;
  if (err instanceof IntegrationError) {
    const code = err.code || SHARED_ADAPTER_ERROR_CODE.MALFORMED_ADAPTER;
    if (/CROSS_TENANT|TENANT/.test(String(code))) {
      failCompetitionAdapter(
        SHARED_ADAPTER_ERROR_CODE.CROSS_TENANT_CONTEXT,
        err.message,
        err.details || {}
      );
    }
    if (/MISSING_IDENTITY|MISSING_TENANT/.test(String(code))) {
      failCompetitionAdapter(
        SHARED_ADAPTER_ERROR_CODE.MISSING_REQUIRED_CONTEXT,
        err.message,
        err.details || {}
      );
    }
    failCompetitionAdapter(SHARED_ADAPTER_ERROR_CODE.MALFORMED_RESPONSE, err.message, {
      sourceCode: code,
    });
  }
  throw err;
}

function lookupSubjectIdentity(deps, port) {
  if (typeof deps.resolveSubjectIdentity === "function") {
    return (input) => deps.resolveSubjectIdentity(input);
  }
  if (port && typeof port.resolveSubjectIdentity === "function") {
    return (input) => port.resolveSubjectIdentity(input);
  }
  return (input) =>
    resolveSubjectIdentityRecord(input, {
      loadIdentitySubjectById: deps.loadIdentitySubjectById,
    });
}

function mapSubjectLookupFailure(result, ctx) {
  const code = result?.code;
  if (code === SUBJECT_IDENTITY_LOOKUP_CODE.MISSING_SUBJECT_ID) {
    failCompetitionAdapter(
      SHARED_ADAPTER_ERROR_CODE.MISSING_REQUIRED_CONTEXT,
      "subjectId is required",
      { field: "subjectId", correlationId: ctx.correlationId }
    );
  }
  if (code === SUBJECT_IDENTITY_LOOKUP_CODE.FUZZY_IDENTITY_FORBIDDEN) {
    failCompetitionAdapter(
      SHARED_ADAPTER_ERROR_CODE.FUZZY_IDENTITY_FORBIDDEN,
      "Canonical subjectId must not be an email or phone",
      { field: "subjectId" }
    );
  }
  if (code === SUBJECT_IDENTITY_LOOKUP_CODE.DISPLAY_NAME_IS_NOT_IDENTITY) {
    failCompetitionAdapter(
      SHARED_ADAPTER_ERROR_CODE.DISPLAY_NAME_IS_NOT_IDENTITY,
      "Display name is never canonical subject identity",
      { field: "subjectId" }
    );
  }
  if (code === SUBJECT_IDENTITY_LOOKUP_CODE.MALFORMED_SUBJECT_ID) {
    failCompetitionAdapter(
      SHARED_ADAPTER_ERROR_CODE.MISSING_CANONICAL_IDENTITY,
      "subjectId is malformed",
      { field: "subjectId" }
    );
  }
  if (code === SUBJECT_IDENTITY_LOOKUP_CODE.MISSING_SCOPE_EVIDENCE) {
    failCompetitionAdapter(
      SHARED_ADAPTER_ERROR_CODE.MISSING_CANONICAL_IDENTITY,
      "Authoritative tenant evidence is required when tenant proof is requested",
      {
        subjectId: result?.evidence?.subjectId || null,
        requestedTenantId: ctx.tenantId,
        venueId: result?.evidence?.venueId || null,
      }
    );
  }
  if (code === SUBJECT_IDENTITY_LOOKUP_CODE.SCOPE_MISMATCH) {
    failCompetitionAdapter(
      SHARED_ADAPTER_ERROR_CODE.CROSS_TENANT_CONTEXT,
      "Subject does not belong to the requested tenant/scope",
      {
        subjectId: result?.evidence?.subjectId || null,
        requestedTenantId: ctx.tenantId,
      }
    );
  }
  if (code === SUBJECT_IDENTITY_LOOKUP_CODE.INCOMPLETE_IDENTITY) {
    failCompetitionAdapter(
      SHARED_ADAPTER_ERROR_CODE.MISSING_CANONICAL_IDENTITY,
      "Identity subject evidence is incomplete",
      { subjectId: result?.evidence?.subjectId || null }
    );
  }
}

export function createIdentityAccessBinding(deps = {}) {
  const boundTenantId = isNonEmptyString(deps.boundTenantId)
    ? String(deps.boundTenantId).trim()
    : null;
  const port =
    deps.identityEvidencePort || createIdentityEvidenceFromIdentityAdapter(deps);
  const resolveSubject = lookupSubjectIdentity(deps, port);

  return createContractAdapter(IDENTITY_ACCESS_CONTRACT, {
    productionBinding: PRODUCTION_BINDING_STATUS.BOUND,
    handlers: {
      resolveActorIdentity(context) {
        const ctx = requireAdapterContext(context, {
          requiredFields: ["tenantId", "actorId", "correlationId"],
          boundTenantId,
          requireActor: true,
        });
        return freezeEvidence({
          sourceSystem: "identity",
          sourceVersion: "identity-matrix",
          status: EVIDENCE_STATUS.OK,
          data: {
            actorId: ctx.actorId,
            tenantId: ctx.tenantId,
            role: ctx.role,
          },
          reasonCodes: [],
          retrievedAt: ctx.effectiveAt,
        });
      },
      async getAuthorizationEvidence(context) {
        const ctx = requireAdapterContext(context, {
          requiredFields: ["tenantId", "actorId", "correlationId"],
          boundTenantId,
          requireActor: true,
        });
        try {
          const evidence = await port.getEvidence({
            subject: { actorId: ctx.actorId, role: context.role },
            scope: {
              tenantId: ctx.tenantId,
              venueId: ctx.venueId,
              clubId: ctx.clubId,
              competitionId: ctx.competitionId,
            },
          });
          if (!evidence) {
            failCompetitionAdapter(
              SHARED_ADAPTER_ERROR_CODE.MISSING_CANONICAL_IDENTITY,
              "Authorization evidence is unavailable for this actor",
              { actorId: ctx.actorId }
            );
          }
          return freezeEvidence({
            sourceSystem: "identity",
            sourceVersion: evidence.evidenceVersion || "e2e-01-identity-evidence-v1",
            snapshotId: evidence.evidenceId || null,
            status: EVIDENCE_STATUS.OK,
            data: evidence,
            reasonCodes: [],
          });
        } catch (err) {
          mapIntegrationError(err);
        }
      },
      async getCapabilityEvidence(context) {
        const ctx = requireAdapterContext(context, {
          requiredFields: ["tenantId", "actorId", "correlationId"],
          boundTenantId,
          requireActor: true,
        });
        try {
          const evidence = await port.getEvidence({
            subject: { actorId: ctx.actorId, role: context.role },
            scope: {
              tenantId: ctx.tenantId,
              venueId: ctx.venueId,
              clubId: ctx.clubId,
              competitionId: ctx.competitionId,
            },
          });
          if (!evidence) {
            failCompetitionAdapter(
              SHARED_ADAPTER_ERROR_CODE.MISSING_CANONICAL_IDENTITY,
              "Capability evidence is unavailable for this actor",
              { actorId: ctx.actorId }
            );
          }
          return freezeEvidence({
            sourceSystem: "identity",
            status: EVIDENCE_STATUS.OK,
            data: {
              actorId: ctx.actorId,
              grantedPermissions: evidence.grantedPermissions || [],
            },
            reasonCodes: [],
          });
        } catch (err) {
          mapIntegrationError(err);
        }
      },
      async resolveSubjectIdentity(context) {
        const ctx = requireAdapterContext(context, {
          requiredFields: ["tenantId", "actorId", "correlationId"],
          boundTenantId,
          requireActor: true,
        });
        try {
          const result = await resolveSubject({
            subjectId: ctx.subjectId || context.subjectId,
            requestedTenantId: ctx.tenantId,
            tenantId: ctx.tenantId,
            correlationId: ctx.correlationId,
          });
          if (!result?.ok) {
            if (result?.code === SUBJECT_IDENTITY_LOOKUP_CODE.SUBJECT_NOT_FOUND) {
              return freezeEvidence({
                sourceSystem: "identity",
                sourceVersion: result.evidence?.evidenceVersion || null,
                status: EVIDENCE_STATUS.NOT_FOUND,
                data: {
                  subjectId: isNonEmptyString(ctx.subjectId)
                    ? ctx.subjectId
                    : isNonEmptyString(context.subjectId)
                      ? String(context.subjectId).trim()
                      : null,
                },
                reasonCodes: ["SUBJECT_NOT_FOUND"],
                retrievedAt: ctx.effectiveAt,
              });
            }
            mapSubjectLookupFailure(result, ctx);
            failCompetitionAdapter(
              SHARED_ADAPTER_ERROR_CODE.MISSING_CANONICAL_IDENTITY,
              "Subject identity evidence is unavailable",
              { subjectId: ctx.subjectId || null }
            );
          }
          const evidence = result.evidence;
          return freezeEvidence({
            sourceSystem: "identity",
            sourceVersion: evidence.evidenceVersion,
            status: EVIDENCE_STATUS.OK,
            data: {
              subjectId: evidence.subjectId,
              canonicalSubjectId: evidence.canonicalSubjectId || evidence.subjectId,
              role: evidence.role,
              status: evidence.status,
              active: evidence.active === true,
              tenantId: evidence.tenantId,
              venueId: evidence.venueId,
              clubId: evidence.clubId,
              organizationId: evidence.organizationId ?? evidence.scopeIds?.organizationId ?? null,
              scopeIds: evidence.scopeIds,
              matchesRequestedTenant: evidence.matchesRequestedTenant === true,
              source: evidence.source,
              evidenceVersion: evidence.evidenceVersion,
            },
            reasonCodes: [],
            retrievedAt: ctx.effectiveAt,
          });
        } catch (err) {
          mapIntegrationError(err);
        }
      },
    },
  });
}
