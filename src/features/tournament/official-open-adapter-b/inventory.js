/**
 * B0 → B1 Official/Open external-domain dependency inventory.
 * Competition Core internal calls are VALID_INTERNAL_DEPENDENCY.
 */

import { BYPASS_CLASSIFICATION } from "./constants.js";

export const OFFICIAL_OPEN_DIRECT_DOMAIN_INVENTORY = Object.freeze([
  {
    surface: "TournamentManageGate + OfficialTournamentSetup can(PERMISSIONS.TOURNAMENT_UPDATE)",
    domain: "01 Identity & Access",
    classification: BYPASS_CLASSIFICATION.NEEDS_ADOPTION,
    remediation: "evaluateOfficialOpenManageAccess via Identity Access Contract resolver",
  },
  {
    surface: "OfficialTournamentSetup tenantId = activeClub.venueId fallback",
    domain: "02 Tenant & Organization",
    classification: BYPASS_CLASSIFICATION.LEGACY_TO_REMOVE,
    remediation: "resolveOfficialOpenTenantScope — never infer tenantId from venueId",
  },
  {
    surface: "Player picker / registration player.id",
    domain: "03 Participant",
    classification: BYPASS_CLASSIFICATION.NEEDS_ADOPTION,
    remediation: "Adapter B resolveParticipant at external-domain boundary",
  },
  {
    surface: "eligibilityEngine player.clubId/homeClubId",
    domain: "04 Club / Team / Membership",
    classification: BYPASS_CLASSIFICATION.NEEDS_ADOPTION,
    remediation: "canonical membership evidence when clubMembership.enabled",
  },
  {
    surface: "eligibilityEngine getPlayerDisplayRating / AI pairing player.rating",
    domain: "05 Rating",
    classification: BYPASS_CLASSIFICATION.NEEDS_ADOPTION,
    remediation: "Rating Contract when activation predicate A/B/C; OPEN pairing stays rating-neutral",
  },
  {
    surface: "OfficialTournamentSetup TournamentVprPanel",
    domain: "06 Ranking",
    classification: BYPASS_CLASSIFICATION.VALID_INTERNAL_DEPENDENCY,
    note: "Tournament classification metadata, not player ranking for OPEN pairing/draw",
  },
  {
    surface: "resolveTournamentCourtInventoryScope + tournamentBookingService canonical occupancy",
    domain: "07 Court",
    classification: BYPASS_CLASSIFICATION.ALREADY_CANONICAL,
    remediation: "Reuse existing Official/Open court adoption; compose courtResourceCompetitionAdapter",
  },
  {
    surface: "officialOpenLifecycleCommands + OfficialTournamentRefereeOps",
    domain: "08 Referee",
    classification: BYPASS_CLASSIFICATION.ALREADY_CANONICAL,
    remediation: "Reuse existing Official/Open referee lifecycle; OfficialTournamentRefereeAdapter translator",
  },
  {
    surface: "tournament.settings.entryFee.entryPayments",
    domain: "09 Finance & Payment",
    classification: BYPASS_CLASSIFICATION.NEEDS_ADOPTION,
    remediation: "SHARED_CONTRACT_CAPABILITY_GAP — Finance runtime not wired to Tournament",
  },
  {
    surface: "publishScheduleEngine notifyMatchScheduledAfterPublish",
    domain: "10 Notification",
    classification: BYPASS_CLASSIFICATION.ALREADY_CANONICAL,
    remediation: "MATCH_SCHEDULED already on Notification Contract; Adapter B reuses it",
  },
  {
    surface: "File / Media",
    domain: "11 File & Media",
    classification: BYPASS_CLASSIFICATION.NOT_REQUIRED,
  },
  {
    surface: "OfficialTournamentSetup tournament-broadcast",
    domain: "12 Streaming & Scoreboard",
    classification: BYPASS_CLASSIFICATION.NEEDS_ADOPTION,
    remediation: "Projection-only; scoring stays Competition. Runtime not configured on contract binding.",
  },
  {
    surface: "Federation",
    domain: "13 Federation",
    classification: BYPASS_CLASSIFICATION.NOT_REQUIRED,
  },
  {
    surface: "CRM / Sponsor",
    domain: "14 CRM & Sponsor",
    classification: BYPASS_CLASSIFICATION.NOT_REQUIRED,
  },
  {
    surface: "Analytics / Reporting",
    domain: "15 Analytics",
    classification: BYPASS_CLASSIFICATION.NOT_REQUIRED,
  },
  {
    surface: "identity auditService + tournament.settings.*AuditLog arrays",
    domain: "16 Audit",
    classification: BYPASS_CLASSIFICATION.NEEDS_ADOPTION,
    remediation: "Audit Contract with Identity writeAuditLog compatibility sink; do not drop events",
  },
  {
    surface: "officialTournamentEngine / eligibilityEngine / scheduleEngine / standings",
    domain: "Competition Core",
    classification: BYPASS_CLASSIFICATION.VALID_INTERNAL_DEPENDENCY,
  },
]);

export function summarizeOfficialOpenBypassInventory() {
  const remaining = OFFICIAL_OPEN_DIRECT_DOMAIN_INVENTORY.filter((row) =>
    [BYPASS_CLASSIFICATION.NEEDS_ADOPTION, BYPASS_CLASSIFICATION.LEGACY_TO_REMOVE].includes(
      row.classification
    )
  );
  return Object.freeze({
    total: OFFICIAL_OPEN_DIRECT_DOMAIN_INVENTORY.length,
    remaining: remaining.map((row) => row.surface),
    inventory: OFFICIAL_OPEN_DIRECT_DOMAIN_INVENTORY,
  });
}
