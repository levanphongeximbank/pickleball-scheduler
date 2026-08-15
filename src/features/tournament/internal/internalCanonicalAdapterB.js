/**
 * Internal Tournament Canonical Adapter B composition root.
 * Translate / evidence / policy / event only. Competition Core keeps authority.
 */
import {
  AUDIT_CONTRACT,
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
  SHARED_ADAPTER_ERROR_CODE,
  STREAMING_SCOREBOARD_CONTRACT,
  TENANT_ORGANIZATION_CONTRACT,
  ANALYTICS_REPORTING_CONTRACT,
  createCompetitionAdapterImplementationRegistry,
  createDefaultWorkstreamAdapters,
  failCompetitionAdapter,
} from "../../competition-engine/integration/contracts/index.js";
import {
  COMPETITION_REFEREE_ADAPTER_CONTRACT_ID,
  COMPETITION_REFEREE_MODE,
  createCompetitionRefereeAdapterRegistry,
} from "../../competition-engine/integration/referee/index.js";
import { writeAuditLog, listAuditLogs } from "../../identity/services/auditService.js";
import { resolveInternalConditionalAdapterActivation } from "./internalCanonicalAdapterActivation.js";
import { createInternalTournamentCourtAdapter } from "./InternalTournamentCourtAdapter.js";
import { createInternalTournamentRefereeAdapter } from "./InternalTournamentRefereeAdapter.js";

const FORBIDDEN_OWNED_AUTHORITY = Object.freeze([
  "eligibilityDecisionEngine",
  "seedingEngine",
  "pairingEngine",
  "drawEngine",
  "scheduleEngine",
  "courtAssignmentEngine",
  "refereeAssignmentEngine",
  "scoringEngine",
  "standingsEngine",
  "qualificationEngine",
  "knockoutEngine",
  "championEngine",
  "awardsEngine",
  "competitionLifecycleEngine",
]);

function assertNoOwnedAuthority(adapter) {
  for (const key of FORBIDDEN_OWNED_AUTHORITY) {
    if (adapter?.[key] != null) {
      failCompetitionAdapter(
        SHARED_ADAPTER_ERROR_CODE.FORBIDDEN_AUTHORITY,
        `Internal Adapter B must not own ${key}`,
        { key }
      );
    }
  }
}

function defaultAuditDeps(actor = null) {
  return {
    async append(payload = {}) {
      return writeAuditLog({
        action: payload.action || "internal.adapter.evidence",
        resourceType: payload.entityRef?.type || "tournament",
        resourceId: payload.entityRef?.id || payload.competitionId || "",
        venueId: payload.tenantId || null,
        clubId: payload.clubId || null,
        metadata: {
          correlationId: payload.correlationId || "",
          competitionId: payload.competitionId || "",
        },
        actor: actor || { id: payload.actorId },
      });
    },
    async query(payload = {}) {
      const result = await listAuditLogs({
        limit: 50,
        actorId: payload.actorId || null,
        venueId: payload.tenantId || null,
      });
      return result?.logs || result?.rows || [];
    },
  };
}

export function createInternalTournamentAdapterB(options = {}) {
  const tournament = options.tournament || null;
  const actor = options.actor || null;
  const boundTenantId = String(
    tournament?.tenantId || options.boundTenantId || ""
  ).trim() || null;
  const activation = resolveInternalConditionalAdapterActivation(tournament);

  const adapters = createDefaultWorkstreamAdapters({
    boundTenantId,
    identity: options.identity || {},
    tenant: options.tenant || {},
    participant: options.participant || {},
    membership: options.membership || {},
    rating: options.rating || {},
    ranking: options.ranking || {},
    finance: options.finance || {},
    notification: options.notification || {},
    audit: options.audit || defaultAuditDeps(actor),
  });

  const catalogRegistry = createCompetitionAdapterImplementationRegistry({
    adapters,
  });
  const rating = catalogRegistry.get(RATING_CONTRACT.contractId);
  const ranking = catalogRegistry.get(RANKING_CONTRACT.contractId);
  const finance = catalogRegistry.get(FINANCE_PAYMENT_CONTRACT.contractId);

  const court = createInternalTournamentCourtAdapter(options.courtGateway || {});
  const referee = createInternalTournamentRefereeAdapter({
    tournament,
    adapterId: options.refereeAdapterId,
  });
  const refereeRegistry = createCompetitionRefereeAdapterRegistry({
    adapters: [referee],
  });

  assertNoOwnedAuthority(court);
  assertNoOwnedAuthority(referee);

  return Object.freeze({
    kind: "internal-tournament-canonical-adapter-b",
    activation,
    catalogRegistry,
    court,
    referee,
    refereeRegistry,
    identity: catalogRegistry.get(IDENTITY_ACCESS_CONTRACT.contractId),
    tenant: catalogRegistry.get(TENANT_ORGANIZATION_CONTRACT.contractId),
    participant: catalogRegistry.get(PARTICIPANT_CONTRACT.contractId),
    membership: catalogRegistry.get(CLUB_TEAM_MEMBERSHIP_CONTRACT.contractId),
    rating,
    ranking,
    finance,
    notification: catalogRegistry.get(NOTIFICATION_COMMUNICATION_CONTRACT.contractId),
    fileMedia: catalogRegistry.get(FILE_MEDIA_CONTRACT.contractId),
    streaming: catalogRegistry.get(STREAMING_SCOREBOARD_CONTRACT.contractId),
    federation: catalogRegistry.get(FEDERATION_EXTERNAL_AUTHORITY_CONTRACT.contractId),
    crm: catalogRegistry.get(CRM_SPONSOR_CONTRACT.contractId),
    analytics: catalogRegistry.get(ANALYTICS_REPORTING_CONTRACT.contractId),
    audit: catalogRegistry.get(AUDIT_CONTRACT.contractId),
    refereeContractId: COMPETITION_REFEREE_ADAPTER_CONTRACT_ID,
    refereeMode: COMPETITION_REFEREE_MODE.INTERNAL,
    productionBindings: Object.freeze({
      identity: catalogRegistry.get(IDENTITY_ACCESS_CONTRACT.contractId)?.productionBinding,
      tenant: catalogRegistry.get(TENANT_ORGANIZATION_CONTRACT.contractId)?.productionBinding,
      participant: catalogRegistry.get(PARTICIPANT_CONTRACT.contractId)?.productionBinding,
      membership: catalogRegistry.get(CLUB_TEAM_MEMBERSHIP_CONTRACT.contractId)?.productionBinding,
      rating: rating?.productionBinding,
      ranking: ranking?.productionBinding,
      finance: finance?.productionBinding,
      audit: catalogRegistry.get(AUDIT_CONTRACT.contractId)?.productionBinding,
      court: "BOUND",
      referee: referee.wiredToProductionRuntime ? "BOUND" : "PARTIAL",
    }),
  });
}

