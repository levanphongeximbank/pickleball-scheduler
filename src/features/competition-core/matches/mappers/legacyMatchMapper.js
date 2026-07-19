/**
 * Phase 3F — Legacy Match / SubMatch → CompetitionMatch (map-only).
 * Accepts plain objects — no Production engine imports.
 * SubMatch granularity: one CompetitionMatch per playable contest.
 * Does not calculate winners from scores.
 */

import {
  createCompetitionMatch,
  createMatchSide,
  createMatchResultReference,
} from "../contracts/competitionMatch.js";
import {
  createFormatExtension,
  cloneJsonSafe,
} from "../../participants/contracts/shared.js";
import { MATCH_SOURCE_TYPE } from "../enums/matchSourceTypes.js";
import { MATCH_SIDE_KEY } from "../enums/matchSideKeys.js";
import { MATCH_COMPLETION_REASON } from "../enums/completionReasons.js";
import { MATCH_STATUS } from "../enums/matchStatuses.js";
import { buildMatchIdentityKey } from "../contracts/matchIdentity.js";
import { MATCH_RUNTIME_ERROR_CODE } from "../errors/runtimeErrorCodes.js";
import { MatchRuntimeError } from "../errors/MatchRuntimeError.js";
import { mapLegacyMatchStatus } from "./statusMapper.js";

/**
 * @param {unknown} source
 * @param {Record<string, unknown>} [context]
 * @returns {boolean}
 */
export function isLegacyMatchSource(source, context = {}) {
  if (!source || typeof source !== "object") return false;
  const s = /** @type {Record<string, unknown>} */ (source);
  const explicit =
    s.__sourceType || context.sourceType || context.__sourceType || null;
  if (
    explicit === MATCH_SOURCE_TYPE.LEGACY_MATCH ||
    explicit === MATCH_SOURCE_TYPE.LEGACY_SUB_MATCH ||
    explicit === "LEGACY_MATCH" ||
    explicit === "LEGACY_SUB_MATCH" ||
    explicit === "MATCH" ||
    explicit === "SUB_MATCH"
  ) {
    return true;
  }

  // TT SubMatch shape (playable unit)
  if (
    (s.disciplineId != null || s.subMatchId != null) &&
    (s.status != null || s.score != null || s.id != null)
  ) {
    return true;
  }

  // Legacy individual / daily match shape
  if (
    (s.entryAId != null || s.entryBId != null || s.teamAId != null || s.teamBId != null) &&
    (s.status != null || s.id != null || s.courtId != null)
  ) {
    return true;
  }

  // Player-list daily shape
  if (
    (Array.isArray(s.teamAPlayerIds) || Array.isArray(s.teamBPlayerIds)) &&
    (s.status != null || s.id != null)
  ) {
    return true;
  }

  return false;
}

/**
 * Stable contextId for one playable match (SubMatch granularity).
 * Prefer explicit contextId; else subMatch id; else compose matchupId::id; else match id.
 *
 * @param {Record<string, unknown>} raw
 * @param {Record<string, unknown>} context
 * @returns {string}
 */
function resolveContextId(raw, context) {
  if (raw.contextId != null && String(raw.contextId).trim()) {
    return String(raw.contextId).trim();
  }
  if (context.contextId != null && String(context.contextId).trim()) {
    return String(context.contextId).trim();
  }
  const matchupId = String(
    raw.matchupId || context.matchupId || ""
  ).trim();
  const subId = String(
    raw.subMatchId || raw.id || ""
  ).trim();
  if (matchupId && subId && (raw.disciplineId != null || raw.subMatchId != null)) {
    return `${matchupId}::${subId}`;
  }
  if (subId) return subId;
  if (raw.bracketMatchId != null && String(raw.bracketMatchId).trim()) {
    return String(raw.bracketMatchId).trim();
  }
  return "";
}

/**
 * @param {unknown} rawStatus
 * @returns {string}
 */
