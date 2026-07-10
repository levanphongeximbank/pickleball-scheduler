import { Box, CircularProgress } from "@mui/material";
import { Navigate } from "react-router-dom";

import { useMyClubMembershipFromContext } from "../../../features/club/hooks/MyClubMembershipContext.jsx";
import { resolveClubAwarePlayerHomePath } from "../../../features/club/routing/clubLandingResolver.js";

/**
 * Phase 42J.2 — one-shot PLAYER home redirect after membership resolves (replace).
 */
export default function ClubPlayerHomeRedirect() {
  const membership = useMyClubMembershipFromContext();

  if (!membership || membership.loading) {
    return (
      <Box sx={{ py: 8, display: "flex", justifyContent: "center" }}>
        <CircularProgress size={28} aria-label="Đang tải membership" />
      </Box>
    );
  }

  const target = resolveClubAwarePlayerHomePath(membership);
  if (!target) {
    return (
      <Box sx={{ py: 8, display: "flex", justifyContent: "center" }}>
        <CircularProgress size={28} aria-label="Đang tải membership" />
      </Box>
    );
  }

  return <Navigate to={target} replace />;
}
