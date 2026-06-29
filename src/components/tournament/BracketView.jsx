import { useState } from "react";

import { useScoreDrafts } from "../../tournament/useScoreDrafts.js";
import {
  Alert,
  Box,
  Button,
  Chip,
  FormControl,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  TextField,
  Typography,
} from "@mui/material";

import { isKnockoutRoundLocked } from "../../tournament/engines/bracketEngine.js";
import { MATCH_STATUS } from "../../models/tournament/constants.js";
import {
  BRACKET_ROUND_MIN_WIDTH,
  getBracketLanesMinWidth,
  horizontalScrollSx,
  touchButtonSx,
} from "./mobileUi.js";

function formatBracketTeamName(team, seed) {
  if (team?.name) {
    return team.name;
  }

  if (seed) {
    return seed;
  }

  return "TBD";
}

function KnockoutScoreForm({ match, onSubmitScore, draft }) {
  const [localScoreA, setLocalScoreA] = useState(match?.scoreA ?? "");
  const [localScoreB, setLocalScoreB] = useState(match?.scoreB ?? "");

  if (!match || !onSubmitScore) {
    return null;
  }

  const draftScores = draft ? draft.resolveScores(match.id, match) : null;
  const scoreA = draftScores ? draftScores.scoreA : localScoreA;
  const scoreB = draftScores ? draftScores.scoreB : localScoreB;

  const completed =
    match.status === MATCH_STATUS.COMPLETED || match.status === MATCH_STATUS.FORFEIT;
  const disabled = !match.entryAId || !match.entryBId || completed;

  const handleSubmit = () => {
    const scores = { scoreA, scoreB };
    const ok = onSubmitScore(match.id, scores);
    if (draft && ok !== false) {
      draft.clearDraft(match.id);
    }
  };

  return (
    <Stack direction={{ xs: "column", sm: "row" }} spacing={1} alignItems="stretch">
      <TextField
        size="small"
        type="number"
        label="Điểm A"
        value={scoreA}
        inputProps={{ min: 0, inputMode: "numeric" }}
        sx={{ width: { xs: "100%", sm: 88 } }}
        disabled={disabled}
        onChange={(event) => {
          if (draft) {
            draft.updateScores(match.id, match, { scoreA: event.target.value });
            return;
          }
          setLocalScoreA(event.target.value);
        }}
      />
      <TextField
        size="small"
        type="number"
        label="Điểm B"
        value={scoreB}
        inputProps={{ min: 0, inputMode: "numeric" }}
        sx={{ width: { xs: "100%", sm: 88 } }}
        disabled={disabled}
        onChange={(event) => {
          if (draft) {
            draft.updateScores(match.id, match, { scoreB: event.target.value });
            return;
          }
          setLocalScoreB(event.target.value);
        }}
      />
      <Button
        size="large"
        variant="outlined"
        disabled={disabled}
        onClick={handleSubmit}
        sx={{ ...touchButtonSx, whiteSpace: "nowrap" }}
      >
        Lưu điểm
      </Button>
    </Stack>
  );
}

