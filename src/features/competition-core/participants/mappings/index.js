import { PARTICIPANT_SCHEMA_VERSION } from "../contracts/shared.js";
import {
  createCompetitionParticipant,
  createCompetitionEntry,
  createCompetitionTeam,
  createCompetitionRoster,
  createCompetitionRosterMember,
  createCompetitionLineup,
  createCompetitionLineupSlot,
  createCompetitionDivision,
  createCompetitionCategory,
  createParticipantReference,
} from "../contracts/index.js";
import { PARTICIPANT_REFERENCE_KIND } from "../enums/identityKinds.js";
import {
  validateCompetitionParticipant,
  validateCompetitionEntry,
  validateCompetitionTeam,
  validateCompetitionRoster,
  validateCompetitionLineup,
  validateDivision,
  validateCategory,
} from "../validators/index.js";
import { validationFail, validationError, validationOk } from "../results/validationResult.js";
import { PARTICIPANT_ERROR_CODE } from "../errors/errorCodes.js";

/**
 * @typedef {Object} MappingDiagnostics
 * @property {string[]} notes
 * @property {Record<string, unknown>} [meta]
 */

/**
 * @typedef {Object} ParticipantMappingInterface
 * @property {string} sourceType
 * @property {string} sourceVersion
 * @property {string} targetSchemaVersion
 * @property {(source: unknown) => unknown} map
 * @property {(source: unknown) => import('../results/validationResult.js').ParticipantValidationResult} validateSource
 * @property {(target: unknown) => import('../results/validationResult.js').ParticipantValidationResult} validateTarget
 * @property {(source: unknown, target: unknown) => MappingDiagnostics} diagnostics
 */

/**
 * @param {Partial<ParticipantMappingInterface>} partial
 * @returns {ParticipantMappingInterface}
 */
export function createMappingInterface(partial) {
  if (!partial || typeof partial.map !== "function") {
    throw new TypeError("createMappingInterface requires map()");
  }
  return {
    sourceType: String(partial.sourceType || "unknown"),
    sourceVersion: String(partial.sourceVersion || "legacy"),
    targetSchemaVersion: String(partial.targetSchemaVersion || PARTICIPANT_SCHEMA_VERSION),
    map: partial.map,
    validateSource:
      partial.validateSource ||
      (() => validationOk()),
    validateTarget:
      partial.validateTarget ||
      (() => validationOk()),
    diagnostics:
      partial.diagnostics ||
      (() => ({ notes: [], meta: {} })),
  };
}

/** Fixture mapper: legacy player-like object → CompetitionParticipant (shadow only). */
export const legacyPlayerToParticipantMapper = createMappingInterface({
  sourceType: "LegacyPlayer",
  sourceVersion: "club-blob-v3",
  targetSchemaVersion: PARTICIPANT_SCHEMA_VERSION,
  validateSource(source) {
    if (!source || typeof source !== "object" || !source.id) {
      return validationFail([
        validationError(PARTICIPANT_ERROR_CODE.REQUIRED, "id", "Legacy player id required"),
      ]);
    }
    return validationOk();
  },
  map(source) {
    const kind =
      source.playerType === "guest" || source.isGuest
        ? PARTICIPANT_REFERENCE_KIND.GUEST
        : PARTICIPANT_REFERENCE_KIND.PLAYER_PROFILE;
    return createCompetitionParticipant({
      id: `cp:${source.id}`,
      competitionId: String(source.competitionId || source.tournamentId || ""),
      displayName: source.name || source.displayName || null,
      person: createParticipantReference({
        kind,
        id: String(source.id),
        displayNameSnapshot: source.name || null,
      }),
      status: "ACTIVE",
    });
  },
  validateTarget: validateCompetitionParticipant,
  diagnostics(source, target) {
    return {
      notes: ["shadow fixture mapper — not wired to Production"],
      meta: { sourceId: source?.id, targetId: target?.id },
    };
  },
});

export const legacyEntryToEntryMapper = createMappingInterface({
  sourceType: "LegacyEntry",
  sourceVersion: "tournament-entry-v1",
  targetSchemaVersion: PARTICIPANT_SCHEMA_VERSION,
  validateSource(source) {
    if (!source || !source.id) {
      return validationFail([
        validationError(PARTICIPANT_ERROR_CODE.REQUIRED, "id", "Legacy entry id required"),
      ]);
    }
    return validationOk();
  },
  map(source) {
    const playerIds = Array.isArray(source.playerIds) ? source.playerIds : [];
    return createCompetitionEntry({
      id: String(source.id),
      competitionId: String(source.tournamentId || source.competitionId || ""),
      status: String(source.status || "DRAFT").toUpperCase() === "APPROVED" ? "APPROVED" : "DRAFT",
      divisionId: source.groupId || source.divisionId || null,
      categoryId: source.eventId || source.categoryId || null,
      entryRole: source.pairType || source.entryRole || null,
      name: source.name || null,
      memberRefs: playerIds.map((id) =>
        createParticipantReference({
          kind: PARTICIPANT_REFERENCE_KIND.PLAYER_PROFILE,
          id: String(id),
        })
      ),
    });
  },
  validateTarget: validateCompetitionEntry,
  diagnostics() {
    return { notes: ["waitlist fields intentionally omitted — owned by Registration (OD-10)"] };
  },
});

