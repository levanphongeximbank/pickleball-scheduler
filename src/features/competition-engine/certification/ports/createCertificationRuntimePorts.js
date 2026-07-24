/**
 * E2E-07 certification runtime ports — wraps E2E-01 composition root.
 */

import { PERMISSIONS } from "../../../identity/constants/permissions.js";
import { createCompetitionRuntimePorts } from "../../integration/composition/createCompetitionRuntimePorts.js";
import { E2E07_PLAYER_IDS } from "../fixtures/individualPoolKnockoutScenario.js";

/**
 * @param {string} role
 * @returns {readonly string[]}
 */
function permissionsForRole(role) {
  const normalized = String(role || "").toUpperCase();
  if (normalized === "PLAYER") {
    return [
      PERMISSIONS.TOURNAMENT_VIEW,
      PERMISSIONS.PLAYER_UPDATE,
      PERMISSIONS.STATISTICS_VIEW,
      PERMISSIONS.PLAYER_VIEW,
    ];
  }
  if (normalized === "REFEREE") {
    return [
      PERMISSIONS.TOURNAMENT_VIEW,
      PERMISSIONS.MATCH_UPDATE,
      PERMISSIONS.TEAM_MATCH_RESULT_MANAGE,
      PERMISSIONS.STATISTICS_VIEW,
    ];
  }
  if (normalized === "CASHIER" || normalized === "UNKNOWN") {
    return [];
  }
  if (normalized === "TOURNAMENT_MANAGER") {
    return [
      PERMISSIONS.TOURNAMENT_VIEW,
      PERMISSIONS.TOURNAMENT_UPDATE,
      PERMISSIONS.DIRECTOR_USE,
      PERMISSIONS.MATCH_UPDATE,
      PERMISSIONS.SCHEDULING_RUN,
      PERMISSIONS.TOURNAMENT_CERTIFY,
    ];
  }
  return [PERMISSIONS.TOURNAMENT_VIEW];
}

/**
 * @param {object} [deps]
 */
export function createCertificationRuntimePorts(deps = {}) {
  const baseDeps = deps.runtimePortDeps || deps;
  const identityOverride = baseDeps.identity || {};

  return createCompetitionRuntimePorts({
    ...baseDeps,
    identity: {
      getPermissionsForRole: (role) => {
        if (typeof identityOverride.getPermissionsForRole === "function") {
          return identityOverride.getPermissionsForRole(role);
        }
        return permissionsForRole(role);
      },
      ...(identityOverride.actorId ? { actorId: identityOverride.actorId } : {}),
    },
    participantLookupPort: {
      resolveParticipantSnapshot(playerId) {
        const id = String(playerId || "").trim();
        if (!id || !E2E07_PLAYER_IDS.includes(id)) {
          return { ok: false, code: "NOT_FOUND", participant: null };
        }
        const index = E2E07_PLAYER_IDS.indexOf(id);
        return {
          ok: true,
          participant: {
            id,
            status: "ACTIVE",
            reference: { id },
            profileSnapshot: {
              playerId: id,
              displayName: `Player ${index + 1}`,
              seedNumber: index + 1,
            },
          },
          reasonCodes: [],
        };
      },
      async getByIds(ids = []) {
        return ids
          .map((id) => String(id || "").trim())
          .filter((id) => E2E07_PLAYER_IDS.includes(id))
          .map((id) => ({ id, status: "ACTIVE" }));
      },
      ...(baseDeps.participantLookupPort || {}),
    },
  });
}
