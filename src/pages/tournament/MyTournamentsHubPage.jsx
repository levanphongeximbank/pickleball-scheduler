import { useState } from "react";
import { Link as RouterLink, useNavigate } from "react-router-dom";

import {
  Alert,
  Box,
  Button,
  Chip,
  Paper,
  Stack,
  Typography,
} from "@mui/material";

import { useAuth } from "../../context/AuthContext.jsx";
import TournamentPageHeader from "../../components/tournament/TournamentPageHeader.jsx";
import { TournamentStatusChip } from "../../components/tournament/TournamentStatusChip.jsx";
import { useMyTournamentDashboards } from "../../features/team-tournament/my-dashboards/useMyTournamentDashboards.js";
import { roleLabelsVi } from "../../features/team-tournament/my-dashboards/myDashboardsModel.js";
import { openMyOfficialRefereeMatchCommand } from "../../features/tournament/official-lifecycle/officialOpenLifecycleCommands.js";

function TournamentCard({ item, onOpenOfficial, opening }) {
  const roles = roleLabelsVi(item.roles || []);
  return (
    <Paper variant="outlined" sx={{ p: 2 }}>
      <Stack spacing={1.5}>
        <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
          <Typography variant="h6" component="h2" sx={{ flex: 1, minWidth: 160 }}>
            {item.name}
          </Typography>
          <TournamentStatusChip status={item.status} />
        </Stack>

        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
          {item.competitionTypeLabel ? (
            <Chip size="small" color="primary" variant="outlined" label={item.competitionTypeLabel} />
          ) : null}
          {roles.map((label) => (
            <Chip key={label} size="small" label={label} />
          ))}
        </Stack>

        {item.myTeam?.name ? (
          <Typography variant="body2" color="text.secondary">
            Đội của tôi: {item.myTeam.name}
          </Typography>
        ) : null}

        {item.nextMatchup &&
        String(item.nextMatchup.teamAId || "").trim() &&
        String(item.nextMatchup.teamBId || "").trim() ? (
          <Typography variant="body2" color="text.secondary">
            Trận tiếp theo: {item.nextMatchup.teamAId} vs {item.nextMatchup.teamBId}
            {item.nextMatchup.scheduledAt
              ? ` · ${String(item.nextMatchup.scheduledAt)}`
              : ""}
          </Typography>
        ) : null}

        {item.assignmentMatch ? (
          <Stack spacing={0.5}>
            <Typography variant="body2" color="text.secondary">
              Trận được phân công: {item.assignmentMatch.teamAName} vs{" "}
              {item.assignmentMatch.teamBName}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {[
                item.assignmentMatch.groupLabel,
                item.assignmentMatch.scheduledStart,
                item.assignmentMatch.courtLabel,
              ]
                .filter(Boolean)
                .join(" · ")}
            </Typography>
          </Stack>
        ) : null}

        {item.openTaskCount > 0 ? (
          <Typography variant="body2">
            Việc cần làm: {item.openTaskCount}
          </Typography>
        ) : null}

        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
          {item.href ? (
            <Button
              component={RouterLink}
              to={item.href}
              variant="contained"
              size="small"
            >
              Vào giải
            </Button>
          ) : null}
          {item.captainPortalHref && item.openTaskCount > 0 ? (
            <Button
              component={RouterLink}
              to={item.captainPortalHref}
              variant="outlined"
              size="small"
            >
              Nộp đội hình
            </Button>
          ) : null}
          {item.refereeHref ? (
            <Button
              component={RouterLink}
              to={item.refereeHref}
              variant="outlined"
              size="small"
            >
              Chấm trận
            </Button>
          ) : null}
          {item.requiresSecureOpen ? (
            <Button
              type="button"
              variant="contained"
              size="small"
              disabled={opening}
              onClick={() => onOpenOfficial(item)}
            >
              {opening ? "Đang mở..." : "Chấm trận"}
            </Button>
          ) : null}
        </Stack>
      </Stack>
    </Paper>
  );
}

export default function MyTournamentsHubPage() {
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [openingId, setOpeningId] = useState("");
  const [openError, setOpenError] = useState("");
  const { loading, error, warning, tournaments } = useMyTournamentDashboards({
    enabled: Boolean(isAuthenticated),
  });

  async function handleOpenOfficial(item) {
    setOpeningId(item.id);
    setOpenError("");
    const result = await openMyOfficialRefereeMatchCommand({
      tournamentId: item.tournamentId,
      matchId: item.matchId,
    });
    setOpeningId("");
    if (!result?.ok || !result.routeToken) {
      setOpenError(result?.error || "Không thể mở trận Official/Open.");
      return;
    }
    navigate(`/referee/${encodeURIComponent(result.routeToken)}`);
  }

  if (!isAuthenticated) {
    return <Alert severity="warning">Đăng nhập để xem giải của bạn.</Alert>;
  }

  return (
    <Box>
      <TournamentPageHeader
        title="Giải của tôi"
        description="Các giải bạn được phép mở bảng điều khiển — đội trưởng, trọng tài, ban tổ chức hoặc người xem hợp lệ."
      />

      {loading ? <Alert severity="info">Đang tải giải của tôi...</Alert> : null}
      {error ? <Alert severity="error">{error}</Alert> : null}
      {warning ? <Alert severity="warning">{warning}</Alert> : null}
      {openError ? <Alert severity="error">{openError}</Alert> : null}

      {!loading && !error && tournaments.length === 0 ? (
        <Alert severity="info">
          Chưa có giải nào trong danh sách của bạn. Khi được phân công đội trưởng,
          trọng tài hoặc khi giải mở đăng ký, giải sẽ xuất hiện tại đây.
        </Alert>
      ) : null}

      <Stack spacing={2} sx={{ mt: 2 }}>
        {tournaments.map((item) => (
          <TournamentCard
            key={item.id}
            item={item}
            opening={openingId === item.id}
            onOpenOfficial={handleOpenOfficial}
          />
        ))}
      </Stack>
    </Box>
  );
}
