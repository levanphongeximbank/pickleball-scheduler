/**
 * Core-05 — in-memory Team / Roster / Snapshot repository.
 * Isolated instances per test. No browser storage, Supabase, RPC, or SQL.
 */

import { createCompetitionTeam, createCompetitionRoster } from "../../participants/contracts/teamRosterLineup.js";
import { createTeamRosterSnapshot } from "../contracts/rosterSnapshot.js";
import { formatParticipantReferenceToken } from "../contracts/rosterMemberIdentity.js";
import { COMPETITION_ROSTER_MEMBER_STATUS } from "../../participants/enums/statuses.js";

/**
 * @param {unknown} value
 * @returns {unknown}
 */
function deepFreezeClone(value) {
  if (value == null || typeof value !== "object") return value;
  if (Array.isArray(value)) {
    return Object.freeze(value.map((item) => deepFreezeClone(item)));
  }
  /** @type {Record<string, unknown>} */
  const out = {};
  for (const key of Object.keys(value)) {
    out[key] = deepFreezeClone(/** @type {Record<string, unknown>} */ (value)[key]);
  }
  return Object.freeze(out);
}

/**
 * @param {unknown} person
 * @returns {string}
 */
function personToken(person) {
  return formatParticipantReferenceToken(person) || "";
}

/**
 * Division scope key for membership index.
 * @param {{ competitionId?: string, divisionId?: string|null, divisionCategoryId?: string|null }} scope
 */
function divisionScopeKey(scope) {
  const competitionId = String(scope.competitionId || "").trim();
  const divisionId = scope.divisionId != null ? String(scope.divisionId).trim() : "";
  const divisionCategoryId =
    scope.divisionCategoryId != null ? String(scope.divisionCategoryId).trim() : "";
  return `${competitionId}::div:${divisionId}::dc:${divisionCategoryId}`;
}

/**
 * @returns {import('./inMemoryTeamRosterRepository.js').InMemoryTeamRosterRepository}
 */
