/**
 * PR-4.26 — Shared picker adapter for all canonical consumers.
 * Private Pairing / Daily Play / Tournament / Athlete list.
 */

import { loadPlayersForClub } from "../../../domain/clubStorage.js";
import { listClubsForTenant as legacyListClubsForTenant } from "../../tenant/guards/tenantGuard.js";
import { isCanonicalClubRepositoryEnabled } from "../config/canonicalRepositoryFlags.js";
import { isCanonicalPlayerRepositoryEnabled } from "../config/canonicalRepositoryFlags.js";
import { createCanonicalClubRepository } from "./canonicalClubRepository.js";
import { createCanonicalPlayerRepository } from "./canonicalPlayerRepository.js";
import {
  CANONICAL_SOURCE,
  CANONICAL_WARNING_CODE,
  MAPPING_STATUS,
  isLocalDefaultClub,
  LOCAL_DEFAULT_CLUB_ID,
} from "./canonicalRepositoryTypes.js";

/**
 * Project canonical records to legacy UI shape ({ id, name, ... }).
 * Only MAPPED / DERIVED selectable players are included by default.
 *
 * @param {object} record
 * @param {{ includeUnmapped?: boolean }} [options]
 */
export function toLegacyPickerPlayer(record, options = {}) {
  if (!record) return null;
  const mappingStatus = record.mappingStatus || MAPPING_STATUS.MAPPED;
  const selectable =
    record.metadata?.selectable !== false &&
    (mappingStatus === MAPPING_STATUS.MAPPED || mappingStatus === MAPPING_STATUS.DERIVED);

  if (!options.includeUnmapped && !selectable) {
    return null;
  }

  const playerId = String(record.playerId || record.id || "").trim();
  if (!playerId && !options.includeUnmapped) return null;

  return {
    id: playerId || `unmapped:${record.authUserId || record.profileId || "unknown"}`,
    name: record.displayName || record.name || playerId,
    gender: record.gender ?? "",
    level: record.rating ?? record.level ?? null,
    rating: record.rating ?? record.level ?? null,
    status: record.status || "active",
    active: String(record.status || "active").toLowerCase() !== "inactive",
    clubId: record.clubId || null,
    sourceClubId: record.clubId || record.sourceClubId || null,
    clubName: record.clubName || "",
    tenantId: record.tenantId || null,
    authUserId: record.authUserId || null,
    profileId: record.profileId || null,
    mappingStatus,
    membershipStatus: record.membershipStatus || "active",
    source: record.source || CANONICAL_SOURCE.HYBRID,
    selectable,
    // Keep original player id only when mapped — UI must not treat unmapped fake ids as playerId
    _canonicalPlayerId: playerId || null,
  };
}

/**
 * @param {object} [deps]
 */
