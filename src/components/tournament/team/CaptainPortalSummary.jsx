import { useEffect, useMemo, useState } from "react";
import { Alert, Chip, Stack, Typography } from "@mui/material";
import AccessTimeIcon from "@mui/icons-material/AccessTime";

import { LINEUP_STATUS } from "../../../features/team-tournament/constants.js";
import { getLineup } from "../../../features/team-tournament/models/index.js";
import {
  getSyncedNowMs,
  matchupNeedsLineupAction,
  resolveMatchupLineupPermissions,
} from "../../../features/team-tournament/services/lineupDeadlineService.js";
import { formatCountdownTo, formatTeamTournamentDateTime } from "./teamTournamentLabels.js";

function needsLineupAction(teamData, matchup, teamId, isCloudPrimary) {
  const lineup = getLineup(teamData, matchup.id, teamId);
  const status = lineup?.status || LINEUP_STATUS.NOT_SUBMITTED;
  const permissions = resolveMatchupLineupPermissions({
    matchup,
    lineup,
    isCloudPrimary,
  });
  return matchupNeedsLineupAction({ permissions, lineupStatus: status });
}

export default function CaptainPortalSummary({
  teamData,
  teamId,
  upcomingMatchups = [],
  serverClock = null,
  primaryCountdown = null,
  deadlineStatus = null,
  isCloudPrimary = false,
}) {
  const [syncedNowMs, setSyncedNowMs] = useState(() =>
    serverClock ? getSyncedNowMs(serverClock) : Date.now()
  );

  useEffect(() => {
    if (!serverClock) {
      return undefined;
    }
    const timer = setInterval(() => {
      setSyncedNowMs(getSyncedNowMs(serverClock));
    }, 1000);
    return () => clearInterval(timer);
  }, [serverClock]);

  const pendingCount = useMemo(
    () =>
      upcomingMatchups.filter((matchup) =>
        needsLineupAction(teamData, matchup, teamId, isCloudPrimary)
      ).length,
    [teamData, teamId, upcomingMatchups, isCloudPrimary]
  );

  const nextMatchup = useMemo(() => {
    if (upcomingMatchups.length === 0) {
      return null;
    }
    return [...upcomingMatchups].sort((a, b) => {
      const aTime = a.lineupLockAt ? new Date(a.lineupLockAt).getTime() : Infinity;
      const bTime = b.lineupLockAt ? new Date(b.lineupLockAt).getTime() : Infinity;
      return aTime - bTime;
    })[0];
  }, [upcomingMatchups]);

  const countdown =
    primaryCountdown ??
    (nextMatchup ? formatCountdownTo(nextMatchup.lineupLockAt, syncedNowMs) : null);
  const allSubmitted = upcomingMatchups.length > 0 && pendingCount === 0;

  return (
    <Stack spacing={1.5} sx={{ mb: 2 }}>
      <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
        <Chip
          label={
            pendingCount > 0
              ? `${pendingCount} trận cần nộp đội hình`
              : "Không còn trận cần nộp"
          }
          color={pendingCount > 0 ? "warning" : "success"}
          size="small"
        />
        {nextMatchup ? (
          <Chip
            icon={<AccessTimeIcon />}
            label={`Hạn gần nhất: ${formatTeamTournamentDateTime(nextMatchup.lineupLockAt)}`}
            size="small"
            variant="outlined"
          />
        ) : null}
        {countdown ? (
          <Chip label={countdown} size="small" color="info" variant="outlined" />
        ) : null}
        {deadlineStatus === "past" || deadlineStatus === "at" ? (
          <Chip label="Đã hết hạn nộp" size="small" color="error" variant="outlined" />
        ) : null}
      </Stack>

      {pendingCount > 0 ? (
        <Alert severity="info">
          Chọn VĐV cho từng nội dung, lưu nháp hoặc <strong>xác nhận nộp</strong> trước giờ khóa.
          Sau khi nộp, BTC sẽ khóa và công bố — bạn sẽ thấy cặp đấu chính thức khi được công bố.
        </Alert>
      ) : null}

      {allSubmitted ? (
        <Alert severity="success">
          Bạn đã nộp đủ đội hình cho các trận sắp tới. Chờ BTC khóa và công bố để xem cặp đấu chính thức.
        </Alert>
      ) : null}
    </Stack>
  );
}