function mapCompletionReason(rawStatus, raw) {
  const key = String(rawStatus || "").trim().toLowerCase();
  if (key === "forfeit" || raw?.forfeit === true) {
    return MATCH_COMPLETION_REASON.FORFEIT;
  }
  if (key === "walkover" || raw?.resultType === "walkover") {
    return MATCH_COMPLETION_REASON.WALKOVER;
  }
  if (key === "cancelled" || key === "canceled") {
    return MATCH_COMPLETION_REASON.CANCELLED;
  }
  if (key === "completed" || key === "done" || key === "finished") {
    return MATCH_COMPLETION_REASON.COMPLETED;
  }
  return MATCH_COMPLETION_REASON.NONE;
}

/**
 * @param {unknown} source
 * @param {Record<string, unknown>} [context]
 * @returns {import('../contracts/competitionMatch.js').CompetitionMatch}
 */
export function mapLegacyMatchToCompetitionMatch(source, context = {}) {
  if (!source || typeof source !== "object") {
    throw new MatchRuntimeError(
      MATCH_RUNTIME_ERROR_CODE.MATCH_INVALID_SOURCE,
      "Legacy match source must be an object",
      {}
    );
  }

  const raw = /** @type {Record<string, unknown>} */ (source);
  const competitionId = String(
    context.competitionId || raw.competitionId || raw.tournamentId || ""
  ).trim();
  const contextId = resolveContextId(raw, context);

  if (!competitionId) {
    throw new MatchRuntimeError(
      MATCH_RUNTIME_ERROR_CODE.MATCH_INVALID_SOURCE,
      "competitionId is required to map legacy match",
      {}
    );
  }
  if (!contextId) {
    throw new MatchRuntimeError(
      MATCH_RUNTIME_ERROR_CODE.MATCH_INVALID_SOURCE,
      "contextId could not be derived from legacy match",
      { competitionId }
    );
  }

  const isSubMatch =
    raw.disciplineId != null ||
    raw.subMatchId != null ||
    context.sourceType === MATCH_SOURCE_TYPE.LEGACY_SUB_MATCH ||
    raw.__sourceType === MATCH_SOURCE_TYPE.LEGACY_SUB_MATCH;

  const sourceType = isSubMatch
    ? MATCH_SOURCE_TYPE.LEGACY_SUB_MATCH
    : MATCH_SOURCE_TYPE.LEGACY_MATCH;

  const status = mapLegacyMatchStatus(raw.status, {
    defaultStatus: MATCH_STATUS.DRAFT,
  });
  const completionReason = mapCompletionReason(raw.status, raw);

  const matchup = context.matchup && typeof context.matchup === "object"
    ? /** @type {Record<string, unknown>} */ (context.matchup)
    : null;

  const teamA = String(
    raw.teamAId ||
      matchup?.teamAId ||
      context.teamAId ||
      ""
  ).trim();
  const teamB = String(
    raw.teamBId ||
      matchup?.teamBId ||
      context.teamBId ||
      ""
  ).trim();

  const entryA = String(raw.entryAId || "").trim();
  const entryB = String(raw.entryBId || "").trim();

  const playerA = Array.isArray(raw.teamAPlayerIds)
    ? raw.teamAPlayerIds.map((id) => ({
        kind: "PLAYER_PROFILE",
        id: String(id),
      }))
    : entryA
      ? [{ kind: "PLAYER_PROFILE", id: entryA }]
      : [];
  const playerB = Array.isArray(raw.teamBPlayerIds)
    ? raw.teamBPlayerIds.map((id) => ({
        kind: "PLAYER_PROFILE",
        id: String(id),
      }))
    : entryB
      ? [{ kind: "PLAYER_PROFILE", id: entryB }]
      : [];

  const identityKey = buildMatchIdentityKey({ competitionId, contextId });

  const lineupA =
    context.lineupReferenceA != null
      ? String(context.lineupReferenceA)
      : raw.lineupReferenceA != null
        ? String(raw.lineupReferenceA)
        : null;
  const lineupB =
    context.lineupReferenceB != null
      ? String(context.lineupReferenceB)
      : raw.lineupReferenceB != null
        ? String(raw.lineupReferenceB)
        : null;

  const sides = [
    createMatchSide(
      {
        sideKey: MATCH_SIDE_KEY.A,
        teamReference: teamA || null,
        participantReferences: playerA,
        lineupReference: lineupA,
        seed: typeof raw.seedA === "number" ? raw.seedA : null,
        sourceType,
        metadata: {
          legacyEntryId: entryA || null,
          disciplineId: raw.disciplineId ?? null,
        },
      },
      { matchIdentityKey: identityKey }
    ),
    createMatchSide(
      {
        sideKey: MATCH_SIDE_KEY.B,
        teamReference: teamB || null,
        participantReferences: playerB,
        lineupReference: lineupB,
        seed: typeof raw.seedB === "number" ? raw.seedB : null,
        sourceType,
        metadata: {
          legacyEntryId: entryB || null,
          disciplineId: raw.disciplineId ?? null,
        },
      },
      { matchIdentityKey: identityKey }
    ),
  ];

  // Opaque result reference only — never copy scores into Core as authority.
  const resultReference = createMatchResultReference(
    raw.resultId || raw.resultType || raw.resultReference
      ? {
          resultId:
            raw.resultId != null
              ? String(raw.resultId)
              : raw.id != null
                ? String(raw.id)
                : null,
          resultType:
            raw.resultType != null
              ? String(raw.resultType)
              : completionReason !== MATCH_COMPLETION_REASON.NONE
                ? completionReason
                : null,
          sourceType,
          metadata: {
            hasLegacyScore:
              raw.scoreA != null ||
              raw.scoreB != null ||
              (raw.score && typeof raw.score === "object"),
          },
        }
      : status === MATCH_STATUS.COMPLETED
        ? {
            resultId: String(raw.id || contextId),
            resultType: completionReason,
            sourceType,
            metadata: {
              hasLegacyScore:
                raw.scoreA != null ||
                raw.scoreB != null ||
                (raw.score && typeof raw.score === "object"),
            },
          }
        : null
  );

  return createCompetitionMatch({
    competitionId,
    contextId,
    identityKey,
    id: identityKey,
    fixtureId:
      raw.fixtureId != null
        ? String(raw.fixtureId)
        : matchup?.id != null
          ? String(matchup.id)
          : null,
    stageId: raw.stage != null ? String(raw.stage) : null,
    roundId:
      raw.roundId != null
        ? String(raw.roundId)
        : raw.round != null
          ? String(raw.round)
          : null,
    groupId: raw.groupId != null ? String(raw.groupId) : null,
    matchNumber:
      typeof raw.matchNumber === "number" ? raw.matchNumber : null,
    formatType: isSubMatch ? "team_sub_match" : "individual_or_daily",
    status,
    completionReason,
    sides,
    courtAssignmentRef:
      raw.courtId != null ? String(raw.courtId) : null,
    refereeAssignmentRef:
      raw.referee != null
        ? typeof raw.referee === "object"
          ? String(
              /** @type {{ id?: string, token?: string }} */ (raw.referee).id ||
                /** @type {{ token?: string }} */ (raw.referee).token ||
                ""
            ) || null
          : String(raw.referee)
        : null,
    scheduledAt: raw.scheduledAt ?? null,
    startedAt: raw.startedAt ?? null,
    completedAt: raw.completedAt ?? null,
    resultReference,
    sourceType,
    revision: 1,
    metadata: {
      legacyId: raw.id != null ? String(raw.id) : null,
      disciplineId: raw.disciplineId ?? null,
      matchupId: raw.matchupId ?? matchup?.id ?? null,
      // Scores intentionally NOT copied as Core fields — Scoring owns them.
    },
    formatExtension: createFormatExtension({
      formatKey: String(context.formatKey || (isSubMatch ? "team-tournament" : "legacy-match")),
      payload: {
        legacyKeys: Object.keys(raw),
      },
    }),
    audit: {
      createdAt: null,
      createdBy: null,
      updatedAt: null,
      updatedBy: null,
      decidedAt: null,
      decidedBy: null,
    },
  });
}

/**
 * @param {unknown} source
 * @returns {unknown}
 */
export function cloneLegacyMatchSource(source) {
  return cloneJsonSafe(source);
}
