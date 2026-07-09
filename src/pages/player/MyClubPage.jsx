import { useMemo, useState } from "react";
import { Box, Typography } from "@mui/material";

import { useAuth } from "../../context/AuthContext.jsx";
import { useTenant } from "../../context/TenantContext.jsx";
import { ROLES, isClubScopedRole, normalizeRole } from "../../auth/roles.js";
import {
  canDeleteClub,
  canManageClubGovernance,
  canViewFullClubMembers,
  getClubById,
  getClubStats,
  getGovernanceDisplayLabels,
  getMyClubSummary,
  getRegisteredClusterLabel,
} from "../../features/club/index.js";
import MyClubSummaryCard from "./myClub/MyClubSummaryCard.jsx";
import MyClubJoinPanel from "./myClub/MyClubJoinPanel.jsx";
import MyClubCreatePanel from "./myClub/MyClubCreatePanel.jsx";
import MyClubGovernancePanel from "./myClub/MyClubGovernancePanel.jsx";

export default function MyClubPage() {
  const { user } = useAuth();
  const { currentTenantId } = useTenant();
  const tenantId = currentTenantId || user?.tenantId || user?.venueId || "";
  const [revision, setRevision] = useState(0);

  const clubId = user?.clubId || null;
  const isClubManager = normalizeRole(user?.role) === ROLES.CLUB_MANAGER;

  const clubRecord = useMemo(() => {
    void revision;
    if (!clubId) {
      return null;
    }
    return getClubById(clubId, tenantId);
  }, [clubId, tenantId, revision]);

  const clubSummary = useMemo(() => {
    void revision;
    if (!clubId) {
      return null;
    }
    return getMyClubSummary(clubId, tenantId);
  }, [clubId, tenantId, revision]);

  const clubStats = useMemo(() => {
    if (!clubId) {
      return null;
    }
    return getClubStats(clubId, tenantId);
  }, [clubId, tenantId, revision]);

  const governanceLabels = clubSummary
    ? getGovernanceDisplayLabels({ id: clubId, governance: clubSummary.governance }, tenantId)
    : clubRecord
      ? getGovernanceDisplayLabels(clubRecord, tenantId)
      : null;

  const registeredCluster = clubSummary
    ? getRegisteredClusterLabel({ governance: clubSummary.governance }, tenantId)
    : clubRecord
      ? getRegisteredClusterLabel(clubRecord, tenantId)
      : null;

  const showGovernance =
    clubRecord &&
    user &&
    (canManageClubGovernance(user, clubRecord) || canDeleteClub(user, clubRecord));

  const manageHref =
    clubId && user && canViewFullClubMembers(user, clubRecord)
      ? `/manage/clubs/${clubId}`
      : null;

  if (clubId && clubSummary) {
    return (
      <Box sx={{ p: { xs: 2, md: 3 }, maxWidth: 960, mx: "auto" }}>
        <Typography variant="h5" fontWeight={700} gutterBottom>
          CLB của tôi
        </Typography>

        {showGovernance && (
          <MyClubGovernancePanel
            clubId={clubId}
            tenantId={tenantId}
            revision={revision}
            onRefresh={() => setRevision((value) => value + 1)}
          />
        )}

        <MyClubSummaryCard
          clubSummary={clubSummary}
          clubStats={clubStats}
          governanceLabels={governanceLabels}
          registeredCluster={registeredCluster}
          user={user}
          manageHref={manageHref}
        />
      </Box>
    );
  }

  return (
    <Box sx={{ p: { xs: 2, md: 3 }, maxWidth: 1100, mx: "auto" }}>
      <Typography variant="h5" fontWeight={700} gutterBottom>
        CLB của tôi
      </Typography>

      {!clubId && isClubManager && (
        <Box sx={{ mb: 3 }}>
          <Typography variant="subtitle1" fontWeight={600} gutterBottom>
            Đăng ký CLB mới
          </Typography>
          <MyClubCreatePanel
            tenantId={tenantId}
            user={user}
            onSuccess={() => setRevision((value) => value + 1)}
          />
        </Box>
      )}

      {!clubId && !isClubManager && (
        <>
          <Typography variant="subtitle1" fontWeight={600} gutterBottom>
            Chọn CLB để tham gia
          </Typography>
          <MyClubJoinPanel
            tenantId={tenantId}
            user={user}
            onRevision={() => setRevision((value) => value + 1)}
          />
        </>
      )}

      {!clubId && isClubScopedRole(user?.role) && !isClubManager && (
        <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
          Liên hệ quản trị viên để được gán CLB trên tài khoản.
        </Typography>
      )}
    </Box>
  );
}
