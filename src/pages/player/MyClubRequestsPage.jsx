import { useMemo, useState } from "react";
import { Alert, Box, Button, Typography } from "@mui/material";
import { Link as RouterLink, Navigate } from "react-router-dom";

import { useAuth } from "../../context/AuthContext.jsx";
import { useTenant } from "../../context/TenantContext.jsx";
import {
  canApproveClubMembershipRequests,
  getClubById,
} from "../../features/club/index.js";
import { useMyClubMembership } from "../../features/club/hooks/useMyClubMembership.js";
import { CLUB_ROUTE_PATHS } from "../../features/club/routing/clubMembershipRouteLogic.js";
import ClubActiveMembershipGuard from "./guards/ClubActiveMembershipGuard.jsx";
import MyClubMembershipRequestsPanel from "./myClub/MyClubMembershipRequestsPanel.jsx";

function MyClubRequestsContent() {
  const { user } = useAuth();
  const { currentTenantId } = useTenant();
  const tenantId = currentTenantId || user?.tenantId || user?.venueId || "";
  const [revision, setRevision] = useState(0);
  const [message, setMessage] = useState(null);
  const membership = useMyClubMembership(revision);

  const clubId = membership.clubId;
  const clubRecord = useMemo(() => {
    if (!clubId) {
      return null;
    }
    if (membership.club?.id === clubId) {
      return membership.club;
    }
    return getClubById(clubId, tenantId);
  }, [clubId, tenantId, membership.club]);

  const canReview =
    clubRecord && user && canApproveClubMembershipRequests(user, clubRecord);

  if (!canReview) {
    return <Navigate to={CLUB_ROUTE_PATHS.MY_CLUB} replace />;
  }

  return (
    <Box sx={{ p: { xs: 2, md: 3 }, maxWidth: 1100, mx: "auto" }}>
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 2 }}>
        <Typography variant="h5" fontWeight={700}>
          Yêu cầu gia nhập
        </Typography>
        <Button component={RouterLink} to={CLUB_ROUTE_PATHS.MY_CLUB} variant="outlined" size="small">
          Về CLB của tôi
        </Button>
      </Box>

      {message && (
        <Alert severity={message.type} sx={{ mb: 2 }} onClose={() => setMessage(null)}>
          {message.text}
        </Alert>
      )}

      <MyClubMembershipRequestsPanel
        clubId={clubId}
        clubRecord={clubRecord}
        tenantId={tenantId}
        user={user}
        revision={revision}
        onRefresh={() => setRevision((value) => value + 1)}
        onMessage={setMessage}
      />
    </Box>
  );
}

export default function MyClubRequestsPage() {
  return (
    <ClubActiveMembershipGuard>
      <MyClubRequestsContent />
    </ClubActiveMembershipGuard>
  );
}
