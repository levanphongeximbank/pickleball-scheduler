/**
 * Read-only source repository — injectable wrappers over existing stores.
 * Phase 1B: no writes, no new identity store.
 */
import { loadPlayersForClub } from "../../../domain/clubStorage.js";
import { adaptBlobPlayerRow } from "../adapters/blobPlayerAdapter.js";
import { adaptProfileRow } from "../adapters/profileAdapter.js";
import { adaptAthleteRow } from "../adapters/athleteAdapter.js";
import { trimId } from "../utils/playerId.js";

/**
 * @param {object} [deps]
 */
export function createPlayerSourceRepository(deps = {}) {
  const {
    loadLegacyPlayers = loadPlayersForClub,
    loadProfileByUserId = null,
    loadAthleteByUserId = null,
    loadAthleteById = null,
    findPlayerById = null,
    listPlayersByAuthUserId = null,
  } = deps;

  /**
   * Build a directory finder for a club blob (or custom).
   * Returns:
   * - player object when found
   * - null when explicitly missing
   * - undefined when existence unknown (caller may trust MAPPED)
   */
  function makeFindPlayerById(clubId, optionFind) {
    if (typeof optionFind === "function") return optionFind;
    if (typeof findPlayerById === "function") return findPlayerById;

    if (!clubId) {
      return () => undefined;
    }

    let byId;
    try {
      const rows = loadLegacyPlayers(clubId) || [];
      byId = new Map(rows.map((p) => [String(p.id), p]));
    } catch {
      byId = new Map();
    }

    return (playerId) => {
      const id = trimId(playerId);
      if (!id) return null;
      return byId.has(id) ? byId.get(id) : null;
    };
  }

  async function getProfile(authUserId) {
    const id = trimId(authUserId);
    if (!id) return null;
    if (typeof loadProfileByUserId !== "function") return null;
    const row = await loadProfileByUserId(id);
    return adaptProfileRow(row);
  }

  async function getAthleteByUserId(authUserId) {
    const id = trimId(authUserId);
    if (!id || typeof loadAthleteByUserId !== "function") return null;
    const row = await loadAthleteByUserId(id);
    return adaptAthleteRow(row);
  }

  async function getAthleteById(athleteId) {
    const id = trimId(athleteId);
    if (!id || typeof loadAthleteById !== "function") return null;
    const row = await loadAthleteById(id);
    return adaptAthleteRow(row);
  }

  function listBlobPlayersForAuthUser(authUserId, clubId) {
    const uid = trimId(authUserId);
    if (!uid) return [];

    if (typeof listPlayersByAuthUserId === "function") {
      return (listPlayersByAuthUserId(uid, clubId) || [])
        .map((row) => adaptBlobPlayerRow(row, { clubId }))
        .filter(Boolean);
    }

    if (!clubId) return [];
    let rows;
    try {
      rows = loadLegacyPlayers(clubId) || [];
    } catch {
      rows = [];
    }

    return rows
      .filter((p) => {
        const linked = String(p?.authUserId || p?.auth_user_id || p?.userId || p?.user_id || "").trim();
        return linked && linked === uid;
      })
      .map((row) => adaptBlobPlayerRow(row, { clubId }))
      .filter(Boolean);
  }

  function getBlobPlayer(playerId, clubId) {
    const finder = makeFindPlayerById(clubId);
    const row = finder(playerId);
    if (!row || typeof row !== "object") return null;
    return adaptBlobPlayerRow(row, { clubId });
  }

  return {
    makeFindPlayerById,
    getProfile,
    getAthleteByUserId,
    getAthleteById,
    listBlobPlayersForAuthUser,
    getBlobPlayer,
  };
}

export const playerSourceRepository = createPlayerSourceRepository();
