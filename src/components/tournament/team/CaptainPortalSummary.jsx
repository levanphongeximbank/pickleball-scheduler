import { useEffect, useMemo, useState } from "react";
import { Alert, Chip, Stack, Typography } from "@mui/material";
import AccessTimeIcon from "@mui/icons-material/AccessTime";

import { LINEUP_STATUS } from "../../../features/team-tournament/constants.js";
import { getLineup } from "../../../features/team-tournament/models/index.js";
import { formatCountdownTo, formatTeamTournamentDateTime } from "./teamTournamentLabels.js";

function needsLineupAction(teamData, matchup, teamId) {
  const lineup = getLineup(teamData, matchup.id, teamId);
  const status = lineup?.status || LINEUP_STATUS.NOT_SUBMITTED;
  return (
    status === LINEUP_STATUS.NOT_SUBMITTED ||
    status === LINEUP_STATUS.DRAFT ||
    status === LINEUP_STATUS.SUBMITTED
  );
}

export default function CaptainPortalSummary({ teamData, teamId, upcomingMatchups = [] }) {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  const pendingCount = useMemo(
    () => upcomingMatchups.filter((matchup) => needsLineupAction(teamData, matchup, teamId)).length,
    [teamData, teamId, upcomingMatchups]
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

  const countdown = nextMatchup ? formatCountdownTo(nextMatchup.lineupLockAt, now) : null;
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

      {upcomingMatchups.length === 0 ? (
        <Typography variant="body2" color="text.secondary">
          Chưa có lịch đối đầu cho đội của bạn.
        </Typography>
      ) : null}
    </Stack>
  );
}
