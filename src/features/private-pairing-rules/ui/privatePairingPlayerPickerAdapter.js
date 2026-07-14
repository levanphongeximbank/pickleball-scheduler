/**
 * Shared picker adapter for Private Pairing (and reusable by Daily Play / Tournament later).
 * When canonical player/club flags are OFF, falls back to legacy blob/registry.
 */

import { loadPlayersForClub } from "../../../domain/clubStorage.js";
import { listClubsForTenant as legacyListClubsForTenant } from "../../tenant/guards/tenantGuard.js";
import {
  createCanonicalClubRepository,
  createCanonicalPlayerRepository,
  isCanonicalClubRepositoryEnabled,
  isCanonicalPlayerRepositoryEnabled,
  isLocalDefaultClub,
  MAPPING_STATUS,
  CANONICAL_WARNING_CODE,
} from "../../club/repositories/index.js";
const NO_SOURCE_CLUB_MESSAGE = "Vui lòng chọn CLB nguồn trước.";
const NO_CLUB_MESSAGE = "Vui lòng chọn CLB trước khi tạo Rule Set.";
const NO_PLAYERS_IN_CLUB_MESSAGE = "CLB này chưa có vận động viên.";

export const PRIVATE_PAIRING_PICKER_MESSAGES = Object.freeze({
  NO_SOURCE_CLUB_MESSAGE,
  NO_CLUB_MESSAGE,
  NO_PLAYERS_IN_CLUB_MESSAGE,
});

/**
 * @param {object[]} players
 * @param {string|null} clubId
 * @param {string|null} clubName
 */
export function buildPrivatePairingPlayerOptions(players, clubId, clubName) {
  return (players || [])
    .map((player) => {
      const id = String(player?.playerId || player?.id || "").trim();
      if (!id) return null;

      // Never expose profileId / authUserId as the selectable option id
      if (player?.mappingStatus === MAPPING_STATUS.UNMAPPED) {
        return null;
      }
      if (player?.mappingStatus === MAPPING_STATUS.INVALID) {
        return null;
      }
      if (player?.metadata?.selectable === false) {
        return null;
      }

      let rating = "—";
      if (player?.rating != null && player.rating !== "") {
        rating = String(player.rating);
      }

      const name = String(player?.displayName || player?.name || "").trim() || id;
      const clubLabel = clubName || clubId || "—";
      return {
        id,
        name,
        rating,
        clubId: clubId || player?.clubId || null,
        clubName: clubLabel,
        mappingStatus: player?.mappingStatus || MAPPING_STATUS.MAPPED,
        label: `${name} · ${rating} · ${clubLabel}`,
      };
    })
    .filter(Boolean);
}

/**
 * Validate rule draft IDs are canonical player ids (not profile/auth).
 * @param {{ primaryPlayerId?: string, targetPlayerIds?: string[] }} draft
 * @param {object[]} selectableOptions
 */
export function assertPairingPlayerIdsAreCanonical(draft, selectableOptions = []) {
  const allowed = new Set(selectableOptions.map((o) => String(o.id)));
  const primary = String(draft?.primaryPlayerId || "").trim();
  const targets = (draft?.targetPlayerIds || []).map((id) => String(id || "").trim()).filter(Boolean);

  if (!primary || !allowed.has(primary)) {
    return {
      ok: false,
      code: CANONICAL_WARNING_CODE.PLAYER_MAPPING_REQUIRED,
      message: "Primary player must be a mapped canonical playerId.",
    };
  }

  for (const targetId of targets) {
    if (targetId === primary) {
      return { ok: false, code: "SELF_TARGET_NOT_ALLOWED", message: "Target must not equal primary." };
    }
    if (!allowed.has(targetId)) {
      return {
        ok: false,
        code: CANONICAL_WARNING_CODE.PLAYER_MAPPING_REQUIRED,
        message: "Target players must be mapped canonical playerIds.",
      };
    }
  }

  if (targets.length === 0) {
    return { ok: false, code: "EMPTY_TARGET_LIST", message: "At least one target is required." };
  }

  return { ok: true, primaryPlayerId: primary, targetPlayerIds: targets };
}

/**
 * @param {object} [deps]
 */
export function createPrivatePairingPlayerPickerAdapter(deps = {}) {
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
        source: "legacy_blob",
      }));

    return {
      ok: true,
      data,
      source: "legacy_blob",
      warnings: [],
      mappingSummary: {},
      execution: { mode: "legacy" },
    };
  }

  async function listPickerPlayers({ clubId, tenantId, userContext, profilesByUserId } = {}) {
    const id = String(clubId || "").trim();
    if (!id) {
      return {
        ok: true,
        data: [],
        options: [],
        source: "none",
        warnings: [],
        mappingSummary: {},
        emptyMessage: NO_SOURCE_CLUB_MESSAGE,
      };
    }

    if (isLocalDefaultClub(id) && isClubCanonical()) {
      return {
        ok: false,
        code: "DEFAULT_CLUB_NOT_ALLOWED",
        message: "default-club cannot be used as Private Pairing source club under V2.",
        data: [],
        options: [],
        warnings: [{ code: CANONICAL_WARNING_CODE.DEFAULT_CLUB_EXCLUDED }],
      };
    }

    if (isPlayerCanonical()) {
      const playersResult = await playerRepository.listPlayersForClub(id, {
        tenantId,
        userContext,
        profilesByUserId:
          profilesByUserId instanceof Map ? profilesByUserId : undefined,
      });
      if (!playersResult.ok) return playersResult;

      let resolvedClubName = id;
      const clubHit = await clubRepository.getClubById(id, { userContext });
      if (clubHit?.ok) resolvedClubName = clubHit.data?.name || id;

      const options = buildPrivatePairingPlayerOptions(
        playersResult.data,
        id,
        resolvedClubName
      );

      return {
        ...playersResult,
        options,
        emptyMessage:
          options.length === 0
            ? playersResult.mappingSummary?.unmappedMembers > 0
              ? "CLB có thành viên active nhưng chưa map playerId (xem warning)."
              : NO_PLAYERS_IN_CLUB_MESSAGE
            : null,
      };
    }

    let players;
    try {
      players = legacyLoadPlayers(id) || [];
    } catch {
      players = [];
    }
    const normalized = players.map((p) => ({
      ...p,
      playerId: p.id,
      displayName: p.name || p.id,
      mappingStatus: MAPPING_STATUS.MAPPED,
      metadata: { selectable: true },
    }));
    const options = buildPrivatePairingPlayerOptions(normalized, id, id);
    return {
      ok: true,
      data: normalized,
      options,
      source: "legacy_blob",
      warnings: [],
      mappingSummary: {
        mappedPlayers: options.length,
        unmappedMembers: 0,
        activeMembers: options.length,
      },
      emptyMessage: options.length === 0 ? NO_PLAYERS_IN_CLUB_MESSAGE : null,
      execution: { mode: "legacy", clubId: id },
    };
  }

  return {
    listSourceClubs,
    listPickerPlayers,
    buildPrivatePairingPlayerOptions,
    assertPairingPlayerIdsAreCanonical,
    messages: PRIVATE_PAIRING_PICKER_MESSAGES,
  };
}

export const privatePairingPlayerPickerAdapter = createPrivatePairingPlayerPickerAdapter();
