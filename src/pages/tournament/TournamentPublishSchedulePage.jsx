import { useState } from "react";

import {
  Alert,
  Box,
  Button,
  Chip,
  Stack,
  Typography,
} from "@mui/material";

import {
  addTeamToTournament,
  buildRoundRobinMatchups,
  initializeTeamTournamentData,
} from "../../features/team-tournament/engines/teamTournamentEngine.js";
import {
  canPublishSchedule,
  getSchedulePublishStatus,
  lockPublishedSchedule,
  publishSchedule,
  SCHEDULE_PUBLISH_STATUS,
} from "../../features/team-tournament/engines/publishScheduleEngine.js";
import TournamentConfigPageShell from "../../components/tournament/TournamentConfigPageShell.jsx";

const STATUS_LABEL = {
  [SCHEDULE_PUBLISH_STATUS.DRAFT]: "Nháp",
  [SCHEDULE_PUBLISH_STATUS.PUBLISHED]: "Đã công bố",
  [SCHEDULE_PUBLISH_STATUS.LOCKED]: "Đã khóa",
};

function buildDemoTeamData() {
  let teamData = initializeTeamTournamentData();
  teamData = addTeamToTournament(teamData, { id: "team-a", name: "Team A", playerIds: [] });
  teamData = addTeamToTournament(teamData, { id: "team-b", name: "Team B", playerIds: [] });
  return buildRoundRobinMatchups(teamData, {
    scheduledAt: "2026-07-10T08:00:00.000Z",
  });
}

export default function TournamentPublishSchedulePage() {
  const [teamData, setTeamData] = useState(() => buildDemoTeamData());
  const [message, setMessage] = useState(null);
  const publish = getSchedulePublishStatus(teamData);

  const handlePublish = () => {
    const result = publishSchedule(teamData, { userId: "btc" });
    if (!result.ok) {
      setMessage({ type: "error", text: result.error });
      return;
    }
    setTeamData(result.teamData);
    setMessage({ type: "success", text: "Đã công bố lịch thi đấu." });
  };

  const handleLock = () => {
    const result = lockPublishedSchedule(teamData, { userId: "btc" });
    if (!result.ok) {
      setMessage({ type: "error", text: result.error });
      return;
    }
    setTeamData(result.teamData);
    setMessage({ type: "success", text: "Đã khóa lịch sau công bố." });
  };

  const readiness = canPublishSchedule(teamData);

  return (
    <TournamentConfigPageShell
      title="Công bố lịch"
      description="Công bố và khóa lịch thi đấu cho BTC."
    >
      {message ? (
        <Alert severity={message.type} sx={{ mb: 2 }} onClose={() => setMessage(null)}>
          {message.text}
        </Alert>
      ) : null}

      <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 2 }}>
        <Typography>Trạng thái:</Typography>
        <Chip label={STATUS_LABEL[publish.status] || publish.status} color="primary" />
      </Stack>

      {!readiness.ok ? (
        <Alert severity="info" sx={{ mb: 2 }}>
          {readiness.error}
        </Alert>
      ) : null}

      <Stack direction="row" spacing={1}>
        <Button
          variant="contained"
          onClick={handlePublish}
          disabled={publish.status === SCHEDULE_PUBLISH_STATUS.LOCKED}
        >
          Công bố lịch
        </Button>
        <Button
          variant="outlined"
          onClick={handleLock}
          disabled={publish.status !== SCHEDULE_PUBLISH_STATUS.PUBLISHED}
        >
          Khóa lịch
        </Button>
      </Stack>
    </TournamentConfigPageShell>
  );
}