function BracketRoundColumn({
  round,
  roundLocked,
  knockoutMatchesByBracketId,
  onSelectWinner,
  onToggleRoundLock,
  onSubmitScore,
  draft,
}) {
  return (
    <Paper
      variant="outlined"
      sx={{
        minWidth: { xs: BRACKET_ROUND_MIN_WIDTH, sm: 300 },
        maxWidth: 360,
        flex: "0 0 auto",
        scrollSnapAlign: "start",
      }}
    >
      <Box sx={{ p: 1.5 }}>
        <Stack direction="row" spacing={1} sx={{ mb: 1, alignItems: "center", flexWrap: "wrap" }}>
          <Typography fontWeight="bold">{round.name}</Typography>
          <Chip
            size="small"
            label={round.completed ? "Hoàn tất" : "Đang đấu"}
            color={round.completed ? "success" : "warning"}
          />
          {round.completed && (
            <Chip
              size="small"
              label={roundLocked ? "Đã khóa" : "Đã mở khóa"}
              color={roundLocked ? "default" : "info"}
            />
          )}
        </Stack>

        {round.completed && onToggleRoundLock && (
          <Button
            fullWidth
            size="large"
            variant={roundLocked ? "outlined" : "contained"}
            color={roundLocked ? "primary" : "warning"}
            sx={{ mb: 1, ...touchButtonSx }}
            onClick={() => onToggleRoundLock(round.name, roundLocked)}
          >
            {roundLocked ? "Mở khóa chỉnh winner" : "Khóa lại vòng"}
          </Button>
        )}

        <Stack spacing={1}>
          {round.matches.map((match) => {
            const linkedMatch = knockoutMatchesByBracketId[match.id] || null;
            const winnerDisabled = !match.canPickWinner || roundLocked;

            return (
              <Stack
                key={match.id}
                spacing={1}
                sx={{
                  p: 1,
                  borderRadius: 1.5,
                  bgcolor: match.completed ? "success.50" : "background.paper",
                  border: "1px solid",
                  borderColor: "divider",
                }}
              >
                <Typography variant="body2" color="text.secondary" sx={{ wordBreak: "break-word" }}>
                  {match.id}: {formatBracketTeamName(match.home, match.homeSeed)} vs{" "}
                  {formatBracketTeamName(match.away, match.awaySeed)}
                </Typography>

                <Stack spacing={1}>
                  {onSelectWinner && (
                    <FormControl fullWidth size="small">
                      <InputLabel>Winner</InputLabel>
                      <Select
                        label="Winner"
                        value={match.winnerSide || ""}
                        disabled={winnerDisabled}
                        onChange={(event) => onSelectWinner(match.id, event.target.value)}
                      >
                        <MenuItem value="">
                          <em>Chưa chọn</em>
                        </MenuItem>
                        <MenuItem value="home">
                          {formatBracketTeamName(match.home, match.homeSeed)}
                        </MenuItem>
                        <MenuItem value="away">
                          {formatBracketTeamName(match.away, match.awaySeed)}
                        </MenuItem>
                      </Select>
                    </FormControl>
                  )}

                  {onSubmitScore && linkedMatch && (
                    <KnockoutScoreForm
                      match={linkedMatch}
                      onSubmitScore={onSubmitScore}
                      draft={draft}
                    />
                  )}
                </Stack>
              </Stack>
            );
          })}
        </Stack>
      </Box>
    </Paper>
  );
}

export default function BracketView({
  progress,
  unlockedRounds = {},
  knockoutMatchesByBracketId = {},
  onSelectWinner,
  onToggleRoundLock,
  onSubmitScore,
  onReset,
  canReset = false,
  draftScope,
}) {
  const draft = useScoreDrafts(draftScope);

  if (!progress?.rounds?.length) {
    return (
      <Typography variant="body2" color="text.secondary">
        Chưa có bracket knock-out.
      </Typography>
    );
  }

  return (
    <Stack spacing={1.5}>
      <Stack direction={{ xs: "column", sm: "row" }} spacing={1} justifyContent="space-between">
        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
          <Chip
            label={`Vòng hoàn tất: ${progress.completedRounds}/${progress.totalRounds}`}
            color={
              progress.completedRounds === progress.totalRounds ? "success" : "warning"
            }
          />
          <Chip
            label={
              progress.champion
                ? `Vô địch: ${progress.champion.name}`
                : "Chưa có nhà vô địch"
            }
            color={progress.champion ? "success" : "default"}
          />
        </Stack>
        {canReset && onReset && (
          <Button
            size="large"
            variant="outlined"
            color="error"
            onClick={onReset}
            sx={touchButtonSx}
          >
            Reset bracket
          </Button>
        )}
      </Stack>

      {progress.champion && (
        <Alert severity="success">Nhà vô địch: {progress.champion.name}</Alert>
      )}

      <Typography variant="caption" color="text.secondary">
        Vuốt ngang để xem các vòng bracket
      </Typography>

      <Box
        sx={{
          ...horizontalScrollSx,
          scrollSnapType: "x mandatory",
        }}
      >
        <Stack
          direction="row"
          spacing={2}
          sx={{
            minWidth: getBracketLanesMinWidth(progress.rounds.length),
            width: "max-content",
          }}
        >
          {progress.rounds.map((round) => (
            <BracketRoundColumn
              key={round.name}
              round={round}
              roundLocked={isKnockoutRoundLocked(round, unlockedRounds)}
              knockoutMatchesByBracketId={knockoutMatchesByBracketId}
              onSelectWinner={onSelectWinner}
              onToggleRoundLock={onToggleRoundLock}
              onSubmitScore={onSubmitScore}
              draft={draft}
            />
          ))}
        </Stack>
      </Box>
    </Stack>
  );
}
