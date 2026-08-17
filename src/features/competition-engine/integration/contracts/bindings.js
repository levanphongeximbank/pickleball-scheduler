/**
 * Compatibility bindings: canonical contract → existing authoritative adapters.
 * No duplicate domain implementation. No Competition Core authority.
 */

import { createIdentityEvidenceFromIdentityAdapter } from "../adapters/identityEvidenceFromIdentityAdapter.js";
import {
  resolveSubjectIdentityRecord,
  SUBJECT_IDENTITY_LOOKUP_CODE,
} from "../../../identity/services/subjectIdentityLookupService.js";
import { createMembershipStatusFromClubAdapter } from "../adapters/membershipStatusFromClubAdapter.js";
import { createPlayerParticipantLookupAdapter } from "../adapters/playerParticipantLookupAdapter.js";
import { createRankingRatingSnapshotFromRatingAdapter } from "../adapters/rankingRatingSnapshotFromRatingAdapter.js";
import { assertTenantIsolation } from "../context/requireIntegrationContext.js";
import { IntegrationError } from "../errors.js";
import {
  AUDIT_CONTRACT,
  ANALYTICS_REPORTING_CONTRACT,
  CLUB_TEAM_MEMBERSHIP_CONTRACT,
  CRM_SPONSOR_CONTRACT,
  FEDERATION_EXTERNAL_AUTHORITY_CONTRACT,
  FILE_MEDIA_CONTRACT,
  FINANCE_PAYMENT_CONTRACT,
  IDENTITY_ACCESS_CONTRACT,
  NOTIFICATION_COMMUNICATION_CONTRACT,
  PARTICIPANT_CONTRACT,
  RANKING_CONTRACT,
  RATING_CONTRACT,
  STREAMING_SCOREBOARD_CONTRACT,
  TENANT_ORGANIZATION_CONTRACT,
  WORKSTREAM_CONTRACT_DEFINITIONS,
  getWorkstreamContractDefinition,
} from "./definitions.js";
import { createContractAdapter } from "./kernel/assertContract.js";
import {
  PRODUCTION_BINDING_STATUS,
  SHARED_ADAPTER_ERROR_CODE,
} from "./kernel/constants.js";
import {
  distinguishScopeIds as readDistinctScopeIds,
  requireAdapterContext,
  requireCanonicalTenantId,
} from "./kernel/context.js";
import { failCompetitionAdapter } from "./kernel/errors.js";
import { freezeEvidence, EVIDENCE_STATUS } from "./kernel/evidence.js";
import { freezeClone, isNonEmptyString, isPlainObject } from "./kernel/helpers.js";

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

