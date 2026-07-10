import { useEffect, useMemo, useState } from "react";

import { getClubById } from "../services/clubTenantService.js";
import { isClubStorageV2Enabled } from "../config/clubRegistryFlags.js";
import { rpcV2ClubGet } from "../services/clubStorageV2RpcService.js";

/**
 * Resolve club record for active membership (V2 RPC fallback when local registry empty).
 */
export function useResolvedClubRecord(membership, tenantId) {
  const clubId = membership?.clubId || null;

  const seedClub = useMemo(() => {
    if (!clubId) {
      return null;
    }
    if (membership?.club?.id === clubId) {
      return membership.club;
    }
    return getClubById(clubId, tenantId);
  }, [clubId, tenantId, membership?.club]);

  const [clubRecord, setClubRecord] = useState(seedClub);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    setClubRecord(seedClub);
    if (seedClub || !clubId || !isClubStorageV2Enabled()) {
      setLoading(false);
      setError(null);
      return undefined;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    void rpcV2ClubGet(clubId).then((result) => {
      if (cancelled) {
        return;
      }
      if (!result.ok) {
        setClubRecord(null);
        setError(result.error || "Không tải được thông tin CLB.");
        setLoading(false);
        return;
      }
      setClubRecord(result.club || null);
      setLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [clubId, seedClub]);

  const reload = () => {
    if (seedClub) {
      setClubRecord(seedClub);
      return;
    }
    if (!clubId) {
      return;
    }
    setLoading(true);
    setError(null);
    void rpcV2ClubGet(clubId).then((result) => {
      if (!result.ok) {
        setClubRecord(null);
        setError(result.error || "Không tải được thông tin CLB.");
      } else {
        setClubRecord(result.club || null);
      }
      setLoading(false);
    });
  };

  return { clubRecord, clubLoading: loading, clubError: error, reload };
}
