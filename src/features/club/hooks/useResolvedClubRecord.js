import { useCallback, useEffect, useState } from "react";

import { getClubById } from "../services/clubTenantService.js";
import { isClubStorageV2Enabled } from "../config/clubRegistryFlags.js";
import { rpcV2ClubGet } from "../services/clubStorageV2RpcService.js";

/**
 * Resolve a single club record for UI surfaces.
 *
 * V2 ON: never fall back to local registry/blob for identity/governance/count.
 *   Prefer seedClub (e.g. membership.club), otherwise rpcV2ClubGet.
 * V2 OFF: legacy getClubById registry behavior.
 *
 * Supports:
 *   useResolvedClubRecord(membership, tenantId)  — My Club / guards
 *   useResolvedClubRecord({ clubId, seedClub, tenantId, revision })
 */
export function useResolvedClubRecord(membershipOrOptions, tenantIdArg) {
  const isExplicitOptions =
    membershipOrOptions &&
    typeof membershipOrOptions === "object" &&
    !("hasActiveMembership" in membershipOrOptions) &&
    ("seedClub" in membershipOrOptions ||
      ("clubId" in membershipOrOptions && !("club" in membershipOrOptions)));

  const options = isExplicitOptions ? membershipOrOptions : null;
  const membership = options ? null : membershipOrOptions;

  const clubId = String(
    options?.clubId || membership?.clubId || membership?.club?.id || ""
  ).trim() || null;
  const tenantId = options?.tenantId ?? tenantIdArg ?? null;
  const revision = options?.revision ?? 0;
  const seedClub =
    options?.seedClub ||
    (membership?.club?.id && membership.club.id === clubId ? membership.club : null);

  const [clubRecord, setClubRecord] = useState(() => {
    if (seedClub) return seedClub;
    if (!clubId) return null;
    if (isClubStorageV2Enabled()) return null;
    return getClubById(clubId, tenantId);
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const applySeedOrFetch = useCallback(
    (forceFetch = false) => {
      if (!clubId) {
        setClubRecord(null);
        setLoading(false);
        setError(null);
        return undefined;
      }

      if (!isClubStorageV2Enabled()) {
        setClubRecord(getClubById(clubId, tenantId));
        setLoading(false);
        setError(null);
        return undefined;
      }

      if (seedClub && !forceFetch) {
        setClubRecord(seedClub);
        setLoading(false);
        setError(null);
        return undefined;
      }

      let cancelled = false;
      setLoading(true);
      setError(null);
      void rpcV2ClubGet(clubId).then((result) => {
        if (cancelled) return;
        if (!result.ok) {
          setClubRecord(seedClub || null);
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
    },
    [clubId, tenantId, seedClub]
  );

  useEffect(() => {
    return applySeedOrFetch(false);
  }, [applySeedOrFetch, revision]);

  const reload = useCallback(() => {
    if (isClubStorageV2Enabled()) {
      applySeedOrFetch(true);
      return;
    }
    if (!clubId) {
      setClubRecord(null);
      return;
    }
    setClubRecord(getClubById(clubId, tenantId));
  }, [applySeedOrFetch, clubId, tenantId]);

  return { clubRecord, clubLoading: loading, clubError: error, reload };
}
