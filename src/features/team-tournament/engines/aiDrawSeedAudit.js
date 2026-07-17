import { getCurrentUser } from "../../../auth/authService.js";
import { PRIVATE_PAIRING_RUNTIME_VERSION } from "../../private-pairing-rules/runtime/runtimeCodes.js";
import { PRIVATE_PAIRING_OPERATION } from "../../private-pairing-rules/runtime/privatePairingSource.js";

/** Shared algorithm version for AI draw reproducibility contracts. */
export const AI_DRAW_ALGORITHM_VERSION = PRIVATE_PAIRING_RUNTIME_VERSION;

export const AI_DRAW_CHANGE_REASON = Object.freeze({
  INITIAL_DRAW: "INITIAL_DRAW",
  USER_REARRANGE: "USER_REARRANGE",
});

const MAX_REARRANGE_LOG = 30;

/**
 * Create a new cryptographically-strong-enough random seed for an explicit user rearrange.
 * Never reuse the previous seed.
 *
 * @param {string|number|null} [previousSeed]
 * @returns {string}
 */
export function createAiDrawRandomSeed(previousSeed = null) {
  const entropy =
    typeof crypto !== "undefined" && typeof crypto.getRandomValues === "function"
      ? crypto.getRandomValues(new Uint32Array(2))
      : null;
  const a = entropy ? entropy[0] : Math.floor(Math.random() * 0xffffffff);
  const b = entropy ? entropy[1] : Math.floor(Math.random() * 0xffffffff);
  const stamp = Date.now().toString(36);
  let seed = `aidraw-${stamp}-${a.toString(16)}-${b.toString(16)}`;
  if (previousSeed != null && String(previousSeed) === seed) {
    seed = `${seed}-x`;
  }
  return seed;
}

/**
 * Compact snapshot of team formation result (for audit, not full roster blobs).
 * Team ids are volatile (createId); fingerprint by sorted player membership.
 *
 * @param {Array<{ id?: string, name?: string, playerIds?: string[], captainPlayerId?: string }>} teams
 */
export function snapshotTeamFormationResult(teams = []) {
  return (teams || [])
    .map((team) => ({
      name: String(team.name || ""),
      playerIds: [...(team.playerIds || [])].map(String).sort(),
      captainPlayerId: team.captainPlayerId ? String(team.captainPlayerId) : null,
    }))
    .sort((a, b) => a.playerIds.join("|").localeCompare(b.playerIds.join("|")));
}

/**
 * Compact snapshot of group draw result.
 *
 * @param {Array<{ id?: string, name?: string, label?: string, teamIds?: string[], entryIds?: string[] }>} groups
 */
export function snapshotGroupDrawResult(groups = []) {
  return (groups || []).map((group) => ({
    id: String(group.id || ""),
    name: String(group.name || group.label || ""),
    teamIds: [...(group.teamIds || [])].map(String).sort(),
    entryIds: [...(group.entryIds || [])].map(String).sort(),
  }));
}

/**
 * @param {object} [teamData]
 * @param {'TEAM_FORMATION'|'GROUP_DRAW'} operation
 */
export function getPublishedAiDrawState(teamData, operation) {
  const aiDraw = teamData?.settings?.aiDraw;
  if (!aiDraw || typeof aiDraw !== "object") {
    return null;
  }
  if (operation === PRIVATE_PAIRING_OPERATION.TEAM_FORMATION) {
    return aiDraw.teamFormation || null;
  }
  if (operation === PRIVATE_PAIRING_OPERATION.GROUP_DRAW) {
    return aiDraw.groupDraw || null;
  }
  return null;
}

/**
 * Build a rearrange audit entry. Does not mutate teamData.
 *
 * @param {object} input
 */
export function buildAiDrawRearrangeAuditEntry(input = {}) {
  const user = input.actor || getCurrentUser() || {};
  return {
    id: `ai-draw-audit-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e6).toString(36)}`,
    operation: input.operation || PRIVATE_PAIRING_OPERATION.TEAM_FORMATION,
    reason: input.reason || AI_DRAW_CHANGE_REASON.USER_REARRANGE,
    randomSeed: String(input.randomSeed || ""),
    previousRandomSeed:
      input.previousRandomSeed == null ? null : String(input.previousRandomSeed),
    previousResult: input.previousResult ?? null,
    nextResult: input.nextResult ?? null,
    scoreBreakdown: input.scoreBreakdown || null,
    diagnostics: input.diagnostics || null,
    algorithmVersion: input.algorithmVersion || AI_DRAW_ALGORITHM_VERSION,
    rulesVersion: input.rulesVersion ? String(input.rulesVersion) : "",
    actorId: user.id ? String(user.id) : null,
    actorEmail: user.email ? String(user.email) : "",
    actorName: user.displayName || user.name || user.email || "",
    createdAt: input.createdAt || new Date().toISOString(),
  };
}

/**
 * Attach published AI draw seed + rearrange audit onto teamData.settings (immutable).
 * Does not re-run engines — only records what the user just applied.
 *
 * @param {object} teamData
 * @param {object} input
 */
export function attachAiDrawPublishMetadata(teamData, input = {}) {
  const operation = input.operation || PRIVATE_PAIRING_OPERATION.TEAM_FORMATION;
  const previous = getPublishedAiDrawState(teamData, operation);
  const reason =
    input.reason ||
    (previous?.randomSeed
      ? AI_DRAW_CHANGE_REASON.USER_REARRANGE
      : AI_DRAW_CHANGE_REASON.INITIAL_DRAW);

  const auditEntry = buildAiDrawRearrangeAuditEntry({
    operation,
    reason,
    randomSeed: input.randomSeed,
    previousRandomSeed: previous?.randomSeed ?? null,
    previousResult: input.previousResult ?? previous?.resultSnapshot ?? null,
    nextResult: input.nextResult ?? null,
    scoreBreakdown: input.scoreBreakdown || null,
    algorithmVersion: input.algorithmVersion || AI_DRAW_ALGORITHM_VERSION,
    rulesVersion: input.rulesVersion || previous?.rulesVersion || "",
    actor: input.actor,
    createdAt: input.createdAt,
    diagnostics: input.diagnostics || null,
  });

  const published = {
    randomSeed: String(input.randomSeed || ""),
    algorithmVersion: auditEntry.algorithmVersion,
    rulesVersion: auditEntry.rulesVersion,
    scoreBreakdown: input.scoreBreakdown || null,
    diagnostics: input.diagnostics || null,
    resultSnapshot: input.nextResult ?? null,
    publishedAt: auditEntry.createdAt,
    lastReason: reason,
  };

  const existingAiDraw =
    teamData?.settings?.aiDraw && typeof teamData.settings.aiDraw === "object"
      ? teamData.settings.aiDraw
      : {};
  const previousLog = Array.isArray(existingAiDraw.rearrangeLog)
    ? existingAiDraw.rearrangeLog
    : [];
  const rearrangeLog = [...previousLog, auditEntry].slice(-MAX_REARRANGE_LOG);

  const nextAiDraw = {
    ...existingAiDraw,
    rearrangeLog,
  };
  if (operation === PRIVATE_PAIRING_OPERATION.TEAM_FORMATION) {
    nextAiDraw.teamFormation = published;
  } else if (operation === PRIVATE_PAIRING_OPERATION.GROUP_DRAW) {
    nextAiDraw.groupDraw = published;
  }

  return {
    ...teamData,
    settings: {
      ...(teamData?.settings || {}),
      aiDraw: nextAiDraw,
    },
  };
}
