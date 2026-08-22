/**
 * Official/Open Adapter B — final runtime inventory.
 * Compatibility is allowed only when explicitly noncanonical and behind Contract A.
 */

import { BYPASS_CLASSIFICATION } from "./constants.js";

export const OFFICIAL_OPEN_DIRECT_DOMAIN_INVENTORY = Object.freeze([
  {
    surface: "TournamentManageGate + evaluateOfficialOpenManageAccess",
    domain: "01 Identity & Access",
    classification: BYPASS_CLASSIFICATION.CANONICAL_VIA_ADAPTER_B,
    note: "Competition authorization uses Identity Access Contract. canViewPlayerSkillLevel and session fingerprints remain Identity UI/session primitives.",
  },
  {
    surface: "canViewPlayerSkillLevel / buildAuthorizationPrincipalFingerprint",
    domain: "01 Identity & Access",
    classification: BYPASS_CLASSIFICATION.VALID_INTERNAL_DEPENDENCY,
    note: "Picker display and load-policy session primitives — not competition authorization.",
  },
  {
    surface: "resolveOfficialOpenTenantScope",
    domain: "02 Tenant & Organization",
    classification: BYPASS_CLASSIFICATION.CANONICAL_VIA_ADAPTER_B,
    note: "tenantId != venueId != clubId != organizationId. organizationId remains NOT_CONFIGURED.",
  },
  {
    surface: "Adapter B resolveParticipant (playerId / canonicalPlayerId)",
    domain: "03 Participant",
    classification: BYPASS_CLASSIFICATION.CANONICAL_VIA_ADAPTER_B,
    note: "Player picker may display existing player data. Competition evidence uses canonical playerId.",
  },
  {
    surface: "eligibilityEngine canonical membership evidence",
    domain: "04 Club / Team / Membership",
    classification: BYPASS_CLASSIFICATION.CANONICAL_VIA_ADAPTER_B,
    note: "Activated only when clubMembership.enabled. player.clubId/homeClubId is not authoritative when active.",
  },
  {
    surface: "Adapter B getRatingEvidence + OPEN rating-neutral pairing/draw",
    domain: "05 Rating",
    classification: BYPASS_CLASSIFICATION.CANONICAL_VIA_ADAPTER_B,
    note: "Activation A/B/C. Runtime unavailable → NOT_CONFIGURED. AI Balance pairing engine remains pairing authority.",
  },
  {
    surface: "OfficialTournamentSetup TournamentVprPanel",
    domain: "06 Ranking",
    classification: BYPASS_CLASSIFICATION.NOT_REQUIRED,
    note: "Tournament classification/display only. Not ranking authority for pairing/draw/qualification.",
  },
  {
    surface: "Official/Open Court Adapter B → Competition Court Adapter Contract V1",
    domain: "07 Court",
    classification: BYPASS_CLASSIFICATION.CANONICAL_VIA_ADAPTER_B,
    note: "physicalCourtId is canonical identity. Cloud CAS/occupancy equivalence is COURT_SHARED_RUNTIME_GAP=EXTERNAL_DEPENDENCY.",
  },
  {
    surface: "officialOpenLifecycleCommands + OfficialTournamentRefereeOps",
    domain: "08 Referee",
    classification: BYPASS_CLASSIFICATION.VALID_INTERNAL_DEPENDENCY,
    note: "Tournament domain lifecycle / organizer UI. External referee contract is OfficialTournamentRefereeAdapter.",
  },
  {
    surface: "OfficialTournamentRefereeAdapter → competition.referee.adapter.v1",
    domain: "08 Referee",
    classification: BYPASS_CLASSIFICATION.CANONICAL_VIA_ADAPTER_B,
    note: "Does not invent winBy=2. CORE-16 deferred win-by is SHARED_REFEREE_CONTRACT_CAPABILITY_GAP. Shared runtime is EXTERNAL_DEPENDENCY.",
  },
  {
    surface: "Competition Finance & Payment Contract",
    domain: "09 Finance & Payment",
    classification: BYPASS_CLASSIFICATION.CANONICAL_VIA_ADAPTER_B,
    note: "getPaymentStatus unavailable → SHARED_CONTRACT_CAPABILITY_GAP. Runtime is EXTERNAL_DEPENDENCY.",
  },
  {
    surface: "tournament.settings.entryFee.entryPayments",
    domain: "09 Finance & Payment",
    classification: BYPASS_CLASSIFICATION.TEMPORARY_COMPATIBILITY_NONCANONICAL,
    note: "Compatibility state only. Not canonical Finance authority. Not deleted before shared Finance cutover.",
  },
  {
    surface: "publishScheduleEngine Official MATCH_SCHEDULED via Adapter B publishMatchScheduled",
    domain: "10 Notification",
    classification: BYPASS_CLASSIFICATION.CANONICAL_VIA_ADAPTER_B,
    note: "Delivery failure must not mutate sporting state. Implementation behind Contract A may remain.",
  },
  {
    surface: "File / Media",
    domain: "11 File & Media",
    classification: BYPASS_CLASSIFICATION.NOT_REQUIRED,
  },
  {
    surface: "OfficialTournamentSetup tournament-broadcast (optional UI)",
    domain: "12 Streaming & Scoreboard",
    classification: BYPASS_CLASSIFICATION.NOT_REQUIRED,
    note: "Optional presentation. Not scoring authority. Shared streaming runtime NOT_CONFIGURED.",
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
    surface: "Adapter B appendAudit → Competition Audit Contract",
    domain: "16 Audit",
    classification: BYPASS_CLASSIFICATION.CANONICAL_VIA_ADAPTER_B,
    note: "Identity writeAuditLog is the Audit Contract compatibility sink. Append failure does not mutate sporting state.",
  },
  {
    surface: "tournament.settings.*AuditLog arrays",
    domain: "16 Audit",
    classification: BYPASS_CLASSIFICATION.TEMPORARY_COMPATIBILITY_BEHIND_CANONICAL_BOUNDARY,
    note: "Competition history / compatibility. Not external Audit authority.",
  },
  {
    surface: "officialTournamentEngine / eligibilityEngine / scheduleEngine / standings",
    domain: "Competition Core",
    classification: BYPASS_CLASSIFICATION.VALID_INTERNAL_DEPENDENCY,
  },
]);

export function summarizeOfficialOpenBypassInventory() {
  const forbidden = OFFICIAL_OPEN_DIRECT_DOMAIN_INVENTORY.filter(
    (row) => row.classification === BYPASS_CLASSIFICATION.FORBIDDEN_BYPASS
  );
  return Object.freeze({
    total: OFFICIAL_OPEN_DIRECT_DOMAIN_INVENTORY.length,
    forbiddenBypassCount: forbidden.length,
    remaining: forbidden.map((row) => row.surface),
    inventory: OFFICIAL_OPEN_DIRECT_DOMAIN_INVENTORY,
  });
}
