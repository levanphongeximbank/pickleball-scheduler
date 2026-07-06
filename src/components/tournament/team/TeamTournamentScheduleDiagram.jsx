import { useMemo, useState } from "react";
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Alert,
  Box,
  Chip,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from "@mui/material";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import AccountTreeIcon from "@mui/icons-material/AccountTree";
import ViewTimelineIcon from "@mui/icons-material/ViewTimeline";

import { MATCHUP_STATUS } from "../../../features/team-tournament/constants.js";
import {
  buildTeamTournamentScheduleDiagram,
  buildUnifiedScheduleDiagram,
  isLineupPhaseOpen,
} from "../../../features/team-tournament/engines/teamRoundRobinScheduleEngine.js";
import TournamentSectionCard from "../TournamentSectionCard.jsx";
import {
  formatTeamTournamentDateTime,
  getMatchupStatusMeta,
} from "./teamTournamentLabels.js";
import TeamTournamentUnifiedTimeline from "./TeamTournamentUnifiedTimeline.jsx";
import "./teamScheduleDiagram.css";

const VIEW_MODE = {
  GROUP: "group",
  UNIFIED: "unified",
};

function countCompletedMatches(matches = []) {
  return matches.filter((match) => match.status === MATCHUP_STATUS.COMPLETED).length;
}

function formatSubMatchScore(match) {
  if (!match.result) {
    return "—";
  }
  const { teamAWins, teamBWins } = match.result;
  if (teamAWins == null && teamBWins == null) {
    return "—";
  }
  return `${teamAWins ?? 0}–${teamBWins ?? 0}`;
}

