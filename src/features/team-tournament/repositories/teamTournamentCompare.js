import { normalizeTeamData } from "../models/index.js";
import { hashTeamTournamentCanonicalValue } from "./teamTournamentCanonical.js";

/** @typedef {'missing_in_blob'|'missing_in_cloud'|'value_mismatch'|'duplicate_key'} TeamTournamentMismatchType */

/**
 * @typedef {object} TeamTournamentSnapshotMismatch
 * @property {string} entityType
 * @property {string} entityKey
 * @property {TeamTournamentMismatchType} mismatchType
 * @property {string} blobHash
 * @property {string} cloudHash
 */

const MISSING_ENTITY_SENTINEL = { __entityMissing: true };

function hashSnapshotValue(value) {
  if (value === undefined) {
    return hashTeamTournamentCanonicalValue(MISSING_ENTITY_SENTINEL);
  }
  return hashTeamTournamentCanonicalValue(value);
}

/**
 * @template T
 * @param {T[]} section
 * @param {(item: T) => string} keyFn
 * @returns {{ map: Map<string, T>, duplicateKeys: string[] }}
 */
function buildEntityMap(section, keyFn) {
  const map = new Map();
  const duplicateKeys = [];

  for (const item of section || []) {
    const key = String(keyFn(item));
    if (map.has(key)) {
      duplicateKeys.push(key);
    }
    map.set(key, item);
  }

  return { map, duplicateKeys };
}

/**
 * @param {string} entityType
 * @param {string} entityKey
 * @param {TeamTournamentMismatchType} mismatchType
 * @param {unknown} blobValue
 * @param {unknown} cloudValue
 * @returns {TeamTournamentSnapshotMismatch}
 */
function createMismatch(entityType, entityKey, mismatchType, blobValue, cloudValue) {
  return {
    entityType,
    entityKey,
    mismatchType,
    blobHash: hashSnapshotValue(blobValue),
    cloudHash: hashSnapshotValue(cloudValue),
  };
}

/**
 * @param {TeamTournamentSnapshotMismatch[]} mismatches
 * @param {string} entityType
 * @param {string[]} duplicateKeys
 * @param {'blob'|'cloud'} side
 */
function appendDuplicateMismatches(mismatches, entityType, duplicateKeys, side) {
  for (const entityKey of duplicateKeys) {
    mismatches.push(
      createMismatch(
        entityType,
        entityKey,
        "duplicate_key",
        side === "blob" ? { duplicate: entityKey } : undefined,
        side === "cloud" ? { duplicate: entityKey } : undefined
      )
    );
  }
}

/**
 * Compare blob teamData vs cloud-mapped teamData for shadow mode.
 * @returns {{ ok: boolean, mismatches: TeamTournamentSnapshotMismatch[] }}
 */
export function compareTeamTournamentSnapshots(blobTeamData, cloudTeamData) {
  const blob = normalizeTeamData(blobTeamData || {});
  const cloud = normalizeTeamData(cloudTeamData || {});
  /** @type {TeamTournamentSnapshotMismatch[]} */
  const mismatches = [];

  const compareSection = (entityType, blobSection, cloudSection, keyFn) => {
    const blobBuilt = buildEntityMap(blobSection, keyFn);
    const cloudBuilt = buildEntityMap(cloudSection, keyFn);

    appendDuplicateMismatches(mismatches, entityType, blobBuilt.duplicateKeys, "blob");
    appendDuplicateMismatches(mismatches, entityType, cloudBuilt.duplicateKeys, "cloud");

    const keys = new Set([...blobBuilt.map.keys(), ...cloudBuilt.map.keys()]);

    for (const key of keys) {
      const left = blobBuilt.map.get(key);
      const right = cloudBuilt.map.get(key);
      const blobHas = blobBuilt.map.has(key);
      const cloudHas = cloudBuilt.map.has(key);

      if (blobHas && !cloudHas) {
        mismatches.push(createMismatch(entityType, String(key), "missing_in_cloud", left, undefined));
        continue;
      }

      if (!blobHas && cloudHas) {
        mismatches.push(createMismatch(entityType, String(key), "missing_in_blob", undefined, right));
        continue;
      }

      const blobHash = hashSnapshotValue(left);
      const cloudHash = hashSnapshotValue(right);
      if (blobHash !== cloudHash) {
        mismatches.push({
          entityType,
          entityKey: String(key),
          mismatchType: "value_mismatch",
          blobHash,
          cloudHash,
        });
      }
    }
  };

  compareSection("team", blob.teams, cloud.teams, (team) => team.id);
  compareSection("matchup", blob.matchups, cloud.matchups, (matchup) => matchup.id);
  compareSection("discipline", blob.disciplines, cloud.disciplines, (discipline) => discipline.id);

  const blobLineupBuilt = buildEntityMap(
    Object.entries(blob.lineups || {}).map(([entityKey, lineup]) => ({ entityKey, lineup })),
    (entry) => entry.entityKey
  );
  const cloudLineupBuilt = buildEntityMap(
    Object.entries(cloud.lineups || {}).map(([entityKey, lineup]) => ({ entityKey, lineup })),
    (entry) => entry.entityKey
  );

  appendDuplicateMismatches(mismatches, "lineup", blobLineupBuilt.duplicateKeys, "blob");
  appendDuplicateMismatches(mismatches, "lineup", cloudLineupBuilt.duplicateKeys, "cloud");

  const lineupKeys = new Set([...blobLineupBuilt.map.keys(), ...cloudLineupBuilt.map.keys()]);
  for (const key of lineupKeys) {
    const blobEntry = blobLineupBuilt.map.get(key);
    const cloudEntry = cloudLineupBuilt.map.get(key);
    const blobHas = blobLineupBuilt.map.has(key);
    const cloudHas = cloudLineupBuilt.map.has(key);

    if (blobHas && !cloudHas) {
      mismatches.push(
        createMismatch("lineup", key, "missing_in_cloud", blobEntry?.lineup, undefined)
      );
      continue;
    }

    if (!blobHas && cloudHas) {
      mismatches.push(
        createMismatch("lineup", key, "missing_in_blob", undefined, cloudEntry?.lineup)
      );
      continue;
    }

    const blobHash = hashSnapshotValue(blobEntry?.lineup);
    const cloudHash = hashSnapshotValue(cloudEntry?.lineup);
    if (blobHash !== cloudHash) {
      mismatches.push({
        entityType: "lineup",
        entityKey: key,
        mismatchType: "value_mismatch",
        blobHash,
        cloudHash,
      });
    }
  }

  return { ok: mismatches.length === 0, mismatches };
}

export function logShadowMismatches(tournamentId, compareResult, logger = console) {
  if (compareResult.ok) {
    return;
  }

  for (const mismatch of compareResult.mismatches) {
    logger.warn?.(
      `[team-tournament shadow] mismatch tournament=${tournamentId} ` +
        `${mismatch.entityType}:${mismatch.entityKey} type=${mismatch.mismatchType} ` +
        `blob=${mismatch.blobHash.slice(0, 8)} cloud=${mismatch.cloudHash.slice(0, 8)}`
    );
  }
}

export { hashTeamTournamentCanonicalValue as hashTeamTournamentSnapshotValue } from "./teamTournamentCanonical.js";