export const legacyTeamToTeamMapper = createMappingInterface({
  sourceType: "LegacyTeam",
  sourceVersion: "team-tournament-v6",
  targetSchemaVersion: PARTICIPANT_SCHEMA_VERSION,
  validateSource(source) {
    if (!source?.id) {
      return validationFail([
        validationError(PARTICIPANT_ERROR_CODE.REQUIRED, "id", "Legacy team id required"),
      ]);
    }
    return validationOk();
  },
  map(source) {
    return createCompetitionTeam({
      id: String(source.id),
      competitionId: String(source.tournamentId || source.competitionId || ""),
      name: String(source.name || ""),
      status: "ACTIVE",
      seed: typeof source.seed === "number" ? source.seed : null,
      captainRef: source.captainPlayerId
        ? createParticipantReference({
            kind: PARTICIPANT_REFERENCE_KIND.PLAYER_PROFILE,
            id: String(source.captainPlayerId),
          })
        : null,
    });
  },
  validateTarget: validateCompetitionTeam,
  diagnostics() {
    return { notes: ["shadow TT team mapper"] };
  },
});

export const legacyRosterToRosterMapper = createMappingInterface({
  sourceType: "LegacyRoster",
  sourceVersion: "team-tournament-v6",
  targetSchemaVersion: PARTICIPANT_SCHEMA_VERSION,
  validateSource(source) {
    if (!source?.teamId && !source?.id) {
      return validationFail([
        validationError(PARTICIPANT_ERROR_CODE.REQUIRED, "teamId", "team id required"),
      ]);
    }
    return validationOk();
  },
  map(source) {
    const teamId = String(source.teamId || source.id || "");
    const playerIds = Array.isArray(source.playerIds) ? source.playerIds : [];
    return createCompetitionRoster({
      id: `roster:${teamId}`,
      competitionId: String(source.tournamentId || source.competitionId || ""),
      teamId,
      status: source.locked ? "ROSTER_LOCKED" : "DRAFT",
      lockedAt: source.lockedAt || null,
      members: playerIds.map((id, index) =>
        createCompetitionRosterMember({
          id: `rm:${teamId}:${id}`,
          rosterId: `roster:${teamId}`,
          person: createParticipantReference({
            kind: PARTICIPANT_REFERENCE_KIND.PLAYER_PROFILE,
            id: String(id),
          }),
          status: "ACTIVE",
          role: index === 0 && source.captainPlayerId === id ? "captain" : "player",
        })
      ),
    });
  },
  validateTarget: validateCompetitionRoster,
  diagnostics() {
    return { notes: ["shadow TT roster mapper"] };
  },
});

export const legacyLineupToLineupMapper = createMappingInterface({
  sourceType: "LegacyLineup",
  sourceVersion: "team-tournament-v6",
  targetSchemaVersion: PARTICIPANT_SCHEMA_VERSION,
  validateSource(source) {
    if (!source?.matchupId || !source?.teamId) {
      return validationFail([
        validationError(
          PARTICIPANT_ERROR_CODE.REQUIRED,
          "matchupId|teamId",
          "matchupId and teamId required"
        ),
      ]);
    }
    return validationOk();
  },
  map(source) {
    const lineupId = `${source.matchupId}::${source.teamId}`;
    const selections = source.selections && typeof source.selections === "object"
      ? source.selections
      : {};
    /** @type {import('../contracts/teamRosterLineup.js').CompetitionLineupSlot[]} */
    const slots = [];
    for (const [discipline, ids] of Object.entries(selections)) {
      const arr = Array.isArray(ids) ? ids : [];
      arr.forEach((id, index) => {
        slots.push(
          createCompetitionLineupSlot({
            id: `${lineupId}:${discipline}:${index}`,
            disciplineOrSideKey: String(discipline),
            index,
            person: createParticipantReference({
              kind: PARTICIPANT_REFERENCE_KIND.PLAYER_PROFILE,
              id: String(id),
            }),
          })
        );
      });
    }
    return createCompetitionLineup({
      id: lineupId,
      competitionId: String(source.tournamentId || source.competitionId || ""),
      teamId: String(source.teamId),
      contextId: String(source.matchupId),
      status: String(source.status || "DRAFT").toUpperCase(),
      revision: 1,
      submittedAt: source.submittedAt || null,
      lockedAt: source.lockedAt || null,
      slots,
      reason: source.overrideReason || source.auditNote || null,
    });
  },
  validateTarget: validateCompetitionLineup,
  diagnostics() {
    return {
      notes: [
        "shadow TT lineup mapper",
        "hidden/public visibility remains Format-owned — not encoded in Core",
      ],
    };
  },
});

export const legacyClassificationMapper = createMappingInterface({
  sourceType: "LegacyDivisionOrCategory",
  sourceVersion: "mixed-legacy",
  targetSchemaVersion: PARTICIPANT_SCHEMA_VERSION,
  validateSource(source) {
    if (!source || typeof source !== "object") {
      return validationFail([
        validationError(PARTICIPANT_ERROR_CODE.INVALID_TYPE, "", "source required"),
      ]);
    }
    return validationOk();
  },
  map(source) {
    if (source.entity === "category" || source.eventType || source.code) {
      return createCompetitionCategory({
        id: String(source.id || source.eventId || source.code || ""),
        competitionId: String(source.tournamentId || source.competitionId || ""),
        code: String(source.code || source.eventType || source.id || ""),
        label: source.label || source.name || null,
      });
    }
    return createCompetitionDivision({
      id: String(source.id || source.groupId || ""),
      competitionId: String(source.tournamentId || source.competitionId || ""),
      name: String(source.name || source.label || ""),
      categoryIds: Array.isArray(source.categoryIds) ? source.categoryIds.map(String) : [],
    });
  },
  validateTarget(target) {
    if (target && "code" in target && !("name" in target && target.name && !target.code)) {
      // category-like
      if (target.code != null) return validateCategory(target);
    }
    if (target && target.name != null && target.code == null) {
      return validateDivision(target);
    }
    if (target?.code) return validateCategory(target);
    return validateDivision(target);
  },
  diagnostics() {
    return { notes: ["maps to separate Division OR Category — never a merged entity (OD-07)"] };
  },
});
