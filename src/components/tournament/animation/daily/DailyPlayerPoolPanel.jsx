import { useMemo } from "react";
import { Box, Button, Paper, Stack, Typography } from "@mui/material";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import PersonIcon from "@mui/icons-material/Person";
import ShuffleIcon from "@mui/icons-material/Shuffle";

import { useVisualShuffle } from "../shared/useVisualShuffle.js";
import {
  DAILY_PLAYER_STATUS,
  DAILY_PLAYER_STATUS_LABELS,
  FAIR_MATCH_PHASES,
} from "./dailyFairMatchUtils.js";

const STATUS_CLASS = {
  [DAILY_PLAYER_STATUS.WAITING_CREATE]: "daily-player-card--waiting",
  [DAILY_PLAYER_STATUS.CREATING]: "daily-player-card--creating",
  [DAILY_PLAYER_STATUS.HAS_MATCH]: "daily-player-card--matched",
  [DAILY_PLAYER_STATUS.ON_COURT]: "daily-player-card--court",
  [DAILY_PLAYER_STATUS.WAITING_NEXT]: "daily-player-card--next",
};

export default function DailyPlayerPoolPanel({
  players = [],
  shuffling = false,
  highlightTeamAIds = [],
  highlightTeamBIds = [],
  onShuffleVisual,
}) {
  const playerIds = useMemo(() => players.map((player) => player.id), [players]);
  const { displayOrder, reshuffle } = useVisualShuffle(playerIds, { active: shuffling });

  const playerById = useMemo(
    () => Object.fromEntries(players.map((player) => [String(player.id), player])),
    [players]
  );

  const handleReshuffle = () => {
    reshuffle();
    onShuffleVisual?.();
  };

  const displayPlayers = useMemo(
    () => displayOrder.map((id) => playerById[String(id)]).filter(Boolean),
    [displayOrder, playerById]
  );

  const teamASet = useMemo(() => new Set(highlightTeamAIds.map(String)), [highlightTeamAIds]);
  const teamBSet = useMemo(() => new Set(highlightTeamBIds.map(String)), [highlightTeamBIds]);

  return (
    <Paper variant="outlined" className="daily-fair-panel daily-fair-panel--players" sx={{ p: 1.25, height: "100%" }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
        <Typography variant="subtitle2" fontWeight="bold">
          Người chơi ({players.length})
        </Typography>
        <Button size="small" variant="text" startIcon={<ShuffleIcon />} onClick={handleReshuffle}>
          Xáo trộn
        </Button>
      </Stack>

      <Stack spacing={0.75} sx={{ maxHeight: 480, overflow: "auto" }}>
        {displayPlayers.length === 0 ? (
          <Typography variant="caption" color="text.secondary">
            Không đủ người chơi để tạo trận.
          </Typography>
        ) : (
          displayPlayers.map((player) => {
            const isTeamA = teamASet.has(String(player.id));
            const isTeamB = teamBSet.has(String(player.id));
            const isHighlighted =
              isTeamA ||
              isTeamB ||
              (shuffling && player.status === DAILY_PLAYER_STATUS.CREATING);
            const isMatched =
              player.status === DAILY_PLAYER_STATUS.HAS_MATCH ||
              player.status === DAILY_PLAYER_STATUS.ON_COURT;
            const statusClass =
              STATUS_CLASS[player.status] || STATUS_CLASS[DAILY_PLAYER_STATUS.WAITING_CREATE];

            return (
              <Box
                key={player.id}
                className={`daily-player-card ${statusClass}${
                  isHighlighted ? " daily-player-card--highlight" : ""
                }${isTeamA ? " daily-player-card--team-a" : ""}${
                  isTeamB ? " daily-player-card--team-b" : ""
                }${isMatched ? " daily-player-card--faded" : ""}${
                  isHighlighted && shuffling ? " daily-player-card--shake" : ""
                }`}
              >
                <Stack direction="row" spacing={1} alignItems="flex-start">
                  <Box className="daily-player-avatar">
                    <PersonIcon sx={{ fontSize: 18 }} />
                  </Box>
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Stack direction="row" spacing={0.5} alignItems="center">
                      <Typography variant="body2" fontWeight={700} noWrap title={player.name} sx={{ flex: 1 }}>
                        {player.name}
                      </Typography>
                      {isMatched ? (
                        <CheckCircleIcon sx={{ fontSize: 16, color: "success.main" }} />
                      ) : null}
                    </Stack>
                    <Typography variant="caption" className="daily-player-status-label">
                      {DAILY_PLAYER_STATUS_LABELS[player.status] || "Chờ tạo trận"}
                    </Typography>
                    <Typography variant="caption" color="text.secondary" display="block">
                      {player.gender || "—"} • Lv {player.level ?? "—"} • {player.matchesPlayed || 0} trận
                    </Typography>
                  </Box>
                </Stack>
              </Box>
            );
          })
        )}
      </Stack>
    </Paper>
  );
}

export { FAIR_MATCH_PHASES };
