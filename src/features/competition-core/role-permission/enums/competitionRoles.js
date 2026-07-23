/**
 * CORE-02 competition roles — projection of Identity + competition-local actors.
 * Identity remains SoT for platform role catalog; these IDs are competition vocabulary.
 */

export const COMPETITION_ROLE = Object.freeze({
  PLATFORM_ADMIN: "PLATFORM_ADMIN",
  TENANT_OWNER: "TENANT_OWNER",
  VENUE_MANAGER: "VENUE_MANAGER",
  TOURNAMENT_MANAGER: "TOURNAMENT_MANAGER",
  TEAM_CAPTAIN: "TEAM_CAPTAIN",
  CLUB_MANAGER: "CLUB_MANAGER",
  REFEREE: "REFEREE",
  PLAYER: "PLAYER",
  STAFF: "STAFF",
  SYSTEM: "SYSTEM",
  BTC: "BTC",
  UNKNOWN: "UNKNOWN",
});

export const COMPETITION_ROLE_VALUES = Object.freeze(
  Object.values(COMPETITION_ROLE)
);

/**
 * @param {unknown} value
 * @returns {boolean}
 */
export function isCompetitionRole(value) {
  return COMPETITION_ROLE_VALUES.includes(String(value || ""));
}

/**
 * @param {unknown} value
 * @returns {string}
 */
export function normalizeCompetitionRole(value) {
  const raw = String(value || "").trim();
  if (!raw) return COMPETITION_ROLE.UNKNOWN;
  if (raw === "SUPER_ADMIN" || raw === "ADMIN") return COMPETITION_ROLE.PLATFORM_ADMIN;
  if (raw === "COURT_OWNER" || raw === "VENUE_OWNER" || raw === "OWNER") {
    return COMPETITION_ROLE.TENANT_OWNER;
  }
  if (raw === "COURT_MANAGER") return COMPETITION_ROLE.VENUE_MANAGER;
  if (raw === "CAPTAIN") return COMPETITION_ROLE.TEAM_CAPTAIN;
  if (isCompetitionRole(raw)) return raw;
  return COMPETITION_ROLE.UNKNOWN;
}
