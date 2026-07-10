import { useState } from "react";
import { Alert, Box, Button, Typography } from "@mui/material";
import { Link as RouterLink } from "react-router-dom";

import { useAuth } from "../../context/AuthContext.jsx";
import { useTenant } from "../../context/TenantContext.jsx";
import { useRequiredMyClubMembership } from "../../features/club/hooks/MyClubMembershipContext.jsx";
import { useResolvedClubRecord } from "../../features/club/hooks/useResolvedClubRecord.js";
import { CLUB_ROUTE_PATHS } from "../../features/club/routing/clubMembershipRouteLogic.js";
import ClubMembershipRequestsGuard from "./guards/ClubMembershipRequestsGuard.jsx";
import MyClubMembershipRequestsPanel from "./myClub/MyClubMembershipRequestsPanel.jsx";

function MyClubRequestsContent() {
  const { user } = useAuth();
  const { currentTenantId } = useTenant();
  const tenantId = currentTenantId || user?.tenantId || user?.venueId || "";
  const { revision, bumpRevision } = useRequiredMyClubMembership();
  const [message, setMessage] = useState(null);
  const membership = useRequiredMyClubMembership();
  const clubId = membership.clubId;
  const { clubRecord } = useResolvedClubRecord(membership, tenantId);

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
        onRefresh={bumpRevision}
        onMessage={setMessage}
      />
    </Box>
  );
}

export default function MyClubRequestsPage() {
  return (
    <ClubMembershipRequestsGuard>
      <MyClubRequestsContent />
    </ClubMembershipRequestsGuard>
  );
}
