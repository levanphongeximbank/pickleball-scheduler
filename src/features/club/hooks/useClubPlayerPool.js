import { useEffect, useState } from "react";
import { loadPlayersForClub } from "../../../domain/clubStorage.js";
import {
  listPlayersForClubAware,
  listPlayersForTenantAware,
} from "../repositories/canonicalPlayerPickerAdapter.js";
import { getTenantPlayersLegacy } from "../services/clubTenantService.js";

/**
 * Safe sync legacy blob players for seed / fallback (parity with Players.jsx).
 * @param {string} clubId
 * @returns {Array}
 */
export function loadLegacyClubPlayersSafe(clubId) {
  const id = String(clubId || "").trim();
  if (!id) return [];
  try {
    return loadPlayersForClub(id) || [];
  } catch {
    return [];
  }
}

/**
 * Safe sync legacy tenant aggregate (blob) for seed / fallback.
 * @param {string} tenantId
 * @returns {Array}
 */
export function loadLegacyTenantPlayersSafe(tenantId) {
  const id = String(tenantId || "").trim();
  if (!id) return [];
  try {
    return getTenantPlayersLegacy(id) || [];
  } catch {
    return [];
  }
}

/**
 * Deduplicate player pools by string id (first wins).
 * @param {...Array} pools
 * @returns {Array}
 */
export function mergeLegacyPlayerPools(...pools) {
  const byId = new Map();
  for (const pool of pools) {
    for (const player of pool || []) {
      const key = String(player?.id ?? "").trim();
      if (!key || byId.has(key)) continue;
      byId.set(key, player);
    }
  }
  return Array.from(byId.values());
}

/**
 * Official/Team flow pool: prefer tenant; if empty, host club (parity with /players).
 * Does not invent players across wrong clubs when both are empty.
 * @param {Array} tenantPlayers
 * @param {Array} clubPlayers
 * @returns {Array}
 */
export function resolveFlowPlayersWithClubFallback(tenantPlayers = [], clubPlayers = []) {
  if (Array.isArray(tenantPlayers) && tenantPlayers.length > 0) {
    return tenantPlayers;
  }
  if (Array.isArray(clubPlayers) && clubPlayers.length > 0) {
    return clubPlayers;
  }
  return Array.isArray(tenantPlayers) ? tenantPlayers : [];
}

/**
 * Policy: selectable tournament VĐV must expose a real player id.
 * Canonical adapter already drops UNMAPPED members; this guards UI props.
 * @param {object|null|undefined} player
 * @returns {boolean}
 */
export function isSelectableTournamentPlayer(player) {
  return Boolean(String(player?.id ?? "").trim());
}

/**
 * Resolve pool result with legacy blob fallback when the aware adapter fails.
 * Keeps successful canonical empty results empty (membership SSOT).
 *
 * @param {{ ok?: boolean, legacyPlayers?: Array, warnings?: Array, source?: string|null, mappingSummary?: object|null, message?: string, code?: string }} result
 * @param {string} clubId
 * @param {{ loadLegacy?: (clubId: string) => Array }} [deps]
 */
export function resolveClubPlayerPoolFromAwareResult(result, clubId, deps = {}) {
  const loadLegacy = deps.loadLegacy || loadLegacyClubPlayersSafe;
  if (result?.ok) {
    return {
      players: result.legacyPlayers || [],
      warnings: result.warnings || [],
      source: result.source || null,
      mappingSummary: result.mappingSummary || null,
      usedLegacyFallback: false,
    };
  }

  const legacy = loadLegacy(clubId);
  const fallbackWarning = {
    code: result?.code || "PLAYER_POOL_ADAPTER_FAILED",
    message:
      result?.message ||
      "Không tải được danh sách VĐV canonical — đã dùng danh sách CLB local.",
  };
  return {
    players: legacy,
    warnings: [...(result?.warnings || []), fallbackWarning],
    source: "legacy_fallback",
    mappingSummary: result?.mappingSummary || null,
    usedLegacyFallback: true,
  };
}

/**
 * Resolve tenant pool with legacy blob aggregate fallback when aware adapter fails.
 * Keeps successful canonical empty results empty (membership SSOT).
 *
 * @param {{ ok?: boolean, legacyPlayers?: Array, data?: Array, warnings?: Array, source?: string|null, mappingSummary?: object|null, message?: string, code?: string, error?: string }} result
 * @param {string} tenantId
 * @param {{ loadLegacy?: (tenantId: string) => Array }} [deps]
 */
export function resolveTenantPlayerPoolFromAwareResult(result, tenantId, deps = {}) {
  const loadLegacy = deps.loadLegacy || loadLegacyTenantPlayersSafe;
  if (result?.ok) {
    const players = result.legacyPlayers || result.data || [];
    return {
      players,
      warnings: result.warnings || [],
      source: result.source || null,
      mappingSummary: result.mappingSummary || null,
      usedLegacyFallback: false,
    };
  }

  const legacy = loadLegacy(tenantId);
  const fallbackWarning = {
    code: result?.code || "PLAYER_POOL_ADAPTER_FAILED",
    message:
      result?.message ||
      result?.error ||
      "Không tải được danh sách VĐV tenant canonical — đã dùng tổng hợp CLB local.",
  };
  return {
    players: legacy,
    warnings: [...(result?.warnings || []), fallbackWarning],
    source: "legacy_fallback",
    mappingSummary: result?.mappingSummary || null,
    usedLegacyFallback: true,
  };
}

