/**
 * Core-05 — immutable TeamRosterSnapshot contract.
 */

import { PARTICIPANT_SCHEMA_VERSION } from "../../participants/contracts/shared.js";

/**
 * @typedef {Object} TeamRosterSnapshot
 * @property {string} schemaVersion
 * @property {string} id
 * @property {string} teamId
 * @property {string} rosterId
 * @property {number} rosterVersion
 * @property {string[]} memberIds — deterministic sorted active+all tracked ids used for hash
 * @property {string} effectiveAt
 * @property {string|null} reason
 * @property {string|null} actor
 * @property {string|null} contentHash
 */

/**
 * Deterministic content hash from rosterVersion + sorted memberIds.
 * @param {{ rosterVersion?: number, memberIds?: string[] }} parts
 * @returns {string}
 */
export function buildRosterSnapshotContentHash(parts = {}) {
  const version =
    typeof parts.rosterVersion === "number" && Number.isFinite(parts.rosterVersion)
      ? Math.floor(parts.rosterVersion)
      : 0;
  const memberIds = Array.isArray(parts.memberIds)
    ? [...parts.memberIds].map((id) => String(id)).sort((a, b) => (a < b ? -1 : a > b ? 1 : 0))
    : [];
  return `rv${version}:${memberIds.join(",")}`;
}

/**
 * @param {Partial<TeamRosterSnapshot>} partial
 * @returns {TeamRosterSnapshot}
 */
export function createTeamRosterSnapshot(partial = {}) {
  const memberIds = Array.isArray(partial.memberIds)
    ? [...partial.memberIds]
        .map((id) => String(id).trim())
        .filter(Boolean)
        .sort((a, b) => (a < b ? -1 : a > b ? 1 : 0))
    : [];
  const rosterVersion =
    typeof partial.rosterVersion === "number" && Number.isFinite(partial.rosterVersion)
      ? Math.max(0, Math.floor(partial.rosterVersion))
      : 0;
  const contentHash =
    partial.contentHash != null && String(partial.contentHash).trim() !== ""
      ? String(partial.contentHash).trim()
      : buildRosterSnapshotContentHash({ rosterVersion, memberIds });

  return Object.freeze({
    schemaVersion: String(partial.schemaVersion ?? PARTICIPANT_SCHEMA_VERSION),
    id: String(partial.id || ""),
    teamId: String(partial.teamId || ""),
    rosterId: String(partial.rosterId || ""),
    rosterVersion,
    memberIds: Object.freeze([...memberIds]),
    effectiveAt: String(partial.effectiveAt || ""),
    reason: partial.reason != null ? String(partial.reason) : null,
    actor: partial.actor != null ? String(partial.actor) : null,
    contentHash,
  });
}
