/**
 * Official/Open Tournament ĐẦU B — composition root.
 *
 * Consumes frozen Canonical Competition Adapter Contracts.
 * Does not own eligibility / pairing / seeding / draw / schedule / court /
 * referee / scoring / standings / qualification / knockout / champion /
 * competition lifecycle engines.
 */

import { courtResourceCompetitionAdapter } from "../../competition-core/adapters/courtResourceCompetitionAdapter.js";
import { COMPETITION_TYPE } from "../../competition-core/contracts/competitionCourtAdapterContract.js";
import {
  createAnalyticsReportingBinding,
  createAuditBinding,
  createClubTeamMembershipBinding,
  createCrmSponsorBinding,
  createFederationExternalAuthorityBinding,
  createFileMediaBinding,
  createFinancePaymentBinding,
  createIdentityAccessBinding,
  createNotificationCommunicationBinding,
  createParticipantBinding,
  createRankingBinding,
  createRatingBinding,
  createStreamingScoreboardBinding,
  createTenantOrganizationBinding,
  PRODUCTION_BINDING_STATUS,
} from "../../competition-engine/integration/contracts/index.js";
import { canonicalMembershipRepository } from "../../club/repositories/canonicalMembershipRepository.js";
import { writeAuditLog } from "../../identity/services/auditService.js";
import { PERMISSIONS } from "../../identity/constants/permissions.js";
import { isCompetitionAdapterContractError } from "../../competition-engine/integration/contracts/kernel/errors.js";
import { SHARED_ADAPTER_ERROR_CODE } from "../../competition-engine/integration/contracts/kernel/constants.js";
import {
  ADAPTER_B_STATUS,
  COURT_SHARED_RUNTIME_GAP,
  EXTERNAL_DEPENDENCY,
  OFFICIAL_OPEN_ADAPTER_B_ID,
  OFFICIAL_OPEN_ADAPTER_B_VERSION,
  SHARED_CONTRACT_CAPABILITY_GAP,
  SHARED_REFEREE_CONTRACT_CAPABILITY_GAP,
  TEMPORARY_COMPATIBILITY_NONCANONICAL,
} from "./constants.js";
import {
  shouldActivateOfficialOpenFederation,
  shouldActivateOfficialOpenMembership,
  shouldActivateOfficialOpenRanking,
  shouldActivateOfficialOpenRating,
} from "./activation.js";
import { distinguishOfficialOpenScopeIds, resolveOfficialOpenTenantScope } from "./tenant.js";
import { createOfficialTournamentRefereeAdapter } from "./officialTournamentRefereeAdapter.js";

function trimId(value) {
  return value != null ? String(value).trim() : "";
}

