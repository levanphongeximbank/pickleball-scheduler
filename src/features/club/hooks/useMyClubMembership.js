import { useCallback, useEffect, useRef, useState } from "react";

import { useAuth } from "../../../context/AuthContext.jsx";
import {
  getCachedMembershipSnapshot,
  invalidateMyActiveClubMembershipCache,
  resolveMyActiveClubMembership,
} from "../services/clubActiveMembershipService.js";

const INITIAL = Object.freeze({
  loading: true,
  ok: false,
  clubId: null,
  hasActiveMembership: false,
  club: null,
  memberId: null,
  source: "init",
  error: null,
});

function mapMembershipResult(result) {
  return {
    loading: false,
    ok: result.ok,
    clubId: result.clubId || null,
    hasActiveMembership: Boolean(result.hasActiveMembership && result.clubId),
    club: result.club || null,
    memberId: result.memberId || null,
    source: result.source || "unknown",
    error: result.ok ? null : result.error || "MEMBERSHIP_LOOKUP_FAILED",
  };
}

function buildInitialState(userId) {
  if (!userId) {
    return { ...INITIAL, loading: false, source: "anon", error: "Chưa đăng nhập." };
  }
  const cached = getCachedMembershipSnapshot(userId);
  if (cached) {
    return mapMembershipResult(cached);
  }
  return INITIAL;
}

/**
 * Phase 42J — Cloud SSOT membership read hook.
 * Phase 42J.2 — cache-first; one in-flight RPC per user via service dedupe.
 */
export function useMyClubMembership(revision = 0) {
  const { user } = useAuth();
  const userId = user?.id || null;
  const [state, setState] = useState(() => buildInitialState(userId));
  const revisionRef = useRef(revision);

  const reload = useCallback(
    async ({ force = true } = {}) => {
      if (!userId) {
        setState({
          ...INITIAL,
          loading: false,
          ok: false,
          error: "Chưa đăng nhập.",
          source: "anon",
        });
        return;
      }

      if (force) {
        invalidateMyActiveClubMembershipCache(userId);
      }

      const cached = !force ? getCachedMembershipSnapshot(userId) : null;
      if (cached) {
        setState(mapMembershipResult(cached));
        return;
      }

      setState((prev) => ({ ...prev, loading: true, error: null }));
      const result = await resolveMyActiveClubMembership(user);
      setState(mapMembershipResult(result));
    },
    [user, userId]
  );

  useEffect(() => {
    if (!userId) {
      setState(buildInitialState(null));
      return;
    }

    const revisionBumped = revision !== revisionRef.current;
    revisionRef.current = revision;

    if (revisionBumped) {
      void reload({ force: true });
      return;
    }

    const cached = getCachedMembershipSnapshot(userId);
    if (cached) {
      setState(mapMembershipResult(cached));
      return;
    }

    void reload({ force: false });
  }, [userId, revision, reload]);

  return {
    ...state,
    reload: () => reload({ force: true }),
    user,
  };
}
