import { CANONICAL_MENU_DATA } from "./canonicalMenuData.js";

/** Owner decisions B01–B03 — Phase 1 authority, preserved in Phase 2 foundation. */
export const OWNER_DECISIONS = Object.freeze(CANONICAL_MENU_DATA.ownerDecisions);

export const B01_CANONICAL_MESSAGES_ROUTE = "/crm/messages";
export const B01_LEGACY_MESSAGES_ROUTE = "/messages";

export const B02_CANONICAL_TOURNAMENT_PREFIX = "/tournaments/";
export const B02_LEGACY_TOURNAMENT_PREFIX = "/tournament/";

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
