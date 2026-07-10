import { Box, CircularProgress } from "@mui/material";
import { Navigate } from "react-router-dom";

import { useMyClubMembershipFromContext } from "../../../features/club/hooks/MyClubMembershipContext.jsx";
import {
  isMembershipPhasePending,
  MEMBERSHIP_PHASE,
  resolveMembershipPhase,
} from "../../../features/club/membership/membershipState.js";
import { resolvePostLoginClubPath } from "../../../features/club/routing/clubLandingResolver.js";

/**
 * Phase 42J.2.1 — dashboard PLAYER home after membership resolves (replace).
 */
export default function ClubPlayerHomeRedirect() {
  const membership = useMyClubMembershipFromContext();
  const phase = resolveMembershipPhase(membership);

  if (!membership || isMembershipPhasePending(phase) || phase === MEMBERSHIP_PHASE.ERROR) {
    return (
      <Box sx={{ py: 8, display: "flex", justifyContent: "center" }}>
        <CircularProgress size={28} aria-label="Đang tải membership" />
      </Box>
    );
  }

  const target = resolvePostLoginClubPath(membership);
  if (!target) {
    return (
      <Box sx={{ py: 8, display: "flex", justifyContent: "center" }}>
        <CircularProgress size={28} aria-label="Đang tải membership" />
      </Box>
    );
  }

  return <Navigate to={target} replace />;
}
