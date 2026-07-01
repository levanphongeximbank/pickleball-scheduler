import { useMemo, useState } from "react";
import { Link as RouterLink, useNavigate, useParams, useSearchParams } from "react-router-dom";
import {
  Alert,
  Box,
  Breadcrumbs,
  Chip,
  Link,
  Tab,
  Tabs,
  Typography,
} from "@mui/material";

import { useTenant } from "../../context/TenantContext.jsx";
import {
  CLUB_STATUS_LABELS,
  CLUB_STATUSES,
  getClubById,
} from "../../features/club/index.js";
import ClubOverviewTab from "./tabs/ClubOverviewTab.jsx";
import ClubMembersTab from "./tabs/ClubMembersTab.jsx";
import ClubRatingsTab from "./tabs/ClubRatingsTab.jsx";
import ClubMatchHistoryTab from "./tabs/ClubMatchHistoryTab.jsx";
import ClubTournamentsTab from "./tabs/ClubTournamentsTab.jsx";

const TABS = [
  { key: "overview", label: "Tổng quan" },
  { key: "members", label: "Thành viên" },
  { key: "ratings", label: "ELO / Xếp hạng" },
  { key: "history", label: "Lịch sử thi đấu" },
  { key: "tournaments", label: "Giải nội bộ" },
];

export default function ClubDetailPage() {
  const { clubId } = useParams();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { currentTenantId, revision } = useTenant();
  const [localRevision, setLocalRevision] = useState(0);

  const activeTab = searchParams.get("tab") || "overview";
  const tabIndex = Math.max(0, TABS.findIndex((t) => t.key === activeTab));

  const club = useMemo(
    () => getClubById(clubId, currentTenantId),
    [clubId, currentTenantId, revision, localRevision]
  );

  const handleRefresh = () => setLocalRevision((v) => v + 1);

  const handleTabChange = (_, index) => {
    setSearchParams({ tab: TABS[index].key });
  };

  if (!currentTenantId) {
    return <Alert severity="warning">Chưa xác định được tenant.</Alert>;
  }

  if (!club) {
    return (
      <Box>
        <Alert severity="error">Không tìm thấy CLB hoặc bạn không có quyền truy cập.</Alert>
        <Link component={RouterLink} to="/clubs" sx={{ mt: 2, display: "inline-block" }}>
          ← Quay lại danh sách CLB
        </Link>
      </Box>
    );
  }

  return (
    <Box>
      <Breadcrumbs sx={{ mb: 2 }}>
        <Link component={RouterLink} to="/clubs" underline="hover" color="inherit">
          CLB
        </Link>
        <Typography color="text.primary">{club.name}</Typography>
      </Breadcrumbs>

      <Box sx={{ mb: 2 }}>
        <StackTitle club={club} />
      </Box>

      <Tabs value={tabIndex} onChange={handleTabChange} variant="scrollable" scrollButtons="auto" sx={{ mb: 2 }}>
        {TABS.map((tab) => (
          <Tab key={tab.key} label={tab.label} />
        ))}
      </Tabs>

      {activeTab === "overview" && (
        <ClubOverviewTab club={club} tenantId={currentTenantId} onRefresh={handleRefresh} />
      )}
      {activeTab === "members" && (
        <ClubMembersTab club={club} tenantId={currentTenantId} onRefresh={handleRefresh} />
      )}
      {activeTab === "ratings" && (
        <ClubRatingsTab club={club} tenantId={currentTenantId} onRefresh={handleRefresh} />
      )}
      {activeTab === "history" && (
        <ClubMatchHistoryTab club={club} tenantId={currentTenantId} onRefresh={handleRefresh} />
      )}
      {activeTab === "tournaments" && (
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
        color={club.status === CLUB_STATUSES.ACTIVE ? "success" : "default"}
      />
    </Box>
  );
}
