import { useEffect, useMemo, useState } from "react";
import { Alert, Box, Button } from "@mui/material";
import { useNavigate, useSearchParams } from "react-router-dom";

import { useAuth } from "../../context/AuthContext.jsx";
import { useTenant } from "../../context/TenantContext.jsx";
import {
  canApproveClubMembershipRequests,
  canDeleteClub,
  canManageClubGovernance,
  canViewFullClubMembers,
  fetchGovernanceNameHints,
  getClubById,
  getClubStats,
  getGovernanceDisplayLabels,
  getMyClubSummary,
  getRegisteredClusterLabel,
  getVicePresidentUserIds,
  leaveMyClub,
} from "../../features/club/index.js";
import { useRequiredMyClubMembership } from "../../features/club/hooks/MyClubMembershipContext.jsx";
import { buildMyClubSummaryFromClub } from "../../features/club/services/clubActiveMembershipService.js";
import { isClubStorageV2Enabled } from "../../features/club/config/clubRegistryFlags.js";
import { CLUB_ROUTE_PATHS } from "../../features/club/routing/clubMembershipRouteLogic.js";
import {
  ClubConfirmDialog,
  ClubFeedbackAlert,
  ClubPageShell,
  MyClubHomeInsights,
} from "../../features/club/ui/index.js";
import ClubActiveMembershipGuard from "./guards/ClubActiveMembershipGuard.jsx";
import MyClubSummaryCard from "./myClub/MyClubSummaryCard.jsx";
import MyClubGovernancePanel from "./myClub/MyClubGovernancePanel.jsx";
import MyClubActionBar from "./myClub/MyClubActionBar.jsx";
import MyClubSchedulePanel from "./myClub/MyClubSchedulePanel.jsx";
import MyClubMembersPanel from "./myClub/MyClubMembersPanel.jsx";
import { resolveInitialView } from "./myClub/myClubViewLogic.js";

