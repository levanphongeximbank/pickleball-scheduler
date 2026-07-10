import { Box, CircularProgress } from "@mui/material";
import { Navigate } from "react-router-dom";

import { useMyClubMembershipFromContext } from "../../../features/club/hooks/MyClubMembershipContext.jsx";
import { resolvePostAuthClubPath } from "../../../features/club/routing/clubLandingResolver.js";

/**
 * Phase 42J.2 — post-login redirect waits for membership; no blind /my-club hop.
 */
export default function ClubPostAuthRedirect({ requestedPath }) {
  const membership = useMyClubMembershipFromContext();

  if (!membership || membership.loading) {
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

  const target = resolvePostAuthClubPath(requestedPath, membership);
  return <Navigate to={target} replace />;
}
