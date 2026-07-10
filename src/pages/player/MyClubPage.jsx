import { useEffect, useMemo, useRef, useState } from "react";
import { Alert, Box, Button, Divider, Typography } from "@mui/material";
import { useSearchParams } from "react-router-dom";

import { useAuth } from "../../context/AuthContext.jsx";
import { useTenant } from "../../context/TenantContext.jsx";
import {
  canDeleteClub,
  canManageClubGovernance,
  canSelfRegisterClub,
  canViewFullClubMembers,
  fetchGovernanceNameHints,
  getClubById,
  getClubStats,
  getGovernanceDisplayLabels,
  getMyClubSummary,
  getRegisteredClusterLabel,
  getVicePresidentUserIds,
  leaveMyClub,
  listDiscoverableClubs,
  reclaimLocalPresidentClubForUser,
} from "../../features/club/index.js";
import MyClubSummaryCard from "./myClub/MyClubSummaryCard.jsx";
import MyClubCreatePanel from "./myClub/MyClubCreatePanel.jsx";
import MyClubGovernancePanel from "./myClub/MyClubGovernancePanel.jsx";
import MyClubActionBar from "./myClub/MyClubActionBar.jsx";
import MyClubDiscoverPanel from "./myClub/MyClubDiscoverPanel.jsx";
import MyClubSchedulePanel from "./myClub/MyClubSchedulePanel.jsx";
import MyClubMembersPanel from "./myClub/MyClubMembersPanel.jsx";
import MyClubMembershipRequestsPanel from "./myClub/MyClubMembershipRequestsPanel.jsx";
import JoinClubDialog from "./myClub/JoinClubDialog.jsx";
import { resolveInitialView } from "./myClub/myClubViewLogic.js";

export default function MyClubPage() {
  const { user, refresh } = useAuth();
  const { currentTenantId } = useTenant();
  const [searchParams, setSearchParams] = useSearchParams();
  const tenantId = currentTenantId || user?.tenantId || user?.venueId || "";
  const [revision, setRevision] = useState(0);
  const [message, setMessage] = useState(null);
  const [joinDialogOpen, setJoinDialogOpen] = useState(false);
  const [leaveLoading, setLeaveLoading] = useState(false);
  const [reclaiming, setReclaiming] = useState(false);
  const [nameHints, setNameHints] = useState({});
  const reclaimAttemptedRef = useRef(false);

  const clubId = user?.clubId || user?.club_id || null;
  const hasClub = Boolean(clubId);
  const canCreateClub = canSelfRegisterClub(user);

  const [view, setView] = useState(() => resolveInitialView(hasClub, searchParams));

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

  const runReclaim = async ({ manual = false } = {}) => {
    if (!user?.id || hasClub) {
      return;
    }

    setReclaiming(true);
    setMessage(null);

    try {
      const result = await Promise.race([
        reclaimLocalPresidentClubForUser(user),
        new Promise((resolve) => {
          window.setTimeout(
            () =>
              resolve({
                ok: false,
                code: "TIMEOUT",
                error: "Nhận lại CLB quá lâu. Đăng xuất rồi đăng nhập lại để thử.",
              }),
            20000
          );
        }),
      ]);

      if (result.ok && result.reclaimed) {
        await refresh();
        setRevision((value) => value + 1);
        setMessage({
          type: "success",
          text: `Đã nhận lại CLB ${result.clubName || ""} và lưu lên hệ thống chung.`,
        });
        handleViewChange("home");
      } else if (!result.ok && result.error) {
        setMessage({ type: "warning", text: result.error });
      } else if (manual && result.skipped) {
        setMessage({
          type: "info",
          text: "Không tìm thấy CLB do bạn làm Chủ tịch trên máy này để nhận lại.",
        });
      }
    } catch (error) {
      setMessage({
        type: "warning",
        text: error?.message || "Không nhận lại được CLB. Thử đăng xuất rồi đăng nhập lại.",
      });
    } finally {
      setReclaiming(false);
    }
  };

  // Máy còn CLB do user làm Chủ tịch nhưng profile cloud chưa gắn → tự nhận lại
  useEffect(() => {
    if (!user?.id || hasClub || reclaimAttemptedRef.current) {
      return undefined;
    }

    reclaimAttemptedRef.current = true;
    void runReclaim({ manual: false });
    return undefined;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, hasClub]);

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

      {!hasClub && (
        <Alert severity="info" sx={{ mb: 2 }}>
          Nếu bạn đã tạo CLB trên máy này trước đó (ví dụ CLB ACCC) nhưng hệ thống chưa nhận,
          nhấn nút bên dưới để nhận lại và lưu lên hệ thống chung.
          <Box sx={{ mt: 1.5 }}>
            <Button
              variant="contained"
              disabled={reclaiming}
              onClick={() => void runReclaim({ manual: true })}
            >
              {reclaiming ? "Đang nhận lại…" : "Nhận lại CLB của tôi"}
            </Button>
          </Box>
        </Alert>
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
      ) : view === "members" && hasClub ? (
        <MyClubMembersPanel
          clubId={clubId}
          tenantId={tenantId}
          clubRecord={clubRecord}
          user={user}
          manageHref={manageHref}
          revision={revision}
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
            clubId={clubId}
            tenantId={tenantId}
            clubRecord={clubRecord}
            onRefresh={bumpRevision}
            onMessage={setMessage}
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

          <MyClubMembershipRequestsPanel
            clubId={clubId}
            clubRecord={clubRecord}
            tenantId={tenantId}
            user={user}
            revision={revision}
            onRefresh={bumpRevision}
            onMessage={setMessage}
          />
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