function RoundResultsTable({ matches }) {
  if (!matches.length) {
    return <Alert severity="info">Chưa có trận trong vòng này.</Alert>;
  }

  return (
    <TableContainer className="team-schedule-diagram__table-wrap">
      <Table size="small" className="team-schedule-diagram__table">
        <TableHead>
          <TableRow>
            <TableCell align="center" sx={{ width: 72 }}>
              #
            </TableCell>
            <TableCell>Đội A</TableCell>
            <TableCell align="center" sx={{ width: 48 }}>
              vs
            </TableCell>
            <TableCell>Đội B</TableCell>
            <TableCell>Trạng thái</TableCell>
            <TableCell align="center">TC</TableCell>
            <TableCell>Sân</TableCell>
            <TableCell>Giờ</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {matches.map((match) => {
            const statusMeta = match.status ? getMatchupStatusMeta(match.status) : null;
            const isOpen =
              !match.status ||
              match.status === MATCHUP_STATUS.LINEUP_OPEN ||
              match.status === MATCHUP_STATUS.SCHEDULED;

            return (
              <TableRow
                key={`${match.teamAId}-${match.teamBId}-${match.matchupId}`}
                hover
                className={match.matchupId ? "team-schedule-diagram__row--linked" : undefined}
              >
                <TableCell align="center" sx={{ fontWeight: 700 }}>
                  Trận {match.matchNumberInRound || match.matchNumber}
                </TableCell>
                <TableCell sx={{ fontWeight: 600 }}>{match.teamAName}</TableCell>
                <TableCell align="center" sx={{ color: "text.secondary", fontSize: 12 }}>
                  vs
                </TableCell>
                <TableCell sx={{ fontWeight: 600 }}>{match.teamBName}</TableCell>
                <TableCell>
                  {statusMeta ? (
                    <Chip size="small" label={statusMeta.label} color={statusMeta.color} />
                  ) : (
                    <Chip size="small" label="Chưa tạo lịch" variant="outlined" />
                  )}
                  {isOpen ? (
                    <Chip
                      size="small"
                      label="Chưa khóa"
                      variant="outlined"
                      color="warning"
                      sx={{ ml: 0.5 }}
                    />
                  ) : null}
                </TableCell>
                <TableCell align="center" sx={{ fontWeight: 700 }}>
                  {formatSubMatchScore(match)}
                </TableCell>
                <TableCell sx={{ fontSize: 12 }}>{match.courtLabel || "—"}</TableCell>
                <TableCell sx={{ fontSize: 12, color: "text.secondary" }}>
                  {match.scheduledAt ? formatTeamTournamentDateTime(match.scheduledAt) : "—"}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </TableContainer>
  );
}

function GroupScheduleDiagram({ group }) {
  return (
    <Accordion
      defaultExpanded
      disableGutters
      elevation={0}
      sx={{
        border: "1px solid",
        borderColor: "divider",
        borderRadius: "12px !important",
        "&:before": { display: "none" },
        mb: 1.5,
      }}
    >
      <AccordionSummary expandIcon={<ExpandMoreIcon />}>
        <Typography className="team-schedule-diagram__group-title">
          {group.groupName}
        </Typography>
        <Chip
          size="small"
          label={`${group.rounds.length} vòng`}
          sx={{ ml: 1.5 }}
          variant="outlined"
        />
      </AccordionSummary>
      <AccordionDetails sx={{ pt: 0 }}>
        <Stack spacing={1}>
          {group.rounds.map((round, index) => {
            const done = countCompletedMatches(round.matches);
            const total = round.matches.length;

            return (
              <Accordion
                key={`${group.groupId}-round-${round.roundNumber}`}
                defaultExpanded={index === 0}
                disableGutters
                elevation={0}
                sx={{
                  border: "1px solid",
                  borderColor: "divider",
                  borderRadius: "10px !important",
                  "&:before": { display: "none" },
                  bgcolor: "background.paper",
                }}
              >
                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                  <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
                    <Typography fontWeight={700}>Vòng {round.roundNumber}</Typography>
                    <Chip size="small" variant="outlined" label={`${total} trận`} />
                    {done > 0 ? (
                      <Chip size="small" color="success" label={`${done} hoàn tất`} />
                    ) : null}
                  </Stack>
                </AccordionSummary>
                <AccordionDetails>
                  {round.restingTeamNames?.length ? (
                    <Typography className="team-schedule-diagram__resting">
                      Đội nghỉ: {round.restingTeamNames.join(", ")}
                    </Typography>
                  ) : null}
                  <RoundResultsTable matches={round.matches} />
                </AccordionDetails>
              </Accordion>
            );
          })}
        </Stack>
      </AccordionDetails>
    </Accordion>
  );
}

export default function TeamTournamentScheduleDiagram({
  teamData,
  tournamentName = "",
  defaultViewMode = VIEW_MODE.GROUP,
  compact = false,
}) {
  const [viewMode, setViewMode] = useState(defaultViewMode);
  const groups = useMemo(() => buildTeamTournamentScheduleDiagram(teamData), [teamData]);
  const timeSlots = useMemo(() => buildUnifiedScheduleDiagram(teamData), [teamData]);
  const lineupOpen = isLineupPhaseOpen(teamData);
  const matchupCount = teamData?.matchups?.length || 0;
  const publishedCount = (teamData?.matchups || []).filter((matchup) =>
    [
      MATCHUP_STATUS.PUBLISHED,
      MATCHUP_STATUS.IN_PROGRESS,
      MATCHUP_STATUS.COMPLETED,
    ].includes(matchup.status)
  ).length;

  if ((teamData?.teams?.length || 0) < 2) {
    return (
      <Alert severity="info">
        Cần ít nhất 2 đội để hiển thị sơ đồ vòng tròn.
      </Alert>
    );
  }

  if (groups.length === 0) {
    return (
      <Alert severity="info">
        Chưa đủ dữ liệu để dựng sơ đồ. Tạo lịch vòng tròn ở tab Lịch đối đầu.
      </Alert>
    );
  }

  const body = (
    <Stack spacing={2}>
      {lineupOpen && matchupCount > 0 ? (
        <Alert severity="info">
          Sơ đồ dự kiến — duyệt trước khi khóa đội hình. Có thể thay đổi nếu tạo lại lịch.
        </Alert>
      ) : null}

      {matchupCount === 0 ? (
        <Alert severity="warning">
          Chưa có lượt đối đầu. Bấm &quot;Tạo lịch vòng tròn&quot; ở tab Lịch đối đầu.
        </Alert>
      ) : null}

      <ToggleButtonGroup
        exclusive
        size="small"
        value={viewMode}
        onChange={(_, value) => value && setViewMode(value)}
      >
        <ToggleButton value={VIEW_MODE.GROUP}>
          <AccountTreeIcon fontSize="small" sx={{ mr: 0.5 }} />
          Theo bảng
        </ToggleButton>
        <ToggleButton value={VIEW_MODE.UNIFIED}>
          <ViewTimelineIcon fontSize="small" sx={{ mr: 0.5 }} />
          Tổng thể
        </ToggleButton>
      </ToggleButtonGroup>

      {viewMode === VIEW_MODE.UNIFIED ? (
        <TeamTournamentUnifiedTimeline timeSlots={timeSlots} />
      ) : (
        groups.map((group) => (
          <GroupScheduleDiagram key={group.groupId || group.groupName} group={group} />
        ))
      )}
    </Stack>
  );

  if (compact) {
    return <Box className="team-schedule-diagram">{body}</Box>;
  }

  return (
    <Box className="team-schedule-diagram">
      <TournamentSectionCard
        title="Sơ đồ thi đấu"
        subtitle={
          tournamentName
            ? `${tournamentName} — vòng tròn theo bảng và theo vòng`
            : "Vòng tròn theo bảng và theo vòng"
        }
        badge={
          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
            <Chip
              size="small"
              icon={<AccountTreeIcon />}
              label={`${groups.length} bảng`}
              variant="outlined"
            />
            {matchupCount > 0 ? (
              <Chip
                size="small"
                label={`${publishedCount}/${matchupCount} lượt đã công bố`}
                variant="outlined"
              />
            ) : null}
          </Stack>
        }
      >
        {body}
      </TournamentSectionCard>
    </Box>
  );
}
