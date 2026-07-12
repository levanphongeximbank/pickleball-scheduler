import { LINEUP_STATUS, MATCHUP_STATUS } from "../constants.js";
import { getLineup } from "../models/index.js";
import { normalizeMissingLineupPolicy, isLineupSubmitted } from "./missingLineupPolicyEngine.js";

const PUBLISHED_MATCHUP_STATUSES = new Set([
  MATCHUP_STATUS.PUBLISHED,
  MATCHUP_STATUS.IN_PROGRESS,
  MATCHUP_STATUS.COMPLETED,
]);

export const PUBLISH_BLOCK_CODES = Object.freeze({
  MATCHUP_NOT_LOCKED: "matchup_not_locked",
  LINEUP_NOT_LOCKED: "lineup_not_locked",
  LINEUP_MISSING: "lineup_missing",
  MISSING_POLICY_UNRESOLVED: "missing_policy_unresolved",
  MANUAL_PENDING: "manual_pending",
  ALREADY_PUBLISHED: "already_published",
});

export function resolveLineupVersions(teamData, matchup) {
  const lineupA = getLineup(teamData, matchup.id, matchup.teamAId);
  const lineupB = getLineup(teamData, matchup.id, matchup.teamBId);
  return {
    lineupAVersion: lineupA?.version ?? matchup.lineupAVersion ?? null,
    lineupBVersion: lineupB?.version ?? matchup.lineupBVersion ?? null,
  };
}

export function resolveCanPublishFromServer(matchup) {
  if (typeof matchup?.canPublish === "boolean") {
    return {
      canPublish: matchup.canPublish,
      blockCode: matchup.publishBlockCode || null,
      blockMessage: matchup.publishBlockMessage || null,
    };
  }
  return resolveCanPublishLocal(matchup);
}

export function resolveCanPublishLocal(matchup) {
  if (PUBLISHED_MATCHUP_STATUSES.has(matchup?.status)) {
    return {
      canPublish: false,
      blockCode: PUBLISH_BLOCK_CODES.ALREADY_PUBLISHED,
      blockMessage: "Matchup đã được công bố.",
    };
  }
  if (matchup?.status !== MATCHUP_STATUS.LOCKED) {
    return {
      canPublish: false,
      blockCode: PUBLISH_BLOCK_CODES.MATCHUP_NOT_LOCKED,
      blockMessage: "Matchup chưa khóa.",
    };
  }
  return { canPublish: true, blockCode: null, blockMessage: null };
}

export function resolvePublishReadiness({ teamData, matchup, policy }) {
  const normalizedPolicy = normalizeMissingLineupPolicy(policy);
  const versions = resolveLineupVersions(teamData, matchup);
  const server = resolveCanPublishFromServer(matchup);

  const lineupA = getLineup(teamData, matchup.id, matchup.teamAId);
  const lineupB = getLineup(teamData, matchup.id, matchup.teamBId);

  if (!lineupA || !lineupB) {
    return {
      ...server,
      canPublish: false,
      blockCode: PUBLISH_BLOCK_CODES.LINEUP_MISSING,
      blockMessage: "Thiếu đội hình một hoặc cả hai đội.",
      ...versions,
    };
  }

  if (
    lineupA.status !== LINEUP_STATUS.LOCKED ||
    lineupB.status !== LINEUP_STATUS.LOCKED
  ) {
    return {
      ...server,
      canPublish: false,
      blockCode: PUBLISH_BLOCK_CODES.LINEUP_NOT_LOCKED,
      blockMessage: "Cả hai đội hình phải locked trước khi công bố.",
      ...versions,
    };
  }

  const manualPending =
    String(lineupA.auditNote || "").includes("tt2d:manual_pending") ||
    String(lineupB.auditNote || "").includes("tt2d:manual_pending");
  if (manualPending) {
    return {
      ...server,
      canPublish: false,
      blockCode: PUBLISH_BLOCK_CODES.MANUAL_PENDING,
      blockMessage: "Còn đội hình chờ xử lý thủ công.",
      ...versions,
    };
  }

  const missingSubmitted =
    !isLineupSubmitted(lineupA) || !isLineupSubmitted(lineupB);
  if (missingSubmitted && normalizedPolicy) {
    return {
      ...server,
      canPublish: server.canPublish,
      ...versions,
    };
  }

  return {
    ...server,
    ...versions,
    policy: normalizedPolicy,
  };
}

export function mergeServerPublishOps(matchup, serverOps = {}) {
  if (!serverOps || typeof serverOps !== "object") {
    return matchup;
  }
  return {
    ...matchup,
    publishOps: serverOps,
    canPublish: serverOps.canPublish ?? matchup.canPublish,
    publishBlockCode: serverOps.blockCode ?? matchup.publishBlockCode,
    publishBlockMessage: serverOps.blockMessage ?? matchup.publishBlockMessage,
    lineupAVersion: serverOps.lineupAVersion ?? matchup.lineupAVersion,
    lineupBVersion: serverOps.lineupBVersion ?? matchup.lineupBVersion,
    publishedAt: serverOps.publishedAt ?? matchup.publishedAt,
  };
}

export function isOpponentLineupVisible({ matchup, viewerTeamId, isOrganizer = false, isReferee = false }) {
  if (isOrganizer || isReferee) {
    return PUBLISHED_MATCHUP_STATUSES.has(matchup?.status);
  }
  if (!viewerTeamId) {
    return false;
  }
  return PUBLISHED_MATCHUP_STATUSES.has(matchup?.status);
}