function MyClubPageContent() {
  const { user, refresh } = useAuth();
  const { currentTenantId } = useTenant();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const tenantId = currentTenantId || user?.tenantId || user?.venueId || "";
  const membership = useRequiredMyClubMembership();
  const { revision, bumpRevision } = membership;
  const clubId = membership.clubId;
  const hasClub = Boolean(membership.hasActiveMembership && clubId);

  const [message, setMessage] = useState(null);
  const [leaveLoading, setLeaveLoading] = useState(false);
  const [leaveConfirmOpen, setLeaveConfirmOpen] = useState(false);
  const [nameHints, setNameHints] = useState({});

  const [view, setView] = useState(() => resolveInitialView(true, searchParams));

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

  useEffect(() => {
    setView(resolveInitialView(hasClub, searchParams));
  }, [hasClub, searchParams]);

  const clubRecord = useMemo(() => {
    void revision;
    if (!clubId) {
      return null;
    }
    if (membership.club?.id === clubId) {
      return membership.club;
    }
    return getClubById(clubId, tenantId);
  }, [clubId, tenantId, revision, membership.club]);

  const clubSummary = useMemo(() => {
    void revision;
    if (!clubId) {
      return null;
    }
    if (isClubStorageV2Enabled() && membership.club?.id === clubId) {
      const fromRpc = buildMyClubSummaryFromClub(membership.club);
      if (fromRpc) {
        return fromRpc;
      }
    }
    return getMyClubSummary(clubId, tenantId);
  }, [clubId, tenantId, revision, membership.club]);

  const clubStats = useMemo(() => {
    if (!clubId) {
      return null;
    }
    return getClubStats(clubId, tenantId);
  }, [clubId, tenantId, revision]);

  useEffect(() => {
    let cancelled = false;
    const gov = clubSummary?.governance || clubRecord?.governance || {};
    const ids = [
      gov.presidentUserId,
      gov.ownerUserId,
      ...getVicePresidentUserIds(gov),
    ].filter(Boolean);

    if (ids.length === 0) {
      setNameHints({});
      return undefined;
    }

    void fetchGovernanceNameHints(ids).then((hints) => {
      if (!cancelled) {
        setNameHints(hints);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [
    clubId,
    clubSummary?.governance?.presidentUserId,
    clubSummary?.governance?.ownerUserId,
    clubSummary?.governance?.vicePresidentUserId,
    clubSummary?.governance?.vicePresidentUserIds,
    clubRecord?.governance?.presidentUserId,
    clubRecord?.governance?.ownerUserId,
    revision,
  ]);

  const governanceLabels = clubSummary
    ? getGovernanceDisplayLabels(
        { id: clubId, governance: clubSummary.governance },
        tenantId,
        nameHints
      )
    : clubRecord
      ? getGovernanceDisplayLabels(clubRecord, tenantId, nameHints)
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

  const showRequestsLink =
    Boolean(clubRecord && user && canApproveClubMembershipRequests(user, clubRecord));

  const handleLeaveClub = async () => {
    setLeaveLoading(true);
    try {
      const result = await leaveMyClub({ user, tenantId, clubId });
      if (!result.ok) {
        setMessage({ type: "error", text: result.error });
        return;
      }
      setMessage({ type: "success", text: "Đã rời CLB." });
      setLeaveConfirmOpen(false);
      await refresh();
      bumpRevision();
      navigate(CLUB_ROUTE_PATHS.DISCOVER, { replace: true });
    } finally {
      setLeaveLoading(false);
    }
  };

  return (
    <ClubPageShell
      title="CLB của tôi"
      subtitle="Trang chủ CLB — lịch sinh hoạt, thành viên và hoạt động."
      breadcrumbs={[{ label: "CLB", href: CLUB_ROUTE_PATHS.MY_CLUB }]}
    >
      <MyClubActionBar
        activeView={view}
        onViewChange={handleViewChange}
        onLeaveClick={() => setLeaveConfirmOpen(true)}
        leaveLoading={leaveLoading}
        showLeave={hasClub}
        showRequestsLink={showRequestsLink}
      />

      <ClubFeedbackAlert message={message} onClose={() => setMessage(null)} />

      {view === "schedule" ? (
        <MyClubSchedulePanel
          clubId={clubId}
          tenantId={tenantId}
          user={user}
          clubRecord={clubRecord}
          revision={revision}
          onRevision={bumpRevision}
          onMessage={setMessage}
        />
      ) : view === "members" ? (
        <MyClubMembersPanel
          clubId={clubId}
          tenantId={tenantId}
          clubRecord={clubRecord}
          user={user}
          manageHref={manageHref}
          revision={revision}
        />
      ) : clubSummary ? (
        <>
          <MyClubSummaryCard
            clubSummary={clubSummary}
            clubStats={clubStats}
            governanceLabels={governanceLabels}
            registeredCluster={registeredCluster}
            user={user}
            manageHref={manageHref}
            clubId={clubId}
            tenantId={tenantId}
            clubRecord={clubRecord}
            onRefresh={bumpRevision}
            onMessage={setMessage}
          />

          <MyClubHomeInsights
            clubId={clubId}
            tenantId={tenantId}
            clubRecord={clubRecord}
            user={user}
            revision={revision}
            showRequestsLink={showRequestsLink}
            onViewSchedule={() => handleViewChange("schedule")}
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
        <Alert
          severity="warning"
          action={
            <Button color="inherit" size="small" onClick={() => bumpRevision()}>
              Thử lại
            </Button>
          }
        >
          Không tải được tóm tắt CLB. Vui lòng thử lại.
        </Alert>
      )}

      <ClubConfirmDialog
        open={leaveConfirmOpen}
        title="Rời câu lạc bộ"
        description="Bạn sẽ mất quyền truy cập lịch và giải nội bộ. Bạn sẽ cần gửi yêu cầu mới để tham gia lại. Tiếp tục?"
        confirmLabel="Rời CLB"
        confirmColor="error"
        loading={leaveLoading}
        onConfirm={() => void handleLeaveClub()}
        onClose={() => setLeaveConfirmOpen(false)}
      />
    </ClubPageShell>
  );
}

export default function MyClubPage() {
  return (
    <ClubActiveMembershipGuard>
      <MyClubPageContent />
    </ClubActiveMembershipGuard>
  );
}
