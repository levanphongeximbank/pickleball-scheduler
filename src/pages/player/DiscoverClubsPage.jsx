import { useState } from "react";
import { Alert, Box, Divider, Typography } from "@mui/material";

import { useAuth } from "../../context/AuthContext.jsx";
import { useTenant } from "../../context/TenantContext.jsx";
import {
  canSelfRegisterClub,
  canShowCreateClub,
} from "../../features/club/index.js";
import { useMyClubMembership } from "../../features/club/hooks/useMyClubMembership.js";
import MyClubCreatePanel from "./myClub/MyClubCreatePanel.jsx";
import MyClubDiscoverPanel from "./myClub/MyClubDiscoverPanel.jsx";

export default function DiscoverClubsPage() {
  const { user, refresh } = useAuth();
  const { currentTenantId } = useTenant();
  const tenantId = currentTenantId || user?.tenantId || user?.venueId || "";
  const [revision, setRevision] = useState(0);
  const [message, setMessage] = useState(null);
  const membership = useMyClubMembership(revision);

  const hasActiveMembership = Boolean(membership.hasActiveMembership && membership.clubId);
  const canCreateClub = canShowCreateClub({
    user,
    hasActiveMembership,
    hasClubCreatePermission: canSelfRegisterClub(user),
  });

  const bumpRevision = () => setRevision((value) => value + 1);

  return (
    <Box sx={{ p: { xs: 2, md: 3 }, maxWidth: 1100, mx: "auto" }}>
      <Typography variant="h5" fontWeight={700} gutterBottom>
        Khám phá CLB
      </Typography>

      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Tìm CLB phù hợp, gửi yêu cầu tham gia hoặc tạo CLB mới.
      </Typography>

      {message && (
        <Alert severity={message.type} sx={{ mb: 2 }} onClose={() => setMessage(null)}>
          {message.text}
        </Alert>
      )}

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
    </Box>
  );
}
