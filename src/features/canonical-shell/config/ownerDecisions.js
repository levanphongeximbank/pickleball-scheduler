import { CANONICAL_MENU_DATA } from "./canonicalMenuData.js";

/**
 * Owner decisions B01–B03 — Phase 4 recorded approvals bind runtime authority.
 * See docs/ui-ux/canonical-navigation/phase4/PHASE4_OWNER_DECISIONS_RECORDED.md
 */
export const OWNER_DECISIONS = Object.freeze(CANONICAL_MENU_DATA.ownerDecisions);

/** Canonical Communication / Messaging Experience (COMMS). */
export const B01_MESSAGING_EXPERIENCE_ROUTE = "/messages";
/** Canonical CRM outreach messages. */
export const B01_CRM_MESSAGES_ROUTE = "/crm/messages";

/** @deprecated Phase 1 name — CRM canonical route. Prefer B01_CRM_MESSAGES_ROUTE. */
export const B01_CANONICAL_MESSAGES_ROUTE = B01_CRM_MESSAGES_ROUTE;
/** @deprecated Phase 1 name — now dual-canonical communication route, not a redirect legacy. */
export const B01_LEGACY_MESSAGES_ROUTE = B01_MESSAGING_EXPERIENCE_ROUTE;

export const B02_CANONICAL_TOURNAMENT_PREFIX = "/tournaments/";
export const B02_LEGACY_TOURNAMENT_PREFIX = "/tournament/";

/**
 * Wave 1 Owner-approved exception to B02's generic menu hiding.
 *
 * The routes remain retained `/tournament/*` authority. This allowlist grants
 * menu exposure only; it neither redirects nor changes route/RBAC ownership.
 */
export const B02_TOURNAMENT_HUB_MENU_ALLOWLIST = Object.freeze([
  "/tournament",
  "/tournament/list",
  "/tournament/create",
  "/tournament/types",
  "/tournament/roster",
  "/tournament/register",
  "/tournament/organize",
  "/tournament/operations",
  "/tournament/results",
  "/tournament/config",
  "/tournament/my",
]);

export const B03_SHADOW_SKILL_ASSESSMENT_V5 = "/player/skill-assessment-v5";
export const B03_CANONICAL_SKILL_ASSESSMENT = "/player/skill-assessment";

export const PHASE2_QA_ROLES = Object.freeze([
  "SUPER_ADMIN",
  "VENUE_OWNER",
  "VENUE_MANAGER",
  "CASHIER",
  "CLUB_OWNER",
  "CLUB_MANAGER",
  "COACH",
  "REFEREE",
  "PLAYER",
  "SYSTEM_TECHNICIAN",
]);
