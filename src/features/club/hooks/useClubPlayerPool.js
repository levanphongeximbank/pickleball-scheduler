import { useEffect, useState } from "react";
import { loadPlayersForClub } from "../../../domain/clubStorage.js";
import {
  listPlayersForClubAware,
  listPlayersForTenantAware,
} from "../repositories/canonicalPlayerPickerAdapter.js";

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
 * @param {string|null|undefined} tenantId
 * @param {{ revision?: number|string, userContext?: object }} [options]
 */
export function useTenantPlayerPool(tenantId, options = {}) {
  const { revision = 0, userContext } = options;
  const [players, setPlayers] = useState([]);
  const [loading, setLoading] = useState(Boolean(tenantId));
  const [mappingSummary, setMappingSummary] = useState(null);
  const [warnings, setWarnings] = useState([]);
  const [source, setSource] = useState(null);

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

    setLoading(true);
    listPlayersForTenantAware(id, { userContext })
      .then((result) => {
        if (cancelled) return;
        setPlayers(result.ok ? result.legacyPlayers || [] : []);
        setMappingSummary(result.mappingSummary || null);
        setWarnings(result.warnings || []);
        setSource(result.source || null);
      })
      .catch((error) => {
        if (cancelled) return;
        setPlayers([]);
        setMappingSummary(null);
        setWarnings([
          {
            code: "PLAYER_POOL_LOAD_REJECTED",
            message: String(error?.message || error || "Tenant player pool load failed"),
          },
        ]);
        setSource(null);
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
