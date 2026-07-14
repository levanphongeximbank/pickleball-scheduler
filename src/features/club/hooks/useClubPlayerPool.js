import { useEffect, useState } from "react";
import {
  listPlayersForClubAware,
  listPlayersForTenantAware,
} from "../repositories/canonicalPlayerPickerAdapter.js";

/**
 * Club-scoped player pool (legacy shape) with canonical flag awareness.
 * @param {string|null|undefined} clubId
 * @param {{ tenantId?: string|null, revision?: number|string, userContext?: object }} [options]
 */
export function useClubPlayerPool(clubId, options = {}) {
  const { tenantId = null, revision = 0, userContext } = options;
  const [players, setPlayers] = useState([]);
  const [loading, setLoading] = useState(Boolean(clubId));
  const [mappingSummary, setMappingSummary] = useState(null);
  const [warnings, setWarnings] = useState([]);
  const [source, setSource] = useState(null);

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

    setLoading(true);
    listPlayersForClubAware(id, { tenantId, userContext }).then((result) => {
      if (cancelled) return;
      setPlayers(result.ok ? result.legacyPlayers || [] : []);
      setMappingSummary(result.mappingSummary || null);
      setWarnings(result.warnings || []);
      setSource(result.source || null);
      setLoading(false);
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
    listPlayersForTenantAware(id, { userContext }).then((result) => {
      if (cancelled) return;
      setPlayers(result.ok ? result.legacyPlayers || [] : []);
      setMappingSummary(result.mappingSummary || null);
      setWarnings(result.warnings || []);
      setSource(result.source || null);
      setLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [tenantId, revision]);

  return { players, loading, mappingSummary, warnings, source };
}
