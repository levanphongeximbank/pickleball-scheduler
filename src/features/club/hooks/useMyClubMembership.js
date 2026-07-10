import { useCallback, useEffect, useState } from "react";

import { useAuth } from "../../../context/AuthContext.jsx";
import { resolveMyActiveClubMembership } from "../services/clubActiveMembershipService.js";

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

/**
 * Phase 42J — Cloud SSOT membership read hook.
 * Never uses profiles.club_id / player_id / localStorage for hasClub.
 */
export function useMyClubMembership(revision = 0) {
  const { user } = useAuth();
  const [state, setState] = useState(INITIAL);

  const reload = useCallback(async () => {
    if (!user?.id) {
      setState({
        ...INITIAL,
        loading: false,
        ok: false,
        error: "Chưa đăng nhập.",
        source: "anon",
      });
      return;
    }

    setState((prev) => ({ ...prev, loading: true, error: null }));
    const result = await resolveMyActiveClubMembership(user);
    setState({
      loading: false,
      ok: result.ok,
      clubId: result.clubId || null,
      hasActiveMembership: Boolean(result.hasActiveMembership && result.clubId),
      club: result.club || null,
      memberId: result.memberId || null,
      source: result.source || "unknown",
      error: result.ok ? null : result.error || "MEMBERSHIP_LOOKUP_FAILED",
    });
  }, [user]);

  useEffect(() => {
    void reload();
  }, [reload, revision]);

  return {
    ...state,
    reload,
    user,
  };
}
