import { useMemo } from "react";

import { useAuth } from "../../../context/AuthContext.jsx";
import { useMyClubMembershipFromContext } from "./MyClubMembershipContext.jsx";
import {
  canManageClubGovernance,
  canReviewMembershipForClub,
} from "../services/clubGovernanceService.js";

export { canReviewMembershipForClub } from "../services/clubGovernanceService.js";

export function useCanReviewMembership() {
  const { user } = useAuth();
  const membership = useMyClubMembershipFromContext();

  return useMemo(() => {
    if (!membership?.club || !user) {
      return false;
    }
    return canReviewMembershipForClub(user, membership.club);
  }, [membership?.club, user]);
}

export function useCanManageClubGovernanceNav() {
  const { user } = useAuth();
  const membership = useMyClubMembershipFromContext();

  return useMemo(() => {
    if (!membership?.club || !user) {
      return false;
    }
    return canManageClubGovernance(user, membership.club);
  }, [membership?.club, user]);
}
