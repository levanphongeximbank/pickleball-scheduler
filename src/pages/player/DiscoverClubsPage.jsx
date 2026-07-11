import { useState } from "react";
import { Box, Divider, Typography } from "@mui/material";

import { useAuth } from "../../context/AuthContext.jsx";
import { useTenant } from "../../context/TenantContext.jsx";
import {
  canSelfRegisterClub,
  canShowCreateClub,
} from "../../features/club/index.js";
import { CLUB_ROUTE_PATHS } from "../../features/club/routing/clubMembershipRouteLogic.js";
import { useRequiredMyClubMembership } from "../../features/club/hooks/MyClubMembershipContext.jsx";
import { ClubFeedbackAlert, ClubPageShell } from "../../features/club/ui/index.js";
import MyClubCreatePanel from "./myClub/MyClubCreatePanel.jsx";
import MyClubDiscoverPanel from "./myClub/MyClubDiscoverPanel.jsx";

export default function DiscoverClubsPage() {
  const { user, refresh } = useAuth();
  const { currentTenantId } = useTenant();
  const tenantId = currentTenantId || user?.tenantId || user?.venueId || "";
  const membership = useRequiredMyClubMembership();
  const { revision, bumpRevision } = membership;
  const [message, setMessage] = useState(null);

  const hasActiveMembership = Boolean(membership.hasActiveMembership && membership.clubId);
  const canCreateClub = canShowCreateClub({
    user,
    hasActiveMembership,
    hasClubCreatePermission: canSelfRegisterClub(user),
  });

  return (
    <ClubPageShell
      title="Khám phá CLB"
      subtitle="Tìm CLB phù hợp, gửi yêu cầu tham gia hoặc tạo CLB mới."
      breadcrumbs={[
        { label: "CLB", href: CLUB_ROUTE_PATHS.MY_CLUB },
        { label: "Khám phá CLB" },
      ]}
    >
      <ClubFeedbackAlert message={message} onClose={() => setMessage(null)} />

      <MyClubDiscoverPanel
        user={user}
        revision={revision}
        onRevision={bumpRevision}
        onMessage={setMessage}
        showHeader={false}
        hasClub={hasActiveMembership}
        activeClubId={membership.clubId}
      />

      {!hasActiveMembership && canCreateClub && (
        <Box sx={{ mt: 4 }}>
          <Divider sx={{ mb: 3 }} />
          <Typography variant="subtitle1" fontWeight={600} gutterBottom>
            Tạo CLB mới
          </Typography>
          <MyClubCreatePanel
            tenantId={tenantId}
            user={user}
            onSuccess={async () => {
              await refresh();
              bumpRevision();
            }}
          />
        </Box>
      )}
    </ClubPageShell>
  );
}