function newCorrelationId(prefix = "official-open") {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function captureAdapterError(err) {
  if (isCompetitionAdapterContractError(err)) {
    return {
      ok: false,
      code: err.code,
      error: err.message,
      details: err.details || {},
    };
  }
  return {
    ok: false,
    code: "ADAPTER_B_FAILED",
    error: err instanceof Error ? err.message : String(err || "adapter failed"),
  };
}

async function safeCall(fn) {
  try {
    const data = await fn();
    return { ok: true, data };
  } catch (err) {
    return captureAdapterError(err);
  }
}

function buildContext(base, extra = {}) {
  return {
    contractVersion: "1.0.0",
    correlationId: extra.correlationId || base.correlationId || newCorrelationId(),
    tenantId: extra.tenantId || base.tenantId,
    actorId: extra.actorId || base.actorId,
    role: extra.role || base.role,
    clubId: extra.clubId || base.clubId,
    venueId: extra.venueId || base.venueId,
    organizationId: extra.organizationId || base.organizationId || null,
    competitionId: extra.competitionId || base.competitionId,
    matchId: extra.matchId || base.matchId,
    participantId: extra.participantId || extra.playerId || base.participantId,
    playerId: extra.playerId || extra.participantId || base.playerId,
    canonicalPlayerId: extra.canonicalPlayerId || extra.playerId || extra.participantId,
    effectiveAt: extra.effectiveAt || base.effectiveAt || new Date().toISOString(),
    idempotencyKey: extra.idempotencyKey,
    eventType: extra.eventType,
    action: extra.action,
    entityRef: extra.entityRef,
    ...extra,
  };
}

/**
 * @param {{
 *   tournament?: object|null,
 *   activeClub?: object|null,
 *   currentTenantId?: string|null,
 *   actor?: { id?: string, role?: string }|null,
 *   resolveRatings?: Function,
 *   resolveRankings?: Function,
 *   getPaymentStatus?: Function,
 *   getActiveMembershipForUser?: Function,
 *   appendAudit?: Function,
 *   queryAudit?: Function,
 * }} [deps]
 */
export function createOfficialOpenAdapterB(deps = {}) {
  const tournament = deps.tournament || null;
  const scope = resolveOfficialOpenTenantScope({
    tournament,
    activeClub: deps.activeClub,
    currentTenantId: deps.currentTenantId,
  });
  const tenantId = scope.ok ? scope.tenantId : trimId(deps.currentTenantId) || null;
  const actorId = trimId(deps.actor?.id || deps.actor?.userId) || null;
  const clubId = scope.clubId || trimId(deps.activeClub?.id || tournament?.clubId) || null;
  const venueId = scope.venueId;
  const competitionId = trimId(tournament?.id || deps.competitionId) || null;

  const bound = {
    tenantId,
    actorId,
    clubId,
    venueId,
    organizationId: null,
    competitionId,
    role: deps.actor?.role || null,
    correlationId: newCorrelationId(),
  };

  const identity = createIdentityAccessBinding({ boundTenantId: tenantId });
  const tenant = createTenantOrganizationBinding({ boundTenantId: tenantId });
  const participant = createParticipantBinding({
    boundTenantId: tenantId,
    clubId,
  });
  const membership = createClubTeamMembershipBinding({
    boundTenantId: tenantId,
    getActiveMembershipForUser:
      typeof deps.getActiveMembershipForUser === "function"
        ? deps.getActiveMembershipForUser
        : (membershipClubId, participantId) =>
            canonicalMembershipRepository.getActiveMembershipForUser(
              membershipClubId,
              participantId
            ),
  });
  const rating = createRatingBinding({
    boundTenantId: tenantId,
    resolveRatings: deps.resolveRatings,
  });
  const ranking = shouldActivateOfficialOpenRanking(tournament)
    ? createRankingBinding({
        boundTenantId: tenantId,
        resolveRankings: deps.resolveRankings,
      })
    : createRankingBinding({ boundTenantId: tenantId });
  const finance = createFinancePaymentBinding({
    boundTenantId: tenantId,
    getPaymentStatus: deps.getPaymentStatus,
  });
  const notification = createNotificationCommunicationBinding({
    boundTenantId: tenantId,
  });
  const fileMedia = createFileMediaBinding();
  const streaming = createStreamingScoreboardBinding();
  const federation = shouldActivateOfficialOpenFederation(tournament)
    ? createFederationExternalAuthorityBinding()
    : createFederationExternalAuthorityBinding();
  const crm = createCrmSponsorBinding();
  const analytics = createAnalyticsReportingBinding();
  const audit = createAuditBinding({
    boundTenantId: tenantId,
    append:
      typeof deps.appendAudit === "function"
        ? deps.appendAudit
        : (payload) =>
            writeAuditLog({
              action: payload.action || "official_open_audit",
              resourceType: "tournament",
              resourceId: payload.competitionId || competitionId || "",
              clubId: payload.clubId || clubId,
              actor: { id: payload.actorId },
              metadata: {
                tenantId: payload.tenantId,
                correlationId: payload.correlationId,
                entityRef: payload.entityRef,
              },
            }),
    query: deps.queryAudit,
  });

  const court = courtResourceCompetitionAdapter;
  const referee = createOfficialTournamentRefereeAdapter({
    tournament,
    tenantId,
    getTournament: deps.getTournament,
  });

  const ratingActivated = shouldActivateOfficialOpenRating(tournament);
  const membershipActivated = shouldActivateOfficialOpenMembership(tournament);
  const rankingActivated = shouldActivateOfficialOpenRanking(tournament);
  const federationActivated = shouldActivateOfficialOpenFederation(tournament);
  const financeGap = finance.productionBinding === PRODUCTION_BINDING_STATUS.NOT_CONFIGURED;

  return Object.freeze({
    id: OFFICIAL_OPEN_ADAPTER_B_ID,
    version: OFFICIAL_OPEN_ADAPTER_B_VERSION,
    ownsAuthority: false,
    scope: Object.freeze({
      ...scope,
      distinctIds: distinguishOfficialOpenScopeIds(scope),
    }),
    contracts: Object.freeze({
      identity,
      tenant,
      participant,
      membership,
      rating,
      ranking,
      finance,
      notification,
      fileMedia,
      streaming,
      federation,
      crm,
      analytics,
      audit,
      court,
      referee,
    }),
    status: Object.freeze({
      identity: ADAPTER_B_STATUS.CANONICAL_BOUND,
      tenant: ADAPTER_B_STATUS.CANONICAL_BOUND,
      participant: ADAPTER_B_STATUS.CANONICAL_BOUND,
      membership: membershipActivated
        ? ADAPTER_B_STATUS.CANONICAL_BOUND
        : ADAPTER_B_STATUS.CONDITIONAL_INACTIVE,
      rating: ratingActivated
        ? rating.productionBinding === PRODUCTION_BINDING_STATUS.NOT_CONFIGURED
          ? ADAPTER_B_STATUS.NOT_CONFIGURED
          : ADAPTER_B_STATUS.CANONICAL_BOUND
        : ADAPTER_B_STATUS.CONDITIONAL_INACTIVE,
      ranking: rankingActivated
        ? ranking.productionBinding === PRODUCTION_BINDING_STATUS.NOT_CONFIGURED
          ? ADAPTER_B_STATUS.NOT_CONFIGURED
          : ADAPTER_B_STATUS.CANONICAL_BOUND
        : ADAPTER_B_STATUS.CONDITIONAL_INACTIVE,
      court: ADAPTER_B_STATUS.CANONICAL_BOUND,
      referee: ADAPTER_B_STATUS.CANONICAL_BOUND,
      finance: financeGap
        ? ADAPTER_B_STATUS.SHARED_CONTRACT_CAPABILITY_GAP
        : ADAPTER_B_STATUS.CANONICAL_BOUND,
      notification: ADAPTER_B_STATUS.CANONICAL_BOUND,
      fileMedia: ADAPTER_B_STATUS.NOT_REQUIRED,
      streaming: ADAPTER_B_STATUS.NOT_REQUIRED,
      federation: federationActivated
        ? ADAPTER_B_STATUS.NOT_CONFIGURED
        : ADAPTER_B_STATUS.NOT_REQUIRED,
      crm: ADAPTER_B_STATUS.NOT_REQUIRED,
      analytics: ADAPTER_B_STATUS.NOT_REQUIRED,
      audit: ADAPTER_B_STATUS.ADAPTER_BOUND_COMPATIBILITY_SINK,
    }),
    gaps: Object.freeze([
      {
        code: COURT_SHARED_RUNTIME_GAP,
        adapter: "07_COURT",
        kind: EXTERNAL_DEPENDENCY,
        reason:
          "Competition Court Contract A / gateway does not provide Official/Open cloud CAS occupancy equivalence.",
      },
      {
        code: SHARED_REFEREE_CONTRACT_CAPABILITY_GAP,
        adapter: "08_REFEREE",
        kind: SHARED_CONTRACT_CAPABILITY_GAP,
        reason:
          "CORE-16 cannot represent Official WIN_BY_POLICY_DEFERRED without fabricating winBy.",
      },
      {
        code: SHARED_CONTRACT_CAPABILITY_GAP,
        adapter: "08_REFEREE",
        kind: EXTERNAL_DEPENDENCY,
        reason: "Shared Referee production runtime remains behind Contract A.",
      },
      ...(financeGap
        ? [
            {
              code: SHARED_CONTRACT_CAPABILITY_GAP,
              adapter: "09_FINANCE_PAYMENT",
              kind: EXTERNAL_DEPENDENCY,
              reason:
                "Finance getPaymentStatus is not wired. tournament.settings.entryFee.entryPayments is TEMPORARY_COMPATIBILITY_NONCANONICAL — not canonical Finance authority.",
              compatibility: TEMPORARY_COMPATIBILITY_NONCANONICAL,
            },
          ]
        : []),
    ]),

    async getManageAuthorizationEvidence(extra = {}) {
      if (!tenantId || !actorId) {
        return {
          ok: false,
          code: SHARED_ADAPTER_ERROR_CODE.MISSING_REQUIRED_CONTEXT,
          error: "Official/Open manage gate requires tenantId and actorId.",
        };
      }
      return safeCall(() =>
        identity.getCapabilityEvidence(
          buildContext(bound, {
            ...extra,
            tenantId,
            actorId,
            clubId,
            venueId,
            competitionId,
          })
        )
      );
    },

    async canManageOfficialOpen(extra = {}) {
      const evidence = await this.getManageAuthorizationEvidence(extra);
      if (!evidence.ok) return { ...evidence, allowed: false };
      const granted = evidence.data?.data?.grantedPermissions || [];
      const allowed = granted.includes(PERMISSIONS.TOURNAMENT_UPDATE);
      return { ok: true, allowed, evidence: evidence.data };
    },

    async resolveParticipant(playerId, extra = {}) {
      const id = trimId(playerId);
      if (!id) {
        return {
          ok: false,
          code: SHARED_ADAPTER_ERROR_CODE.MISSING_CANONICAL_IDENTITY,
          error: "Canonical playerId is required. Display name is not identity.",
        };
      }
      if (!tenantId) {
        return {
          ok: false,
          code: SHARED_ADAPTER_ERROR_CODE.MISSING_REQUIRED_CONTEXT,
          error: "Official/Open participant lookup requires tenantId.",
        };
      }
      return safeCall(() =>
        participant.resolveCanonicalParticipant(
          buildContext(bound, { ...extra, playerId: id, participantId: id })
        )
      );
    },

    async getMembershipEvidence(playerId, extra = {}) {
      if (!membershipActivated) {
        return {
          ok: true,
          inactive: true,
          status: ADAPTER_B_STATUS.CONDITIONAL_INACTIVE,
        };
      }
      return safeCall(() =>
        membership.getMembershipEvidence(
          buildContext(bound, {
            ...extra,
            playerId,
            participantId: playerId,
            clubId: extra.clubId || clubId,
          })
        )
      );
    },

    async getRatingEvidence(playerId, extra = {}) {
      if (!ratingActivated) {
        return {
          ok: true,
          inactive: true,
          status: ADAPTER_B_STATUS.CONDITIONAL_INACTIVE,
        };
      }
      if (rating.productionBinding === PRODUCTION_BINDING_STATUS.NOT_CONFIGURED) {
        return {
          ok: false,
          code: SHARED_ADAPTER_ERROR_CODE.NOT_CONFIGURED,
          error: "Rating runtime is not configured. Official/Open will not invent ratings.",
          status: ADAPTER_B_STATUS.NOT_CONFIGURED,
        };
      }
      return safeCall(() =>
        rating.getRatingSnapshot(
          buildContext(bound, { ...extra, playerId, participantId: playerId })
        )
      );
    },

    async getRankingEvidence(playerId, extra = {}) {
      if (!rankingActivated) {
        return {
          ok: true,
          inactive: true,
          status: ADAPTER_B_STATUS.CONDITIONAL_INACTIVE,
        };
      }
      return safeCall(() =>
        ranking.getRankingSnapshot(
          buildContext(bound, { ...extra, playerId, participantId: playerId })
        )
      );
    },

    async getPaymentEvidence(playerId, extra = {}) {
      if (financeGap) {
        return {
          ok: false,
          code: SHARED_CONTRACT_CAPABILITY_GAP,
          error:
            "Finance payment evidence is not safely available. Legacy entryPayments is TEMPORARY_COMPATIBILITY_NONCANONICAL — not canonical Finance authority.",
          status: ADAPTER_B_STATUS.SHARED_CONTRACT_CAPABILITY_GAP,
          compatibility: TEMPORARY_COMPATIBILITY_NONCANONICAL,
        };
      }
      return safeCall(() =>
        finance.getPaymentState(
          buildContext(bound, {
            ...extra,
            playerId,
            participantId: playerId,
            competitionId,
          })
        )
      );
    },

    async publishMatchScheduled(matchId, extra = {}) {
      return safeCall(() =>
        notification.publishCompetitionCommunicationEvent(
          buildContext(bound, {
            ...extra,
            matchId,
            eventType: "MATCH_SCHEDULED",
            idempotencyKey: extra.idempotencyKey || newCorrelationId("match-scheduled"),
          })
        )
      );
    },

    async appendAudit(action, extra = {}) {
      try {
        const result = await audit.appendAuditRecord(
          buildContext(bound, {
            ...extra,
            action,
            actorId: extra.actorId || actorId,
          })
        );
        return { ok: true, data: result };
      } catch (err) {
        return { ...captureAdapterError(err), sportingMutationBlocked: true };
      }
    },

    async getStreamingCapability(extra = {}) {
      return {
        ok: true,
        required: false,
        scoringAuthority: false,
        status: ADAPTER_B_STATUS.NOT_REQUIRED,
        code: SHARED_ADAPTER_ERROR_CODE.NOT_CONFIGURED,
        error: "Official/Open broadcast is optional. Streaming runtime is NOT_CONFIGURED.",
        contractId: streaming.contractId,
        ...extra,
      };
    },

    listEligibleCourts(input = {}) {
      const contractResult = court.listEligibleCourts({
        ...input,
        clubId: input.clubId || clubId,
        tenantId: input.tenantId || tenantId,
        venueId: input.venueId || venueId,
        competitionId: input.competitionId || competitionId,
        competitionType: input.competitionType || COMPETITION_TYPE.OFFICIAL_OPEN,
        clusterId: input.clusterId || null,
        selectedCourtIds: input.physicalCourtIds || input.selectedCourtIds,
        physicalCourtIds: input.physicalCourtIds || input.selectedCourtIds,
      });
      const courts = (contractResult.courts || []).map((row) => {
        const physicalCourtId =
          row.physicalCourtId || row.id || row.courtId || null;
        return {
          ...row,
          physicalCourtId,
          id: physicalCourtId,
          name: row.displayName || row.name || row.courtLabel || physicalCourtId,
          active: row.active !== false,
        };
      });
      return {
        ...contractResult,
        courts,
        source: "competition-court-adapter-contract-v1",
        physicalCourtIdAuthority: true,
        sharedRuntimeGap: COURT_SHARED_RUNTIME_GAP,
        sharedRuntimeGapKind: EXTERNAL_DEPENDENCY,
        sharedRuntimeGapReason:
          "Competition Court Contract A / gateway does not provide Official/Open cloud CAS occupancy equivalence.",
      };
    },
  });
}

let defaultAdapter = null;

export function getOfficialOpenAdapterB(deps = {}) {
  if (deps && Object.keys(deps).length > 0) {
    return createOfficialOpenAdapterB(deps);
  }
  if (!defaultAdapter) {
    defaultAdapter = createOfficialOpenAdapterB();
  }
  return defaultAdapter;
}

export function __resetOfficialOpenAdapterBForTests() {
  defaultAdapter = null;
}