/**
 * Club-scoped player pool (legacy shape) with canonical flag awareness.
 * Seeds from club blob immediately, then refreshes via aware adapter.
 * On adapter failure / rejection → keep or restore blob (parity with /players).
 *
 * @param {string|null|undefined} clubId
 * @param {{ tenantId?: string|null, revision?: number|string, userContext?: object }} [options]
 */
export function useClubPlayerPool(clubId, options = {}) {
  const { tenantId = null, revision = 0, userContext } = options;
  const initialId = String(clubId || "").trim();
  const [players, setPlayers] = useState(() =>
    initialId ? loadLegacyClubPlayersSafe(initialId) : []
  );
  const [loading, setLoading] = useState(Boolean(initialId));
  const [mappingSummary, setMappingSummary] = useState(null);
  const [warnings, setWarnings] = useState([]);
  const [source, setSource] = useState(initialId ? "legacy_seed" : null);

  useEffect(() => {
    let cancelled = false;
    const id = String(clubId || "").trim();
    if (!id) {
      setPlayers([]);
      setLoading(false);
      setMappingSummary(null);
      setWarnings([]);
      setSource(null);
      return undefined;
    }

    const seed = loadLegacyClubPlayersSafe(id);
    setPlayers(seed);
    setSource(seed.length ? "legacy_seed" : null);
    setWarnings([]);
    setMappingSummary(null);
    setLoading(true);

    listPlayersForClubAware(id, { tenantId, userContext })
      .then((result) => {
        if (cancelled) return;
        const resolved = resolveClubPlayerPoolFromAwareResult(result, id);
        setPlayers(resolved.players);
        setMappingSummary(resolved.mappingSummary);
        setWarnings(resolved.warnings);
        setSource(resolved.source);
      })
      .catch((error) => {
        if (cancelled) return;
        const legacy = seed.length ? seed : loadLegacyClubPlayersSafe(id);
        setPlayers(legacy);
        setMappingSummary(null);
        setWarnings([
          {
            code: "PLAYER_POOL_LOAD_REJECTED",
            message: String(error?.message || error || "Player pool load failed"),
          },
        ]);
        setSource("legacy_fallback");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
    // userContext intentionally omitted from deps — pass stable identity when needed
  }, [clubId, tenantId, revision]);

  return { players, loading, mappingSummary, warnings, source };
}

/**
 * Tenant-scoped player pool (legacy shape).
 * Seeds from tenant blob aggregate, then refreshes via aware adapter.
 * On adapter failure / rejection → keep or restore legacy aggregate
 * (parity with /players + useClubPlayerPool — no silent []).
 *
 * @param {string|null|undefined} tenantId
 * @param {{ revision?: number|string, userContext?: object }} [options]
 */
export function useTenantPlayerPool(tenantId, options = {}) {
  const { revision = 0, userContext } = options;
  const initialId = String(tenantId || "").trim();
  const [players, setPlayers] = useState(() =>
    initialId ? loadLegacyTenantPlayersSafe(initialId) : []
  );
  const [loading, setLoading] = useState(Boolean(initialId));
  const [mappingSummary, setMappingSummary] = useState(null);
  const [warnings, setWarnings] = useState([]);
  const [source, setSource] = useState(initialId ? "legacy_seed" : null);

  useEffect(() => {
    let cancelled = false;
    const id = String(tenantId || "").trim();
    if (!id) {
      setPlayers([]);
      setLoading(false);
      setMappingSummary(null);
      setWarnings([]);
      setSource(null);
      return undefined;
    }

    const seed = loadLegacyTenantPlayersSafe(id);
    setPlayers(seed);
    setSource(seed.length ? "legacy_seed" : null);
    setWarnings([]);
    setMappingSummary(null);
    setLoading(true);

    listPlayersForTenantAware(id, { userContext })
      .then((result) => {
        if (cancelled) return;
        const resolved = resolveTenantPlayerPoolFromAwareResult(result, id);
        setPlayers(resolved.players);
        setMappingSummary(resolved.mappingSummary);
        setWarnings(resolved.warnings);
        setSource(resolved.source);
      })
      .catch((error) => {
        if (cancelled) return;
        const legacy = seed.length ? seed : loadLegacyTenantPlayersSafe(id);
        setPlayers(legacy);
        setMappingSummary(null);
        setWarnings([
          {
            code: "PLAYER_POOL_LOAD_REJECTED",
            message: String(error?.message || error || "Tenant player pool load failed"),
          },
        ]);
        setSource("legacy_fallback");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [tenantId, revision]);

  return { players, loading, mappingSummary, warnings, source };
}
