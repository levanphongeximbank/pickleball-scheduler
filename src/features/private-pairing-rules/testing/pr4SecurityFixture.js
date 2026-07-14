/**
 * Minimal fixture schema for PR-4 security matrix tests (in-memory / docs only).
 * Never insert real user PII into migration files.
 */
export const PRIVATE_PAIRING_PR4_FIXTURE = Object.freeze({
  tenants: {
    A: "tenant-a",
    B: "tenant-b",
  },
  actors: {
    superAdminA: { id: "sa-a", role: "SUPER_ADMIN", tenantId: "tenant-a" },
    superAdminB: { id: "sa-b", role: "SUPER_ADMIN", tenantId: "tenant-b" },
    clubOwnerA: { id: "co-a", role: "CLUB_OWNER", tenantId: "tenant-a" },
    tournamentDirectorA: { id: "td-a", role: "TOURNAMENT_DIRECTOR", tenantId: "tenant-a" },
    refereeA: { id: "ref-a", role: "REFEREE", tenantId: "tenant-a" },
    playerA1: { id: "player-a1", role: "PLAYER", tenantId: "tenant-a" },
    technicianA: { id: "tech-a", role: "SYSTEM_TECHNICIAN", tenantId: "tenant-a" },
  },
  players: {
    A1: "player-a1",
    A2: "player-a2",
    A3: "player-a3",
    B1: "player-b1",
  },
  blockedRoles: Object.freeze([
    "SYSTEM_TECHNICIAN",
    "TECHNICIAN",
    "TOURNAMENT_DIRECTOR",
    "COURT_OWNER",
    "VENUE_MANAGER",
    "CLUB_OWNER",
    "CLUB_MANAGER",
    "COACH",
    "REFEREE",
    "PLAYER",
  ]),
  allowedRoles: Object.freeze(["SUPER_ADMIN", "PLATFORM_ADMIN"]),
  permissions: Object.freeze([
    "pairing.private_rules.view",
    "pairing.private_rules.manage",
    "pairing.private_rules.audit",
    "pairing.private_rules.simulate",
  ]),
});