export function createInMemoryTeamRosterRepository() {
  /** @type {Map<string, unknown>} */
  const teamsById = new Map();
  /** @type {Map<string, unknown>} */
  const rostersByTeamId = new Map();
  /** @type {Map<string, unknown>} */
  const snapshotsById = new Map();
  /** @type {Map<string, Map<string, string>>} */
  // scopeKey -> (personToken -> teamId) for ACTIVE members only
  const activeMembership = new Map();

  function rebuildMembershipIndex() {
    activeMembership.clear();
    for (const roster of rostersByTeamId.values()) {
      if (!roster || typeof roster !== "object") continue;
      const r = /** @type {Record<string, unknown>} */ (roster);
      const team = teamsById.get(String(r.teamId || ""));
      const t = team && typeof team === "object" ? /** @type {Record<string, unknown>} */ (team) : {};
      const scope = divisionScopeKey({
        competitionId: String(r.competitionId || t.competitionId || ""),
        divisionId: r.divisionId ?? t.divisionId ?? null,
        divisionCategoryId: r.divisionCategoryId ?? t.divisionCategoryId ?? null,
      });
      if (!activeMembership.has(scope)) activeMembership.set(scope, new Map());
      const map = activeMembership.get(scope);
      const members = Array.isArray(r.members) ? r.members : [];
      for (const member of members) {
        if (!member || typeof member !== "object") continue;
        const m = /** @type {Record<string, unknown>} */ (member);
        if (String(m.status) !== COMPETITION_ROSTER_MEMBER_STATUS.ACTIVE) continue;
        const token = personToken(m.person);
        if (!token) continue;
        map.set(token, String(r.teamId));
      }
    }
  }

  return {
    reset() {
      teamsById.clear();
      rostersByTeamId.clear();
      snapshotsById.clear();
      activeMembership.clear();
    },

    async saveTeam(team) {
      const normalized = createCompetitionTeam(team || {});
      if (!normalized.id) throw new TypeError("saveTeam requires team.id");
      teamsById.set(normalized.id, deepFreezeClone(normalized));
      return deepFreezeClone(normalized);
    },

    async getTeam(teamId) {
      const id = String(teamId || "").trim();
      if (!id) return null;
      const found = teamsById.get(id);
      return found ? deepFreezeClone(found) : null;
    },

    async listTeams(filter = {}) {
      const competitionId = filter.competitionId != null ? String(filter.competitionId).trim() : "";
      const tenantId = filter.tenantId != null ? String(filter.tenantId).trim() : "";
      const divisionId = filter.divisionId != null ? String(filter.divisionId).trim() : "";
      const divisionCategoryId =
        filter.divisionCategoryId != null ? String(filter.divisionCategoryId).trim() : "";

      return [...teamsById.values()]
        .filter((raw) => {
          const team = /** @type {Record<string, unknown>} */ (raw);
          if (competitionId && String(team.competitionId || "") !== competitionId) return false;
          if (tenantId && String(team.tenantId || "") !== tenantId) return false;
          if (divisionId && String(team.divisionId || "") !== divisionId) return false;
          if (divisionCategoryId && String(team.divisionCategoryId || "") !== divisionCategoryId) {
            return false;
          }
          return true;
        })
        .map((t) => deepFreezeClone(t))
        .sort((a, b) => {
          const left = String(/** @type {{ id?: string }} */ (a).id || "");
          const right = String(/** @type {{ id?: string }} */ (b).id || "");
          return left < right ? -1 : left > right ? 1 : 0;
        });
    },

    async saveRoster(roster, options = {}) {
      const normalized = createCompetitionRoster(roster || {});
      if (!normalized.teamId) throw new TypeError("saveRoster requires roster.teamId");
      const expectedVersion =
        typeof options.expectedVersion === "number" ? options.expectedVersion : null;
      const existing = rostersByTeamId.get(normalized.teamId);
      if (expectedVersion != null && existing && typeof existing === "object") {
        const current =
          typeof /** @type {{ rosterVersion?: number }} */ (existing).rosterVersion === "number"
            ? /** @type {{ rosterVersion: number }} */ (existing).rosterVersion
            : 0;
        if (current !== expectedVersion) {
          const err = new Error("VERSION_CONFLICT");
          err.code = "VERSION_CONFLICT";
          err.details = { expectedVersion, currentVersion: current, teamId: normalized.teamId };
          throw err;
        }
      }
      rostersByTeamId.set(normalized.teamId, deepFreezeClone(normalized));
      rebuildMembershipIndex();
      return deepFreezeClone(normalized);
    },

    async getRosterByTeamId(teamId) {
      const id = String(teamId || "").trim();
      if (!id) return null;
      const found = rostersByTeamId.get(id);
      return found ? deepFreezeClone(found) : null;
    },

    /**
     * Find active team id for person in competition+division scope.
     */
    async findActiveMembership(scope) {
      const token = String(scope?.personToken || "").trim();
      if (!token) return null;
      const key = divisionScopeKey(scope || {});
      const map = activeMembership.get(key);
      if (!map) return null;
      const teamId = map.get(token);
      return teamId ? String(teamId) : null;
    },

    async saveSnapshot(snapshot) {
      const normalized = createTeamRosterSnapshot(snapshot || {});
      if (!normalized.id) throw new TypeError("saveSnapshot requires snapshot.id");
      snapshotsById.set(normalized.id, deepFreezeClone(normalized));
      return deepFreezeClone(normalized);
    },

    async getSnapshot(snapshotId) {
      const id = String(snapshotId || "").trim();
      if (!id) return null;
      const found = snapshotsById.get(id);
      return found ? deepFreezeClone(found) : null;
    },

    async listSnapshotsByTeamId(teamId) {
      const id = String(teamId || "").trim();
      return [...snapshotsById.values()]
        .filter((s) => String(/** @type {{ teamId?: string }} */ (s).teamId || "") === id)
        .map((s) => deepFreezeClone(s))
        .sort((a, b) => {
          const va = /** @type {{ rosterVersion?: number }} */ (a).rosterVersion || 0;
          const vb = /** @type {{ rosterVersion?: number }} */ (b).rosterVersion || 0;
          return va - vb;
        });
    },
  };
}

/**
 * @typedef {ReturnType<typeof createInMemoryTeamRosterRepository>} InMemoryTeamRosterRepository
 */
