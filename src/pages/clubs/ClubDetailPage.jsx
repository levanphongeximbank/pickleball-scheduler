import { useMemo, useState, useEffect } from "react";
import { Link as RouterLink, useNavigate, useParams, useSearchParams } from "react-router-dom";
import {
  Alert,
  Box,
  Breadcrumbs,
  Button,
  Chip,
  Link,
  Stack,
  Tab,
  Tabs,
  Typography,
} from "@mui/material";

import { useTenant } from "../../context/TenantContext.jsx";
import { useAuth } from "../../context/AuthContext.jsx";
import {
  CLUB_STATUS_LABELS,
  CLUB_STATUSES,
  getClubById,
  canViewFullClubMembers,
  canApproveClubRegistration,
  approveClubRegistration,
  rejectClubRegistration,
} from "../../features/club/index.js";
import ClubOverviewTab from "./tabs/ClubOverviewTab.jsx";
import ClubMembersTab from "./tabs/ClubMembersTab.jsx";
import ClubRatingsTab from "./tabs/ClubRatingsTab.jsx";
import ClubMatchHistoryTab from "./tabs/ClubMatchHistoryTab.jsx";
import ClubTournamentsTab from "./tabs/ClubTournamentsTab.jsx";

const ALL_TABS = [
  { key: "overview", label: "Tổng quan", requiresFullMembers: false },
  { key: "members", label: "Thành viên", requiresFullMembers: true },
  { key: "ratings", label: "ELO / Xếp hạng", requiresFullMembers: true },
  { key: "history", label: "Lịch sử thi đấu", requiresFullMembers: true },
  { key: "tournaments", label: "Giải nội bộ", requiresFullMembers: false },
];

export default function ClubDetailPage() {
  const { clubId } = useParams();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { currentTenantId, revision } = useTenant();
  const { user } = useAuth();
  const [localRevision, setLocalRevision] = useState(0);

  const club = useMemo(
    () => getClubById(clubId, currentTenantId),
    [clubId, currentTenantId, revision, localRevision]
  );

  const fullMemberAccess = useMemo(
    () => (club ? canViewFullClubMembers(user, club) : false),
    [user, club]
  );

  const TABS = useMemo(
    () => ALL_TABS.filter((tab) => !tab.requiresFullMembers || fullMemberAccess),
    [fullMemberAccess]
  );

  const activeTab = searchParams.get("tab") || "overview";
  const tabIndex = Math.max(0, TABS.findIndex((t) => t.key === activeTab));
  const safeTab = TABS[tabIndex]?.key || "overview";

  const handleRefresh = () => setLocalRevision((v) => v + 1);

  const showApprovalActions = club && canApproveClubRegistration(user, club);

  const handleApprove = () => {
    const result = approveClubRegistration(club.id, currentTenantId);
    if (!result.ok) {
      return;
    }
    handleRefresh();
  };

  const handleReject = () => {
    const result = rejectClubRegistration(club.id, currentTenantId);
    if (!result.ok) {
      return;
    }
    handleRefresh();
  };

  const handleTabChange = (_, index) => {
    setSearchParams({ tab: TABS[index].key });
  };

  useEffect(() => {
    if (activeTab !== safeTab) {
      setSearchParams({ tab: safeTab }, { replace: true });
    }
  }, [activeTab, safeTab, setSearchParams]);

  if (!currentTenantId) {
    return <Alert severity="warning">Chưa xác định được tenant.</Alert>;
  }

  if (!club) {
    return (
      <Box>
        <Alert severity="error">Không tìm thấy CLB hoặc bạn không có quyền truy cập.</Alert>
        <Link component={RouterLink} to="/manage/clubs" sx={{ mt: 2, display: "inline-block" }}>
          ← Quay lại danh sách CLB
        </Link>
      </Box>
    );
  }

  return (
    <Box>
      <Breadcrumbs sx={{ mb: 2 }}>
        <Link component={RouterLink} to="/manage/clubs" underline="hover" color="inherit">
          CLB
        </Link>
        <Typography color="text.primary">{club.name}</Typography>
      </Breadcrumbs>

      <Box sx={{ mb: 2 }}>
        <StackTitle club={club} />
      </Box>

      {club.status === CLUB_STATUSES.PENDING_APPROVAL && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          CLB đang chờ chủ sân duyệt trước khi hoạt động chính thức.
          {showApprovalActions && (
            <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
              <Button size="small" variant="contained" onClick={handleApprove}>
                Duyệt CLB
              </Button>
              <Button size="small" color="inherit" onClick={handleReject}>
                Từ chối
              </Button>
            </Stack>
          )}
        </Alert>
      )}

      <Tabs value={tabIndex} onChange={handleTabChange} variant="scrollable" scrollButtons="auto" sx={{ mb: 2 }}>
        {TABS.map((tab) => (
          <Tab key={tab.key} label={tab.label} />
        ))}
      </Tabs>

      {safeTab === "overview" && (
        <ClubOverviewTab club={club} tenantId={currentTenantId} onRefresh={handleRefresh} />
      )}
      {safeTab === "members" && (
        <ClubMembersTab club={club} tenantId={currentTenantId} onRefresh={handleRefresh} />
      )}
      {safeTab === "ratings" && (
        <ClubRatingsTab club={club} tenantId={currentTenantId} onRefresh={handleRefresh} />
      )}
      {safeTab === "history" && (
        <ClubMatchHistoryTab club={club} tenantId={currentTenantId} onRefresh={handleRefresh} />
      )}
      {safeTab === "tournaments" && (
        <ClubTournamentsTab
          club={club}
          tenantId={currentTenantId}
          onNavigateTournament={(tid) => navigate(`/tournament/internal/${tid}`)}
        />
      )}
    </Box>
  );
}

function StackTitle({ club }) {
  return (
    <Box>
      <Typography variant="h5" fontWeight={700}>
        {club.name}
        {club.code && (
          <Typography component="span" variant="body2" color="text.secondary" sx={{ ml: 1 }}>
            ({club.code})
          </Typography>
        )}
      </Typography>
      {club.description && (
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
          {club.description}
        </Typography>
      )}
      <Chip
        size="small"
        sx={{ mt: 1 }}
        label={CLUB_STATUS_LABELS[club.status] || club.status}
        color={
          club.status === CLUB_STATUSES.ACTIVE
            ? "success"
            : club.status === CLUB_STATUSES.PENDING_SETUP
              ? "warning"
              : club.status === CLUB_STATUSES.PENDING_APPROVAL
                ? "warning"
                : "default"
        }
      />
    </Box>
  );
}
