import { useCallback, useEffect, useRef, useState } from "react";

import { useAuth } from "../../../context/AuthContext.jsx";
import {
  MEMBERSHIP_PHASE,
  isMembershipPhaseReady,
  resolveMembershipPhase,
} from "../membership/membershipState.js";
import {
  getCachedMembershipSnapshot,
  invalidateMyActiveClubMembershipCache,
  resolveMyActiveClubMembership,
} from "../services/clubActiveMembershipService.js";

const PENDING = Object.freeze({
  phase: MEMBERSHIP_PHASE.LOADING,
  loading: true,
  ok: false,
  clubId: null,
  hasActiveMembership: false,
  club: null,
  memberId: null,
  source: "pending",
  error: null,
});

const ANON = Object.freeze({
  phase: MEMBERSHIP_PHASE.IDLE,
  loading: false,
  ok: false,
  clubId: null,
  hasActiveMembership: false,
  club: null,
  memberId: null,
  source: "anon",
  error: "Chưa đăng nhập.",
});

function mapMembershipResult(result) {
  const base = {
    loading: false,
    ok: result.ok,
    clubId: result.clubId || null,
    hasActiveMembership: Boolean(result.hasActiveMembership && result.clubId),
    club: result.club || null,
    memberId: result.memberId || null,
    source: result.source || "unknown",
    error: result.ok ? null : result.error || "MEMBERSHIP_LOOKUP_FAILED",
  };
  return {
    ...base,
    phase: resolveMembershipPhase(base),
  };
}

function buildInitialState(userId) {
  if (!userId) {
    return { ...ANON };
  }
  const cached = getCachedMembershipSnapshot(userId);
  if (cached) {
    return mapMembershipResult(cached);
  }
  return { ...PENDING };
}

/**
 * Phase 42J — Cloud SSOT membership read hook.
 * Phase 42J.2.1 — cache-first; stable userId fetch; no refetch on route navigation.
 */
export function useMyClubMembership(revision = 0, explicitUserId = null) {
  const { user } = useAuth();
  const userId = explicitUserId || user?.id || null;
  const userRef = useRef(user);
  userRef.current = user;

  const [state, setState] = useState(() => buildInitialState(userId));
  const revisionRef = useRef(revision);
  const fetchGenRef = useRef(0);
  const resolvedUserRef = useRef(null);

  const applyResult = useCallback((result) => {
    const mapped = mapMembershipResult(result);
    if (isMembershipPhaseReady(mapped.phase)) {
      resolvedUserRef.current = userId;
    }
    setState(mapped);
  }, [userId]);

  const reload = useCallback(
    async ({ force = false } = {}) => {
      const currentUser = userRef.current;
      const uid = currentUser?.id || null;
      if (!uid) {
        setState({ ...ANON });
        return;
      }

      if (force) {
        invalidateMyActiveClubMembershipCache(uid);
      }

      const cached = !force ? getCachedMembershipSnapshot(uid) : null;
      if (cached) {
        applyResult(cached);
        return;
      }

      const gen = fetchGenRef.current + 1;
      fetchGenRef.current = gen;
      setState((prev) =>
        prev.phase === MEMBERSHIP_PHASE.LOADING
          ? prev
          : { ...PENDING, source: force ? "reload" : "fetch" }
      );

      const result = await resolveMyActiveClubMembership(currentUser);
      if (fetchGenRef.current !== gen) {
        return;
      }
      applyResult(result);
    },
    [applyResult]
  );

  useEffect(() => {
    if (!userId) {
      fetchGenRef.current += 1;
      resolvedUserRef.current = null;
      setState({ ...ANON });
      return;
    }

    const revisionBumped = revision !== revisionRef.current;
    revisionRef.current = revision;

    const cached = getCachedMembershipSnapshot(userId);
    if (cached) {
      applyResult(cached);
      if (!revisionBumped) {
        return;
      }
    }

    if (revisionBumped) {
      resolvedUserRef.current = null;
      void reload({ force: true });
      return;
    }

    if (cached || resolvedUserRef.current === userId) {
      return;
    }

    void reload({ force: false });
  }, [userId, revision, reload, applyResult]);

  return {
    ...state,
    reload: () => reload({ force: true }),
    user,
  };
}
