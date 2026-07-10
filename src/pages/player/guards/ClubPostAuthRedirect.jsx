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
 * Phase 42J.2.1 — sole post-login landing redirect (waits for ACTIVE/NONE).
 */
export default function ClubPostAuthRedirect() {
  const membership = useMyClubMembershipFromContext();
  const phase = resolveMembershipPhase(membership);

  if (!membership || isMembershipPhasePending(phase)) {
    return (
      <Box
        sx={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <CircularProgress size={28} aria-label="Đang tải membership" />
      </Box>
    );
  }

  if (phase === MEMBERSHIP_PHASE.ERROR) {
    return (
      <Box
        sx={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          px: 2,
        }}
      >
        <CircularProgress size={28} aria-label="Đang thử lại membership" />
      </Box>
    );
  }

  const target = resolvePostLoginClubPath(membership);
  if (!target) {
    return (
      <Box sx={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <CircularProgress size={28} aria-label="Đang tải membership" />
      </Box>
    );
  }

  return <Navigate to={target} replace />;
}
