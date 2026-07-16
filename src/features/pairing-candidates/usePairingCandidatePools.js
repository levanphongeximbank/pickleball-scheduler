/**
 * PHASE 45B.5B — React hooks for pairing-candidate screen pools.
 * Surfaces loading + explicit error (never silent empty on repo failure).
 */

import { useEffect, useState } from "react";
import {
  loadClubPairingCandidatePool,
  loadTenantPairingCandidatePool,
} from "./screenCandidateAdapters.js";

/**
 * @param {string|null|undefined} clubId
 * @param {{ tenantId?: string|null, revision?: number|string }} [options]
 */
export function useClubPairingCandidatePool(clubId, options = {}) {
  const { tenantId = null, revision = 0 } = options;
  const [players, setPlayers] = useState([]);
  const [loading, setLoading] = useState(Boolean(clubId));
  const [error, setError] = useState(null);
  const [emptyMessage, setEmptyMessage] = useState(null);

  useEffect(() => {
    let cancelled = false;
    const id = String(clubId || "").trim();
    if (!id) {
      setPlayers([]);
      setLoading(false);
      setError(null);
      setEmptyMessage(null);
      return undefined;
    }

    setLoading(true);
    setError(null);
    setEmptyMessage(null);

    loadClubPairingCandidatePool(id, { tenantId }).then((result) => {
      if (cancelled) return;
      if (!result.ok) {
        setPlayers([]);
        setError({
          code: result.code || "REPOSITORY_ERROR",
          message:
            result.message ||
            "Không tải được danh sách VĐV canonical. Không dùng roster blob.",
        });
        setEmptyMessage(null);
        setLoading(false);
        return;
      }
      setPlayers(Array.isArray(result.players) ? result.players : []);
      setError(null);
      setEmptyMessage(result.empty ? result.message || null : null);
      setLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [clubId, tenantId, revision]);

  return { players, loading, error, emptyMessage, source: "pairing-candidate-gateway" };
}

/**
 * @param {string|null|undefined} tenantId
 * @param {{ revision?: number|string }} [options]
 */
export function useTenantPairingCandidatePool(tenantId, options = {}) {
  const { revision = 0 } = options;
  const [players, setPlayers] = useState([]);
  const [loading, setLoading] = useState(Boolean(tenantId));
  const [error, setError] = useState(null);
  const [emptyMessage, setEmptyMessage] = useState(null);

  useEffect(() => {
    let cancelled = false;
    const id = String(tenantId || "").trim();
    if (!id) {
      setPlayers([]);
      setLoading(false);
      setError(null);
      setEmptyMessage(null);
      return undefined;
    }

    setLoading(true);
    setError(null);
    setEmptyMessage(null);

    loadTenantPairingCandidatePool(id).then((result) => {
      if (cancelled) return;
      if (!result.ok) {
        setPlayers([]);
        setError({
          code: result.code || "REPOSITORY_ERROR",
          message:
            result.message ||
            "Không tải được danh sách VĐV canonical. Không dùng roster blob.",
        });
        setEmptyMessage(null);
        setLoading(false);
        return;
      }
      setPlayers(Array.isArray(result.players) ? result.players : []);
      setError(null);
      setEmptyMessage(result.empty ? result.message || null : null);
      setLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [tenantId, revision]);

  return { players, loading, error, emptyMessage, source: "pairing-candidate-gateway" };
}
