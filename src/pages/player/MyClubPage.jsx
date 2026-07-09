import { useEffect, useMemo, useState } from "react";
import { Alert, Box, Divider, Typography } from "@mui/material";
import { useSearchParams } from "react-router-dom";

import { useAuth } from "../../context/AuthContext.jsx";
import { useTenant } from "../../context/TenantContext.jsx";
import {
  canDeleteClub,
  canManageClubGovernance,
  canSelfRegisterClub,
  canViewFullClubMembers,
  getClubById,
  getClubStats,
  getGovernanceDisplayLabels,
  getMyClubSummary,
  getRegisteredClusterLabel,
  leaveMyClub,
  listDiscoverableClubs,
} from "../../features/club/index.js";
import MyClubSummaryCard from "./myClub/MyClubSummaryCard.jsx";
import MyClubCreatePanel from "./myClub/MyClubCreatePanel.jsx";
import MyClubGovernancePanel from "./myClub/MyClubGovernancePanel.jsx";
import MyClubActionBar from "./myClub/MyClubActionBar.jsx";
import MyClubDiscoverPanel from "./myClub/MyClubDiscoverPanel.jsx";
import MyClubSchedulePanel from "./myClub/MyClubSchedulePanel.jsx";
import JoinClubDialog from "./myClub/JoinClubDialog.jsx";

function resolveInitialView(hasClub, searchParams) {
  const viewParam = searchParams.get("view");
  if (viewParam === "discover" || viewParam === "home" || viewParam === "schedule") {
    return viewParam;
  }
  return hasClub ? "home" : "discover";
}

export default function MyClubPage() {
  const { user, refresh } = useAuth();
  const { currentTenantId } = useTenant();
  const [searchParams, setSearchParams] = useSearchParams();
  const tenantId = currentTenantId || user?.tenantId || user?.venueId || "";
  const [revision, setRevision] = useState(0);
  const [message, setMessage] = useState(null);
  const [joinDialogOpen, setJoinDialogOpen] = useState(false);
  const [leaveLoading, setLeaveLoading] = useState(false);

  const clubId = user?.clubId || user?.club_id || null;
  const hasClub = Boolean(clubId);
  const canCreateClub = canSelfRegisterClub(user);

  const [view, setView] = useState(() => resolveInitialView(hasClub, searchParams));

  useEffect(() => {
    setView(resolveInitialView(hasClub, searchParams));
  }, [hasClub, searchParams]);

  const handleViewChange = (nextView) => {
    setView(nextView);
    const nextParams = new URLSearchParams(searchParams);
    if (nextView === "home") {
      nextParams.delete("view");
    } else {
      nextParams.set("view", nextView);
    }
    setSearchParams(nextParams, { replace: true });
  };

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

  const discoverableClubs = useMemo(() => {
    void revision;
    return listDiscoverableClubs();
  }, [revision]);

  const bumpRevision = () => setRevision((value) => value + 1);

  const handleLeaveClub = async () => {
    const confirmed = window.confirm(
      "Bạn có chắc muốn rời CLB hiện tại? Bạn sẽ cần gửi yêu cầu mới để tham gia lại."
    );
    if (!confirmed) {
      return;
    }

    setLeaveLoading(true);
    try {
      const result = await leaveMyClub({ user, tenantId });
      if (!result.ok) {
        setMessage({ type: "error", text: result.error });
        return;
      }
      setMessage({ type: "success", text: "Đã rời CLB." });
      await refresh();
      bumpRevision();
      handleViewChange("discover");
    } finally {
      setLeaveLoading(false);
    }
  };

  return (
    <Box sx={{ p: { xs: 2, md: 3 }, maxWidth: 1100, mx: "auto" }}>
      <Typography variant="h5" fontWeight={700} gutterBottom>
        CLB của tôi
      </Typography>

      {!hasClub && (
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Tìm CLB phù hợp, gửi yêu cầu tham gia hoặc tạo CLB mới.
        </Typography>
      )}

      <MyClubActionBar
        activeView={view}
        onViewChange={handleViewChange}
        hasClub={hasClub}
        onJoinClick={() => setJoinDialogOpen(true)}
        onLeaveClick={handleLeaveClub}
        leaveLoading={leaveLoading}
      />

      {message && (
        <Alert severity={message.type} sx={{ mb: 2 }} onClose={() => setMessage(null)}>
          {message.text}
        </Alert>
      )}

      {view === "schedule" && hasClub ? (
        <MyClubSchedulePanel
          clubId={clubId}
          tenantId={tenantId}
          user={user}
          clubRecord={clubRecord}
          revision={revision}
          onRevision={bumpRevision}
          onMessage={setMessage}
        />
      ) : view === "home" && hasClub && clubSummary ? (
        <>
          <MyClubSummaryCard
            clubSummary={clubSummary}
            clubStats={clubStats}
            governanceLabels={governanceLabels}
            registeredCluster={registeredCluster}
            user={user}
            manageHref={manageHref}
          />

          {showGovernance && (
            <Box sx={{ mt: 3 }}>
              <MyClubGovernancePanel
                clubId={clubId}
                tenantId={tenantId}
                revision={revision}
                onRefresh={bumpRevision}
              />
            </Box>
          )}
        </>
      ) : (
        <MyClubDiscoverPanel
          user={user}
          revision={revision}
          onRevision={bumpRevision}
          onMessage={setMessage}
          showHeader={hasClub}
        />
      )}

      {!hasClub && canCreateClub && (
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
              handleViewChange("home");
            }}
          />
        </Box>
      )}

      <JoinClubDialog
        open={joinDialogOpen}
        onClose={() => setJoinDialogOpen(false)}
        user={user}
        clubs={discoverableClubs}
        onSuccess={(text) => {
          setMessage({ type: "success", text });
          setJoinDialogOpen(false);
          bumpRevision();
        }}
        onError={(text) => setMessage({ type: "error", text })}
      />
    </Box>
  );
}