function participantIdFrom(context) {
  return (
    (isNonEmptyString(context.participantId) && String(context.participantId).trim()) ||
    (isNonEmptyString(context.playerId) && String(context.playerId).trim()) ||
    (isNonEmptyString(context.canonicalPlayerId) &&
      String(context.canonicalPlayerId).trim()) ||
    null
  );
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
              role: evidence.role,
              status: evidence.status,
              active: evidence.active === true,
              tenantId: evidence.tenantId,
              venueId: evidence.venueId,
              clubId: evidence.clubId,
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

export function createTenantOrganizationBinding(deps = {}) {
  const boundTenantId = isNonEmptyString(deps.boundTenantId)
    ? String(deps.boundTenantId).trim()
    : null;
  const getTenantById =
    typeof deps.getTenantById === "function" ? deps.getTenantById : null;

  return createContractAdapter(TENANT_ORGANIZATION_CONTRACT, {
    productionBinding: PRODUCTION_BINDING_STATUS.PARTIAL,
    notConfiguredMethods: ["resolveOrganizationIdentity", "getOrganizationStatus"],
    handlers: {
      resolveTenantIdentity(context) {
        const ctx = requireAdapterContext(context, {
          requiredFields: ["tenantId", "correlationId"],
          boundTenantId,
        });
        if (getTenantById) {
          const record = getTenantById(ctx.tenantId);
          if (!record) {
            failCompetitionAdapter(
              SHARED_ADAPTER_ERROR_CODE.MISSING_CANONICAL_IDENTITY,
              "Tenant directory does not contain tenantId",
              { tenantId: ctx.tenantId }
            );
          }
          return freezeEvidence({
            sourceSystem: "tenant",
            status: EVIDENCE_STATUS.OK,
            data: {
              tenantId: ctx.tenantId,
              organizationId: null,
              clubId: ctx.clubId,
              venueId: ctx.venueId,
              directoryResolved: true,
            },
            reasonCodes: [],
          });
        }
        return freezeEvidence({
          sourceSystem: "tenant-context",
          status: EVIDENCE_STATUS.CONTEXT_VALIDATED,
          data: {
            tenantId: ctx.tenantId,
            organizationId: null,
            clubId: ctx.clubId,
            venueId: ctx.venueId,
            directoryResolved: false,
          },
          reasonCodes: ["TENANT_DIRECTORY_NOT_INJECTED"],
        });
      },
      validateScope(context) {
        const tenantId = requireCanonicalTenantId(context);
        requireAdapterContext(context, {
          requiredFields: ["tenantId", "correlationId"],
          boundTenantId,
        });
        try {
          if (boundTenantId) assertTenantIsolation(tenantId, boundTenantId);
        } catch (err) {
          mapIntegrationError(err);
        }
        return freezeEvidence({
          sourceSystem: "tenant-context",
          status: EVIDENCE_STATUS.OK,
          data: { tenantId, valid: true },
          reasonCodes: [],
        });
      },
      distinguishScopeIds(context) {
        requireAdapterContext(context, {
          requiredFields: ["tenantId", "correlationId"],
          boundTenantId,
        });
        return freezeEvidence({
          sourceSystem: "tenant-context",
          status: EVIDENCE_STATUS.OK,
          data: readDistinctScopeIds(context),
          reasonCodes: [],
        });
      },
    },
  });
}

export function createParticipantBinding(deps = {}) {
  const boundTenantId = isNonEmptyString(deps.boundTenantId)
    ? String(deps.boundTenantId).trim()
    : null;
  const lookup = createPlayerParticipantLookupAdapter(deps);

  function requireParticipant(context) {
    const ctx = requireAdapterContext(context, {
      requiredFields: ["tenantId", "correlationId"],
      boundTenantId,
    });
    const participantId = participantIdFrom(context);
    if (!participantId) {
      failCompetitionAdapter(
        SHARED_ADAPTER_ERROR_CODE.MISSING_CANONICAL_IDENTITY,
        "Canonical participantId/playerId is required",
        {}
      );
    }
    if (isNonEmptyString(context.displayName) && context.useDisplayNameAsIdentity) {
      failCompetitionAdapter(
        SHARED_ADAPTER_ERROR_CODE.DISPLAY_NAME_IS_NOT_IDENTITY,
        "Display name is never identity authority",
        {}
      );
    }
    return { ctx, participantId };
  }

  function snapshot(context) {
    const { ctx, participantId } = requireParticipant(context);
    const result = lookup.resolveParticipantSnapshot(participantId);
    if (!result?.ok || !result.participant) {
      failCompetitionAdapter(
        SHARED_ADAPTER_ERROR_CODE.MISSING_CANONICAL_IDENTITY,
        "Canonical participant could not be resolved",
        { participantId, reasonCodes: result?.reasonCodes || [] }
      );
    }
    return { ctx, participantId, result };
  }

  return createContractAdapter(PARTICIPANT_CONTRACT, {
    productionBinding: PRODUCTION_BINDING_STATUS.BOUND,
    handlers: {
      resolveCanonicalParticipant(context) {
        const { result } = snapshot(context);
        return freezeEvidence({
          sourceSystem: "player",
          status: EVIDENCE_STATUS.OK,
          data: result.participant,
          reasonCodes: [],
        });
      },
      getCompetitionSafeProfile(context) {
        const { result } = snapshot(context);
        return freezeEvidence({
          sourceSystem: "player",
          status: EVIDENCE_STATUS.OK,
          data: result.participant.profileSnapshot,
          reasonCodes: [],
        });
      },
      verifySourceStatus(context) {
        const { result } = snapshot(context);
        const status = result.participant.status || "UNKNOWN";
        return freezeEvidence({
          sourceSystem: "player",
          status: EVIDENCE_STATUS.OK,
          data: {
            eligibleSourceStatus: status === "ACTIVE",
            status,
          },
          reasonCodes: [],
        });
      },
      getParticipantSnapshot(context) {
        const { result } = snapshot(context);
        return freezeEvidence({
          sourceSystem: "player",
          snapshotId: result.participant.id || null,
          status: EVIDENCE_STATUS.OK,
          data: result.participant,
          reasonCodes: [],
        });
      },
    },
  });
}

export function createClubTeamMembershipBinding(deps = {}) {
  const boundTenantId = isNonEmptyString(deps.boundTenantId)
    ? String(deps.boundTenantId).trim()
    : null;
  const membership = createMembershipStatusFromClubAdapter(deps);
  const teamHandlers = isPlainObject(deps.teamHandlers) ? deps.teamHandlers : {};

  async function membershipEvidence(context) {
    const ctx = requireAdapterContext(context, {
      requiredFields: ["tenantId", "correlationId"],
      boundTenantId,
    });
    const participantId = participantIdFrom(context);
    if (!participantId) {
      failCompetitionAdapter(
        SHARED_ADAPTER_ERROR_CODE.MISSING_CANONICAL_IDENTITY,
        "Canonical participantId is required for membership evidence",
        {}
      );
    }
    const row = await membership.getMembershipStatus({
      participantId,
      clubId: ctx.clubId,
      organizationId: ctx.organizationId,
    });
    return freezeEvidence({
      sourceSystem: "club",
      status: EVIDENCE_STATUS.OK,
      data: {
        tenantId: ctx.tenantId,
        clubId: ctx.clubId,
        organizationId: ctx.organizationId,
        participantId,
        isMember: row?.isMember === true,
        membershipStatus: row?.status || null,
        reasonCodes: row?.reasonCodes || [],
      },
      reasonCodes: row?.reasonCodes || [],
    });
  }

  return createContractAdapter(CLUB_TEAM_MEMBERSHIP_CONTRACT, {
    productionBinding: PRODUCTION_BINDING_STATUS.PARTIAL,
    notConfiguredMethods: Object.keys(teamHandlers).length
      ? []
      : ["getTeamIdentity", "getTeamRoster", "getCaptainRelationship"],
    handlers: {
      async getClubAffiliation(context) {
        return membershipEvidence(context);
      },
      async getMembershipStatus(context) {
        return membershipEvidence(context);
      },
      async getMembershipEvidence(context) {
        return membershipEvidence(context);
      },
      ...(typeof teamHandlers.getTeamIdentity === "function"
        ? { getTeamIdentity: teamHandlers.getTeamIdentity }
        : {}),
      ...(typeof teamHandlers.getTeamRoster === "function"
        ? { getTeamRoster: teamHandlers.getTeamRoster }
        : {}),
      ...(typeof teamHandlers.getCaptainRelationship === "function"
        ? { getCaptainRelationship: teamHandlers.getCaptainRelationship }
        : {}),
    },
  });
}

export function createRatingBinding(deps = {}) {
  const boundTenantId = isNonEmptyString(deps.boundTenantId)
    ? String(deps.boundTenantId).trim()
    : null;
  const hasResolver = typeof deps.resolveRatings === "function";
  if (!hasResolver) {
    return createContractAdapter(RATING_CONTRACT, {
      productionBinding: PRODUCTION_BINDING_STATUS.NOT_CONFIGURED,
    });
  }
  const snapshotPort = createRankingRatingSnapshotFromRatingAdapter(deps);

  return createContractAdapter(RATING_CONTRACT, {
    productionBinding: PRODUCTION_BINDING_STATUS.PARTIAL,
    handlers: {
      getRatingSnapshot(context) {
        const ctx = requireAdapterContext(context, {
          requiredFields: ["tenantId", "correlationId"],
          boundTenantId,
        });
        const playerId = participantIdFrom(context);
        const entryIds = Array.isArray(context.entryIds)
          ? context.entryIds.map((id) => String(id)).filter(Boolean)
          : playerId
            ? [playerId]
            : [];
        if (entryIds.length === 0) {
          failCompetitionAdapter(
            SHARED_ADAPTER_ERROR_CODE.MISSING_CANONICAL_IDENTITY,
            "playerId or entryIds is required for rating snapshot",
            {}
          );
        }
        const effectiveAt = ctx.effectiveAt || context.effectiveAt;
        if (effectiveAt == null || effectiveAt === "") {
          failCompetitionAdapter(
            SHARED_ADAPTER_ERROR_CODE.MISSING_REQUIRED_CONTEXT,
            "effectiveAt is required for rating snapshot",
            { field: "effectiveAt" }
          );
        }
        const snapshot = snapshotPort.getSnapshot({
          entryIds,
          effectiveAt,
          seedingScope: {
            tenantId: ctx.tenantId,
            competitionId: ctx.competitionId,
          },
          snapshotRef: ctx.snapshotId,
        });
        const first = snapshot.subjectValues?.[0] || null;
        return freezeEvidence({
          sourceSystem: snapshot.sourceSystem,
          sourceVersion: snapshot.sourceVersion,
          snapshotId: snapshot.snapshotId,
          effectiveAt: snapshot.effectiveAt,
          status: first?.available ? EVIDENCE_STATUS.OK : EVIDENCE_STATUS.PARTIAL,
          data: {
            ratingSnapshotId: snapshot.snapshotId,
            playerId: first?.entryId || playerId,
            ratingValue: first?.ratingValue ?? null,
            completenessState: snapshot.completenessState,
            subjectValues: snapshot.subjectValues,
          },
          reasonCodes: first?.reasonCodes || [],
        });
      },
    },
  });
}

export function createNotificationCommunicationBinding(deps = {}) {
  const boundTenantId = isNonEmptyString(deps.boundTenantId)
    ? String(deps.boundTenantId).trim()
    : null;
  const emitFn =
    typeof deps.emitMatchScheduled === "function" ? deps.emitMatchScheduled : null;

  return createContractAdapter(NOTIFICATION_COMMUNICATION_CONTRACT, {
    productionBinding: PRODUCTION_BINDING_STATUS.PARTIAL,
    handlers: {
      async publishCompetitionCommunicationEvent(context) {
        const ctx = requireAdapterContext(context, {
          requiredFields: ["tenantId", "correlationId"],
          boundTenantId,
          requireIdempotencyKey: true,
        });
        const eventType = isNonEmptyString(context.eventType)
          ? String(context.eventType).trim()
          : "";
        if (eventType !== "MATCH_SCHEDULED") {
          failCompetitionAdapter(
            SHARED_ADAPTER_ERROR_CODE.CAPABILITY_NOT_SUPPORTED,
            "Only MATCH_SCHEDULED is bound in this foundation",
            { eventType }
          );
        }
        if (!ctx.matchId) {
          failCompetitionAdapter(
            SHARED_ADAPTER_ERROR_CODE.MISSING_REQUIRED_CONTEXT,
            "matchId is required for MATCH_SCHEDULED",
            { field: "matchId" }
          );
        }
        const emit =
          emitFn ||
          (await import("../../../notifications/adapters/competitionMatchScheduledAdapter.js"))
            .emitMatchScheduledFromBoundary;
        const result = await emit({
          tenantId: ctx.tenantId,
          matchId: ctx.matchId,
          scheduleVersion: ctx.sourceVersion || ctx.idempotencyKey,
          competitionId: ctx.competitionId,
          venueId: ctx.venueId,
          clubId: ctx.clubId,
          actorUserId: ctx.actorId,
        });
        const ok = result?.ok === true;
        return freezeEvidence({
          sourceSystem: "notifications",
          status: ok ? EVIDENCE_STATUS.OK : EVIDENCE_STATUS.DELIVERY_FAILED,
          data: {
            businessEventOccurred: true,
            deliverySucceeded: ok,
            eventType,
            result,
          },
          reasonCodes: ok ? [] : ["NOTIFICATION_DELIVERY_FAILED"],
        });
      },
    },
  });
}

export function createNotConfiguredContractAdapter(definition, extras = {}) {
  return createContractAdapter(definition, {
    productionBinding: PRODUCTION_BINDING_STATUS.NOT_CONFIGURED,
    runtimeClassification: definition.runtimeClassification,
    ...extras,
  });
}

export function createRankingBinding(deps = {}) {
  if (typeof deps.resolveRankings === "function") {
    const boundTenantId = isNonEmptyString(deps.boundTenantId)
      ? String(deps.boundTenantId).trim()
      : null;
    return createContractAdapter(RANKING_CONTRACT, {
      productionBinding: PRODUCTION_BINDING_STATUS.PARTIAL,
      handlers: {
        getRankingSnapshot(context) {
          const ctx = requireAdapterContext(context, {
            requiredFields: ["tenantId", "correlationId"],
            boundTenantId,
          });
          const playerId = participantIdFrom(context);
          if (!playerId) {
            failCompetitionAdapter(
              SHARED_ADAPTER_ERROR_CODE.MISSING_CANONICAL_IDENTITY,
              "Canonical playerId is required for ranking snapshot",
              {}
            );
          }
          const row = deps.resolveRankings({
            playerId,
            tenantId: ctx.tenantId,
            effectiveAt: ctx.effectiveAt,
          });
          if (!row) {
            failCompetitionAdapter(
              SHARED_ADAPTER_ERROR_CODE.NOT_CONFIGURED,
              "Ranking snapshot is not available",
              { playerId }
            );
          }
          return freezeEvidence({
            sourceSystem: "vpr-ranking",
            snapshotId: row.rankingSnapshotId || null,
            effectiveAt: row.effectiveAt || ctx.effectiveAt,
            status: EVIDENCE_STATUS.OK,
            data: {
              playerId,
              rankingPosition: row.rankingPosition ?? null,
              rankingPoints: row.rankingPoints ?? null,
              rankingSystem: row.rankingSystem || "vpr",
              rankingSnapshotId: row.rankingSnapshotId || null,
            },
            reasonCodes: [],
          });
        },
      },
    });
  }
  return createNotConfiguredContractAdapter(RANKING_CONTRACT);
}

export function createFinancePaymentBinding(deps = {}) {
  if (typeof deps.getPaymentStatus === "function") {
    const boundTenantId = isNonEmptyString(deps.boundTenantId)
      ? String(deps.boundTenantId).trim()
      : null;
    const read = async (context) => {
      const ctx = requireAdapterContext(context, {
        requiredFields: ["tenantId", "competitionId", "correlationId"],
        boundTenantId,
      });
      const row = await deps.getPaymentStatus({
        competitionId: ctx.competitionId,
        participantId: participantIdFrom(context),
        teamId: ctx.teamId,
        tenantId: ctx.tenantId,
      });
      if (!row) {
        failCompetitionAdapter(
          SHARED_ADAPTER_ERROR_CODE.NOT_CONFIGURED,
          "Payment evidence is not configured",
          {}
        );
      }
      return freezeEvidence({
        sourceSystem: "finance",
        status: EVIDENCE_STATUS.OK,
        data: row,
        reasonCodes: [],
      });
    };
    return createContractAdapter(FINANCE_PAYMENT_CONTRACT, {
      productionBinding: PRODUCTION_BINDING_STATUS.PARTIAL,
      handlers: {
        getEntryFeeStatus: read,
        getPaymentState: read,
        getWaiverStatus: read,
        getRefundState: read,
        getSettlementReference: read,
      },
    });
  }
  return createNotConfiguredContractAdapter(FINANCE_PAYMENT_CONTRACT);
}

export function createFileMediaBinding() {
  return createNotConfiguredContractAdapter(FILE_MEDIA_CONTRACT);
}

export function createStreamingScoreboardBinding() {
  return createNotConfiguredContractAdapter(STREAMING_SCOREBOARD_CONTRACT);
}

export function createFederationExternalAuthorityBinding() {
  return createNotConfiguredContractAdapter(FEDERATION_EXTERNAL_AUTHORITY_CONTRACT);
}

export function createCrmSponsorBinding() {
  return createNotConfiguredContractAdapter(CRM_SPONSOR_CONTRACT);
}

export function createAnalyticsReportingBinding() {
  return createNotConfiguredContractAdapter(ANALYTICS_REPORTING_CONTRACT);
}

export function createAuditBinding(deps = {}) {
  if (typeof deps.append !== "function") {
    return createNotConfiguredContractAdapter(AUDIT_CONTRACT);
  }
  const boundTenantId = isNonEmptyString(deps.boundTenantId)
    ? String(deps.boundTenantId).trim()
    : null;
  return createContractAdapter(AUDIT_CONTRACT, {
    productionBinding: PRODUCTION_BINDING_STATUS.PARTIAL,
    handlers: {
      async appendAuditRecord(context) {
        const ctx = requireAdapterContext(context, {
          requiredFields: ["tenantId", "actorId", "correlationId"],
          boundTenantId,
          requireActor: true,
        });
        const recorded = await deps.append({
          actorId: ctx.actorId,
          tenantId: ctx.tenantId,
          competitionId: ctx.competitionId,
          action: context.action,
          entityRef: context.entityRef,
          correlationId: ctx.correlationId,
        });
        return freezeEvidence({
          sourceSystem: "audit",
          status: EVIDENCE_STATUS.OK,
          data: recorded || { accepted: true },
          reasonCodes: [],
        });
      },
      async queryAuditEvidence(context) {
        const ctx = requireAdapterContext(context, {
          requiredFields: ["tenantId", "actorId", "correlationId"],
          boundTenantId,
          requireActor: true,
        });
        if (typeof deps.query !== "function") {
          failCompetitionAdapter(
            SHARED_ADAPTER_ERROR_CODE.NOT_CONFIGURED,
            "Audit query sink is not configured",
            {}
          );
        }
        const rows = await deps.query({
          tenantId: ctx.tenantId,
          competitionId: ctx.competitionId,
          correlationId: ctx.correlationId,
        });
        return freezeEvidence({
          sourceSystem: "audit",
          status: EVIDENCE_STATUS.OK,
          data: { records: rows || [] },
          reasonCodes: [],
        });
      },
    },
  });
}

/**
 * Default foundation set: reuse existing Identity/Participant/Membership/Rating
 * bindings; remaining contracts fail closed as NOT_CONFIGURED unless injected.
 *
 * @param {object} [deps]
 */
export function createDefaultWorkstreamAdapters(deps = {}) {
  const boundTenantId = isNonEmptyString(deps.boundTenantId)
    ? String(deps.boundTenantId).trim()
    : null;
  const withBound = (extra = {}) => ({
    ...extra,
    boundTenantId: extra.boundTenantId || boundTenantId,
  });
  return Object.freeze([
    createIdentityAccessBinding(withBound(deps.identity || {})),
    createTenantOrganizationBinding(withBound(deps.tenant || {})),
    createParticipantBinding(withBound(deps.participant || {})),
    createClubTeamMembershipBinding(withBound(deps.membership || {})),
    createRatingBinding(withBound(deps.rating || {})),
    createRankingBinding(withBound(deps.ranking || {})),
    createFinancePaymentBinding(withBound(deps.finance || {})),
    createNotificationCommunicationBinding(withBound(deps.notification || {})),
    createFileMediaBinding(),
    createStreamingScoreboardBinding(),
    createFederationExternalAuthorityBinding(),
    createCrmSponsorBinding(),
    createAnalyticsReportingBinding(),
    createAuditBinding(withBound(deps.audit || {})),
  ]);
}

/**
 * Immutable registry of adapter implementations for the 14 owned contracts.
 * @param {{ adapters?: object[] }} [input]
 */
export function createCompetitionAdapterImplementationRegistry(input = {}) {
  if (!isPlainObject(input)) {
    failCompetitionAdapter(
      SHARED_ADAPTER_ERROR_CODE.MALFORMED_ADAPTER,
      "Registry input must be a plain object",
      {}
    );
  }
  const adaptersRaw = Array.isArray(input.adapters)
    ? input.adapters
    : createDefaultWorkstreamAdapters(input.deps || {});
  /** @type {Map<string, object>} */
  const byId = new Map();
  for (let i = 0; i < adaptersRaw.length; i += 1) {
    const adapter = adaptersRaw[i];
    const definition = getWorkstreamContractDefinition(adapter?.contractId);
    if (!definition) {
      failCompetitionAdapter(
        SHARED_ADAPTER_ERROR_CODE.UNKNOWN_CONTRACT,
        "Implementation registry accepts only the 14 owned contracts",
        { contractId: adapter?.contractId || null, index: i }
      );
    }
    if (byId.has(definition.contractId)) {
      failCompetitionAdapter(
        SHARED_ADAPTER_ERROR_CODE.DUPLICATE_REGISTRATION,
        `Adapter already registered for ${definition.contractId}`,
        { contractId: definition.contractId, index: i }
      );
    }
    byId.set(definition.contractId, adapter);
  }
  let frozen = true;
  return Object.freeze({
    kind: "competition-adapter-implementation-registry",
    frozen: true,
    size() {
      return byId.size;
    },
    list() {
      return Object.freeze([...byId.values()]);
    },
    get(contractId) {
      const adapter = byId.get(contractId);
      if (!adapter) {
        failCompetitionAdapter(
          SHARED_ADAPTER_ERROR_CODE.UNKNOWN_CONTRACT,
          `No implementation registered for ${contractId}`,
          { contractId }
        );
      }
      return adapter;
    },
    register() {
      if (frozen) {
        failCompetitionAdapter(
          SHARED_ADAPTER_ERROR_CODE.REGISTRY_FROZEN,
          "Implementation registry is immutable after creation",
          {}
        );
      }
    },
  });
}

export { WORKSTREAM_CONTRACT_DEFINITIONS, freezeClone };