export function createCanonicalPlayerPickerAdapter(deps = {}) {
  const {
    envSource = null,
    clubRepository = createCanonicalClubRepository({ envSource }),
    playerRepository = createCanonicalPlayerRepository({ envSource }),
    isClubCanonical = () => isCanonicalClubRepositoryEnabled(envSource),
    isPlayerCanonical = () => isCanonicalPlayerRepositoryEnabled(envSource),
    legacyListClubs = legacyListClubsForTenant,
    legacyLoadPlayers = loadPlayersForClub,
  } = deps;

  async function listSourceClubs({ tenantId, userContext } = {}) {
    if (isClubCanonical()) {
      const result = await clubRepository.listClubsForTenant(tenantId, {
        userContext,
        excludeDefault: true,
      });
      if (!result.ok) return result;
      return {
        ...result,
        data: (result.data || []).filter((club) => !isLocalDefaultClub(club)),
      };
    }

    const legacy = tenantId ? legacyListClubs(tenantId) : legacyListClubs(null);
    const data = (legacy || [])
      .filter((club) => !isLocalDefaultClub(club))
      .map((club) => ({
        id: club.id,
        name: club.name || club.id,
        tenantId: club.tenantId || club.venueId || null,
        status: club.status || "active",
        isDefault: Boolean(club.isDefault),
        source: CANONICAL_SOURCE.LEGACY_BLOB,
      }));

    return {
      ok: true,
      data,
      source: CANONICAL_SOURCE.LEGACY_BLOB,
      warnings: [],
      mappingSummary: {},
      execution: { mode: "legacy" },
    };
  }

  async function listPlayersForClubAware(clubId, options = {}) {
    const id = String(clubId || "").trim();
    if (!id) {
      return {
        ok: true,
        data: [],
        legacyPlayers: [],
        selectablePlayers: [],
        source: "none",
        warnings: [],
        mappingSummary: {},
      };
    }

    if (isLocalDefaultClub(id) && isClubCanonical()) {
      return {
        ok: false,
        code: "DEFAULT_CLUB_NOT_ALLOWED",
        message: "default-club is not allowed as a canonical source club.",
        data: [],
        legacyPlayers: [],
        selectablePlayers: [],
        warnings: [{ code: CANONICAL_WARNING_CODE.DEFAULT_CLUB_EXCLUDED }],
      };
    }

    if (isPlayerCanonical()) {
      const result = await playerRepository.listPlayersForClub(id, {
        tenantId: options.tenantId,
        userContext: options.userContext,
        profilesByUserId: options.profilesByUserId,
      });
      if (!result.ok) {
        return {
          ...result,
          legacyPlayers: [],
          selectablePlayers: [],
        };
      }

      const legacyPlayers = (result.data || [])
        .map((row) => toLegacyPickerPlayer(row, { includeUnmapped: false }))
        .filter(Boolean);

      const unmappedLegacy = options.includeUnmappedInData
        ? (result.data || [])
            .filter((row) => row.mappingStatus === MAPPING_STATUS.UNMAPPED)
            .map((row) => toLegacyPickerPlayer(row, { includeUnmapped: true }))
            .filter(Boolean)
        : [];

      return {
        ...result,
        legacyPlayers,
        selectablePlayers: legacyPlayers,
        unmappedPlayers: unmappedLegacy,
        allCanonical: result.data || [],
      };
    }

    let players;
    try {
      players = legacyLoadPlayers(id) || [];
    } catch {
      players = [];
    }

    const legacyPlayers = players.map((p) => ({
      ...p,
      id: String(p.id),
      name: p.name || p.id,
      mappingStatus: MAPPING_STATUS.MAPPED,
      selectable: true,
      source: CANONICAL_SOURCE.LEGACY_BLOB,
      sourceClubId: id,
      clubId: id,
    }));

    return {
      ok: true,
      data: legacyPlayers.map((p) => ({
        playerId: p.id,
        displayName: p.name,
        clubId: id,
        mappingStatus: MAPPING_STATUS.MAPPED,
        source: CANONICAL_SOURCE.LEGACY_BLOB,
        metadata: { selectable: true },
      })),
      legacyPlayers,
      selectablePlayers: legacyPlayers,
      unmappedPlayers: [],
      allCanonical: [],
      source: CANONICAL_SOURCE.LEGACY_BLOB,
      warnings: [],
      mappingSummary: {
        activeMembers: legacyPlayers.length,
        mappedPlayers: legacyPlayers.length,
        unmappedMembers: 0,
        derivedPlayers: 0,
        duplicatesRemoved: 0,
      },
      execution: { mode: "legacy", clubId: id },
    };
  }

  async function listPlayersForTenantAware(tenantId, options = {}) {
    const tid = String(tenantId || "").trim();
    if (!tid) {
      return {
        ok: true,
        data: [],
        legacyPlayers: [],
        selectablePlayers: [],
        source: "none",
        warnings: [],
        mappingSummary: {},
      };
    }

    if (isPlayerCanonical()) {
      const result = await playerRepository.listPlayersForTenant(tid, {
        userContext: options.userContext,
        profilesByUserId: options.profilesByUserId,
      });
      if (!result.ok) {
        return { ...result, legacyPlayers: [], selectablePlayers: [] };
      }
      const legacyPlayers = (result.data || [])
        .map((row) => toLegacyPickerPlayer(row))
        .filter(Boolean);
      return {
        ...result,
        legacyPlayers,
        selectablePlayers: legacyPlayers,
        allCanonical: result.data || [],
      };
    }

    // Legacy: iterate clubs via getClubs style list
    const clubs = await listSourceClubs({
      tenantId: tid,
      userContext: options.userContext,
    });
    const byId = new Map();
    for (const club of clubs.data || []) {
      if (String(club.id) === LOCAL_DEFAULT_CLUB_ID) continue;
      const clubPlayers = await listPlayersForClubAware(club.id, options);
      for (const player of clubPlayers.legacyPlayers || []) {
        if (!byId.has(player.id)) {
          byId.set(player.id, {
            ...player,
            sourceClubId: club.id,
            clubName: player.clubName || club.name || club.id,
          });
        }
      }
    }

    const legacyPlayers = Array.from(byId.values());
    return {
      ok: true,
      data: legacyPlayers,
      legacyPlayers,
      selectablePlayers: legacyPlayers,
      source: CANONICAL_SOURCE.LEGACY_BLOB,
      warnings: clubs.warnings || [],
      mappingSummary: {
        mappedPlayers: legacyPlayers.length,
        unmappedMembers: 0,
        activeMembers: legacyPlayers.length,
      },
      execution: { mode: "legacy_tenant", tenantId: tid },
    };
  }

  return {
    listSourceClubs,
    listPlayersForClubAware,
    listPlayersForTenantAware,
    toLegacyPickerPlayer,
    isClubCanonical,
    isPlayerCanonical,
  };
}

export const canonicalPlayerPickerAdapter = createCanonicalPlayerPickerAdapter();

/** Convenience re-exports for consumers */
export async function listPlayersForClubAware(clubId, options) {
  return canonicalPlayerPickerAdapter.listPlayersForClubAware(clubId, options);
}

export async function listPlayersForTenantAware(tenantId, options) {
  return canonicalPlayerPickerAdapter.listPlayersForTenantAware(tenantId, options);
}

export async function listSourceClubsAware(options) {
  return canonicalPlayerPickerAdapter.listSourceClubs(options);
}
